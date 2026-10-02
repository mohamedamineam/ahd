import { describe, expect, it } from 'vitest';
import type { TFunction } from 'i18next';
import { DEFAULT_CALC, PrayerEngine } from './engine';
import { buildSchedule } from './schedule';
import { ADHAN_PRAYERS } from './types';
import { defaultSettings, type Settings } from '@/features/settings/schema';

const setif = { lat: 36.19112, lon: 5.41373, tz: 'Africa/Algiers' };
const engine = new PrayerEngine({ place: setif, calc: { ...DEFAULT_CALC, method: 'algeria' } });
// the key plus its options, so a test can see what was asked for
const t = ((key: string, opts?: Record<string, unknown>) => (opts ? `${key} ${JSON.stringify(opts)}` : key)) as unknown as TFunction;
const now = Date.parse('2026-09-30T03:00:00Z'); // before Fajr in Sétif

function reminders(change?: (s: Settings) => void) {
  const settings = defaultSettings('en');
  change?.(settings);
  const payload = buildSchedule({ engine, settings, t, now, locationName: 'Sétif', shortEnds: {} });
  return payload.fire.filter((f) => f.kind === 'reminder' && f.key.startsWith('2026-09-30:'));
}

describe('reminder before each prayer', () => {
  const today = engine.day('2026-09-30').times;

  it('is on by default: 10 minutes before each of the five prayers, with a short tone', () => {
    const r = reminders();
    expect(r.map((f) => f.prayer)).toEqual([...ADHAN_PRAYERS]);
    for (const f of r) {
      expect(f.at).toBe(today[f.prayer as (typeof ADHAN_PRAYERS)[number]] - 10 * 60_000);
      expect(f.audio?.kind).toBe('tone');
      expect(f.notification?.title).toBe('notify.reminderTitle');
      expect(f.notification?.body).toContain('notify.before');
    }
  });

  it('can be turned off, moved, or made silent', () => {
    expect(reminders((s) => void (s.reminders.beforePrayer.enabled = false))).toEqual([]);
    const moved = reminders((s) => {
      s.reminders.beforePrayer.minutes = 25;
      s.reminders.beforePrayer.type = 'notification';
    });
    expect(moved.find((f) => f.prayer === 'asr')?.at).toBe(today.asr - 25 * 60_000);
    expect(moved.every((f) => f.audio === null)).toBe(true);
  });

  it('is not given twice when a custom reminder asks for the same moment', () => {
    const custom = (offsetMinutes: number) => (s: Settings) =>
      void s.reminders.items.push({ id: 'x', prayer: 'dhuhr', offsetMinutes, type: 'notification', message: '', enabled: true });
    expect(reminders(custom(-10)).filter((f) => f.prayer === 'dhuhr')).toHaveLength(1);
    // another moment, or with the built-in reminder off: the custom reminder counts
    expect(reminders(custom(-20)).filter((f) => f.prayer === 'dhuhr')).toHaveLength(2);
    const onlyCustom = reminders((s) => {
      custom(-10)(s);
      s.reminders.beforePrayer.enabled = false;
    });
    expect(onlyCustom.map((f) => f.key)).toEqual([`2026-09-30:reminder:x@${today.dhuhr - 10 * 60_000}`]);
  });

  it('gets a new key at a new time, so a reminder moved after it went off is armed again', () => {
    const at10 = reminders().find((f) => f.prayer === 'asr')!;
    const at25 = reminders((s) => void (s.reminders.beforePrayer.minutes = 25)).find((f) => f.prayer === 'asr')!;
    expect(at10.key).not.toBe(at25.key);
    expect(reminders().find((f) => f.prayer === 'asr')!.key).toBe(at10.key); // same settings: same key
  });
});
