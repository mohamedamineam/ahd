import { describe, expect, it } from 'vitest';
import en from './en.json';
import ar from './ar.json';

const PLURAL = /_(zero|one|two|few|many|other|plus|minus)$/;

function keys(obj: unknown, prefix = ''): string[] {
  if (!obj || typeof obj !== 'object') return [prefix];
  return Object.entries(obj as Record<string, unknown>).flatMap(([k, v]) => keys(v, prefix ? `${prefix}.${k}` : k));
}

const norm = (list: string[]) => new Set(list.map((k) => k.replace(PLURAL, '')));

describe('i18n', () => {
  it('has the same keys in Arabic and English (plural forms normalised)', () => {
    const a = norm(keys(ar));
    const e = norm(keys(en));
    const missingInAr = [...e].filter((k) => !a.has(k));
    const missingInEn = [...a].filter((k) => !e.has(k));
    expect(missingInAr, 'missing in ar.json').toEqual([]);
    expect(missingInEn, 'missing in en.json').toEqual([]);
  });

  it('provides all six Arabic plural forms wherever English has plurals', () => {
    const arKeys = new Set(keys(ar));
    const bases = new Set(keys(en).filter((k) => /_(one|other)$/.test(k)).map((k) => k.replace(PLURAL, '')));
    for (const b of bases) {
      for (const form of ['zero', 'one', 'two', 'few', 'many', 'other']) {
        expect(arKeys.has(`${b}_${form}`), `${b}_${form}`).toBe(true);
      }
    }
  });

  it('keeps interpolation variables consistent', () => {
    const vars = (s: string) => new Set([...s.matchAll(/{{\s*(\w+)/g)].map((m) => m[1]));
    const flat = (o: unknown, p = ''): [string, string][] =>
      o && typeof o === 'object'
        ? Object.entries(o as Record<string, unknown>).flatMap(([k, v]) => flat(v, p ? `${p}.${k}` : k))
        : [[p, String(o)]];
    const arMap = new Map(flat(ar).map(([k, v]) => [k.replace(PLURAL, ''), v]));
    for (const [k, v] of flat(en)) {
      const base = k.replace(PLURAL, '');
      const other = arMap.get(base);
      if (!other) continue;
      const ev = vars(v);
      ev.delete('count');
      const av = vars(other);
      av.delete('count');
      expect([...av].sort(), base).toEqual([...ev].sort());
    }
  });
});
