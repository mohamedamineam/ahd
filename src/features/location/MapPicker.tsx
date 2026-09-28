import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Place } from '@/features/prayer/types';

/** Online map (OpenStreetMap tiles, with the required attribution) to place a pin precisely. */
export default function MapPicker({ initial, onPick, height = 288 }: { initial: Place | null; onPick: (lat: number, lon: number) => void; height?: number }) {
  const el = useRef<HTMLDivElement>(null);
  const pick = useRef(onPick);
  pick.current = onPick;
  useEffect(() => {
    if (!el.current) return;
    const center: L.LatLngExpression = initial ? [initial.lat, initial.lon] : [21.4225, 39.8262];
    const map = L.map(el.current, { zoomControl: true, attributionControl: true }).setView(center, initial ? 12 : 3);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);
    const icon = L.divIcon({
      className: '',
      html: '<div style="width:22px;height:22px;border-radius:999px;background:var(--sage-strong);border:3px solid var(--surface-raised);box-shadow:0 2px 8px rgba(0,0,0,.3)"></div>',
      iconSize: [22, 22],
      iconAnchor: [11, 11],
    });
    const marker = L.marker(center, { draggable: true, icon }).addTo(map);
    marker.on('dragend', () => {
      const p = marker.getLatLng();
      pick.current(p.lat, p.lng);
    });
    map.on('click', (e: L.LeafletMouseEvent) => {
      marker.setLatLng(e.latlng);
      pick.current(e.latlng.lat, e.latlng.lng);
    });
    return () => {
      map.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <div ref={el} dir="ltr" style={{ height }} className="overflow-hidden rounded-[12px] border border-line-soft" />;
}
