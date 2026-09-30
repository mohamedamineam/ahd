/**
 * Elapsed / countdown state (brief §9). Pure: same inputs → same output. Ported 1:1 to Rust
 * (src-tauri/src/display.rs); both are tested against src/features/prayer/__fixtures__/display-cases.json.
 *
 *  prev = latest event with time ≤ now, next = first event with time > now.
 *  prev is sunrise            → countdown to next (sunrise is not a prayer: nothing to count from it)
 *  halfway:   2·(next − now) ≤ next − prev  → countdown to next (the second half of the interval)
 *  threshold: next − now ≤ threshold        → countdown to next
 *  otherwise                  → elapsed since prev (value = elapsed, rounded down to the second)
 *  Countdown values are the remaining time, rounded up to the second.
 *  At next.time exactly the state is "elapsed +0:00" for next (the adhan fires at that instant).
 */
import type { PrayerId, TimelineEvent } from './types';

/** When the timer switches from the time since the last prayer to the time until the next one. */
export type CountdownStart = 'halfway' | 'threshold';

export interface DisplaySettings {
  countdownStart: CountdownStart;
  /** Used with countdownStart 'threshold'. */
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

  const remainingMs = next.at - now;
  const span = next.at - prev.at;
  const progress = span > 0 ? Math.min(1, Math.max(0, (now - prev.at) / span)) : 0;
  // halfway compares 2 × remaining with the span: exact in integers, like the Rust port
  const countdown =
    prev.id === 'sunrise' ||
    (settings.countdownStart === 'halfway' ? 2 * remainingMs <= span : remainingMs <= settings.thresholdMinutes * 60_000);

  if (countdown) {
    return { mode: 'countdown', event: next, prev, next, seconds: Math.ceil(remainingMs / 1000), progress };
  }
  return { mode: 'elapsed', event: prev, prev, next, seconds: Math.floor((now - prev.at) / 1000), progress };
}

/** Name key for an event: Dhuhr on Friday is shown as Jumuʿah (when enabled). */
export function labelKey(event: Pick<TimelineEvent, 'id' | 'isFriday'>, jumuah = true): PrayerId | 'jumuah' {
  return jumuah && event.id === 'dhuhr' && event.isFriday ? 'jumuah' : event.id;
}

export interface ValueFormat {
  /** Show seconds in elapsed mode and in countdowns of an hour or more (main window, widget; optional in the taskbar). */
  seconds: boolean;
  /** Pad hours to two digits in elapsed mode ("+01:12:40" on the dial, "+1:12" in the taskbar). */
  padHours: boolean;
  /** Countdown always uses h:mm:ss (instead of mm:ss), for a steady width when the threshold is more than an hour. */
  longCountdown: boolean;
}

/** Fixed h:mm:ss countdowns only for a threshold above an hour (the halfway countdown changes format at one hour). */
export const longCountdown = (s: Pick<DisplaySettings, 'countdownStart' | 'thresholdMinutes'>) => s.countdownStart === 'threshold' && s.thresholdMinutes > 60;

const pad2 = (n: number) => (n < 10 ? `0${n}` : String(n));

/** Signed value with a true minus sign (U+2212). Digits are Western here; localise with `toDigits`. */
export function formatValue(state: Pick<DisplayState, 'mode' | 'seconds'>, fmt: ValueFormat): string {
  const s = state.seconds;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (state.mode === 'countdown') {
    // an hour or more left: h:mm:ss, or h:mm (minutes rounded up) where seconds are off; the last hour is always mm:ss
    if (h > 0 && !fmt.seconds) {
      const mins = Math.ceil(s / 60);
      return `−${Math.floor(mins / 60)}:${pad2(mins % 60)}`;
    }
    if (fmt.longCountdown || h > 0) return `−${h}:${pad2(m)}:${pad2(sec)}`;
    return `−${pad2(Math.floor(s / 60))}:${pad2(sec)}`;
  }
  const hh = fmt.padHours ? pad2(h) : String(h);
  return fmt.seconds ? `+${hh}:${pad2(m)}:${pad2(sec)}` : `+${hh}:${pad2(m)}`;
}
