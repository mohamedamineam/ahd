import { useState } from 'react';
import { DateTime } from 'luxon';
import { usePrayer } from '@/features/prayer/store';
import type { PrayerId } from '@/features/prayer/types';
import { offsetLabel } from '@/features/prayer/offsetFormat';
import { parseLocalTime } from '@/features/prayer/engine';
import { useFmt } from '@/lib/useFmt';
import { fromDigits } from '@/lib/format';
import { Button, Segmented, Sheet, Stepper, TextInput } from '@/design/components';
import { IconReset } from '@/design/icons';

export const STEP_OPTIONS = [60, 10, 1] as const;
export type StepSize = (typeof STEP_OPTIONS)[number];

export function OffsetEditor({ prayer, date, compact }: { prayer: PrayerId; date: string; compact?: boolean }) {
  const f = useFmt();
  const { t } = f;
  const engine = usePrayer((s) => s.engine)!;
  const offset = usePrayer((s) => s.offsets[prayer]);
  const setOffset = usePrayer((s) => s.setOffset);
  const [step, setStep] = useState<StepSize>(60);
  const [official, setOfficial] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showOfficial, setShowOfficial] = useState(false);
  const day = engine.day(date);
  const calculated = day.calculated[prayer];
  const adjusted = day.times[prayer];
  const stepLabel = t(`tune.step${step}`);

  const applyOfficial = () => {
    const v = fromDigits(official.trim());
    const at = parseLocalTime(date, v, engine.zone);
    if (!Number.isFinite(at)) {
      setError(t('tune.invalidTime'));
      return;
    }
    setError(null);
    void setOffset(prayer, Math.round((at - calculated) / 1000));
    setShowOfficial(false);
    setOfficial('');
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-[12px] bg-surface-sunk px-4 py-3">
          <div className="text-[0.8125rem] text-ink-muted">{t('tune.calculated')}</div>
          <bdi dir="ltr" className="tabular mt-0.5 block text-lg text-ink-muted">
            {f.time(calculated, engine.zone, true)}
          </bdi>
        </div>
        <div className="rounded-[12px] bg-sage-soft px-4 py-3">
          <div className="text-[0.8125rem] text-sage-strong">{t('tune.adjusted')}</div>
          <bdi dir="ltr" className="tabular mt-0.5 block text-lg font-semibold text-ink">
            {f.time(adjusted, engine.zone, true)}
          </bdi>
        </div>
      </div>

      <div className="flex flex-col items-center gap-3">
        <Segmented
          label={t('tune.step')}
          value={step}
          onChange={setStep}
          options={STEP_OPTIONS.map((s) => ({ value: s, label: t(`tune.step${s}`) }))}
        />
        <Stepper
          onDecrement={() => void setOffset(prayer, usePrayer.getState().offsets[prayer] - step)}
          onIncrement={() => void setOffset(prayer, usePrayer.getState().offsets[prayer] + step)}
          decrementLabel={t('tune.decrease', { step: stepLabel })}
          incrementLabel={t('tune.increase', { step: stepLabel })}
        >
          <output aria-live="polite" className="tabular min-w-[9.5rem] px-2 text-center text-[1.0625rem] font-semibold text-ink">
            {offset ? offsetLabel(offset, t) : t('home.offsetNone')}
          </output>
        </Stepper>
        {offset ? (
          <Button size="sm" variant="ghost" icon={<IconReset size={16} />} onClick={() => void setOffset(prayer, 0)}>
            {t('tune.resetRow')}
          </Button>
        ) : null}
      </div>

      {!compact ? (
        <div className="rounded-[12px] border border-line-soft p-4">
          {showOfficial ? (
            <div className="flex flex-col gap-3">
              <TextInput
                autoFocus
                label={t('tune.officialTime', { prayer: f.prayer(prayer, day.isFriday) })}
                hint={t('tune.officialHint')}
                error={error}
                placeholder={DateTime.fromMillis(calculated, { zone: engine.zone }).toFormat('HH:mm')}
                value={official}
                onChange={(e) => setOfficial(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && applyOfficial()}
                dir="ltr"
                inputMode="numeric"
              />
              <div className="flex justify-end gap-2">
                <Button size="sm" variant="ghost" onClick={() => setShowOfficial(false)}>
                  {t('common.cancel')}
                </Button>
                <Button size="sm" variant="primary" onClick={applyOfficial}>
                  {t('tune.applyOfficial')}
                </Button>
              </div>
            </div>
          ) : (
            <button type="button" className="w-full text-start font-medium text-sage-strong hover:underline" onClick={() => setShowOfficial(true)}>
              {t('tune.knowOfficial')}
            </button>
          )}
        </div>
      ) : null}
    </div>
  );
}

export function FineTuneSheet({ prayer, date, onClose }: { prayer: PrayerId | null; date: string; onClose: () => void }) {
  const f = useFmt();
  const engine = usePrayer((s) => s.engine);
  const friday = engine && prayer ? engine.day(date).isFriday : false;
  return (
    <Sheet
      open={prayer !== null}
      onClose={onClose}
      title={prayer ? f.t('tune.title', { prayer: f.prayer(prayer, friday) }) : ''}
      description={f.t('tune.subtitle')}
      closeLabel={f.t('common.close')}
    >
      {prayer ? <OffsetEditor prayer={prayer} date={date} /> : null}
      <p className="mt-6 text-[0.8125rem] text-ink-muted">{f.t('onboarding.times.note')}</p>
    </Sheet>
  );
}
