import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { KAABA, greatCircle } from '@/features/qibla/qibla';

/** Online map: the great-circle line from the user to the Kaaba (© OpenStreetMap contributors). */
export default function QiblaMap({ lat, lon }: { lat: number; lon: number }) {
  const el = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!el.current) return;
    const map = L.map(el.current, { zoomControl: true, worldCopyJump: true });
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);
    const path = greatCircle(lat, lon);
    const line = L.polyline(path, { color: getComputedStyle(document.documentElement).getPropertyValue('--sage-strong').trim() || '#4e6754', weight: 3 }).addTo(map);
    L.circleMarker([lat, lon], { radius: 6, color: '#4e6754', fillOpacity: 1 }).addTo(map);
    L.circleMarker([KAABA.lat, KAABA.lon], { radius: 7, color: '#26302a', fillColor: '#c9a15b', fillOpacity: 1 }).addTo(map);
    map.fitBounds(line.getBounds(), { padding: [30, 30] });
    return () => {
      map.remove();
    };
  }, [lat, lon]);
  return <div ref={el} dir="ltr" className="h-72 overflow-hidden rounded-panel border border-line-soft" />;
}
