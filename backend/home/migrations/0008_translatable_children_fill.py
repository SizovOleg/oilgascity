"""Ключ перевода и язык у существующих дочерних записей (участники, публикации, галереи).

Стандартная процедура Wagtail для перевода связанных записей: поля добавлены необязательными
(0007), здесь заполняются (язык по умолчанию, то есть русский), в 0009 становятся обязательными.
"""
from django.db import migrations
from wagtail.models import BootstrapTranslatableModel


class Migration(migrations.Migration):
    dependencies = [
        ("home", "0007_translatable_children_bootstrap"),
        ("home", "0006_locale_ru"),
    ]

    operations = [
        BootstrapTranslatableModel("home.TeamMember"),
        BootstrapTranslatableModel("home.Publication"),
        BootstrapTranslatableModel("home.CityGalleryImage"),
        BootstrapTranslatableModel("home.ExpeditionGalleryImage"),
        BootstrapTranslatableModel("home.BlogGalleryImage"),
    ]
