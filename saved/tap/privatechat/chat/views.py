#chat/views.py

from django.shortcuts import render, redirect
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.decorators import login_required, user_passes_test
from django.contrib.auth.models import User
from django.http import JsonResponse, HttpResponse
from django.views.decorators.csrf import csrf_exempt
from django.core.files.base import ContentFile
from django.db.models import Q
import base64
from .transcription_utils import transcribe_audio
from .models import Message, Profile


def register(request):
    if request.method == 'POST':
        username = request.POST['username']
        password = request.POST['password']

        if User.objects.filter(username=username).exists():
            return render(request, 'chat/register.html', {'error': 'Username already exists'})

        user = User.objects.create_user(username=username, password=password, is_active=False)
        return render(request, 'chat/register.html', {'success': 'Registration successful! Wait for approval.'})

    return render(request, 'chat/register.html')


def user_login(request):
    if request.method == 'POST':
        username = request.POST['username']
        password = request.POST['password']

        user = authenticate(request, username=username, password=password)

        if user is not None:
            if user.is_active:
                login(request, user)
                return redirect('chat:chat_room')
            else:
                return render(request, 'chat/login.html', {'error': 'Account not approved yet'})
        else:
            return render(request, 'chat/login.html', {'error': 'Invalid credentials'})

    return render(request, 'chat/login.html')


def user_logout(request):
    logout(request)
    return redirect('chat:login')



@login_required

@login_required
def chat_room(request):
    selected_username = request.GET.get('user')
    selected_user = None
    messages = []

    if selected_username:
        if selected_username == 'new-chat':
            selected_user = None
        else:
            try:
                selected_user = User.objects.get(username=selected_username)
            except User.DoesNotExist:
                selected_user = None

    if selected_user:
        messages = Message.objects.filter(
            (Q(sender=request.user) & Q(receiver=selected_user)) |
            (Q(sender=selected_user) & Q(receiver=request.user))
        ).order_by('timestamp')

    users = User.objects.exclude(id=request.user.id)

    if request.method == 'POST' and selected_user:
        message_text = request.POST.get('message')
        audio_file = request.FILES.get('audio')

        if message_text:
            Message.objects.create(sender=request.user, receiver=selected_user, content=message_text)
        elif audio_file:
            transcription = transcribe_audio(audio_file)
            Message.objects.create(sender=request.user, receiver=selected_user, audio=audio_file, transcription=transcription)

        return redirect(f"{request.path}?user={selected_user.username}")

    return render(request, 'chat/chat_room.html', {
        'users': users,
        'messages': messages,
        'selected_user': selected_user,
    })

@login_required
def fetch_messages(request):
    selected_username = request.GET.get('user')

    if not selected_username:
        return JsonResponse({'error': 'No user specified'}, status=400)

    try:
        selected_user = User.objects.get(username=selected_username)
    except User.DoesNotExist:
        return JsonResponse({'error': 'User does not exist'}, status=404)

    messages = Message.objects.filter(
        (Q(sender=request.user) & Q(receiver=selected_user)) |
        (Q(sender=selected_user) & Q(receiver=request.user))
    ).order_by('timestamp')

    messages_data = [
        {
            'sender': msg.sender.username,
            'content': msg.content,
            'timestamp': msg.timestamp.strftime("%Y-%m-%d %H:%M:%S"),
            'audio': msg.audio.url if msg.audio else None,
        }
        for msg in messages
    ]

    return JsonResponse({'messages': messages_data})


@user_passes_test(lambda u: u.is_superuser)
def approve_users(request):
    unapproved_profiles = Profile.objects.filter(approved=False)

    if request.method == 'POST':
        action = request.POST.get('action')
        profile_id = request.POST.get('profile_id')

        profile = Profile.objects.get(id=profile_id)

        if action == 'approve':
            profile.approved = True
            profile.save()
        elif action == 'delete':
            profile.deleted = True
            profile.save()

        return redirect('chat:approve_users')

    return render(request, 'chat/approve_users.html', {'profiles': unapproved_profiles})
