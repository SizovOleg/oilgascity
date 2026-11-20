"""Снимки для геопортала: цветовые синтезы спутниковых сцен и продуктов съёмки с беспилотника.

Каждый синтез нарезается в тайлы web mercator (WebP с прозрачностью) в папку
  <вывод>/rasters/<город>/<продукт>/<синтез>/<z>/<x>/<y>.webp
и описывается в <вывод>/imagery.json (его читает build_geodata.py и кладёт в манифест).
Сцены без обзоров сначала переводятся в облачный GeoTIFF (rio-cogeo) в рабочую папку,
исходные файлы не меняются. Контраст: 2-98 процентили каждого канала по уменьшенной копии.

Владелец 20.11.2026 разрешил выкладывать коммерческие сцены (WorldView-2, GeoEye-1)
и сам отвечает за условия их лицензий. Sentinel-2 и RapidEye он счёл малоинформативными: не выкладываются.

Запуск (пути к исходникам в переменных окружения, см. ниже):
  python scripts/geodata/imagery.py <вывод> [город/продукт ...] [--force]
"""
from __future__ import annotations

import json
import math
import os
import sys
import warnings
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path

import mercantile
import numpy as np
import rasterio
from rio_cogeo.cogeo import cog_translate
from rio_cogeo.profiles import cog_profiles
from rio_tiler.colormap import cmap
from rio_tiler.errors import TileOutsideBounds
from rio_tiler.io import Reader
from rio_tiler.mosaic import mosaic_reader
from rio_tiler.utils import render

warnings.filterwarnings("ignore")

# Корни исходников задаются окружением: репозиторий публичный, локальные пути владельца в нём не хранятся.
#   OGC_RS_DIR    папка проекта с «Дистанционные данные Муравленко» и «Дистанционные данные Когалым»
#   OGC_UAV_DIR   папка результатов съёмки с беспилотника (ортофото, NDVI, ЦММ)
#   OGC_WORK_DIR  рабочая папка для облачных копий GeoTIFF (несколько ГБ)
DISK = Path(os.environ.get("OGC_RS_DIR", "data/rs"))
MUR = DISK / "Дистанционные данные Муравленко"
KOG = DISK / "Дистанционные данные Когалым"
UAV = Path(os.environ.get("OGC_UAV_DIR", "data/uav"))
WORK = Path(os.environ.get("OGC_WORK_DIR", "work/cog"))

RGB4 = [("natural", "Естественные цвета", (3, 2, 1)), ("false", "Ложные цвета: ближний ИК", (4, 3, 2))]
RGB5 = [("natural", "Естественные цвета", (3, 2, 1)), ("false", "Ложные цвета: ближний ИК", (5, 3, 2)),
        ("rededge", "Красный край", (4, 3, 2))]
# Sentinel-2 не выкладывается: владелец 20.11.2026 счёл его разрешение бесполезным для городских объектов

DG_M = MUR / "DG"
DG_K = KOG / "DG"
PRODUCTS = {
    "muravlenko": [
        {"id": "wv2-2020", "title": "WorldView-2, 17.07.2020", "res": "0,5 м", "files": [
            DG_M / "Clip_Pansharp_WV02_20200717065809_10300100AA0FC700_20JUL17065809-M1BS-507196235100_01_P001_u16rf32643_4bands1.tif"],
         "cog": True, "nodata": 0, "composites": RGB4, "zoom": (12, 17)},
        {"id": "ge1-2017", "title": "GeoEye-1, 11.07.2017", "res": "1,6 м", "files": sorted(DG_M.glob("GE01_20170711*M1BS*.tif")),
         "cog": True, "nodata": 65535, "composites": RGB4, "zoom": (12, 16)},
        {"id": "uav-2025", "title": "Беспилотник, июль 2025: ортофото", "res": "около 0,3 м", "files": sorted(UAV.glob("*рто*мульти.tif")),
         "cog": True, "nodata": 65535, "composites": RGB5, "zoom": (13, 18)},  # «нет данных» у ортофото: 65535
        {"id": "uav-ndvi", "title": "Беспилотник, июль 2025: NDVI", "res": "около 0,3 м", "files": sorted(UAV.glob("*NDVI*.tif")),
         "cog": True, "nodata": None, "kind": "ndvi", "zoom": (13, 18)},
        {"id": "uav-dsm", "title": "Беспилотник, июль 2025: цифровая модель местности", "res": "около 1 м",
         "files": sorted(p for p in UAV.glob("*.tif") if "цмм" in p.name.lower() or "ЦММ" in p.name), "cog": True,
         "nodata": None, "kind": "dem", "zoom": (13, 17)},
    ],
    "kogalym": [
        {"id": "ge1-2021", "title": "GeoEye-1, 12.08.2021", "res": "1,6 м", "files": sorted(DG_K.glob("GE01_20210812*M1BS*.tif")),
         "cog": True, "nodata": 65535, "composites": RGB4, "zoom": (12, 16)},
        {"id": "ge1-2020", "title": "GeoEye-1, 08.07.2020", "res": "1,8 м", "files": sorted(DG_K.glob("GE01_20200708*M1BS*.tif")),
         "cog": True, "nodata": 65535, "composites": RGB4, "zoom": (12, 16)},
    ],
}


# ------------------------------------------------------------------ подготовка

def to_cog(src: Path, nodata) -> Path:
    dst = WORK / f"{src.stem}.nd{nodata}.cog.tif"  # признак «нет данных» в имени: копия с другим значением не подхватится
    if dst.exists():
        return dst
    WORK.mkdir(parents=True, exist_ok=True)
    profile = cog_profiles.get("deflate")
    profile.update(BIGTIFF="IF_SAFER", predictor=2)
    cog_translate(str(src), str(dst), profile, nodata=nodata, overview_resampling="average",
                  config={"GDAL_NUM_THREADS": "ALL_CPUS", "GDAL_TIFF_INTERNAL_MASK": True}, quiet=True)
    print(f"  COG: {dst.name} {dst.stat().st_size / 1e9:.2f} ГБ")
    return dst


def stretch(files: list[Path], nodata) -> list[tuple[float, float]]:
    """2-98 процентили каждого канала по уменьшенной копии всех файлов."""
    samples: list[list[np.ndarray]] = []
    for f in files:
        with rasterio.open(f) as r:
            sc = max(1, max(r.width, r.height) // 1500)
            a = r.read(out_shape=(r.count, max(1, r.height // sc), max(1, r.width // sc)), masked=True).astype("float64")
            bad = np.ma.getmaskarray(a).any(0) | ~np.isfinite(a.filled(np.nan)).all(0)
            if nodata is not None:
                bad |= (a.filled(nodata) == nodata).any(0)
            bad |= (a.filled(0) == 0).all(0)
            for i in range(r.count):
                if len(samples) <= i:
                    samples.append([])
                samples[i].append(a[i].filled(np.nan)[~bad])
    out = []
    for vals in samples:
        v = np.concatenate(vals)
        v = v[np.isfinite(v)]
        out.append((float(np.percentile(v, 2)), float(np.percentile(v, 98))) if v.size else (0.0, 1.0))
    return out


def bounds_4326(files: list[Path]) -> list[float]:
    from rasterio.warp import transform_bounds
    bb = [180.0, 90.0, -180.0, -90.0]
    for f in files:
        with rasterio.open(f) as r:
            b = transform_bounds(r.crs, "EPSG:4326", *r.bounds)
        bb = [min(bb[0], b[0]), min(bb[1], b[1]), max(bb[2], b[2]), max(bb[3], b[3])]
    return [round(x, 6) for x in bb]


# ------------------------------------------------------------------ тайлы

def hillshade(z: np.ndarray, cell: float) -> np.ndarray:
    gy, gx = np.gradient(z, cell)
    slope = np.pi / 2 - np.arctan(np.hypot(gx, gy))
    aspect = np.arctan2(-gx, gy)
    az, alt = math.radians(315), math.radians(45)
    hs = np.sin(alt) * np.sin(slope) + np.cos(alt) * np.cos(slope) * np.cos(az - aspect)
    return np.clip(hs, 0, 1)


def render_tile(job: tuple) -> int:
    files, nodata, indexes, ranges, kind, x, y, z, out, force = job
    dst = Path(out) / f"{z}/{x}/{y}.webp"
    if dst.exists() and not force:
        return 0
    if force:
        # перерисовка: тайл прошлого запуска, ставший пустым, не должен остаться на карте
        dst.unlink(missing_ok=True)

    def read(asset, x, y, z, **kw):
        with Reader(asset) as r:
            return r.tile(x, y, z, indexes=indexes, nodata=nodata, resampling_method="bilinear", **kw)

    try:
        if len(files) == 1:
            img = read(files[0], x, y, z)
        else:
            img, _ = mosaic_reader(files, read, x, y, z)
    except (TileOutsideBounds, Exception):  # тайл вне всех файлов мозаики
        return 0
    mask = np.asarray(img.mask)
    if not mask.any():
        return 0
    data = np.ma.filled(img.array.astype("float64"), np.nan)
    if kind == "ndvi":
        lo, hi = -0.1, 0.9
        idx = np.nan_to_num(np.clip((data[0] - lo) / (hi - lo) * 255, 0, 255)).astype(int)
        lut = cmap.get("rdylgn")
        pal = np.array([lut[k][:3] for k in range(256)], dtype="uint8")
        rgb = np.moveaxis(pal[idx], -1, 0)
    elif kind == "dem":
        lo, hi = ranges[0]
        t = np.clip((data[0] - lo) / max(hi - lo, 1e-6), 0, 1)
        lut = cmap.get("terrain")
        pal = np.array([lut[k][:3] for k in range(256)], dtype="float64")
        col = pal[np.nan_to_num(t * 255).astype(int)]
        cell = 40075016.686 / (256 * 2 ** z) * math.cos(math.radians(mercantile.ul(x, y, z).lat))
        hs = hillshade(np.nan_to_num(data[0], nan=float(np.nanmean(data[0])) if np.isfinite(data[0]).any() else 0), cell)
        rgb = np.moveaxis((col * (0.45 + 0.55 * hs[..., None])).clip(0, 255).astype("uint8"), -1, 0)
    else:
        gamma = 0.8 if indexes in ((3, 2, 1),) else 1.0
        rgb = np.zeros((3,) + data.shape[1:], dtype="uint8")
        for c, (lo, hi) in enumerate(ranges):
            rgb[c] = (np.clip((data[c] - lo) / max(hi - lo, 1e-6), 0, 1) ** gamma * 255).astype("uint8")
    # прозрачны и пиксели вне маски, и NaN (Sentinel-2 из выгрузки хранит «нет данных» как NaN без флага)
    alpha = np.where((mask > 0) & np.isfinite(data).all(0), 255, 0).astype("uint8")
    if not alpha.any():
        return 0
    dst.parent.mkdir(parents=True, exist_ok=True)
    dst.write_bytes(render(rgb, alpha, img_format="WEBP", quality=82, lossless=False))
    return 1


def build_product(city: str, p: dict, out: Path, pool: ProcessPoolExecutor, force: bool = False) -> dict:
    files = [to_cog(f, p.get("nodata")) if p.get("cog") else f for f in p["files"]]
    files = [str(f) for f in files]
    bb = bounds_4326([Path(f) for f in files])
    kind = p.get("kind", "rgb")
    ranges_all = stretch([Path(f) for f in files], p.get("nodata"))
    composites = p.get("composites") or [("main", p["title"], (1,))]
    entry = {"id": p["id"], "title": p["title"], "res": p["res"], "kind": kind, "bounds": bb,
             "minzoom": p["zoom"][0], "maxzoom": p["zoom"][1], "composites": []}
    for cid, ctitle, indexes in composites:
        ranges = [ranges_all[i - 1] for i in indexes]
        cdir = out / "rasters" / city / p["id"] / cid
        jobs = [(files, p.get("nodata"), indexes, ranges, kind, t.x, t.y, t.z, str(cdir), force)
                for z in range(p["zoom"][0], p["zoom"][1] + 1) for t in mercantile.tiles(*bb, zooms=[z])]
        n = sum(pool.map(render_tile, jobs, chunksize=16))
        print(f"  {city}/{p['id']}/{cid}: {n} новых тайлов из {len(jobs)}")
        entry["composites"].append({"id": cid, "title": ctitle,
                                    "tiles": f"rasters/{city}/{p['id']}/{cid}/{{z}}/{{x}}/{{y}}.webp"})
    if kind == "ndvi":
        entry["legend"] = [{"label": "-0,1 и ниже", "color": "#a50026"}, {"label": "0,4", "color": "#fee08b"},
                           {"label": "0,9", "color": "#006837"}]
    if kind == "dem":
        # легенда из той же палитры, что и тайлы: пять точек от низа к верху
        lo, hi = ranges_all[0]
        lut = cmap.get("terrain")
        stops = ["#%02x%02x%02x" % tuple(lut[k][:3]) for k in (0, 64, 128, 192, 255)]
        entry["legend"] = ([{"label": f"{lo:.0f} м", "color": stops[0]}]
                           + [{"label": "", "color": c} for c in stops[1:-1]]
                           + [{"label": f"{hi:.0f} м", "color": stops[-1]}])
    return entry


def main(out: Path, only: list[str], force: bool = False) -> None:
    index_path = out / "imagery.json"
    index = json.loads(index_path.read_text(encoding="utf-8")) if index_path.exists() else {}
    with ProcessPoolExecutor(max_workers=20) as pool:
        for city, products in PRODUCTS.items():
            for p in products:
                if only and p["id"] not in only and f"{city}/{p['id']}" not in only:
                    continue
                if not p["files"]:
                    print(f"{city}/{p['id']}: нет файлов, пропуск")
                    continue
                print(f"{city}/{p['id']}: {len(p['files'])} файл(ов)")
                entry = build_product(city, p, out, pool, force)
                lst = [e for e in index.get(city, []) if e["id"] != p["id"]]
                index[city] = lst + [entry]
                index_path.write_text(json.dumps(index, ensure_ascii=False, indent=1), encoding="utf-8")
    print("ГОТОВО")


if __name__ == "__main__":
    # --force: перерисовать тайлы заново (после смены контраста или значения «нет данных»)
    args = [a for a in sys.argv[2:] if a != "--force"]
    main(Path(sys.argv[1]), args, "--force" in sys.argv[2:])
