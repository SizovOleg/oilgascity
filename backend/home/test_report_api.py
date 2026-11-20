import json
import tempfile

from django.test import override_settings
from wagtail.images.models import Image
from wagtail.images.tests.utils import get_test_image_file
from wagtail.test.utils import WagtailPageTestCase

from home.models import CitiesIndexPage, CityGalleryImage, CityPage, HomePage, ReportPage

_MEDIA = tempfile.mkdtemp(prefix="ogc-test-media-")


@override_settings(MEDIA_ROOT=_MEDIA)
class ReportApiTests(WagtailPageTestCase):
    """Блоки страниц результатов и городов приходят в API в виде, готовом для фронтенда."""

    def setUp(self) -> None:
        # кэш копий привязан к id картинки, а id в тестах повторяются
        cache = Image.get_rendition_model().cache_backend
        cache.clear()
        self.addCleanup(cache.clear)
        self.image = Image.objects.create(title="карта", file=get_test_image_file())
        self.home = HomePage.objects.get(slug="home")

    def test_report_body_blocks(self) -> None:
        page = self.home.add_child(instance=ReportPage(
            title="Результаты 2025", slug="results-2025", kind="results", year=2025,
            body=json.dumps([
                {"type": "section", "value": {"anchor": "declared", "title": "Заявлено и сделано", "toc_title": "", "intro": ""}},
                {"type": "result", "value": {
                    "number": 1, "short_title": "Геоданные", "headline": "4,7 км²", "title": "Геоданные",
                    "planned": "<p>Слои</p>", "status": "done",
                    "key_figures": [{"value": "4,7 км²", "label": "съёмка"}],
                    "done": ['<p>Сделано, <a href="#fig-1">рис. 1</a></p>'],
                    "evidence": "<p>Статья</p>",
                    "figures": [{"image": self.image.id, "kind": "map", "caption": "Обзорная карта",
                                 "place": "", "date": "", "theme": "", "source": "Статья, рис. 1"}],
                }},
            ]),
        ))
        data = self.client.get(f"/wt-api/v2/pages/{page.pk}/").json()
        self.assertEqual(data["kind"], "results")
        self.assertEqual([b["type"] for b in data["body"]], ["section", "result"])
        result = data["body"][1]["value"]
        self.assertEqual(result["key_figures"][0]["value"], "4,7 км²")
        self.assertIn('href="#fig-1"', result["done"][0])
        image = result["figures"][0]["image"]
        self.assertIn("width-1200", image["large"])
        self.assertIn("fill-400x300", image["thumbnail"])

    def test_city_passport_and_photo_meta(self) -> None:
        cities = self.home.add_child(instance=CitiesIndexPage(title="Города"))
        city = cities.add_child(instance=CityPage(
            title="Муравленко", slug="muravlenko", description="<p>Город</p>",
            passport=json.dumps([{"type": "row", "value": {"label": "Основан", "value": "1982", "source": ""}}]),
        ))
        CityGalleryImage.objects.create(page=city, image=self.image, caption="Сосняк",
                                        theme="geobot", shot_date="июль 2025", author="")
        data = self.client.get(f"/wt-api/v2/pages/{city.pk}/").json()
        self.assertEqual(data["passport"][0]["value"]["value"], "1982")
        photo = data["city_gallery"][0]
        self.assertEqual((photo["theme"], photo["shot_date"]), ("geobot", "июль 2025"))
