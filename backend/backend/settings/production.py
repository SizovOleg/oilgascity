"""Настройки прода. Секреты и адреса приходят из окружения.

На сервере переменные лежат в /etc/oilgascity-wagtail.env (права 600), их подключает
systemd (drop-in oilgascity-wagtail.service.d/env.conf) и scripts/deploy.sh.
"""

import os

from django.core.exceptions import ImproperlyConfigured

from .base import *


def env_list(name: str, default: str) -> list[str]:
    """Список из переменной окружения через запятую."""
    return [item.strip() for item in os.environ.get(name, default).split(",") if item.strip()]


DEBUG = False

SECRET_KEY = os.environ.get("DJANGO_SECRET_KEY", "")
if not SECRET_KEY:
    raise ImproperlyConfigured(
        "DJANGO_SECRET_KEY не задан: подключите /etc/oilgascity-wagtail.env"
    )

# 127.0.0.1 и localhost: проверка здоровья в scripts/deploy.sh ходит напрямую в gunicorn
ALLOWED_HOSTS = env_list(
    "DJANGO_ALLOWED_HOSTS", "oilgascity.ru,www.oilgascity.ru,127.0.0.1,localhost"
)
CSRF_TRUSTED_ORIGINS = env_list(
    "DJANGO_CSRF_TRUSTED_ORIGINS", "https://oilgascity.ru,https://www.oilgascity.ru"
)

# HTTPS завершается в nginx, он передаёт X-Forwarded-Proto; gunicorn слушает только 127.0.0.1
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True

WAGTAILAPI_BASE_URL = os.environ.get("WAGTAILAPI_BASE_URL", "https://oilgascity.ru")

# Почтовый сервер не настроен: письма Wagtail пишутся в журнал, а не теряются с ошибкой
EMAIL_BACKEND = os.environ.get(
    "DJANGO_EMAIL_BACKEND", "django.core.mail.backends.console.EmailBackend"
)

# ManifestStaticFilesStorage is recommended in production, to prevent
# outdated JavaScript / CSS assets being served from cache
# (e.g. after a Wagtail upgrade).
# See https://docs.djangoproject.com/en/6.0/ref/contrib/staticfiles/#manifeststaticfilesstorage
STORAGES["staticfiles"]["BACKEND"] = "django.contrib.staticfiles.storage.ManifestStaticFilesStorage"

# При DEBUG=False Django по умолчанию никуда не пишет ошибки: выводим их в stderr (journald)
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "handlers": {"console": {"class": "logging.StreamHandler"}},
    "root": {"handlers": ["console"], "level": "WARNING"},
    "loggers": {
        "django": {
            "handlers": ["console"],
            "level": os.environ.get("DJANGO_LOG_LEVEL", "INFO"),
            "propagate": False,
        },
    },
}

try:
    from .local import *
except ImportError:
    pass
