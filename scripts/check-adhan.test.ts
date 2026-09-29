import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { checkAdhan } from './check-adhan.ts';

describe('adhan catalogue', () => {
  it('has a complete entry for every bundled audio file', () => {
    expect(checkAdhan(join(import.meta.dirname, '../assets/adhan'), false)).toEqual([]);
  });
  it('ships 5 adhans: 3 regular and 2 for Fajr', () => {
    const meta = JSON.parse(readFileSync(join(import.meta.dirname, '../assets/adhan/adhan.json'), 'utf8')) as { adhans: { is_fajr: boolean }[] };
    expect(meta.adhans).toHaveLength(5);
    expect(meta.adhans.filter((a) => a.is_fajr)).toHaveLength(2);
  });
});
