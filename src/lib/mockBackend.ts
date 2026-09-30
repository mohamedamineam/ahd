/**
 * Browser stand-in for the Rust backend (development, screenshots, e2e smoke tests). It emulates the
 * scheduler tick, event bus, audio playback, the adhan list and a small offline place list. The real
 * implementations live in src-tauri/src/*.rs.
 */
import adhanJson from '../../assets/adhan/adhan.json';
import type { AudioState, AdhanSound, PlatformInfo } from './bridge';
import type { SchedulePayload } from '@/features/prayer/schedule';
import type { Place } from '@/features/prayer/types';

type Handler = (payload: unknown) => void;
const handlers = new Map<string, Set<Handler>>();
const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('ahd-mock') : null;

channel?.addEventListener('message', (e: MessageEvent<{ event: string; payload: unknown }>) => {
  handlers.get(e.data.event)?.forEach((h) => h(e.data.payload));
});

export async function listen(event: string, handler: Handler) {
  if (!handlers.has(event)) handlers.set(event, new Set());
  handlers.get(event)!.add(handler);
  return () => handlers.get(event)?.delete(handler);
}

export async function emit(event: string, payload: unknown) {
  handlers.get(event)?.forEach((h) => h(payload));
  channel?.postMessage({ event, payload });
}

// ---------------------------------------------------------------- clock (second-aligned)

const SPEED = Number(new URLSearchParams(location.search).get('speed') ?? '1') || 1;
const FAKE_NOW = new URLSearchParams(location.search).get('now');
const t0 = Date.now();
const base = FAKE_NOW ? Date.parse(FAKE_NOW) : t0;
export const mockNow = () => base + (Date.now() - t0) * SPEED;

function scheduleTick() {
  const delay = 1000 - (Date.now() % 1000) + 5;
  setTimeout(() => {
    void emit('ahd://tick', { now: mockNow() });
    checkFire();
    scheduleTick();
  }, delay);
}
scheduleTick();

// ---------------------------------------------------------------- schedule + firing

let schedule: SchedulePayload | null = null;
const fired = new Set<string>();

function checkFire() {
  if (!schedule) return;
  const now = mockNow();
  for (const ev of schedule.fire) {
    if (ev.at > now || fired.has(ev.key)) continue;
    fired.add(ev.key);
    if (now - ev.at > 3 * 60_000) continue;
    if (ev.kind === 'adhan') {
      void emit('ahd://adhan', { key: ev.key, prayer: ev.prayer, at: ev.at, mode: ev.audio?.kind ?? 'silent', missed: false });
      if (ev.audio && ev.audio.kind === 'adhan') void play(ev.audio.sound, ev.audio.volume, 'adhan', ev.prayer);
    }
  }
}

// ---------------------------------------------------------------- audio

const ASSET_BASE = '/__assets/adhan/';
interface AdhanEntry {
  id: string;
  name_ar: string;
  name_en: string;
  muezzin: string;
  muezzin_ar?: string;
  file: string;
  is_fajr: boolean;
  duration_s: number;
  short_end_s: number | null;
  source_url: string;
  license: string;
}
const builtins: AdhanSound[] = (adhanJson.adhans as AdhanEntry[]).map((a) => ({
  id: `builtin:${a.id}`,
  builtin: true,
  nameAr: a.name_ar,
  nameEn: a.name_en,
  muezzin: a.muezzin,
  muezzinAr: a.muezzin_ar,
  isFajr: a.is_fajr,
  durationS: a.duration_s,
  shortEndS: a.short_end_s,
  url: ASSET_BASE + a.file,
  license: a.license,
  sourceUrl: a.source_url,
}));

let audio: HTMLAudioElement | null = null;
let audioState: AudioState = { playing: false, kind: null, prayer: null, sound: null, startedAt: null, duration: null };

function setAudioState(s: AudioState) {
  audioState = s;
  void emit('ahd://audio', s);
}

async function play(sound: string, volume: number, kind: 'adhan' | 'preview' | 'tone', prayer: string | null = null) {
  stopAudio();
  const s = builtins.find((b) => b.id === sound) ?? builtins[0]!;
  audio = new Audio(s.url);
  audio.volume = Math.max(0, Math.min(1, volume));
  audio.onended = () => setAudioState({ ...audioState, playing: false, kind: null });
  try {
    await audio.play();
    setAudioState({ playing: true, kind, prayer, sound: s.id, startedAt: mockNow(), duration: s.durationS });
  } catch {
    setAudioState({ playing: false, kind: null, prayer: null, sound: null, startedAt: null, duration: null, error: 'autoplay' });
  }
}

function stopAudio() {
  if (audio) {
    audio.pause();
    audio = null;
  }
  if (audioState.playing) setAudioState({ playing: false, kind: null, prayer: null, sound: null, startedAt: null, duration: null });
}

// ---------------------------------------------------------------- places (tiny sample for dev only)

const P = (id: string, name: string, nameAr: string, country: string, lat: number, lon: number, tz: string, admin1?: string, admin1Ar?: string): Place => ({
  id: `geonames:${id}`,
  name,
  nameAr,
  country,
  lat,
  lon,
  tz,
  admin1,
  admin1Ar,
  source: 'geonames',
});

const SAMPLE_PLACES: Place[] = [
  P('2481697', 'Sétif', 'سطيف', 'DZ', 36.19112, 5.41373, 'Africa/Algiers', 'Sétif', 'سطيف'),
  P('2507480', 'Algiers', 'الجزائر', 'DZ', 36.73225, 3.08746, 'Africa/Algiers', 'Algiers', 'الجزائر'),
  P('2485926', 'Oran', 'وهران', 'DZ', 35.69906, -0.63588, 'Africa/Algiers', 'Oran', 'وهران'),
  P('2501152', 'Constantine', 'قسنطينة', 'DZ', 36.365, 6.61472, 'Africa/Algiers', 'Constantine', 'قسنطينة'),
  P('2538475', 'Rabat', 'الرباط', 'MA', 34.01325, -6.83255, 'Africa/Casablanca'),
  P('2553604', 'Casablanca', 'الدار البيضاء', 'MA', 33.58831, -7.61138, 'Africa/Casablanca'),
  P('2464470', 'Tunis', 'تونس', 'TN', 36.81897, 10.16579, 'Africa/Tunis'),
  P('104515', 'Mecca', 'مكة المكرمة', 'SA', 21.42664, 39.82563, 'Asia/Riyadh'),
  P('109223', 'Medina', 'المدينة المنورة', 'SA', 24.46861, 39.61417, 'Asia/Riyadh'),
  P('360630', 'Cairo', 'القاهرة', 'EG', 30.06263, 31.24967, 'Africa/Cairo'),
  P('745044', 'Istanbul', 'إسطنبول', 'TR', 41.01384, 28.94966, 'Europe/Istanbul'),
  P('2643743', 'London', 'لندن', 'GB', 51.50853, -0.12574, 'Europe/London'),
  P('2988507', 'Paris', 'باريس', 'FR', 48.85341, 2.3488, 'Europe/Paris'),
  P('1642911', 'Jakarta', 'جاكرتا', 'ID', -6.21462, 106.84513, 'Asia/Jakarta'),
  P('6167865', 'Toronto', 'تورونتو', 'CA', 43.70011, -79.4163, 'America/Toronto'),
  P('3143244', 'Oslo', 'أوسلو', 'NO', 59.91273, 10.74609, 'Europe/Oslo'),
];

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ًͯ-ٰٟ]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي');

// ---------------------------------------------------------------- commands

export async function invoke<T>(cmd: string, args: Record<string, unknown> = {}): Promise<T> {
  switch (cmd) {
    case 'set_schedule':
      schedule = args.payload as SchedulePayload;
      void emit('ahd://schedule', schedule);
      return undefined as T;
    case 'get_schedule':
      return schedule as T;
    case 'stop_adhan':
      stopAudio();
      return undefined as T;
    case 'audio_state':
      return audioState as T;
    case 'play_preview':
      await play(String(args.sound), Number(args.volume ?? 0.8), 'preview');
      return undefined as T;
    case 'play_tone':
      return undefined as T;
    case 'test_adhan': {
      const now = mockNow();
      void emit('ahd://adhan', { key: `test:${now}`, prayer: args.prayer, at: now, mode: 'full', missed: false });
      await play(builtins[0]!.id, 0.8, 'adhan', String(args.prayer));
      return undefined as T;
    }
    case 'list_adhans':
      return builtins as T;
    case 'search_places': {
      const q = norm(String(args.query ?? '').trim());
      if (!q) return [] as T;
      return SAMPLE_PLACES.filter((p) => norm(p.name).includes(q) || norm(p.nameAr ?? '').includes(q)).slice(0, Number(args.limit ?? 12)) as T;
    }
    case 'nearest_place': {
      const lat = Number(args.lat);
      const lon = Number(args.lon);
      let best: Place | null = null;
      let bd = Infinity;
      for (const p of SAMPLE_PLACES) {
        const d = (p.lat - lat) ** 2 + (p.lon - lon) ** 2;
        if (d < bd) {
          bd = d;
          best = p;
        }
      }
      return best as T;
    }
    case 'platform_info':
      return {
        // browser preview of the Windows-only settings: ?os=windows
        os: new URLSearchParams(location.search).get('os') === 'windows' ? 'windows' : 'linux',
        desktop: 'browser',
        sessionType: 'x11',
        flatpak: false,
        store: null,
        trayTitle: true,
        statusNotifier: true,
        xwayland: false,
        version: '0.1.0',
      } satisfies PlatformInfo as T;
    case 'taskbar_is_light':
      // browser preview of the taskbar pill: ?taskbar=light|dark
      return (new URLSearchParams(location.search).get('taskbar') === 'light') as T;
    case 'set_stop_shortcut':
      return (args.shortcut ?? null) as T;
    case 'read_import_file':
      throw new Error('File import is only available in the desktop app.');
    case 'toast_payload': {
      // browser preview of the adhan window
      const ar = (localStorage.getItem('ahd:settings') ?? '').includes('"language":"ar"');
      return {
        prayer: 'maghrib',
        prayerLabel: ar ? 'المغرب' : 'Maghrib',
        at: Date.now(),
        title: ar ? 'المغرب' : 'Maghrib',
        body: '',
        location: ar ? 'سطيف' : 'Sétif',
        timeText: '18:27',
        autoHideSeconds: 60,
        audible: true,
      } as T;
    }
    default:
      // window management and other native-only commands are no-ops in the browser
      return undefined as T;
  }
}
