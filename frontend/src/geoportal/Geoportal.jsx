// Геопортал: полноэкранная карта MapLibre со слоями по картам статей проекта и вкладкой жилого фонда.
// Состав вкладок, слоёв, стили, легенды и графики приходят из /geodata/manifest.json
// (scripts/geodata/build_geodata.py), поэтому новый слой добавляется без правки этого кода.
import { useEffect, useMemo, useRef, useState } from 'react';
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
  house_type: 'Тип', source: 'Контур', note: 'Описание',
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
function PhotoStrip({ gallery, onOpen, onClose }) {
  const ref = useRef(null);
  const scroll = (d) => ref.current?.scrollBy({ left: d * ref.current.clientWidth * 0.8, behavior: 'smooth' });
  return (
    <section className="gp-strip" aria-label={`Фото: ${gallery.title}`}>
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

function labelLayer(id, src, field) {
  return {
    id: `${id}-label`, type: 'symbol', source: src,
    layout: { 'text-field': ['get', field], 'text-font': ['Noto Sans Regular'], 'text-size': 12, 'text-offset': [0, 1], 'text-anchor': 'top' },
    paint: { 'text-color': '#14242B', 'text-halo-color': '#fff', 'text-halo-width': 1.4 },
  };
}

function addLayer(map, city, layer) {
  const id = layerKey(city, layer.id);
  if (!map.getSource(id)) {
    if (layer.type === 'image') {
      map.addSource(id, { type: 'image', url: `${DATA}/${city}/${layer.file}`, coordinates: layer.coordinates });
    } else {
      map.addSource(id, { type: 'geojson', data: `${DATA}/${city}/${layer.file}` });
    }
  }
  for (const l of styleLayers(city, layer)) if (!map.getLayer(l.id)) map.addLayer(l);
}

function setVisible(map, city, layer, visible, filter) {
  for (const l of styleLayers(city, layer)) {
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
      <h3>Снимки проекта</h3>
      <p className="gp-note">Исходные многоканальные сцены и съёмка с беспилотника. Снимок ложится под слои карты.</p>
      <select value={prod?.id || ''} onChange={(e) => onPick(e.target.value)} aria-label="Снимок">
        <option value="">Без снимка</option>
        {groups.map(([title, list]) => (
          <optgroup key={title} label={title}>
            {list.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
          </optgroup>
        ))}
      </select>
      {prod ? (
        <>
          {prod.composites.length > 1 ? (
            <div className="gp-comp" role="radiogroup" aria-label="Цветовой синтез">
              {prod.composites.map((c) => (
                <button key={c.id} type="button" role="radio" aria-checked={c.id === comp.id} onClick={() => onComp(c.id)}>{c.title}</button>
              ))}
            </div>
          ) : null}
          {COMPOSITE_NOTES[comp.id] ? <p className="gp-note">{COMPOSITE_NOTES[comp.id]}</p> : null}
          {prod.legend ? (
            <div className="gp-ramp">
              <i style={{ background: `linear-gradient(90deg, ${prod.legend.map((l) => l.color).join(', ')})` }} />
              <span>{prod.legend[0].label}</span><span>{prod.legend[prod.legend.length - 1].label}</span>
            </div>
          ) : null}
          <p className="gp-note">Разрешение {prod.res}.{prod.credit ? ` ${prod.credit}.` : ''}</p>
          {prod.note ? <p className="gp-caveat">{prod.note}</p> : null}
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
      <figcaption><b>{chart.title}</b><span>{chart.unit}</span></figcaption>
      <div className="gp-bars" role="group" aria-label={chart.title}>
        {chart.bars.map((b) => (
          <button key={b.label} type="button" aria-pressed={filter === b.label}
            className={filter && filter !== b.label ? 'dim' : ''}
            onClick={() => onFilter(filter === b.label ? null : b.label)}
            title={`${b.label}: ${fmt(b.value)} тыс. м², ${b.count} домов`}>
            <span className="v">{fmt(b.value)}</span>
            <span className="bar" style={{ height: `${Math.max(3, (b.value / max) * 100)}%`, background: b.color }} />
            <span className="l">{b.label}</span>
          </button>
        ))}
      </div>
      <p className="gp-note">{chart.note} Щелчок по столбцу показывает дома этого десятилетия.</p>
    </figure>
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
            if (on) addLayer(map, c.slug, l);
            setVisible(map, c.slug, l, on, filter);
          }
        }
      }
    };
    // isStyleLoaded ложно и пока грузятся тайлы: тогда правка ждёт «idle», иначе она потерялась бы
    if (map.isStyleLoaded()) sync(); else map.once('idle', sync);
    map.on('style.load', sync);
    return () => { map.off('style.load', sync); map.off('idle', sync); };
  }, [city, tab, visible, manifest, filter, bare, prod]);

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
    fetch(`${DATA}/${city.slug}/${city.photos}`, { cache: 'no-cache' })
      .then((r) => (r.ok ? r.json() : {}))
      .then((p) => setPhotos((all) => ({ ...all, [city.slug]: p })))
      .catch((e) => console.error(e));
  }, [city, photos]);

  // подписи по щелчку
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !city || !tab) return undefined;
    const layers = layersOf(tab).filter((l) => l.popup);
    const ids = layers.flatMap((l) => {
      const base = layerKey(city.slug, l.id);
      return l.type === 'fill' ? [`${base}-fill`] : [base];
    });
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
      const layer = layers.find((l) => hit.layer.id === layerKey(city.slug, l.id) || hit.layer.id === `${layerKey(city.slug, l.id)}-fill`);
      const more = hits.length > 1
        ? `<div class="gp-pop-more">${i + 1} из ${hits.length} в этом месте: щёлкните ещё раз, чтобы показать следующий</div>` : '';
      new maplibregl.Popup({ maxWidth: '300px' }).setLngLat(e.lngLat).setHTML(popupHtml(layer, hit.properties) + more).addTo(map);
      // у площадки или парка с фото внизу открывается лента миниатюр
      const g = hit.properties.fid && photos[city.slug]?.[hit.properties.fid];
      // своё название объекта лучше общего заголовка, кроме заглушек («Площадка») и кодов точек (КЭ_12)
      const own = hit.properties.name;
      const generic = !own || own === 'Площадка' || own === 'Спорт' || /^К[ЭВ]_\d+$/.test(own);
      setGallery(g ? { ...g, title: generic ? g.title : own } : null);
    };
    const onMove = (e) => {
      const n = map.queryRenderedFeatures(e.point, { layers: present() }).length;
      map.getCanvas().style.cursor = n ? 'pointer' : '';
    };
    map.on('click', onClick);
    map.on('mousemove', onMove);
    return () => { map.off('click', onClick); map.off('mousemove', onMove); };
  }, [city, tab, visible, photos]);

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
              <h2>{city.title}</h2>
              <p className="gp-region">{city.region}</p>
            </div>
            {tabs.length > 1 ? (
              <div className="gp-tabs" role="tablist" aria-label="Тема карты">
                {tabs.map((t) => (
                  <button key={t.id} type="button" role="tab" aria-selected={t.id === tab.id} onClick={() => go({ tab: t.id })}>{t.title}</button>
                ))}
              </div>
            ) : null}
            <p className="gp-about">{tab.about || city.about}</p>
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
                <h3>{g.title}</h3>
                {g.note ? <p className="gp-note">{g.note}</p> : null}
                {g.layers.map((l) => {
                  const id = layerKey(city.slug, l.id);
                  return (
                    <div className="gp-layer" key={id}>
                      <label>
                        <input type="checkbox" checked={Boolean(visible[id])} onChange={() => toggle(id)} />
                        {l.title}
                      </label>
                      {visible[id] ? <Legend layer={l} filter={filter} onFilter={setFilter} /> : null}
                      {visible[id] && l.note ? <p className="gp-note">{l.note}</p> : null}
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
        <div className="gp-map-wrap">
          <div className="gp-map" ref={boxRef}>
            {error ? <p className="gp-error">Не удалось загрузить данные геопортала. Попробуйте обновить страницу.</p> : null}
          </div>
          {gallery ? <PhotoStrip gallery={gallery} onOpen={setShown} onClose={() => setGallery(null)} /> : null}
        </div>
      </div>
      {gallery && shown !== null ? (
        <Lightbox gallery={gallery} index={shown} setIndex={setShown} onClose={() => setShown(null)} />
      ) : null}
    </div>
  );
}
