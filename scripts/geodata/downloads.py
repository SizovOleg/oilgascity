"""Файлы для скачивания векторных слоёв проекта: GeoPackage и Shapefile, каждый в zip с README.

Геометрия берётся из исходных шейпов без упрощения и слияния, в EPSG:32643 (UTM 43N), площадь
пересчитывается по контуру. Имена полей латиницей и одинаковые в обоих форматах (в Shapefile на имя
поля 10 байт, кириллица в него не помещается), значения по-русски, расшифровка полей в README.
Результат: <вывод>/downloads/<город>/<город>_<слой>_gpkg.zip и ..._shp.zip, описание для манифеста.
"""
from __future__ import annotations

import tempfile
import zipfile
from datetime import date
from pathlib import Path

import geopandas as gpd
import numpy as np
import shapely

PROJECT = ("Проект РНФ № 25-27-00022 «Социально-экологические аспекты развития малых городов как центров "
           "нефтегазового освоения в меняющихся климатических условиях субарктической зоны Западной Сибири»")
PROJECT_EN = ("RSF project No. 25-27-00022 \"Socio-ecological aspects of the development of small towns as centres "
              "of oil and gas development under a changing climate in the subarctic zone of Western Siberia\"")
SITE = "https://oilgascity.ru/geoportal"
# название, адрес, условия по-русски, условия по-английски
LICENSES = {
    "cc-by": ("CC BY 4.0", "https://creativecommons.org/licenses/by/4.0/deed.ru",
              "Можно использовать, изменять и распространять, в том числе в коммерческих целях, "
              "при условии ссылки на источник (см. «Как ссылаться»).",
              "You may use, adapt and share the data, including for commercial purposes, "
              "provided you credit the source (see \"How to cite\")."),
    "odbl": ("ODbL 1.0", "https://opendatacommons.org/licenses/odbl/1-0/",
             "Часть контуров взята из OpenStreetMap и уточнена в проекте, поэтому слой распространяется "
             "на условиях OpenStreetMap: ссылка на источник и «© участники OpenStreetMap», производные базы "
             "данных публикуются по той же лицензии.",
             "Some outlines come from OpenStreetMap and were refined in the project, so the layer is distributed "
             "under the OpenStreetMap terms: credit the source and \"© OpenStreetMap contributors\"; derivative "
             "databases must be shared under the same licence."),
}
CC_BY_EN = "https://creativecommons.org/licenses/by/4.0/deed.en"
GRANT_EN = "RSF project No. 25-27-00022 data"
# официальное английское название с сайта журнала (reg-geosystems-journal.ru, article/view/279)
PUB_MUR_EN = ("Milyaev I.A., Sizov O.S., Fedorov R.Yu., Skritskaya M.K. Assessment of the Green Infrastructure Availability "
              "for Residents of a Northern Oil-and-Gas Town (Muravlenko, YaNAO). "
              "Regional Geosystems, 2025, No. 3")
# Английская часть README: перевод строк, которые передаёт build_geodata.py (те же тексты, что в манифесте;
# словарь фронтенда frontend/src/geoportal/strings-geo-en.js держать согласованным с этим)
EN = {
    "Муравленко": "Muravlenko",
    "Когалым": "Kogalym",
    "Типы поверхности Муравленко": "Land cover types of Muravlenko",
    "Растительные сообщества Муравленко": "Plant communities of Muravlenko",
    "Парки, скверы и площадки Муравленко": "Parks, squares, playgrounds and sports grounds of Muravlenko",
    "Парки, скверы и площадки Когалыма": "Parks, squares, playgrounds and sports grounds of Kogalym",
    "Типы поверхности Когалыма": "Land cover types of Kogalym",
    "Классификация снимка WorldView-2 от 17.07.2020 по рис. 4a статьи: классы растительности, открытых грунтов, воды и застройки.":
        "Classification of the WorldView-2 image of 17 July 2020 after Fig. 4a of the paper: classes of vegetation, "
        "bare ground, water and built-up areas.",
    "Геоботаническая карта города: полевые описания 2025 года и дешифрирование снимков (отчёт за 2025 год, результат 3).":
        "Vegetation map of the town: 2025 field relevés and image interpretation (2025 report, result 3).",
    "Открытые пространства города по рис. 6 статьи и результату 7 отчёта за 2025 год, обследованы в июле 2025 года.":
        "Open spaces of the town after Fig. 6 of the paper and result 7 of the 2025 report, surveyed in July 2025.",
    "Открытые пространства города, обследованные в июле 2026 года; контуры уточнены по снимкам и полевым работам.":
        "Open spaces of the town surveyed in July 2026; outlines refined from imagery and fieldwork.",
    "Классификация снимка GeoEye-1 от 08.07.2020 по той же методике, что и для Муравленко; контуры зданий взяты из OpenStreetMap.":
        "Classification of the GeoEye-1 image of 8 July 2020 using the same method as for Muravlenko; building outlines "
        "are from OpenStreetMap.",
    # поля
    "тип: парк, сквер, детская или спортивная площадка и др.": "type: park, square, playground, sports ground, etc.",
    "группа: зелёная зона (парки и скверы) или площадка": "group: green area (parks and squares) or playground / sports ground",
    "название": "name",
    "номер объекта в слое проекта": "feature number in the project layer",
    "номер объекта OpenStreetMap, если контур взят оттуда": "OpenStreetMap ID, if the outline was taken from OSM",
    "код класса (латиницей, как в исходной классификации)": "class code (Latin script, as in the original classification)",
    "класс поверхности": "land cover class",
    "тип открытого пространства, в которое попадает контур (если попадает)": "type of open space the outline falls within (if any)",
    "формация растительности (6 классов легенды)": "vegetation formation (6 legend classes)",
    "растительное сообщество": "plant community",
    "номер здания OpenStreetMap (у класса «здания»)": "OpenStreetMap building ID (for the \"buildings\" class)",
    # подпись и ссылки
    "© участники OpenStreetMap": "© OpenStreetMap contributors",
    "Миляев И.А., Сизов О.С., Федоров Р.Ю., Скрицкая М.К. Оценка обеспеченности зеленой инфраструктурой жителей "
    "северного нефтегазового города (г. Муравленко, ЯНАО) // Региональные геосистемы. 2025. № 3. "
    f"Данные проекта РНФ № 25-27-00022. URL: {SITE}": f"{PUB_MUR_EN}. {GRANT_EN}. URL: {SITE}",
    f"Данные проекта РНФ № 25-27-00022, геоботаническая карта Муравленко, 2025. URL: {SITE}":
        f"{GRANT_EN}, vegetation map of Muravlenko, 2025. URL: {SITE}",
    f"Данные проекта РНФ № 25-27-00022, открытые пространства Когалыма, 2026; © участники OpenStreetMap. URL: {SITE}":
        f"{GRANT_EN}, open spaces of Kogalym, 2026; © OpenStreetMap contributors. URL: {SITE}",
    f"Данные проекта РНФ № 25-27-00022, типы поверхности Когалыма; © участники OpenStreetMap. URL: {SITE}":
        f"{GRANT_EN}, land cover types of Kogalym; © OpenStreetMap contributors. URL: {SITE}",
}


def en(s: str) -> str:
    """Английский текст для README; без перевода остаётся русский, и сборка пишет об этом в журнал."""
    if s in EN:
        return EN[s]
    print(f"  ВНИМАНИЕ: нет английского текста для README: {s[:80]}")
    return s
SHP_PARTS = (".shp", ".shx", ".dbf", ".prj", ".cpg")


def readme(title: str, city: str, about: str, fields: list[tuple[str, str]], count: int,
           license_key: str, cite: str, attribution: str) -> str:
    name, url, terms, _ = LICENSES[license_key]
    lines = [
        title, "=" * len(title), "",
        f"Город: {city}.", about, "",
        PROJECT + ".", "",
        f"Объектов: {count}. Система координат: WGS 84 / UTM zone 43N (EPSG:32643).",
        "Геометрия исходная, без упрощения. Площадь (area_m2) посчитана по контуру в этой системе координат.", "",
        "Поля:",
        *[f"  {f:<12} {d}" for f, d in fields],
        "  area_m2      площадь контура, м²", "",
        f"Лицензия: {name}, {url}",
        terms,
        *([f"Обязательная подпись: {attribution}."] if attribution else []), "",
        "Как ссылаться:",
        f"  {cite}",
        "", f"Скачано с {SITE}, сборка {date.today().isoformat()}.",
    ]
    # английская часть: то же содержание, значения атрибутов в данных остаются по-русски
    title_en = en(title)
    terms_en = LICENSES[license_key][3]
    lines += [
        "", "", title_en, "=" * len(title_en), "",
        f"Town: {en(city)}. {en(about)}", "",
        PROJECT_EN + ".", "",
        f"Features: {count}. Coordinate system: WGS 84 / UTM zone 43N (EPSG:32643).",
        "Original geometry, not simplified. Area (area_m2) is calculated from the outline in this coordinate system.",
        "Field names are the same in both formats; attribute values are in Russian.", "",
        "Fields:",
        *[f"  {f:<12} {en(d)}" for f, d in fields],
        "  area_m2      outline area, m²", "",
        f"Licence: {name}, {CC_BY_EN if license_key == 'cc-by' else url}",
        terms_en,
        *([f"Required attribution: {en(attribution)}."] if attribution else []), "",
        "How to cite:",
        f"  {en(cite)}",
        "", f"Downloaded from {SITE}, build {date.today().isoformat()}.",
    ]
    return "\n".join(lines) + "\n"


def valid_polygons(gdf: gpd.GeoDataFrame) -> gpd.GeoDataFrame:
    """Невалидные контуры исправляются (make_valid), из коллекций остаются только полигоны:
    Shapefile не хранит смешанные типы, а самопересечения ломают пересчёт площади в ГИС."""
    bad = ~gdf.geometry.is_valid
    if not bad.any() or not gdf.geom_type.isin(["Polygon", "MultiPolygon"]).all():
        return gdf
    gdf = gdf.copy()
    fixed = shapely.make_valid(gdf.geometry[bad].values, method="structure", keep_collapsed=False)

    def polygonal(g):  # из коллекции берутся только полигоны (тип 3) и мультиполигоны (тип 6)
        if g.geom_type != "GeometryCollection":
            return g
        parts = shapely.get_parts(g)
        return shapely.union_all(parts[np.isin(shapely.get_type_id(parts), [3, 6])])

    gdf.loc[bad, "geometry"] = [polygonal(g) for g in fixed]
    print(f"  исправлено невалидных контуров: {int(bad.sum())}")
    return gdf[~gdf.geometry.is_empty]


def export_layer(gdf: gpd.GeoDataFrame, out: Path, *, city: str, city_title: str, slug: str, title: str,
                 about: str, fields: list[tuple[str, str]], license_key: str, cite: str,
                 attribution: str = "") -> dict:
    """Пишет два zip слоя и возвращает запись `download` для манифеста (адреса относительно /geodata)."""
    cols = [f for f, _ in fields]
    gdf = valid_polygons(gdf[~gdf.geometry.is_empty & gdf.geometry.notna()][cols + ["geometry"]].copy())
    gdf["area_m2"] = gdf.geometry.area.round(1)
    gdf = gdf.reset_index(drop=True)
    base = f"{city}_{slug}"
    text = readme(title, city_title, about, fields, len(gdf), license_key, cite, attribution)
    d = out / "downloads" / city
    d.mkdir(parents=True, exist_ok=True)
    files = []
    with tempfile.TemporaryDirectory() as tmp:
        tmp = Path(tmp)
        gpkg = tmp / f"{base}.gpkg"
        gdf.to_file(gpkg, layer=base, driver="GPKG")
        shp = tmp / "shp" / f"{base}.shp"
        shp.parent.mkdir()
        gdf.to_file(shp, driver="ESRI Shapefile", encoding="utf-8")
        for fmt, parts, suffix in (("GeoPackage", [gpkg], "gpkg"),
                                   ("Shapefile", [shp.with_suffix(s) for s in SHP_PARTS], "shp")):
            target = d / f"{base}_{suffix}.zip"
            with zipfile.ZipFile(target, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as z:
                for p in parts:
                    if p.exists():
                        z.write(p, p.name)
                z.writestr("README.txt", text.encode("utf-8-sig"))  # с BOM: Блокнот Windows открывает без кракозябр
            files.append({"format": fmt, "url": f"downloads/{city}/{target.name}", "size": target.stat().st_size})
            print(f"  {target.name}: {len(gdf)} объектов, {target.stat().st_size / 1e6:.2f} МБ")
    name, url, _, _ = LICENSES[license_key]
    return {"files": files, "count": len(gdf), "license": name, "license_url": url,
            "attribution": attribution, "cite": cite}
