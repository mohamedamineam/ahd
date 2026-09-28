import { create } from 'zustand';
import i18n from 'i18next';
import { db, type SavedLocation } from '@/lib/db';
import { useSettings } from '@/features/settings/store';
import { defaultAsrFor, defaultMethodFor } from '@/features/prayer/methods';
import type { Place } from '@/features/prayer/types';
import { monthStyleForCountry } from '@/lib/format';
import { toast } from '@/design/components';
import { countryName } from './search';

interface LocationsState {
  saved: SavedLocation[];
  load: () => Promise<void>;
  /** Make a place current (and remember it). Adjusts the method when moving to another country. */
  choose: (place: Place, opts?: { silent?: boolean }) => Promise<void>;
  rename: (id: string, name: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

export const useLocations = create<LocationsState>((set, get) => ({
  saved: [],
  async load() {
    set({ saved: await db.locations.list().catch(() => []) });
  },
  async choose(place, opts) {
    const prev = useSettings.getState().s.location.current;
    const s = useSettings.getState().s;
    const countryChanged = !!place.country && place.country !== prev?.country;
    const methodWasDefault = !prev || s.calc.method === defaultMethodFor(prev.country);
    useSettings.getState().update((d) => {
      d.location.current = place;
      if (countryChanged && methodWasDefault) {
        d.calc.method = defaultMethodFor(place.country);
        d.calc.asr = defaultAsrFor(place.country);
        if (!prev) d.general.monthStyle = monthStyleForCountry(place.country);
      }
    });
    const existing = get().saved.find((l) => l.id === place.id);
    const entry: SavedLocation = existing ?? { id: place.id, name: '', place, createdAt: Date.now() };
    await db.locations.upsert({ ...entry, place });
    await get().load();
    if (countryChanged && methodWasDefault && prev && !opts?.silent) {
      toast(`${i18n.t('onboarding.location.method')}: ${i18n.t(`methods.${defaultMethodFor(place.country)}`)} (${countryName(place.country, useSettings.getState().s.general.language)})`, 'info');
    }
  },
  async rename(id, name) {
    const l = get().saved.find((x) => x.id === id);
    if (!l) return;
    await db.locations.upsert({ ...l, name });
    await get().load();
  },
  async remove(id) {
    await db.locations.remove(id);
    await get().load();
  },
}));
