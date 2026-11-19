#!/bin/bash
# Сборка React-фронтенда на сервере. Собирается в dist-new и только потом подменяет dist:
# при ошибке сайт продолжает работать на прежней сборке. Вызывается из scripts/deploy.sh.
set -euo pipefail

APP=${APP:-/opt/oilgascity-wagtail}

log() { echo "[$(date '+%F %T')] $*"; }

cd "$APP/frontend"
log "Фронтенд: npm ci"
npm ci --no-audit --no-fund --loglevel=error
log "Фронтенд: vite build"
rm -rf dist-new
npx vite build --outDir dist-new --emptyOutDir --logLevel warn
test -s dist-new/index.html
rm -rf dist-old
if [ -d dist ]; then
    mv dist dist-old
fi
mv dist-new dist
rm -rf dist-old
log "Фронтенд собран: $(ls dist/assets | wc -l) файлов в assets"
