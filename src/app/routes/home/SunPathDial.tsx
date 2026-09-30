import { useId, useMemo } from 'react';
import clsx from 'clsx';
import { addDays, localDate, type PrayerEngine } from '@/features/prayer/engine';
import { displayState, formatValue, labelKey, longCountdown, type DisplayState } from '@/features/prayer/displayState';
import type { PrayerId } from '@/features/prayer/types';
import { useS } from '@/features/settings/store';
import { useFmt } from '@/lib/useFmt';
import { toDigits } from '@/lib/format';
import { DIAL, dialSpans, fullDayPath, fullNightPath, locate, normalAt, pointAt, segmentPath } from './dialGeometry';

interface Tick {
  id: PrayerId | 'midnight' | 'lastThird';
  at: number;
  friday: boolean;
  minor?: boolean;
}

export function useDisplay(engine: PrayerEngine, now: number): { state: DisplayState | null; date: string } {
  const timer = useS((s) => s.timer);
  const date = localDate(now, engine.zone);
  const events = useMemo(() => engine.timeline(date, 2), [engine, date]);
  const state = displayState(now, events, timer);
  return { state, date };
}

export function SunPathDial({ engine, now }: { engine: PrayerEngine; now: number }) {
  const f = useFmt();
  const { t, lang } = f;
  const rtl = lang === 'ar';
  const uid = useId().replace(/:/g, '');
  const timer = useS((s) => s.timer);
  const jumuah = useS((s) => s.calc.jumuahLabel);
  const { state, date } = useDisplay(engine, now);

  const today = engine.day(date);
  const yesterday = engine.day(addDays(date, -1));
  const tomorrow = engine.day(addDays(date, 1));
  const spans = dialSpans(now, yesterday, today, tomorrow);
  const nightDay = spans.morning ? yesterday : today;

  const ticks: Tick[] = [
    { id: 'sunrise', at: today.times.sunrise, friday: today.isFriday },
    { id: 'dhuhr', at: today.times.dhuhr, friday: today.isFriday },
    { id: 'asr', at: today.times.asr, friday: today.isFriday },
    { id: 'maghrib', at: today.times.maghrib, friday: today.isFriday },
    { id: 'isha', at: spans.nightEvents.isha, friday: nightDay.isFriday },
    { id: 'midnight', at: spans.nightEvents.midnight, friday: false, minor: true },
    { id: 'lastThird', at: spans.nightEvents.lastThird, friday: false, minor: true },
    { id: 'fajr', at: spans.nightEvents.fajr, friday: spans.morning ? today.isFriday : tomorrow.isFriday },
  ];

  const isDay = now >= spans.day[0] && now <= spans.day[1];
  const nowPt = pointAt(now, spans, rtl);
  const countdown = state?.mode === 'countdown';
  const arrival = state?.mode === 'elapsed' && state.seconds < 8;

  const value = state
    ? toDigits(formatValue(state, { seconds: timer.secondsMain, padHours: true, longCountdown: longCountdown(timer) }), f.digits)
    : '';
  const eventName = state ? t(`prayers.${labelKey(state.event, jumuah)}`) : '';
  const nextName = state ? t(`prayers.${labelKey(state.next, jumuah)}`) : '';
  const secondary = state
    ? countdown
      ? t('home.atTime', { prayer: nextName, time: f.time(state.next.at, engine.zone) })
      : t('home.nextLine', {
          prayer: nextName,
          time: f.time(state.next.at, engine.zone),
          relative: t('time.in', { duration: f.duration(Math.ceil((state.next.at - now) / 60_000) * 60) }),
        })
    : '';
  const minuteSeconds = state ? Math.floor(state.seconds / 60) * 60 : 0;
  const srText = state
    ? t(countdown ? 'home.srRemaining' : 'home.srElapsed', { prayer: eventName, duration: f.durationLong(minuteSeconds) })
    : '';

  const anchorFor = (nx: number): 'start' | 'end' | 'middle' => {
    if (Math.abs(nx) < 0.35) return 'middle';
    const extendsRight = nx > 0;
    return extendsRight === !rtl ? 'start' : 'end';
  };

  const tod = (id: Tick['id']) =>
    id === 'fajr'
      ? 'var(--tod-dawn)'
      : id === 'sunrise'
        ? 'var(--tod-sunrise)'
        : id === 'dhuhr'
          ? 'var(--tod-noon)'
          : id === 'asr'
            ? 'var(--tod-afternoon)'
            : id === 'maghrib'
              ? 'var(--tod-sunset)'
              : 'var(--tod-night)';

  const gradStops = ['var(--tod-sunrise)', 'var(--tod-noon)', 'var(--tod-afternoon)', 'var(--tod-sunset)'];
  if (rtl) gradStops.reverse();

  return (
    // container-type: the centre text is sized in cqw so it scales with the dial and never reaches the horizon
    <div className="relative w-full select-none [container-type:inline-size]" style={{ aspectRatio: `${DIAL.W} / ${DIAL.H}` }}>
      <svg viewBox={`0 0 ${DIAL.W} ${DIAL.H}`} className="absolute inset-0 h-full w-full overflow-visible" role="img" aria-label={t('home.dayArc')}>
        <defs>
          <linearGradient id={`${uid}day`} gradientUnits="userSpaceOnUse" x1={DIAL.cx - DIAL.rx} y1="0" x2={DIAL.cx + DIAL.rx} y2="0">
            {gradStops.map((c, i) => (
              <stop key={i} offset={i / (gradStops.length - 1)} stopColor={c} />
            ))}
          </linearGradient>
          <radialGradient id={`${uid}sun`} cx="0.42" cy="0.38" r="0.7">
            <stop offset="0" stopColor="#FBF1D2" />
            <stop offset="0.55" stopColor="#E7C987" />
            <stop offset="1" stopColor="#C49A55" />
          </radialGradient>
          <radialGradient id={`${uid}halo`}>
            <stop offset="0" stopColor="#E7C987" stopOpacity="0.55" />
            <stop offset="1" stopColor="#E7C987" stopOpacity="0" />
          </radialGradient>
          <radialGradient id={`${uid}moonhalo`}>
            <stop offset="0" stopColor="var(--ink)" stopOpacity="0.14" />
            <stop offset="1" stopColor="var(--ink)" stopOpacity="0" />
          </radialGradient>
          <mask id={`${uid}crescent`}>
            <rect x="-20" y="-20" width="40" height="40" fill="white" />
            <circle cx={rtl ? -4.5 : 4.5} cy="-3" r="8.4" fill="black" />
          </mask>
        </defs>

        {/* horizon */}
        <line
          x1={DIAL.cx - DIAL.rx - 70}
          x2={DIAL.cx + DIAL.rx + 70}
          y1={DIAL.hy}
          y2={DIAL.hy}
          stroke="var(--line)"
          strokeWidth="1"
          strokeDasharray="2 6"
          strokeLinecap="round"
        />

        {/* base arcs */}
        <path d={fullDayPath(rtl)} fill="none" stroke={`url(#${uid}day)`} strokeWidth="2.4" strokeLinecap="round" opacity={isDay ? 0.95 : 0.55} />
        <path d={fullNightPath(rtl)} fill="none" stroke="var(--tod-night)" strokeWidth="1.6" strokeLinecap="round" strokeDasharray="1 7" opacity={isDay ? 0.55 : 0.9} />

        {/* elapsed since the previous event, remaining in countdown */}
        {state ? (
          <path d={segmentPath(state.prev.at, now, spans, rtl)} fill="none" stroke="var(--sage-strong)" strokeWidth="4" strokeLinecap="round" opacity="0.85" />
        ) : null}
        {state && countdown ? (
          <path
            d={segmentPath(now, state.next.at, spans, rtl)}
            fill="none"
            stroke="var(--ochre)"
            strokeWidth="4"
            strokeLinecap="round"
            style={{ animation: 'ahd-breathe 2.4s ease-in-out infinite' }}
          />
        ) : null}

        {/* ticks + labels */}
        {ticks.map((tk) => {
          if (!Number.isFinite(tk.at)) return null;
          const loc = locate(tk.at, spans);
          const p = pointAt(tk.at, spans, rtl);
          const n = normalAt(loc.part, loc.f, rtl);
          const passed = tk.at <= now;
          const isPrev = state?.prev.at === tk.at;
          const isNext = state?.next.at === tk.at;
          if (tk.minor) {
            return <circle key={tk.id} cx={p.x} cy={p.y} r="2.6" fill={passed ? 'var(--sage)' : 'var(--tod-night)'} opacity="0.8" />;
          }
          const label = t(`prayers.${labelKey({ id: tk.id as PrayerId, isFriday: tk.friday }, jumuah)}`);
          const dist = loc.part === 'day' ? 20 : 18;
          const lx = p.x + n.x * dist;
          const ly = p.y + n.y * dist + (Math.abs(n.x) < 0.35 ? (n.y < 0 ? -2 : 10) : 5);
          return (
            <g key={tk.id}>
              {isPrev && arrival ? (
                <circle cx={p.x} cy={p.y} r="12" fill="none" stroke="var(--sage)" strokeWidth="2" style={{ transformBox: 'fill-box', transformOrigin: 'center', animation: 'ahd-glow 1.8s ease-out 2' }} />
              ) : null}
              <circle
                cx={p.x}
                cy={p.y}
                r={isPrev || isNext ? 6.5 : 5}
                fill={isPrev ? 'var(--sage-strong)' : passed ? 'var(--sage)' : 'var(--surface-raised)'}
                stroke={isNext ? (countdown ? 'var(--ochre)' : 'var(--sage-strong)') : passed ? 'none' : tod(tk.id)}
                strokeWidth={isNext ? 2.4 : 1.8}
              />
              <text
                x={lx}
                y={ly}
                direction={rtl ? 'rtl' : 'ltr'}
                textAnchor={anchorFor(n.x)}
                className={clsx('font-ui', isPrev || isNext ? 'fill-ink' : 'fill-ink-muted')}
                style={{ fontSize: 14, fontWeight: isPrev || isNext ? 600 : 500 }}
              >
                {label}
              </text>
            </g>
          );
        })}

        {/* now marker: the sun by day, a crescent by night */}
        {isDay ? (
          <g transform={`translate(${nowPt.x} ${nowPt.y})`}>
            <circle r="30" fill={`url(#${uid}halo)`} />
            <circle r="10.5" fill={`url(#${uid}sun)`} stroke="#FBF1D2" strokeWidth="1.5" />
          </g>
        ) : (
          <g transform={`translate(${nowPt.x} ${nowPt.y})`}>
            <circle r="26" fill={`url(#${uid}moonhalo)`} />
            <circle r="9.5" fill="var(--sand)" mask={`url(#${uid}crescent)`} />
          </g>
        )}
      </svg>

      {/* centre: above the horizon */}
      <div className="pointer-events-none absolute inset-x-0 flex flex-col items-center text-center" style={{ top: '22%' }}>
        {state ? (
          <div key={`${state.event.at}-${state.mode}`} className="animate-fade-in flex flex-col items-center">
            <span
              className={clsx(
                'inline-flex h-[22px] items-center rounded-full px-2.5 text-[0.75rem] font-medium',
                countdown ? 'bg-ochre-soft text-ochre-strong' : 'bg-sage-soft text-sage-strong',
              )}
            >
              {t(countdown ? 'home.untilLabel' : 'home.sinceLabel')}
            </span>
            <span className="font-display mt-1 text-[clamp(1.25rem,3.2cqw,1.9375rem)] leading-[1.15] text-ink">{eventName}</span>
            <bdi dir="ltr" className={clsx('tabular text-[clamp(2.25rem,6.3cqw,3.8125rem)] leading-[1.05] font-normal tracking-[-0.01em]', countdown ? 'text-ochre-strong' : 'text-sage-strong')}>
              {value}
            </bdi>
          </div>
        ) : null}
      </div>
      {/* the next prayer, inside the night bowl below the horizon */}
      <div className="pointer-events-none absolute inset-x-0 flex justify-center" style={{ top: `${((DIAL.hy + 12) / DIAL.H) * 100}%` }}>
        <span className="text-[clamp(0.8125rem,1.55cqw,0.9375rem)] text-ink-muted">{secondary}</span>
      </div>
      <p className="sr-only" aria-live="polite">
        {srText}
      </p>
    </div>
  );
}
