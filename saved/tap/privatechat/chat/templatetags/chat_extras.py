from django import template

register = template.Library()

@register.filter
def get_item(dictionary, key):
    return dictionary.get(key)

@register.filter
def filter_messages_by_user(messages, user):
    return [message for message in messages if message.sender == user or message.receiver == user]
