import { useEffect, useState, type ReactNode } from 'react';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import { useSchedule, startScheduleStore, dayFor } from '@/features/prayer/scheduleStore';
import { displayState, formatValue, longCountdown, type DisplayState } from '@/features/prayer/displayState';
import type { ScheduleTimelineEvent } from '@/features/prayer/schedule';
import { useS } from '@/features/settings/store';
import { useClock } from '@/lib/clock';
import { api, EV, listen } from '@/lib/bridge';
import { toDigits } from '@/lib/format';
import { startAudioState, useAudio } from '@/app/shell/AdhanPlayingPill';

let started = false;
/** Common start-up for every auxiliary window. */
export function useAuxWindow(options: { transparent?: boolean } = {}) {
  useEffect(() => {
    document.documentElement.dataset.aux = options.transparent === false ? 'solid' : 'transparent';
    if (started) return;
    started = true;
    void startScheduleStore();
    startAudioState();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') void api.hideWindow();
    };
    window.addEventListener('keydown', onKey);
  }, [options.transparent]);
}

export interface LiveState {
  state: DisplayState | null;
  now: number;
  label: (e: { id: string; friday?: boolean; isFriday?: boolean } | null | undefined) => string;
  value: (opts?: { seconds?: boolean; padHours?: boolean }) => string;
  timeline: ScheduleTimelineEvent[];
}

/** Display state from the schedule held by Rust, updated by the single app tick. */
export function useLive(): LiveState {
  const { payload, events } = useSchedule();
  const now = useClock((s) => Math.floor(s.now / 1000) * 1000);
  const timer = useS((s) => s.timer);
  const digits = useS((s) => s.general.digits);
  const jumuah = useS((s) => s.calc.jumuahLabel);
  const { t } = useTranslation();
  const state = events.length ? displayState(now, events, timer) : null;
  const label: LiveState['label'] = (e) => {
    if (!e) return '';
    const friday = e.friday ?? e.isFriday ?? false;
    if (jumuah && e.id === 'dhuhr' && friday) return payload?.labels.jumuah ?? t('prayers.jumuah');
    return payload?.labels[e.id as keyof typeof payload.labels] ?? t(`prayers.${e.id}`);
  };
  const value: LiveState['value'] = (o = {}) =>
    state
      ? toDigits(formatValue(state, { seconds: o.seconds ?? true, padHours: o.padHours ?? false, longCountdown: longCountdown(timer) }), digits)
      : '—';
  return { state, now, label, value, timeline: payload?.timeline ?? [] };
}

export function useToday() {
  const payload = useSchedule((s) => s.payload);
  const now = useClock((s) => Math.floor(s.now / 60_000) * 60_000);
  const day = dayFor(payload, now);
  const events = (payload?.timeline ?? []).filter((e) => e.date === day?.date);
  return { payload, day, events, now };
}

/** Frosted card for floating windows (fills the transparent window with a small margin for the shadow). */
export function FloatCard({ children, className, opacity = 1, drag = true, onDoubleClick }: { children: ReactNode; className?: string; opacity?: number; drag?: boolean; onDoubleClick?: () => void }) {
  return (
    <div className="h-screen w-screen p-2" data-tauri-drag-region={drag || undefined}>
      <div
        data-tauri-drag-region={drag || undefined}
        onDoubleClick={onDoubleClick}
        className={clsx('relative h-full w-full overflow-hidden rounded-[18px] border border-line-soft shadow-md', className)}
        style={{ background: `color-mix(in oklab, var(--surface) ${Math.round(opacity * 100)}%, transparent)` }}
      >
        {children}
      </div>
    </div>
  );
}

export function useWindowsConfigLock() {
  const [locked, setLocked] = useState<{ widget: boolean; mini: boolean; pill: boolean }>({ widget: false, mini: false, pill: false });
  useEffect(() => {
    const un = listen<{ mainWidget: { locked: boolean }; miniWidget: { locked: boolean }; indicator: { pillLocked: boolean } }>('ahd://windows-config', (c) =>
      setLocked({ widget: c.mainWidget.locked, mini: c.miniWidget.locked, pill: c.indicator.pillLocked }),
    );
    return () => {
      void un.then((f) => f());
    };
  }, []);
  return locked;
}

export function StopAdhanButton({ className }: { className?: string }) {
  const { t } = useTranslation();
  const audio = useAudio();
  if (!audio.playing || audio.kind === 'tone') return null;
  return (
    <button
      type="button"
      onClick={() => void api.stopAdhan()}
      className={clsx('inline-flex h-9 items-center justify-center gap-2 rounded-full bg-sage-strong px-4 text-[0.875rem] font-medium text-on-sage transition-transform active:scale-95', className)}
    >
      <span className="h-2.5 w-2.5 rounded-[3px] bg-current" />
      {t('panel.stopAdhan')}
    </button>
  );
}

export { EV };
