from django.urls import path
from .views import (
    SignupView, LoginView, LogoutView, ChatTokenView, CreateGroupView, JoinGroupView,MyGroupsView,
    JoinByNameView,
)

urlpatterns = [
    path("auth/signup/", SignupView.as_view()),
    path("auth/login/", LoginView.as_view()),
    path("auth/logout/", LogoutView.as_view()),
    path("chat-token/", ChatTokenView.as_view()),
    path("groups/", CreateGroupView.as_view()),
    path("groups/<str:group_id>/join/", JoinGroupView.as_view()),
    path("groups/mine/", MyGroupsView.as_view()),
    path("groups/join-by-name/", JoinByNameView.as_view()),

    
]
