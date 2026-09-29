/**
 * Official timetable import (brief §8.3): CSV or JSON with date, fajr, sunrise, dhuhr, asr, maghrib, isha.
 * Errors name the exact row and column.
 */
import type { OfficialTimetable } from './engine';
import { PRAYER_IDS, type PrayerId } from './types';

export interface ImportError {
  row: number; // 1-based, header = row 1 for CSV
  column: string;
  message: 'missingColumn' | 'badDate' | 'badTime' | 'duplicateDate' | 'empty' | 'badJson';
}

export interface ImportResult {
  table: OfficialTimetable;
  errors: ImportError[];
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]?\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;
const COLS = ['date', ...PRAYER_IDS] as const;

function validDate(s: string): boolean {
  if (!DATE_RE.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

function splitCsvLine(line: string, sep: string): string[] {
  const out: string[] = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i]!;
    if (c === '"') {
      if (quoted && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else quoted = !quoted;
    } else if (c === sep && !quoted) {
      out.push(cur);
      cur = '';
    } else cur += c;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

function addRow(table: OfficialTimetable, errors: ImportError[], row: number, rec: Record<string, string | undefined>) {
  const date = (rec.date ?? '').trim();
  if (!validDate(date)) {
    errors.push({ row, column: 'date', message: 'badDate' });
    return;
  }
  if (table[date]) {
    errors.push({ row, column: 'date', message: 'duplicateDate' });
    return;
  }
  const entry: Partial<Record<PrayerId, string>> = {};
  for (const p of PRAYER_IDS) {
    const v = (rec[p] ?? '').trim();
    if (!v) continue; // missing prayers fall back to calculation
    if (!TIME_RE.test(v)) {
      errors.push({ row, column: p, message: 'badTime' });
      continue;
    }
    entry[p] = v;
  }
  table[date] = entry;
}

export function parseTimetable(text: string, fileName = ''): ImportResult {
  const table: OfficialTimetable = {};
  const errors: ImportError[] = [];
  const trimmed = text.replace(/^\uFEFF/, '').trim();
  if (!trimmed) return { table, errors: [{ row: 1, column: '', message: 'empty' }] };

  if (fileName.toLowerCase().endsWith('.json') || trimmed.startsWith('[') || trimmed.startsWith('{')) {
    let data: unknown;
    try {
      data = JSON.parse(trimmed);
    } catch {
      return { table, errors: [{ row: 1, column: '', message: 'badJson' }] };
    }
    const rows = Array.isArray(data) ? data : Object.entries(data as Record<string, object>).map(([date, v]) => ({ date, ...v }));
    rows.forEach((r, i) => addRow(table, errors, i + 1, r as Record<string, string>));
    return { table, errors };
  }

  const lines = trimmed.split(/\r?\n/).filter((l) => l.trim().length);
  const sep = lines[0]!.includes(';') && !lines[0]!.includes(',') ? ';' : lines[0]!.includes('\t') ? '\t' : ',';
  const header = splitCsvLine(lines[0]!, sep).map((h) => h.toLowerCase());
  for (const c of COLS) {
    if (!header.includes(c)) errors.push({ row: 1, column: c, message: 'missingColumn' });
  }
  if (errors.length) return { table, errors };
  for (let i = 1; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i]!, sep);
    const rec: Record<string, string> = {};
    header.forEach((h, k) => (rec[h] = cells[k] ?? ''));
    addRow(table, errors, i + 1, rec);
  }
  return { table, errors };
}

export function templateCsv(rows: { date: string; times: Record<PrayerId, string> }[]): string {
  return [COLS.join(','), ...rows.map((r) => [r.date, ...PRAYER_IDS.map((p) => r.times[p])].join(','))].join('\n') + '\n';
}
