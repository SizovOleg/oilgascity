"""IP посетителя за nginx для django-axes.

nginx перезаписывает X-Real-IP адресом соединения (proxy_set_header X-Real-IP $remote_addr), поэтому снаружи
его не подделать; gunicorn слушает только 127.0.0.1. Без прокси (локальная разработка) берётся REMOTE_ADDR.
"""
from django.http import HttpRequest


def client_ip(request: HttpRequest) -> str | None:
    """Адрес посетителя: X-Real-IP от nginx, иначе адрес соединения."""
    return request.META.get("HTTP_X_REAL_IP") or request.META.get("REMOTE_ADDR")
