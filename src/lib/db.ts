/**
 * User data (brief §19): tauri-plugin-sql (SQLite, migrations in src-tauri/src/db_migrations.rs) in the
 * app; a small JSON emulation in localStorage for the browser build. Only the main window has access.
 */
import { IS_TAURI } from './bridge';
import type { OfficialTimetable } from '@/features/prayer/engine';
import type { Place, PrayerId, PrayerOffsets } from '@/features/prayer/types';
import { ZERO_OFFSETS } from '@/features/prayer/types';

export const DB_URL = 'sqlite:ahd.db';

export interface SavedLocation {
  id: string;
  name: string;
  place: Place;
  createdAt: number;
}

export type Riwaya = 'hafs' | 'warsh';

export interface QuranPosition {
  riwaya: Riwaya;
  page: number;
  surah: number;
  ayah: number;
  scroll: number;
  updatedAt: number;
}

export interface QuranBookmark {
  slot: number; // 1..5
  name: string;
  color: string;
  riwaya: Riwaya;
  page: number;
  surah: number;
  ayah: number;
  createdAt: number;
}

export interface LibraryBook {
  id: string;
  catalogId: string;
  title: string;
  author: string;
  format: 'pdf' | 'epub';
  path: string;
  size: number;
  sha256: string;
  lastPage: number;
  updatedAt: number;
}

export interface LibraryBookmark {
  bookId: string;
  page: number;
  note: string;
  createdAt: number;
}

export interface ExportedData {
  locations: SavedLocation[];
  offsets: Record<string, PrayerOffsets>;
  timetables: Record<string, OfficialTimetable>;
  quran: { lastRead: Partial<Record<Riwaya, QuranPosition | null>>; bookmarks: QuranBookmark[] };
}

interface Backend {
  select<T>(sql: string, args?: unknown[]): Promise<T[]>;
  execute(sql: string, args?: unknown[]): Promise<void>;
}

// ------------------------------------------------------------------ Tauri backend

let tauriDb: Promise<Backend> | null = null;
function sqlBackend(): Promise<Backend> {
  if (!tauriDb) {
    tauriDb = (async () => {
      const { default: Database } = await import('@tauri-apps/plugin-sql');
      const db = await Database.load(DB_URL);
      return {
        select: <T>(sql: string, args: unknown[] = []) => db.select<T[]>(sql, args),
        execute: async (sql: string, args: unknown[] = []) => {
          await db.execute(sql, args);
        },
      };
    })();
  }
  return tauriDb;
}

// ------------------------------------------------------------------ browser emulation

const LS_KEY = 'ahd:db';
type Tables = {
  locations: SavedLocation[];
  offsets: Record<string, PrayerOffsets>;
  timetable: Record<string, OfficialTimetable>;
  lastRead: Partial<Record<Riwaya, QuranPosition>>;
  bookmarks: QuranBookmark[];
  adhkar: Record<string, Record<string, number>>;
  books: LibraryBook[];
  bookBookmarks: LibraryBookmark[];
};
const emptyTables = (): Tables => ({
  locations: [],
  offsets: {},
  timetable: {},
  lastRead: {},
  bookmarks: [],
  adhkar: {},
  books: [],
  bookBookmarks: [],
});
function lsRead(): Tables {
  try {
    return { ...emptyTables(), ...(JSON.parse(localStorage.getItem(LS_KEY) || '{}') as Partial<Tables>) };
  } catch {
    return emptyTables();
  }
}
function lsWrite(t: Tables) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(t));
  } catch {
    /* ignore */
  }
}
function lsUpdate(fn: (t: Tables) => void) {
  const t = lsRead();
  fn(t);
  lsWrite(t);
}

// ------------------------------------------------------------------ repository

export const db = {
  locations: {
    async list(): Promise<SavedLocation[]> {
      if (!IS_TAURI) return lsRead().locations;
      const rows = await (await sqlBackend()).select<{ id: string; name: string; place: string; created_at: number }>(
        'SELECT id, name, place, created_at FROM locations ORDER BY created_at',
      );
      return rows.map((r) => ({ id: r.id, name: r.name, place: JSON.parse(r.place) as Place, createdAt: r.created_at }));
    },
    async upsert(loc: SavedLocation): Promise<void> {
      if (!IS_TAURI) {
        lsUpdate((t) => {
          t.locations = [...t.locations.filter((l) => l.id !== loc.id), loc];
        });
        return;
      }
      await (await sqlBackend()).execute(
        `INSERT INTO locations (id, name, place, created_at) VALUES ($1, $2, $3, $4)
         ON CONFLICT(id) DO UPDATE SET name = excluded.name, place = excluded.place`,
        [loc.id, loc.name, JSON.stringify(loc.place), loc.createdAt],
      );
    },
    async remove(id: string): Promise<void> {
      if (!IS_TAURI) {
        lsUpdate((t) => {
          t.locations = t.locations.filter((l) => l.id !== id);
          delete t.offsets[id];
          delete t.timetable[id];
        });
        return;
      }
      const b = await sqlBackend();
      await b.execute('DELETE FROM locations WHERE id = $1', [id]);
      await b.execute('DELETE FROM prayer_offsets WHERE location_id = $1', [id]);
      await b.execute('DELETE FROM official_timetable WHERE location_id = $1', [id]);
    },
  },

  offsets: {
    async get(locationId: string): Promise<PrayerOffsets> {
      if (!IS_TAURI) return { ...ZERO_OFFSETS, ...(lsRead().offsets[locationId] ?? {}) };
      const rows = await (await sqlBackend()).select<{ prayer: PrayerId; seconds: number }>(
        'SELECT prayer, seconds FROM prayer_offsets WHERE location_id = $1',
        [locationId],
      );
      const out = { ...ZERO_OFFSETS };
      for (const r of rows) out[r.prayer] = r.seconds;
      return out;
    },
    async set(locationId: string, prayer: PrayerId, seconds: number): Promise<void> {
      if (!IS_TAURI) {
        lsUpdate((t) => {
          t.offsets[locationId] = { ...ZERO_OFFSETS, ...(t.offsets[locationId] ?? {}), [prayer]: seconds };
        });
        return;
      }
      await (await sqlBackend()).execute(
        `INSERT INTO prayer_offsets (location_id, prayer, seconds) VALUES ($1, $2, $3)
         ON CONFLICT(location_id, prayer) DO UPDATE SET seconds = excluded.seconds`,
        [locationId, prayer, seconds],
      );
    },
    async setAll(locationId: string, offsets: PrayerOffsets): Promise<void> {
      for (const [p, s] of Object.entries(offsets)) await db.offsets.set(locationId, p as PrayerId, s);
    },
  },

  timetable: {
    async get(locationId: string): Promise<OfficialTimetable> {
      if (!IS_TAURI) return lsRead().timetable[locationId] ?? {};
      const rows = await (await sqlBackend()).select<Record<string, string>>(
        'SELECT date, fajr, sunrise, dhuhr, asr, maghrib, isha FROM official_timetable WHERE location_id = $1',
        [locationId],
      );
      const out: OfficialTimetable = {};
      for (const r of rows) {
        const { date, ...times } = r;
        out[date!] = times;
      }
      return out;
    },
    async replace(locationId: string, table: OfficialTimetable): Promise<void> {
      if (!IS_TAURI) {
        lsUpdate((t) => {
          t.timetable[locationId] = table;
        });
        return;
      }
      const b = await sqlBackend();
      await b.execute('DELETE FROM official_timetable WHERE location_id = $1', [locationId]);
      for (const [date, row] of Object.entries(table)) {
        await b.execute(
          `INSERT INTO official_timetable (location_id, date, fajr, sunrise, dhuhr, asr, maghrib, isha)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [locationId, date, row.fajr ?? null, row.sunrise ?? null, row.dhuhr ?? null, row.asr ?? null, row.maghrib ?? null, row.isha ?? null],
        );
      }
    },
  },

  quran: {
    async lastRead(riwaya: Riwaya): Promise<QuranPosition | null> {
      if (!IS_TAURI) return lsRead().lastRead[riwaya] ?? null;
      const rows = await (await sqlBackend()).select<{ riwaya: Riwaya; page: number; surah: number; ayah: number; scroll: number; updated_at: number }>(
        'SELECT * FROM quran_last_read WHERE riwaya = $1',
        [riwaya],
      );
      const r = rows[0];
      return r ? { riwaya: r.riwaya, page: r.page, surah: r.surah, ayah: r.ayah, scroll: r.scroll, updatedAt: r.updated_at } : null;
    },
    async setLastRead(p: QuranPosition): Promise<void> {
      if (!IS_TAURI) {
        lsUpdate((t) => {
          t.lastRead[p.riwaya] = p;
        });
        return;
      }
      await (await sqlBackend()).execute(
        `INSERT INTO quran_last_read (riwaya, page, surah, ayah, scroll, updated_at) VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT(riwaya) DO UPDATE SET page = excluded.page, surah = excluded.surah, ayah = excluded.ayah,
           scroll = excluded.scroll, updated_at = excluded.updated_at`,
        [p.riwaya, p.page, p.surah, p.ayah, p.scroll, p.updatedAt],
      );
    },
    async clearLastRead(): Promise<void> {
      if (!IS_TAURI) {
        lsUpdate((t) => {
          t.lastRead = {};
        });
        return;
      }
      await (await sqlBackend()).execute('DELETE FROM quran_last_read');
    },
    async bookmarks(): Promise<QuranBookmark[]> {
      if (!IS_TAURI) return [...lsRead().bookmarks].sort((a, b) => a.slot - b.slot);
      const rows = await (await sqlBackend()).select<{ slot: number; name: string; color: string; riwaya: Riwaya; page: number; surah: number; ayah: number; created_at: number }>(
        'SELECT * FROM quran_bookmarks ORDER BY slot',
      );
      return rows.map((r) => ({ ...r, createdAt: r.created_at }));
    },
    async setBookmark(b: QuranBookmark): Promise<void> {
      if (b.slot < 1 || b.slot > 5) throw new Error('bookmark slot must be 1..5');
      if (!IS_TAURI) {
        lsUpdate((t) => {
          t.bookmarks = [...t.bookmarks.filter((x) => x.slot !== b.slot), b];
        });
        return;
      }
      await (await sqlBackend()).execute(
        `INSERT INTO quran_bookmarks (slot, name, color, riwaya, page, surah, ayah, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT(slot) DO UPDATE SET name = excluded.name, color = excluded.color, riwaya = excluded.riwaya,
           page = excluded.page, surah = excluded.surah, ayah = excluded.ayah, created_at = excluded.created_at`,
        [b.slot, b.name, b.color, b.riwaya, b.page, b.surah, b.ayah, b.createdAt],
      );
    },
    async removeBookmark(slot: number): Promise<void> {
      if (!IS_TAURI) {
        lsUpdate((t) => {
          t.bookmarks = t.bookmarks.filter((x) => x.slot !== slot);
        });
        return;
      }
      await (await sqlBackend()).execute('DELETE FROM quran_bookmarks WHERE slot = $1', [slot]);
    },
  },

  adhkar: {
    /** Counters of one session (e.g. "morning:2026-09-29"). Only today's and yesterday's sessions are kept. */
    async progress(session: string): Promise<Record<string, number>> {
      if (!IS_TAURI) return lsRead().adhkar[session] ?? {};
      const rows = await (await sqlBackend()).select<{ dhikr_id: string; count: number }>(
        'SELECT dhikr_id, count FROM adhkar_progress WHERE date = $1',
        [session],
      );
      return Object.fromEntries(rows.map((r) => [r.dhikr_id, r.count]));
    },
    async setCount(session: string, id: string, count: number, keepDates: string[]): Promise<void> {
      const keep = (k: string) => keepDates.some((d) => k.includes(d));
      if (!IS_TAURI) {
        lsUpdate((t) => {
          const next: Tables['adhkar'] = {};
          for (const [k, v] of Object.entries(t.adhkar)) if (keep(k)) next[k] = v;
          next[session] = { ...(next[session] ?? {}), [id]: count };
          t.adhkar = next;
        });
        return;
      }
      const b = await sqlBackend();
      const all = await b.select<{ date: string }>('SELECT DISTINCT date FROM adhkar_progress');
      for (const r of all) if (!keep(r.date)) await b.execute('DELETE FROM adhkar_progress WHERE date = $1', [r.date]);
      await b.execute(
        `INSERT INTO adhkar_progress (date, dhikr_id, count) VALUES ($1, $2, $3)
         ON CONFLICT(date, dhikr_id) DO UPDATE SET count = excluded.count`,
        [session, id, count],
      );
    },
    async reset(session: string): Promise<void> {
      if (!IS_TAURI) {
        lsUpdate((t) => {
          delete t.adhkar[session];
        });
        return;
      }
      await (await sqlBackend()).execute('DELETE FROM adhkar_progress WHERE date = $1', [session]);
    },
  },

  library: {
    async books(): Promise<LibraryBook[]> {
      if (!IS_TAURI) return lsRead().books;
      const rows = await (await sqlBackend()).select<Record<string, unknown>>('SELECT * FROM library_books ORDER BY updated_at DESC');
      return rows.map((r) => ({
        id: String(r.id),
        catalogId: String(r.catalog_id),
        title: String(r.title),
        author: String(r.author),
        format: r.format as 'pdf' | 'epub',
        path: String(r.path),
        size: Number(r.size),
        sha256: String(r.sha256),
        lastPage: Number(r.last_page),
        updatedAt: Number(r.updated_at),
      }));
    },
    async upsert(b: LibraryBook): Promise<void> {
      if (!IS_TAURI) {
        lsUpdate((t) => {
          t.books = [...t.books.filter((x) => x.id !== b.id), b];
        });
        return;
      }
      await (await sqlBackend()).execute(
        `INSERT INTO library_books (id, catalog_id, title, author, format, path, size, sha256, last_page, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT(id) DO UPDATE SET last_page = excluded.last_page, updated_at = excluded.updated_at, path = excluded.path,
           size = excluded.size, sha256 = excluded.sha256`,
        [b.id, b.catalogId, b.title, b.author, b.format, b.path, b.size, b.sha256, b.lastPage, b.updatedAt],
      );
    },
    async remove(id: string): Promise<void> {
      if (!IS_TAURI) {
        lsUpdate((t) => {
          t.books = t.books.filter((x) => x.id !== id);
          t.bookBookmarks = t.bookBookmarks.filter((x) => x.bookId !== id);
        });
        return;
      }
      const b = await sqlBackend();
      await b.execute('DELETE FROM library_books WHERE id = $1', [id]);
      await b.execute('DELETE FROM library_bookmarks WHERE book_id = $1', [id]);
    },
    async bookmarks(bookId: string): Promise<LibraryBookmark[]> {
      if (!IS_TAURI) return lsRead().bookBookmarks.filter((x) => x.bookId === bookId);
      const rows = await (await sqlBackend()).select<{ book_id: string; page: number; note: string; created_at: number }>(
        'SELECT * FROM library_bookmarks WHERE book_id = $1 ORDER BY page',
        [bookId],
      );
      return rows.map((r) => ({ bookId: r.book_id, page: r.page, note: r.note, createdAt: r.created_at }));
    },
    async addBookmark(bm: LibraryBookmark): Promise<void> {
      if (!IS_TAURI) {
        lsUpdate((t) => {
          t.bookBookmarks = [...t.bookBookmarks.filter((x) => !(x.bookId === bm.bookId && x.page === bm.page)), bm].slice(-10);
        });
        return;
      }
      const b = await sqlBackend();
      const existing = await b.select<{ n: number }>('SELECT COUNT(*) AS n FROM library_bookmarks WHERE book_id = $1', [bm.bookId]);
      if ((existing[0]?.n ?? 0) >= 10) {
        await b.execute(
          'DELETE FROM library_bookmarks WHERE rowid IN (SELECT rowid FROM library_bookmarks WHERE book_id = $1 ORDER BY created_at LIMIT 1)',
          [bm.bookId],
        );
      }
      await b.execute(
        `INSERT INTO library_bookmarks (book_id, page, note, created_at) VALUES ($1, $2, $3, $4)
         ON CONFLICT(book_id, page) DO UPDATE SET note = excluded.note`,
        [bm.bookId, bm.page, bm.note, bm.createdAt],
      );
    },
    async removeBookmark(bookId: string, page: number): Promise<void> {
      if (!IS_TAURI) {
        lsUpdate((t) => {
          t.bookBookmarks = t.bookBookmarks.filter((x) => !(x.bookId === bookId && x.page === page));
        });
        return;
      }
      await (await sqlBackend()).execute('DELETE FROM library_bookmarks WHERE book_id = $1 AND page = $2', [bookId, page]);
    },
  },

  /** Everything, for Settings → Privacy & data → Export. */
  async exportAll(): Promise<ExportedData> {
    const locations = await db.locations.list();
    const offsets: Record<string, PrayerOffsets> = {};
    const timetables: Record<string, OfficialTimetable> = {};
    for (const l of locations) {
      offsets[l.id] = await db.offsets.get(l.id);
      timetables[l.id] = await db.timetable.get(l.id);
    }
    return {
      locations,
      offsets,
      timetables,
      quran: {
        lastRead: { hafs: await db.quran.lastRead('hafs'), warsh: await db.quran.lastRead('warsh') },
        bookmarks: await db.quran.bookmarks(),
      },
    };
  },

  async importAll(data: ExportedData): Promise<void> {
    for (const l of data.locations ?? []) await db.locations.upsert(l);
    for (const [id, o] of Object.entries(data.offsets ?? {})) await db.offsets.setAll(id, o);
    for (const [id, t] of Object.entries(data.timetables ?? {})) await db.timetable.replace(id, t);
    for (const r of ['hafs', 'warsh'] as const) {
      const p = data.quran?.lastRead?.[r];
      if (p) await db.quran.setLastRead(p);
    }
    for (const b of data.quran?.bookmarks ?? []) await db.quran.setBookmark(b);
  },

  async clearAll() {
    if (!IS_TAURI) {
      localStorage.removeItem(LS_KEY);
      return;
    }
    const b = await sqlBackend();
    for (const table of [
      'locations',
      'prayer_offsets',
      'official_timetable',
      'quran_last_read',
      'quran_bookmarks',
      'adhkar_progress',
      'library_books',
      'library_bookmarks',
    ]) {
      await b.execute(`DELETE FROM ${table}`);
    }
  },
};
