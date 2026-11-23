"""Перевод страниц сайта на английский через PO-файлы wagtail-localize.

export: для опубликованных русских страниц создаёт перевод (черновик английской копии, если его ещё нет)
и пишет сегменты в <каталог>/<id>-<slug>.po. Родители идут раньше детей, поэтому дерево английских
страниц повторяет русское.
import: читает переведённые PO из каталога, загружает строки в перевод страницы и, с ключом --publish,
публикует английскую страницу. Сегменты без перевода (пустой msgstr) остаются русскими.

Пример: python manage.py translate_po export --out po/batch1 --page 3 --page 6
        python manage.py translate_po import --in po/batch1 --publish
"""
from __future__ import annotations

from pathlib import Path

import polib
from django.core.management.base import BaseCommand, CommandError
from wagtail.models import Locale, Page
from wagtail_localize.models import Translation, TranslationSource
from wagtail_localize.operations import TranslationCreator


class Command(BaseCommand):
    help = "Выгрузка сегментов страниц в PO и загрузка английского перевода (wagtail-localize)"

    def add_arguments(self, parser) -> None:
        parser.add_argument("action", choices=["export", "import"])
        parser.add_argument("--out", help="каталог для PO (export)")
        parser.add_argument("--in", dest="src", help="каталог с переведёнными PO (import)")
        parser.add_argument("--page", type=int, action="append", default=[],
                            help="id русской страницы; можно несколько, без ключа: все опубликованные")
        parser.add_argument("--publish", action="store_true", help="опубликовать английские страницы (import)")

    def handle(self, *args, **opts) -> None:
        self.en = Locale.objects.get(language_code="en")
        if opts["action"] == "export":
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
            tr = self.translation_of(page)
            if tr is None:
                raise CommandError(f"{path.name}: перевода нет, сначала export")
            po = polib.pofile(str(path))
            warnings = tr.import_po(po)
            for w in warnings:
                self.stdout.write(f"  {path.name}: {w}")
            tr.save_target(publish=publish)
            done = sum(1 for e in po if e.msgstr)
            target = page.get_translation(self.en)
            state = "опубликована" if target.live else "черновик"
            self.stdout.write(f"{path.name}: переведено {done} из {len(po)}, {state}: {target.url_path}")
