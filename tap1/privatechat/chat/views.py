#chat/views.py
from django.utils import timezone
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
def chat_room(request):
    selected_username = request.GET.get('user')
    selected_user = None
    messages = []

    if selected_username and selected_username != 'new-chat':
        try:
            selected_user = User.objects.get(username=selected_username)
        except User.DoesNotExist:
            selected_user = None

    if selected_user:
        messages = Message.objects.filter(
            (Q(sender=request.user, receiver=selected_user) |
             Q(sender=selected_user, receiver=request.user))
        ).order_by('timestamp')

        # Mark unread messages as read and update read_at
        unread_messages = messages.filter(receiver=request.user, read=False)
        unread_messages.update(read=True, read_at=timezone.now())

        # Auto-delete messages read more than 1 minute ago
        for msg in messages:
            if msg.is_expired():
                msg.delete()

    users = User.objects.exclude(id=request.user.id)

    if request.method == 'POST' and selected_user:
        message_text = request.POST.get('message')
        audio_file = request.FILES.get('audio')
        reply_to_id = request.POST.get('reply_to')

        reply_to = None
        if reply_to_id:
            try:
                reply_to = Message.objects.get(id=reply_to_id)
            except Message.DoesNotExist:
                pass

        if message_text or audio_file:
            Message.objects.create(
                sender=request.user,
                receiver=selected_user,
                content=message_text,
                audio=audio_file,
                transcription=transcribe_audio(audio_file) if audio_file else None,
                reply_to=reply_to,
            )
        return redirect(f"{request.path}?user={selected_user.username}")

    return render(request, 'chat/chat_room.html', {
        'users': users,
        'messages': messages,
        'selected_user': selected_user,
    })
@login_required
def clear_chat(request, username):
    try:
        other_user = User.objects.get(username=username)
    except User.DoesNotExist:
        return redirect('chat:chat_room')  # Redirect if the user doesn't exist

    # Ensure that the user is authorized to clear the chat (optional)
    if request.user != other_user and not request.user.is_staff:
        return redirect('chat:chat_room')  # Prevent unauthorized users from clearing the chat

    # Delete messages exchanged between the current user and the other user
    Message.objects.filter(
        (Q(sender=request.user) & Q(receiver=other_user)) |
        (Q(sender=other_user) & Q(receiver=request.user))
    ).delete()

    return redirect('chat:chat_room')
@login_required
def fetch_messages(request):
    selected_username = request.GET.get('user')

    if not selected_username:
        return JsonResponse({'error': 'No user specified'}, status=400)

    try:
        selected_user = User.objects.get(username=selected_username)
    except User.DoesNotExist:
        return JsonResponse({'error': 'User does not exist'}, status=404)

    # Get all messages between current user and selected user
    messages = Message.objects.filter(
        Q(sender=request.user, receiver=selected_user) |
        Q(sender=selected_user, receiver=request.user)
    ).order_by('timestamp')

    # Format and ensure no duplication based on unique ID
    messages_data = []
    seen_ids = set()

    for msg in messages:
        if msg.id in seen_ids:
            continue
        seen_ids.add(msg.id)

        messages_data.append({
            'id': msg.id,  # helpful for frontend to avoid duplicates
            'sender': msg.sender.username,
            'receiver': msg.receiver.username,
            'content': msg.content,
            'timestamp': msg.timestamp.strftime("%Y-%m-%d %H:%M:%S"),
            'audio': msg.audio.url if msg.audio else None,
        })

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
