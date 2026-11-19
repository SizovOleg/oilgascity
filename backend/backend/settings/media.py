"""Хранилище загрузок Wagtail: локальный диск или публичный бакет B2 по S3 API.

Переключается флагом MEDIA_STORAGE=s3 в окружении (на сервере /etc/oilgascity-wagtail.env).
Без флага файлы пишутся на диск, даже если ключи бакета уже заданы. Подробности и откат:
openspec/changes/media-external-storage/design.md.
"""

from collections.abc import Mapping
from typing import Any

from django.core.exceptions import ImproperlyConfigured

REQUIRED_S3_VARS = (
    "MEDIA_S3_BUCKET",
    "MEDIA_S3_ENDPOINT_URL",
    "MEDIA_S3_REGION",
    "MEDIA_S3_ACCESS_KEY_ID",
    "MEDIA_S3_SECRET_ACCESS_KEY",
)

# Адреса файлов остаются на своём домене: nginx проксирует этот префикс в бакет
DEFAULT_PUBLIC_DOMAIN = "oilgascity.ru/oilgascity-media"

LOCAL_STORAGE = {"BACKEND": "django.core.files.storage.FileSystemStorage"}

# Опции в STORAGES не передаются: класс берёт их из окружения сам (см. backend/storage.py)
S3_STORAGE = {"BACKEND": "backend.storage.MediaS3Storage"}


def media_storage_from_env(environ: Mapping[str, str]) -> dict[str, Any]:
    """Настройки STORAGES["default"] по переменным окружения."""
    mode = environ.get("MEDIA_STORAGE", "").strip().lower()
    if mode in ("", "local"):
        return dict(LOCAL_STORAGE)
    if mode != "s3":
        raise ImproperlyConfigured(f"MEDIA_STORAGE={mode!r}: допустимы 'local' и 's3'")
    # Проверка обязательных переменных уже при загрузке настроек: сервис не стартует без них
    media_s3_options(environ)
    return dict(S3_STORAGE)


def media_s3_options(environ: Mapping[str, str]) -> dict[str, Any]:
    """Опции S3Storage для бакета B2 из переменных окружения."""
    missing = [name for name in REQUIRED_S3_VARS if not environ.get(name, "").strip()]
    if missing:
        raise ImproperlyConfigured("MEDIA_STORAGE=s3, но не заданы: " + ", ".join(missing))

    # botocore нужен только при включённом бакете
    from botocore.config import Config

    return {
        "bucket_name": environ["MEDIA_S3_BUCKET"].strip(),
        "endpoint_url": environ["MEDIA_S3_ENDPOINT_URL"].strip(),
        "region_name": environ["MEDIA_S3_REGION"].strip(),
        "access_key": environ["MEDIA_S3_ACCESS_KEY_ID"].strip(),
        "secret_key": environ["MEDIA_S3_SECRET_ACCESS_KEY"].strip(),
        "location": environ.get("MEDIA_S3_LOCATION", "").strip().strip("/"),
        "custom_domain": environ.get("MEDIA_PUBLIC_DOMAIN", DEFAULT_PUBLIC_DOMAIN).strip().strip("/"),
        # Бакет публичный, адреса без подписи
        "querystring_auth": False,
        # Wagtail даёт файлам с одинаковым именем новые имена; перезапись затёрла бы оригинал
        "file_overwrite": False,
        # B2 не поддерживает ACL отдельных объектов, доступ задаётся на весь бакет
        "default_acl": None,
        # client_config заменяет стандартный конфиг целиком, поэтому подпись и стиль
        # адресации заданы явно. when_required: B2 отвергал заголовки checksum boto3
        # >= 1.35.99 (django-storages #1498); 2026-11-19 B2 принял и их, оставлено страховкой
        "client_config": Config(
            signature_version="s3v4",
            s3={"addressing_style": "virtual"},
            request_checksum_calculation="when_required",
            response_checksum_validation="when_required",
        ),
    }
