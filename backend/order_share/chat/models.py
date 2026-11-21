from django.contrib.auth.models import AbstractUser
from django.core.validators import RegexValidator
from django.db import models


class User(AbstractUser):
    """App user. The username doubles as the Nexconn user ID."""
    username = models.CharField(
        max_length=20,
        unique=True,
        validators=[RegexValidator(r"^[a-z0-9]{3,20}$", "Use 3-20 lowercase letters or digits.")],
        error_messages={"unique": "That username is already taken."},
    )

class Room(models.Model):
    group_id = models.CharField(max_length=64, unique=True)   # Nexconn channelId
    name = models.CharField(max_length=64)
    creator = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name="created_rooms")
    created_at = models.DateTimeField(auto_now_add=True)


class Membership(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="memberships")
    room = models.ForeignKey(Room, on_delete=models.CASCADE, related_name="memberships")
    joined_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("user", "room")