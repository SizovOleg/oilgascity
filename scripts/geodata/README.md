# Геоданные геопортала

Скрипты собирают всё, что показывает `/geoportal`: манифест, слои GeoJSON, тайлы снимков, фото объектов
и файлы для скачивания. Исходники и результат в git не хранятся (репозиторий публичный).

## Где что лежит на сервере

| Путь | Что |
|---|---|
| `/opt/oilgascity-sources/disk` | «РНФ 2025_2026 Города» (слои городов, папки фото, таблицы описаний, сцены DG) и «РНФ 2025_2026 Города_фото» |
| `/opt/oilgascity-sources/gpx`, `uav`, `housing-yanao` | треки навигатора, продукты беспилотника, данные жилого фонда |
| `/opt/oilgascity-sources/build` | результаты сборки до публикации |
| `/opt/oilgascity-sources/backup` | пять последних копий опубликованных геоданных |
| `/opt/oilgascity-sources/venv` | Python с библиотеками из `requirements.txt` |
| `/opt/oilgascity-geodata` | опубликованное (nginx отдаёт как `/geodata/`) |
| бакет B2, `geoportal/photos/` | фото для сайта (WebP 1600 px и миниатюры 360 px) |

`/opt/oilgascity-sources` в интернет не отдаётся: там оригиналы фото с людьми и коммерческие сцены.
Фото там хранятся уменьшенными копиями 2560 px (`photo_masters.py`), оригиналы с камер у владельца.

## Пересборка

```bash
cd /opt/oilgascity-wagtail
bash scripts/geodata/run-server.sh all        # фото, слои, публикация
bash scripts/geodata/run-server.sh build      # только собрать в build/, ничего не публикуя
bash scripts/geodata/run-server.sh publish    # опубликовать собранное
bash scripts/geodata/run-server.sh imagery uav-2025   # тайлы снимка (тяжело, только при новых сценах)
```

- Поправить описание точки: изменить таблицу в `disk/…/Муравленко_Фото 2025/...xlsx`, затем `all`.
- Добавить фото объекта: положить кадры в его папку (лучше копии `photo_masters.py`), затем `all`.
  Новые кадры проходят фильтр людей, отсеянные раньше остаются отсеянными (`build/photos-webp/excluded.csv`).
- Скачивание слоёв (`downloads.py`): какие слои отдаются, задаётся в `build_geodata.py` (`export_layer`).

## Локально

`content-drafts/run-geodata.sh` (вне git) задаёт те же переменные `OGC_*` для дисков владельца.
