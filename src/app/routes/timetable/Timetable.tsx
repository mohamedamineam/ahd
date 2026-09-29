import { useMemo, useState } from 'react';
import { DateTime } from 'luxon';
import clsx from 'clsx';
import { usePrayer } from '@/features/prayer/store';
import { addDays, localDate } from '@/features/prayer/engine';
import { toHijri } from '@/features/prayer/hijri';
import { PRAYER_IDS } from '@/features/prayer/types';
import { useS } from '@/features/settings/store';
import { placeName } from '@/features/location/search';
import { useClock } from '@/lib/clock';
import { useFmt } from '@/lib/useFmt';
import { gregorianMonthName, hijriMonthName, weekdayName, formatTime } from '@/lib/format';
import { saveTextFile } from '@/lib/files';
import { Button, IconButton, Segmented, toast } from '@/design/components';
import { IconChevronEnd, IconChevronStart, IconDownload, IconPrinter } from '@/design/icons';

type Mode = 'gregorian' | 'hijri';

export default function Timetable() {
  const f = useFmt();
  const { t, lang } = f;
  const engine = usePrayer((s) => s.engine);
  const place = useS((s) => s.location.current);
  const hijriOffset = useS((s) => s.calc.hijriOffset);
  const method = useS((s) => s.calc.method);
  const timeFormat = useS((s) => s.general.timeFormat);
  const monthStyle = useS((s) => s.general.monthStyle);
  const today = useClock((s) => (engine ? localDate(s.now, engine.zone) : '2026-01-01'));
  const [mode, setMode] = useState<Mode>('gregorian');
  const [shift, setShift] = useState(0);

  const { dates, title } = useMemo(() => {
    if (mode === 'gregorian') {
      const start = DateTime.fromISO(today, { zone: 'UTC' }).startOf('month').plus({ months: shift });
      const out: string[] = [];
      for (let d = start; d.month === start.month; d = d.plus({ days: 1 })) out.push(d.toISODate()!);
      return { dates: out, title: `${gregorianMonthName(start.month, { lang, monthStyle })} ${f.num(start.year)}` };
    }
    // Hijri month: walk Gregorian days whose Hijri month matches the target month
    const h0 = toHijri(today, hijriOffset);
    let targetMonth = h0.month + shift;
    let targetYear = h0.year;
    while (targetMonth > 12) {
      targetMonth -= 12;
      targetYear++;
    }
    while (targetMonth < 1) {
      targetMonth += 12;
      targetYear--;
    }
    let cursor = addDays(today, shift * 29.5 - (h0.day - 1));
    for (let i = 0; i < 40; i++) {
      const h = toHijri(cursor, hijriOffset);
      if (h.year === targetYear && h.month === targetMonth && h.day === 1) break;
      const diff = (targetYear - h.year) * 354 + (targetMonth - h.month) * 29.5 + (1 - h.day);
      cursor = addDays(cursor, Math.max(-30, Math.min(30, Math.round(diff))) || 1);
    }
    const out: string[] = [];
    for (let d = cursor; toHijri(d, hijriOffset).month === targetMonth && out.length < 31; d = addDays(d, 1)) out.push(d);
    return { dates: out, title: `${hijriMonthName(targetMonth, lang)} ${f.num(targetYear)}` };
  }, [mode, shift, today, lang, monthStyle, hijriOffset, f]);

  if (!engine) return null;

  const exportCsv = async () => {
    const header = ['date', 'hijri', ...PRAYER_IDS].join(',');
    const rows = dates.map((d) => {
      const day = engine.day(d);
      const h = toHijri(d, hijriOffset);
      return [d, `${h.year}-${String(h.month).padStart(2, '0')}-${String(h.day).padStart(2, '0')}`, ...PRAYER_IDS.map((p) => formatTime(day.times[p], engine.zone, { lang: 'en', digits: 'latn', format: '24h', seconds: true }))].join(',');
    });
    const ok = await saveTextFile(`ahd-${placeName(place, 'en').replace(/\W+/g, '-')}-${dates[0]}.csv`, [header, ...rows].join('\n') + '\n', 'csv');
    if (ok) toast(t('timetable.exported'), 'success');
  };

  return (
    <div className="mx-auto w-full max-w-[1080px] px-6 pt-5 pb-8 print:max-w-none print:p-0">
      <header className="mb-4 flex flex-wrap items-center gap-3 print:hidden">
        <h1 className="font-display text-[1.75rem] text-ink">{t('timetable.title')}</h1>
        <div className="flex-1" />
        <Segmented
          size="sm"
          label={t('timetable.title')}
          value={mode}
          onChange={(m) => {
            setMode(m);
            setShift(0);
          }}
          options={[
            { value: 'gregorian', label: t('timetable.gregorian') },
            { value: 'hijri', label: t('timetable.hijri') },
          ]}
        />
        <Button size="sm" variant="secondary" icon={<IconDownload size={16} />} onClick={exportCsv}>
          {t('timetable.exportCsv')}
        </Button>
        <Button size="sm" variant="secondary" icon={<IconPrinter size={16} />} onClick={() => window.print()}>
          {t('timetable.exportPdf')}
        </Button>
      </header>

      <div className="mb-3 flex items-center gap-2 print:hidden">
        <IconButton label={t('timetable.previous')} size="sm" variant="secondary" onClick={() => setShift((s) => s - 1)}>
          <IconChevronStart size={18} />
        </IconButton>
        <h2 className="min-w-[12rem] text-center text-lg font-semibold text-ink">{title}</h2>
        <IconButton label={t('timetable.next')} size="sm" variant="secondary" onClick={() => setShift((s) => s + 1)}>
          <IconChevronEnd size={18} />
        </IconButton>
        {shift !== 0 ? (
          <Button size="sm" variant="ghost" onClick={() => setShift(0)}>
            {t('timetable.thisMonth')}
          </Button>
        ) : null}
        <span className="flex-1" />
        <span className="text-[0.875rem] text-ink-muted">
          {placeName(place, lang)} — {t(`methods.${method}`)}
        </span>
      </div>

      {/* print header */}
      <div className="mb-3 hidden print:block">
        <h1 className="text-xl font-semibold">{t('timetable.printTitle', { place: placeName(place, lang), month: title })}</h1>
        <p className="text-sm">{t(`methods.${method}`)}</p>
      </div>

      <div className="overflow-hidden rounded-panel border border-line-soft bg-surface shadow-sm print:rounded-none print:border-black/30 print:shadow-none">
        <table className="w-full border-collapse text-[0.9375rem]">
          <thead>
            <tr className="border-b border-line-soft bg-surface-sunk text-[0.8125rem] text-ink-muted">
              <th className="px-3 py-2.5 text-start font-medium">{t('timetable.day')}</th>
              <th className="px-3 py-2.5 text-start font-medium">{mode === 'gregorian' ? t('timetable.date') : t('timetable.hijriDate')}</th>
              <th className="px-3 py-2.5 text-start font-medium">{mode === 'gregorian' ? t('timetable.hijriDate') : t('timetable.date')}</th>
              {PRAYER_IDS.map((p) => (
                <th key={p} className="px-3 py-2.5 text-center font-medium">
                  {t(`prayers.${p}`)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {dates.map((d) => {
              const day = engine.day(d);
              const h = toHijri(d, hijriOffset);
              const isToday = d === today;
              const g = DateTime.fromISO(d, { zone: 'UTC' });
              const gText = `${f.num(g.day)} ${gregorianMonthName(g.month, { lang, monthStyle })}`;
              const hText = `${f.num(h.day)} ${hijriMonthName(h.month, lang)}`;
              return (
                <tr
                  key={d}
                  aria-current={isToday ? 'date' : undefined}
                  className={clsx(
                    'border-b border-line-soft last:border-0',
                    isToday ? 'bg-sage-soft font-semibold' : day.isFriday ? 'bg-[color-mix(in_oklab,var(--sand)_10%,transparent)]' : '',
                  )}
                >
                  <td className="px-3 py-1.5 whitespace-nowrap">
                    <span className={clsx(day.isFriday && 'font-semibold text-sage-strong')}>{weekdayName(d, lang, true)}</span>
                  </td>
                  <td className="px-3 py-1.5 whitespace-nowrap text-ink">{mode === 'gregorian' ? gText : hText}</td>
                  <td className="px-3 py-1.5 whitespace-nowrap text-ink-muted">{mode === 'gregorian' ? hText : gText}</td>
                  {PRAYER_IDS.map((p) => (
                    <td key={p} className="px-3 py-1.5 text-center">
                      <bdi dir="ltr" className={clsx('tabular', p === 'sunrise' && 'text-ink-muted')}>
                        {formatTime(day.times[p], engine.zone, { lang, digits: f.digits, format: timeFormat })}
                      </bdi>
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
