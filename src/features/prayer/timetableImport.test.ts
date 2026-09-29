import { describe, expect, it } from 'vitest';
import { parseTimetable, templateCsv } from './timetableImport';

describe('official timetable import', () => {
  it('parses a valid CSV', () => {
    const r = parseTimetable('date,fajr,sunrise,dhuhr,asr,maghrib,isha\n2026-09-23,05:05,06:28,12:34,15:59,18:37,19:57\n');
    expect(r.errors).toEqual([]);
    expect(r.table['2026-09-23']?.maghrib).toBe('18:37');
  });

  it('accepts semicolons, seconds and a BOM', () => {
    const r = parseTimetable('﻿date;fajr;sunrise;dhuhr;asr;maghrib;isha\n2026-09-23;05:05:30;06:28;12:34;15:59;18:37;19:57');
    expect(r.errors).toEqual([]);
    expect(r.table['2026-09-23']?.fajr).toBe('05:05:30');
  });

  it('names the exact row and column of each error', () => {
    const r = parseTimetable('date,fajr,sunrise,dhuhr,asr,maghrib,isha\n2026-02-30,05:05,06:28,12:34,15:59,18:37,19:57\n2026-09-24,5h05,06:28,12:34,15:59,18:37,19:57\n2026-09-24,05:05,06:28,12:34,15:59,18:37,19:57\n2026-09-24,05:05,06:28,12:34,15:59,18:37,19:57');
    expect(r.errors).toContainEqual({ row: 2, column: 'date', message: 'badDate' });
    expect(r.errors).toContainEqual({ row: 3, column: 'fajr', message: 'badTime' });
    expect(r.errors).toContainEqual({ row: 5, column: 'date', message: 'duplicateDate' });
  });

  it('reports missing columns in the header', () => {
    const r = parseTimetable('date,fajr,dhuhr\n2026-09-24,05:05,12:34');
    expect(r.errors.map((e) => e.column)).toEqual(['sunrise', 'asr', 'maghrib', 'isha']);
  });

  it('parses JSON arrays and objects', () => {
    expect(parseTimetable('[{"date":"2026-09-23","fajr":"05:05"}]', 'x.json').table['2026-09-23']?.fajr).toBe('05:05');
    expect(parseTimetable('{"2026-09-23":{"isha":"19:57"}}').table['2026-09-23']?.isha).toBe('19:57');
    expect(parseTimetable('{oops').errors[0]?.message).toBe('badJson');
  });

  it('round-trips the template', () => {
    const csv = templateCsv([{ date: '2026-09-23', times: { fajr: '05:05', sunrise: '06:28', dhuhr: '12:34', asr: '15:59', maghrib: '18:37', isha: '19:57' } }]);
    expect(parseTimetable(csv).errors).toEqual([]);
  });
});
