import tempfile

from django.test import TestCase, override_settings
from wagtail.images.models import Image
from wagtail.images.tests.utils import get_test_image_file

from home.renditions import API_RENDITIONS

_MEDIA = tempfile.mkdtemp(prefix="ogc-test-media-")


@override_settings(MEDIA_ROOT=_MEDIA)
class PregenerateRenditionsTests(TestCase):
    """Копии для API создаются при сохранении картинки, а не при первом запросе посетителя."""

    def setUp(self) -> None:
        # Wagtail кэширует копии по id картинки; в тестах id переиспользуются после отката БД,
        # поэтому чужая копия из кэша подменила бы результат (и наша попала бы в другие тесты)
        cache = Image.get_rendition_model().cache_backend
        cache.clear()
        self.addCleanup(cache.clear)

    def test_renditions_created_on_upload(self) -> None:
        image = Image.objects.create(title="фото", file=get_test_image_file())
        specs = set(image.renditions.values_list("filter_spec", flat=True))
        self.assertEqual(specs, set(API_RENDITIONS))

    def test_resave_does_not_duplicate(self) -> None:
        image = Image.objects.create(title="фото", file=get_test_image_file())
        image.title = "другое название"
        image.save()
        self.assertEqual(image.renditions.count(), len(API_RENDITIONS))
