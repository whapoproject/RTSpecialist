from django.db.models.signals import post_save
from django.dispatch import receiver
from .models import Profile

@receiver(post_save, sender='auth.User')
def create_user_profile(sender, instance, created, **kwargs):
    if created:
        # Check if the profile already exists for this user
        if not Profile.objects.filter(user=instance).exists():
            Profile.objects.create(user=instance)
