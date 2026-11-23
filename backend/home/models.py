import base64
from django.conf import settings
from django.db import models
from django.http import HttpRequest
from wagtail.models import Orderable, Page, TranslatableMixin
from wagtail.fields import RichTextField, StreamField
from wagtail.admin.panels import FieldPanel, MultiFieldPanel, InlinePanel
from wagtail.api import APIField
from wagtail.images.api.fields import ImageRenditionField
from modelcluster.fields import ParentalKey
from rest_framework.fields import Field
from wagtail_localize.fields import SynchronizedField, TranslatableField

from .blocks import PassportRowBlock, ReportStreamBlock, StatBlock
from .renditions import LARGE_SPEC, THUMBNAIL_SPEC


class FrontendUrlMixin:
    """Адреса страниц ведут на маршруты React-фронтенда, а не в дерево Wagtail.

    Сайт headless: Wagtail строит адрес из слагов (/города/...), а React
    открывает страницы по своим маршрутам (/cities/<id>, см. frontend/src/App.jsx).
    Без подмены кнопка «Посмотреть на сайте» в админке и поле html_url в API
    ведут на несуществующие адреса. Пустой FRONTEND_BASE_URL выключает подмену.
    """

    # Маршрут страницы во фронтенде; {id} и {slug} заменяются на id и слаг страницы
    frontend_path: str | None = None
    # Перевод (wagtail-localize): слаг общий для обоих языков, переводятся только тексты
    override_translatable_fields = [SynchronizedField("slug")]

    def get_frontend_path(self) -> str | None:
        if self.frontend_path is None:
            return None
        return self.frontend_path.format(id=self.pk, slug=self.slug)

    def get_url_parts(
        self, request: HttpRequest | None = None
    ) -> tuple[int, str | None, str | None] | None:
        url_parts = super().get_url_parts(request=request)
        base_url = getattr(settings, "FRONTEND_BASE_URL", "")
        path = self.get_frontend_path()
        if url_parts is None or not base_url or path is None:
            return url_parts
        # английские страницы фронтенд показывает под /en (frontend/src/lib/i18n.js)
        if self.locale.language_code == "en":
            path = "/en" if path == "/" else f"/en{path}"
        site_id = url_parts[0]
        return (site_id, base_url.rstrip("/"), path)


class ImageSerializedField(Field):
    def to_representation(self, value):
        if not value:
            return None
        return {
            'id': value.id,
            'title': value.title,
            'original': value.file.url,
            'thumbnail': value.get_rendition(THUMBNAIL_SPEC).url,
            'large': value.get_rendition(LARGE_SPEC).url,
        }


class DocumentSerializedField(Field):
    def to_representation(self, value):
        if not value:
            return None
        return {
            'id': value.id,
            'title': value.title,
            'url': value.url,
        }


class GallerySerializedField(Field):
    def to_representation(self, value):
        return [{
            'id': item.id,
            'caption': item.caption,
            'theme': item.theme,
            'shot_date': item.shot_date,
            'author': item.author,
            'image': {
                'original': item.image.file.url,
                'thumbnail': item.image.get_rendition(THUMBNAIL_SPEC).url,
                'large': item.image.get_rendition(LARGE_SPEC).url,
            }
        } for item in value.all()]


def hide_email(value: str) -> str:
    """Адрес в API не открытым текстом (его читают сборщики спама): base64 от перевёрнутой строки,
    сайт раскодирует при показе (frontend/src/lib/email.js)."""
    return base64.b64encode(value[::-1].encode("utf-8")).decode("ascii") if value else ""


class HiddenEmailField(Field):
    def to_representation(self, value):
        return hide_email(value)


class MembersSerializedField(Field):
    def to_representation(self, value):
        return [{
            'id': item.id,
            'name': item.name,
            'role': item.role,
            'position': item.position,
            'organization': item.organization,
            'bio': item.bio,
            'photo': ImageSerializedField().to_representation(item.photo),
            'email': hide_email(item.email),
            'orcid': item.orcid,
            'scopus': item.scopus,
            'wos': item.wos,
            'elibrary': item.elibrary,
            'spin_code': item.spin_code,
        } for item in value.all()]


class PublicationsSerializedField(Field):
    def to_representation(self, value):
        return [{
            'id': item.id,
            'title': item.title,
            'authors': item.authors,
            'journal': item.journal,
            'year': item.year,
            'abstract': item.abstract,
            'doi': item.doi,
            'status': item.status,
            'citation': item.citation,
            'pdf_url': item.pdf_url,
            'group': item.group,
            'pdf_file': DocumentSerializedField().to_representation(item.pdf_file),
            'cover_image': ImageSerializedField().to_representation(item.cover_image),
        } for item in value.all()]


PHOTO_THEMES = [
    ("parks", "парки и скверы"),
    ("sites", "детские и спортивные площадки"),
    ("geobot", "геоботаника"),
    ("sand", "пески и карьеры"),
    ("waste", "свалки"),
    ("town", "город и муралы"),
    ("water", "водоёмы"),
    ("field", "полевая работа"),
]


class PhotoMeta(models.Model):
    """Справочные сведения о снимке для подписи и фильтров фототеки."""

    theme = models.CharField("Тема", max_length=20, choices=PHOTO_THEMES, blank=True)
    shot_date = models.CharField("Дата съёмки", max_length=50, blank=True, help_text="Например: июль 2025")
    author = models.CharField("Автор снимка", max_length=200, blank=True)

    meta_panels = [FieldPanel('theme'), FieldPanel('shot_date'), FieldPanel('author')]

    class Meta:
        abstract = True


# === 1. О ПРОЕКТЕ (главная) ===
class HomePage(FrontendUrlMixin, Page):
    frontend_path = "/"

    subtitle = models.CharField("Подзаголовок", max_length=500, blank=True)
    body = RichTextField("Основной текст", blank=True)
    grant_info = RichTextField("Информация о гранте", blank=True)
    expected_results = RichTextField("Ожидаемые результаты", blank=True)
    header_image = models.ForeignKey(
        'wagtailimages.Image', null=True, blank=True,
        on_delete=models.SET_NULL, related_name='+', verbose_name="Фоновое изображение"
    )
    hero_title = models.CharField("Заголовок первого экрана", max_length=120, blank=True)
    lead = models.TextField("Вводная фраза первого экрана", blank=True)
    header_caption = models.CharField("Подпись к фото первого экрана", max_length=300, blank=True)
    header_meta = models.CharField("Место и дата фото первого экрана", max_length=200, blank=True)
    stats = StreamField([('stat', StatBlock())], blank=True, verbose_name="Проект в цифрах")
    goal = RichTextField("Цель и задача проекта", blank=True)
    keywords_ru = models.TextField("Ключевые слова", blank=True)
    keywords_en = models.TextField("Ключевые слова (англ.)", blank=True)
    abstract_en = RichTextField("Аннотация на английском", blank=True)
    expected_source = models.CharField("Источник ожидаемых результатов", max_length=300, blank=True)
    years_intro = models.TextField("Вводный текст блока «Результаты по годам»", blank=True)
    contact_email = models.EmailField("Общий адрес для связи с проектом", blank=True,
                                      help_text="Показывается в подвале и на главной (на английской версии тоже)")

    content_panels = Page.content_panels + [
        MultiFieldPanel([
            FieldPanel('hero_title'),
            FieldPanel('lead'),
            FieldPanel('header_image'),
            FieldPanel('header_caption'),
            FieldPanel('header_meta'),
        ], heading="Первый экран"),
        FieldPanel('stats'),
        MultiFieldPanel([
            FieldPanel('goal'),
            FieldPanel('expected_results'),
            FieldPanel('expected_source'),
            FieldPanel('keywords_ru'),
            FieldPanel('keywords_en'),
            FieldPanel('abstract_en'),
        ], heading="Цель и задачи"),
        FieldPanel('years_intro'),
        FieldPanel('subtitle'),
        FieldPanel('body'),
        FieldPanel('grant_info'),
        FieldPanel('contact_email'),
    ]

    api_fields = [
        APIField('contact_email', serializer=HiddenEmailField()),
        APIField('subtitle'),
        APIField('body'),
        APIField('grant_info'),
        APIField('expected_results'),
        APIField('header_image', serializer=ImageSerializedField()),
        APIField('hero_title'),
        APIField('lead'),
        APIField('header_caption'),
        APIField('header_meta'),
        APIField('stats'),
        APIField('goal'),
        APIField('keywords_ru'),
        APIField('keywords_en'),
        APIField('abstract_en'),
        APIField('expected_source'),
        APIField('years_intro'),
    ]

    class Meta:
        verbose_name = "Главная страница"

    subpage_types = [
        'home.CitiesIndexPage',
        'home.ExpeditionsIndexPage',
        'home.PublicationsPage',
        'home.TeamPage',
        'home.BlogIndexPage',
        'home.ReportPage',
    ]


# === 2. ГОРОДА ===
class CitiesIndexPage(FrontendUrlMixin, Page):
    frontend_path = "/#cities"

    intro = RichTextField("Вводный текст", blank=True)

    content_panels = Page.content_panels + [
        FieldPanel('intro'),
    ]

    api_fields = [
        APIField('intro'),
    ]

    class Meta:
        verbose_name = "Раздел городов"

    subpage_types = ['home.CityPage']


class CityPage(FrontendUrlMixin, Page):
    frontend_path = "/cities/{slug}"
    override_translatable_fields = FrontendUrlMixin.override_translatable_fields + [TranslatableField("city_gallery")]

    description = RichTextField("Описание города")
    population = models.CharField("Население", max_length=100, blank=True)
    founded = models.CharField("Год основания", max_length=50, blank=True)
    region = models.CharField("Регион", max_length=200, blank=True)
    latitude = models.FloatField("Широта", null=True, blank=True)
    longitude = models.FloatField("Долгота", null=True, blank=True)
    header_image = models.ForeignKey(
        'wagtailimages.Image', null=True, blank=True,
        on_delete=models.SET_NULL, related_name='+', verbose_name="Главное изображение"
    )
    lead = models.TextField("Вводная фраза", blank=True)
    header_caption = models.CharField("Подпись к главному фото", max_length=300, blank=True)
    header_meta = models.CharField("Место и дата главного фото", max_length=200, blank=True)
    history_title = models.CharField("Заголовок раздела с описанием", max_length=200, blank=True)
    passport = StreamField([('row', PassportRowBlock())], blank=True, verbose_name="Паспорт города")
    passport_source = models.CharField("Источник паспорта", max_length=300, blank=True)
    passport_map = models.ForeignKey(
        'wagtailimages.Image', null=True, blank=True,
        on_delete=models.SET_NULL, related_name='+', verbose_name="Карта рядом с паспортом"
    )
    passport_map_caption = models.CharField("Подпись к карте", max_length=400, blank=True)
    passport_map_source = models.CharField("Источник карты", max_length=400, blank=True)
    sections = StreamField(ReportStreamBlock(), blank=True, verbose_name="Разделы страницы")

    content_panels = Page.content_panels + [
        FieldPanel('lead'),
        FieldPanel('header_image'),
        FieldPanel('header_caption'),
        FieldPanel('header_meta'),
        FieldPanel('history_title'),
        FieldPanel('description'),
        MultiFieldPanel([
            FieldPanel('passport'),
            FieldPanel('passport_source'),
            FieldPanel('passport_map'),
            FieldPanel('passport_map_caption'),
            FieldPanel('passport_map_source'),
        ], heading="Паспорт города"),
        FieldPanel('sections'),
        MultiFieldPanel([
            FieldPanel('population'),
            FieldPanel('founded'),
            FieldPanel('region'),
            FieldPanel('latitude'),
            FieldPanel('longitude'),
        ], heading="Характеристики"),
        InlinePanel('city_gallery', label="Фотографии"),
    ]

    api_fields = [
        APIField('description'),
        APIField('population'),
        APIField('founded'),
        APIField('region'),
        APIField('latitude'),
        APIField('longitude'),
        APIField('header_image', serializer=ImageSerializedField()),
        APIField('city_gallery', serializer=GallerySerializedField()),
        APIField('lead'),
        APIField('header_caption'),
        APIField('header_meta'),
        APIField('history_title'),
        APIField('passport'),
        APIField('passport_source'),
        APIField('passport_map', serializer=ImageSerializedField()),
        APIField('passport_map_caption'),
        APIField('passport_map_source'),
        APIField('sections'),
    ]

    class Meta:
        verbose_name = "Город"

    parent_page_types = ['home.CitiesIndexPage']


class CityGalleryImage(TranslatableMixin, PhotoMeta, Orderable):
    page = ParentalKey(CityPage, on_delete=models.CASCADE, related_name='city_gallery')
    image = models.ForeignKey(
        'wagtailimages.Image', on_delete=models.CASCADE, related_name='+'
    )
    caption = models.CharField("Подпись", max_length=300, blank=True)

    panels = [
        FieldPanel('image'),
        FieldPanel('caption'),
    ] + PhotoMeta.meta_panels


# === 3. ЭКСПЕДИЦИИ ===
class ExpeditionsIndexPage(FrontendUrlMixin, Page):
    frontend_path = "/materials#expeditions"

    intro = RichTextField("Вводный текст", blank=True)

    content_panels = Page.content_panels + [
        FieldPanel('intro'),
    ]

    api_fields = [
        APIField('intro'),
    ]

    class Meta:
        verbose_name = "Раздел экспедиций"

    subpage_types = ['home.ExpeditionPage']


class ExpeditionPage(FrontendUrlMixin, Page):
    frontend_path = "/expeditions/{id}"
    override_translatable_fields = FrontendUrlMixin.override_translatable_fields + [TranslatableField("expedition_gallery")]

    date_start = models.DateField("Дата начала")
    date_end = models.DateField("Дата окончания", null=True, blank=True)
    location = models.CharField("Место проведения", max_length=300)
    description = RichTextField("Описание")
    header_image = models.ForeignKey(
        'wagtailimages.Image', null=True, blank=True,
        on_delete=models.SET_NULL, related_name='+', verbose_name="Главное изображение"
    )

    content_panels = Page.content_panels + [
        MultiFieldPanel([
            FieldPanel('date_start'),
            FieldPanel('date_end'),
            FieldPanel('location'),
        ], heading="Детали экспедиции"),
        FieldPanel('header_image'),
        FieldPanel('description'),
        InlinePanel('expedition_gallery', label="Фотографии"),
    ]

    api_fields = [
        APIField('date_start'),
        APIField('date_end'),
        APIField('location'),
        APIField('description'),
        APIField('header_image', serializer=ImageSerializedField()),
        APIField('expedition_gallery', serializer=GallerySerializedField()),
    ]

    class Meta:
        verbose_name = "Экспедиция"

    parent_page_types = ['home.ExpeditionsIndexPage']


class ExpeditionGalleryImage(TranslatableMixin, PhotoMeta, Orderable):
    page = ParentalKey(ExpeditionPage, on_delete=models.CASCADE, related_name='expedition_gallery')
    image = models.ForeignKey(
        'wagtailimages.Image', on_delete=models.CASCADE, related_name='+'
    )
    caption = models.CharField("Подпись", max_length=300, blank=True)

    panels = [
        FieldPanel('image'),
        FieldPanel('caption'),
    ] + PhotoMeta.meta_panels


# === 4. ПУБЛИКАЦИИ ===
class PublicationsPage(FrontendUrlMixin, Page):
    frontend_path = "/materials#publications"
    override_translatable_fields = FrontendUrlMixin.override_translatable_fields + [TranslatableField("publications")]

    intro = RichTextField("Вводный текст", blank=True)

    content_panels = Page.content_panels + [
        FieldPanel('intro'),
        InlinePanel('publications', label="Публикации"),
    ]

    api_fields = [
        APIField('intro'),
        APIField('publications', serializer=PublicationsSerializedField()),
    ]

    class Meta:
        verbose_name = "Раздел публикаций"

    subpage_types = []


class Publication(TranslatableMixin, Orderable):
    page = ParentalKey(PublicationsPage, on_delete=models.CASCADE, related_name='publications')
    title = models.CharField("Название", max_length=500)
    authors = models.CharField("Авторы", max_length=500)
    journal = models.CharField("Журнал / Издание", max_length=500, blank=True)
    year = models.IntegerField("Год")
    abstract = RichTextField("Аннотация", blank=True)
    doi = models.URLField("DOI / Ссылка", blank=True)
    status = models.CharField("Статус", max_length=20, blank=True, choices=[
        ("published", "опубликовано"), ("in_press", "в печати"), ("in_review", "на рецензировании"),
    ])
    citation = models.TextField("Библиографическая запись (ГОСТ)", blank=True)
    pdf_url = models.URLField("Ссылка на полный текст", blank=True)
    group = models.CharField("Группа", max_length=20, default="project", choices=[
        ("project", "по результатам проекта"), ("related", "смежные публикации коллектива"),
    ])
    pdf_file = models.ForeignKey(
        'wagtaildocs.Document', null=True, blank=True,
        on_delete=models.SET_NULL, related_name='+', verbose_name="PDF файл"
    )
    cover_image = models.ForeignKey(
        'wagtailimages.Image', null=True, blank=True,
        on_delete=models.SET_NULL, related_name='+', verbose_name="Иллюстрация"
    )

    panels = [
        FieldPanel('title'),
        FieldPanel('authors'),
        FieldPanel('journal'),
        FieldPanel('year'),
        FieldPanel('abstract'),
        FieldPanel('doi'),
        FieldPanel('status'),
        FieldPanel('group'),
        FieldPanel('citation'),
        FieldPanel('pdf_url'),
        FieldPanel('pdf_file'),
        FieldPanel('cover_image'),
    ]

    class Meta(TranslatableMixin.Meta):
        ordering = ["sort_order"]  # как у Orderable: первым в базах класса стоит миксин перевода


# === 5. АВТОРСКИЙ КОЛЛЕКТИВ ===
class TeamPage(FrontendUrlMixin, Page):
    frontend_path = "/materials#team"
    override_translatable_fields = FrontendUrlMixin.override_translatable_fields + [TranslatableField("members")]

    intro = RichTextField("Вводный текст", blank=True)

    content_panels = Page.content_panels + [
        FieldPanel('intro'),
        InlinePanel('members', label="Участники"),
    ]

    api_fields = [
        APIField('intro'),
        APIField('members', serializer=MembersSerializedField()),
    ]

    class Meta:
        verbose_name = "Авторский коллектив"

    subpage_types = []


class TeamMember(TranslatableMixin, Orderable):
    override_translatable_fields = [SynchronizedField("spin_code")]  # код eLibrary одинаков в обоих языках
    page = ParentalKey(TeamPage, on_delete=models.CASCADE, related_name='members')
    name = models.CharField("ФИО", max_length=300)
    role = models.CharField("Роль в проекте", max_length=300, blank=True)
    position = models.CharField("Должность", max_length=500, blank=True)
    organization = models.CharField("Организация", max_length=500, blank=True)
    bio = RichTextField("Биография", blank=True)
    photo = models.ForeignKey(
        'wagtailimages.Image', null=True, blank=True,
        on_delete=models.SET_NULL, related_name='+', verbose_name="Фото"
    )
    email = models.EmailField("E-mail", blank=True,
                              help_text="Только с согласия участника; на сайте адрес собирается скриптом, в HTML его нет")
    orcid = models.URLField("ORCID", blank=True)
    scopus = models.URLField("Scopus", blank=True)
    wos = models.URLField("Web of Science", blank=True)
    elibrary = models.URLField("eLibrary", blank=True)
    spin_code = models.CharField("SPIN-код", max_length=50, blank=True)

    panels = [
        FieldPanel('photo'),
        FieldPanel('name'),
        FieldPanel('role'),
        FieldPanel('position'),
        FieldPanel('organization'),
        FieldPanel('bio'),
        FieldPanel('email'),
        MultiFieldPanel([
            FieldPanel('orcid'),
            FieldPanel('scopus'),
            FieldPanel('wos'),
            FieldPanel('elibrary'),
            FieldPanel('spin_code'),
        ], heading="Академические профили"),
    ]

    class Meta(TranslatableMixin.Meta):
        ordering = ["sort_order"]  # как у Orderable: первым в базах класса стоит миксин перевода


# === 6. БЛОГ ===
class BlogIndexPage(FrontendUrlMixin, Page):
    frontend_path = "/news"

    intro = RichTextField("Вводный текст", blank=True)

    content_panels = Page.content_panels + [
        FieldPanel('intro'),
    ]

    api_fields = [
        APIField('intro'),
    ]

    class Meta:
        verbose_name = "Блог"

    subpage_types = ['home.BlogPost']

    def get_context(self, request):
        context = super().get_context(request)
        context['posts'] = self.get_children().live().order_by('-first_published_at')
        return context


class BlogPost(FrontendUrlMixin, Page):
    frontend_path = "/news/{id}"
    override_translatable_fields = FrontendUrlMixin.override_translatable_fields + [TranslatableField("blog_gallery")]

    date = models.DateField("Дата публикации")
    body = RichTextField("Текст")
    header_image = models.ForeignKey(
        'wagtailimages.Image', null=True, blank=True,
        on_delete=models.SET_NULL, related_name='+', verbose_name="Главное изображение"
    )

    content_panels = Page.content_panels + [
        FieldPanel('date'),
        FieldPanel('header_image'),
        FieldPanel('body'),
        InlinePanel('blog_gallery', label="Фотографии"),
    ]

    api_fields = [
        APIField('date'),
        APIField('body'),
        APIField('header_image', serializer=ImageSerializedField()),
        APIField('blog_gallery', serializer=GallerySerializedField()),
    ]

    class Meta:
        verbose_name = "Запись блога"

    parent_page_types = ['home.BlogIndexPage']


class BlogGalleryImage(TranslatableMixin, PhotoMeta, Orderable):
    page = ParentalKey(BlogPost, on_delete=models.CASCADE, related_name='blog_gallery')
    image = models.ForeignKey(
        'wagtailimages.Image', on_delete=models.CASCADE, related_name='+'
    )
    caption = models.CharField("Подпись", max_length=300, blank=True)

    panels = [
        FieldPanel('image'),
        FieldPanel('caption'),
    ] + PhotoMeta.meta_panels


# === 7. РЕЗУЛЬТАТЫ И МАТЕРИАЛЫ ===
class ReportPage(FrontendUrlMixin, Page):
    """Страница из блоков: результаты года или материалы проекта."""

    KIND_RESULTS = "results"
    KIND_MATERIALS = "materials"

    kind = models.CharField("Тип страницы", max_length=20, default=KIND_RESULTS, choices=[
        (KIND_RESULTS, "Результаты года"), (KIND_MATERIALS, "Материалы проекта"),
    ])
    year = models.IntegerField("Год (для результатов)", null=True, blank=True)
    city_label = models.CharField("Город года", max_length=100, blank=True)
    status_label = models.CharField("Метка статуса", max_length=200, blank=True,
                                    help_text="Например: 10 из 10 результатов выполнено")
    intro = models.TextField("Вводный текст", blank=True)
    summary = models.TextField("Кратко для главной", blank=True)
    header_image = models.ForeignKey(
        'wagtailimages.Image', null=True, blank=True,
        on_delete=models.SET_NULL, related_name='+', verbose_name="Изображение в шапке"
    )
    header_caption = models.CharField("Подпись к изображению", max_length=300, blank=True)
    header_meta = models.CharField("Место и дата изображения", max_length=200, blank=True)
    body = StreamField(ReportStreamBlock(), blank=True, verbose_name="Содержимое")

    content_panels = Page.content_panels + [
        MultiFieldPanel([
            FieldPanel('kind'),
            FieldPanel('year'),
            FieldPanel('city_label'),
            FieldPanel('status_label'),
        ], heading="Тип и год"),
        FieldPanel('intro'),
        FieldPanel('summary'),
        MultiFieldPanel([
            FieldPanel('header_image'),
            FieldPanel('header_caption'),
            FieldPanel('header_meta'),
        ], heading="Изображение в шапке"),
        FieldPanel('body'),
    ]

    api_fields = [
        APIField('kind'),
        APIField('year'),
        APIField('city_label'),
        APIField('status_label'),
        APIField('intro'),
        APIField('summary'),
        APIField('header_image', serializer=ImageSerializedField()),
        APIField('header_caption'),
        APIField('header_meta'),
        APIField('body'),
    ]

    parent_page_types = ['home.HomePage']
    subpage_types = []

    class Meta:
        verbose_name = "Результаты или материалы"
        verbose_name_plural = "Результаты и материалы"

    def get_frontend_path(self) -> str | None:
        if self.kind == self.KIND_MATERIALS:
            return "/materials"
        # результаты без года: общие выводы проекта по обоим городам
        return f"/results/{self.year}" if self.year else "/results/summary"
