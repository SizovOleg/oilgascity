"""Уменьшенные копии фото, которые отдаёт API (ImageSerializedField, GallerySerializedField).

Без заранее созданных копий их делает первый посетитель страницы: Wagtail скачивает
оригинал из хранилища, обрабатывает и загружает копию обратно, и страница с десятком
новых фото отвечает несколько секунд. Поэтому копии создаются сразу при сохранении картинки.
"""

import logging

from wagtail.images.models import AbstractImage

logger = logging.getLogger(__name__)

THUMBNAIL_SPEC = "fill-400x300"
LARGE_SPEC = "width-1200"
API_RENDITIONS = (THUMBNAIL_SPEC, LARGE_SPEC)


def pregenerate_renditions(sender: type, instance: AbstractImage, **kwargs: object) -> None:
    """post_save картинки: создать копии для API (уже существующие только читаются из БД)."""
    for spec in API_RENDITIONS:
        try:
            instance.get_rendition(spec)
        except Exception:
            # Загрузку фото не роняем: копию сделает первый запрос, а ошибка видна в журнале
            logger.exception("Не удалось создать копию %s для картинки id=%s", spec, instance.pk)
