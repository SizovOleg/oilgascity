# OilGasCity

Сайт проекта РНФ № 25-27-00022 «Социально-экологические аспекты развития малых городов как центров нефтегазового освоения в меняющихся климатических условиях субарктической зоны Западной Сибири»

**Организация:** Институт криосферы Земли Тюменского научного центра СО РАН

---

## Адреса

| Что | Адрес |
|-----|-------|
| Сайт | https://oilgascity.ru/ |
| Админка (Wagtail CMS) | https://oilgascity.ru/cms/ |
| API | https://oilgascity.ru/wt-api/v2/pages/ |

Ссылки «Посмотреть на сайте» в админке и поле `html_url` в API ведут на маршруты
React (`/cities/<id>`, `/blog/<id>` и т.д.): это делает `FrontendUrlMixin` в
`backend/home/models.py`, базовый адрес задаёт `FRONTEND_BASE_URL`.

**Деплой.** Push в `main` запускает GitHub Actions (`.github/workflows/deploy.yml`):
на сервере выполняется `deploy.sh` (git pull), а затем `scripts/deploy.sh` из репозитория:
зависимости, `check --deploy`, migrate, collectstatic, перезапуск gunicorn и проверка,
что API отвечает. Любая ошибка останавливает деплой и роняет job в Actions.
Фронтенд скрипт не пересобирает: после правок в `frontend/` нужен `npm run build` на сервере.

---

## Архитектура

Headless CMS: Wagtail отдаёт данные через REST API, React-фронтенд рендерит интерфейс.

```
┌──────────────────────────────────────────────────┐
│                     nginx                        │
│                                                  │
│  /*             → static files (React build)    │
│  /wt-api/*      → gunicorn:8003 (Wagtail API)   │
│  /cms/*         → gunicorn:8003 (Wagtail admin)  │
│  /oilgascity-static/* → Django static files      │
│  /oilgascity-media/*  → uploaded media           │
└──────────────────────────────────────────────────┘
```

### Стек

| Компонент | Технология |
|-----------|-----------|
| Backend | Python 3.12, Django 5.1, Wagtail 6.4 |
| Frontend | React 19, Vite 7, Tailwind CSS 4 |
| Анимации | Framer Motion |
| Карта | Leaflet + ArcGIS World Imagery |
| Иконки | Lucide React |
| Web-сервер | nginx |
| App-сервер | gunicorn (systemd) |
| БД | SQLite |

---

## Структура проекта

```
oilgascity/
├── backend/                    # Django/Wagtail
│   ├── backend/
│   │   ├── settings/
│   │   │   ├── base.py         # Общие настройки
│   │   │   ├── dev.py          # Dev/production настройки
│   │   │   └── production.py   # Production (не используется)
│   │   ├── urls.py             # URL-маршруты
│   │   └── wsgi.py             # WSGI entry point
│   ├── home/
│   │   ├── models.py           # Модели контента (страницы)
│   │   ├── api.py              # Wagtail API конфигурация
│   │   └── management/commands/
│   │       └── import_wordpress.py  # Скрипт миграции из WordPress
│   ├── manage.py
│   └── requirements.txt
│
├── frontend/                   # React SPA
│   ├── src/
│   │   ├── api/
│   │   │   └── client.js       # HTTP-клиент для Wagtail API
│   │   ├── components/
│   │   │   ├── Layout.jsx      # Навигация, хедер, футер
│   │   │   ├── AnimatedSection.jsx  # Framer Motion обёртки
│   │   │   ├── CityMap.jsx     # Leaflet карта городов
│   │   │   ├── Gallery.jsx     # Фотогалерея с сеткой
│   │   │   └── Lightbox.jsx    # Полноэкранный просмотр фото
│   │   ├── pages/
│   │   │   ├── HomePage.jsx
│   │   │   ├── CitiesPage.jsx
│   │   │   ├── CityPage.jsx
│   │   │   ├── ExpeditionsPage.jsx
│   │   │   ├── ExpeditionPage.jsx
│   │   │   ├── PublicationsPage.jsx
│   │   │   ├── TeamPage.jsx
│   │   │   ├── BlogPage.jsx
│   │   │   └── BlogPostPage.jsx
│   │   ├── App.jsx             # React Router
│   │   ├── main.jsx            # Entry point
│   │   └── index.css           # Tailwind + кастомные стили
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
│
└── .gitignore
```

---

## Модели контента

Определены в `backend/home/models.py`:

| Модель | Описание | Тип |
|--------|----------|-----|
| `HomePage` | Главная страница проекта | Единственная |
| `CitiesIndexPage` | Индекс городов | Контейнер |
| `CityPage` | Страница города | Дочерняя |
| `ExpeditionsIndexPage` | Индекс экспедиций | Контейнер |
| `ExpeditionPage` | Страница экспедиции | Дочерняя |
| `PublicationsPage` | Страница публикаций | Единственная |
| `TeamPage` | Страница команды | Единственная |
| `BlogIndexPage` | Индекс блога | Контейнер |
| `BlogPostPage` | Пост блога | Дочерняя |

**Inline-модели** (InlinePanel):

| Модель | Родитель | Поля |
|--------|----------|------|
| `TeamMember` | TeamPage | name, role, position, organization, photo, ORCID, Scopus, WoS, eLibrary, SPIN |
| `Publication` | PublicationsPage | title, authors, journal, year, abstract, doi, pdf |
| `GalleryImage` | City/Expedition/BlogPost | image, caption |

---

## API

Wagtail API v2 доступен по `/wt-api/v2/`:

```bash
# Список страниц по типу
GET /wt-api/v2/pages/?type=home.CityPage&fields=*

# Конкретная страница
GET /wt-api/v2/pages/{id}/

# Дочерние страницы
GET /wt-api/v2/pages/?child_of={id}&fields=*

# Изображения
GET /wt-api/v2/images/
```

Все поля включены в API через `api_fields` в моделях. Изображения отдаются с renditions (thumbnail, large, original).

---

## Развёртывание

### Требования

- Python 3.10+
- Node.js 18+
- nginx

### Установка с нуля

```bash
# 1. Клонирование
git clone https://github.com/SizovOleg/oilgascity.git /opt/oilgascity-wagtail
cd /opt/oilgascity-wagtail

# 2. Python окружение
python3 -m venv venv
venv/bin/pip install -r backend/requirements.txt

# 3. Секреты: только на сервере, права 600
umask 077
{
  echo "DJANGO_SETTINGS_MODULE=backend.settings.production"
  echo "DJANGO_SECRET_KEY=$(python3 -c 'import secrets; print(secrets.token_urlsafe(50))')"
} > /etc/oilgascity-wagtail.env

# 4. Gunicorn (systemd): юнит с ExecStart
#    gunicorn backend.wsgi:application --bind 127.0.0.1:8003 --workers 2 --timeout 120
#    (Type=notify, WorkingDirectory=/opt/oilgascity-wagtail/backend) и drop-in с секретами:
mkdir -p /etc/systemd/system/oilgascity-wagtail.service.d
printf '[Service]\nEnvironmentFile=/etc/oilgascity-wagtail.env\n' \
    > /etc/systemd/system/oilgascity-wagtail.service.d/env.conf
systemctl daemon-reload && systemctl enable oilgascity-wagtail

# 5. Обёртка деплоя, её вызывает GitHub Actions (в git не хранится)
printf '#!/bin/bash\nset -euo pipefail\ncd /opt/oilgascity-wagtail\ngit pull --ff-only origin main\nexec bash scripts/deploy.sh\n' \
    > deploy.sh

# 6. Суперпользователь и первый деплой (manage.py на сервере запускать только с секретами)
set -a; . /etc/oilgascity-wagtail.env; set +a
venv/bin/python backend/manage.py migrate
venv/bin/python backend/manage.py createsuperuser
bash scripts/deploy.sh

# 7. Фронтенд (scripts/deploy.sh его не собирает)
cd frontend && npm ci && npm run build
```

Настройки прода в `backend/backend/settings/production.py`: DEBUG выключен, секреты
берутся из окружения, без `DJANGO_SECRET_KEY` gunicorn не стартует. `dev.py` нужен
только для локальной разработки. Необязательные переменные: `DJANGO_ALLOWED_HOSTS`,
`DJANGO_CSRF_TRUSTED_ORIGINS`, `FRONTEND_BASE_URL`, `WAGTAILAPI_BASE_URL`,
`WAGTAILADMIN_BASE_URL`, `DJANGO_LOG_LEVEL`.

### Конфигурация nginx

Добавить в `server {}` блок:

```nginx
# React frontend (корень домена oilgascity.ru)
location / {
    root /opt/oilgascity-wagtail/frontend/dist;
    try_files $uri $uri/ /index.html;
    expires 30d;
}

# Wagtail API
location /wt-api/ {
    proxy_pass http://127.0.0.1:8003;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}

# Документы Wagtail (PDF публикаций), их отдаёт Django
location /documents/ {
    proxy_pass http://127.0.0.1:8003;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}

# Wagtail admin
location /cms/ {
    proxy_pass http://127.0.0.1:8003;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    client_max_body_size 100M;
}

# Django static
location /oilgascity-static/ {
    alias /opt/oilgascity-wagtail/backend/static/;
    expires 30d;
}

# Media: с локального диска; после переключения на бакет B2 этот блок заменяет
# include сниппета (см. «Хранилище медиа»)
location /oilgascity-media/ {
    alias /opt/oilgascity-wagtail/backend/media/;
    expires 7d;
}
```

```bash
nginx -t && nginx -s reload
```

### Импорт контента из WordPress

```bash
cd /opt/oilgascity-wagtail/backend
python manage.py import_wordpress
```

Скрипт загружает изображения, создаёт страницы, команду, публикации и блог-посты.

---

## Расположение файлов на сервере

| Путь | Содержимое |
|------|-----------|
| `/opt/oilgascity-wagtail/backend/` | Django/Wagtail проект |
| `/opt/oilgascity-wagtail/frontend/` | React проект |
| `/opt/oilgascity-wagtail/frontend/dist/` | Собранный фронтенд |
| `/opt/oilgascity-wagtail/venv/` | Python виртуальное окружение |
| `/opt/oilgascity-wagtail/backend/db.sqlite3` | **База данных** |
| `/opt/oilgascity-wagtail/backend/media/` | **Загруженные файлы** (при `MEDIA_STORAGE=s3` резерв, новые загрузки в бакете B2) |
| `/opt/oilgascity-wagtail/backend/static/` | Статика Django (collectstatic) |

---

## Управление

```bash
# Статус сервиса
systemctl status oilgascity-wagtail

# Перезапуск backend
systemctl restart oilgascity-wagtail

# Пересборка фронтенда
cd /opt/oilgascity-wagtail/frontend
npm run build

# Внеочередной бэкап
systemctl start oilgascity-backup && journalctl -u oilgascity-backup -n 20 --no-pager
```

### Бэкапы

`scripts/backup.sh` по таймеру `oilgascity-backup.timer` (1-е число месяца, ночью; пропуск
наверстывается после включения сервера) делает архив `oilgascity-ГГГГММДД-ЧЧММ.tar.gz`:
копию SQLite (проверенную `integrity_check`) и папку `media/` (при `MEDIA_STORAGE=s3`
только базу: медиа уже в бакете). Архив кладётся в
`/opt/backups/oilgascity/` и во внешнее хранилище B2 (`/mnt/b2/backups/oilgascity/`),
хранятся последние 6. Ошибка, в том числе отсутствие B2, роняет юнит: её видно в
`systemctl --failed`.

Установка юнитов:

```bash
cp /opt/oilgascity-wagtail/scripts/systemd/oilgascity-backup.* /etc/systemd/system/
systemctl daemon-reload && systemctl enable --now oilgascity-backup.timer
```

Восстановление:

```bash
systemctl stop oilgascity-wagtail
cd /tmp && tar -xzf /opt/backups/oilgascity/oilgascity-ГГГГММДД-ЧЧММ.tar.gz
cp /opt/oilgascity-wagtail/backend/db.sqlite3 /opt/oilgascity-wagtail/backend/db.sqlite3.before-restore
cp /tmp/db.sqlite3 /opt/oilgascity-wagtail/backend/db.sqlite3
rsync -a /tmp/media/ /opt/oilgascity-wagtail/backend/media/
systemctl start oilgascity-wagtail
```

### Хранилище медиа (Backblaze B2)

Загрузки Wagtail (оригиналы изображений, рендеры, документы) могут храниться в отдельном
публичном бакете B2 вместо `backend/media/`. Адреса для посетителей не меняются:
`https://oilgascity.ru/oilgascity-media/<путь>`, nginx берёт файлы из бакета и кэширует
у себя (`/var/cache/nginx/oilgascity-media`, до 5 ГБ). Документы всегда отдаёт Django
по `/documents/<id>/<имя>` с проверкой доступа коллекции. Дизайн и решения:
`openspec/changes/media-external-storage/` (после архивации `openspec/specs/media-storage/`).

Переменные в `/etc/oilgascity-wagtail.env`:

| Переменная | Пример | Обязательна при `s3` |
|-----------|--------|---------------------|
| `MEDIA_STORAGE` | `s3` (без неё локальный диск) | это и есть флаг |
| `MEDIA_S3_BUCKET` | `oilgascity-media-...` | да |
| `MEDIA_S3_ENDPOINT_URL` | `https://s3.eu-central-003.backblazeb2.com` | да |
| `MEDIA_S3_REGION` | `eu-central-003` | да |
| `MEDIA_S3_ACCESS_KEY_ID` | keyID ключа приложения | да |
| `MEDIA_S3_SECRET_ACCESS_KEY` | applicationKey | да |
| `MEDIA_S3_LOCATION` | префикс внутри бакета, по умолчанию пусто | нет |
| `MEDIA_PUBLIC_DOMAIN` | `oilgascity.ru/oilgascity-media` | нет |

Ключи без флага ничего не меняют. С флагом, но без обязательной переменной gunicorn не
стартует и называет, чего не хватает.

Переключение (по шагам, с проверкой после каждого):

```bash
cd /opt/oilgascity-wagtail
bash scripts/migrate-media-to-b2.sh            # 1. диск -> бакет, сверка размеров и хэшей
echo "MEDIA_STORAGE=s3" >> /etc/oilgascity-wagtail.env
systemctl restart oilgascity-wagtail           # 2. новые загрузки и рендеры идут в бакет
bash scripts/migrate-media-to-b2.sh            # 3. дослать то, что успело лечь на диск
bash scripts/nginx/install-media-proxy.sh      # 4. nginx: /oilgascity-media/ из бакета, с кэшем
curl -sI https://oilgascity.ru/oilgascity-media/<путь> | grep -i x-cache-status   # MISS, затем HIT
```

Откат:

```bash
bash scripts/migrate-media-to-b2.sh --reverse  # загрузки, сделанные после переключения, на диск
sed -i '/^MEDIA_STORAGE=/d' /etc/oilgascity-wagtail.env && systemctl restart oilgascity-wagtail
bash scripts/nginx/install-media-proxy.sh --uninstall
```

Ключ приложения в B2 выдаётся только к этому бакету (Read and Write); ключ rclone-монтирования
`/mnt/b2` (бакет `EOdata`) для медиа не используется.

---

## Разработка (dev-режим)

```bash
# Backend
cd /opt/oilgascity-wagtail/backend
source ../venv/bin/activate
python manage.py runserver 127.0.0.1:8003

# Frontend (в отдельном терминале)
cd /opt/oilgascity-wagtail/frontend
npm run dev
```

Vite dev server запускается на порту 3000 с HMR (hot module replacement).

---

## Лицензия

Проект выполняется при поддержке Российского научного фонда (грант № 25-27-00022).

© 2025–2027 Институт криосферы Земли ТюмНЦ СО РАН
