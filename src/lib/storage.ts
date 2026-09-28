/**
 * Settings persistence: tauri-plugin-store (settings.json in the app config dir) in the app,
 * localStorage in a plain browser.
 */
import { IS_TAURI } from './bridge';

const LS_PREFIX = 'sakan:';

type StoreLike = {
  get<T>(key: string): Promise<T | undefined>;
  set(key: string, value: unknown): Promise<void>;
  delete(key: string): Promise<boolean>;
  save(): Promise<void>;
  clear(): Promise<void>;
};

let storePromise: Promise<StoreLike> | null = null;

async function store(): Promise<StoreLike> {
  if (!storePromise) {
    storePromise = (async () => {
      if (IS_TAURI) {
        const { load } = await import('@tauri-apps/plugin-store');
        return (await load('settings.json', { autoSave: false, defaults: {} })) as unknown as StoreLike;
      }
      const ls: StoreLike = {
        async get<T>(key: string) {
          try {
            const raw = localStorage.getItem(LS_PREFIX + key);
            return raw ? (JSON.parse(raw) as T) : undefined;
          } catch {
            return undefined;
          }
        },
        async set(key, value) {
          try {
            localStorage.setItem(LS_PREFIX + key, JSON.stringify(value));
          } catch {
            /* storage full or unavailable */
          }
        },
        async delete(key) {
          localStorage.removeItem(LS_PREFIX + key);
          return true;
        },
        async save() {},
        async clear() {
          for (const k of Object.keys(localStorage)) if (k.startsWith(LS_PREFIX)) localStorage.removeItem(k);
        },
      };
      return ls;
    })();
  }
  return storePromise;
}

export const kv = {
  async get<T>(key: string): Promise<T | undefined> {
    return (await store()).get<T>(key);
  },
  async set(key: string, value: unknown): Promise<void> {
    const s = await store();
    await s.set(key, value);
    await s.save();
  },
  async remove(key: string): Promise<void> {
    const s = await store();
    await s.delete(key);
    await s.save();
  },
  async clear(): Promise<void> {
    const s = await store();
    await s.clear();
    await s.save();
  },
};
