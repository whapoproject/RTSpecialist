from django.urls import path
from django.contrib.auth import views as auth_views
from . import views

app_name = 'chat'

urlpatterns = [
    path('', views.register, name='register'),
    path('login/', views.user_login, name='login'),
    path('logout/', auth_views.LogoutView.as_view(), name='logout'),
    path('chat/', views.chat_room, name='chat_room'),
    path('approve/', views.approve_users, name='approve_users'),
    path('clear/<str:username>/', views.clear_chat, name='clear_chat'),
    path('fetch_messages/', views.fetch_messages, name='fetch_messages'),
]
