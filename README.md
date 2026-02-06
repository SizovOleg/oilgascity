# OilGasCity

Сайт проекта РНФ № 25-27-00022 «Социально-экологические аспекты развития малых городов как центров нефтегазового освоения в меняющихся климатических условиях субарктической зоны Западной Сибири»

**Организация:** Институт криосферы Земли Тюменского научного центра СО РАН

---

## Демо

- **Сайт:** http://188.120.229.244/oilgascity/
- **CMS-панель:** http://188.120.229.244/cms/

---

## Архитектура

Headless CMS: Wagtail отдаёт данные через REST API, React-фронтенд рендерит интерфейс.

```
┌──────────────────────────────────────────────────┐
│                     nginx                        │
│                                                  │
│  /oilgascity/*  → static files (React build)    │
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
source venv/bin/activate
pip install -r backend/requirements.txt

# 3. База данных
cd backend
python manage.py migrate
python manage.py createsuperuser

# 4. Статика Django
python manage.py collectstatic --noinput

# 5. Фронтенд
cd ../frontend
npm install
npm run build

# 6. Gunicorn (systemd)
cat > /etc/systemd/system/oilgascity-wagtail.service << EOF
[Unit]
Description=OilGasCity Wagtail (gunicorn)
After=network.target

[Service]
User=root
WorkingDirectory=/opt/oilgascity-wagtail/backend
ExecStart=/opt/oilgascity-wagtail/venv/bin/gunicorn backend.wsgi:application --bind 127.0.0.1:8003 --workers 3
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable oilgascity-wagtail
systemctl start oilgascity-wagtail
```

### Конфигурация nginx

Добавить в `server {}` блок:

```nginx
# React frontend
location /oilgascity/ {
    alias /opt/oilgascity-wagtail/frontend/dist/;
    try_files $uri $uri/ /oilgascity/index.html;
    expires 30d;
}

# Wagtail API
location /wt-api/ {
    proxy_pass http://127.0.0.1:8003;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
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

# Media
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
| `/opt/oilgascity-wagtail/backend/media/` | **Загруженные файлы** |
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

# Бэкап (критически важно!)
tar czf /tmp/oilgascity-backup-$(date +%Y%m%d).tar.gz \
    /opt/oilgascity-wagtail/backend/db.sqlite3 \
    /opt/oilgascity-wagtail/backend/media/
```

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
