#!/bin/bash
# Перенос загрузок Wagtail (backend/media) в бакет B2 и обратно.
#   bash scripts/migrate-media-to-b2.sh            диск -> бакет, затем сверка
#   bash scripts/migrate-media-to-b2.sh --reverse  бакет -> диск (перед откатом флага)
#   bash scripts/migrate-media-to-b2.sh --check    только сверка
# Ничего не удаляет ни на диске, ни в бакете; повторный запуск дозаливает недостающее.
# Ключ берётся из файла окружения и передаётся rclone через переменные процесса:
# не пишется ни в rclone.conf, ни в командную строку (не виден в ps).
set -euo pipefail

APP=${APP:-/opt/oilgascity-wagtail}
ENV_FILE=${ENV_FILE:-/etc/oilgascity-wagtail.env}
LOCAL_MEDIA=${LOCAL_MEDIA:-$APP/backend/media}

log() { echo "[$(date '+%F %T')] $*"; }

mode=copy
case "${1:-}" in
    "") ;;
    --reverse) mode=reverse ;;
    --check) mode=check ;;
    *) echo "Неизвестный параметр: $1" >&2; exit 2 ;;
esac

set -a
# shellcheck source=/dev/null
. "$ENV_FILE"
set +a

for name in MEDIA_S3_BUCKET MEDIA_S3_ACCESS_KEY_ID MEDIA_S3_SECRET_ACCESS_KEY; do
    if [ -z "${!name:-}" ]; then
        echo "ОШИБКА: в $ENV_FILE не задан $name" >&2
        exit 1
    fi
done

# Родной бэкенд B2 «на лету»; тот же ключ приложения работает и для S3 API
export RCLONE_B2_ACCOUNT="$MEDIA_S3_ACCESS_KEY_ID"
export RCLONE_B2_KEY="$MEDIA_S3_SECRET_ACCESS_KEY"
location=${MEDIA_S3_LOCATION:-}
location=${location#/}
location=${location%/}
REMOTE=${REMOTE:-":b2:$MEDIA_S3_BUCKET${location:+/$location}"}

count_and_size() {
    rclone size --json "$1" | python3 -c 'import json,sys; d=json.load(sys.stdin); print(d["count"], d["bytes"])'
}

verify() {
    local src=$1 dst=$2
    log "Сверка $src -> $dst (размер и хэш каждого файла)"
    rclone check --one-way "$src" "$dst"
    read -r src_count src_bytes < <(count_and_size "$src")
    read -r dst_count dst_bytes < <(count_and_size "$dst")
    log "Источник: $src_count файлов, $src_bytes байт; приёмник: $dst_count файлов, $dst_bytes байт"
    if [ "$dst_count" -lt "$src_count" ]; then
        log "ОШИБКА: в приёмнике меньше файлов, чем в источнике"
        exit 1
    fi
    log "Сверка пройдена"
}

case $mode in
    copy)
        log "Копирование $LOCAL_MEDIA -> $REMOTE"
        rclone copy --checksum --stats-one-line --stats 0 "$LOCAL_MEDIA" "$REMOTE"
        verify "$LOCAL_MEDIA" "$REMOTE"
        ;;
    reverse)
        log "Копирование $REMOTE -> $LOCAL_MEDIA"
        rclone copy --checksum --stats-one-line --stats 0 "$REMOTE" "$LOCAL_MEDIA"
        verify "$REMOTE" "$LOCAL_MEDIA"
        ;;
    check)
        verify "$LOCAL_MEDIA" "$REMOTE"
        ;;
esac
