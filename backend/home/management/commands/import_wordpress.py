import os
import requests
from io import BytesIO
from django.core.management.base import BaseCommand
from django.core.files.images import ImageFile
from wagtail.models import Page
from wagtail.images.models import Image
from home.models import (
    HomePage, TeamPage, TeamMember, PublicationsPage, Publication,
    BlogIndexPage, BlogPost, CitiesIndexPage, ExpeditionsIndexPage,
)


def download_image(url, title):
    """Download image from URL and save as Wagtail Image."""
    try:
        from PIL import Image as PILImage
        r = requests.get(url, timeout=30)
        r.raise_for_status()
        filename = url.split("/")[-1]
        # Get dimensions
        pil_img = PILImage.open(BytesIO(r.content))
        width, height = pil_img.size
        img = Image(title=title, width=width, height=height)
        img.file = ImageFile(BytesIO(r.content), name=filename)
        img.save()
        print(f"  Downloaded: {title} ({width}x{height})")
        return img
    except Exception as e:
        print(f"  Error downloading {url}: {e}")
        return None


class Command(BaseCommand):
    help = "Import content from oilgascity.ru WordPress site"

    def handle(self, *args, **options):
        self.import_homepage()
        self.import_team()
        self.import_publications()
        self.import_blog()
        self.stdout.write(self.style.SUCCESS("Import complete!"))

    def import_homepage(self):
        self.stdout.write("=== Importing HomePage ===")
        home = HomePage.objects.first()
        if not home:
            self.stdout.write(self.style.ERROR("HomePage not found"))
            return

        home.title = "О проекте"
        home.subtitle = "Социально-экологические аспекты развития малых городов как центров нефтегазового освоения в меняющихся климатических условиях субарктической зоны Западной Сибири"

        home.body = """<p>На этом сайте представлены результаты гранта Российского научного фонда <a href="https://rscf.ru/project/25-27-00022/">\u2116 25-27-00022</a> на тему \u00abСоциально-экологические аспекты развития малых городов как центров нефтегазового освоения в меняющихся климатических условиях субарктической зоны Западной Сибири\u00bb, который реализуется коллективом <a href="https://ikz.ru/">Института криосферы Земли Тюменского научного центра СО РАН</a>.</p>

<h3>Научная проблематика проекта</h3>
<p>Арктическая зона Российской Федерации (АЗРФ) является наиболее урбанизированным макрорегионом страны, около 89% населения здесь проживает в городах. На севере Западной Сибири, в процессе становления нефтегазодобывающего комплекса, активное формирование малых городов пришлось на период с 1960-х по 1980-е годы.</p>

<p>Отличительной особенностью этих городов является то, что в них формирование застройки, экологического каркаса и социальной инфраструктуры изначально осуществлялось научно-обоснованными проектными методами, с опорой на прикладные изыскания и типовые решения крупнейших градостроительных проектных институтов СССР, включая Гипрогор, ЛенЗНИИЭП, СибЗНИИЭП и др.</p>

<p>Большую актуальность имеет изучение современных социально-экологических аспектов развития этих городов с точки зрения того, насколько воплощенные в градостроительных проектах и генеральных планах решения соответствуют текущим требованиям жизнестойкости и устойчивого развития, предъявляемым к урбанизированной среде Российской Арктики.</p>

<p>В качестве модельных объектов настоящего исследования выступают два малых молодых города, которые были построены в 1970-е \u2013 1980-е гг. на севере Западной Сибири: Муравленко (ЯНАО) и Когалым (ХМАО).</p>"""

        home.grant_info = """<p>Исследование выполнено за счет гранта Российского научного фонда \u2116 25-27-00022, <a href="https://rscf.ru/project/25-27-00022/">https://rscf.ru/project/25-27-00022/</a></p>"""

        home.expected_results = """<p>В результате реализации проекта будут получены новые данные, характеризующие влияние природных и антропогенных факторов на индивидуальные особенности социально-экологических аспектов развития малых молодых городов ЯНАО и ХМАО как в исторической ретроспективе, так и в прогностическом контексте.</p>"""

        # Download header image
        header = download_image(
            "http://oilgascity.ru/wp-content/uploads/2025/09/header7.jpg",
            "Header background"
        )
        if header:
            home.header_image = header

        home.save_revision().publish()
        self.stdout.write(self.style.SUCCESS("  HomePage updated"))

    def import_team(self):
        self.stdout.write("=== Importing Team ===")
        team_page = TeamPage.objects.first()
        if not team_page:
            self.stdout.write(self.style.ERROR("TeamPage not found"))
            return

        # Clear existing members
        team_page.members.all().delete()

        members_data = [
            {
                "name": "Федоров Роман Юрьевич",
                "role": "Руководитель проекта",
                "position": "доктор исторических наук, главный научный сотрудник",
                "organization": "Институт криосферы Земли Тюменского научного центра СО РАН",
                "photo_url": "http://oilgascity.ru/wp-content/uploads/2025/12/JOY00543.jpg",
                "orcid": "https://orcid.org/0000-0002-3658-746X",
                "scopus": "https://www.scopus.com/authid/detail.uri?authorId=57222577540",
                "wos": "https://publons.com/researcher/H-5507-2015/",
                "elibrary": "https://elibrary.ru/author_profile.asp?id=110737",
                "spin_code": "4902-4090",
            },
            {
                "name": "Сизов Олег Сергеевич",
                "role": "Исполнитель",
                "position": "кандидат географических наук, главный научный сотрудник",
                "organization": "Институт криосферы Земли Тюменского научного центра СО РАН",
                "photo_url": None,
                "orcid": "",
                "scopus": "",
                "wos": "",
                "elibrary": "",
                "spin_code": "",
            },
            {
                "name": "Миляев Иван Александрович",
                "role": "Исполнитель",
                "position": "младший научный сотрудник, аспирант Тюменского государственного университета",
                "organization": "Институт криосферы Земли Тюменского научного центра СО РАН",
                "photo_url": None,
                "orcid": "",
                "scopus": "",
                "wos": "",
                "elibrary": "",
                "spin_code": "",
            },
            {
                "name": "Скрицкая Маргарита",
                "role": "Исполнитель",
                "position": "инженер-исследователь, магистрант МГУ им. М.В. Ломоносова",
                "organization": "Институт криосферы Земли Тюменского научного центра СО РАН",
                "photo_url": "http://oilgascity.ru/wp-content/uploads/2025/12/JOY00529-scaled.jpg",
                "orcid": "",
                "scopus": "",
                "wos": "",
                "elibrary": "",
                "spin_code": "9715-3747",
            },
        ]

        for i, m in enumerate(members_data):
            photo = None
            if m["photo_url"]:
                photo = download_image(m["photo_url"], m["name"])

            TeamMember.objects.create(
                page=team_page,
                sort_order=i,
                name=m["name"],
                role=m["role"],
                position=m["position"],
                organization=m["organization"],
                photo=photo,
                orcid=m["orcid"],
                scopus=m["scopus"],
                wos=m["wos"],
                elibrary=m["elibrary"],
                spin_code=m["spin_code"],
            )
            self.stdout.write(f"  Added: {m['name']}")

        team_page.save_revision().publish()
        self.stdout.write(self.style.SUCCESS("  Team imported"))

    def import_publications(self):
        self.stdout.write("=== Importing Publications ===")
        pub_page = PublicationsPage.objects.first()
        if not pub_page:
            self.stdout.write(self.style.ERROR("PublicationsPage not found"))
            return

        pub_page.publications.all().delete()

        pubs_data = [
            {
                "title": "Оценка обеспеченности зеленой инфраструктурой жителей северного нефтегазового города (г. Муравленко, ЯНАО)",
                "authors": "Миляев И.А., Сизов О.С., Федоров Р.Ю., Скрицкая М.К.",
                "journal": "Региональные геосистемы",
                "year": 2025,
                "abstract": "<p>Исследование направлено на оценку обеспеченности открытыми зелеными пространствами нефтегазового города Муравленко, расположенного на юге Ямало-Ненецкого автономного округа. Методология основана на определении количественных и качественных параметров озеленения с использованием мультиспектральных спутниковых снимков (WorldView-2, Landsat-4/5/7/8) и расчете вегетационного индекса NDVI.</p>",
                "doi": "https://www.elibrary.ru/download/elibrary_83031583_44544808.pdf",
            },
            {
                "title": "Нефтегазовый город как особый тип моногородов: предпосылки формирования и отличительные признаки",
                "authors": "Сизов О.С., Елисеева Е.А., Жаркова В.В., Лобжанидзе Н.Е.",
                "journal": "Географический вестник",
                "year": 2025,
                "abstract": "<p>Работа посвящена комплексному исследованию особенностей развития и устойчивости нефтегазовых городов, которые представляют собой уникальный тип урбанизированных поселений, характеризующихся высокой зависимостью от ресурсной базы. На примере Ханты-Мансийского (Югра) и Ямало-Ненецкого автономных округов рассмотрены исторические предпосылки формирования нефтегазовых городов.</p>",
                "doi": "",
            },
        ]

        for i, p in enumerate(pubs_data):
            Publication.objects.create(
                page=pub_page,
                sort_order=i,
                title=p["title"],
                authors=p["authors"],
                journal=p["journal"],
                year=p["year"],
                abstract=p["abstract"],
                doi=p["doi"],
            )
            self.stdout.write(f"  Added: {p['title'][:60]}...")

        pub_page.save_revision().publish()
        self.stdout.write(self.style.SUCCESS("  Publications imported"))

    def import_blog(self):
        self.stdout.write("=== Importing Blog (news) ===")
        blog_index = BlogIndexPage.objects.first()
        if not blog_index:
            self.stdout.write(self.style.ERROR("BlogIndexPage not found"))
            return

        # Check if already has posts
        if blog_index.get_children().exists():
            self.stdout.write("  Blog already has posts, skipping")
            return

        blog_post = BlogPost(
            title="Завершен первый год реализации гранта РНФ 25-27-00022",
            slug="first-year-results",
            date="2025-12-15",
            body="""<p>В Институте криосферы Земли ТюмНЦ СО РАН успешно завершен первый год реализации гранта РНФ 25-27-00022.</p>

<p>Команда проекта изучает, как меняются небольшие северные города \u2013 центры нефтегазового освоения \u2013 и их открытые городские пространства под влиянием климата и человеческой деятельности. Речь идет прежде всего о дворах, парках, скверах, набережных и других территориях, которыми ежедневно пользуются жители.</p>

<p>В первый год реализации проекта основное внимание было уделено городу Муравленко. Ученые проанализировали, как формировалась жилая (селитебная) зона города: изучили документальные источники, генеральные планы и градостроительную документацию в архивах Москвы, Тюмени и самого Муравленко.</p>

<p>Летом 2025 года в Муравленко было проведено полевое исследование. Сотрудники института провели серию тематических интервью с жителями разных возрастов и профессий.</p>

<p>Завершающим этапом первого года работы стала интеграция природных, геоэкологических и социологических данных. На основе этих материалов команда проекта приступила к подготовке практических рекомендаций по обновлению социально-экологической стратегии развития открытых городских пространств и благоустройства Муравленко.</p>""",
        )

        blog_index.add_child(instance=blog_post)
        blog_post.save_revision().publish()
        self.stdout.write(self.style.SUCCESS("  Blog post imported"))
