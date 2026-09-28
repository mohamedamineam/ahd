/**
 * Elapsed / countdown state (brief §9). Pure: same inputs → same output. Ported 1:1 to Rust
 * (src-tauri/src/display.rs); both are tested against src/features/prayer/__fixtures__/display-cases.json.
 *
 *  prev = latest event with time ≤ now, next = first event with time > now.
 *  next − now ≤ threshold  → countdown to next  (value = remaining, rounded up to the second)
 *  otherwise               → elapsed since prev (value = elapsed, rounded down to the second)
 *  At next.time exactly the state is "elapsed +0:00" for next (the adhan fires at that instant).
 */
import type { PrayerId, TimelineEvent } from './types';

export interface DisplaySettings {
  thresholdMinutes: number;
  includeSunrise: boolean;
}

export type DisplayMode = 'elapsed' | 'countdown';

export interface DisplayState {
  mode: DisplayMode;
  /** The prayer the label shows: prev in elapsed mode, next in countdown mode. */
  event: TimelineEvent;
  prev: TimelineEvent;
  next: TimelineEvent;
  /** Whole seconds shown: elapsed (floor) or remaining (ceil). Never negative. */
  seconds: number;
  /** 0..1 position of now between prev and next. */
  progress: number;
}

export function displayState(
  now: number,
  events: readonly TimelineEvent[],
  settings: DisplaySettings,
): DisplayState | null {
  const list = settings.includeSunrise ? events : events.filter((e) => e.id !== 'sunrise');
  // events are sorted ascending by time; binary search for the first event strictly after now
  let lo = 0;
  let hi = list.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (list[mid]!.at <= now) lo = mid + 1;
    else hi = mid;
  }
  const prev = list[lo - 1];
  const next = list[lo];
  if (!prev || !next) return null;

  const thresholdMs = settings.thresholdMinutes * 60_000;
  const remainingMs = next.at - now;
  const span = next.at - prev.at;
  const progress = span > 0 ? Math.min(1, Math.max(0, (now - prev.at) / span)) : 0;

  if (remainingMs <= thresholdMs) {
    return { mode: 'countdown', event: next, prev, next, seconds: Math.ceil(remainingMs / 1000), progress };
  }
  return { mode: 'elapsed', event: prev, prev, next, seconds: Math.floor((now - prev.at) / 1000), progress };
}

/** Name key for an event: Dhuhr on Friday is shown as Jumuʿah (when enabled). */
export function labelKey(event: Pick<TimelineEvent, 'id' | 'isFriday'>, jumuah = true): PrayerId | 'jumuah' {
  return jumuah && event.id === 'dhuhr' && event.isFriday ? 'jumuah' : event.id;
}

export interface ValueFormat {
  /** Show seconds in elapsed mode (main window, widget; optional in the taskbar). */
  seconds: boolean;
  /** Pad hours to two digits in elapsed mode ("+01:12:40" on the dial, "+1:12" in the taskbar). */
  padHours: boolean;
  /** Countdown uses h:mm:ss (instead of mm:ss) when the threshold is more than an hour. */
  longCountdown: boolean;
}

const pad2 = (n: number) => (n < 10 ? `0${n}` : String(n));

/** Signed value with a true minus sign (U+2212). Digits are Western here; localise with `toDigits`. */
export function formatValue(state: Pick<DisplayState, 'mode' | 'seconds'>, fmt: ValueFormat): string {
  const s = state.seconds;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (state.mode === 'countdown') {
    if (fmt.longCountdown) return `−${h}:${pad2(m)}:${pad2(sec)}`;
    return `−${pad2(Math.floor(s / 60))}:${pad2(sec)}`;
  }
  const hh = fmt.padHours ? pad2(h) : String(h);
  return fmt.seconds ? `+${hh}:${pad2(m)}:${pad2(sec)}` : `+${hh}:${pad2(m)}`;
}
