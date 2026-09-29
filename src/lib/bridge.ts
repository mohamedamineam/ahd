/**
 * Thin, typed bridge to the Rust side. In a plain browser (vite dev, screenshots, tests) every call falls
 * back to an in-page mock (./mockBackend) so the whole UI can be developed and reviewed without Tauri.
 */
import { invoke as tauriInvoke, isTauri as tauriIsTauri } from '@tauri-apps/api/core';
import { emit as tauriEmit, listen as tauriListen, type UnlistenFn } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import type { SchedulePayload } from '@/features/prayer/schedule';
import type { Place } from '@/features/prayer/types';

export const IS_TAURI: boolean = (() => {
  try {
    return tauriIsTauri();
  } catch {
    return false;
  }
})();

export type WindowKind = 'main' | 'widget' | 'mini' | 'panel' | 'pill' | 'toast';

export function windowKind(): WindowKind {
  const w = new URLSearchParams(location.search).get('w');
  if (w === 'widget' || w === 'mini' || w === 'panel' || w === 'pill' || w === 'toast') return w;
  if (IS_TAURI) {
    const label = getCurrentWindow().label;
    if (label === 'widget' || label === 'mini' || label === 'panel' || label === 'pill' || label === 'toast') return label;
  }
  return 'main';
}

// ------------------------------------------------------------------ events

export const EV = {
  tick: 'ahd://tick',
  audio: 'ahd://audio',
  adhan: 'ahd://adhan',
  navigate: 'ahd://navigate',
  settings: 'ahd://settings-changed',
  schedule: 'ahd://schedule',
  toast: 'ahd://toast',
  shortcut: 'ahd://shortcut',
  offsetsChanged: 'ahd://offsets-changed',
} as const;

export interface AudioState {
  playing: boolean;
  kind: 'adhan' | 'preview' | 'tone' | null;
  prayer: string | null;
  sound: string | null;
  /** epoch ms when playback started */
  startedAt: number | null;
  /** seconds, when known */
  duration: number | null;
  error?: string | null;
}

export interface AdhanFiredEvent {
  key: string;
  prayer: string;
  at: number;
  mode: string;
  missed: boolean;
}

export interface ToastPayload {
  prayer: string;
  at: number;
  title: string;
  body: string;
  location: string;
  timeText: string;
}

type Handler<T> = (payload: T) => void;

let mock: typeof import('./mockBackend') | null = null;
async function getMock() {
  if (!mock) mock = await import('./mockBackend');
  return mock;
}

export async function listen<T>(event: string, handler: Handler<T>): Promise<UnlistenFn> {
  if (IS_TAURI) return tauriListen<T>(event, (e) => handler(e.payload));
  return (await getMock()).listen(event, handler as Handler<unknown>);
}

export async function emit<T>(event: string, payload: T): Promise<void> {
  if (IS_TAURI) return tauriEmit(event, payload);
  return (await getMock()).emit(event, payload);
}

// ------------------------------------------------------------------ commands

export async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  if (IS_TAURI) return tauriInvoke<T>(cmd, args);
  return (await getMock()).invoke<T>(cmd, args);
}

export interface AdhanSound {
  id: string; // builtin:<id> | custom:<id>
  builtin: boolean;
  nameAr: string;
  nameEn: string;
  muezzin: string;
  muezzinAr?: string;
  isFajr: boolean;
  durationS: number;
  shortEndS: number | null;
  /** asset URL usable by <audio> for previews in the webview */
  url: string;
  license: string;
  sourceUrl: string;
}

export interface PlatformInfo {
  os: 'linux' | 'windows' | 'macos' | 'unknown';
  desktop: string | null;
  sessionType: 'x11' | 'wayland' | 'unknown' | null;
  flatpak: boolean;
  store: 'msix' | 'flatpak' | null;
  trayTitle: boolean; // Linux AppIndicator label support
  statusNotifier: boolean | null; // Linux: is a StatusNotifier host available?
  xwayland: boolean;
  version: string;
}

export const api = {
  setSchedule: (payload: SchedulePayload) => invoke<void>('set_schedule', { payload }),
  getSchedule: () => invoke<SchedulePayload | null>('get_schedule'),
  stopAdhan: () => invoke<void>('stop_adhan'),
  audioState: () => invoke<AudioState>('audio_state'),
  playPreview: (sound: string, volume: number) => invoke<void>('play_preview', { sound, volume }),
  playTone: (volume: number) => invoke<void>('play_tone', { volume }),
  testAdhan: (prayer: string) => invoke<void>('test_adhan', { prayer }),
  listAdhans: () => invoke<AdhanSound[]>('list_adhans'),
  importAdhan: (path: string, name: string, isFajr: boolean) =>
    invoke<AdhanSound>('import_adhan', { path, name, isFajr }),
  deleteAdhan: (id: string) => invoke<void>('delete_adhan', { id }),
  updateAdhan: (id: string, name: string | null, shortEndS: number | null) =>
    invoke<AdhanSound>('update_adhan', { id, name, shortEndS }),
  searchPlaces: (query: string, limit = 12) => invoke<Place[]>('search_places', { query, limit }),
  nearestPlace: (lat: number, lon: number) => invoke<Place | null>('nearest_place', { lat, lon }),
  showMain: (route?: string) => invoke<void>('show_main', { route: route ?? null }),
  openPanel: () => invoke<void>('open_panel'),
  hideWindow: () => invoke<void>('hide_self'),
  toastAction: (action: 'stop' | 'hide' | 'open') => invoke<void>('toast_action', { action }),
  applyWindows: (config: unknown) => invoke<void>('apply_windows', { config }),
  appReady: () => invoke<void>('app_ready'),
  setShortcut: (shortcut: string | null) => invoke<string | null>('set_stop_shortcut', { shortcut }),
  platformInfo: () => invoke<PlatformInfo>('platform_info'),
  relaunchX11: (enable: boolean) => invoke<void>('set_wayland_compat', { enable }),
  exportFile: (path: string, contents: string) => invoke<void>('export_file', { path, contents }),
  readImportFile: (path: string) => invoke<string>('read_import_file', { path }),
  openLogs: () => invoke<void>('open_logs_folder'),
};

// ------------------------------------------------------------------ window controls

export const win = {
  minimize: () => (IS_TAURI ? getCurrentWindow().minimize() : Promise.resolve()),
  toggleMaximize: () => (IS_TAURI ? getCurrentWindow().toggleMaximize() : Promise.resolve()),
  close: () => (IS_TAURI ? getCurrentWindow().close() : Promise.resolve()),
  hide: () => (IS_TAURI ? getCurrentWindow().hide() : Promise.resolve()),
  show: () => (IS_TAURI ? getCurrentWindow().show() : Promise.resolve()),
  startDragging: () => (IS_TAURI ? getCurrentWindow().startDragging() : Promise.resolve()),
  isMaximized: () => (IS_TAURI ? getCurrentWindow().isMaximized() : Promise.resolve(false)),
  onResized: (fn: () => void) => (IS_TAURI ? getCurrentWindow().onResized(fn) : Promise.resolve(() => {})),
};
