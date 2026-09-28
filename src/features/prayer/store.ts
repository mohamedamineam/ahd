import { create } from 'zustand';
import i18n from 'i18next';
import { PrayerEngine, localDate, type OfficialTimetable } from './engine';
import { toHijri } from './hijri';
import { buildSchedule } from './schedule';
import { ZERO_OFFSETS, type PrayerId, type PrayerOffsets } from './types';
import { useSettings } from '@/features/settings/store';
import type { Settings } from '@/features/settings/schema';
import { db } from '@/lib/db';
import { api, EV, emit, type AdhanSound } from '@/lib/bridge';
import { useClock } from '@/lib/clock';

interface PrayerState {
  engine: PrayerEngine | null;
  offsets: PrayerOffsets;
  official: OfficialTimetable;
  sounds: AdhanSound[];
  setOffset: (prayer: PrayerId, seconds: number) => Promise<void>;
  setOffsets: (offsets: PrayerOffsets) => Promise<void>;
  setOfficial: (table: OfficialTimetable) => Promise<void>;
  reloadSounds: () => Promise<void>;
}

function makeEngine(s: Settings, offsets: PrayerOffsets, official: OfficialTimetable): PrayerEngine | null {
  const place = s.location.current;
  if (!place) return null;
  return new PrayerEngine({
    place,
    tzMode: s.location.tz,
    calc: s.calc,
    offsets,
    official: s.calc.useOfficialTimetable ? official : null,
    hijriMonthOf: (d) => toHijri(d, s.calc.hijriOffset).month,
  });
}

export const usePrayer = create<PrayerState>((set, get) => ({
  engine: null,
  offsets: { ...ZERO_OFFSETS },
  official: {},
  sounds: [],
  async setOffset(prayer, seconds) {
    const id = useSettings.getState().s.location.current?.id;
    if (!id) return;
    const offsets = { ...get().offsets, [prayer]: Math.round(seconds) };
    set({ offsets, engine: makeEngine(useSettings.getState().s, offsets, get().official) });
    await db.offsets.set(id, prayer, Math.round(seconds));
    void emit(EV.offsetsChanged, { locationId: id, offsets });
  },
  async setOffsets(offsets) {
    const id = useSettings.getState().s.location.current?.id;
    if (!id) return;
    set({ offsets, engine: makeEngine(useSettings.getState().s, offsets, get().official) });
    await db.offsets.setAll(id, offsets);
    void emit(EV.offsetsChanged, { locationId: id, offsets });
  },
  async setOfficial(table) {
    const id = useSettings.getState().s.location.current?.id;
    if (!id) return;
    set({ official: table, engine: makeEngine(useSettings.getState().s, get().offsets, table) });
    await db.timetable.replace(id, table);
  },
  async reloadSounds() {
    try {
      set({ sounds: await api.listAdhans() });
    } catch {
      /* backend not ready */
    }
  },
}));

let lastKey = '';
let lastLocationId: string | undefined;
function engineKey(s: Settings) {
  return JSON.stringify([s.location, s.calc]);
}

/** Main window: load per-location data and rebuild the engine whenever its inputs change. */
export async function startPrayerStore() {
  const load = async (s: Settings) => {
    const id = s.location.current?.id;
    const offsets = id ? await db.offsets.get(id) : { ...ZERO_OFFSETS };
    const official = id ? await db.timetable.get(id) : {};
    usePrayer.setState({ offsets, official, engine: makeEngine(s, offsets, official) });
  };
  const s0 = useSettings.getState().s;
  lastKey = engineKey(s0);
  lastLocationId = s0.location.current?.id;
  await load(s0);
  void usePrayer.getState().reloadSounds();
  useSettings.subscribe((st) => {
    const key = engineKey(st.s);
    if (key === lastKey) return;
    lastKey = key;
    const id = st.s.location.current?.id;
    if (id !== lastLocationId) {
      lastLocationId = id;
      void load(st.s);
    } else {
      const { offsets, official } = usePrayer.getState();
      usePrayer.setState({ engine: makeEngine(st.s, offsets, official) });
    }
  });
}

// ------------------------------------------------------------------ schedule sync (main window)

let syncTimer: ReturnType<typeof setTimeout> | null = null;
let lastDay = '';

export function locationLabel(s: Settings): string {
  const p = s.location.current;
  if (!p) return '';
  return s.general.language === 'ar' ? p.nameAr || p.name : p.name;
}

export function syncScheduleSoon(delay = 400) {
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(syncSchedule, delay);
}

export function syncSchedule() {
  const { engine, sounds } = usePrayer.getState();
  const s = useSettings.getState().s;
  if (!engine || !s.onboarding.done) return;
  const shortEnds = Object.fromEntries(sounds.map((x) => [x.id, x.shortEndS]));
  const payload = buildSchedule({
    engine,
    settings: s,
    t: i18n.t.bind(i18n),
    now: useClock.getState().now,
    locationName: locationLabel(s),
    shortEnds,
  });
  void api.setSchedule(payload);
}

export function startScheduleSync() {
  usePrayer.subscribe(() => syncScheduleSoon());
  useSettings.subscribe(() => syncScheduleSoon());
  i18n.on('languageChanged', () => syncScheduleSoon());
  // new local day → rebuild (keeps the 35-day window rolling and the tray dates fresh)
  useClock.subscribe((c) => {
    const engine = usePrayer.getState().engine;
    if (!engine) return;
    const day = localDate(c.now, engine.zone);
    if (day !== lastDay) {
      lastDay = day;
      syncScheduleSoon(50);
    }
  });
  syncScheduleSoon(50);
}
