/**
 * "Now", driven by the single Rust tick (one per second, aligned to the second boundary) so every window
 * shares one timer (brief §22). Falls back to a local interval if no tick arrives (e.g. early start-up).
 */
import { create } from 'zustand';
import { EV, IS_TAURI, listen } from './bridge';

interface ClockState {
  now: number;
}

export const useClock = create<ClockState>(() => ({ now: Date.now() }));

let started = false;
let lastTick = 0;

export function startClock() {
  if (started) return;
  started = true;
  void listen<{ now: number }>(EV.tick, (p) => {
    lastTick = Date.now();
    if (!document.hidden) useClock.setState({ now: p.now });
  });
  // Safety net: if ticks stop (backend busy/restarting), keep the UI alive.
  setInterval(() => {
    if (Date.now() - lastTick > 2500 && !document.hidden) {
      useClock.setState({ now: IS_TAURI ? Date.now() : useClock.getState().now + 1000 });
    }
  }, 1000);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) useClock.setState({ now: Date.now() });
  });
}

/** Current time rounded down to the second (re-renders at most once per second). */
export function useNowSecond(): number {
  return useClock((s) => Math.floor(s.now / 1000) * 1000);
}

/** Current time rounded down to the minute (for things that change slowly). */
export function useNowMinute(): number {
  return useClock((s) => Math.floor(s.now / 60_000) * 60_000);
}
