import { useState } from 'react';
import clsx from 'clsx';
import { usePrayer } from '@/features/prayer/store';
import { localDate, parseLocalTime } from '@/features/prayer/engine';
import { PRAYER_IDS, type PrayerId } from '@/features/prayer/types';
import { offsetLabel } from '@/features/prayer/offsetFormat';
import { useClock } from '@/lib/clock';
import { useFmt } from '@/lib/useFmt';
import { fromDigits } from '@/lib/format';
import { Button, Segmented, Stepper } from '@/design/components';
import { IconReset } from '@/design/icons';
import { STEP_OPTIONS, type StepSize } from '../home/FineTuneSheet';

function OfficialInline({ prayer, date, onDone }: { prayer: PrayerId; date: string; onDone: () => void }) {
  const f = useFmt();
  const engine = usePrayer((s) => s.engine)!;
  const setOffset = usePrayer((s) => s.setOffset);
  const [v, setV] = useState('');
  const [err, setErr] = useState(false);
  const apply = () => {
    const at = parseLocalTime(date, fromDigits(v.trim()), engine.zone);
    if (!Number.isFinite(at)) return setErr(true);
    void setOffset(prayer, Math.round((at - engine.day(date).calculated[prayer]) / 1000));
    onDone();
  };
  return (
    <div className="flex flex-wrap items-center gap-2 pb-3 ps-11">
      <input
        autoFocus
        dir="ltr"
        inputMode="numeric"
        aria-label={f.t('tune.officialTime', { prayer: f.prayer(prayer) })}
        placeholder="18:41"
        value={v}
        onChange={(e) => {
          setV(e.target.value);
          setErr(false);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') apply();
          if (e.key === 'Escape') onDone();
        }}
        className={clsx('tabular h-9 w-28 rounded-[9px] border bg-surface-raised px-3 outline-none focus:border-sage', err ? 'border-danger' : 'border-line')}
      />
      <Button size="sm" variant="primary" onClick={apply}>
        {f.t('tune.applyOfficial')}
      </Button>
      <Button size="sm" variant="ghost" onClick={onDone}>
        {f.t('common.cancel')}
      </Button>
      {err ? <span className="text-[0.8125rem] text-danger">{f.t('tune.invalidTime')}</span> : <span className="text-[0.8125rem] text-ink-muted">{f.t('tune.officialHint')}</span>}
    </div>
  );
}

/** Today's six times with −/+ fine-tuning (onboarding step 3, also used in Settings). */
export function TimesTuner() {
  const f = useFmt();
  const { t } = f;
  const engine = usePrayer((s) => s.engine);
  const offsets = usePrayer((s) => s.offsets);
  const setOffset = usePrayer((s) => s.setOffset);
  const now = useClock((s) => Math.floor(s.now / 60_000));
  const [step, setStep] = useState<StepSize>(60);
  const [official, setOfficial] = useState<PrayerId | null>(null);
  if (!engine) return null;
  const date = localDate(now * 60_000, engine.zone);
  const day = engine.day(date);
  const stepLabel = t(`tune.step${step}`);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-[0.9375rem] font-medium text-ink">{t('tune.step')}</span>
        <Segmented label={t('tune.step')} value={step} onChange={setStep} options={STEP_OPTIONS.map((s) => ({ value: s, label: t(`tune.step${s}`) }))} />
      </div>
      <ul className="divide-y divide-line-soft rounded-panel border border-line-soft bg-surface">
        {PRAYER_IDS.map((p) => {
          const off = offsets[p];
          return (
            <li key={p} className="px-4">
              <div className="flex min-h-[60px] flex-wrap items-center gap-x-4 gap-y-2 py-2">
                <span className="w-24 text-[1.0625rem] font-medium text-ink">{f.prayer(p, day.isFriday)}</span>
                <bdi dir="ltr" className="tabular w-24 text-[1.0625rem] font-semibold text-ink">
                  {f.time(day.times[p], engine.zone, true)}
                </bdi>
                <span className={clsx('tabular min-w-[7rem] text-[0.875rem]', off ? 'font-medium text-sage-strong' : 'text-ink-faint')}>
                  {off ? offsetLabel(off, t) : t('home.offsetNone')}
                </span>
                <div className="flex-1" />
                <Stepper
                  decrementLabel={t('tune.decrease', { step: stepLabel })}
                  incrementLabel={t('tune.increase', { step: stepLabel })}
                  onDecrement={() => void setOffset(p, usePrayer.getState().offsets[p] - step)}
                  onIncrement={() => void setOffset(p, usePrayer.getState().offsets[p] + step)}
                />
                <Button size="sm" variant="ghost" onClick={() => setOfficial(official === p ? null : p)}>
                  {t('tune.knowOfficial')}
                </Button>
                <button
                  type="button"
                  aria-label={t('tune.resetRow')}
                  title={t('tune.resetRow')}
                  disabled={!off}
                  onClick={() => void setOffset(p, 0)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-[8px] text-ink-muted hover:bg-surface-sunk disabled:opacity-30"
                >
                  <IconReset size={16} />
                </button>
              </div>
              {official === p ? <OfficialInline prayer={p} date={date} onDone={() => setOfficial(null)} /> : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
