import secrets

from django.contrib.auth import authenticate
from rest_framework.authtoken.models import Token
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import User
from .nexconn import nexconn_post, NexconnError
from .serializers import (
    SignupSerializer, LoginSerializer, CreateGroupSerializer, JoinGroupSerializer,
    JoinByNameSerializer,
)

from .models import User, Room, Membership, BotSummary
from . import bot
from .serializers import TargetReachedSerializer
from django.db import IntegrityError

# All views below require "Authorization: Token <key>" (settings.REST_FRAMEWORK),
# except signup and login. The Nexconn user ID is always request.user.username.


# ---------- Accounts ----------
class SignupView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request):
        s = SignupSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        user = User.objects.create_user(
            username=s.validated_data["username"], password=s.validated_data["password"]
        )
        token = Token.objects.create(user=user)
        return Response({"userId": user.username, "token": token.key}, status=201)


class LoginView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request):
        s = LoginSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        user = authenticate(
            request, username=s.validated_data["username"], password=s.validated_data["password"]
        )
        if user is None:
            return Response({"error": "Wrong username or password."}, status=401)
        token, _ = Token.objects.get_or_create(user=user)
        return Response({"userId": user.username, "token": token.key})


class LogoutView(APIView):
    def post(self, request):
        request.auth.delete()  # the token used for this request
        return Response(status=204)


# ---------- Nexconn chat token ----------
class ChatTokenView(APIView):
    def post(self, request):
        user_id = request.user.username
        try:
            # docs.nexconn.ai/platform-chat-api/user/register
            data = nexconn_post("/v4/auth/access-token/issue", {"userId": user_id, "name": user_id})
        except NexconnError as e:
            return Response({"error": e.detail}, status=502)
        result = data["result"]
        return Response({"userId": result["userId"], "token": result["accessToken"]})


# ---------- Group rooms ----------
class CreateGroupView(APIView):
    def post(self, request):
        s = CreateGroupSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        group_id = "order" + secrets.token_hex(4)

        try:
            # Creator becomes owner and joins automatically (per Nexconn docs)
            nexconn_post("/v4/group-channel/create", {
                "channelId": group_id,
                "name": s.validated_data["groupName"],
                "owner": request.user.username,
            })
        except NexconnError as e:
            return Response({"error": e.detail}, status=502)

        room = Room.objects.create(group_id=group_id, name=s.validated_data["groupName"], creator=request.user)
        Membership.objects.create(user=request.user, room=room)

        return Response({"groupId": group_id}, status=201)


class JoinGroupView(APIView):
    def post(self, request, group_id):
        s = JoinGroupSerializer(data={"groupId": group_id})
        s.is_valid(raise_exception=True)

        try:
            data = nexconn_post("/v4/group-channel/join", {
                "channelId": s.validated_data["groupId"],
                "userIds": [request.user.username],
            })
        except NexconnError as e:
            # 25410 = "Group channel ID does not exist" (seen in Hour 2 testing)
            if isinstance(e.detail, dict) and e.detail.get("code") == 25410:
                return Response({"error": "Room not found"}, status=404)
            return Response({"error": e.detail}, status=502)

        result = data.get("result", {})

        room, _ = Room.objects.get_or_create(
            group_id=s.validated_data["groupId"],
            defaults={"name": result.get("name") or s.validated_data["groupId"]},
        )
        Membership.objects.get_or_create(user=request.user, room=room)
        return Response({
            "groupId": result.get("channelId", group_id),
            "name": result.get("name"),
            "memberCount": result.get("memberCount"),
        })


class JoinByNameView(APIView):
    """POST /api/groups/join-by-name/ {name}: find the room by name (ignoring case), then join it."""
    def post(self, request):
        s = JoinByNameSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        name = s.validated_data["name"]

        matches = list(Room.objects.filter(name__iexact=name)[:2])
        if not matches:
            return Response({"error": f'No room called "{name}". Check the name with the person who created it.'}, status=404)
        if len(matches) > 1:
            # Only possible for rooms created before names had to be unique
            return Response({"error": f'More than one room is called "{name}". Ask the creator for a new room.'}, status=409)
        room = matches[0]

        try:
            nexconn_post("/v4/group-channel/join", {
                "channelId": room.group_id,
                "userIds": [request.user.username],
            })
        except NexconnError as e:
            if isinstance(e.detail, dict) and e.detail.get("code") == 25410:
                return Response({"error": "That room no longer exists."}, status=404)
            return Response({"error": e.detail}, status=502)

        Membership.objects.get_or_create(user=request.user, room=room)
        return Response({"groupId": room.group_id, "name": room.name})


class TargetReachedView(APIView):
    """POST /api/groups/<group_id>/target-reached/ {cardId, item, price, target, shares}

    Called by the browser whose join completed a card's target. The order bot posts one
    summary message into the room; repeat calls for the same card do nothing.
    """
    def post(self, request, group_id):
        room = Room.objects.filter(group_id=group_id).first()
        if room is None:
            return Response({"error": "Room not found"}, status=404)
        if not Membership.objects.filter(user=request.user, room=room).exists():
            return Response({"error": "You're not in this room."}, status=403)

        s = TargetReachedSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        d = s.validated_data
        text = bot.summary_text(d["item"], d["price"], d["target"], d["shares"])

        # Claim the card first so two browsers can't both trigger a summary
        try:
            summary = BotSummary.objects.create(room=room, card_id=d["cardId"], text=text)
        except IntegrityError:
            return Response({"status": "already posted"})

        try:
            bot.post_to_room(room.group_id, text)
        except NexconnError as e:
            summary.delete()  # let a later call try again
            return Response({"error": e.detail}, status=502)

        return Response({"status": "posted", "text": text}, status=201)


class MyGroupsView(APIView):
    def get(self, request):
        # Rooms this user created or joined, newest first (one row per membership, so no duplicates)
        memberships = (
            Membership.objects.filter(user=request.user).select_related("room").order_by("-joined_at")
        )
        return Response([
            {
                "groupId": m.room.group_id,
                "name": m.room.name,
                "isCreator": m.room.creator_id == request.user.id,
                "joinedAt": m.joined_at,
            }
            for m in memberships
        ])
