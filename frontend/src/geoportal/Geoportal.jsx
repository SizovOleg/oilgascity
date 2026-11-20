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
    title: 'Снимок',
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
  house_type: 'Тип', source: 'Контур',
};

const layerKey = (city, id) => `${city}-${id}`;
const fmt = (v) => (typeof v === 'number' ? String(v).replace('.', ',') : v);

// Старый манифест без вкладок читается как одна вкладка
const tabsOf = (city) => city.tabs || [{ id: 'green', title: 'Слои', groups: city.groups || [] }];
const layersOf = (tab) => tab.groups.flatMap((g) => g.layers);

function popupHtml(layer, props) {
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const rows = (layer.popup || []).filter((f) => props[f] !== null && props[f] !== undefined && props[f] !== '' && props[f] !== 'None' && props[f] !== 'null');
  const title = rows.find((f) => f === 'name' || f === 'address' || f === 'formation');
  const body = rows.filter((f) => f !== title)
    .map((f) => `<div><span>${FIELD_LABELS[f] || f}</span> ${esc(fmt(props[f]))}</div>`).join('');
  return `<div class="gp-pop"><b>${esc(title ? props[title] : layer.title)}</b>${body}<small>${esc(layer.title)}</small></div>`;
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
  const [panelOpen, setPanelOpen] = useState(() => !window.matchMedia('(max-width: 760px)').matches);
  // ширина панели слоёв: тянется за край мышью или стрелками, запоминается в браузере
  const [panelW, setPanelW] = useState(() => {
    try { return Number(localStorage.getItem('gp-panel-w')) || 336; } catch { return 336; }
  });
  const mapRef = useRef(null);
  const boxRef = useRef(null);
  const citySlug = params.get('city') || 'muravlenko';
  const city = useMemo(() => manifest?.cities.find((c) => c.slug === citySlug) || manifest?.cities[0], [manifest, citySlug]);
  const tabs = city ? tabsOf(city) : [];
  const tab = tabs.find((t) => t.id === params.get('tab')) || tabs[0];

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
            const on = c.slug === city.slug && t.id === tab.id && visible[layerKey(c.slug, l.id)];
            if (on) addLayer(map, c.slug, l);
            setVisible(map, c.slug, l, on, filter);
          }
        }
      }
    };
    if (map.isStyleLoaded()) sync();
    map.on('style.load', sync);
    return () => map.off('style.load', sync);
  }, [city, tab, visible, manifest, filter]);

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
      const hits = map.queryRenderedFeatures(e.point, { layers: present() });
      if (!hits.length) return;
      const hit = hits[0];
      const layer = layers.find((l) => hit.layer.id === layerKey(city.slug, l.id) || hit.layer.id === `${layerKey(city.slug, l.id)}-fill`);
      new maplibregl.Popup({ maxWidth: '300px' }).setLngLat(e.lngLat).setHTML(popupHtml(layer, hit.properties)).addTo(map);
    };
    const onMove = (e) => {
      const n = map.queryRenderedFeatures(e.point, { layers: present() }).length;
      map.getCanvas().style.cursor = n ? 'pointer' : '';
    };
    map.on('click', onClick);
    map.on('mousemove', onMove);
    return () => { map.off('click', onClick); map.off('mousemove', onMove); };
  }, [city, tab, visible]);

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
        <div className="gp-map" ref={boxRef}>
          {error ? <p className="gp-error">Не удалось загрузить данные геопортала. Попробуйте обновить страницу.</p> : null}
        </div>
      </div>
    </div>
  );
}
