"""Хранилище загрузок: выбор по флагу и работа с бакетом S3 (moto вместо B2)."""

import io
import json
import unittest
from typing import Any
from unittest import mock

from django.core.exceptions import ImproperlyConfigured
from django.core.files.base import ContentFile
from django.core.files.images import ImageFile
from django.core.files.storage import storages
from django.test import SimpleTestCase, TestCase, override_settings

from backend.settings.media import REQUIRED_S3_VARS, media_s3_options, media_storage_from_env

try:
    import boto3
    from moto import mock_aws
except ImportError:  # moto ставится из requirements-dev.txt
    mock_aws = None

S3_ENV = {
    "MEDIA_S3_BUCKET": "oilgascity-media-test",
    "MEDIA_S3_ENDPOINT_URL": "https://s3.eu-central-003.backblazeb2.com",
    "MEDIA_S3_REGION": "eu-central-003",
    "MEDIA_S3_ACCESS_KEY_ID": "test-key-id",
    "MEDIA_S3_SECRET_ACCESS_KEY": "test-secret-value",
}


class MediaStorageSettingsTests(SimpleTestCase):
    """Выбор хранилища по окружению, без сети."""

    def test_no_flag_means_local_disk(self) -> None:
        self.assertEqual(
            media_storage_from_env({})["BACKEND"], "django.core.files.storage.FileSystemStorage"
        )

    def test_keys_without_flag_change_nothing(self) -> None:
        self.assertEqual(
            media_storage_from_env(S3_ENV)["BACKEND"], "django.core.files.storage.FileSystemStorage"
        )

    def test_unknown_mode_is_rejected(self) -> None:
        with self.assertRaisesRegex(ImproperlyConfigured, "MEDIA_STORAGE"):
            media_storage_from_env({"MEDIA_STORAGE": "ftp"})

    def test_flag_without_keys_names_missing_variables(self) -> None:
        for name in REQUIRED_S3_VARS:
            with self.subTest(missing=name):
                env = {**S3_ENV, "MEDIA_STORAGE": "s3", name: " "}
                with self.assertRaisesRegex(ImproperlyConfigured, name):
                    media_storage_from_env(env)

    def test_flag_selects_project_storage_without_options(self) -> None:
        # Опции с ключами и botocore Config не должны попадать в STORAGES
        config = media_storage_from_env({**S3_ENV, "MEDIA_STORAGE": "S3"})
        self.assertEqual(config, {"BACKEND": "backend.storage.MediaS3Storage"})

    def test_s3_options(self) -> None:
        options = media_s3_options(S3_ENV)
        self.assertEqual(options["bucket_name"], "oilgascity-media-test")
        self.assertEqual(options["custom_domain"], "oilgascity.ru/oilgascity-media")
        self.assertEqual(options["location"], "")
        self.assertFalse(options["querystring_auth"])
        self.assertFalse(options["file_overwrite"])
        client = options["client_config"]
        self.assertEqual(client.request_checksum_calculation, "when_required")
        self.assertEqual(client.response_checksum_validation, "when_required")
        self.assertEqual(client.s3, {"addressing_style": "virtual"})

    def test_public_domain_and_location_are_normalised(self) -> None:
        env = {**S3_ENV, "MEDIA_PUBLIC_DOMAIN": "reliefwestsib.ru/media/", "MEDIA_S3_LOCATION": "/site/"}
        options = media_s3_options(env)
        self.assertEqual(options["custom_domain"], "reliefwestsib.ru/media")
        self.assertEqual(options["location"], "site")

    @mock.patch.dict("os.environ", S3_ENV)
    def test_deconstruct_is_json_and_has_no_secrets(self) -> None:
        # Wagtail передаёт storage.deconstruct() в фоновую задачу удаления файла
        from backend.storage import MediaS3Storage

        dumped = json.dumps(MediaS3Storage().deconstruct())
        self.assertIn("backend.storage.MediaS3Storage", dumped)
        self.assertNotIn(S3_ENV["MEDIA_S3_SECRET_ACCESS_KEY"], dumped)
        self.assertNotIn(S3_ENV["MEDIA_S3_ACCESS_KEY_ID"], dumped)


def moto_storages() -> dict[str, Any]:
    """Хранилище проекта, но запросы перехватывает moto (endpoint по умолчанию AWS)."""
    return {
        "default": {
            "BACKEND": media_storage_from_env({**S3_ENV, "MEDIA_STORAGE": "s3"})["BACKEND"],
            "OPTIONS": {"endpoint_url": None},
        },
        "staticfiles": {"BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage"},
    }


def jpeg_bytes() -> bytes:
    from PIL import Image as PILImage

    buffer = io.BytesIO()
    PILImage.new("RGB", (800, 600), (30, 120, 90)).save(buffer, "JPEG")
    return buffer.getvalue()


@unittest.skipIf(mock_aws is None, "moto не установлен (pip install -r requirements-dev.txt)")
class S3MediaStorageTests(TestCase):
    """Загрузки Wagtail в бакет: оригиналы, рендеры, документы, адреса, удаление."""

    def setUp(self) -> None:
        env_patch = mock.patch.dict("os.environ", S3_ENV)
        env_patch.start()
        self.addCleanup(env_patch.stop)
        self.mock = mock_aws()
        self.mock.start()
        self.addCleanup(self.mock.stop)
        self.s3 = boto3.client("s3", region_name="us-east-1")
        self.s3.create_bucket(Bucket=S3_ENV["MEDIA_S3_BUCKET"])
        settings_override = override_settings(STORAGES=moto_storages())
        settings_override.enable()
        self.addCleanup(settings_override.disable)

    def bucket_keys(self) -> list[str]:
        listing = self.s3.list_objects_v2(Bucket=S3_ENV["MEDIA_S3_BUCKET"])
        return sorted(item["Key"] for item in listing.get("Contents", []))

    def upload_image(self, title: str) -> Any:
        from wagtail.images.models import Image

        image = Image(title=title)
        image.file.save("photo.jpg", ImageFile(io.BytesIO(jpeg_bytes()), name="photo.jpg"), save=False)
        image.save()
        return image

    def test_project_storage_is_used(self) -> None:
        self.assertEqual(type(storages["default"]).__name__, "MediaS3Storage")

    def test_original_and_rendition_go_to_bucket(self) -> None:
        image = self.upload_image("Муравленко")
        rendition = image.get_rendition("fill-400x300")
        self.assertIn(image.file.name, self.bucket_keys())
        self.assertIn(rendition.file.name, self.bucket_keys())
        # Повторный запрос берёт готовый рендер, а не создаёт новый
        self.assertEqual(image.get_rendition("fill-400x300").pk, rendition.pk)

    def test_urls_stay_on_site_domain(self) -> None:
        image = self.upload_image("Когалым")
        rendition = image.get_rendition("width-1200")
        for url in (image.file.url, rendition.url):
            with self.subTest(url=url):
                self.assertTrue(url.startswith("https://oilgascity.ru/oilgascity-media/"))
                self.assertNotIn("backblazeb2", url)
                self.assertNotIn("amazonaws", url)

    def test_same_name_does_not_overwrite(self) -> None:
        first = self.upload_image("первое")
        second = self.upload_image("второе")
        self.assertNotEqual(first.file.name, second.file.name)
        self.assertIn(first.file.name, self.bucket_keys())
        self.assertIn(second.file.name, self.bucket_keys())

    def test_deleting_image_removes_original_and_renditions(self) -> None:
        # Wagtail 7 удаляет файлы задачей после коммита: аргументы задачи должны быть JSON
        image = self.upload_image("на удаление")
        rendition = image.get_rendition("fill-400x300")
        keys = {image.file.name, rendition.file.name}
        self.assertTrue(keys <= set(self.bucket_keys()))
        with self.captureOnCommitCallbacks(execute=True):
            image.delete()
        self.assertFalse(keys & set(self.bucket_keys()))

    def test_document_is_served_by_site_and_deleted(self) -> None:
        from wagtail.documents.models import Document

        document = Document(title="Отчёт")
        document.file.save("report.pdf", ContentFile(b"%PDF-1.4 test"), save=False)
        document.save()
        self.assertIn(document.file.name, self.bucket_keys())
        self.assertTrue(document.url.startswith("/documents/"))
        response = self.client.get(document.url)
        self.assertEqual(response.status_code, 200)
        body = b"".join(response.streaming_content) if response.streaming else response.content
        self.assertEqual(body, b"%PDF-1.4 test")
        key = document.file.name
        with self.captureOnCommitCallbacks(execute=True):
            document.delete()
        self.assertNotIn(key, self.bucket_keys())
