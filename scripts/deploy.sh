#!/bin/bash
# Деплой бэкенда на сервере. Запускается из /opt/oilgascity-wagtail/deploy.sh
# (его вызывает GitHub Actions) уже после git pull, поэтому всегда свежая версия.
# Фронтенд не собирается: после правок в frontend/ нужен npm run build.
set -euo pipefail

APP=/opt/oilgascity-wagtail
ENV_FILE=/etc/oilgascity-wagtail.env
PY="$APP/venv/bin/python"
MANAGE="$PY $APP/backend/manage.py"

log() { echo "[$(date '+%F %T')] $*"; }

cd "$APP"

# Секреты и DJANGO_SETTINGS_MODULE=backend.settings.production
set -a
# shellcheck source=/dev/null
. "$ENV_FILE"
set +a

log "Зависимости"
"$APP/venv/bin/pip" install --quiet -r backend/requirements.txt

log "Проверки Django"
$MANAGE check --deploy --fail-level ERROR

log "Миграции"
$MANAGE migrate --noinput

log "Статика"
$MANAGE collectstatic --noinput --verbosity 0

log "Перезапуск gunicorn"
systemctl restart oilgascity-wagtail

log "Проверка здоровья"
for attempt in $(seq 1 15); do
    if curl -fsS -o /dev/null -H "Host: oilgascity.ru" http://127.0.0.1:8003/wt-api/v2/pages/; then
        log "Деплой завершён, API отвечает (попытка $attempt)"
        exit 0
    fi
    sleep 1
done
log "ОШИБКА: API не отвечает после перезапуска"
journalctl -u oilgascity-wagtail -n 40 --no-pager
exit 1
