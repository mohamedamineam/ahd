/**
 * Library (brief §17): curated catalog (bundled, refreshable from the project repository), downloads on demand
 * through Rust (allow-listed HTTPS, size limit, sha256), and the list of downloaded books (SQLite).
 */
import { create } from 'zustand';
import bundled from '@/content/library/catalog.json';
import { db, type LibraryBook } from '@/lib/db';
import { invoke, IS_TAURI, listen } from '@/lib/bridge';

export type LibraryCategory = 'tafsir' | 'sirah' | 'aqidah' | 'tazkiyah' | 'hadith' | 'fiqh' | 'adhkar';

export interface CatalogBook {
  id: string;
  provider: 'islamhouse' | 'archive';
  islamhouseId: number | null;
  /** edition or printing, when useful */
  edition?: string;
  title: string;
  author: string;
  category: LibraryCategory;
  language: string;
  description: string;
  format: 'pdf' | 'epub';
  url: string;
  size: number;
  sizeText: string;
  page: string;
}

export interface Catalog {
  version: number;
  generated: string;
  providers: Record<CatalogBook['provider'], { name: string; url: string; terms: string }>;
  books: CatalogBook[];
}

/** Same allow-list as the downloader in src-tauri/src/library.rs. */
const ALLOWED = ['https://d1.islamhouse.com/', 'https://upload.wikimedia.org/', 'https://archive.org/download/'];

const REMOTE_CATALOG = 'https://raw.githubusercontent.com/mohamedamineam/ahd/main/src/content/library/catalog.json';

interface LibraryState {
  catalog: Catalog;
  downloaded: LibraryBook[];
  progress: Record<string, { received: number; total: number | null }>;
  errors: Record<string, string>;
  refreshing: boolean;
  load: () => Promise<void>;
  refreshCatalog: (force?: boolean) => Promise<void>;
  download: (b: CatalogBook) => Promise<void>;
  remove: (id: string) => Promise<void>;
  setLastPage: (id: string, page: number) => Promise<void>;
}

let listening = false;

export const useLibrary = create<LibraryState>((set, get) => ({
  catalog: bundled as Catalog,
  downloaded: [],
  progress: {},
  errors: {},
  refreshing: false,
  async load() {
    set({ downloaded: await db.library.books().catch(() => []) });
    if (!listening) {
      listening = true;
      void listen<{ id: string; received: number; total: number | null }>('ahd://library-progress', (p) =>
        set({ progress: { ...get().progress, [p.id]: { received: p.received, total: p.total } } }),
      );
    }
  },
  async refreshCatalog() {
    set({ refreshing: true });
    try {
      const res = await fetch(REMOTE_CATALOG, { cache: 'no-store' });
      if (res.ok) {
        const c = (await res.json()) as Catalog;
        if (c.version >= 2 && Array.isArray(c.books) && c.books.every((b) => ALLOWED.some((a) => b.url.startsWith(a)))) set({ catalog: c });
      }
    } catch {
      /* offline: keep the bundled catalog */
    } finally {
      set({ refreshing: false });
    }
  },
  async download(b) {
    if (!IS_TAURI) {
      set({ errors: { ...get().errors, [b.id]: 'desktop-only' } });
      return;
    }
    const errors = { ...get().errors };
    delete errors[b.id];
    set({ errors, progress: { ...get().progress, [b.id]: { received: 0, total: b.size || null } } });
    try {
      const r = await invoke<{ path: string; size: number; sha256: string }>('library_download', { id: b.id, url: b.url, format: b.format });
      await db.library.upsert({
        id: b.id,
        catalogId: b.id,
        title: b.title,
        author: b.author,
        format: b.format,
        path: r.path,
        size: r.size,
        sha256: r.sha256,
        lastPage: 1,
        updatedAt: Date.now(),
      });
      await get().load();
    } catch (e) {
      set({ errors: { ...get().errors, [b.id]: String(e) } });
    } finally {
      const progress = { ...get().progress };
      delete progress[b.id];
      set({ progress });
    }
  },
  async remove(id) {
    await invoke('library_delete', { id }).catch(() => {});
    await db.library.remove(id);
    await get().load();
  },
  async setLastPage(id, page) {
    const b = get().downloaded.find((x) => x.id === id);
    if (!b || b.lastPage === page) return;
    await db.library.upsert({ ...b, lastPage: page, updatedAt: Date.now() });
    set({ downloaded: get().downloaded.map((x) => (x.id === id ? { ...x, lastPage: page } : x)) });
  },
}));
