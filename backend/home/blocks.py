"""Блоки StreamField для страниц результатов, материалов и городов.

Структура блоков повторяет справочный слой макета «Полевой дневник» v2: разделы с якорями
для оглавления, цифры, результаты «заявлено и сделано», рисунки с источником, графики,
таблица методов, доклады, архивы, глоссарий. Фронтенд рисует каждый тип блока своим
компонентом (frontend/src/blocks/).
"""
from wagtail import blocks
from wagtail.images.blocks import ImageChooserBlock
from wagtail.rich_text import expand_db_html

from .renditions import LARGE_SPEC, THUMBNAIL_SPEC

# Набор возможностей редактора для коротких текстов внутри блоков
INLINE_FEATURES = ["bold", "italic", "link"]
TEXT_FEATURES = ["bold", "italic", "link", "ol", "ul", "h3", "h4"]


class APIImageChooserBlock(ImageChooserBlock):
    """Картинка, которую API отдаёт адресами копий, а не только id."""

    def get_api_representation(self, value, context=None):
        if not value:
            return None
        return {
            "id": value.id,
            "title": value.title,
            "width": value.width,
            "height": value.height,
            "original": value.file.url,
            "thumbnail": value.get_rendition(THUMBNAIL_SPEC).url,
            "large": value.get_rendition(LARGE_SPEC).url,
        }


class APIRichTextBlock(blocks.RichTextBlock):
    """Текст с развёрнутыми внутренними ссылками, готовый для вставки в HTML."""

    def get_api_representation(self, value, context=None):
        return expand_db_html(value.source) if value else ""


class SectionBlock(blocks.StructBlock):
    anchor = blocks.CharBlock(label="Якорь (латиницей)", help_text="Например: methods. Нужен для оглавления и ссылок")
    title = blocks.CharBlock(label="Заголовок раздела")
    toc_title = blocks.CharBlock(label="Короткое название в оглавлении", required=False)
    intro = APIRichTextBlock(label="Вводный текст", features=INLINE_FEATURES, required=False)

    class Meta:
        icon = "title"
        label = "Раздел"


class StatBlock(blocks.StructBlock):
    value = blocks.CharBlock(label="Цифра", help_text="Например: 4,7 км² или 10 из 10")
    label = blocks.CharBlock(label="Подпись")
    note = blocks.CharBlock(label="Источник или пояснение", required=False)

    class Meta:
        icon = "order"
        label = "Цифра"


class StatsBlock(blocks.StructBlock):
    items = blocks.ListBlock(StatBlock(), label="Цифры")

    class Meta:
        icon = "order"
        label = "Строка цифр"


class FigureBlock(blocks.StructBlock):
    image = APIImageChooserBlock(label="Изображение")
    kind = blocks.ChoiceBlock(
        label="Вид", choices=[("photo", "Снимок"), ("map", "Карта или схема")], default="photo"
    )
    caption = blocks.CharBlock(label="Подпись")
    place = blocks.CharBlock(label="Место (для снимка)", required=False)
    date = blocks.CharBlock(label="Дата (для снимка)", required=False, help_text="Например: июль 2025")
    theme = blocks.CharBlock(label="Тема (для снимка)", required=False)
    source = blocks.CharBlock(label="Источник", required=False)

    class Meta:
        icon = "image"
        label = "Рисунок"


class KeyFigureBlock(blocks.StructBlock):
    value = blocks.CharBlock(label="Цифра")
    label = blocks.CharBlock(label="Подпись")


class ResultBlock(blocks.StructBlock):
    number = blocks.IntegerBlock(label="Номер результата")
    short_title = blocks.CharBlock(label="Короткое название", help_text="Для оглавления и главной")
    headline = blocks.CharBlock(label="Главная цифра для главной", required=False)
    title = blocks.CharBlock(label="Заголовок")
    planned = APIRichTextBlock(label="Заявлено", features=INLINE_FEATURES)
    status = blocks.ChoiceBlock(
        label="Статус",
        choices=[("done", "выполнено"), ("partial", "выполнено частично"), ("progress", "в работе")],
        default="done",
    )
    key_figures = blocks.ListBlock(KeyFigureBlock(), label="Ключевые цифры")
    done = blocks.ListBlock(APIRichTextBlock(features=INLINE_FEATURES), label="Что сделано (по пунктам)")
    evidence = APIRichTextBlock(label="Доказательства", features=INLINE_FEATURES, required=False)
    figures = blocks.ListBlock(FigureBlock(), label="Рисунки", required=False)

    class Meta:
        icon = "tick-inverse"
        label = "Результат: заявлено и сделано"


class BarRowBlock(blocks.StructBlock):
    label = blocks.CharBlock(label="Подпись строки")
    value = blocks.CharBlock(label="Значение для показа", help_text="Например: 93,8%")
    pct = blocks.FloatBlock(label="Длина полосы, % шкалы")
    color = blocks.ChoiceBlock(
        label="Цвет",
        choices=[("green", "Хвоя"), ("tape", "Лента"), ("lake", "Озеро"), ("ink", "Тёмный")],
        default="green",
    )


class BarChartBlock(blocks.StructBlock):
    anchor = blocks.CharBlock(label="Якорь", required=False)
    title = blocks.CharBlock(label="Заголовок графика")
    rows = blocks.ListBlock(BarRowBlock(), label="Строки")
    caption = blocks.CharBlock(label="Подпись")
    source = blocks.CharBlock(label="Источник", required=False)

    class Meta:
        icon = "list-ul"
        label = "Горизонтальные полосы"


class PairSeriesBlock(blocks.StructBlock):
    label = blocks.CharBlock(label="Ряд", help_text="Например: июль")
    start = blocks.FloatBlock(label="Значение в начале")
    end = blocks.FloatBlock(label="Значение в конце")
    unit = blocks.CharBlock(label="Единица", required=False, default="°C")
    color = blocks.ChoiceBlock(
        label="Цвет",
        choices=[("green", "Хвоя"), ("tape", "Лента"), ("lake", "Озеро"), ("ink", "Тёмный")],
        default="ink",
    )


class PairChartBlock(blocks.StructBlock):
    anchor = blocks.CharBlock(label="Якорь", required=False)
    title = blocks.CharBlock(label="Заголовок графика")
    start_label = blocks.CharBlock(label="Подпись начала", help_text="Например: 1937")
    end_label = blocks.CharBlock(label="Подпись конца", help_text="Например: 2025")
    series = blocks.ListBlock(PairSeriesBlock(), label="Ряды")
    caption = blocks.CharBlock(label="Подпись")
    source = blocks.CharBlock(label="Источник", required=False)

    class Meta:
        icon = "pick"
        label = "Было и стало"


class MethodRowBlock(blocks.StructBlock):
    method = blocks.CharBlock(label="Метод")
    details = APIRichTextBlock(label="Данные и параметры", features=INLINE_FEATURES)
    output = blocks.CharBlock(label="Что получено")


class MethodsTableBlock(blocks.StructBlock):
    caption = blocks.CharBlock(label="Подпись таблицы")
    rows = blocks.ListBlock(MethodRowBlock(), label="Строки")
    source = blocks.CharBlock(label="Источник", required=False)

    class Meta:
        icon = "table"
        label = "Таблица методов"


class PlateBlock(blocks.StructBlock):
    value = blocks.CharBlock(label="Крупная цифра", required=False)
    title = blocks.CharBlock(label="Заголовок")
    text = APIRichTextBlock(label="Текст", features=INLINE_FEATURES)
    source = APIRichTextBlock(label="Источник", features=INLINE_FEATURES, required=False)
    tone = blocks.ChoiceBlock(
        label="Фон", choices=[("dark", "Хвоя"), ("sandy", "Песок"), ("fogged", "Туман")], default="dark"
    )


class FindingBlock(blocks.StructBlock):
    figure = FigureBlock(label="Снимок")
    value = blocks.CharBlock(label="Крупная цифра")
    title = blocks.CharBlock(label="Заголовок")
    text = APIRichTextBlock(label="Текст", features=INLINE_FEATURES)
    source = APIRichTextBlock(label="Источник", features=INLINE_FEATURES, required=False)
    flip = blocks.BooleanBlock(label="Снимок справа", required=False)

    class Meta:
        icon = "image"
        label = "Находка: снимок и цифра"


class BibliographyBlock(blocks.StructBlock):
    items = blocks.ListBlock(APIRichTextBlock(features=INLINE_FEATURES), label="Записи")

    class Meta:
        icon = "list-ol"
        label = "Список источников"


class PlatesBlock(blocks.StructBlock):
    items = blocks.ListBlock(PlateBlock(), label="Плашки")

    class Meta:
        icon = "doc-full"
        label = "Плашки (выводы)"


class StatusBlock(blocks.StructBlock):
    chip = blocks.CharBlock(label="Метка статуса", help_text="Например: полевые работы проведены")
    text = APIRichTextBlock(label="Текст", features=INLINE_FEATURES)

    class Meta:
        icon = "info-circle"
        label = "Статус"


class TalkBlock(blocks.StructBlock):
    authors = blocks.CharBlock(label="Авторы")
    title = blocks.CharBlock(label="Тема доклада")
    event = blocks.CharBlock(label="Мероприятие")
    place = blocks.CharBlock(label="Город")
    dates = blocks.CharBlock(label="Даты")
    form = blocks.CharBlock(label="Форма участия", help_text="Например: очный доклад")


class TalksBlock(blocks.StructBlock):
    items = blocks.ListBlock(TalkBlock(), label="Доклады")

    class Meta:
        icon = "group"
        label = "Доклады"


class ArchiveBlock(blocks.StructBlock):
    name = blocks.CharBlock(label="Архив")
    place = blocks.CharBlock(label="Город")
    text = APIRichTextBlock(label="Что изучено", features=INLINE_FEATURES)


class ArchivesBlock(blocks.StructBlock):
    items = blocks.ListBlock(ArchiveBlock(), label="Архивы")

    class Meta:
        icon = "folder-open-inverse"
        label = "Архивы и источники"


class GlossaryItemBlock(blocks.StructBlock):
    term = blocks.CharBlock(label="Термин")
    definition = APIRichTextBlock(label="Определение", features=INLINE_FEATURES)


class GlossaryBlock(blocks.StructBlock):
    items = blocks.ListBlock(GlossaryItemBlock(), label="Термины")

    class Meta:
        icon = "help"
        label = "Глоссарий"


class PhotoCountBlock(blocks.StructBlock):
    city = blocks.CharBlock(label="Город")
    year = blocks.CharBlock(label="Год")
    theme = blocks.CharBlock(label="Тема")
    count = blocks.IntegerBlock(label="Число снимков")


class PhotoLibraryBlock(blocks.StructBlock):
    intro = APIRichTextBlock(label="Вводный текст", features=INLINE_FEATURES, required=False)
    counts = blocks.ListBlock(PhotoCountBlock(), label="Счётчики архива по темам")

    class Meta:
        icon = "image"
        label = "Фототека (снимки из галерей сайта)"


class LayerCardBlock(blocks.StructBlock):
    title = blocks.CharBlock(label="Слой")
    text = blocks.CharBlock(label="Описание")


class LayerCardsBlock(blocks.StructBlock):
    items = blocks.ListBlock(LayerCardBlock(), label="Слои")

    class Meta:
        icon = "site"
        label = "Слои геопортала"


class EmbedBlock(blocks.StructBlock):
    kind = blocks.ChoiceBlock(
        label="Что вставить",
        choices=[
            ("publications", "Публикации (со страницы публикаций)"),
            ("expeditions", "Экспедиции"),
            ("team", "Авторский коллектив"),
            ("news", "Последние новости"),
        ],
    )

    class Meta:
        icon = "link"
        label = "Данные других разделов"


class CiteBlock(blocks.StructBlock):
    text = blocks.TextBlock(label="Библиографическая ссылка")
    note = APIRichTextBlock(label="Примечание", features=INLINE_FEATURES, required=False)

    class Meta:
        icon = "openquote"
        label = "Как цитировать"


class AtlasBlock(blocks.StructBlock):
    figures = blocks.ListBlock(FigureBlock(), label="Карты и схемы")

    class Meta:
        icon = "image"
        label = "Атлас (сетка рисунков)"


class ReportStreamBlock(blocks.StreamBlock):
    """Общий набор блоков для результатов, материалов и страниц городов."""

    section = SectionBlock()
    paragraph = APIRichTextBlock(label="Текст", features=TEXT_FEATURES, icon="pilcrow")
    stats = StatsBlock()
    result = ResultBlock()
    figure = FigureBlock()
    atlas = AtlasBlock()
    bar_chart = BarChartBlock()
    pair_chart = PairChartBlock()
    methods_table = MethodsTableBlock()
    plates = PlatesBlock()
    finding = FindingBlock()
    bibliography = BibliographyBlock()
    status = StatusBlock()
    talks = TalksBlock()
    archives = ArchivesBlock()
    glossary = GlossaryBlock()
    photo_library = PhotoLibraryBlock()
    layer_cards = LayerCardsBlock()
    embed = EmbedBlock()
    cite = CiteBlock()


class PassportRowBlock(blocks.StructBlock):
    label = blocks.CharBlock(label="Показатель")
    value = blocks.CharBlock(label="Значение")
    source = blocks.CharBlock(label="Источник", required=False)

    class Meta:
        icon = "list-ul"
        label = "Строка паспорта"
