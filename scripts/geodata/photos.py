"""Фото площадок, парков и скверов для геопортала.

Сопоставление (владелец: «фото подписаны и сопоставляются по точкам и папкам»):
  Когалым: папки playgroundNN, pitchNN, parkNN, squareNN (в одной папке может быть несколько номеров:
           «playground09,10,11_pitch13») -> точки K_OpenSpace_p с fclass «playground9» -> ORIG_FID ->
           контур K_OpenSpace.
  Муравленко, площадки: папки «41 (1541)» -> путевая точка 1541 из GPX июля 2025 года -> ближайшая
           площадка M_OpenSpace в пределах 60 м. Таблица инвентаризации даёт описание.
  Муравленко, парки: названия папок сопоставлены с названиями скверов в M_OpenSpace вручную (PARKS).

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


# ------------------------------------------------------------------ детектор людей

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

def process(city: str, groups: dict[str, dict], det: PersonDetector, out: Path, excluded: list) -> dict:
    index = {}
    for fid, g in groups.items():
        items = []
        files = sorted({f for folder in g["folders"] for f in folder.iterdir()
                        if f.suffix.lower() in (".jpg", ".jpeg")})
        for i, f in enumerate(files, 1):
            dst = out / city / fid
            name = f"{i:03d}"
            if (dst / f"{name}.jpg").exists() and (dst / f"{name}_t.jpg").exists():
                # уже обработан при прошлом запуске (номер снимка зависит только от отсортированного списка файлов)
                with Image.open(dst / f"{name}.jpg") as done:
                    w, h = done.size
                items.append({"t": f"{URL_BASE}/{city}/{fid}/{name}_t.jpg", "f": f"{URL_BASE}/{city}/{fid}/{name}.jpg",
                              "w": w, "h": h})
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
            full.save(dst / f"{name}.jpg", quality=80, optimize=True, progressive=True)
            thumb = im.copy()
            thumb.thumbnail((THUMB_PX, THUMB_PX))
            thumb.save(dst / f"{name}_t.jpg", quality=72, optimize=True)
            items.append({"t": f"{URL_BASE}/{city}/{fid}/{name}_t.jpg", "f": f"{URL_BASE}/{city}/{fid}/{name}.jpg",
                          "w": full.width, "h": full.height})
        if items:
            index[fid] = {"title": g["title"], "date": g["date"], "note": g.get("note", ""), "items": items}
        print(f"  {city}/{fid}: {len(items)} из {len(files)}")
    return index


def main(out: Path) -> None:
    # сначала сопоставление обоих городов: ошибка в исходниках видна до долгой обработки снимков
    kog = kogalym_groups()
    print(f"Когалым: {len(kog)} объектов с папками")
    mur, _ = muravlenko_groups()
    print(f"Муравленко: {len(mur)} объектов с папками")
    det = PersonDetector()
    excluded: list = []
    result = {"kogalym": process("kogalym", kog, det, out, excluded),
              "muravlenko": process("muravlenko", mur, det, out, excluded)}
    (out / "photos-index.json").write_text(json.dumps(result, ensure_ascii=False, indent=1), encoding="utf-8")
    with open(out / "excluded.csv", "w", newline="", encoding="utf-8-sig") as fh:
        w = csv.writer(fh)
        w.writerow(["город", "объект", "файл", "рост человека, доля кадра"])
        w.writerows(excluded)
    n = sum(len(g["items"]) for c in result.values() for g in c.values())
    print(f"ГОТОВО: {n} снимков, отсеяно с людьми: {len(excluded)}")


if __name__ == "__main__":
    main(Path(sys.argv[1]))
