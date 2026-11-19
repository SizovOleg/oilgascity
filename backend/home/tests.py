import datetime
import re

from django.test import override_settings

from home.models import (
    BlogIndexPage,
    BlogPost,
    CitiesIndexPage,
    CityPage,
    ExpeditionPage,
    ExpeditionsIndexPage,
    HomePage,
    PublicationsPage,
    TeamPage,
)

from wagtail.models import Page, Site
from wagtail.test.utils import WagtailPageTestCase


class HomeSetUpTests(WagtailPageTestCase):
    """
    Tests for basic page structure setup and HomePage creation.
    """

    def test_root_create(self) -> None:
        root_page = Page.objects.get(pk=1)
        self.assertIsNotNone(root_page)

    def test_homepage_create(self) -> None:
        root_page = Page.objects.get(pk=1)
        homepage = HomePage(title="Home")
        root_page.add_child(instance=homepage)
        self.assertTrue(HomePage.objects.filter(title="Home").exists())


# Рендер шаблонов Django проверяем на адресах Wagtail, без подмены на React
@override_settings(FRONTEND_BASE_URL="")
class HomeTests(WagtailPageTestCase):
    """
    Tests for homepage functionality and rendering.
    """

    def setUp(self) -> None:
        """
        Create a homepage instance for testing.
        """
        root_page = Page.get_first_root_node()
        Site.objects.create(hostname="testsite", root_page=root_page, is_default_site=True)
        self.homepage = HomePage(title="Home")
        root_page.add_child(instance=self.homepage)

    def test_homepage_is_renderable(self) -> None:
        self.assertPageIsRenderable(self.homepage)

    def test_homepage_template_used(self) -> None:
        response = self.client.get(self.homepage.url)
        self.assertTemplateUsed(response, "home/home_page.html")


@override_settings(FRONTEND_BASE_URL="https://oilgascity.ru")
class FrontendUrlTests(WagtailPageTestCase):
    """Адреса страниц совпадают с маршрутами React (frontend/src/App.jsx)."""

    @classmethod
    def setUpTestData(cls) -> None:
        # Главная из миграции 0002: корень сайта localhost, как на проде
        cls.home = HomePage.objects.get(slug="home")
        cls.cities = cls.home.add_child(instance=CitiesIndexPage(title="Города"))
        cls.city = cls.cities.add_child(
            instance=CityPage(title="Муравленко", slug="muravlenko", description="<p>Город</p>")
        )
        cls.expeditions = cls.home.add_child(instance=ExpeditionsIndexPage(title="Экспедиции"))
        cls.expedition = cls.expeditions.add_child(
            instance=ExpeditionPage(
                title="Муравленко 2025",
                slug="muravlenko-2025",
                date_start=datetime.date(2025, 7, 1),
                location="Муравленко",
                description="<p>Экспедиция</p>",
            )
        )
        cls.publications = cls.home.add_child(instance=PublicationsPage(title="Публикации"))
        cls.team = cls.home.add_child(instance=TeamPage(title="Авторский коллектив"))
        cls.blog = cls.home.add_child(instance=BlogIndexPage(title="Блог"))
        cls.post = cls.blog.add_child(
            instance=BlogPost(
                title="Итоги года",
                slug="first-year-results",
                date=datetime.date(2025, 12, 25),
                body="<p>Текст</p>",
            )
        )

    def expected_paths(self) -> list[tuple[Page, str]]:
        return [
            (self.home, "/"),
            (self.cities, "/cities"),
            (self.city, f"/cities/{self.city.pk}"),
            (self.expeditions, "/expeditions"),
            (self.expedition, f"/expeditions/{self.expedition.pk}"),
            (self.publications, "/publications"),
            (self.team, "/team"),
            (self.blog, "/blog"),
            (self.post, f"/blog/{self.post.pk}"),
        ]

    def test_page_urls_match_react_routes(self) -> None:
        for page, path in self.expected_paths():
            with self.subTest(page=type(page).__name__):
                self.assertEqual(page.url, path)
                self.assertEqual(page.full_url, "https://oilgascity.ru" + path)

    def test_api_html_url_points_to_frontend(self) -> None:
        for page, path in self.expected_paths():
            with self.subTest(page=type(page).__name__):
                response = self.client.get(f"/wt-api/v2/pages/{page.pk}/")
                self.assertEqual(response.status_code, 200)
                self.assertEqual(
                    response.json()["meta"]["html_url"], "https://oilgascity.ru" + path
                )

    def test_api_listing_html_url_points_to_frontend(self) -> None:
        # Списки без type Wagtail строит из базовых Page, без FrontendUrlMixin
        expected = {page.pk: "https://oilgascity.ru" + path for page, path in self.expected_paths()}
        for query in (f"?child_of={self.home.pk}", "?limit=20", f"?descendant_of={self.home.pk}"):
            with self.subTest(query=query):
                response = self.client.get("/wt-api/v2/pages/" + query)
                self.assertEqual(response.status_code, 200)
                items = response.json()["items"]
                self.assertTrue(items)
                for item in items:
                    self.assertEqual(item["meta"]["html_url"], expected[item["id"]])

    def test_admin_view_live_link_points_to_frontend(self) -> None:
        self.login()
        response = self.client.get(f"/cms/pages/{self.city.pk}/edit/")
        self.assertEqual(response.status_code, 200)
        html = response.content.decode()
        self.assertRegex(html, rf'href="(https://oilgascity\.ru)?/cities/{self.city.pk}"')
        # Старых адресов Wagtail (слаги, localhost) в ссылках быть не должно
        self.assertNotIn('href="http://localhost', html)
        self.assertIsNone(re.search(r'href="[^"]*/muravlenko/"', html))

    @override_settings(FRONTEND_BASE_URL="")
    def test_empty_setting_restores_wagtail_urls(self) -> None:
        self.assertTrue(self.city.url.endswith("/muravlenko/"))
        self.assertTrue(self.city.full_url.startswith("http://localhost/"))
