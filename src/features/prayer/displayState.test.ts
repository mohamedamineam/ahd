import { describe, expect, it } from 'vitest';
import fixture from './__fixtures__/display-cases.json';
import { displayState, formatValue, labelKey } from './displayState';
import type { TimelineEvent } from './types';

const timeline = fixture.timeline as unknown as TimelineEvent[];

interface Expected {
  mode: 'elapsed' | 'countdown';
  event: string;
  eventAt: number;
  seconds: number;
  value?: string;
  valueShort?: string;
  isFriday?: boolean;
  longCountdown?: boolean;
}

describe('displayState — shared fixture cases (also run by the Rust port)', () => {
  for (const c of fixture.cases) {
    it(c.name, () => {
      const s = displayState(c.now, timeline, c.settings);
      const exp = c.expected as Expected | null;
      if (exp === null) {
        expect(s).toBeNull();
        return;
      }
      expect(s).not.toBeNull();
      expect(s!.mode).toBe(exp.mode);
      expect(s!.event.id).toBe(exp.event);
      expect(s!.event.at).toBe(exp.eventAt);
      expect(s!.seconds).toBe(exp.seconds);
      if (exp.isFriday !== undefined) expect(s!.event.isFriday).toBe(exp.isFriday);
      if (exp.value) {
        expect(formatValue(s!, { seconds: true, padHours: true, longCountdown: !!exp.longCountdown })).toBe(exp.value);
      }
      if (exp.valueShort) {
        expect(formatValue(s!, { seconds: false, padHours: false, longCountdown: false })).toBe(exp.valueShort);
      }
    });
  }
});

describe('displayState — invariants', () => {
  it('walks every second of a day without gaps and switches exactly at each boundary', () => {
    const settings = { thresholdMinutes: 30, includeSunrise: true };
    const start = Date.parse('2026-09-24T00:00:00Z');
    let prevState = displayState(start, timeline, settings)!;
    let transitions = 0;
    for (let t = start + 1000; t < start + 86_400_000; t += 1000) {
      const s = displayState(t, timeline, settings)!;
      expect(s).not.toBeNull();
      expect(s.seconds).toBeGreaterThanOrEqual(0);
      if (s.mode !== prevState.mode || s.event.at !== prevState.event.at) {
        transitions++;
        if (s.mode === 'countdown') {
          // entering countdown: exactly threshold seconds remain
          expect(s.seconds).toBe(1800);
        } else {
          // entering elapsed at a prayer time: +0
          expect(s.seconds).toBe(0);
          expect(s.event.at).toBe(t);
        }
      } else if (s.mode === 'elapsed') {
        expect(s.seconds).toBe(prevState.seconds + 1);
      } else {
        expect(s.seconds).toBe(prevState.seconds - 1);
      }
      prevState = s;
    }
    // six events that day, each has a countdown start and an elapsed start
    expect(transitions).toBe(12);
  });

  it('progress stays within 0..1', () => {
    for (let t = Date.parse('2026-09-24T00:00:00Z'); t < Date.parse('2026-09-25T00:00:00Z'); t += 97_000) {
      const s = displayState(t, timeline, { thresholdMinutes: 30, includeSunrise: true })!;
      expect(s.progress).toBeGreaterThanOrEqual(0);
      expect(s.progress).toBeLessThanOrEqual(1);
    }
  });

  it('labels Dhuhr on Friday as Jumuah (setting on) and keeps Dhuhr otherwise', () => {
    const friday = timeline.find((e) => e.id === 'dhuhr' && e.isFriday)!;
    const thursday = timeline.find((e) => e.id === 'dhuhr' && !e.isFriday)!;
    expect(labelKey(friday)).toBe('jumuah');
    expect(labelKey(friday, false)).toBe('dhuhr');
    expect(labelKey(thursday)).toBe('dhuhr');
  });

  it('formats the taskbar value without seconds', () => {
    expect(formatValue({ mode: 'elapsed', seconds: 4360 }, { seconds: false, padHours: false, longCountdown: false })).toBe('+1:12');
    expect(formatValue({ mode: 'countdown', seconds: 1799 }, { seconds: false, padHours: false, longCountdown: false })).toBe('−29:59');
  });
});
