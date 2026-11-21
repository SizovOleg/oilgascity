#!/bin/bash
# Конвейер геоданных геопортала на сервере, без компьютера владельца.
#   bash scripts/geodata/run-server.sh photos|imagery|build|publish|all [аргументы imagery.py]
#
# Исходники: /opt/oilgascity-sources (disk, gpx, uav, housing-yanao; в интернет не отдаются),
# сборка: /opt/oilgascity-sources/build, опубликованное: /opt/oilgascity-geodata.
#   photos   фото объектов и точек (новые кадры проходят фильтр людей, прежние решения сохраняются)
#   imagery  тайлы снимков; пишутся сразу в опубликованный rasters/ (до publish манифест на них не ссылается),
#            тяжёлый шаг (облачные копии сцен в work/), запускать только при новых снимках
#   build    манифест, слои GeoJSON и файлы для скачивания
#   publish  фото в бакет B2, затем геоданные в /opt/oilgascity-geodata (прежние сохраняются в backup/)
#   all      photos, build, publish (без imagery)
# Процессы идут с пониженным приоритетом: сервер общий.
set -euo pipefail

SRC=${OGC_SOURCES:-/opt/oilgascity-sources}
PUB=${OGC_PUBLISH:-/opt/oilgascity-geodata}
ENV_FILE=${OGC_ENV_FILE:-/etc/oilgascity-wagtail.env}
REPO=$(cd "$(dirname "$0")/../.." && pwd)
B=$SRC/build
PY=(nice -n 19 ionice -c3 "$SRC/venv/bin/python" -u -W ignore)

export OGC_DISK_DIR="$SRC/disk" OGC_GPX_DIR="$SRC/gpx" OGC_UAV_DIR="$SRC/uav" OGC_WORK_DIR="$SRC/work"
export OGC_RS_DIR="$SRC/disk/РНФ 2025_2026 Города"
export OGC_WORKERS=${OGC_WORKERS:-3}
export PYTHONIOENCODING=utf-8

mkdir -p "$B/photos-webp" "$B/imagery" "$B/geodata"
[ -e "$B/imagery/rasters" ] || ln -s "$PUB/rasters" "$B/imagery/rasters"

env_value() {  # значение переменной из env-файла сайта (без вывода на экран, \r срезается)
    grep -E "^$1=" "$ENV_FILE" | head -1 | cut -d= -f2- | tr -d '\r"'
}

publish() {
    local stamp
    stamp=$(date +%Y%m%d-%H%M%S)
    echo "== фото в бакет"
    local bucket
    bucket=$(env_value MEDIA_S3_BUCKET)
    for city in kogalym muravlenko; do
        [ -d "$B/photos-webp/$city" ] || continue
        RCLONE_B2_ACCOUNT=$(env_value MEDIA_S3_ACCESS_KEY_ID) RCLONE_B2_KEY=$(env_value MEDIA_S3_SECRET_ACCESS_KEY) \
            nice -n 19 rclone copy --checksum --include "*.webp" "$B/photos-webp/$city" ":b2:$bucket/geoportal/photos/$city"
    done
    echo "== копия прежних геоданных: $SRC/backup/geodata-$stamp.tgz"
    mkdir -p "$SRC/backup"
    tar -C "$PUB" --exclude=./rasters -czf "$SRC/backup/geodata-$stamp.tgz" .
    ls -1t "$SRC"/backup/geodata-*.tgz | tail -n +6 | xargs -r rm --  # хранятся пять последних
    echo "== геоданные в $PUB"
    # манифест последним: пока он старый, геопортал не ссылается на новые файлы
    tar -C "$B/geodata" --exclude=./manifest.json -cf - . | tar -C "$PUB" -xf -
    cp "$B/geodata/manifest.json" "$PUB/manifest.json.new" && mv "$PUB/manifest.json.new" "$PUB/manifest.json"
    echo "опубликовано, сборка $(grep -o '"built": "[0-9]*"' "$PUB/manifest.json")"
}

step=${1:-all}
shift || true
cd "$REPO"
case "$step" in
    photos|all) "${PY[@]}" scripts/geodata/photos.py "$B/photos-webp" ;;&
    imagery) "${PY[@]}" scripts/geodata/imagery.py "$B/imagery" "$@" ;;&
    build|all) "${PY[@]}" scripts/geodata/build_geodata.py "$OGC_RS_DIR/Слои городов" "$B/geodata" \
                   "$SRC/housing-yanao" "$B/photos-webp/photos-index.json" "$B/imagery/imagery.json" ;;&
    publish|all) publish ;;
    photos|imagery|build) ;;
    *) echo "Шаг: photos, imagery, build, publish или all" >&2; exit 2 ;;
esac
