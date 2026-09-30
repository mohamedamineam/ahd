import tzlookup from '@photostructure/tz-lookup';
import { api, invoke, IS_TAURI } from '@/lib/bridge';
import type { Place } from '@/features/prayer/types';
import type { Lang } from '@/lib/format';

export function tzFor(lat: number, lon: number): string {
  try {
    return tzlookup(lat, lon);
  } catch {
    return 'UTC';
  }
}

export async function searchOffline(query: string, limit = 12): Promise<Place[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  return api.searchPlaces(q, limit);
}

interface NominatimResult {
  place_id: number;
  osm_type: string;
  osm_id: number;
  lat: string;
  lon: string;
  name?: string;
  display_name: string;
  address?: Record<string, string>;
}

let lastOnline = 0;
const onlineCache = new Map<string, Place[]>();

/**
 * OpenStreetMap Nominatim, on explicit submit only (no type-ahead, per its usage policy), max 1 request
 * per second, results cached. In the app the request goes through Rust so it carries an identifying
 * User-Agent (`3ahd/<version> (<repo>)`), which a webview cannot set.
 */
export async function searchOnline(query: string, lang: Lang): Promise<Place[]> {
  const q = query.trim();
  const key = `${lang}:${q.toLowerCase()}`;
  const hit = onlineCache.get(key);
  if (hit) return hit;
  const wait = 1100 - (Date.now() - lastOnline);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastOnline = Date.now();
  let results: NominatimResult[];
  if (IS_TAURI) {
    results = await invoke<NominatimResult[]>('nominatim_search', { query: q, lang });
  } else {
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=8&accept-language=${lang},en&q=${encodeURIComponent(q)}`;
    results = (await (await fetch(url)).json()) as NominatimResult[];
  }
  const places = results.map((r): Place => {
    const lat = Number(r.lat);
    const lon = Number(r.lon);
    const a = r.address ?? {};
    const locality = a.suburb || a.neighbourhood || a.quarter || a.city_district || a.village || a.town || a.city || r.name || r.display_name.split(',')[0]!;
    const city = a.city || a.town || a.village || a.municipality;
    return {
      id: `osm:${r.osm_type?.[0] ?? 'n'}${r.osm_id}`,
      name: locality,
      nameAr: lang === 'ar' ? locality : undefined,
      admin1: city && city !== locality ? city : a.state,
      country: (a.country_code ?? '').toUpperCase(),
      countryName: a.country,
      lat,
      lon,
      tz: tzFor(lat, lon),
      source: 'nominatim',
    };
  });
  onlineCache.set(key, places);
  return places;
}

export async function placeFromCoordinates(lat: number, lon: number, source: Place['source'] = 'manual'): Promise<Place> {
  const near = await api.nearestPlace(lat, lon).catch(() => null);
  return {
    id: `manual:${lat.toFixed(5)},${lon.toFixed(5)}`,
    name: near ? near.name : `${lat.toFixed(4)}, ${lon.toFixed(4)}`,
    nameAr: near?.nameAr,
    admin1: near?.admin1,
    admin1Ar: near?.admin1Ar,
    country: near?.country ?? '',
    lat,
    lon,
    tz: tzFor(lat, lon),
    source,
  };
}

/** OS location service (GeoClue / Windows Location) through the webview, if the platform allows it. */
export function detectPosition(timeoutMs = 12_000): Promise<{ lat: number; lon: number }> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) return reject(new Error('unavailable'));
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lon: p.coords.longitude }),
      (e) => reject(new Error(e.message || 'denied')),
      { enableHighAccuracy: false, timeout: timeoutMs, maximumAge: 10 * 60_000 },
    );
  });
}

export function countryName(code: string | undefined, lang: Lang): string {
  if (!code) return '';
  try {
    return new Intl.DisplayNames([lang], { type: 'region' }).of(code.toUpperCase()) ?? code;
  } catch {
    return code;
  }
}

export function placeName(p: Place | null | undefined, lang: Lang): string {
  if (!p) return '';
  return lang === 'ar' ? p.nameAr || p.name : p.name;
}

export function placeSubtitle(p: Place, lang: Lang): string {
  const admin = lang === 'ar' ? p.admin1Ar || p.admin1 : p.admin1;
  const country = countryName(p.country, lang) || p.countryName || '';
  const parts = [admin, country].filter((x): x is string => !!x && x !== placeName(p, lang));
  return parts.join(lang === 'ar' ? '، ' : ', ');
}
