#!/bin/bash
# Ежемесячный бэкап oilgascity: копия SQLite (с проверкой целостности) и media.
# При MEDIA_STORAGE=s3 медиа уже лежат в бакете B2, в архив идёт только база.
# Архив кладётся локально и во внешнее хранилище B2 (rclone-монтирование /mnt/b2).
# Запуск: таймер oilgascity-backup.timer; вручную: systemctl start oilgascity-backup
# Восстановление: см. README, раздел «Бэкапы».
set -euo pipefail
umask 077  # копия базы содержит хеши паролей: файлы только для владельца

APP=${APP:-/opt/oilgascity-wagtail}
ENV_FILE=${ENV_FILE:-/etc/oilgascity-wagtail.env}
LOCAL_DIR=${BACKUP_LOCAL_DIR:-/opt/backups/oilgascity}
B2_MOUNT=${BACKUP_B2_MOUNT:-/mnt/b2}
REMOTE_DIR=${BACKUP_REMOTE_DIR:-$B2_MOUNT/backups/oilgascity}
KEEP=${BACKUP_KEEP:-6}
NAME="oilgascity-$(date +%Y%m%d-%H%M).tar.gz"

log() { echo "[$(date '+%F %T')] $*"; }

# Оставить в каталоге KEEP самых свежих архивов
rotate() {
    local dir=$1
    find "$dir" -maxdepth 1 -name 'oilgascity-*.tar.gz' -printf '%T@ %p\n' \
        | sort -rn | tail -n +$((KEEP + 1)) | cut -d' ' -f2- \
        | while read -r old; do
            rm -f -- "$old"
            log "Удалён старый архив $old"
        done
}

umask 077
mkdir -p "$LOCAL_DIR"
WORK=$(mktemp -d "$LOCAL_DIR/.work-XXXXXX")
trap 'rm -rf "$WORK"' EXIT

log "Копия базы"
"$APP/venv/bin/python" - "$APP/backend/db.sqlite3" "$WORK/db.sqlite3" <<'PY'
import sqlite3
import sys

src = sqlite3.connect(f"file:{sys.argv[1]}?mode=ro", uri=True, timeout=30)
dst = sqlite3.connect(sys.argv[2])
src.backup(dst)
result = dst.execute("PRAGMA integrity_check").fetchone()[0]
dst.close()
src.close()
if result != "ok":
    sys.exit(f"integrity_check копии базы: {result}")
PY

# Из файла окружения нужен только флаг хранилища, секреты в этот процесс не читаются
# (нет файла: хранилище считается локальным, медиа попадают в архив)
MEDIA_STORAGE=""
if [ -r "$ENV_FILE" ]; then
    MEDIA_STORAGE=$(sed -n 's/^MEDIA_STORAGE=//p' "$ENV_FILE" | tail -1 | tr -d '"'"'"' ' | tr 'A-Z' 'a-z')
fi
if [ "$MEDIA_STORAGE" = "s3" ]; then
    log "Архив базы (медиа хранятся в бакете B2, MEDIA_STORAGE=s3)"
    tar -czf "$WORK/$NAME" -C "$WORK" db.sqlite3
else
    log "Архив базы и media"
    tar -czf "$WORK/$NAME" -C "$WORK" db.sqlite3 -C "$APP/backend" media
fi
tar -tzf "$WORK/$NAME" > /dev/null
mv "$WORK/$NAME" "$LOCAL_DIR/$NAME"
log "Локально: $LOCAL_DIR/$NAME ($(du -h "$LOCAL_DIR/$NAME" | cut -f1))"
rotate "$LOCAL_DIR"

if ! mountpoint -q "$B2_MOUNT"; then
    log "ОШИБКА: $B2_MOUNT не смонтирован, во внешнее хранилище архив не ушёл"
    exit 1
fi
log "Копия в B2"
mkdir -p "$REMOTE_DIR"
cp "$LOCAL_DIR/$NAME" "$REMOTE_DIR/$NAME.tmp"
mv "$REMOTE_DIR/$NAME.tmp" "$REMOTE_DIR/$NAME"
rotate "$REMOTE_DIR"
log "B2: $REMOTE_DIR/$NAME"
