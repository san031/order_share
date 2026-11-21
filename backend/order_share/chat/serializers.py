from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from .models import User, Room

USERNAME_RE = r"^[a-z0-9]{3,20}$"  # also the Nexconn user ID


class SignupSerializer(serializers.Serializer):
    username = serializers.RegexField(
        USERNAME_RE, error_messages={"invalid": "Use 3-20 lowercase letters or digits."}
    )
    password = serializers.CharField(write_only=True, max_length=128, trim_whitespace=False)

    def validate_username(self, value):
        if User.objects.filter(username=value).exists():
            raise serializers.ValidationError("That username is already taken.")
        return value

    def validate(self, data):
        # Django's password validators from settings (min length 8, not common, not all digits, ...)
        try:
            validate_password(data["password"], user=User(username=data["username"]))
        except DjangoValidationError as e:
            raise serializers.ValidationError({"password": list(e.messages)})
        return data


class LoginSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=20)
    password = serializers.CharField(write_only=True, max_length=128, trim_whitespace=False)


class CreateGroupSerializer(serializers.Serializer):
    groupName = serializers.CharField(max_length=64)  # Nexconn: name max 64 chars; trimmed by DRF

    def validate_groupName(self, value):
        # Room names are how people join, so they must be unique (ignoring case)
        if Room.objects.filter(name__iexact=value).exists():
            raise serializers.ValidationError("A room with that name already exists. Pick another name.")
        return value


class JoinByNameSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=64)  # trimmed by DRF; matched ignoring case


class JoinGroupSerializer(serializers.Serializer):
    # Nexconn: channelId is letters and digits only, max 64 chars
    groupId = serializers.RegexField(r"^[A-Za-z0-9]{1,64}$")
