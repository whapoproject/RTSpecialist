from django import template

register = template.Library()
@register.filter
def get_item(dictionary, key):
    if isinstance(dictionary, dict):
        return dictionary.get(key, 0)
    return 0

# myapp/templatetags/chat_extras.py


@register.filter
def filter_messages_by_user(messages, user):
    return [message for message in messages if message.sender == user or message.receiver == user]

