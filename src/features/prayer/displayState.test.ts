import { describe, expect, it } from 'vitest';
import fixture from './__fixtures__/display-cases.json';
import { displayState, formatValue, labelKey, sinceAndUntil, type DisplaySettings } from './displayState';
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
      const s = displayState(c.now, timeline, c.settings as DisplaySettings);
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
  // six events that day, each with an elapsed start and a countdown start, except Dhuhr: its countdown starts at
  // sunrise (halfway: Fajr's countdown starts at the midpoint of the night, 00:28:50, instead of 04:32:10)
  it.each(['threshold', 'halfway'] as const)('%s: walks every second of a day without gaps and switches exactly at each boundary', (countdownStart) => {
    const settings = { countdownStart, thresholdMinutes: 30, includeSunrise: true };
    const start = Date.parse('2026-09-24T00:00:00Z');
    let prevState = displayState(start, timeline, settings)!;
    let transitions = 0;
    for (let t = start + 1000; t < start + 86_400_000; t += 1000) {
      const s = displayState(t, timeline, settings)!;
      expect(s).not.toBeNull();
      expect(s.seconds).toBeGreaterThanOrEqual(0);
      if (s.mode !== prevState.mode || s.event.at !== prevState.event.at) {
        transitions++;
        if (s.mode === 'countdown' && s.prev.id === 'sunrise') {
          // at sunrise the timer goes straight to the countdown to Dhuhr
          expect(s.prev.at).toBe(t);
          expect(s.event.id).toBe('dhuhr');
        } else if (s.mode === 'countdown') {
          // entering countdown: exactly the threshold remains, or the second half of the interval has just begun
          const remaining = s.next.at - t;
          if (countdownStart === 'threshold') expect(s.seconds).toBe(1800);
          else expect(2 * remaining <= s.next.at - s.prev.at && 2 * (remaining + 1000) > s.next.at - s.prev.at).toBe(true);
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
      // never "time since sunrise"
      expect(s.mode === 'elapsed' && s.event.id === 'sunrise').toBe(false);
      prevState = s;
    }
    expect(transitions).toBe(11);
  });

  it('progress stays within 0..1', () => {
    for (let t = Date.parse('2026-09-24T00:00:00Z'); t < Date.parse('2026-09-25T00:00:00Z'); t += 97_000) {
      const s = displayState(t, timeline, { countdownStart: 'halfway', thresholdMinutes: 30, includeSunrise: true })!;
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

describe('sinceAndUntil — both timers of the two-prayer widgets', () => {
  const prev = { id: 'dhuhr', at: Date.parse('2026-09-30T12:28:19Z') } as TimelineEvent;
  const next = { id: 'asr', at: Date.parse('2026-09-30T15:49:23Z') } as TimelineEvent;
  const fmt = { seconds: true, padHours: false, longCountdown: false };

  it('gives the time since the last prayer and until the next, whichever the single timer shows', () => {
    const now = Date.parse('2026-09-30T14:12:40.600Z');
    const { since, until } = sinceAndUntil(now, { prev, next });
    expect(formatValue(since, fmt)).toBe('+1:44:21'); // rounded down, like elapsed
    expect(formatValue(until, fmt)).toBe('−1:36:43'); // rounded up, like a countdown
    expect(formatValue(since, { ...fmt, seconds: false })).toBe('+1:44');
    expect(formatValue(until, { ...fmt, seconds: false })).toBe('−1:37');
  });

  it('matches the single timer on each side', () => {
    const settings: DisplaySettings = { countdownStart: 'halfway', thresholdMinutes: 30, includeSunrise: true };
    for (const now of [prev.at + 1000, prev.at + 3_600_000, next.at - 60_000, next.at - 1]) {
      const st = displayState(now, [prev, next], settings)!;
      const both = sinceAndUntil(now, st);
      expect(st.mode === 'elapsed' ? both.since.seconds : both.until.seconds).toBe(st.seconds);
    }
  });
});

