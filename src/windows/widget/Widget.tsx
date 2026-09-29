import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/bridge';
import { useS } from '@/features/settings/store';
import { AhdMark } from '@/design/brand/AhdMark';
import { FloatCard, StopAdhanButton, useAuxWindow, useLive, useToday, useWindowsConfigLock } from '../shared';

function Ring({ progress, countdown }: { progress: number; countdown: boolean }) {
  const r = 30;
  const c = 2 * Math.PI * r;
  return (
    <svg width="76" height="76" viewBox="0 0 76 76" className="shrink-0 -rotate-90" aria-hidden>
      <circle cx="38" cy="38" r={r} fill="none" stroke="var(--line-soft)" strokeWidth="4" />
      <circle
        cx="38"
        cy="38"
        r={r}
        fill="none"
        stroke={countdown ? 'var(--ochre)' : 'var(--sage)'}
        strokeWidth="4"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - progress)}
        style={{ transition: 'stroke-dashoffset 900ms linear' }}
      />
    </svg>
  );
}

/** Main desktop widget: current state, the six times, dates (L), progress ring. */
export default function Widget() {
  useAuxWindow();
  const { t } = useTranslation();
  const cfg = useS((s) => s.widgets.main);
  const seconds = useS((s) => s.timer.secondsWidget && s.widgets.main.seconds);
  const lock = useWindowsConfigLock();
  const locked = lock.widget || cfg.locked;
  const { state, label, value, now } = useLive();
  const { payload, day, events } = useToday();
  const countdown = state?.mode === 'countdown';
  const large = cfg.size === 'L';
  const tomorrowFajr = payload?.timeline.find((e) => e.id === 'fajr' && day && e.date > day.date);
  const drag = !locked || undefined;

  return (
    <FloatCard opacity={cfg.opacity} drag={!locked} onDoubleClick={() => void api.showMain()}>
      <div className="flex h-full flex-col px-4 pt-3.5 pb-3" data-tauri-drag-region={drag}>
        <div className="flex items-center gap-2 text-[0.75rem] text-ink-muted" data-tauri-drag-region={drag}>
          <AhdMark size={16} />
          <span className="min-w-0 flex-1 truncate" data-tauri-drag-region={drag}>
            {payload?.location}
          </span>
          {large && day ? <span className="truncate">{day.hijri}</span> : null}
        </div>
        {large && day ? <div className="mt-0.5 text-end text-[0.6875rem] text-ink-faint">{day.gregorian}</div> : null}

        <div className="mt-2 flex items-center gap-3" data-tauri-drag-region={drag}>
          <div className="relative" data-tauri-drag-region={drag}>
            <Ring progress={state?.progress ?? 0} countdown={countdown} />
            <span className={clsx('absolute inset-0 m-auto h-2.5 w-2.5 rounded-full', countdown ? 'bg-ochre' : 'bg-sage')} />
          </div>
          <div className="min-w-0" data-tauri-drag-region={drag}>
            <div className="text-[0.75rem] text-ink-muted">{countdown ? t('home.untilLabel') : t('home.sinceLabel')}</div>
            <div className="font-display truncate text-[1.25rem] leading-tight text-ink">{label(state?.event)}</div>
            <bdi dir="ltr" className={clsx('tabular block text-[1.75rem] leading-tight', countdown ? 'text-ochre-strong' : 'text-sage-strong')}>
              {value({ seconds, padHours: false })}
            </bdi>
          </div>
        </div>

        <ul className="mt-3 flex flex-1 flex-col justify-center gap-0.5 border-t border-line-soft pt-2" data-tauri-drag-region={drag}>
          {events.map((e) => {
            const current = state?.prev.at === e.at;
            const next = state?.next.at === e.at;
            const passed = e.at <= now && !current;
            return (
              <li
                key={e.id}
                data-tauri-drag-region={drag}
                className={clsx('flex items-center justify-between rounded-[8px] px-2 py-[3px] text-[0.8125rem]', current && 'bg-sage-soft', next && countdown && 'bg-ochre-soft')}
              >
                <span className={clsx(passed ? 'text-ink-muted' : 'text-ink', (current || next) && 'font-semibold')}>{label(e)}</span>
                <bdi dir="ltr" className={clsx('tabular', passed ? 'text-ink-muted' : 'text-ink', (current || next) && 'font-semibold')}>
                  {e.timeText}
                </bdi>
              </li>
            );
          })}
        </ul>
        {large && tomorrowFajr ? (
          <div className="mt-1 flex justify-between px-2 text-[0.75rem] text-ink-muted">
            <span>{t('prayers.tomorrowFajr')}</span>
            <bdi dir="ltr" className="tabular">
              {tomorrowFajr.timeText}
            </bdi>
          </div>
        ) : null}
        <StopAdhanButton className="mt-2 w-full" />
      </div>
    </FloatCard>
  );
}
