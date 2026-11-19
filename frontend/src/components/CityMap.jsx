import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const cityIcon = L.divIcon({
  className: 'city-marker',
  html: '<div style="width:28px;height:28px;background:linear-gradient(135deg,#0284c7,#0891b2);border:3px solid rgba(255,255,255,0.95);border-radius:50%;box-shadow:0 2px 8px rgba(2,132,199,0.4)"></div>',
  iconSize: [28, 28],
  iconAnchor: [14, 14],
  popupAnchor: [0, -16],
});

// Центр по умолчанию, пока города не загрузились: север Западной Сибири
const DEFAULT_CENTER = [63.0, 74.5];

// Тексты из CMS вставляются в HTML попапа, поэтому экранируются
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (ch) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
));

function popupHtml(city) {
  const lines = [
    `<div style="font-weight:700;font-size:14px;color:#0f172a">${esc(city.title)}</div>`,
    city.region && `<div style="font-size:12px;color:#64748b;margin:4px 0">${esc(city.region)}</div>`,
    city.founded && `<div style="font-size:12px;color:#475569">Основан: ${esc(city.founded)}</div>`,
    city.population && `<div style="font-size:12px;color:#475569">Население: ${esc(city.population)}</div>`,
    `<div style="font-size:10px;color:#94a3b8;margin-top:6px">${city.latitude.toFixed(4)}°N, ${city.longitude.toFixed(4)}°E</div>`,
  ];
  return `<div style="font-family:Inter,system-ui,sans-serif;min-width:180px">${lines.filter(Boolean).join('')}</div>`;
}

// cities: страницы городов из API (поля title, region, founded, population, latitude, longitude)
export default function CityMap({ cities = [], className = '' }) {
  const mapRef = useRef(null);

  useEffect(() => {
    if (!mapRef.current) return undefined;
    const points = cities.filter((c) => c.latitude != null && c.longitude != null);

    const map = L.map(mapRef.current, {
      center: DEFAULT_CENTER, zoom: 6,
      zoomControl: true, scrollWheelZoom: false, attributionControl: false,
    });

    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 19,
    }).addTo(map);

    L.control.attribution({ position: 'bottomright' })
      .addAttribution('© <a href="https://carto.com/">Esri, Maxar, Earthstar Geographics</a>')
      .addTo(map);

    const markers = points.map((city) => L.marker([city.latitude, city.longitude], { icon: cityIcon })
      .bindPopup(popupHtml(city), { className: 'light-popup', maxWidth: 250 })
      .addTo(map));

    // Масштаб подбирается заново при изменении размера контейнера: при анимации появления
    // карта может создаться с нулевой шириной, и тогда fitBounds уводит её на весь мир
    const fit = () => {
      if (markers.length > 1) map.fitBounds(L.featureGroup(markers).getBounds().pad(0.3), { maxZoom: 9 });
      else if (markers.length === 1) map.setView(markers[0].getLatLng(), 9);
    };
    fit();
    const ro = new ResizeObserver(() => { map.invalidateSize(); fit(); });
    ro.observe(mapRef.current);

    return () => { ro.disconnect(); map.remove(); };
  }, [cities]);

  return (
    <div className={className}>
      <div ref={mapRef} style={{ width: '100%', height: '450px', borderRadius: '0.75rem', overflow: 'hidden', border: '1px solid #e5e7eb', background: '#f8fafc' }} />
    </div>
  );
}
