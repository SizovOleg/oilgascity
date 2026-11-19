"""Хранилище загрузок в бакете B2 (включается флагом MEDIA_STORAGE=s3, см. settings/media.py)."""

import os
from typing import Any

from storages.backends.s3 import S3Storage

from backend.settings.media import media_s3_options


class MediaS3Storage(S3Storage):
    """S3Storage, который сам берёт настройки из окружения.

    Wagtail 7 удаляет файлы фоновой задачей и передаёт ей storage.deconstruct(): аргументы
    задачи обязаны сериализоваться в JSON. Если отдать опции через STORAGES["OPTIONS"], в
    них попадут botocore Config (удаление падает с TypeError) и ключи бакета. Здесь
    конструктор вызывается без аргументов, поэтому deconstruct() чистый, а задача
    пересоздаёт хранилище из того же окружения. overrides нужны только тестам.
    """

    def __init__(self, **overrides: Any) -> None:
        options = media_s3_options(os.environ)
        options.update(overrides)
        super().__init__(**options)
