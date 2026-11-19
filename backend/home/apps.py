from django.apps import AppConfig


class HomeConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "home"

    def ready(self) -> None:
        from django.db.models.signals import post_save
        from wagtail.images import get_image_model

        from .renditions import pregenerate_renditions

        post_save.connect(
            pregenerate_renditions, sender=get_image_model(), dispatch_uid="home_pregenerate_renditions"
        )
