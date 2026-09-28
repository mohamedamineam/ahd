import { create } from 'zustand';
import { EV, emit, listen, windowKind } from '@/lib/bridge';
import { kv } from '@/lib/storage';
import { detectLanguage } from '@/i18n';
import { defaultSettings, migrateSettings, type Settings } from './schema';

interface SettingsState {
  s: Settings;
  ready: boolean;
  /** Mutate a draft copy; the result is persisted (main window) and broadcast to the other windows. */
  update: (recipe: (draft: Settings) => void) => void;
  replace: (next: Settings, broadcast?: boolean) => void;
}

const SOURCE = `${windowKind()}-${Math.random().toString(36).slice(2, 8)}`;
let saveTimer: ReturnType<typeof setTimeout> | null = null;

function persist(s: Settings) {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    void kv.set('settings', s);
  }, 250);
}

export const useSettings = create<SettingsState>((set, get) => ({
  s: defaultSettings(detectLanguage()),
  ready: false,
  update(recipe) {
    const draft = structuredClone(get().s);
    recipe(draft);
    set({ s: draft });
    persist(draft);
    void emit(EV.settings, { source: SOURCE, settings: draft });
  },
  replace(next, broadcast = true) {
    set({ s: next });
    if (broadcast) {
      persist(next);
      void emit(EV.settings, { source: SOURCE, settings: next });
    }
  },
}));

export async function loadSettings(): Promise<Settings> {
  const stored = await kv.get<unknown>('settings');
  const s = migrateSettings(stored, detectLanguage());
  useSettings.setState({ s, ready: true });
  // keep every window in sync
  void listen<{ source: string; settings: Settings }>(EV.settings, (p) => {
    if (p.source !== SOURCE) useSettings.setState({ s: migrateSettings(p.settings, p.settings.general.language) });
  });
  return s;
}

/** Shorthand selector hook. */
export function useS<T>(selector: (s: Settings) => T): T {
  return useSettings((st) => selector(st.s));
}
