"""Вкладка «Жилой фонд» геопортала: возраст домов по реестру ГИС ЖКХ на кадастровых контурах.

Исходники готовит отдельный проект housing-yanao (реестр и карточки ГИС ЖКХ от 23.10.2026,
контуры зданий НСПД, вспомогательные контуры OSM). Отсюда берутся готовые выгрузки:
  <root>/output/...                  Муравленко
  <root>/cities/kogalym/output/...   Когалым
Год постройки и жилая площадь берутся только из ГИС ЖКХ; атрибуты НСПД их не подменяют.
"""
from __future__ import annotations

import csv
import json
import re
from pathlib import Path

import geopandas as gpd

DECADES = [
    ("до 1980", "#5B2A1E"), ("1980-е", "#B5503F"), ("1990-е", "#E08A4B"), ("2000-е", "#E9C46A"),
    ("2010-е", "#8AB17D"), ("2020-е", "#2A7F7A"), ("нет данных", "#C5CCC8"),
]
SOURCES = {
    "nspd_exact": ("НСПД, по кадастровому номеру", "#14242B"),
    "nspd_reviewed": ("НСПД, по адресу и общей площади", "#1F5C7A"),
    "nspd_candidate": ("НСПД, кандидат: совпали адрес, площадь и этажность", "#7B5EA7"),
    "osm": ("OSM, вспомогательный контур по адресу", "#E08A4B"),
}
CITY_DIRS = {"muravlenko": Path("output"), "kogalym": Path("cities/kogalym/output")}


def decade(year) -> str:
    try:
        y = int(float(year))
    except (TypeError, ValueError):
        return "нет данных"
    if y < 1980:
        return "до 1980"
    return f"{min(y // 10 * 10, 2020)}-е"


def short_address(addr: str) -> str:
    """Адрес без индекса, округа и города: «ул Новоселов, д. 1»."""
    m = re.search(r"г\.?\s+(Муравленко|Когалым),\s*(.*)$", addr or "")
    return m.group(2) if m else (addr or "")


def num(value):
    try:
        v = float(value)
    except (TypeError, ValueError):
        return None
    return int(v) if v.is_integer() else round(v, 1)


def props(row: dict, source: str) -> dict:
    year = num(row.get("building_year"))
    return {
        "address": short_address(row.get("address", "")),
        "year": year,
        "decade": decade(year),
        "floors": num(row.get("floors")),
        "apartments": num(row.get("flats")),
        "area": num(row.get("residential_area_m2")),
        "house_type": row.get("house_type") or None,
        "condition": row.get("condition") or None,
        "source": SOURCES[source][0],
        "src": source,
    }


def load_city(root: Path, city: str) -> tuple[gpd.GeoDataFrame, dict]:
    d = root / CITY_DIRS[city]
    stats = json.loads((d / "statistics.json").read_text(encoding="utf-8"))
    frames = []
    matched = gpd.read_file(d / "matched-buildings.geojson")
    matched["src_key"] = matched["method"].map(lambda m: "nspd_exact" if m == "exact_building_cadastre" else "nspd_reviewed")
    frames.append(matched)
    osm_path = d / "osm-additional-housing.geojson"
    if osm_path.exists():
        osm = gpd.read_file(osm_path)
        osm["src_key"] = "osm"
        frames.append(osm)
    # Когалым: 57 пар НСПД, прошедших проверку адреса, общей площади и этажности (review-proposals.json);
    # в проекте housing-yanao они остались кандидатами, здесь показываются с отдельной пометкой
    prop_path = d / "review-proposals.json"
    if prop_path.exists():
        proposals = json.loads(prop_path.read_text(encoding="utf-8"))
        registry = {r["registry_id"]: r for r in csv.DictReader(open(d / "registry.csv", encoding="utf-8-sig"))}
        cand = gpd.read_file(d / "link-candidates.geojson")
        cand = cand[cand["building_id"].astype(str).isin({str(x["nspd_building_id"]) for x in proposals})]
        by_building = {str(x["nspd_building_id"]): x["registry_id"] for x in proposals}
        rows = []
        for _, f in cand.drop_duplicates("building_id").iterrows():
            reg = registry[by_building[str(f["building_id"])]]
            rows.append({**reg, "geometry": f.geometry, "src_key": "nspd_candidate"})
        frames.append(gpd.GeoDataFrame(rows, geometry="geometry", crs=cand.crs))
    out = []
    for fr in frames:
        fr = fr.to_crs("EPSG:4326")
        for _, row in fr.iterrows():
            out.append({**props(row.to_dict(), row["src_key"]), "geometry": row.geometry})
    gdf = gpd.GeoDataFrame(out, geometry="geometry", crs="EPSG:4326")
    return gdf, stats


def chart(stats: dict) -> dict:
    area, count = {}, {}
    for y, a in stats.get("residential_area_by_year", {}).items():
        area[decade(y)] = area.get(decade(y), 0) + float(a)
    for y, n in stats.get("building_years", {}).items():
        count[decade(y)] = count.get(decade(y), 0) + int(n)
    bars = []
    for label, color in DECADES[:-1]:
        bars.append({"label": label, "value": round(area.get(label, 0) / 1000, 1), "count": count.get(label, 0), "color": color})
    no_year = stats["active"] - stats.get("active_with_year", 0)
    k = lambda m2: f"{m2 / 1000:.1f}".replace(".", ",")  # noqa: E731
    return {
        "title": "Когда строился город",
        "unit": "тыс. м² жилой площади",
        "bars": bars,
        "note": (f"Жилая площадь домов действующего реестра по десятилетиям постройки, всего "
                 f"{k(stats['construction_area_m2'])} тыс. м². Домов без года постройки: {no_year}, "
                 f"их известная площадь {k(stats['area_without_year_m2'])} тыс. м²."),
    }


def fmt_int(n: int) -> str:
    return f"{n:,}".replace(",", " ")


def housing_tab(root: Path, city: str, out_dir: Path, write_geojson) -> dict:
    gdf, stats = load_city(root, city)
    write_geojson(gdf, out_dir / "housing.json")
    by_src = gdf["src"].value_counts().to_dict()
    decade_expr = ["match", ["get", "decade"]]
    for label, color in DECADES:
        decade_expr += [label, color]
    decade_expr.append("#C5CCC8")
    src_expr = ["match", ["get", "src"]]
    for key, (_, color) in SOURCES.items():
        src_expr += [key, color]
    src_expr.append("#999999")
    popup = ["address", "year", "floors", "apartments", "area", "house_type", "condition", "source"]
    facts = [
        {"value": fmt_int(stats["active"]), "label": "действующих жилых домов в реестре ГИС ЖКХ"},
        {"value": fmt_int(len(gdf)), "label": "домов на карте с контуром здания"},
        {"value": fmt_int(stats["active_types"].get("Многоквартирный", 0)), "label": "многоквартирных домов"},
        {"value": f"{stats['residential_area_total_m2'] / 1000:.0f} тыс. м²", "label": "известной жилой площади"},
    ]
    legend_src = [{"label": f"{SOURCES[k][0]}: {by_src[k]}", "color": SOURCES[k][1]} for k in SOURCES if k in by_src]
    return {
        "id": "housing",
        "title": "Жилой фонд",
        "about": ("Возраст жилых домов по реестру ГИС ЖКХ. Цвет показывает десятилетие постройки, по щелчку видны адрес, "
                  "этажность, квартиры и жилая площадь."),
        "source": "ГИС ЖКХ (реестр и карточки домов на 23.10.2026), кадастровые контуры зданий НСПД, вспомогательные контуры OSM",
        "facts": facts,
        "chart": chart(stats),
        "groups": [
            {"title": "Возраст домов", "note": "Год постройки по карточкам ГИС ЖКХ", "layers": [
                {"id": "housing", "title": "Жилые дома по десятилетию постройки", "type": "fill", "file": "housing.json",
                 "color": decade_expr, "default": True, "width": 1, "opacity": 0.85, "popup": popup,
                 "filter": "decade", "legend": [{"label": l, "color": c} for l, c in DECADES],
                 "table": ["address", "year", "decade", "floors", "apartments", "area", "house_type", "condition", "source"]},
            ]},
            {"title": "Источник контура", "note": "Как дом из реестра связан с контуром здания", "layers": [
                {"id": "housing_src", "title": "Дома по источнику контура", "type": "fill", "file": "housing.json",
                 "color": src_expr, "default": False, "width": 1, "opacity": 0.7, "popup": popup, "legend": legend_src},
            ]},
        ],
    }
