"""Уменьшенные мастер-копии полевых фото для хранения исходников геопортала на сервере.

Оригиналы с камер (около 14 МБ на кадр) остаются на диске владельца как архив. Для пересборки геопортала
(photos.py режет кадры до 1600 px, детектор людей смотрит кадр 1024 px) достаточно копии 2560 px по длинной
стороне: JPEG q85, ориентация применена, остальной EXIF (дата, GPS, камера) сохранён, имена и папки те же,
поэтому нумерация снимков в photos.py не меняется. Прочие файлы (таблицы xlsx, описания) копируются как есть,
видео пропускаются. Повторный запуск обрабатывает только новые и изменённые файлы.

Запуск:
  python scripts/geodata/photo_masters.py <корень источника> <корень копии> <папка> [<папка> ...] [--skip-prefix !]
Папки задаются относительно корня источника и повторяются в копии.
"""
from __future__ import annotations

import os
import shutil
import sys
from concurrent.futures import ProcessPoolExecutor, as_completed
from pathlib import Path

from PIL import Image, ImageOps

LONG_PX = 2560
QUALITY = 85
JPEG = {".jpg", ".jpeg"}
VIDEO = {".mp4", ".mov", ".avi", ".mts", ".m4v"}


def make_master(src: Path, dst: Path) -> tuple[str, int]:
    """Пишет уменьшенную копию одного кадра; возвращает (состояние, размер копии в байтах)."""
    if dst.exists() and dst.stat().st_mtime >= src.stat().st_mtime:
        return "skip", dst.stat().st_size
    dst.parent.mkdir(parents=True, exist_ok=True)
    tmp = dst.with_name(dst.name + ".part")
    with Image.open(src) as im:
        im.draft("RGB", (LONG_PX, LONG_PX))  # декодирование JPEG сразу в уменьшенном масштабе
        out = ImageOps.exif_transpose(im)
        if out is None:  # старые версии Pillow без поворота возвращают None
            out = im
        out = out.convert("RGB")
        out.thumbnail((LONG_PX, LONG_PX), Image.Resampling.LANCZOS)
        exif = out.info.get("exif") or im.info.get("exif") or b""
        out.save(tmp, "JPEG", quality=QUALITY, optimize=True, progressive=True, exif=exif)
    os.replace(tmp, dst)
    st = src.stat()
    os.utime(dst, (st.st_atime, st.st_mtime))
    return "done", dst.stat().st_size


def plan(src_root: Path, dst_root: Path, folders: list[str], skip_prefix: str | None) -> tuple[list, list, int]:
    """Собирает списки кадров для уменьшения и прочих файлов для копирования."""
    jobs, copies, skipped_video = [], [], 0
    for rel in folders:
        base = src_root / rel
        if not base.is_dir():
            raise SystemExit(f"Нет папки {base}")
        for dirpath, dirnames, filenames in os.walk(base):
            if skip_prefix and Path(dirpath) == base:
                dirnames[:] = [d for d in dirnames if not d.startswith(skip_prefix)]
            for name in filenames:
                f = Path(dirpath) / name
                dst = dst_root / f.relative_to(src_root)
                ext = f.suffix.lower()
                if ext in JPEG:
                    jobs.append((f, dst))
                elif ext in VIDEO:
                    skipped_video += 1
                else:
                    copies.append((f, dst))
    return jobs, copies, skipped_video


def main(argv: list[str]) -> None:
    skip_prefix = None
    if "--skip-prefix" in argv:
        i = argv.index("--skip-prefix")
        skip_prefix = argv[i + 1]
        argv = argv[:i] + argv[i + 2:]
    src_root, dst_root, folders = Path(argv[0]), Path(argv[1]), argv[2:]
    jobs, copies, videos = plan(src_root, dst_root, folders, skip_prefix)
    print(f"кадров {len(jobs)}, прочих файлов {len(copies)}, видео пропущено {videos}", flush=True)
    for f, dst in copies:
        if not dst.exists() or dst.stat().st_mtime < f.stat().st_mtime:
            dst.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(f, dst)
    total, done, failed = 0, 0, 0
    workers = max(1, min(16, (os.cpu_count() or 2) - 2))
    with ProcessPoolExecutor(workers) as pool:
        futures = {pool.submit(make_master, f, dst): f for f, dst in jobs}
        for n, fut in enumerate(as_completed(futures), 1):
            try:
                state, size = fut.result()
                total += size
                done += state == "done"
            except Exception as exc:  # битый кадр не должен останавливать весь проход
                failed += 1
                print(f"  ОШИБКА {futures[fut]}: {exc!r}", file=sys.stderr, flush=True)
            if n % 200 == 0:
                print(f"  {n}/{len(jobs)}, {total / 1e9:.2f} ГБ", flush=True)
    print(f"ГОТОВО: кадров {len(jobs)} (новых {done}, ошибок {failed}), объём копий {total / 1e9:.2f} ГБ", flush=True)


if __name__ == "__main__":
    main(sys.argv[1:])
