"""Язык существующих страниц: русский вместо английского по умолчанию.

До включения i18n Wagtail завёл единственный язык по LANGUAGE_CODE = "en-us" (код «en»), и все страницы
числятся в нём, хотя они на русском. Этот язык переименовывается в «ru» (страницы остаются на месте),
затем создаётся «en» для английских переводов.
"""
from django.db import migrations


def forwards(apps, schema_editor):
    Locale = apps.get_model("wagtailcore", "Locale")
    if not Locale.objects.filter(language_code="ru").exists():
        Locale.objects.filter(language_code__in=["en", "en-us"]).update(language_code="ru")
    if not Locale.objects.filter(language_code="en").exists():
        Locale.objects.create(language_code="en")


def backwards(apps, schema_editor):
    Locale = apps.get_model("wagtailcore", "Locale")
    Page = apps.get_model("wagtailcore", "Page")
    en = Locale.objects.filter(language_code="en").first()
    if en and not Page.objects.filter(locale=en).exists():
        en.delete()
    if not Locale.objects.filter(language_code="en").exists():
        Locale.objects.filter(language_code="ru").update(language_code="en")


class Migration(migrations.Migration):
    dependencies = [
        ("home", "0005_contacts"),
        ("wagtailcore", "0096_referenceindex_referenceindex_source_object_and_more"),
    ]

    operations = [migrations.RunPython(forwards, backwards)]
