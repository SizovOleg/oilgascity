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

const CITIES_DATA = [
  { name: 'Муравленко', region: 'ЯНАО', latitude: 63.79, longitude: 74.52, population: 32350, description: 'Молодой нефтегазовый город, основан в 1984 г.' },
  { name: 'Когалым', region: 'ХМАО', latitude: 62.27, longitude: 74.48, population: 68200, description: 'Город нефтяников, основан в 1976 г., центр деятельности ЛУКОЙЛ.' },
];

export default function CityMap({ className = '' }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);

  useEffect(() => {
    if (!mapRef.current) return;
    if (mapInstanceRef.current) { mapInstanceRef.current.remove(); mapInstanceRef.current = null; }

    const cities = CITIES_DATA;
    const avgLat = cities.reduce((s, c) => s + c.latitude, 0) / cities.length;
    const avgLng = cities.reduce((s, c) => s + c.longitude, 0) / cities.length;

    const map = L.map(mapRef.current, {
      center: [avgLat, avgLng], zoom: 6,
      zoomControl: true, scrollWheelZoom: false, attributionControl: false,
    });

    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 19,
    }).addTo(map);

    L.control.attribution({ position: 'bottomright' })
      .addAttribution('\u00a9 <a href="https://carto.com/">Esri, Maxar, Earthstar Geographics</a>')
      .addTo(map);

    const markers = [];
    cities.forEach((city) => {
      const marker = L.marker([city.latitude, city.longitude], { icon: cityIcon }).addTo(map);
      marker.bindPopup(
        '<div style="font-family:Inter,system-ui,sans-serif;min-width:180px">' +
        '<div style="font-weight:700;font-size:14px;color:#0f172a">' + city.name + '</div>' +
        '<div style="font-size:12px;color:#64748b;margin:4px 0">' + city.region + '</div>' +
        (city.population ? '<div style="font-size:12px;color:#475569">Население: ' + city.population.toLocaleString('ru-RU') + ' чел.</div>' : '') +
        (city.description ? '<div style="font-size:11px;color:#64748b;margin-top:6px;line-height:1.4">' + city.description + '</div>' : '') +
        '<div style="font-size:10px;color:#94a3b8;margin-top:6px">' + city.latitude.toFixed(4) + '\u00b0N, ' + city.longitude.toFixed(4) + '\u00b0E</div>' +
        '</div>',
        { className: 'light-popup', maxWidth: 250 }
      );
      markers.push(marker);
    });

    if (markers.length > 1) {
      map.fitBounds(L.featureGroup(markers).getBounds().pad(0.3));
    }

    mapInstanceRef.current = map;
    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(mapRef.current);

    return () => { ro.disconnect(); map.remove(); mapInstanceRef.current = null; };
  }, []);

  return (
    <div className={className}>
      <div ref={mapRef} style={{ width: '100%', height: '450px', borderRadius: '0.75rem', overflow: 'hidden', border: '1px solid #e5e7eb', background: '#f8fafc' }} />
    </div>
  );
}
