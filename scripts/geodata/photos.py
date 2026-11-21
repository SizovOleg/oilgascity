"""Фото площадок, парков и скверов для геопортала.

Сопоставление (владелец: «фото подписаны и сопоставляются по точкам и папкам»):
  Когалым: папки playgroundNN, pitchNN, parkNN, squareNN (в одной папке может быть несколько номеров:
           «playground09,10,11_pitch13») -> точки K_OpenSpace_p с fclass «playground9» -> ORIG_FID ->
           контур K_OpenSpace.
  Муравленко, площадки: папки «41 (1541)» -> путевая точка 1541 из GPX июля 2025 года -> ближайшая
           площадка M_OpenSpace в пределах 60 м. Таблица инвентаризации даёт описание.
  Муравленко, парки: названия папок сопоставлены с названиями скверов в M_OpenSpace вручную (PARKS).

Кадры пишутся в WebP (полный 1600 px q75, около 220 КБ; миниатюра 360 px q72, около 12 КБ).
Снимки с различимыми людьми не публикуются: детектор Faster R-CNN (torchvision, класс «человек»)
отсеивает кадр, если на нём есть человек выше 7% высоты кадра с уверенностью от 0,55. Отсеянные
перечисляются в excluded.csv для просмотра. Выходные снимки без EXIF (в том числе без GPS).

Запуск:
  OGC_DISK_DIR=... OGC_GPX_DIR=... python scripts/geodata/photos.py <папка вывода>
Повторный запуск пропускает уже обработанные кадры.
"""
from __future__ import annotations

import csv
import json
import os
import re
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

import geopandas as gpd
import openpyxl
import torch
import torchvision
from PIL import Image, ImageOps
from shapely.geometry import Point

# Корни исходников задаются окружением: репозиторий публичный, локальные пути владельца в нём не хранятся.
#   OGC_DISK_DIR  корень диска с папками проекта («РНФ 2025_2026 Города», «РНФ 2025_2026 Города_фото»)
#   OGC_GPX_DIR   папка с треками навигатора (GPX за июль 2025 года)
DISK = Path(os.environ.get("OGC_DISK_DIR", "data/disk"))
LAYERS = DISK / "РНФ 2025_2026 Города" / "Слои городов"
KOG_PHOTOS = DISK / "РНФ 2025_2026 Города_фото" / "2026 Когалым"
MUR_PLAY = DISK / "РНФ 2025_2026 Города" / "Муравленко_Фото 2025" / "Муравленко_Детские площадки_2025"
MUR_PLAY_XLSX = MUR_PLAY / "Детские площадки_Муравленко.xlsx"
MUR_PARKS = DISK / "РНФ 2025_2026 Города_фото" / "2025 Муравленко" / "Парки, скверы"
GPX_DIR = Path(os.environ.get("OGC_GPX_DIR", "data/gpx"))
KOG_POINTS = LAYERS / "Когалым" / "Точки описаний"
MUR_VEG = DISK / "РНФ 2025_2026 Города" / "Муравленко_Фото 2025" / "Муравленко_растительность_2025"
MUR_VEG_XLSX = MUR_VEG / "Геоботаническое описание_Муравленко.xlsx"
MUR_ECO = DISK / "РНФ 2025_2026 Города" / "Муравленко_Фото 2025" / "Муравленко_экологическая напряженность_2025"
MUR_ECO_XLSX = MUR_ECO / "Точки экологической напряженности_Муравленко.xlsx"
KIND_VEG, KIND_ECO = "геоботаническое описание", "точка экологической напряжённости"
UTM = "EPSG:32643"
URL_BASE = "/oilgascity-media/geoportal/photos"

# Папка парка Муравленко -> название в M_OpenSpace (только однозначные совпадения)
PARKS = {
    "Аллея Зотова": "Аллея им. Ю.С. Зотова", "Лесная аллея": "Лесная аллея", "Победы": "Сквер Победы",
    "Парковый бульвар": "Парковый бульвар", "Дружбы народов": "Сквер Дружбы (народов)", "Здоровья": "Сквер Здоровья",
    "Лазурный": "Сквер Лазурный", "Юбилейный": "Сквер Юбилейный", "Ямальский": "Сквер Ямальский",
    "Салманова": "Сквер им. Фармана Салманова", "Аллея лицеистов": "Аллея лицеистов",
}
KINDS = {"playground": "Детская площадка", "pitch": "Спортивная площадка", "park": "Парк", "square": "Сквер",
         "stadium": "Стадион"}
FULL_PX, THUMB_PX = 1600, 360
PERSON_SCORE, PERSON_HEIGHT = 0.55, 0.07


def slug(text: str) -> str:
    table = str.maketrans("абвгдеёжзийклмнопрстуфхцчшщъыьэюя", "abvgdeejziiklmnoprstufhccss_y_eua")
    return re.sub(r"[^a-z0-9]+", "-", text.lower().translate(table)).strip("-")


# ------------------------------------------------------------------ объекты и папки

def kogalym_groups() -> dict[str, dict]:
    """fid («playground9») -> {title, folders}. Номер берётся из имени папки."""
    pts = gpd.read_file(LAYERS / "Когалым/Открытые пространства/K_OpenSpace_p.shp")
    known = set(pts["fclass"])
    groups: dict[str, dict] = {}
    for folder in sorted(p for p in KOG_PHOTOS.iterdir() if p.is_dir()):
        tokens = []
        for kind, nums in re.findall(r"(playground|pitch|park|square|stadium)\s*([\d,]+)", folder.name.lower()):
            tokens += [f"{kind}{int(n)}" for n in nums.split(",") if n.strip().isdigit()]
        for fid in tokens:
            if fid not in known:
                continue
            kind, n = re.match(r"([a-z]+)(\d+)", fid).groups()
            g = groups.setdefault(fid, {"title": f"{KINDS.get(kind, kind)} {n}", "folders": [], "date": "июль 2026"})
            g["folders"].append(folder)
    return groups


def gpx_points() -> dict[str, Point]:
    out = {}
    for f in GPX_DIR.glob("*-JUL-25.gpx"):
        # у части файлов навигатора после </gpx> остаётся мусор: разбирается только сам документ
        text = f.read_text(encoding="utf-8", errors="replace")
        end = text.find("</gpx>")
        try:
            root = ET.fromstring(text[: end + len("</gpx>")] if end >= 0 else text)
        except ET.ParseError as exc:
            print(f"  GPX {f.name} не разобран ({exc}), его точки пропущены")
            continue
        for wpt in root.iter():
            if wpt.tag.endswith("wpt"):
                name = next((c.text for c in wpt if c.tag.endswith("name")), None)
                if name:
                    out[name.strip()] = Point(float(wpt.get("lon")), float(wpt.get("lat")))
    return out


def muravlenko_groups() -> tuple[dict[str, dict], gpd.GeoDataFrame]:
    sp = gpd.read_file(LAYERS / "Муравленко/Вектор/M_OpenSpace.shp").to_crs(UTM)
    # описание площадок из таблицы инвентаризации: номер в дневнике «41 (1541)» -> особенности
    notes = {}
    wb = openpyxl.load_workbook(MUR_PLAY_XLSX, read_only=True, data_only=True)
    for row in wb.worksheets[0].iter_rows(values_only=True):
        if row and row[3] and re.match(r"\d+\s*\(\d+\)", str(row[3])):
            notes[str(row[3]).strip()] = (str(row[10] or "").strip(" -"), str(row[9] or "").strip())
    wpts = {k: v for k, v in gpx_points().items()}
    wgs = gpd.GeoSeries(list(wpts.values()), index=list(wpts.keys()), crs="EPSG:4326").to_crs(UTM)
    plays = sp[sp["fclass"].isin(["playground", "pitch"])]
    groups: dict[str, dict] = {}
    for folder in sorted(p for p in MUR_PLAY.iterdir() if p.is_dir()):
        m = re.match(r"(\d+)\s*\((\d+)\)", folder.name)
        if not m or m.group(2) not in wgs.index:
            print(f"  нет точки для папки {folder.name}")
            continue
        pt = wgs[m.group(2)]
        dist = plays.geometry.distance(pt)
        if dist.min() > 60:
            print(f"  папка {folder.name}: ближайшая площадка в {dist.min():.0f} м, пропуск")
            continue
        oid = int(plays.loc[dist.idxmin(), "OBJECTID_1"])
        note, kids = notes.get(folder.name, ("", ""))
        # в подписи номер площадки по полевому дневнику (первое число имени папки), а не номер путевой точки
        g = groups.setdefault(f"m{oid}", {"title": f"Детская площадка № {m.group(1)}", "folders": [],
                                          "date": "июль 2025", "note": note})
        g["folders"].append(folder)
    for folder_name, park_name in PARKS.items():
        folder = MUR_PARKS / folder_name
        if folder.is_dir() and (sp["Name_1"] == park_name).any():
            groups[f"m-{slug(park_name)}"] = {"title": park_name, "folders": [folder], "date": "июль 2025"}
    return groups, sp


# ------------------------------------------------------------------ точки полевых описаний

def kogalym_point_groups() -> dict[str, dict]:
    """Папки «КЭ_08,09,10 1572», «КВ_21 t14» -> точки КЭ_n и КВ_n слоя «Точки описаний» (ключ ke8, kv21)."""
    known = {"КЭ": set(gpd.read_file(KOG_POINTS / "Ecological_Kogalym.shp")["id"].astype(int)),
             "КВ": set(gpd.read_file(KOG_POINTS / "Vegetation_points.shp")["id"].astype(int))}
    groups: dict[str, dict] = {}
    for folder in sorted(p for p in KOG_PHOTOS.iterdir() if p.is_dir()):
        for code, nums in re.findall(r"(КЭ|КВ)_([\d,]+)", folder.name):
            for n in (int(x) for x in nums.split(",") if x.strip().isdigit()):
                if n not in known[code]:
                    print(f"  папка {folder.name}: точки {code}_{n} нет в слое")
                    continue
                kind = KIND_ECO if code == "КЭ" else KIND_VEG
                g = groups.setdefault(("ke" if code == "КЭ" else "kv") + str(n),
                                      {"title": f"{kind.capitalize()} {code}_{n}", "folders": [], "date": "июль 2026"})
                g["folders"].append(folder)
    return groups


def dms_pair(text: str) -> tuple[float | None, float | None]:
    """Широта и долгота из записи таблицы: «N 63°48‘04,8" E 74°32‘30,3"» или «74°31'30,719"E 63°48'13,302"N».
    Ось определяется по значению: в районе работ широта около 63-64°, долгота около 74-75°."""
    lat = lon = None
    for d, m, s in re.findall(r"(\d+)°\s*(\d+)\s*[‘'’′]\s*(\d+(?:[.,]\d+)?)", text):
        v = int(d) + int(m) / 60 + float(s.replace(",", ".")) / 3600
        if v < 70:
            lat = v
        else:
            lon = v
    return lat, lon


def muravlenko_veg_table() -> dict[int, dict]:
    """Номер в полевом дневнике -> номер на карте, координаты, виды по ярусам (строки без номера относятся к описанию выше)."""
    out: dict[int, dict] = {}
    cur = None
    wb = openpyxl.load_workbook(MUR_VEG_XLSX, read_only=True, data_only=True)
    for r in wb.worksheets[0].iter_rows(values_only=True):
        mapno = str(r[1]).strip() if r and len(r) > 5 and r[1] is not None else ""
        if mapno.isdigit():
            diary = int(re.match(r"\d+", str(r[2]).strip()).group())
            lat, lon = dms_pair(str(r[3] or ""))
            cur = out[diary] = {"map": int(mapno), "lat": lat, "lon": lon, "tiers": {}}
        if cur is not None and r and len(r) > 5 and r[5]:
            tier = str(r[4] or "").strip() or (list(cur["tiers"])[-1] if cur["tiers"] else "")
            cur["tiers"].setdefault(tier, []).append(str(r[5]).strip())
    return out


def veg_note(rec: dict) -> str:
    # вид может повторяться в ярусе (древостой и подрост в таблице отдельными строками): в подписи один раз
    parts = [f"{tier}{' ярус' if tier.lower().startswith('древесн') else ''}: {', '.join(dict.fromkeys(sp))}"
             for tier, sp in rec["tiers"].items() if tier]
    return ". ".join(parts) + ("." if parts else "")


def muravlenko_eco_table() -> dict[str, tuple[str, str]]:
    """Путевая точка навигатора -> (номер на карте, характеристика)."""
    out = {}
    wb = openpyxl.load_workbook(MUR_ECO_XLSX, read_only=True, data_only=True)
    for r in wb.worksheets[0].iter_rows(values_only=True):
        if r and len(r) > 3 and r[1] is not None and str(r[1]).strip()[:1].isdigit():
            for wp in re.findall(r"\d{4}", str(r[2] or ""))[:1]:
                out[wp] = (str(r[1]).strip(), " ".join(str(r[3] or "").split()))
    return out


def muravlenko_point_groups() -> tuple[dict[str, dict], dict]:
    """Папки геоботаники «A (B)» (A номер на карте, B номер в дневнике) и напряжённости «N (WP)».
    Возвращает группы фото и слой точек (GeoJSON, WGS 84) для геопортала: в слоях города таких точек нет."""
    veg, eco, wpts = muravlenko_veg_table(), muravlenko_eco_table(), gpx_points()
    groups: dict[str, dict] = {}
    feats: dict[str, dict] = {}
    for diary, rec in sorted(veg.items()):
        if rec["lat"] is None or rec["lon"] is None:
            print(f"  описание {diary}: координаты не разобраны")
            continue
        feats[f"mv{diary}"] = {"type": "Feature", "geometry": {"type": "Point", "coordinates": [round(rec["lon"], 6), round(rec["lat"], 6)]},
                               "properties": {"name": f"Геоботаническое описание № {diary}", "kind": KIND_VEG,
                                              "note": veg_note(rec), "fid": f"mv{diary}"}}
    for folder in sorted(p for p in MUR_VEG.iterdir() if p.is_dir()):
        m = re.match(r"(\d+)\s*\((\d+)\)", folder.name)
        fid = f"mv{m.group(2)}" if m else None
        if fid not in feats:
            print(f"  папка геоботаники {folder.name}: описания нет в таблице, пропуск")
            continue
        p = feats[fid]["properties"]
        groups.setdefault(fid, {"title": p["name"], "folders": [], "date": "июль 2025", "note": p["note"]})["folders"].append(folder)
    for folder in sorted(p for p in MUR_ECO.iterdir() if p.is_dir()):
        wps = re.findall(r"\d{4}", folder.name)
        if not wps or wps[0] not in wpts:
            print(f"  папка напряжённости {folder.name}: нет путевой точки, пропуск")
            continue
        wp = wps[0]
        mapno, text = eco.get(wp, ("", ""))
        fid = f"me{wp}"
        if fid not in feats:
            pt = wpts[wp]
            feats[fid] = {"type": "Feature", "geometry": {"type": "Point", "coordinates": [round(pt.x, 6), round(pt.y, 6)]},
                          "properties": {"name": f"Точка экологической напряжённости{f' № {mapno}' if mapno else ''}",
                                         "kind": KIND_ECO, "note": text, "fid": fid}}
        p = feats[fid]["properties"]
        groups.setdefault(fid, {"title": p["name"], "folders": [], "date": "июль 2025", "note": p["note"]})["folders"].append(folder)
    return groups, {"type": "FeatureCollection", "features": list(feats.values())}


# ------------------------------------------------------------------ детектор людей

class LazyDetector:
    """Детектор создаётся при первом новом кадре: пересборка без новых фото не грузит модель (около 1 ГБ памяти)."""

    def __init__(self) -> None:
        self._det: PersonDetector | None = None

    def tallest_person(self, im: Image.Image) -> float:
        if self._det is None:
            self._det = PersonDetector()
        return self._det.tallest_person(im)


class PersonDetector:
    def __init__(self) -> None:
        weights = torchvision.models.detection.FasterRCNN_ResNet50_FPN_V2_Weights.DEFAULT
        self.model = torchvision.models.detection.fasterrcnn_resnet50_fpn_v2(weights=weights).eval()
        self.dev = "cuda" if torch.cuda.is_available() else "cpu"
        self.model.to(self.dev)
        self.tf = weights.transforms()

    @torch.no_grad()
    def tallest_person(self, im: Image.Image) -> float:
        """Высота самого крупного уверенно найденного человека в долях высоты кадра (0, если нет)."""
        small = im.copy()
        small.thumbnail((1024, 1024))
        out = self.model([self.tf(small).to(self.dev)])[0]
        best = 0.0
        for box, label, score in zip(out["boxes"], out["labels"], out["scores"]):
            if int(label) == 1 and float(score) >= PERSON_SCORE:
                best = max(best, float(box[3] - box[1]) / small.height)
        return best


# ------------------------------------------------------------------ обработка

def prior_excluded(out: Path) -> dict[tuple[str, str, str], str]:
    """Решения фильтра людей прошлых запусков: (город, объект, имя файла) -> доля кадра.
    Пересчёт из уменьшенной копии на границе порога может ответить иначе, поэтому отсеянный однажды
    кадр отсеивается и дальше без детектора. Пути в файле бывают виндовыми, имя берётся после последнего слеша."""
    path = out / "excluded.csv"
    if not path.exists():
        return {}
    with open(path, newline="", encoding="utf-8-sig") as fh:
        rows = list(csv.reader(fh))[1:]
    return {(r[0], r[1], re.split(r"[\\/]", r[2])[-1]): r[3] for r in rows if len(r) >= 4}


def process(city: str, groups: dict[str, dict], det: LazyDetector, out: Path, excluded: list,
            prior: dict[tuple[str, str, str], str]) -> dict:
    index = {}
    for fid, g in groups.items():
        items = []
        files = sorted({f for folder in g["folders"] for f in folder.iterdir()
                        if f.suffix.lower() in (".jpg", ".jpeg")})
        for i, f in enumerate(files, 1):
            dst = out / city / fid
            name = f"{i:03d}"
            if (dst / f"{name}.webp").exists() and (dst / f"{name}_t.webp").exists():
                # уже обработан при прошлом запуске (номер снимка зависит только от отсортированного списка файлов)
                with Image.open(dst / f"{name}.webp") as done:
                    w, h = done.size
                items.append({"t": f"{URL_BASE}/{city}/{fid}/{name}_t.webp", "f": f"{URL_BASE}/{city}/{fid}/{name}.webp",
                              "w": w, "h": h})
                continue
            if (city, fid, f.name) in prior:
                excluded.append([city, fid, str(f), prior[(city, fid, f.name)]])
                continue
            try:
                im = ImageOps.exif_transpose(Image.open(f)).convert("RGB")
            except Exception as exc:  # битый файл не должен останавливать весь конвейер
                print(f"  пропуск {f.name}: {exc}")
                continue
            h = det.tallest_person(im)
            if h >= PERSON_HEIGHT:
                excluded.append([city, fid, str(f), f"{h:.2f}"])
                continue
            dst.mkdir(parents=True, exist_ok=True)
            full = im.copy()
            full.thumbnail((FULL_PX, FULL_PX))
            full.save(dst / f"{name}.webp", "WEBP", quality=75, method=6)
            thumb = im.copy()
            thumb.thumbnail((THUMB_PX, THUMB_PX))
            thumb.save(dst / f"{name}_t.webp", "WEBP", quality=72, method=6)
            items.append({"t": f"{URL_BASE}/{city}/{fid}/{name}_t.webp", "f": f"{URL_BASE}/{city}/{fid}/{name}.webp",
                          "w": full.width, "h": full.height})
        if items:
            index[fid] = {"title": g["title"], "date": g["date"], "note": g.get("note", ""), "items": items}
        print(f"  {city}/{fid}: {len(items)} из {len(files)}")
    return index


def main(out: Path) -> None:
    # сначала сопоставление обоих городов: ошибка в исходниках видна до долгой обработки снимков
    kog = kogalym_groups()
    kog_pts = kogalym_point_groups()
    print(f"Когалым: {len(kog)} объектов и {len(kog_pts)} точек описаний с папками")
    kog.update(kog_pts)
    mur, _ = muravlenko_groups()
    mur_pts, mur_layer = muravlenko_point_groups()
    print(f"Муравленко: {len(mur)} объектов и {len(mur_pts)} точек описаний с папками, в слое точек {len(mur_layer['features'])}")
    mur.update(mur_pts)
    det = LazyDetector()
    excluded: list = []
    prior = prior_excluded(out)
    print(f"Прежних решений фильтра людей: {len(prior)}")
    result = {"kogalym": process("kogalym", kog, det, out, excluded, prior),
              "muravlenko": process("muravlenko", mur, det, out, excluded, prior),
              # слой точек описаний Муравленко (в слоях города его нет): build_geodata.py кладёт его в геопортал
              "_points": {"muravlenko": mur_layer}}
    (out / "photos-index.json").write_text(json.dumps(result, ensure_ascii=False, indent=1), encoding="utf-8")
    with open(out / "excluded.csv", "w", newline="", encoding="utf-8-sig") as fh:
        w = csv.writer(fh)
        w.writerow(["город", "объект", "файл", "рост человека, доля кадра"])
        w.writerows(excluded)
    n = sum(len(g["items"]) for city, c in result.items() if not city.startswith("_") for g in c.values())
    print(f"ГОТОВО: {n} снимков, отсеяно с людьми: {len(excluded)}")


if __name__ == "__main__":
    main(Path(sys.argv[1]))
