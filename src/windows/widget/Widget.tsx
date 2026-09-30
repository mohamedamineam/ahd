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

/** Main desktop widget, in three types: 1 standard (state, ring and the times), 2 panel (dates, all times, Open app),
 *  3 wide (state and the times side by side). */
export default function Widget() {
  useAuxWindow();
  const cfg = useS((s) => s.widgets.main);
  const lock = useWindowsConfigLock();
  const locked = lock.widget || cfg.locked;
  return (
    <FloatCard opacity={cfg.opacity} drag={!locked} onDoubleClick={() => void api.showMain()}>
      {cfg.style === 'panel' ? <PanelType drag={!locked} /> : cfg.style === 'wide' ? <WideType drag={!locked} /> : <StandardType drag={!locked} />}
    </FloatCard>
  );
}

/** Type 1: current state with the progress ring, the day's times; L adds the dates and tomorrow's Fajr. */
function StandardType({ drag: canDrag }: { drag: boolean }) {
  const { t } = useTranslation();
  const cfg = useS((s) => s.widgets.main);
  const seconds = useS((s) => s.timer.secondsWidget && s.widgets.main.seconds);
  const { state, label, value, now } = useLive();
  const { payload, day, events } = useToday();
  const countdown = state?.mode === 'countdown';
  const large = cfg.size === 'L';
  const tomorrowFajr = payload?.timeline.find((e) => e.id === 'fajr' && day && e.date > day.date);
  const drag = canDrag || undefined;

  return (
    <div className="flex h-full flex-col px-4 pt-3.5 pb-3" data-tauri-drag-region={drag}>
      <div className="flex items-center gap-2 text-[0.75rem] leading-4 text-ink-muted" data-tauri-drag-region={drag}>
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

      <ul className="mt-3 flex min-h-0 flex-1 flex-col justify-center gap-0.5 border-t border-line-soft pt-2" data-tauri-drag-region={drag}>
        {events.map((e) => {
          const current = state?.prev.at === e.at;
          const next = state?.next.at === e.at;
          const passed = e.at <= now && !current;
          return (
            <li
              key={e.id}
              data-tauri-drag-region={drag}
              className={clsx('flex items-center justify-between rounded-[8px] px-2 py-[3px] text-[0.8125rem] leading-[18px]', current && 'bg-sage-soft', next && countdown && 'bg-ochre-soft')}
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
        <div className="mt-1 flex justify-between px-2 text-[0.75rem] leading-4 text-ink-muted">
          <span>{t('prayers.tomorrowFajr')}</span>
          <bdi dir="ltr" className="tabular">
            {tomorrowFajr.timeText}
          </bdi>
        </div>
      ) : null}
      <StopAdhanButton className="mt-2 w-full" />
    </div>
  );
}

/** Type 2: the dates and place, the current state large, every time with passed and next marks, Open app. */
function PanelType({ drag: canDrag }: { drag: boolean }) {
  const { t } = useTranslation();
  const seconds = useS((s) => s.timer.secondsWidget && s.widgets.main.seconds);
  const { state, label, value, now } = useLive();
  const { payload, day, events } = useToday();
  const countdown = state?.mode === 'countdown';
  const drag = canDrag || undefined;
  return (
    <div className="flex h-full flex-col" data-tauri-drag-region={drag}>
      <header className="khatam flex items-start gap-3 border-b border-line-soft px-5 pt-4 pb-3" data-tauri-drag-region={drag}>
        <AhdMark size={30} />
        <div className="min-w-0 flex-1" data-tauri-drag-region={drag}>
          <div className="truncate text-[0.9375rem] font-medium text-ink" data-tauri-drag-region={drag}>
            {day?.weekday} {day?.hijri}
          </div>
          <div className="truncate text-[0.8125rem] text-ink-muted" data-tauri-drag-region={drag}>
            {day?.gregorian} — {payload?.location}
          </div>
        </div>
      </header>
      <div className="flex flex-col items-center py-3" data-tauri-drag-region={drag}>
        <span className="text-[0.75rem] text-ink-muted">{countdown ? t('home.untilLabel') : t('home.sinceLabel')}</span>
        <span className="font-display text-[1.375rem] text-ink">{label(state?.event)}</span>
        <bdi dir="ltr" className={clsx('tabular text-[2.25rem] leading-tight', countdown ? 'text-ochre-strong' : 'text-sage-strong')}>
          {value({ seconds, padHours: false })}
        </bdi>
      </div>
      <ul className="flex min-h-0 flex-1 flex-col justify-center gap-0.5 px-3" data-tauri-drag-region={drag}>
        {events.map((e) => {
          const current = state?.prev.at === e.at;
          const next = state?.next.at === e.at;
          const passed = e.at <= now && !current;
          return (
            <li key={e.id} data-tauri-drag-region={drag} className={clsx('flex items-center gap-2 rounded-[10px] px-3 py-1 text-[0.9375rem]', current && 'bg-sage-soft', next && 'bg-ochre-soft')}>
              <span className={clsx('flex-1', passed ? 'text-ink-muted' : 'text-ink', (current || next) && 'font-semibold')}>{label(e)}</span>
              {next ? <span className="text-[0.75rem] text-ochre-strong">{t('panel.next')}</span> : null}
              {passed ? <span className="text-[0.75rem] text-sage">✓</span> : null}
              <bdi dir="ltr" className={clsx('tabular w-16 text-end', passed ? 'text-ink-muted' : 'text-ink')}>
                {e.timeText}
              </bdi>
            </li>
          );
        })}
      </ul>
      <footer className="flex items-center gap-2 border-t border-line-soft p-3">
        <StopAdhanButton className="flex-1" />
        <button
          type="button"
          onClick={() => void api.showMain()}
          className="inline-flex h-9 flex-1 items-center justify-center rounded-full border border-line bg-surface-raised px-4 text-[0.875rem] font-medium text-ink hover:bg-surface"
        >
          {t('panel.openApp')}
        </button>
      </footer>
    </div>
  );
}

/** Type 3 (wide): the place and date on top, the current state with its progress, the day's times in a row. */
function WideType({ drag: canDrag }: { drag: boolean }) {
  const { t } = useTranslation();
  const seconds = useS((s) => s.timer.secondsWidget && s.widgets.main.seconds);
  const { state, label, value, now } = useLive();
  const { payload, day, events } = useToday();
  const countdown = state?.mode === 'countdown';
  const drag = canDrag || undefined;
  return (
    <div className="flex h-full flex-col px-4 pt-3 pb-2.5" data-tauri-drag-region={drag}>
      <div className="flex items-center gap-2 text-[0.75rem] leading-4 text-ink-muted" data-tauri-drag-region={drag}>
        <AhdMark size={16} />
        <span className="min-w-0 flex-1 truncate" data-tauri-drag-region={drag}>
          {payload?.location}
        </span>
        {day ? (
          <span className="truncate" data-tauri-drag-region={drag}>
            {day.weekday} {day.hijri}
          </span>
        ) : null}
      </div>

      <div className="mt-1.5 flex items-center gap-3" data-tauri-drag-region={drag}>
        <span className={clsx('h-2.5 w-2.5 shrink-0 rounded-full', countdown ? 'bg-ochre' : 'bg-sage')} />
        <div className="min-w-0 flex-1" data-tauri-drag-region={drag}>
          <div className="text-[0.75rem] leading-4 text-ink-muted">{countdown ? t('home.untilLabel') : t('home.sinceLabel')}</div>
          <div className="font-display truncate text-[1.25rem] leading-tight text-ink">{label(state?.event)}</div>
        </div>
        <StopAdhanButton className="h-8 px-3 text-[0.8125rem]" />
        <bdi dir="ltr" className={clsx('tabular shrink-0 text-[2rem] leading-none', countdown ? 'text-ochre-strong' : 'text-sage-strong')}>
          {value({ seconds, padHours: false })}
        </bdi>
      </div>
      <span className="relative mt-2 block h-[3px] rounded-full bg-line-soft">
        <span className={clsx('absolute inset-y-0 start-0 rounded-full', countdown ? 'bg-ochre' : 'bg-sage')} style={{ width: `${Math.round((state?.progress ?? 0) * 100)}%`, transition: 'width 900ms linear' }} />
      </span>

      <ul className="mt-auto grid auto-cols-fr grid-flow-col gap-1 pt-2" data-tauri-drag-region={drag}>
        {events.map((e) => {
          const current = state?.prev.at === e.at;
          const next = state?.next.at === e.at;
          const passed = e.at <= now && !current;
          return (
            <li
              key={e.id}
              data-tauri-drag-region={drag}
              className={clsx('flex min-w-0 flex-col items-center rounded-[8px] py-1 text-[0.75rem] leading-4', current && 'bg-sage-soft', next && countdown && 'bg-ochre-soft')}
            >
              <span className={clsx('max-w-full truncate', passed ? 'text-ink-muted' : 'text-ink', (current || next) && 'font-semibold')}>{label(e)}</span>
              <bdi dir="ltr" className={clsx('tabular text-[0.8125rem]', passed ? 'text-ink-muted' : 'text-ink', (current || next) && 'font-semibold')}>
                {e.timeText}
              </bdi>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
