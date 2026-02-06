from django.db import models
from wagtail.models import Page, Orderable
from wagtail.fields import RichTextField
from wagtail.admin.panels import FieldPanel, MultiFieldPanel, InlinePanel
from wagtail.api import APIField
from wagtail.images.api.fields import ImageRenditionField
from modelcluster.fields import ParentalKey
from rest_framework.fields import Field


class ImageSerializedField(Field):
    def to_representation(self, value):
        if not value:
            return None
        return {
            'id': value.id,
            'title': value.title,
            'original': value.file.url,
            'thumbnail': value.get_rendition('fill-400x300').url,
            'large': value.get_rendition('width-1200').url,
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
            'image': {
                'original': item.image.file.url,
                'thumbnail': item.image.get_rendition('fill-400x300').url,
                'large': item.image.get_rendition('width-1200').url,
            }
        } for item in value.all()]


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
            'pdf_file': DocumentSerializedField().to_representation(item.pdf_file),
            'cover_image': ImageSerializedField().to_representation(item.cover_image),
        } for item in value.all()]


# === 1. О ПРОЕКТЕ (главная) ===
class HomePage(Page):
    subtitle = models.CharField("Подзаголовок", max_length=500, blank=True)
    body = RichTextField("Основной текст", blank=True)
    grant_info = RichTextField("Информация о гранте", blank=True)
    expected_results = RichTextField("Ожидаемые результаты", blank=True)
    header_image = models.ForeignKey(
        'wagtailimages.Image', null=True, blank=True,
        on_delete=models.SET_NULL, related_name='+', verbose_name="Фоновое изображение"
    )

    content_panels = Page.content_panels + [
        FieldPanel('subtitle'),
        FieldPanel('header_image'),
        FieldPanel('body'),
        FieldPanel('grant_info'),
        FieldPanel('expected_results'),
    ]

    api_fields = [
        APIField('subtitle'),
        APIField('body'),
        APIField('grant_info'),
        APIField('expected_results'),
        APIField('header_image', serializer=ImageSerializedField()),
    ]

    class Meta:
        verbose_name = "Главная страница"

    subpage_types = [
        'home.CitiesIndexPage',
        'home.ExpeditionsIndexPage',
        'home.PublicationsPage',
        'home.TeamPage',
        'home.BlogIndexPage',
    ]


# === 2. ГОРОДА ===
class CitiesIndexPage(Page):
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


class CityPage(Page):
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

    content_panels = Page.content_panels + [
        FieldPanel('header_image'),
        FieldPanel('description'),
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
    ]

    class Meta:
        verbose_name = "Город"

    parent_page_types = ['home.CitiesIndexPage']


class CityGalleryImage(Orderable):
    page = ParentalKey(CityPage, on_delete=models.CASCADE, related_name='city_gallery')
    image = models.ForeignKey(
        'wagtailimages.Image', on_delete=models.CASCADE, related_name='+'
    )
    caption = models.CharField("Подпись", max_length=300, blank=True)

    panels = [
        FieldPanel('image'),
        FieldPanel('caption'),
    ]


# === 3. ЭКСПЕДИЦИИ ===
class ExpeditionsIndexPage(Page):
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


class ExpeditionPage(Page):
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


class ExpeditionGalleryImage(Orderable):
    page = ParentalKey(ExpeditionPage, on_delete=models.CASCADE, related_name='expedition_gallery')
    image = models.ForeignKey(
        'wagtailimages.Image', on_delete=models.CASCADE, related_name='+'
    )
    caption = models.CharField("Подпись", max_length=300, blank=True)

    panels = [
        FieldPanel('image'),
        FieldPanel('caption'),
    ]


# === 4. ПУБЛИКАЦИИ ===
class PublicationsPage(Page):
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


class Publication(Orderable):
    page = ParentalKey(PublicationsPage, on_delete=models.CASCADE, related_name='publications')
    title = models.CharField("Название", max_length=500)
    authors = models.CharField("Авторы", max_length=500)
    journal = models.CharField("Журнал / Издание", max_length=500, blank=True)
    year = models.IntegerField("Год")
    abstract = RichTextField("Аннотация", blank=True)
    doi = models.URLField("DOI / Ссылка", blank=True)
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
        FieldPanel('pdf_file'),
        FieldPanel('cover_image'),
    ]


# === 5. АВТОРСКИЙ КОЛЛЕКТИВ ===
class TeamPage(Page):
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


class TeamMember(Orderable):
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
        MultiFieldPanel([
            FieldPanel('orcid'),
            FieldPanel('scopus'),
            FieldPanel('wos'),
            FieldPanel('elibrary'),
            FieldPanel('spin_code'),
        ], heading="Академические профили"),
    ]


# === 6. БЛОГ ===
class BlogIndexPage(Page):
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


class BlogPost(Page):
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


class BlogGalleryImage(Orderable):
    page = ParentalKey(BlogPost, on_delete=models.CASCADE, related_name='blog_gallery')
    image = models.ForeignKey(
        'wagtailimages.Image', on_delete=models.CASCADE, related_name='+'
    )
    caption = models.CharField("Подпись", max_length=300, blank=True)

    panels = [
        FieldPanel('image'),
        FieldPanel('caption'),
    ]
