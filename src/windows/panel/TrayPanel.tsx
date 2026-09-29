import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/bridge';
import { AhdMark } from '@/design/brand/AhdMark';
import { StopAdhanButton, useAuxWindow, useLive, useToday } from '../shared';

/** Tray flyout (brief §11.4): dates, location, current state, all prayers, Stop adhan and Open app. */
export default function TrayPanel() {
  useAuxWindow();
  const { t } = useTranslation();
  const { state, label, value, now } = useLive();
  const { payload, day, events } = useToday();
  const countdown = state?.mode === 'countdown';
  return (
    <div className="h-screen w-screen p-2">
      <div className="flex h-full flex-col overflow-hidden rounded-[18px] border border-line-soft bg-surface shadow-lg">
        <header className="khatam flex items-start gap-3 border-b border-line-soft px-5 pt-4 pb-3">
          <AhdMark size={30} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-[0.9375rem] font-medium text-ink">
              {day?.weekday} {day?.hijri}
            </div>
            <div className="truncate text-[0.8125rem] text-ink-muted">
              {day?.gregorian} — {payload?.location}
            </div>
          </div>
        </header>
        <div className="flex flex-col items-center py-4">
          <span className="text-[0.75rem] text-ink-muted">{countdown ? t('home.untilLabel') : t('home.sinceLabel')}</span>
          <span className="font-display text-[1.375rem] text-ink">{label(state?.event)}</span>
          <bdi dir="ltr" className={clsx('tabular text-[2.25rem] leading-tight', countdown ? 'text-ochre-strong' : 'text-sage-strong')}>
            {value({ seconds: true, padHours: false })}
          </bdi>
        </div>
        <ul className="flex flex-1 flex-col gap-0.5 px-3">
          {events.map((e) => {
            const current = state?.prev.at === e.at;
            const next = state?.next.at === e.at;
            const passed = e.at <= now && !current;
            return (
              <li key={e.id} className={clsx('flex items-center gap-2 rounded-[10px] px-3 py-1.5 text-[0.9375rem]', current && 'bg-sage-soft', next && 'bg-ochre-soft')}>
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
            onClick={() => {
              void api.showMain();
              void api.hideWindow();
            }}
            className="inline-flex h-9 flex-1 items-center justify-center rounded-full border border-line bg-surface-raised px-4 text-[0.875rem] font-medium text-ink hover:bg-surface"
          >
            {t('panel.openApp')}
          </button>
        </footer>
      </div>
    </div>
  );
}
