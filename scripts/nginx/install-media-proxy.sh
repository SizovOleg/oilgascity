#!/bin/bash
# Переключить раздачу /oilgascity-media/ в nginx с диска на бакет B2 и обратно.
#   bash scripts/nginx/install-media-proxy.sh              диск -> бакет (с кэшем)
#   bash scripts/nginx/install-media-proxy.sh --uninstall  бакет -> диск
# Перед правкой сохраняет конфиг сайта, после правки делает nginx -t; при ошибке
# возвращает сохранённый конфиг. nginx общий для нескольких сайтов: reload мягкий.
set -euo pipefail

APP=${APP:-/opt/oilgascity-wagtail}
ENV_FILE=${ENV_FILE:-/etc/oilgascity-wagtail.env}
# Пути и команды переопределяются только для проверки в песочнице
SITE=${SITE:-$(readlink -f /etc/nginx/sites-enabled/oilgascity)}
SNIPPET=${SNIPPET:-/etc/nginx/snippets/oilgascity-media.conf}
CACHE_CONF=${CACHE_CONF:-/etc/nginx/conf.d/oilgascity-media-cache.conf}
CACHE_DIR=${CACHE_DIR:-/var/cache/nginx/oilgascity-media}
BACKUP_DIR=${BACKUP_DIR:-/opt/backups/oilgascity-nginx}
NGINX_TEST=${NGINX_TEST:-nginx -t}
NGINX_RELOAD=${NGINX_RELOAD:-systemctl reload nginx}
INCLUDE_LINE="    include $SNIPPET;"

log() { echo "[$(date '+%F %T')] $*"; }

mkdir -p "$BACKUP_DIR"
BACKUP="$BACKUP_DIR/oilgascity.$(date +%Y%m%d-%H%M%S).conf"
cp -p "$SITE" "$BACKUP"
log "Конфиг сайта сохранён: $BACKUP"

apply_or_restore() {
    if $NGINX_TEST 2>&1 | tail -2 && $NGINX_TEST > /dev/null 2>&1; then
        $NGINX_RELOAD
        log "nginx перезагружен"
    else
        cp -p "$BACKUP" "$SITE"
        log "ОШИБКА: nginx -t не прошёл, конфиг сайта возвращён"
        exit 1
    fi
}

if [ "${1:-}" = "--uninstall" ]; then
    grep -qF "$INCLUDE_LINE" "$SITE" || { log "Раздача из бакета не включена, менять нечего"; exit 0; }
    tmp=$(mktemp)
    awk -v inc="$INCLUDE_LINE" -v media="$APP/backend/media/" '
        $0 == inc {
            print "    location /oilgascity-media/ {"
            print "        alias " media ";"
            print "        expires 7d;"
            print "    }"
            next
        }
        { print }' "$SITE" > "$tmp"
    cat "$tmp" > "$SITE"
    rm -f "$tmp"
    apply_or_restore
    log "Медиа снова раздаются с диска (кэш и сниппет оставлены, они ни на что не влияют)"
    exit 0
fi

set -a
# shellcheck source=/dev/null
. "$ENV_FILE"
set +a
for name in MEDIA_S3_BUCKET MEDIA_S3_ENDPOINT_URL; do
    [ -n "${!name:-}" ] || { log "ОШИБКА: в $ENV_FILE не задан $name"; exit 1; }
done
# https://s3.eu-central-003.backblazeb2.com -> s3.eu-central-003.backblazeb2.com
S3_HOST=${MEDIA_S3_ENDPOINT_URL#*://}
S3_HOST=${S3_HOST%%/*}
case "$MEDIA_S3_BUCKET$S3_HOST" in
    *[!A-Za-z0-9.-]*) log "ОШИБКА: недопустимые символы в имени бакета или хоста"; exit 1 ;;
esac

install -m 644 "$APP/scripts/nginx/oilgascity-media-cache.conf" "$CACHE_CONF"
sed -e "s/@S3_HOST@/$S3_HOST/g" -e "s/@BUCKET@/$MEDIA_S3_BUCKET/g" \
    "$APP/scripts/nginx/oilgascity-media.location.template" > "$SNIPPET"
chmod 644 "$SNIPPET"
mkdir -p "$CACHE_DIR"
chown www-data:www-data "$CACHE_DIR"
log "Сниппет $SNIPPET: бакет $MEDIA_S3_BUCKET на $S3_HOST"

if ! grep -qF "$INCLUDE_LINE" "$SITE"; then
    blocks=$(grep -cE '^[[:space:]]*location /oilgascity-media/ \{' "$SITE" || true)
    if [ "$blocks" != "1" ]; then
        log "ОШИБКА: в $SITE найдено блоков location /oilgascity-media/: $blocks, ожидался 1"
        exit 1
    fi
    tmp=$(mktemp)
    # Блок без вложенных скобок (alias + expires): заменяется целиком строкой include
    awk -v inc="$INCLUDE_LINE" '
        /^[[:space:]]*location \/oilgascity-media\/ \{/ { print inc; skip = 1; next }
        skip && /^[[:space:]]*\}/ { skip = 0; next }
        !skip { print }' "$SITE" > "$tmp"
    cat "$tmp" > "$SITE"
    rm -f "$tmp"
fi
apply_or_restore
log "Готово: /oilgascity-media/ раздаётся из бакета через кэш"
