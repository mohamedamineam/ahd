import clsx from 'clsx';
import type { PrayerEngine } from '@/features/prayer/engine';
import type { DisplayState } from '@/features/prayer/displayState';
import { PRAYER_IDS, type PrayerId } from '@/features/prayer/types';
import { usePrayer } from '@/features/prayer/store';
import { offsetClock } from '@/features/prayer/offsetFormat';
import { useS } from '@/features/settings/store';
import { useFmt } from '@/lib/useFmt';
import { toDigits } from '@/lib/format';
import { Badge, Stepper } from '@/design/components';
import { IconBell, IconBellOff, IconCheck } from '@/design/icons';

export function PrayerList({
  engine,
  date,
  now,
  state,
  onTune,
  onBell,
}: {
  engine: PrayerEngine;
  date: string;
  now: number;
  state: DisplayState | null;
  onTune: (p: PrayerId) => void;
  onBell: (p: PrayerId) => void;
}) {
  const f = useFmt();
  const { t } = f;
  const day = engine.day(date);
  const offsets = usePrayer((s) => s.offsets);
  const setOffset = usePrayer((s) => s.setOffset);
  const adhan = useS((s) => s.adhan.perPrayer);
  const secondsMain = useS((s) => s.timer.secondsMain);
  const countdown = state?.mode === 'countdown';

  return (
    <ul className="flex flex-col" aria-label={t('home.timesOfDay')}>
      {PRAYER_IDS.map((p) => {
        const at = day.times[p];
        const passed = at <= now;
        const isCurrent = state?.prev.at === at;
        const isNext = state?.next.at === at;
        const off = offsets[p];
        const mode = p === 'sunrise' ? null : adhan[p as Exclude<PrayerId, 'sunrise'>].mode;
        const bellOff = mode === 'off' || mode === 'silent';
        return (
          <li
            key={p}
            className={clsx(
              'group relative flex h-[46px] items-center gap-3 rounded-[10px] ps-4 pe-1.5 transition-colors',
              isCurrent && 'bg-sage-soft',
              isNext && countdown && 'bg-ochre-soft',
              !isCurrent && !(isNext && countdown) && 'hover:bg-[color-mix(in_oklab,var(--ink)_4%,transparent)]',
            )}
          >
            {isCurrent || (isNext && countdown) ? (
              <span aria-hidden className={clsx('absolute inset-y-2.5 start-0 w-[3px] rounded-full', isCurrent ? 'bg-sage-strong' : 'bg-ochre')} />
            ) : null}
            <span className="flex w-5 shrink-0 justify-center">
              {passed && !isCurrent ? <IconCheck size={16} className="text-sage" /> : <span className={clsx('h-2 w-2 rounded-full', isCurrent ? 'bg-sage-strong' : isNext ? (countdown ? 'bg-ochre' : 'bg-sage') : 'bg-line')} />}
            </span>
            <span className={clsx('w-24 shrink-0 text-[1.0625rem] font-medium', passed && !isCurrent ? 'text-ink-muted' : 'text-ink', p === 'sunrise' && 'font-normal')}>
              {f.prayer(p, day.isFriday)}
            </span>
            <bdi dir="ltr" className={clsx('tabular w-28 shrink-0 text-[1.0625rem]', passed && !isCurrent ? 'text-ink-muted' : 'text-ink', (isCurrent || isNext) && 'font-semibold')}>
              {f.time(at, engine.zone, secondsMain)}
            </bdi>
            <span className="flex min-w-0 flex-1 items-center gap-2">
              {isCurrent ? <Badge tone="sage">{t('home.now')}</Badge> : null}
              {isNext ? (
                <>
                  <Badge tone={countdown ? 'ochre' : 'outline'}>{t('home.next')}</Badge>
                  <span className="truncate text-[0.8125rem] text-ink-muted">{t('time.in', { duration: f.duration(Math.max(60, Math.ceil((at - now) / 60_000) * 60)) })}</span>
                </>
              ) : null}
              {day.source === 'official' ? <Badge tone="outline">{t('home.officialSource')}</Badge> : null}
            </span>
            <button
              type="button"
              onClick={() => onTune(p)}
              className={clsx(
                'tabular inline-flex h-7 items-center rounded-full px-2.5 text-[0.8125rem] font-medium transition-colors',
                off ? 'bg-surface-sunk text-ink hover:bg-line-soft' : 'text-ink-faint opacity-0 group-focus-within:opacity-100 group-hover:opacity-100 hover:bg-surface-sunk',
              )}
              aria-label={t('home.fineTune', { prayer: f.prayer(p, day.isFriday) })}
              title={t('home.fineTune', { prayer: f.prayer(p, day.isFriday) })}
            >
              <bdi dir="ltr">{off ? toDigits(offsetClock(off), f.digits) : '±'}</bdi>
            </button>
            <span className="opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
              <Stepper
                size="sm"
                decrementLabel={t('tune.decrease', { step: t('tune.step60') })}
                incrementLabel={t('tune.increase', { step: t('tune.step60') })}
                onDecrement={() => void setOffset(p, usePrayer.getState().offsets[p] - 60)}
                onIncrement={() => void setOffset(p, usePrayer.getState().offsets[p] + 60)}
              />
            </span>
            <button
              type="button"
              onClick={() => onBell(p)}
              aria-label={t('home.adhanFor', { prayer: f.prayer(p, day.isFriday) })}
              title={t('home.adhanFor', { prayer: f.prayer(p, day.isFriday) })}
              className={clsx(
                'inline-flex h-9 w-9 items-center justify-center rounded-[9px] transition-colors hover:bg-[color-mix(in_oklab,var(--ink)_7%,transparent)]',
                bellOff ? 'text-ink-faint' : p === 'sunrise' ? 'text-ink-faint' : 'text-sage-strong',
              )}
            >
              {bellOff ? <IconBellOff size={18} /> : <IconBell size={18} />}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
