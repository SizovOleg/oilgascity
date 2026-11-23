"""Перевод страниц сайта на английский через PO-файлы wagtail-localize.

export: для опубликованных русских страниц создаёт перевод (черновик английской копии, если его ещё нет)
и пишет сегменты в <каталог>/<id>-<slug>.po. Родители идут раньше детей, поэтому дерево английских
страниц повторяет русское.
import: читает переведённые PO из каталога (можно выгруженные с копии базы), заводит перевод, если его нет,
загружает строки и, с ключом --publish, публикует английскую страницу уже с переводом. Сегменты без перевода
(пустой msgstr) остаются русскими. Выгружать лучше с копии базы: export на рабочей базе через TranslationCreator
сразу публикует английские копии с русским текстом.

normalize: пересохраняет страницу новой ревизией с тем же содержимым. Списки (ListBlock), загруженные скриптами
в старом формате (без id у элементов), wagtail-localize не выгружает; при сохранении Wagtail записывает их
в новом формате. Страницу с неопубликованным черновиком команда пропускает, чтобы не перекрыть его. Выполнять
на рабочей базе до выгрузки: id элементов создаются при сохранении, и PO должен быть выгружен после этого.

Пример: python manage.py translate_po normalize --page 21
        python manage.py translate_po export --out po/batch1 --page 3 --page 6
        python manage.py translate_po import --in po/batch1 --publish
"""
from __future__ import annotations

from pathlib import Path

import polib
from django.core.management.base import BaseCommand, CommandError
from wagtail import blocks
from wagtail.fields import StreamField
from wagtail.models import Locale, Page
from wagtail_localize.models import Translation, TranslationSource
from wagtail_localize.operations import TranslationCreator


def fill_empty_text(block, value) -> None:
    """Пустое необязательное текстовое поле внутри блока (None) заменяет на "": wagtail-localize падает на None
    при выгрузке сегментов. Заодно разбирает все вложенные блоки, чтобы они сериализовались заново."""
    if isinstance(block, blocks.StructBlock):
        for name, child in block.child_blocks.items():
            if isinstance(child, (blocks.CharBlock, blocks.TextBlock)) and value.get(name) is None:
                value[name] = ""
            elif value.get(name) is not None:
                fill_empty_text(child, value[name])
    elif isinstance(block, blocks.ListBlock):
        for item in value:
            fill_empty_text(block.child_block, item)
    elif isinstance(block, blocks.StreamBlock):
        for child in value:
            fill_empty_text(child.block, child.value)


class Command(BaseCommand):
    help = "Выгрузка сегментов страниц в PO и загрузка английского перевода (wagtail-localize)"

    def add_arguments(self, parser) -> None:
        parser.add_argument("action", choices=["export", "import", "normalize"])
        parser.add_argument("--out", help="каталог для PO (export)")
        parser.add_argument("--in", dest="src", help="каталог с переведёнными PO (import)")
        parser.add_argument("--page", type=int, action="append", default=[],
                            help="id русской страницы; можно несколько, без ключа: все опубликованные")
        parser.add_argument("--publish", action="store_true", help="опубликовать английские страницы (import)")

    def handle(self, *args, **opts) -> None:
        self.en = Locale.objects.get(language_code="en")
        if opts["action"] == "normalize":
            if not opts["page"]:
                raise CommandError("нужен --page: пересохраняются только названные страницы")
            self.normalize(opts["page"])
        elif opts["action"] == "export":
            if not opts["out"]:
                raise CommandError("нужен --out")
            self.export(Path(opts["out"]), opts["page"])
        else:
            if not opts["src"]:
                raise CommandError("нужен --in")
            self.do_import(Path(opts["src"]), opts["publish"])

    def pages(self, ids: list[int]) -> list[Page]:
        """Опубликованные русские страницы (кроме корня), родители раньше детей."""
        qs = Page.objects.filter(locale__language_code="ru", live=True, depth__gt=1).order_by("path")
        if ids:
            qs = qs.filter(id__in=ids)
            missing = set(ids) - set(qs.values_list("id", flat=True))
            if missing:
                raise CommandError(f"нет опубликованных русских страниц с id {sorted(missing)}")
        return [p.specific for p in qs]

    def normalize(self, ids: list[int]) -> None:
        for page in self.pages(ids):
            if page.has_unpublished_changes:
                self.stdout.write(f"{page.id} {page.slug}: есть неопубликованный черновик, пропущена")
                continue
            # StreamValue сериализует заново только разобранные блоки, остальные пишет как были: проход по всем
            # блокам заставляет записать списки в новом формате, с id у элементов
            for field in page._meta.get_fields():
                if isinstance(field, StreamField):
                    for child in getattr(page, field.name):
                        fill_empty_text(child.block, child.value)
            page.save_revision(log_action=False).publish(log_action=False)
            self.stdout.write(f"{page.id} {page.slug}: пересохранена")

    def translation_of(self, page: Page) -> Translation | None:
        source = TranslationSource.objects.get_for_instance_or_none(page)
        if source is None:
            return None
        return Translation.objects.filter(source=source, target_locale=self.en).first()

    def export(self, out: Path, ids: list[int]) -> None:
        out.mkdir(parents=True, exist_ok=True)
        creator = TranslationCreator(user=None, target_locales=[self.en])
        for page in self.pages(ids):
            tr = self.translation_of(page)
            if tr is None:
                creator.create_translations(page)
                tr = self.translation_of(page)
            else:
                # исходник перевода обновляется по текущей русской версии: правки после прошлой выгрузки
                # попадают в новые сегменты, уже переведённые строки сохраняются
                tr.source.update_from_db()
            po = tr.export_po()
            po.metadata["X-Page-Id"] = str(page.id)
            po.metadata["X-Page-Title"] = page.title
            path = out / f"{page.id}-{page.slug}.po"
            po.save(str(path))
            todo = sum(1 for e in po if not e.msgstr)
            self.stdout.write(f"{path.name}: сегментов {len(po)}, без перевода {todo}  ({page.title})")

    def do_import(self, src: Path, publish: bool) -> None:
        files = sorted(src.glob("*.po"), key=lambda p: Page.objects.get(id=int(p.name.split("-")[0])).path)
        if not files:
            raise CommandError(f"в {src} нет PO-файлов")
        for path in files:
            page = Page.objects.get(id=int(path.name.split("-")[0])).specific
            # перевод заводится напрямую, а не через TranslationCreator: тот сразу публикует английскую копию
            # с русским текстом, и до загрузки перевода /en показал бы её без пометки «Translation in progress»
            source, created = TranslationSource.get_or_create_from_instance(page)
            if not created:
                source.update_from_db()
            tr, _ = Translation.objects.update_or_create(source=source, target_locale=self.en, defaults={"enabled": True})
            po = polib.pofile(str(path))
            # PO мог быть выгружен с копии базы: чужой идентификатор перевода import_po молча пропускает весь файл,
            # строки сопоставляются по контексту и тексту
            po.metadata.pop("X-WagtailLocalize-TranslationID", None)
            for w in tr.import_po(po):
                self.stdout.write(f"  {path.name}: {w}")
            total, done = tr.get_progress()
            if not done:
                self.stdout.write(f"{path.name}: ни одной строки не загружено, страница не создана")
                continue
            tr.save_target(publish=publish)
            target = page.get_translation(self.en)
            state = "опубликована" if target.live else "черновик"
            self.stdout.write(f"{path.name}: переведено {done} из {total}, {state}: {target.url_path}")
