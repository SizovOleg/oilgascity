"""Подготовка слоёв геопортала из исходников проекта (шейпы и растры QGIS).

Запуск:
    python scripts/geodata/build_geodata.py "<папка «Слои городов»>" <папка вывода>

На выходе: manifest.json (города, группы слоёв, стили, легенды, источники) и по папке на город
с GeoJSON в EPSG:4326 и PNG-растрами. Данные публикуются как статика (nginx, /geodata/),
в git не хранятся: репозиторий публичный, а объём десятки мегабайт.
Состав слоёв повторяет карты статей проекта (единая методика для двух городов).
"""
from __future__ import annotations

import json
import re
from datetime import datetime, timezone
import sys
import warnings
from pathlib import Path

import shutil

import geopandas as gpd
import numpy as np
import pandas as pd
import pyogrio
import rasterio
import shapely
from PIL import Image
from rasterio.warp import Resampling, calculate_default_transform, reproject, transform_bounds
from shapely.geometry import mapping

sys.path.insert(0, str(Path(__file__).parent))
from downloads import export_layer  # noqa: E402
from housing import housing_tab  # noqa: E402

warnings.filterwarnings("ignore", category=UserWarning)

UTM = "EPSG:32643"
ART_MUR = "Миляев И.А., Сизов О.С., Федоров Р.Ю., Скрицкая М.К. Региональные геосистемы, 2025, № 3"
PUB_MUR = ("Миляев И.А., Сизов О.С., Федоров Р.Ю., Скрицкая М.К. Оценка обеспеченности зеленой инфраструктурой "
           "жителей северного нефтегазового города (г. Муравленко, ЯНАО) // Региональные геосистемы. 2025. № 3")
GRANT = "Данные проекта РНФ № 25-27-00022"
# Поля открытых пространств в файлах для скачивания
OPEN_FIELDS = [("kind", "тип: парк, сквер, детская или спортивная площадка и др."),
               ("grp", "группа: зелёная зона (парки и скверы) или площадка"), ("name", "название")]
GROUP_RU = {"green": "зелёная зона", "sites": "площадка"}
SITE_REF = "URL: https://oilgascity.ru/geoportal"
# Подписи колонок атрибутивной таблицы в геопортале
TABLE_LABELS = {
    "num": "№ в слое", "name": "Название", "kind": "Тип", "grp": "Группа", "area_ha": "Площадь, га", "area_m2": "Площадь, м²",
    "photos": "Фото", "osm_id": "OSM ID", "note": "Описание", "lon": "Долгота", "lat": "Широта", "formation": "Формация",
    "community": "Сообщество", "address": "Адрес", "micro": "Микрорайон", "floors": "Этажей", "entrances": "Подъездов",
    "apartments": "Квартир", "living_area": "Жилая площадь, м²", "year": "Год постройки", "condition": "Состояние",
    "type": "Тип дома", "people": "Жителей (оценка)", "zone": "Зона", "cls_name": "Класс", "space": "Открытое пространство",
}


def table_of(*keys: str) -> dict:
    """Атрибутивная таблица по объектам слоя карты: колонки [поле, подпись] из свойств его GeoJSON."""
    return {"cols": [[k, TABLE_LABELS.get(k, k)] for k in keys]}

# Единая палитра типов поверхности для двух городов (подписи по легенде рис. 4 статьи)
SURFACE = {
    "coniferous": ("Хвойные породы", "#2F5D3A"),
    "deciduous": ("Лиственные породы", "#7FAF5B"),
    "grass": ("Кустарники и газоны", "#C8D98A"),
    "sands": ("Оголённые пески", "#E3C98F"),
    "swamp": ("Болота", "#8AA597"),
    "water": ("Водоёмы", "#5B9BC6"),
    "Openspace": ("Благоустроенные открытые пространства", "#E59A5C"),
    "Residential": ("Жилые здания", "#B5503F"),
    "buildings": ("Здания и сооружения", "#B5503F"),
    "Non-residential": ("Нежилые здания", "#8C6F6A"),
    "roads": ("Дороги", "#A3A8AB"),
    "dark": ("Тени", "#55595C"),
}
VEGETATION = {
    "Светлохвойные лесные сообщества": "#2F5D3A",
    "Смешанные лесные сообщества": "#5E8B4E",
    "Лиственные лесные сообщества": "#8DBA63",
    "Разнотравные сообщества со смешанным подростом": "#BFD48A",
    "Разнотравные сообщества": "#E2E6A8",
    "Болотные кустарничковые сообщества": "#8AA597",
}
ZONES = {
    "Жилая зона": "#D9A07A",
    "Общественно-деловая зона": "#C77D8E",
    "Зона рекреационного назначения": "#8DBA63",
    "Зона производственного использования": "#9C8FB5",
    "Зона инженерной и транспортной инфраструктуры": "#A3A8AB",
    "Зона специального назначения": "#7A7A7A",
    "Зона сельскохозяйственного использования": "#D6C77A",
}
OPEN_KINDS = {
    "park": "парк", "square": "сквер", "playground": "детская площадка", "pitch": "спортивная площадка",
    "pitc": "спортивная площадка", "stadium": "стадион", "dogs": "площадка для собак", "ski slope": "лыжный склон",
    "skiing lodge": "лыжная база", "rope strip": "верёвочный парк",
}


def read(src: Path, rel: str) -> gpd.GeoDataFrame:
    gdf = gpd.read_file(src / rel)
    if gdf.crs is None:
        gdf = gdf.set_crs(UTM)
    return gdf.to_crs(UTM)


def to_geojson(gdf: gpd.GeoDataFrame, path: Path, props: list[str], tolerance: float = 0.5,
               coverage: bool = False) -> dict:
    """Упрощение в метрах (UTM), перевод в WGS 84, округление координат до 6 знаков.
    coverage: слой сплошной (контуры примыкают друг к другу, как карта растительности или зоны); тогда общие
    границы упрощаются согласованно (shapely.coverage_simplify) и между соседями не появляются щели."""
    gdf = gdf[~gdf.geometry.is_empty & gdf.geometry.notna()].copy()
    if tolerance and coverage:
        polys = [polygonal(g) for g in gdf.geometry.make_valid().values]
        gdf["geometry"] = shapely.coverage_simplify(polys, tolerance)
        gdf = gdf[~gdf.geometry.is_empty]
    elif tolerance:
        gdf["geometry"] = gdf.geometry.simplify(tolerance, preserve_topology=True)
    gdf = gdf.to_crs("EPSG:4326")
    features = []
    for _, row in gdf.iterrows():
        geom = mapping(row.geometry)
        features.append({
            "type": "Feature",
            "properties": {k: clean(row[k], 6 if k in ("lon", "lat") else 2) for k in props if k in row},
            "geometry": round_coords(geom),
        })
    data = {"type": "FeatureCollection", "features": features}
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"  {path.name}: {len(features)} объектов, {path.stat().st_size / 1e6:.2f} МБ")
    return data


def polygonal(g):
    """Только полигональная часть геометрии: после make_valid бывают линии и точки, coverage_simplify их не берёт."""
    if g.geom_type in ("Polygon", "MultiPolygon"):
        return g
    parts = [q for x in shapely.get_parts(g) for q in shapely.get_parts(x) if q.geom_type == "Polygon"]
    return shapely.MultiPolygon(parts) if parts else shapely.Polygon()


def write_vector_tiles(gdf: gpd.GeoDataFrame, d: Path, name: str, props: list[str], minzoom: int = 11,
                       maxzoom: int = 16) -> dict:
    """Векторные тайлы MVT (каталог <name>_tiles/{z}/{x}/{y}.pbf) для тяжёлого сплошного слоя.
    Контуры исходные, по одному объекту; соседи квантуются на одну сетку тайла, поэтому щелей нет, а браузер
    грузит только тайлы на экране (MapLibre дорисовывает крупнее maxzoom из тайлов maxzoom). Пишет GDAL (pyogrio)."""
    out = d / f"{name}_tiles"
    if out.exists():
        shutil.rmtree(out)
    d.mkdir(parents=True, exist_ok=True)
    # encoding явно: на Windows pyogrio иначе пишет строки в кодировке системы, и названия классов портятся
    pyogrio.write_dataframe(gdf[props + ["geometry"]].to_crs("EPSG:3857"), out, layer=name, driver="MVT", encoding="UTF-8",
                            # упрощение в 4 единицы тайла (меньше пикселя на экране) до предпоследнего масштаба:
                            # объём тайлов вдвое меньше, а maxzoom остаётся точным для крупных масштабов
                            dataset_options={"FORMAT": "DIRECTORY", "COMPRESS": "NO", "TILE_EXTENSION": "pbf",
                                             "MINZOOM": str(minzoom), "MAXZOOM": str(maxzoom), "NAME": name,
                                             "SIMPLIFICATION": "4", "SIMPLIFICATION_MAX_ZOOM": str(maxzoom - 1)})
    tiles = list(out.rglob("*.pbf"))
    print(f"  {out.name}: {len(gdf)} объектов, {len(tiles)} тайлов z{minzoom}-{maxzoom}, "
          f"{sum(t.stat().st_size for t in tiles) / 1e6:.1f} МБ")
    return {"tiles": f"{out.name}/{{z}}/{{x}}/{{y}}.pbf", "layer": name, "minzoom": minzoom, "maxzoom": maxzoom}


def surface_tiles(surface: gpd.GeoDataFrame, obj: gpd.GeoDataFrame, field: str, d: Path, props: list[str]) -> list[dict]:
    """Типы поверхности в двух наборах тайлов. До 14-го масштаба: классы, слитые и обобщённые (фрагменты меньше 50 м²
    отброшены, щели меньше пикселя), иначе десятки тысяч контуров не помещаются в предел тайла GDAL и выпадают.
    С 14-го: исходные объекты с номером oid (щелчок и таблица). show: масштабы, на которых набор виден."""
    lo = with_names(dissolve(surface, field, 50, 3.0).rename(columns={field: "cls"}))
    return [{**write_vector_tiles(obj, d, "surface", props, minzoom=14, maxzoom=16), "show": [14, 24]},
            {**write_vector_tiles(lo, d, "surface_lo", ["cls", "name"], minzoom=11, maxzoom=13), "show": [0, 14]}]


def clean(value, digits: int = 2):
    """Значение свойства для JSON: числа numpy в обычные, дробные округляются (у строки со смешанными
    типами pandas отдаёт обычный float, поэтому округляется и он), пропуски в None."""
    if value is None or value is pd.NA or (isinstance(value, float) and np.isnan(value)):
        return None
    if isinstance(value, (bool, np.bool_)):
        return bool(value)
    if isinstance(value, (int, np.integer)):
        return int(value)
    if isinstance(value, (float, np.floating)):
        f = float(value)
        return None if np.isnan(f) else round(f, digits)  # NaN у float32 не ловится первой проверкой
    return value if isinstance(value, str) else str(value)


def round_coords(geom):
    def rnd(c):
        if isinstance(c, (list, tuple)) and c and isinstance(c[0], (int, float)):
            return [round(c[0], 6), round(c[1], 6)]
        return [rnd(x) for x in c]
    geom = dict(geom)
    geom["coordinates"] = rnd(geom["coordinates"])
    return geom


def dissolve(gdf: gpd.GeoDataFrame, field: str, min_area: float = 0, tolerance: float = 0) -> gpd.GeoDataFrame:
    """Слияние по классу; для тяжёлых слоёв убираются фрагменты меньше min_area м² и упрощаются контуры."""
    gdf = gdf[gdf[field].notna()]
    out = gdf[[field, "geometry"]].dissolve(by=field, as_index=False)
    # площадь класса считается до упрощения, чтобы в подписи была исходная цифра
    area_ha = dict(zip(out[field], (out.geometry.area / 1e4).round(1)))
    if min_area or tolerance:
        parts = out.explode(index_parts=False)
        parts = parts[parts.geometry.area >= min_area]
        if tolerance:
            parts["geometry"] = parts.geometry.simplify(tolerance, preserve_topology=True)
        out = parts.dissolve(by=field, as_index=False)
    out["area_ha"] = out[field].map(area_ha)
    return out


def with_names(gdf: gpd.GeoDataFrame) -> gpd.GeoDataFrame:
    """Русское название класса поверхности для всплывающей подписи."""
    gdf = gdf.copy()
    gdf["name"] = gdf["cls"].map(lambda c: SURFACE.get(c, (c, ""))[0])
    return gdf


def buffer_union(gdf: gpd.GeoDataFrame, meters: float) -> gpd.GeoDataFrame:
    geom = gdf.geometry.buffer(meters).union_all()
    return gpd.GeoDataFrame({"label": [f"{int(meters)} м пешком"]}, geometry=[geom], crs=UTM)


def ndvi_png(tif: Path, out_png: Path, lo: float = 0.0, hi: float = 0.8, max_px: int = 2400) -> list[list[float]]:
    """NDVI в PNG для слоя-изображения MapLibre: перепроекция в EPSG:3857 и цветовая шкала."""
    with rasterio.open(tif) as src:
        scale = max(1, max(src.width, src.height) / max_px)
        transform, width, height = calculate_default_transform(
            src.crs, "EPSG:3857", src.width, src.height, *src.bounds,
            dst_width=int(src.width / scale), dst_height=int(src.height / scale))
        data = np.full((height, width), np.nan, dtype="float32")
        reproject(rasterio.band(src, 1), data, src_transform=src.transform, src_crs=src.crs,
                  dst_transform=transform, dst_crs="EPSG:3857", resampling=Resampling.bilinear,
                  src_nodata=src.nodata, dst_nodata=np.nan)
        left, bottom, right, top = transform_bounds("EPSG:3857", "EPSG:4326",
                                                    transform.c, transform.f + transform.e * height,
                                                    transform.c + transform.a * width, transform.f)
    valid = np.isfinite(data) & (data > -1) & (data <= 1)
    t = np.clip((data - lo) / (hi - lo), 0, 1)
    stops = np.array([[0.62, 0.44, 0.29], [0.90, 0.82, 0.55], [0.74, 0.84, 0.45], [0.36, 0.60, 0.29], [0.13, 0.33, 0.18]])
    pos = t * (len(stops) - 1)
    i = np.clip(np.floor(pos).astype(int), 0, len(stops) - 2)
    f = (pos - i)[..., None]
    rgb = stops[i] * (1 - f) + stops[i + 1] * f
    rgba = np.zeros((height, width, 4), dtype="uint8")
    rgba[..., :3] = (rgb * 255).astype("uint8")
    rgba[..., 3] = np.where(valid, 235, 0)
    out_png.parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray(rgba, "RGBA").save(out_png, optimize=True)
    print(f"  {out_png.name}: {width}x{height}, {out_png.stat().st_size / 1e6:.2f} МБ")
    return [[round(left, 6), round(top, 6)], [round(right, 6), round(top, 6)],
            [round(right, 6), round(bottom, 6)], [round(left, 6), round(bottom, 6)]]


def legend_from(values, palette) -> list[dict]:
    return [{"label": palette[v][0] if isinstance(palette[v], tuple) else v,
             "color": palette[v][1] if isinstance(palette[v], tuple) else palette[v]} for v in values if v in palette]


def match_expr(field: str, palette: dict) -> list:
    expr = ["match", ["get", field]]
    for key, val in palette.items():
        expr += [key, val[1] if isinstance(val, tuple) else val]
    return expr + ["#cccccc"]


def slug(text: str) -> str:
    """Латинский ключ из названия; совпадает с ключами в scripts/geodata/photos.py."""
    table = str.maketrans("абвгдеёжзийклмнопрстуфхцчшщъыьэюя", "abvgdeejziiklmnoprstufhccss_y_eua")
    return re.sub(r"[^a-z0-9]+", "-", text.lower().translate(table)).strip("-")


def write_open_spaces(open_sp: gpd.GeoDataFrame, d: Path, photos: dict) -> None:
    """Слой открытых пространств с числом фото у объекта и файл photos.json для карусели."""
    open_sp = open_sp.copy()
    open_sp["photos"] = open_sp["fid"].map(lambda f: len(photos.get(f, {}).get("items", [])) if f else 0)
    open_sp["area_ha"] = (open_sp.geometry.area / 1e4).round(2)  # для таблицы, в UTM до упрощения
    open_sp["grp"] = open_sp["group"].map(GROUP_RU)
    to_geojson(open_sp, d / "open_spaces.json", ["num", "name", "kind", "group", "grp", "fid", "photos", "area_ha", "osm_id"], 0.3)
    if photos:
        (d / "photos.json").write_text(json.dumps(photos, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
        print(f"  photos.json: {len(photos)} объектов, {sum(len(g['items']) for g in photos.values())} снимков")


def write_field_points(pts: gpd.GeoDataFrame, d: Path, photos: dict) -> None:
    """Точки полевых описаний с числом фото у точки (ключ fid как в scripts/geodata/photos.py)."""
    pts = pts.copy()
    pts["photos"] = pts["fid"].map(lambda f: len(photos.get(f, {}).get("items", [])) if f else 0)
    if "note" not in pts:
        pts["note"] = None
    ll = pts.geometry.to_crs("EPSG:4326")
    pts["lon"], pts["lat"] = ll.x.round(6), ll.y.round(6)
    to_geojson(pts, d / "field_points.json", ["name", "kind", "note", "fid", "photos", "lon", "lat"], 0)
    print(f"  field_points.json: {len(pts)} точек, с фото {int((pts['photos'] > 0).sum())}")


def write_objects(gdf: gpd.GeoDataFrame, d: Path, lid: str, cols: list[list[str]], chunk: int = 1000,
                  tolerance: float = 1.0) -> dict:
    """Атрибутивная таблица по объектам для слоя, который на карте слит по классам (иначе слишком тяжёл):
    <lid>_objects.json (поля, строки, охваты в WGS 84) и порции геометрии <lid>_objects/<k>.json по chunk объектов,
    их геопортал догружает для подсветки выбранной строки. Возвращает описание таблицы для манифеста."""
    keys = [k for k, _ in cols]
    gdf = gdf[~gdf.geometry.is_empty & gdf.geometry.notna()].reset_index(drop=True)
    geo = gpd.GeoSeries(gdf.geometry.simplify(tolerance, preserve_topology=True), crs=gdf.crs).to_crs("EPSG:4326")
    bbox = geo.bounds.round(6)[["minx", "miny", "maxx", "maxy"]].values.tolist()
    rows = [[clean(v) for v in r] for r in gdf[keys].itertuples(index=False, name=None)]
    path = d / f"{lid}_objects.json"
    path.write_text(json.dumps({"cols": keys, "rows": rows, "bbox": bbox}, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    parts = d / f"{lid}_objects"
    parts.mkdir(parents=True, exist_ok=True)
    for old in parts.glob("*.json"):
        old.unlink()
    for k in range(0, len(geo), chunk):
        fc = {"type": "FeatureCollection", "features": [
            {"type": "Feature", "properties": {}, "geometry": round_coords(mapping(g))} for g in geo.iloc[k:k + chunk]]}
        (parts / f"{k // chunk}.json").write_text(json.dumps(fc, separators=(",", ":")), encoding="utf-8")
    print(f"  {path.name}: {len(rows)} объектов, {path.stat().st_size / 1e6:.2f} МБ, порций геометрии {len(list(parts.glob('*.json')))}")
    return {"cols": cols, "src": path.name, "parts": parts.name, "chunk": chunk}


FIELD_POINTS_STYLE = {
    "color": ["match", ["get", "kind"], "геоботаническое описание", "#2F5D3A", "#C2410C"],
    "legend": [{"label": "Геоботаническое описание", "color": "#2F5D3A"},
               {"label": "Точка экологической напряжённости", "color": "#C2410C"}],
}


def build(src: Path, out: Path, housing_root: Path | None = None, photos_index: Path | None = None,
          imagery_index: Path | None = None) -> None:
    photos = json.loads(photos_index.read_text(encoding="utf-8")) if photos_index else {}
    imagery = json.loads(imagery_index.read_text(encoding="utf-8")) if imagery_index else {}
    # built: метка сборки; геопортал добавляет её к адресам слоёв (?v=...), чтобы браузер не держал старые файлы
    manifest = {"version": 1, "built": datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S"), "cities": []}

    # ------------------------------------------------------------ Муравленко
    print("Муравленко")
    d = out / "muravlenko"
    border = read(src, "Муравленко/Вектор/Граница_Муравленко.shp")
    to_geojson(border.assign(name="Граница города"), d / "border.json", ["name"], 0.5)
    micro = read(src, "Муравленко/Вектор/Microdistricts.shp").rename(columns={"Names": "name"})
    micro["area_ha"] = (micro.geometry.area / 1e4).round(2)
    to_geojson(micro, d / "microdistricts.json", ["name", "area_ha"], 0.5, coverage=True)
    roads = read(src, "Муравленко/Вектор/Roads.shp").rename(columns={"NAME": "name"})
    to_geojson(roads, d / "roads.json", ["name"], 0.5)
    open_sp = read(src, "Муравленко/Вектор/M_OpenSpace.shp")
    open_sp["kind"] = open_sp["fclass"].map(OPEN_KINDS).fillna(open_sp["fclass"])
    open_sp["name"] = open_sp["Name_1"]
    open_sp["num"] = open_sp["OBJECTID_1"]
    open_sp["group"] = np.where(open_sp["fclass"].isin(["park", "square"]), "green", "sites")
    # ключ для фото: площадки по OBJECTID_1, скверы по названию (как в scripts/geodata/photos.py)
    # у части контуров нет OBJECTID_1: ключа и фото у них нет
    open_sp["fid"] = [f"m-{slug(n)}" if g == "green" and isinstance(n, str) and n not in ("Сквер",)
                      else (f"m{int(o)}" if pd.notna(o) else None)
                      for n, g, o in zip(open_sp["Name_1"], open_sp["group"], open_sp["OBJECTID_1"])]
    write_open_spaces(open_sp, d, photos.get("muravlenko", {}))
    # точки геоботаники и экологической напряжённости 2025 года: в слоях города их нет, слой собирает photos.py
    # из таблиц полевых описаний и путевых точек навигатора
    mur_pts_fc = photos.get("_points", {}).get("muravlenko")
    if mur_pts_fc and mur_pts_fc["features"]:
        mur_pts = gpd.GeoDataFrame.from_features(mur_pts_fc["features"], crs="EPSG:4326").to_crs(UTM)
        write_field_points(mur_pts, d, photos.get("muravlenko", {}))
    buildings = read(src, "Муравленко/Вектор_итог/M_Buildings.shp")
    buildings["address"] = buildings["Street"].fillna("") + " " + buildings["House"].fillna("").astype(str)
    to_geojson(buildings.rename(columns={"floor": "floors", "entrance": "entrances", "apartment": "apartments",
                                         "living_spa": "living_area", "Condition": "condition", "Type": "type"}),
               d / "buildings.json", ["address", "floors", "entrances", "apartments", "living_area", "year", "condition", "type"], 0.3)
    zones = read(src, "Муравленко/Вектор/Functional_zones.shp").rename(columns={"Zones": "zone"})
    zones["area_ha"] = (zones.geometry.area / 1e4).round(2)
    to_geojson(zones, d / "zones.json", ["zone", "area_ha"], 0.5, coverage=True)
    points = read(src, "Муравленко/Вектор/M_Points.shp").rename(columns={"Name": "name"})
    to_geojson(points, d / "places.json", ["name"], 0)
    surface = read(src, "Муравленко/Классификация/Classification_map_v3.shp")
    dl_mur_surface = export_layer(
        surface.assign(cls=surface["Class"], cls_name=surface["Class"].map(lambda c: SURFACE[c][0] if c in SURFACE else None),
                       space=surface["fclass"].map(OPEN_KINDS)), out,
        city="muravlenko", city_title="Муравленко", slug="surface", title="Типы поверхности Муравленко",
        about="Классификация снимка WorldView-2 от 17.07.2020 по рис. 4a статьи: классы растительности, открытых грунтов, воды и застройки.",
        fields=[("cls", "код класса (латиницей, как в исходной классификации)"), ("cls_name", "класс поверхности"),
                ("space", "тип открытого пространства, в которое попадает контур (если попадает)")],
        license_key="cc-by", cite=f"{PUB_MUR}. {GRANT}. {SITE_REF}")
    # типы поверхности на карте векторными тайлами из исходных контуров (слитый по классам GeoJSON давал щели между
    # классами и весил 7 МБ); номер oid у тайлов совпадает со строкой атрибутивной таблицы
    obj = surface[surface.geometry.notna() & ~surface.geometry.is_empty].reset_index(drop=True)
    obj = obj.assign(oid=np.arange(len(obj)), cls=obj["Class"], name=obj["Class"].map(lambda c: SURFACE[c][0] if c in SURFACE else None),
                     space=obj["fclass"].map(OPEN_KINDS), area_m2=obj.geometry.area.round(1))
    vt_mur_surface = surface_tiles(surface, obj, "Class", d, ["oid", "cls", "name", "space"])  # площадь в таблице
    tbl_mur_surface = write_objects(obj.assign(cls_name=obj["name"]), d, "surface",
                                    [["cls_name", "Класс"], ["space", "Открытое пространство"], ["area_m2", "Площадь, м²"]])
    # растительность на карте по контурам (около 0,7 МБ в gzip): щелчок и таблица показывают отдельный контур
    veg = read(src, "Муравленко/Карта растительности/Vegetation_map.shp").rename(columns={"Veg_3": "formation", "Veg_2": "community"})
    veg["area_m2"] = veg.geometry.area.round(0)
    to_geojson(veg, d / "vegetation.json", ["formation", "community", "area_m2"], 2.0, coverage=True)
    green = open_sp[open_sp["group"] == "green"]
    to_geojson(buffer_union(green, 400), d / "access_green.json", ["label"], 1.0)
    dl_mur = {
        "vegetation": export_layer(
            veg, out, city="muravlenko", city_title="Муравленко", slug="vegetation", title="Растительные сообщества Муравленко",
            about="Геоботаническая карта города: полевые описания 2025 года и дешифрирование снимков (отчёт за 2025 год, результат 3).",
            fields=[("formation", "формация растительности (6 классов легенды)"), ("community", "растительное сообщество")],
            license_key="cc-by", cite=f"{GRANT}, геоботаническая карта Муравленко, 2025. {SITE_REF}"),
        "open_spaces": export_layer(
            open_sp.assign(id=open_sp["OBJECTID_1"].astype("Int64"), grp=open_sp["group"].map(GROUP_RU)), out,
            city="muravlenko", city_title="Муравленко", slug="open_spaces", title="Парки, скверы и площадки Муравленко",
            about="Открытые пространства города по рис. 6 статьи и результату 7 отчёта за 2025 год, обследованы в июле 2025 года.",
            fields=[("id", "номер объекта в слое проекта"), *OPEN_FIELDS],
            license_key="cc-by", cite=f"{PUB_MUR}. {GRANT}. {SITE_REF}"),
    }

    mur_classes = sorted(surface["Class"].dropna().unique(), key=list(SURFACE).index)
    manifest["cities"].append({
        "slug": "muravlenko", "title": "Муравленко", "region": "Ямало-Ненецкий автономный округ",
        "center": [74.505, 63.79], "zoom": 12.6, "bounds": bounds_of(border),
        "about": "Карты повторяют рисунки статьи о зелёной инфраструктуре города и отчёта за 2025 год.",
        "source": ART_MUR,
        "groups": [
            {"title": "Обзорная карта", "note": "По рис. 1 статьи", "layers": [
                layer("border", "Граница города", "line", "#14242B", default=True),
                layer("microdistricts", "Микрорайоны", "fill-outline", "#14242B", default=True, label="name",
                      table=table_of("name", "area_ha")),
                layer("roads", "Улицы", "line", "#6B7378", width=2),
                layer("places", "Парки и скверы: названия", "circle", "#C2410C", label="name"),
            ]},
            {"title": "Типы поверхности", "note": "По рис. 4a статьи: снимок WorldView-2, 17.07.2020", "layers": [
                layer("surface", "Классификация типов поверхности", "fill", match_expr("cls", SURFACE),
                      legend=legend_from(mur_classes, SURFACE), popup=["name", "space"], default=True,
                      vector=vt_mur_surface, table=tbl_mur_surface, download=dl_mur_surface),
            ]},
            {"title": "Растительность", "note": "Геоботаническая карта, отчёт 2025, результат 3", "layers": [
                layer("vegetation", "Растительные сообщества", "fill", match_expr("formation", VEGETATION),
                      legend=legend_from(VEGETATION, VEGETATION), popup=["formation", "community", "area_m2"],
                      table=table_of("formation", "community", "area_m2"), download=dl_mur["vegetation"]),
            ]},
            {"title": "Открытые пространства и доступность", "note": "По рис. 6 статьи и результату 7 отчёта", "layers": [
                layer("open_spaces", "Парки, скверы и площадки", "fill",
                      ["match", ["get", "group"], "green", "#2F7D3A", "#C2410C"],
                      legend=[{"label": "Парки и скверы", "color": "#2F7D3A"}, {"label": "Детские и спортивные площадки", "color": "#C2410C"}],
                      popup=["name", "kind"], default=True, table=table_of("num", "name", "kind", "grp", "area_ha", "photos"),
                      download=dl_mur["open_spaces"]),
                layer("access_green", "400 м пешком от парков и скверов", "fill", "#2F7D3A", opacity=0.18,
                      note="Буфер построен для геопортала по методике статьи"),
            ]},
            *([{"title": "Полевые работы 2025", "note": "Точки из полевых дневников и навигатора, июль 2025", "layers": [
                layer("field_points", "Точки описаний", "circle", FIELD_POINTS_STYLE["color"],
                      legend=FIELD_POINTS_STYLE["legend"], popup=["name", "kind", "note"], default=True,
                      table=table_of("name", "kind", "note", "photos", "lon", "lat"),
                      note="У точек с фото по щелчку внизу карты открывается лента снимков"),
            ]}] if (d / "field_points.json").exists() else []),
            {"title": "Застройка и зонирование", "note": "Данные проекта", "layers": [
                layer("buildings", "Жилые дома", "fill", "#8C6F6A", popup=["address", "floors", "apartments", "year", "condition", "type"],
                      table=table_of("address", "floors", "entrances", "apartments", "living_area", "year", "condition", "type")),
                layer("zones", "Функциональные зоны", "fill", match_expr("zone", ZONES),
                      legend=legend_from(ZONES, ZONES), popup=["zone", "area_ha"], opacity=0.55, table=table_of("zone", "area_ha")),
            ]},
        ],
    })

    # ------------------------------------------------------------ Когалым
    print("Когалым")
    d = out / "kogalym"
    border = read(src, "Когалым/ПКК/Границы_Когалым_город.shp")
    border = gpd.GeoDataFrame({"name": ["Граница города"]}, geometry=[border.geometry.union_all()], crs=UTM)
    to_geojson(border, d / "border.json", ["name"], 0.5)
    roads = read(src, "Когалым/Дороги/K_Roads.shp")
    to_geojson(roads, d / "roads.json", ["name"], 0.5)
    green = read(src, "Когалым/Открытые пространства/K_GreenSpace.shp")
    green["kind"] = green["fclass"].map(OPEN_KINDS).fillna("парк")
    green["group"] = "green"
    green["fid"] = None
    sites = read(src, "Когалым/Открытые пространства/K_OpenSpace.shp")
    sites["kind"] = sites["fclass"].map(OPEN_KINDS).fillna(sites["fclass"])
    sites["group"] = np.where(sites["fclass"].isin(["park", "square"]), "green", "sites")
    # номер объекта («playground9») берётся из точечного слоя: по нему же подписаны папки с фото
    pts = gpd.read_file(src / "Когалым/Открытые пространства/K_OpenSpace_p.shp")
    sites["fid"] = sites.index.map(dict(zip(pts["ORIG_FID"].astype(int), pts["fclass"])))
    for part in (green, sites):
        part["osm_id"] = part["osm_id"].map(lambda v: str(int(float(v))) if pd.notna(v) and str(v).strip() else None)
    cols = ["name", "kind", "group", "fid", "osm_id", "geometry"]
    open_sp = gpd.GeoDataFrame(gpd.pd.concat([green[cols], sites[cols]], ignore_index=True), crs=UTM)
    write_open_spaces(open_sp, d, photos.get("kogalym", {}))
    # контуры с osm_id взяты из OpenStreetMap и уточнены: слой распространяется по ODbL
    kog_dl = gpd.GeoDataFrame(gpd.pd.concat([green, sites], ignore_index=True), crs=UTM)
    kog_dl = kog_dl.assign(grp=kog_dl["group"].map(GROUP_RU),
                           osm_id=kog_dl["osm_id"].map(lambda v: str(int(float(v))) if pd.notna(v) and str(v).strip() else None))
    dl_kog = {"open_spaces": export_layer(
        kog_dl, out, city="kogalym", city_title="Когалым", slug="open_spaces", title="Парки, скверы и площадки Когалыма",
        about="Открытые пространства города, обследованные в июле 2026 года; контуры уточнены по снимкам и полевым работам.",
        fields=[*OPEN_FIELDS, ("osm_id", "номер объекта OpenStreetMap, если контур взят оттуда")],
        license_key="odbl", attribution="© участники OpenStreetMap",
        cite=f"{GRANT}, открытые пространства Когалыма, 2026; © участники OpenStreetMap. {SITE_REF}")}
    buildings = read(src, "Когалым/Здания/K_Buildings.shp")
    buildings["address"] = buildings["Street"].fillna("") + " " + buildings["House"].fillna("").astype(str)
    buildings["people"] = buildings["People"].round(0)
    to_geojson(buildings.rename(columns={"Floor": "floors", "Entrance": "entrances", "Apartments": "apartments", "Res_area": "living_area",
                                         "Micro": "micro", "Condition": "condition", "Type_1": "type"}),
               d / "buildings.json", ["address", "micro", "floors", "entrances", "apartments", "living_area", "year", "people",
                                      "condition", "type"], 0.3)
    surface = read(src, "Когалым/Классификация/Kogalym_map_v3_clip.shp")
    # класс «здания» составлен из контуров зданий OpenStreetMap (поле osm_id): слой распространяется по ODbL
    dl_kog["surface"] = export_layer(
        surface.assign(cls=surface["Predicted_"], cls_name=surface["Predicted_"].map(lambda c: SURFACE[c][0] if c in SURFACE else None),
                       osm_id=surface["osm_id"].map(lambda v: str(v).strip() if pd.notna(v) and str(v).strip() else None)), out,
        city="kogalym", city_title="Когалым", slug="surface", title="Типы поверхности Когалыма",
        about="Классификация снимка GeoEye-1 от 08.07.2020 по той же методике, что и для Муравленко; контуры зданий взяты из OpenStreetMap.",
        fields=[("cls", "код класса (латиницей, как в исходной классификации)"), ("cls_name", "класс поверхности"),
                ("osm_id", "номер здания OpenStreetMap (у класса «здания»)")],
        license_key="odbl", attribution="© участники OpenStreetMap",
        cite=f"{GRANT}, типы поверхности Когалыма; © участники OpenStreetMap. {SITE_REF}")
    obj = surface[surface.geometry.notna() & ~surface.geometry.is_empty].reset_index(drop=True)
    obj = obj.assign(oid=np.arange(len(obj)), cls=obj["Predicted_"],
                     name=obj["Predicted_"].map(lambda c: SURFACE[c][0] if c in SURFACE else None),
                     osm_id=obj["osm_id"].map(lambda v: str(v).strip() if pd.notna(v) and str(v).strip() else None),
                     area_m2=obj.geometry.area.round(1))
    vt_kog_surface = surface_tiles(surface, obj, "Predicted_", d, ["oid", "cls", "name"])  # площадь и OSM ID в таблице
    tbl_kog_surface = write_objects(obj.assign(cls_name=obj["name"]), d, "surface",
                                    [["cls_name", "Класс"], ["osm_id", "OSM ID здания"], ["area_m2", "Площадь, м²"]])
    to_geojson(buffer_union(green, 400), d / "access_green.json", ["label"], 1.0)
    # поле Name в этих шейпах обрезано до 4 символов («КЭ_1» вместо «КЭ_12»), имя собирается из id
    vp = read(src, "Когалым/Точки описаний/Vegetation_points.shp").assign(kind="геоботаническое описание")
    ep = read(src, "Когалым/Точки описаний/Ecological_Kogalym.shp").assign(kind="точка экологической напряжённости")
    vp["name"], vp["fid"] = "КВ_" + vp["id"].astype(int).astype(str), "kv" + vp["id"].astype(int).astype(str)
    ep["name"], ep["fid"] = "КЭ_" + ep["id"].astype(int).astype(str), "ke" + ep["id"].astype(int).astype(str)
    cols = ["name", "kind", "fid", "geometry"]
    pts = gpd.GeoDataFrame(gpd.pd.concat([vp[cols], ep[cols]], ignore_index=True), crs=UTM)
    write_field_points(pts, d, photos.get("kogalym", {}))
    ndvi_corners = ndvi_png(src / "Когалым/NDVI/NDVI_Clip.tif", d / "ndvi.png")

    kog_classes = sorted(surface["Predicted_"].dropna().unique(), key=list(SURFACE).index)
    manifest["cities"].append({
        "slug": "kogalym", "title": "Когалым", "region": "Ханты-Мансийский автономный округ (Югра)",
        "center": [74.49, 62.265], "zoom": 12.4, "bounds": bounds_of(border),
        "about": "Слои по той же методике, что и для Муравленко. Статья о зелёной инфраструктуре Когалыма готовится к выходу.",
        "source": "Данные проекта РНФ № 25-27-00022, полевые работы 2026 года",
        "groups": [
            {"title": "Обзорная карта", "note": "Граница, улицы", "layers": [
                layer("border", "Граница города", "line", "#14242B", default=True),
                layer("roads", "Улицы", "line", "#6B7378", width=2),
            ]},
            {"title": "Типы поверхности и NDVI", "note": "Снимок GeoEye-1, 08.07.2020; публикуются только производные", "layers": [
                layer("surface", "Классификация типов поверхности", "fill", match_expr("cls", SURFACE),
                      legend=legend_from(kog_classes, SURFACE), popup=["name"], default=True,
                      vector=vt_kog_surface, table=tbl_kog_surface, download=dl_kog["surface"]),
                {"id": "ndvi", "title": "Вегетационный индекс NDVI", "type": "image", "file": "ndvi.png",
                 "coordinates": ndvi_corners, "opacity": 0.85, "default": False,
                 "legend": [{"label": "0 и ниже: без растительности", "color": "#9E704A"}, {"label": "0,4", "color": "#BDD673"},
                            {"label": "0,8 и выше: густая растительность", "color": "#21542E"}]},
            ]},
            {"title": "Открытые пространства и доступность", "note": "Парки, скверы и площадки, обследованные в 2026 году", "layers": [
                layer("open_spaces", "Парки, скверы и площадки", "fill",
                      ["match", ["get", "group"], "green", "#2F7D3A", "#C2410C"],
                      legend=[{"label": "Парки и скверы", "color": "#2F7D3A"}, {"label": "Детские и спортивные площадки", "color": "#C2410C"}],
                      popup=["name", "kind"], default=True, table=table_of("name", "kind", "grp", "area_ha", "photos", "osm_id"),
                      download=dl_kog["open_spaces"]),
                layer("access_green", "400 м пешком от парков и скверов", "fill", "#2F7D3A", opacity=0.18,
                      note="Буфер построен для геопортала по методике статьи"),
            ]},
            {"title": "Полевые работы 2026", "note": "Точки привязаны по GPS", "layers": [
                layer("field_points", "Точки описаний", "circle", FIELD_POINTS_STYLE["color"],
                      legend=FIELD_POINTS_STYLE["legend"], popup=["name", "kind"], default=True, table=table_of("name", "kind", "photos", "lon", "lat"),
                      note="У точек с фото по щелчку внизу карты открывается лента снимков"),
            ]},
            {"title": "Застройка", "note": "Жилые дома с оценкой числа жителей", "layers": [
                layer("buildings", "Жилые дома", "fill", "#8C6F6A", popup=["address", "floors", "apartments", "people", "year", "condition", "type"],
                      table=table_of("address", "micro", "floors", "entrances", "apartments", "living_area", "people", "year", "condition", "type")),
            ]},
        ],
    })

    # Вкладки: слои статей и (если передан проект housing-yanao) возраст жилого фонда
    housing_props = ["address", "year", "decade", "floors", "apartments", "area", "house_type", "condition", "source", "src"]
    for city in manifest["cities"]:
        tabs = [{"id": "green", "title": "Зелёная инфраструктура", "groups": city.pop("groups")}]
        if housing_root:
            print(f"Жилой фонд: {city['title']}")
            tabs.append(housing_tab(housing_root, city["slug"], out / city["slug"],
                                    lambda g, p: to_geojson(g, p, housing_props, 0)))
        city["tabs"] = tabs
        if (out / city["slug"] / "photos.json").exists():
            city["photos"] = "photos.json"
        if imagery.get(city["slug"]):
            city["imagery"] = imagery_entries(imagery[city["slug"]])

    (out / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=1), encoding="utf-8")
    n = sum(len(g["layers"]) for c in manifest["cities"] for t in c["tabs"] for g in t["groups"])
    print(f"manifest.json: {n} слоёв")


# Снимки проекта (imagery.json из imagery.py): группа в списке выбора и правообладатель по префиксу id
IMAGERY_KINDS = [
    ("uav", "Беспилотник, июль 2025", "Съёмка с беспилотника, проект РНФ № 25-27-00022"),
    ("wv2", "Сверхвысокое разрешение", "© Maxar Technologies"),
    ("ge1", "Сверхвысокое разрешение", "© Maxar Technologies"),
]
# Оговорки о качестве снимка: показываются в панели под выбором синтеза
IMAGERY_NOTES = {
    "uav-2025": "На участке «городок» часть кадров снята сквозь дымку: белёсые пятна скрывают землю. "
                "Это дефект съёмки, а не обработки.",
    "uav-ndvi": "На участке «городок» под пятнами дымки на ортофото NDVI занижен (около нуля), "
                "там значения недостоверны.",
}


def imagery_entries(entries: list[dict]) -> list[dict]:
    """Порядок: беспилотник, сверхвысокое разрешение (новые сцены первыми).
    Продукты вне IMAGERY_KINDS (Sentinel-2, RapidEye из старых запусков imagery.py) в манифест не идут."""
    kinds = {prefix: (group, credit) for prefix, group, credit in IMAGERY_KINDS}
    entries = [e for e in entries if e["id"].split("-")[0] in kinds]

    def key(e: dict) -> tuple:
        prefix = e["id"].split("-")[0]
        m = re.search(r"(\d{4})$", e["id"])
        year = int(m.group(1)) if m else 0
        if prefix == "uav":
            return (0, 0 if e["id"] == "uav-2025" else 1, e["id"])  # ортофото, затем NDVI и модель местности
        if prefix in ("wv2", "ge1"):
            return (1, -year, e["id"])  # сверхвысокое разрешение: новые сцены первыми
        return (2, year, e["id"])

    out = [{**e, "group": kinds[e["id"].split("-")[0]][0], "credit": kinds[e["id"].split("-")[0]][1]} for e in entries]
    for e in out:
        if e["id"] in IMAGERY_NOTES:
            e["note"] = IMAGERY_NOTES[e["id"]]
    return sorted(out, key=key)


def bounds_of(gdf: gpd.GeoDataFrame) -> list[list[float]]:
    minx, miny, maxx, maxy = gdf.to_crs("EPSG:4326").total_bounds
    return [[round(minx, 5), round(miny, 5)], [round(maxx, 5), round(maxy, 5)]]


def layer(lid: str, title: str, kind: str, color, *, default: bool = False, legend: list | None = None,
          popup: list | None = None, label: str | None = None, width: float = 1.5, opacity: float = 0.7,
          note: str = "", download: dict | None = None, table: dict | None = None, vector: list | None = None) -> dict:
    out = {"id": lid, "title": title, "type": kind, "file": f"{lid}.json", "color": color, "default": default,
           "width": width, "opacity": opacity}
    if legend:
        out["legend"] = legend
    if popup:
        out["popup"] = popup
    if label:
        out["label"] = label
    if note:
        out["note"] = note
    if download:
        out["download"] = download
    if table:
        out["table"] = table  # колонки атрибутивной таблицы в геопортале
    if vector:
        out["vector"] = vector  # слой из векторных тайлов вместо GeoJSON: наборы с диапазонами масштабов
    return out


if __name__ == "__main__":
    # необязательные аргументы («-» вместо пропущенного): 3-й корень housing-yanao,
    # 4-й photos-index.json из photos.py, 5-й imagery.json из imagery.py
    arg = lambda i: Path(sys.argv[i]) if len(sys.argv) > i and sys.argv[i] != "-" else None  # noqa: E731
    build(Path(sys.argv[1]), Path(sys.argv[2]), arg(3), arg(4), arg(5))
