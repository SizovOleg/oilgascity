// Геопортал: полноэкранная карта MapLibre со слоями по картам статей проекта и вкладкой жилого фонда.
// Состав вкладок, слоёв, стили, легенды и графики приходят из /geodata/manifest.json
// (scripts/geodata/build_geodata.py), поэтому новый слой добавляется без правки этого кода.
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import * as maplibregl from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import 'maplibre-gl/dist/maplibre-gl.css';
import './geoportal.css';
import { PinIcon } from '../components/Icons';

// maplibre-gl 6 ищет воркер рядом со своим модулем; после сборки Vite его там нет, задаём адрес явно
maplibregl.setWorkerUrl(workerUrl);

const DATA = '/geodata';
const GLYPHS = 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf';

const BASEMAPS = {
  scheme: { title: 'Схема', style: 'https://tiles.openfreemap.org/styles/positron' },
  satellite: {
    title: 'Снимок Esri',
    style: {
      version: 8,
      glyphs: GLYPHS,
      sources: {
        esri: {
          type: 'raster',
          tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
          tileSize: 256,
          maxzoom: 19,
          attribution: 'Снимки © Esri, Maxar, Earthstar Geographics',
        },
      },
      layers: [{ id: 'esri', type: 'raster', source: 'esri' }],
    },
  },
};

const FIELD_LABELS = {
  kind: 'Тип', area_ha: 'Площадь, га', address: 'Адрес', floors: 'Этажей', apartments: 'Квартир',
  year: 'Год постройки', condition: 'Состояние', type: 'Тип дома', people: 'Жителей (оценка)',
  formation: 'Формация', community: 'Сообщество', zone: 'Зона', area: 'Жилая площадь, м²',
  house_type: 'Тип', source: 'Контур', note: 'Описание', name: 'Название', photos: 'Фото', decade: 'Десятилетие',
};

// Что показывает синтез: подсказка под кнопками выбора
const COMPOSITE_NOTES = {
  natural: 'Близко к тому, что видит глаз.',
  false: 'Растительность красная: чем ярче, тем она гуще и активнее.',
  rededge: 'Красный край: различия в состоянии растительности, в том числе газонов и крон.',
};

const layerKey = (city, id) => `${city}-${id}`;
const sceneKey = (city, prod, comp) => `img-${city}-${prod}-${comp}`;
const fmt = (v) => (typeof v === 'number' ? String(v).replace('.', ',') : v);

// Старый манифест без вкладок читается как одна вкладка
const tabsOf = (city) => city.tabs || [{ id: 'green', title: 'Слои', groups: city.groups || [] }];
const layersOf = (tab) => tab.groups.flatMap((g) => g.layers);

const fmtSize = (bytes) => (bytes >= 1e6 ? `${fmt(Math.round(bytes / 1e5) / 10)} МБ` : `${Math.max(1, Math.round(bytes / 1e3))} КБ`);

// Подсказка вместо примечания: значок у заголовка, текст открывается наведением, фокусом или нажатием
// и ложится под строкой заголовка (.gp-head) на всю ширину панели. menu: внутри ссылки, а не пояснение.
function Hint({ children, icon = 'i', label = 'Пояснение', tone = '', menu = false }) {
  const [pinned, setPinned] = useState(false);
  const ref = useRef(null);
  const id = useId();
  useEffect(() => {
    if (!pinned) return undefined;
    const away = (e) => { if (!ref.current?.contains(e.target)) setPinned(false); };
    const esc = (e) => { if (e.key === 'Escape') setPinned(false); };
    document.addEventListener('pointerdown', away);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('pointerdown', away);
      document.removeEventListener('keydown', esc);
    };
  }, [pinned]);
  return (
    <span className={`gp-hint${tone ? ` ${tone}` : ''}${pinned ? ' open' : ''}`} ref={ref}>
      <button type="button" className="gp-hint-btn" aria-label={label} aria-expanded={pinned}
        {...(menu ? { 'aria-controls': id } : { 'aria-describedby': id })} onClick={() => setPinned((p) => !p)}>{icon}</button>
      <span className="gp-hint-box" id={id} role={menu ? undefined : 'tooltip'}>{children}</span>
    </span>
  );
}

function DownloadIcon() {
  return (
    <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 2v8M4.5 6.8 8 10.3l3.5-3.5M2.5 13.5h11" />
    </svg>
  );
}

// Скачивание векторного слоя проекта: GeoPackage и Shapefile в zip, лицензия и как ссылаться
function Download({ dl, ver }) {
  return (
    <Hint icon={<DownloadIcon />} label="Скачать слой" tone="dl" menu>
      <b>Скачать слой</b>
      {dl.files.map((f) => (
        <a key={f.url} href={`${DATA}/${f.url}${ver}`} download>{f.format}<span>zip, {fmtSize(f.size)}</span></a>
      ))}
      <small>
        {dl.count ? `${dl.count} объектов, исходная геометрия, UTM 43N. ` : ''}
        Лицензия <a href={dl.license_url} target="_blank" rel="noreferrer">{dl.license}</a>{dl.attribution ? `, ${dl.attribution}` : ''}.
        {dl.cite ? ` Ссылка: ${dl.cite}.` : ''}
      </small>
    </Hint>
  );
}

// Фоновая загрузка кадра в кэш браузера
const preloaded = new Set();
function preload(src) {
  if (!src || preloaded.has(src)) return;
  preloaded.add(src);
  const img = new Image();
  img.decoding = 'async';
  img.src = src;
}

// Просмотр фото на весь экран: стрелки и Esc с клавиатуры, щелчок по фону закрывает
function Lightbox({ gallery, index, setIndex, onClose }) {
  const items = gallery.items;
  const go = (d) => setIndex((i) => (i + d + items.length) % items.length);
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') setIndex((i) => (i + 1) % items.length);
      if (e.key === 'ArrowLeft') setIndex((i) => (i - 1 + items.length) % items.length);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [items.length, onClose, setIndex]);
  // соседние кадры грузятся заранее: листание стрелками без ожидания
  useEffect(() => {
    for (const d of [1, -1]) preload(items[(index + d + items.length) % items.length].f);
  }, [index, items]);
  const it = items[index];
  return (
    <div className="gp-lightbox" role="dialog" aria-modal="true" aria-label={gallery.title} onClick={onClose}>
      <figure onClick={(e) => e.stopPropagation()}>
        {/* пока грузится полный кадр, на его месте растянута уже загруженная миниатюра */}
        <img key={it.f} src={it.f} alt={`${gallery.title}, снимок ${index + 1}`} width={it.w} height={it.h}
          style={{ backgroundImage: `url("${it.t}")` }} />
        <figcaption>
          <b>{gallery.title}</b> <span>{index + 1} из {items.length}{gallery.date ? `, ${gallery.date}` : ''}</span>
        </figcaption>
      </figure>
      {items.length > 1 ? (
        <>
          <button type="button" className="lb-nav prev" aria-label="Предыдущий снимок" onClick={(e) => { e.stopPropagation(); go(-1); }}>‹</button>
          <button type="button" className="lb-nav next" aria-label="Следующий снимок" onClick={(e) => { e.stopPropagation(); go(1); }}>›</button>
        </>
      ) : null}
      <button type="button" className="lb-close" aria-label="Закрыть" onClick={onClose}>×</button>
    </div>
  );
}

// Панель внизу карты: лента миниатюр выбранной площадки или парка
function PhotoStrip({ gallery, onOpen, onClose, offset = 0 }) {
  const ref = useRef(null);
  const scroll = (d) => ref.current?.scrollBy({ left: d * ref.current.clientWidth * 0.8, behavior: 'smooth' });
  return (
    <section className="gp-strip" aria-label={`Фото: ${gallery.title}`} style={offset ? { bottom: `calc(${offset}px + 0.6rem)` } : undefined}>
      <header>
        <b>{gallery.title}</b>
        <span>{gallery.items.length} фото{gallery.date ? `, ${gallery.date}` : ''}{gallery.note ? `. ${gallery.note}` : ''}</span>
        <button type="button" className="gp-strip-close" aria-label="Закрыть фото" onClick={onClose}>×</button>
      </header>
      <div className="gp-strip-row">
        <button type="button" className="gp-strip-nav" aria-label="Прокрутить назад" onClick={() => scroll(-1)}>‹</button>
        <div className="gp-thumbs" ref={ref}>
          {gallery.items.map((it, i) => (
            <button key={it.t} type="button" onClick={() => onOpen(i)} aria-label={`Открыть снимок ${i + 1}`}
              onPointerEnter={() => preload(it.f)} onFocus={() => preload(it.f)}>
              <img src={it.t} alt="" loading="lazy" />
            </button>
          ))}
        </div>
        <button type="button" className="gp-strip-nav" aria-label="Прокрутить вперёд" onClick={() => scroll(1)}>›</button>
      </div>
    </section>
  );
}

function popupHtml(layer, props) {
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const rows = (layer.popup || []).filter((f) => props[f] !== null && props[f] !== undefined && props[f] !== '' && props[f] !== 'None' && props[f] !== 'null');
  const title = rows.find((f) => f === 'name' || f === 'address' || f === 'formation');
  const body = rows.filter((f) => f !== title)
    .map((f) => `<div><span>${FIELD_LABELS[f] || f}</span> ${esc(fmt(props[f]))}</div>`).join('');
  const photos = Number(props.photos) > 0 ? `<div class="gp-pop-ph">Фото: ${Number(props.photos)}, лента внизу карты</div>` : '';
  return `<div class="gp-pop"><b>${esc(title ? props[title] : layer.title)}</b>${body}${photos}<small>${esc(layer.title)}</small></div>`;
}

// Слои MapLibre для одного слоя манифеста
function styleLayers(city, layer) {
  const id = layerKey(city, layer.id);
  const src = id;
  const color = layer.color;
  if (layer.type === 'image') return [{ id, type: 'raster', source: src, paint: { 'raster-opacity': layer.opacity ?? 0.85 } }];
  if (layer.type === 'line') {
    return [{ id, type: 'line', source: src, paint: { 'line-color': color, 'line-width': layer.width || 1.5 } }];
  }
  if (layer.type === 'circle') {
    const out = [{ id, type: 'circle', source: src, paint: { 'circle-color': color, 'circle-radius': 5, 'circle-stroke-color': '#fff', 'circle-stroke-width': 1.5 } }];
    if (layer.label) out.push(labelLayer(id, src, layer.label));
    return out;
  }
  if (layer.type === 'fill-outline') {
    const out = [
      { id: `${id}-fill`, type: 'fill', source: src, paint: { 'fill-color': color, 'fill-opacity': 0.04 } },
      { id, type: 'line', source: src, paint: { 'line-color': color, 'line-width': 1.2, 'line-dasharray': [3, 2] } },
    ];
    if (layer.label) out.push(labelLayer(id, src, layer.label));
    return out;
  }
  return [
    { id: `${id}-fill`, type: 'fill', source: src, paint: { 'fill-color': color, 'fill-opacity': layer.opacity ?? 0.7 } },
    { id, type: 'line', source: src, paint: { 'line-color': color, 'line-width': 0.6, 'line-opacity': 0.9 } },
  ];
}

// Наборы векторных тайлов слоя (у типов поверхности два: обобщённый для мелких масштабов и по объектам для крупных)
const vectorParts = (layer) => (!layer.vector ? [] : Array.isArray(layer.vector) ? layer.vector : [layer.vector]);
const partId = (id, k) => (k ? `${id}~${k}` : id); // первый набор под основными именами: по ним щелчок находит объект

// Стилевые слои с учётом векторных тайлов: у каждого набора свой источник, слой внутри тайла и масштабы показа
function mapLayers(city, layer) {
  const parts = vectorParts(layer);
  if (!parts.length) return styleLayers(city, layer);
  return parts.flatMap((v, k) => styleLayers(city, layer).map((l) => ({
    ...l, id: partId(l.id, k), source: partId(l.source, k), 'source-layer': v.layer,
    ...(v.show ? { minzoom: v.show[0], maxzoom: v.show[1] } : {}),
  })));
}

// Имена стилевых слоёв, по которым ищется объект под курсором (заливка у площадных слоёв)
function hitLayerIds(city, layer) {
  return mapLayers(city, layer).filter((l) => l.type !== 'symbol' && (layer.type !== 'fill' && layer.type !== 'fill-outline' ? true : l.type === 'fill')).map((l) => l.id);
}

function labelLayer(id, src, field) {
  return {
    id: `${id}-label`, type: 'symbol', source: src,
    layout: { 'text-field': ['get', field], 'text-font': ['Noto Sans Regular'], 'text-size': 12, 'text-offset': [0, 1], 'text-anchor': 'top' },
    paint: { 'text-color': '#14242B', 'text-halo-color': '#fff', 'text-halo-width': 1.4 },
  };
}

// ver: «?v=<метка сборки манифеста>», новая сборка геоданных не берётся из кэша браузера
function addLayer(map, city, layer, ver = '') {
  const id = layerKey(city, layer.id);
  if (!map.getSource(id)) {
    if (layer.type === 'image') {
      map.addSource(id, { type: 'image', url: `${DATA}/${city}/${layer.file}${ver}`, coordinates: layer.coordinates });
    } else if (layer.vector) {
      // тяжёлый сплошной слой (типы поверхности): векторные тайлы, грузятся только видимые; адрес абсолютный строкой,
      // как у растровых тайлов (new URL кодирует {z})
      vectorParts(layer).forEach((v, k) => {
        map.addSource(partId(id, k), { type: 'vector', tiles: [`${window.location.origin}${DATA}/${city}/${v.tiles}${ver}`], minzoom: v.minzoom, maxzoom: v.maxzoom });
      });
    } else {
      // generateId: номер объекта в файле, по нему щелчок на карте находит строку атрибутивной таблицы
      map.addSource(id, { type: 'geojson', data: `${DATA}/${city}/${layer.file}${ver}`, generateId: true });
    }
  }
  for (const l of mapLayers(city, layer)) if (!map.getLayer(l.id)) map.addLayer(l);
}

function setVisible(map, city, layer, visible, filter) {
  for (const l of mapLayers(city, layer)) {
    if (!map.getLayer(l.id)) continue;
    map.setLayoutProperty(l.id, 'visibility', visible ? 'visible' : 'none');
    // фильтр по значению поля (например, десятилетию постройки) у слоёв, которые его поддерживают
    if (layer.filter) map.setFilter(l.id, filter ? ['==', ['get', layer.filter], filter] : null);
  }
}

function Legend({ layer, filter, onFilter }) {
  const items = layer.legend || (typeof layer.color === 'string' ? [{ label: layer.title, color: layer.color }] : []);
  if (!items.length) return null;
  return (
    <ul className="gp-legend">
      {items.map((it, i) => (
        <li key={i}>
          {layer.filter ? (
            <button type="button" className={filter === it.label ? 'on' : ''} aria-pressed={filter === it.label}
              onClick={() => onFilter(filter === it.label ? null : it.label)}>
              <i style={{ background: it.color }} />{it.label}
            </button>
          ) : <><i style={{ background: it.color }} />{it.label}</>}
        </li>
      ))}
    </ul>
  );
}

// Снимки проекта: выбор сцены, цветового синтеза и прозрачности
function ImageryPicker({ city, prod, comp, zoom, opacity, bare, onPick, onComp, onOpacity, onBare }) {
  // группы в списке идут в порядке манифеста (от подробных снимков к обзорным)
  const groups = [];
  for (const p of city.imagery) {
    const g = groups.find(([title]) => title === p.group);
    if (g) g[1].push(p); else groups.push([p.group, [p]]);
  }
  const far = prod && zoom !== null && zoom < prod.minzoom - 0.5;
  return (
    <section className="gp-group gp-imagery">
      <div className="gp-head">
        <h3>Снимки проекта</h3>
        <Hint label="О снимках">
          Исходные многоканальные сцены и съёмка с беспилотника. Снимок ложится под слои карты.
          {prod ? ` Выбран: ${prod.title}, разрешение ${prod.res}.${prod.credit ? ` ${prod.credit}.` : ''}` : ''}
        </Hint>
      </div>
      <div className="gp-head gp-pick">
        <select value={prod?.id || ''} onChange={(e) => onPick(e.target.value)} aria-label="Снимок">
          <option value="">Без снимка</option>
          {groups.map(([title, list]) => (
            <optgroup key={title} label={title}>
              {list.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
            </optgroup>
          ))}
        </select>
        {prod?.note ? <Hint icon="!" tone="warn" label="Оговорка о качестве снимка">{prod.note}</Hint> : null}
      </div>
      {prod ? (
        <>
          {prod.composites.length > 1 ? (
            <div className="gp-head">
              <div className="gp-comp" role="radiogroup" aria-label="Цветовой синтез">
                {prod.composites.map((c) => (
                  <button key={c.id} type="button" role="radio" aria-checked={c.id === comp.id} onClick={() => onComp(c.id)}>{c.title}</button>
                ))}
              </div>
              {COMPOSITE_NOTES[comp.id] ? <Hint label="Что показывает синтез">{COMPOSITE_NOTES[comp.id]}</Hint> : null}
            </div>
          ) : null}
          {prod.legend ? (
            <div className="gp-ramp">
              <i style={{ background: `linear-gradient(90deg, ${prod.legend.map((l) => l.color).join(', ')})` }} />
              <span>{prod.legend[0].label}</span><span>{prod.legend[prod.legend.length - 1].label}</span>
            </div>
          ) : null}
          {far ? <p className="gp-filter">Снимок виден при более крупном масштабе: приблизьте карту.</p> : null}
          <label className="gp-opacity">
            Непрозрачность
            <input type="range" min="0.2" max="1" step="0.05" value={opacity} onChange={(e) => onOpacity(Number(e.target.value))} />
          </label>
          <label className="gp-bare">
            <input type="checkbox" checked={bare} onChange={(e) => onBare(e.target.checked)} />
            Только снимок, без слоёв карты
          </label>
        </>
      ) : null}
    </section>
  );
}

// График «Когда строился город»: столбцы по десятилетиям, щелчок выбирает дома десятилетия на карте
function DecadeChart({ chart, filter, onFilter }) {
  const max = Math.max(...chart.bars.map((b) => b.value), 1);
  return (
    <figure className="gp-chart">
      <figcaption className="gp-head">
        <span><b>{chart.title}</b><span>{chart.unit}</span></span>
        <Hint label="О графике">{chart.note} Щелчок по столбцу показывает дома этого десятилетия.</Hint>
      </figcaption>
      <div className="gp-bars" role="group" aria-label={chart.title}>
        {chart.bars.map((b) => (
          <button key={b.label} type="button" aria-pressed={filter === b.label}
            className={filter && filter !== b.label ? 'dim' : ''}
            onClick={() => onFilter(filter === b.label ? null : b.label)}
            title={`${b.label}: ${fmt(b.value)} тыс. м², ${b.count} домов`}>
            <span className="v">{fmt(b.value)}</span>
            <span className="gp-col" style={{ height: `${Math.max(3, (b.value / max) * 100)}%`, background: b.color }} />
            <span className="l">{b.label}</span>
          </button>
        ))}
      </div>
    </figure>
  );
}

function TableIcon() {
  return (
    <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6">
      <rect x="2" y="2.5" width="12" height="11" rx="1" /><path d="M2 6.2h12M2 9.8h12M6.5 6.2v7.3" />
    </svg>
  );
}

// Охват геометрии [минX, минY, максX, максY] для перелёта к объекту и отбора «в окне карты»
function bboxOf(geom) {
  const b = [Infinity, Infinity, -Infinity, -Infinity];
  const walk = (c) => {
    if (typeof c[0] === 'number') {
      if (c[0] < b[0]) b[0] = c[0];
      if (c[1] < b[1]) b[1] = c[1];
      if (c[0] > b[2]) b[2] = c[0];
      if (c[1] > b[3]) b[3] = c[1];
    } else c.forEach(walk);
  };
  if (geom) walk(geom.coordinates);
  return b;
}

// Подсветка объекта из таблицы: отдельный источник поверх слоёв; после смены подложки создаётся заново
const HL = 'gp-hl';
let hlWant = null; // последний запрошенный объект: применяется, когда стиль освободится
let hlWaiting = false;
function highlight(map, feature) {
  if (!map) return;
  hlWant = feature;
  const data = () => ({ type: 'FeatureCollection', features: hlWant ? [hlWant] : [] });
  if (map.getSource(HL)) { map.getSource(HL).setData(data()); return; }
  // isStyleLoaded ложно и пока грузятся тайлы; добавление источника тогда откладывается до «idle»
  if (!map.isStyleLoaded()) {
    if (!hlWaiting) {
      hlWaiting = true;
      map.once('idle', () => { hlWaiting = false; highlight(map, hlWant); });
    }
    return;
  }
  map.addSource(HL, { type: 'geojson', data: data() });
  const is = (...types) => ['in', ['geometry-type'], ['literal', types]];
  map.addLayer({ id: `${HL}-fill`, type: 'fill', source: HL, filter: is('Polygon', 'MultiPolygon'), paint: { 'fill-color': '#C2410C', 'fill-opacity': 0.25 } });
  map.addLayer({ id: `${HL}-line`, type: 'line', source: HL, filter: is('Polygon', 'MultiPolygon', 'LineString', 'MultiLineString'), paint: { 'line-color': '#C2410C', 'line-width': 3 } });
  map.addLayer({ id: `${HL}-pt`, type: 'circle', source: HL, filter: is('Point', 'MultiPoint'), paint: { 'circle-radius': 10, 'circle-color': 'rgba(0,0,0,0)', 'circle-stroke-color': '#C2410C', 'circle-stroke-width': 3 } });
}

// числа таблицы по-русски с пробелом между тысячами; год, номера и координаты без разделителя
const PLAIN_NUM = new Set(['year', 'num', 'lon', 'lat']);
const cellText = (f, v) => {
  if (v === null || v === undefined || v === '' || v === 'None' || v === 'null') return '';
  if (f === 'photos') return Number(v) > 0 ? String(v) : '';
  if (typeof v === 'number' && !PLAIN_NUM.has(f)) return v.toLocaleString('ru-RU', { maximumFractionDigits: 2 });
  return String(fmt(v));
};

// Точка внутри полигона (чётность пересечений), для выбора объекта щелчком по слитому на карте слою
function inPolygon([x, y], geom) {
  const polys = geom.type === 'Polygon' ? [geom.coordinates] : geom.type === 'MultiPolygon' ? geom.coordinates : [];
  return polys.some((rings) => {
    let inside = false;
    for (const ring of rings) {
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const [xi, yi] = ring[i];
        const [xj, yj] = ring[j];
        if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
      }
    }
    return inside;
  });
}

const ROW_H = 28;

// Атрибутивная таблица слоя, как в ГИС: строка на объект, все поля слоя. Пристыкована внизу карты на всю её
// ширину (карта над ней сжимается), высота тянется за верхний край. Строки рисуются только видимые, поэтому
// таблица держит и десятки тысяч объектов. Выбор в обе стороны: строка подсвечивает объект и приближает к нему,
// щелчок по объекту на карте выделяет его строку. Слой, слитый на карте по классам (типы поверхности), берёт
// строки из отдельного файла объектов, а геометрию для подсветки догружает порциями.
function AttrPanel({ city, layer, ver, filter, mapRef, height, minimized, onHeight, onMinimize, onPick, onClose }) {
  const table = Array.isArray(layer.table) ? { cols: layer.table.map((k) => [k, FIELD_LABELS[k] || k]) } : layer.table;
  const cols = table.cols;
  const objects = Boolean(table.src); // строки из файла объектов, геометрия порциями
  const [rows, setRows] = useState(null);
  const [q, setQ] = useState('');
  const [sort, setSort] = useState({ key: null, dir: 1 });
  const [inView, setInView] = useState(false);
  const [view, setView] = useState(null);
  const [sel, setSel] = useState(null);
  const [top, setTop] = useState(0);
  const scrollRef = useRef(null);
  const parts = useRef(new Map()); // порции геометрии: номер -> Promise с FeatureCollection
  const want = useRef(null); // последняя строка, которую просили подсветить (ответы порций приходят не по порядку)

  useEffect(() => {
    let alive = true;
    const url = `${DATA}/${city}/${objects ? table.src : layer.file}${ver}`;
    fetch(url)
      .then((r) => { if (!r.ok) throw new Error(`${url} ${r.status}`); return r.json(); })
      .then((d) => {
        if (!alive) return;
        if (objects) {
          setRows(d.rows.map((vals, i) => ({ i, p: Object.fromEntries(d.cols.map((c, k) => [c, vals[k]])), bb: d.bbox[i] })));
        } else {
          setRows(d.features.map((f, i) => ({ i, p: f.properties, bb: bboxOf(f.geometry), g: f.geometry })));
        }
      })
      .catch((e) => { console.error(e); if (alive) setRows([]); });
    return () => { alive = false; };
  }, [city, layer, ver, objects, table.src]);

  const geomOf = useCallback(async (r) => {
    if (r.g) return r.g;
    const k = Math.floor(r.i / table.chunk);
    if (!parts.current.has(k)) {
      parts.current.set(k, fetch(`${DATA}/${city}/${table.parts}/${k}.json${ver}`).then((x) => x.json()));
    }
    const fc = await parts.current.get(k);
    return fc.features[r.i % table.chunk]?.geometry || null;
  }, [city, ver, table.chunk, table.parts]);

  const show = useCallback(async (r) => {
    want.current = r ? r.i : null;
    if (!r) { highlight(mapRef.current, null); return; }
    const g = await geomOf(r);
    if (want.current === r.i && g) highlight(mapRef.current, { type: 'Feature', properties: {}, geometry: g });
  }, [geomOf, mapRef]);

  // «только в окне карты»: строки отбираются по охвату карты после каждого сдвига
  useEffect(() => {
    const map = mapRef.current;
    if (!inView || !map) return undefined;
    const upd = () => { const b = map.getBounds(); setView([b.getWest(), b.getSouth(), b.getEast(), b.getNorth()]); };
    upd();
    map.on('moveend', upd);
    return () => map.off('moveend', upd);
  }, [inView, mapRef]);

  useEffect(() => () => highlight(mapRef.current, null), [mapRef]);

  const shown = useMemo(() => {
    if (!rows) return [];
    const needle = q.trim().toLowerCase();
    let out = rows.filter((r) => {
      if (layer.filter && filter && r.p[layer.filter] !== filter) return false;
      if (inView && view && (r.bb[2] < view[0] || r.bb[0] > view[2] || r.bb[3] < view[1] || r.bb[1] > view[3])) return false;
      return !needle || cols.some(([c]) => cellText(c, r.p[c]).toLowerCase().includes(needle));
    });
    if (sort.key) {
      const k = sort.key;
      const val = (r) => (k === '#' ? r.i : r.p[k]);
      out = [...out].sort((a, b) => {
        const x = val(a);
        const y = val(b);
        if (x === null || x === undefined || x === '') return 1;
        if (y === null || y === undefined || y === '') return -1;
        return (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), 'ru', { numeric: true })) * sort.dir;
      });
    }
    return out;
  }, [rows, q, sort, inView, view, filter, layer, cols]);

  const total = rows ? rows.filter((r) => !(layer.filter && filter && r.p[layer.filter] !== filter)).length : 0;
  // ширина колонок по умолчанию: по самому длинному значению в первых строках (раскладка фиксированная, таблица
  // не прыгает при прокрутке); посетитель меняет её, потянув край заголовка, ширина запоминается для слоя
  const CH = 7.2; // ширина знака шрифта таблицы, px
  const autoW = useMemo(() => {
    const w = { '#': Math.round((String(rows?.length || 0).length + 3) * CH + 18) };
    for (const [c, label] of cols) {
      let n = label.length + 2;
      for (const r of (rows || []).slice(0, 400)) n = Math.max(n, cellText(c, r.p[c]).length);
      w[c] = Math.round((Math.min(Math.max(n, 6), 42) + 2) * CH + 18);
    }
    return w;
  }, [rows, cols]);
  const colsKey = `gp-attr-cols:${city}:${layer.id}`;
  const [userW, setUserW] = useState(() => {
    try { return JSON.parse(localStorage.getItem(colsKey) || '{}'); } catch { return {}; }
  });
  const widthOf = (c) => userW[c] || autoW[c] || 120;
  const keys = ['#', ...cols.map(([c]) => c)];
  const saveW = (next) => {
    try { localStorage.setItem(colsKey, JSON.stringify(next)); } catch { /* хранилище недоступно: ширина не запомнится */ }
  };
  const startCol = (e, c) => {
    e.preventDefault();
    e.stopPropagation();
    const x0 = e.clientX;
    const w0 = widthOf(c);
    let next = userW;
    const move = (ev) => { next = { ...userW, [c]: Math.max(40, Math.round(w0 + ev.clientX - x0)) }; setUserW(next); };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      document.body.classList.remove('gp-resizing');
      saveW(next);
    };
    document.body.classList.add('gp-resizing');
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };
  const autoCol = (c) => { const next = { ...userW }; delete next[c]; setUserW(next); saveW(next); };
  const resizer = (c, label) => (
    <span className="gp-col-rs" role="separator" aria-orientation="vertical" aria-label={`Ширина колонки «${label}»`}
      title="Потяните, чтобы изменить ширину; двойной щелчок вернёт ширину по содержимому"
      onPointerDown={(e) => startCol(e, c)} onDoubleClick={() => autoCol(c)} onClick={(e) => e.stopPropagation()} />
  );
  const numCols = useMemo(() => new Set(cols.filter(([c]) => rows?.some((r) => typeof r.p[c] === 'number')).map(([c]) => c)), [rows, cols]);

  const scrollTo = useCallback((i) => {
    const el = scrollRef.current;
    const at = shown.findIndex((r) => r.i === i);
    if (!el || at < 0) return;
    const y = at * ROW_H;
    if (y < el.scrollTop + ROW_H || y > el.scrollTop + el.clientHeight - 2 * ROW_H) el.scrollTop = Math.max(0, y - el.clientHeight / 2);
  }, [shown]);

  const fly = (r) => {
    const map = mapRef.current;
    if (!map) return;
    const bottom = Number(r.p.photos) > 0 ? 190 : 50; // лента фото встаёт над таблицей
    const h = map.getContainer().clientHeight;
    const k = 50 + bottom > h - 60 ? (h - 60) / (50 + bottom) : 1;
    const [x0, y0, x1, y1] = r.bb;
    map.fitBounds([[x0, y0], [x1, y1]], { padding: { top: 50 * k, bottom: bottom * k, left: 50, right: 50 }, maxZoom: 17, duration: 700 });
  };
  const pick = (r) => {
    setSel(r.i);
    show(r);
    fly(r);
    onPick(r.p);
  };

  // щелчок по объекту на карте выделяет его строку
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !rows) return undefined;
    const onClick = async (e) => {
      let r = null;
      const ids = hitLayerIds(city, layer).filter((id) => map.getLayer(id));
      const hits = ids.length ? map.queryRenderedFeatures(e.point, { layers: ids }) : [];
      // слой векторных тайлов несёт номер строки в свойстве oid, GeoJSON-слой: в номере объекта (generateId)
      const tagged = hits.find((h) => h.properties?.oid !== undefined);
      if (tagged) {
        r = rows[Number(tagged.properties.oid)];
      } else if (!objects) {
        const hit = hits.find((h) => h.id !== undefined);
        if (hit) r = rows[hit.id];
      } else {
        const { lng, lat } = e.lngLat;
        const cand = rows.filter((x) => lng >= x.bb[0] && lng <= x.bb[2] && lat >= x.bb[1] && lat <= x.bb[3])
          .sort((a, b) => (a.bb[2] - a.bb[0]) * (a.bb[3] - a.bb[1]) - (b.bb[2] - b.bb[0]) * (b.bb[3] - b.bb[1]))
          .slice(0, 300);
        for (const x of cand) {
          const g = await geomOf(x); // порции по очереди: обычно хватает первой
          if (g && inPolygon([lng, lat], g)) { r = x; break; }
        }
      }
      if (!r) return;
      setSel(r.i);
      show(r);
      if (minimized) onMinimize(false);
      requestAnimationFrame(() => scrollTo(r.i));
    };
    map.on('click', onClick);
    return () => map.off('click', onClick);
  }, [mapRef, rows, city, layer, objects, geomOf, show, scrollTo, minimized, onMinimize]);

  // высота: верхний край тянется мышью или пальцем, стрелки на фокусе
  const startDrag = (e) => {
    e.preventDefault();
    const y0 = e.clientY;
    const h0 = height;
    const move = (ev) => onHeight(h0 - (ev.clientY - y0));
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      document.body.classList.remove('gp-resizing-y');
    };
    document.body.classList.add('gp-resizing-y');
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };
  const keyDrag = (e) => {
    if (e.key === 'ArrowUp') { e.preventDefault(); onHeight(height + 24); }
    if (e.key === 'ArrowDown') { e.preventDefault(); onHeight(height - 24); }
  };

  const sortBy = (c) => setSort((s) => (s.key === c ? { key: c, dir: -s.dir } : { key: c, dir: 1 }));
  const n = (v) => v.toLocaleString('ru-RU');
  const count = rows ? (shown.length === total ? `${n(total)} объектов` : `${n(shown.length)} из ${n(total)}`) : 'загрузка…';
  const viewH = height; // высота панели не меньше области строк: рисуется с небольшим запасом
  const first = Math.max(0, Math.floor(top / ROW_H) - 10);
  const last = Math.min(shown.length, first + Math.ceil(viewH / ROW_H) + 20);
  const selRow = sel !== null ? rows?.[sel] : null;
  const arrow = (c) => (sort.key === c ? (sort.dir > 0 ? ' ↑' : ' ↓') : '');

  return (
    <section className={`gp-attr${minimized ? ' min' : ''}`} style={{ height: minimized ? undefined : height }} aria-label={`Атрибутивная таблица слоя «${layer.title}»`}>
      {!minimized ? (
        <div className="gp-attr-grip" role="separator" aria-orientation="horizontal" aria-label="Высота таблицы" tabIndex={0}
          aria-valuenow={Math.round(height)} onPointerDown={startDrag} onKeyDown={keyDrag} title="Потяните, чтобы изменить высоту таблицы" />
      ) : null}
      <header className="gp-attr-bar">
        <span className="gp-attr-title"><TableIcon /><b>{layer.title}</b><span>{count}</span></span>
        {!minimized ? (
          <>
            <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Поиск по таблице" aria-label="Поиск по таблице" />
            <label className="gp-attr-view"><input type="checkbox" checked={inView} onChange={(e) => setInView(e.target.checked)} />только в окне карты</label>
            {layer.filter && filter ? <span className="gp-attr-filter">{filter}</span> : null}
            <button type="button" className="gp-attr-btn" disabled={!selRow} onClick={() => selRow && fly(selRow)} title="Приблизить к выбранному объекту">К выбранному</button>
          </>
        ) : null}
        <button type="button" className="gp-attr-icon" onClick={() => onMinimize(!minimized)}
          aria-label={minimized ? 'Развернуть таблицу' : 'Свернуть таблицу'} title={minimized ? 'Развернуть' : 'Свернуть'}>{minimized ? '▴' : '▾'}</button>
        <button type="button" className="gp-attr-icon" onClick={onClose} aria-label="Закрыть таблицу" title="Закрыть">×</button>
      </header>
      {!minimized ? (
        <div className="gp-attr-scroll" ref={scrollRef} onScroll={(e) => setTop(e.currentTarget.scrollTop)} onMouseLeave={() => show(selRow)}>
          {!rows ? <p className="gp-attr-msg">Загрузка таблицы…</p> : null}
          {rows && !shown.length ? <p className="gp-attr-msg">Нет строк{q ? ' по этому запросу' : ''}.</p> : null}
          {shown.length ? (
            <table style={{ width: keys.reduce((a, c) => a + widthOf(c), 0) }}>
              <colgroup>
                {keys.map((c) => <col key={c} style={{ width: widthOf(c) }} />)}
              </colgroup>
              <thead>
                <tr>
                  <th className="num" aria-sort={sort.key === '#' ? (sort.dir > 0 ? 'ascending' : 'descending') : 'none'}>
                    <button type="button" onClick={() => sortBy('#')} title="Номер объекта в слое">№{arrow('#')}</button>
                    {resizer('#', '№')}
                  </th>
                  {cols.map(([c, label]) => (
                    <th key={c} className={numCols.has(c) ? 'num' : ''} aria-sort={sort.key === c ? (sort.dir > 0 ? 'ascending' : 'descending') : 'none'}>
                      <button type="button" onClick={() => sortBy(c)} title={label}>{label}{arrow(c)}</button>
                      {resizer(c, label)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {first > 0 ? <tr className="gp-attr-pad" style={{ height: first * ROW_H }}><td colSpan={cols.length + 1} /></tr> : null}
                {shown.slice(first, last).map((r) => (
                  <tr key={r.i} className={r.i === sel ? 'sel' : ''} tabIndex={0} onMouseEnter={() => show(r)} onClick={() => pick(r)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(r); } }}>
                    <td className="num rn">{r.i + 1}</td>
                    {cols.map(([c]) => {
                      const t = cellText(c, r.p[c]);
                      return <td key={c} className={numCols.has(c) ? 'num' : ''} title={t.length > 40 ? t : undefined}>{t}</td>;
                    })}
                  </tr>
                ))}
                {last < shown.length ? <tr className="gp-attr-pad" style={{ height: (shown.length - last) * ROW_H }}><td colSpan={cols.length + 1} /></tr> : null}
              </tbody>
            </table>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

export default function Geoportal() {
  const [params, setParams] = useSearchParams();
  const [manifest, setManifest] = useState(null);
  const [error, setError] = useState(null);
  const [basemap, setBasemap] = useState('scheme');
  const [visible, setVisibleState] = useState({});
  const [filter, setFilter] = useState(null);
  const [photos, setPhotos] = useState({});
  const [gallery, setGallery] = useState(null);
  const [shown, setShown] = useState(null);
  // выбранный снимок проекта: {city, id, comp}; непрозрачность и масштаб нужны панели
  const [scene, setScene] = useState(null);
  const [opacity, setOpacity] = useState(1);
  const [zoom, setZoom] = useState(null);
  const [bare, setBare] = useState(false); // «только снимок»: векторные слои скрыты, флажки не сбрасываются
  const [tableId, setTableId] = useState(null); // слой, чья атрибутивная таблица открыта внизу карты
  const [attrMin, setAttrMin] = useState(false); // таблица свёрнута до строки заголовка
  // высота таблицы: тянется за верхний край, запоминается в браузере (0: 40% высоты карты)
  const [attrH, setAttrH] = useState(() => {
    try { return Number(localStorage.getItem('gp-attr-h')) || 0; } catch { return 0; }
  });
  const [wrapH, setWrapH] = useState(600);
  const wrapRef = useRef(null);
  const [panelOpen, setPanelOpen] = useState(() => !window.matchMedia('(max-width: 760px)').matches);
  // ширина панели слоёв: тянется за край мышью или стрелками, запоминается в браузере
  const [panelW, setPanelW] = useState(() => {
    try { return Number(localStorage.getItem('gp-panel-w')) || 336; } catch { return 336; }
  });
  const mapRef = useRef(null);
  const boxRef = useRef(null);
  const cycleRef = useRef({ key: '', i: 0 }); // перебор совпадающих объектов повторным щелчком
  const citySlug = params.get('city') || 'muravlenko';
  const city = useMemo(() => manifest?.cities.find((c) => c.slug === citySlug) || manifest?.cities[0], [manifest, citySlug]);
  const tabs = city ? tabsOf(city) : [];
  const tab = tabs.find((t) => t.id === params.get('tab')) || tabs[0];
  const ver = manifest?.built ? `?v=${manifest.built}` : '';
  const prod = scene && city && scene.city === city.slug ? city.imagery?.find((p) => p.id === scene.id) : null;
  const comp = prod ? prod.composites.find((c) => c.id === scene.comp) || prod.composites[0] : null;

  useEffect(() => { document.title = 'Геопортал. OilGasCity'; }, []);

  useEffect(() => {
    // манифест сверяется с сервером при каждом открытии: после обновления слоёв браузер не держит старый
    fetch(`${DATA}/manifest.json`, { cache: 'no-cache' })
      .then((r) => { if (!r.ok) throw new Error(`manifest ${r.status}`); return r.json(); })
      .then((m) => {
        const v = {};
        for (const c of m.cities) for (const t of tabsOf(c)) for (const l of layersOf(t)) v[layerKey(c.slug, l.id)] = Boolean(l.default);
        setVisibleState(v);
        setManifest(m);
      })
      .catch((e) => { console.error(e); setError(e); });
  }, []);

  // карта создаётся один раз, подложка меняется через setStyle
  useEffect(() => {
    if (!manifest || mapRef.current) return undefined;
    const first = manifest.cities.find((c) => c.slug === citySlug) || manifest.cities[0];
    const map = new maplibregl.Map({
      container: boxRef.current,
      style: BASEMAPS.scheme.style,
      bounds: first.bounds,
      fitBoundsOptions: { padding: 40 },
      attributionControl: { compact: true, customAttribution: 'Данные: проект РНФ № 25-27-00022' },
    });
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: false }), 'top-right');
    map.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-left');
    // пустые углы снимков не нарезаются (вне сцены тайла нет), такие промахи не ошибка; остальное в консоль
    map.on('error', (e) => {
      if (String(e.sourceId || '').startsWith('img-') && e.tile) return;
      console.error(e.error || e);
    });
    const onZoom = () => setZoom(map.getZoom());
    map.on('load', onZoom);
    map.on('zoomend', onZoom);
    mapRef.current = map;
    window.ogcMap = map; // для отладки в консоли
    return () => { map.remove(); mapRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [manifest]);

  // видны только включённые слои текущего города и текущей вкладки
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !city || !tab) return undefined;
    const sync = () => {
      for (const c of manifest.cities) {
        for (const t of tabsOf(c)) {
          for (const l of layersOf(t)) {
            const on = c.slug === city.slug && t.id === tab.id && visible[layerKey(c.slug, l.id)] && !(bare && prod);
            if (on) addLayer(map, c.slug, l, ver);
            setVisible(map, c.slug, l, on, filter);
          }
        }
      }
    };
    // isStyleLoaded ложно и пока грузятся тайлы: тогда правка ждёт «idle», иначе она потерялась бы
    if (map.isStyleLoaded()) sync(); else map.once('idle', sync);
    map.on('style.load', sync);
    return () => { map.off('style.load', sync); map.off('idle', sync); };
  }, [city, tab, visible, manifest, filter, bare, prod, ver]);

  // снимок проекта: один продукт и один синтез за раз, растр под векторными слоями города
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !city) return undefined;
    const want = comp ? sceneKey(city.slug, prod.id, comp.id) : null;
    const sync = () => {
      const style = map.getStyle();
      for (const l of style.layers) if (l.id.startsWith('img-') && l.id !== want) map.removeLayer(l.id);
      for (const s of Object.keys(style.sources)) if (s.startsWith('img-') && s !== want) map.removeSource(s);
      if (!want) return;
      if (!map.getSource(want)) {
        map.addSource(want, {
          type: 'raster',
          // адрес тайлов абсолютный (относительный MapLibre разрешает не от страницы); через new URL нельзя:
          // он кодирует {z}/{x}/{y} и MapLibre перестаёт их подставлять
          tiles: [`${window.location.origin}${DATA}/${comp.tiles}`],
          tileSize: 256, bounds: prod.bounds, minzoom: prod.minzoom, maxzoom: prod.maxzoom,
          attribution: prod.credit || '',
        });
      }
      if (map.getLayer(want)) {
        map.setPaintProperty(want, 'raster-opacity', opacity);
      } else {
        const before = map.getStyle().layers.find((l) => l.id.startsWith(`${city.slug}-`))?.id;
        map.addLayer({ id: want, type: 'raster', source: want, paint: { 'raster-opacity': opacity, 'raster-fade-duration': 150 } }, before);
      }
    };
    if (map.isStyleLoaded()) sync(); else map.once('idle', sync);
    map.on('style.load', sync);
    return () => { map.off('style.load', sync); map.off('idle', sync); };
  }, [city, prod, comp, opacity, manifest]);

  // фото площадок и парков текущего города (photos.json из scripts/geodata/photos.py)
  useEffect(() => {
    if (!city?.photos || photos[city.slug]) return;
    fetch(`${DATA}/${city.slug}/${city.photos}${ver}`)
      .then((r) => (r.ok ? r.json() : {}))
      .then((p) => setPhotos((all) => ({ ...all, [city.slug]: p })))
      .catch((e) => console.error(e));
  }, [city, photos, ver]);

  // лента фото объекта (площадка, парк, точка описания), если у него есть снимки
  const galleryFor = useCallback((p) => {
    const g = p.fid && photos[city?.slug]?.[p.fid];
    if (!g) return null;
    // своё название объекта лучше общего заголовка, кроме заглушек («Площадка») и кодов точек (КЭ_12)
    const own = p.name;
    const generic = !own || own === 'Площадка' || own === 'Спорт' || /^К[ЭВ]_\d+$/.test(own);
    return { ...g, title: generic ? g.title : own };
  }, [photos, city]);

  // подписи по щелчку
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !city || !tab) return undefined;
    const layers = layersOf(tab).filter((l) => l.popup);
    const ids = layers.flatMap((l) => hitLayerIds(city.slug, l));
    const present = () => ids.filter((id) => map.getLayer(id) && map.getLayoutProperty(id, 'visibility') !== 'none');
    const onClick = (e) => {
      const all = map.queryRenderedFeatures(e.point, { layers: present() });
      if (!all.length) return;
      // совпадающие точки одного слоя (например, описание и точка напряжённости на одной GPS-точке):
      // повторный щелчок по тому же месту показывает следующую
      const seen = new Set();
      const hits = all.filter((h) => {
        const k = `${h.layer.id}:${h.properties.fid || h.properties.name || h.id}`;
        if (h.layer.id !== all[0].layer.id || seen.has(k)) return false;
        seen.add(k);
        return true;
      });
      const key = hits.map((h) => h.properties.fid || h.properties.name).join('|');
      const i = cycleRef.current.key === key ? (cycleRef.current.i + 1) % hits.length : 0;
      cycleRef.current = { key, i };
      const hit = hits[i];
      const layer = layers.find((l) => hitLayerIds(city.slug, l).includes(hit.layer.id));
      const more = hits.length > 1
        ? `<div class="gp-pop-more">${i + 1} из ${hits.length} в этом месте: щёлкните ещё раз, чтобы показать следующий</div>` : '';
      new maplibregl.Popup({ maxWidth: '300px' }).setLngLat(e.lngLat).setHTML(popupHtml(layer, hit.properties) + more).addTo(map);
      // у площадки или парка с фото внизу открывается лента миниатюр
      setGallery(galleryFor(hit.properties));
    };
    const onMove = (e) => {
      const n = map.queryRenderedFeatures(e.point, { layers: present() }).length;
      map.getCanvas().style.cursor = n ? 'pointer' : '';
    };
    map.on('click', onClick);
    map.on('mousemove', onMove);
    return () => { map.off('click', onClick); map.off('mousemove', onMove); };
  }, [city, tab, visible, galleryFor]);

  // высота области карты: от неё зависят пределы высоты таблицы
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(() => setWrapH(el.clientHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, [manifest]);

  // карта подстраивается под новую ширину панели
  useEffect(() => {
    const id = requestAnimationFrame(() => mapRef.current?.resize());
    try { localStorage.setItem('gp-panel-w', String(panelW)); } catch { /* хранилище недоступно: ширина не запомнится */ }
    return () => cancelAnimationFrame(id);
  }, [panelW, panelOpen]);

  const clampW = (w) => Math.round(Math.min(Math.max(w, 260), Math.min(760, window.innerWidth * 0.6)));
  const startResize = (e) => {
    e.preventDefault();
    const x0 = e.clientX;
    const w0 = panelW;
    const move = (ev) => setPanelW(clampW(w0 + ev.clientX - x0));
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      document.body.classList.remove('gp-resizing');
    };
    document.body.classList.add('gp-resizing');
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };
  const keyResize = (e) => {
    if (e.key === 'ArrowLeft') setPanelW((w) => clampW(w - 24));
    if (e.key === 'ArrowRight') setPanelW((w) => clampW(w + 24));
  };

  // смена города: перелёт к его границам
  useEffect(() => {
    const map = mapRef.current;
    if (map && city) map.fitBounds(city.bounds, { padding: 40, duration: 900 });
  }, [city]);

  const go = (next) => {
    setFilter(null);
    setGallery(null);
    setTableId(null);
    const p = { city: next.city ?? city.slug };
    const t = next.tab ?? tab?.id;
    if (t && t !== tabsOf(city)[0].id) p.tab = t;
    setParams(p);
  };
  const switchBasemap = (key) => {
    if (key === basemap || !mapRef.current) return;
    setBasemap(key);
    mapRef.current.setStyle(BASEMAPS[key].style);
  };
  const toggle = (id) => setVisibleState((v) => ({ ...v, [id]: !v[id] }));
  // таблица слоя: повторное нажатие закрывает; скрытый слой включается, чтобы строку было видно на карте
  const openTable = (l) => {
    if (tableId === l.id) { setTableId(null); return; }
    setTableId(l.id);
    setAttrMin(false);
    setVisibleState((v) => ({ ...v, [layerKey(city.slug, l.id)]: true }));
  };
  const tableLayer = tab && tableId ? layersOf(tab).find((l) => l.id === tableId && l.table) : null;
  const clampH = (h) => Math.round(Math.min(Math.max(h, 120), Math.max(120, wrapH - 120)));
  const attrHeight = clampH(attrH || wrapH * 0.4);
  const attrBottom = tableLayer ? (attrMin ? 44 : attrHeight) : 0; // карта сжимается над таблицей
  const setAttrHeight = (h) => {
    const v = clampH(h);
    setAttrH(v);
    try { localStorage.setItem('gp-attr-h', String(v)); } catch { /* хранилище недоступно: высота не запомнится */ }
  };
  // карта подстраивается под высоту таблицы
  useEffect(() => {
    const id = requestAnimationFrame(() => mapRef.current?.resize());
    return () => cancelAnimationFrame(id);
  }, [attrBottom]);
  // выбор снимка: синтез сохраняется, если он есть у нового снимка; издалека карта приближается к снимку
  const pickScene = (id) => {
    const next = id ? city.imagery.find((p) => p.id === id) : null;
    if (!next) { setScene(null); return; }
    const keep = comp && next.composites.some((c) => c.id === comp.id) ? comp.id : next.composites[0].id;
    setScene({ city: city.slug, id, comp: keep });
    const map = mapRef.current;
    if (map && map.getZoom() < next.minzoom - 0.5) {
      const cam = map.cameraForBounds(next.bounds, { padding: 40 });
      map.easeTo({ center: cam.center, zoom: Math.max(cam.zoom, next.minzoom), duration: 900 });
    }
  };

  return (
    <div className="gp">
      <header className="gp-bar">
        <Link className="gp-back" to="/">OilGasCity<span>на сайт проекта</span></Link>
        <h1><PinIcon />Геопортал</h1>
        {manifest ? (
          <nav className="gp-cities" aria-label="Город">
            {manifest.cities.map((c) => (
              <button key={c.slug} type="button" aria-pressed={c.slug === city?.slug}
                onClick={() => go({ city: c.slug })}>{c.title}</button>
            ))}
          </nav>
        ) : null}
        <button type="button" className="gp-toggle" onClick={() => setPanelOpen((o) => !o)} aria-expanded={panelOpen}>
          {panelOpen ? 'Скрыть слои' : 'Слои'}
        </button>
      </header>
      <div className="gp-body">
        {panelOpen && city && tab ? (
          <aside className="gp-panel" aria-label="Слои карты" style={{ '--panel-w': `${panelW}px` }}>
            <div className="gp-city">
              <div className="gp-head">
                <h2>{city.title}</h2>
                {tab.about || city.about ? <Hint label="О картах">{tab.about || city.about}</Hint> : null}
              </div>
              <p className="gp-region">{city.region}</p>
            </div>
            {tabs.length > 1 ? (
              <div className="gp-tabs" role="tablist" aria-label="Тема карты">
                {tabs.map((t) => (
                  <button key={t.id} type="button" role="tab" aria-selected={t.id === tab.id} onClick={() => go({ tab: t.id })}>{t.title}</button>
                ))}
              </div>
            ) : null}
            {tab.facts?.length ? (
              <ul className="gp-facts">{tab.facts.map((f, i) => <li key={i}><b>{f.value}</b>{f.label}</li>)}</ul>
            ) : null}
            {tab.chart ? <DecadeChart chart={tab.chart} filter={filter} onFilter={setFilter} /> : null}
            <div className="gp-base" role="group" aria-label="Подложка">
              {Object.entries(BASEMAPS).map(([k, b]) => (
                <button key={k} type="button" aria-pressed={k === basemap} onClick={() => switchBasemap(k)}>{b.title}</button>
              ))}
            </div>
            {city.imagery?.length ? (
              <ImageryPicker city={city} prod={prod} comp={comp} zoom={zoom} opacity={opacity} bare={bare} onPick={pickScene}
                onComp={(c) => setScene((s) => ({ ...s, comp: c }))} onOpacity={setOpacity} onBare={setBare} />
            ) : null}
            {tab.groups.map((g) => (
              <section className="gp-group" key={g.title}>
                <div className="gp-head">
                  <h3>{g.title}</h3>
                  {g.note ? <Hint label={`О группе «${g.title}»`}>{g.note}</Hint> : null}
                </div>
                {g.layers.map((l) => {
                  const id = layerKey(city.slug, l.id);
                  return (
                    <div className="gp-layer" key={id}>
                      <div className="gp-head">
                        <label>
                          <input type="checkbox" checked={Boolean(visible[id])} onChange={() => toggle(id)} />
                          {l.title}
                        </label>
                        {l.note ? <Hint label={`О слое «${l.title}»`}>{l.note}</Hint> : null}
                        {l.table || l.download ? (
                          <span className="gp-tools">
                            {l.table ? (
                              <button type="button" className="gp-tool" aria-pressed={tableId === l.id}
                                aria-label={`Таблица слоя «${l.title}»`} title="Атрибутивная таблица" onClick={() => openTable(l)}>
                                <TableIcon />
                              </button>
                            ) : null}
                            {l.download ? <Download dl={l.download} ver={ver} /> : null}
                          </span>
                        ) : null}
                      </div>
                      {visible[id] ? <Legend layer={l} filter={filter} onFilter={setFilter} /> : null}
                    </div>
                  );
                })}
              </section>
            ))}
            {filter ? <p className="gp-filter">Показаны дома: {filter}. <button type="button" onClick={() => setFilter(null)}>Показать все</button></p> : null}
            <p className="gp-source">Источник: {tab.source || city.source}. <Link to={`/cities/${city.slug}`}>Страница города</Link>, <Link to="/materials#maps">карты в материалах</Link>.</p>
          </aside>
        ) : null}
        {panelOpen && city && tab ? (
          <div className="gp-resize" role="separator" aria-orientation="vertical" aria-label="Ширина панели слоёв"
            aria-valuenow={panelW} aria-valuemin={260} aria-valuemax={760} tabIndex={0}
            onPointerDown={startResize} onKeyDown={keyResize} title="Потяните, чтобы изменить ширину панели" />
        ) : null}
        <div className="gp-map-wrap" ref={wrapRef}>
          <div className="gp-map" ref={boxRef} style={attrBottom ? { bottom: attrBottom } : undefined}>
            {error ? <p className="gp-error">Не удалось загрузить данные геопортала. Попробуйте обновить страницу.</p> : null}
          </div>
          {tableLayer && city ? (
            <AttrPanel key={`${city.slug}-${tableLayer.id}`} city={city.slug} layer={tableLayer} ver={ver} filter={filter}
              mapRef={mapRef} height={attrHeight} minimized={attrMin} onHeight={setAttrHeight} onMinimize={setAttrMin}
              onPick={(p) => setGallery(galleryFor(p))} onClose={() => setTableId(null)} />
          ) : null}
          {gallery ? <PhotoStrip gallery={gallery} onOpen={setShown} onClose={() => setGallery(null)} offset={attrBottom} /> : null}
        </div>
      </div>
      {gallery && shown !== null ? (
        <Lightbox gallery={gallery} index={shown} setIndex={setShown} onClose={() => setShown(null)} />
      ) : null}
    </div>
  );
}
