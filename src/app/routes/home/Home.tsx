import { useState } from 'react';
import { useNavigate } from 'react-router';
import clsx from 'clsx';
import { usePrayer } from '@/features/prayer/store';
import { addDays } from '@/features/prayer/engine';
import type { AdhanPrayerId, PrayerId } from '@/features/prayer/types';
import { useS } from '@/features/settings/store';
import { useNowSecond } from '@/lib/clock';
import { useFmt } from '@/lib/useFmt';
import { Button, EmptyState, Sheet } from '@/design/components';
import { IconMoon, IconPin, IconTimetable } from '@/design/icons';
import { PrayerAdhanControls } from '@/features/adhan/AdhanControls';
import { ReminderList } from '@/features/reminders/ReminderEditor';
import { SunPathDial, useDisplay } from './SunPathDial';
import { PrayerList } from './PrayerList';
import { FineTuneSheet } from './FineTuneSheet';
import { MihrabCard } from './MihrabCard';
import { HadithInscription } from './HadithInscription';

function NightStrip({ date }: { date: string }) {
  const f = useFmt();
  const navigate = useNavigate();
  const engine = usePrayer((s) => s.engine)!;
  const calc = useS((s) => s.calc);
  const day = engine.day(date);
  const tomorrow = engine.day(addDays(date, 1));
  const items: [string, number][] = [];
  if (calc.showImsak) items.push([f.t('prayers.imsak'), day.imsak]);
  if (calc.showDuha) items.push([f.t('prayers.duha'), day.duha]);
  items.push([f.t('prayers.midnight'), day.midnight], [f.t('prayers.lastThird'), day.lastThird], [f.t('prayers.tomorrowFajr'), tomorrow.times.fajr]);
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 ps-3 text-[0.9375rem]">
      <IconMoon size={17} className="text-tod-night" aria-hidden />
      {items.map(([label, at]) => (
        <span key={label} className="inline-flex items-baseline gap-2">
          <span className="text-ink-muted">{label}</span>
          <bdi dir="ltr" className="tabular font-medium text-ink">
            {f.time(at, engine.zone)}
          </bdi>
        </span>
      ))}
      <span className="flex-1" />
      <Button size="sm" variant="ghost" icon={<IconTimetable size={17} />} onClick={() => navigate('/timetable')}>
        {f.t('timetable.title')}
      </Button>
    </div>
  );
}

export default function Home() {
  const f = useFmt();
  const { t } = f;
  const navigate = useNavigate();
  const engine = usePrayer((s) => s.engine);
  const now = useNowSecond();
  const [tune, setTune] = useState<PrayerId | null>(null);
  const [bell, setBell] = useState<PrayerId | null>(null);

  if (!engine) {
    return (
      <EmptyState
        className="h-full"
        icon={<IconPin size={28} />}
        title={t('home.noLocationTitle')}
        body={t('home.noLocationBody')}
        action={
          <Button variant="primary" onClick={() => navigate('/settings/location')}>
            {t('home.chooseLocation')}
          </Button>
        }
      />
    );
  }

  return <HomeContent now={now} tune={tune} setTune={setTune} bell={bell} setBell={setBell} />;
}

function HomeContent({
  now,
  tune,
  setTune,
  bell,
  setBell,
}: {
  now: number;
  tune: PrayerId | null;
  setTune: (p: PrayerId | null) => void;
  bell: PrayerId | null;
  setBell: (p: PrayerId | null) => void;
}) {
  const f = useFmt();
  const { t } = f;
  const engine = usePrayer((s) => s.engine)!;
  const { state, date } = useDisplay(engine, now);
  const day = engine.day(date);

  return (
    <div className="mx-auto flex w-full max-w-[1080px] flex-col gap-3 px-6 pt-4 pb-6">
      <MihrabCard>
        <div className="px-8 pt-7 pb-0.5">
          <HadithInscription className="mx-auto max-w-[900px]" />
          <div className="mx-auto -mt-2 max-w-[830px]">
            <SunPathDial engine={engine} now={now} />
          </div>
        </div>
      </MihrabCard>

      {day.degraded ? <p className={clsx('rounded-[12px] bg-ochre-soft px-4 py-3 text-[0.875rem] text-ochre-strong')}>{t('home.degraded')}</p> : null}

      <section className="rounded-panel border border-line-soft bg-surface p-1.5 shadow-sm" aria-label={t('home.timesOfDay')}>
        <PrayerList engine={engine} date={date} now={now} state={state} onTune={setTune} onBell={setBell} />
      </section>

      <NightStrip date={date} />

      <FineTuneSheet prayer={tune} date={date} onClose={() => setTune(null)} />
      <Sheet
        open={bell !== null}
        onClose={() => setBell(null)}
        title={bell ? t('home.adhanFor', { prayer: f.prayer(bell, day.isFriday) }) : ''}
        closeLabel={t('common.close')}
      >
        {bell && bell !== 'sunrise' ? <PrayerAdhanControls prayer={bell as AdhanPrayerId} /> : null}
        {bell ? (
          <div className="mt-6">
            <h3 className="mb-3 font-semibold text-ink">{t('settings.reminders.title')}</h3>
            <ReminderList prayer={bell} />
          </div>
        ) : null}
      </Sheet>
    </div>
  );
}
