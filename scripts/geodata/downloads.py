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
SITE = "https://oilgascity.ru/geoportal"
LICENSES = {
    "cc-by": ("CC BY 4.0", "https://creativecommons.org/licenses/by/4.0/deed.ru",
              "Можно использовать, изменять и распространять, в том числе в коммерческих целях, "
              "при условии ссылки на источник (см. «Как ссылаться»)."),
    "odbl": ("ODbL 1.0", "https://opendatacommons.org/licenses/odbl/1-0/",
             "Часть контуров взята из OpenStreetMap и уточнена в проекте, поэтому слой распространяется "
             "на условиях OpenStreetMap: ссылка на источник и «© участники OpenStreetMap», производные базы "
             "данных публикуются по той же лицензии."),
}
SHP_PARTS = (".shp", ".shx", ".dbf", ".prj", ".cpg")


def readme(title: str, city: str, about: str, fields: list[tuple[str, str]], count: int,
           license_key: str, cite: str, attribution: str) -> str:
    name, url, terms = LICENSES[license_key]
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
    name, url, _ = LICENSES[license_key]
    return {"files": files, "count": len(gdf), "license": name, "license_url": url,
            "attribution": attribution, "cite": cite}
