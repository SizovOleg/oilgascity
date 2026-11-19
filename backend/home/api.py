from wagtail.api.v2.router import WagtailAPIRouter
from wagtail.api.v2.serializers import PageHtmlUrlField, PageSerializer
from wagtail.api.v2.views import PagesAPIViewSet
from wagtail.documents.api.v2.views import DocumentsAPIViewSet
from wagtail.images.api.v2.views import ImagesAPIViewSet
from wagtail.models import Page


class FrontendPageHtmlUrlField(PageHtmlUrlField):
    """html_url через конкретный тип страницы.

    В списках API без параметра type Wagtail отдаёт базовые Page, у которых нет
    FrontendUrlMixin, и html_url снова вёл бы на http://localhost/<слаг>/.
    specific_deferred не делает запросов к БД.
    """

    def to_representation(self, page: Page) -> str | None:
        return super().to_representation(page.specific_deferred)


class FrontendPageSerializer(PageSerializer):
    html_url = FrontendPageHtmlUrlField(read_only=True)


class FrontendPagesAPIViewSet(PagesAPIViewSet):
    base_serializer_class = FrontendPageSerializer


api_router = WagtailAPIRouter('wagtailapi')
api_router.register_endpoint('pages', FrontendPagesAPIViewSet)
api_router.register_endpoint('images', ImagesAPIViewSet)
api_router.register_endpoint('documents', DocumentsAPIViewSet)
