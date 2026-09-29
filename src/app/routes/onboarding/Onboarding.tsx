import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import clsx from 'clsx';
import { useSettings, useS } from '@/features/settings/store';
import { usePrayer } from '@/features/prayer/store';
import { useLocations } from '@/features/location/useLocations';
import { LocationPicker } from '@/features/location/LocationPicker';
import { countryName, placeName, placeSubtitle } from '@/features/location/search';
import { COUNTRY_METHOD_CHOICES, METHOD_IDS, METHODS, defaultMethodFor } from '@/features/prayer/methods';
import { localDate } from '@/features/prayer/engine';
import { useFmt } from '@/lib/useFmt';
import { useClock } from '@/lib/clock';
import { api, type PlatformInfo } from '@/lib/bridge';
import { sendNotification } from '@/lib/notify';
import { AhdMark } from '@/design/brand/AhdMark';
import { Button, Checkbox, Select, Slider, toast } from '@/design/components';
import { IconCheck, IconMonitor, IconMoon, IconSun, IconBell } from '@/design/icons';
import { PreviewButton, SoundSelect } from '@/features/adhan/AdhanControls';
import { TimesTuner } from './TimesTuner';
import { ThemePreview } from './ThemePreview';

const STEPS = ['language', 'location', 'times', 'theme', 'widgets', 'adhan', 'startup', 'done'] as const;
type Step = (typeof STEPS)[number];

function StepFrame({ title, subtitle, children, wide }: { title: ReactNode; subtitle?: ReactNode; children: ReactNode; wide?: boolean }) {
  return (
    <div className={clsx('animate-fade-in mx-auto w-full', wide ? 'max-w-3xl' : 'max-w-2xl')}>
      <h1 className="font-display text-[2.1rem] leading-tight text-ink">{title}</h1>
      {subtitle ? <p className="mt-2 text-[1.0625rem] text-ink-muted">{subtitle}</p> : null}
      <div className="mt-8">{children}</div>
    </div>
  );
}

function LanguageStep() {
  const lang = useS((s) => s.general.language);
  const update = useSettings((s) => s.update);
  const opt = (value: 'ar' | 'en', label: string, sample: string) => (
    <button
      type="button"
      role="radio"
      aria-checked={lang === value}
      onClick={() => update((d) => void (d.general.language = value))}
      lang={value}
      dir={value === 'ar' ? 'rtl' : 'ltr'}
      className={clsx(
        'group flex h-40 flex-1 flex-col items-center justify-center gap-2 rounded-hero border-2 transition-all duration-200',
        lang === value ? 'border-sage-strong bg-sage-soft shadow-md' : 'border-line-soft bg-surface hover:border-line hover:shadow-sm',
      )}
    >
      <span className={clsx('text-[2rem] text-ink', value === 'ar' ? 'font-display' : 'font-semibold')}>{label}</span>
      <span className="text-[0.9375rem] text-ink-muted">{sample}</span>
      <span className={clsx('mt-1 flex h-6 w-6 items-center justify-center rounded-full transition-colors', lang === value ? 'bg-sage-strong text-on-sage' : 'bg-transparent')}>
        {lang === value ? <IconCheck size={15} strokeWidth={2.4} /> : null}
      </span>
    </button>
  );
  return (
    <div role="radiogroup" className="flex flex-col gap-4 sm:flex-row">
      {opt('ar', 'العربية', 'واجهة من اليمين إلى اليسار')}
      {opt('en', 'English', 'Left-to-right interface')}
    </div>
  );
}

function LocationStep() {
  const f = useFmt();
  const { t, lang } = f;
  const current = useS((s) => s.location.current);
  const method = useS((s) => s.calc.method);
  const update = useSettings((s) => s.update);
  const choose = useLocations((s) => s.choose);
  const [changing, setChanging] = useState(false);
  const choices = current ? COUNTRY_METHOD_CHOICES[current.country] : undefined;
  return (
    <div className="flex flex-col gap-6">
      <LocationPicker selected={current} autoFocus onPick={(p) => void choose(p, { silent: true })} />
      {current ? (
        <div className="animate-scale-in rounded-panel border border-sage/40 bg-sage-soft/60 p-5">
          <div className="flex items-start gap-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sage-strong text-on-sage">
              <IconCheck size={20} strokeWidth={2.2} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[0.8125rem] text-sage-strong">{t('onboarding.location.selected')}</p>
              <p className="text-lg font-semibold text-ink">{placeName(current, lang)}</p>
              <p className="text-ink-muted">{placeSubtitle(current, lang)}</p>
              <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-[0.9375rem]">
                <dt className="text-ink-muted">{t('onboarding.location.coordinates')}</dt>
                <dd>
                  <bdi dir="ltr" className="tabular">
                    {f.ltr(`${f.num(current.lat.toFixed(4))}, ${f.num(current.lon.toFixed(4))}`)}
                  </bdi>
                </dd>
                <dt className="text-ink-muted">{t('onboarding.location.timezone')}</dt>
                <dd>
                  <bdi dir="ltr">{current.tz}</bdi>
                </dd>
                <dt className="text-ink-muted">{t('onboarding.location.method')}</dt>
                <dd className="flex flex-wrap items-center gap-2">
                  {changing ? (
                    <Select
                      size="sm"
                      label={t('onboarding.location.method')}
                      value={method}
                      onChange={(v) => {
                        update((d) => void (d.calc.method = v));
                        setChanging(false);
                      }}
                      options={METHOD_IDS.filter((m) => m !== 'custom').map((m) => ({ value: m, label: t(`methods.${m}`) }))}
                    />
                  ) : (
                    <>
                      <span className="font-medium text-ink">{t(`methods.${method}`)}</span>
                      {method === defaultMethodFor(current.country) ? (
                        <span className="text-[0.8125rem] text-ink-muted">{t('onboarding.location.suggested', { country: countryName(current.country, lang) })}</span>
                      ) : null}
                      <button type="button" className="text-[0.875rem] font-medium text-sage-strong hover:underline" onClick={() => setChanging(true)}>
                        {t('common.change')}
                      </button>
                    </>
                  )}
                </dd>
              </dl>
              {choices ? (
                <div className="mt-4">
                  <p className="mb-2 text-[0.9375rem] text-ink">{t('onboarding.location.franceChoice')}</p>
                  <div className="flex flex-wrap gap-2">
                    {choices.map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => update((d) => void (d.calc.method = m))}
                        className={clsx('rounded-full border px-3 py-1.5 text-[0.875rem]', method === m ? 'border-sage-strong bg-sage-strong text-on-sage' : 'border-line bg-surface-raised')}
                      >
                        {t(`methods.${m}`)}
                      </button>
                    ))}
                  </div>
                  <p className="mt-2 text-[0.75rem] text-ink-faint">{METHODS[method as keyof typeof METHODS]?.source}</p>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ThemeStep() {
  const { t } = useFmt();
  const theme = useS((s) => s.appearance.theme);
  const update = useSettings((s) => s.update);
  const opts: { value: 'light' | 'dark' | 'system'; label: string; icon: ReactNode }[] = [
    { value: 'light', label: t('common.light'), icon: <IconSun size={18} /> },
    { value: 'dark', label: t('common.dark'), icon: <IconMoon size={18} /> },
    { value: 'system', label: t('common.system'), icon: <IconMonitor size={18} /> },
  ];
  return (
    <div role="radiogroup" className="grid grid-cols-3 gap-4">
      {opts.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={theme === o.value}
          onClick={() => update((d) => void (d.appearance.theme = o.value))}
          className={clsx('flex flex-col gap-3 rounded-hero border-2 p-3 transition-all', theme === o.value ? 'border-sage-strong shadow-md' : 'border-line-soft hover:border-line')}
        >
          <ThemePreview mode={o.value} />
          <span className="flex items-center justify-center gap-2 pb-1 font-medium text-ink">
            {o.icon}
            {o.label}
          </span>
        </button>
      ))}
    </div>
  );
}

function WidgetsStep() {
  const { t } = useFmt();
  const w = useS((s) => s.widgets);
  const update = useSettings((s) => s.update);
  const [platform, setPlatform] = useState<PlatformInfo | null>(null);
  useEffect(() => {
    void api.platformInfo().then(setPlatform).catch(() => {});
  }, []);
  const noTray = platform?.os === 'linux' && platform.statusNotifier === false;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-5 rounded-panel border border-line-soft bg-surface p-5">
        <MiniWidget />
        <Checkbox
          checked={w.main.enabled}
          onChange={(v) => update((d) => void (d.widgets.main.enabled = v))}
          label={<span className="font-medium">{t('onboarding.widgets.main')}</span>}
          hint={t('onboarding.widgets.mainHint')}
        />
      </div>
      <div className="flex items-center gap-5 rounded-panel border border-line-soft bg-surface p-5">
        <MiniFloating />
        <div className="flex flex-col gap-3">
          <Checkbox
            checked={w.mini.enabled}
            onChange={(v) => update((d) => void (d.widgets.mini.enabled = v))}
            label={<span className="font-medium">{t('onboarding.widgets.mini')}</span>}
            hint={t('onboarding.widgets.miniHint')}
          />
          {w.mini.enabled ? (
            <Checkbox
              className="ms-8"
              checked={w.mini.layer === 'top'}
              onChange={(v) => update((d) => void (d.widgets.mini.layer = v ? 'top' : 'desktop'))}
              label={t('onboarding.widgets.onTop')}
            />
          ) : null}
        </div>
      </div>
      <div className="flex items-center gap-5 rounded-panel border border-line-soft bg-surface p-5">
        <MiniPill />
        <Checkbox
          checked={w.indicator.enabled}
          onChange={(v) => update((d) => void (d.widgets.indicator.enabled = v))}
          label={<span className="font-medium">{t('onboarding.widgets.indicator')}</span>}
          hint={t('onboarding.widgets.indicatorHint')}
        />
      </div>
      {noTray ? (
        <div className="rounded-panel bg-ochre-soft p-4 text-ochre-strong">
          <p className="font-semibold">{t('onboarding.widgets.gnomeTitle')}</p>
          <p className="mt-1 text-[0.9375rem]">{t('onboarding.widgets.gnomeBody')}</p>
          <a className="mt-2 inline-block font-medium underline" href="https://extensions.gnome.org/extension/615/appindicator-support/" target="_blank" rel="noreferrer">
            {t('onboarding.widgets.gnomeLink')}
          </a>
        </div>
      ) : null}
    </div>
  );
}

function MiniFloating() {
  const f = useFmt();
  return (
    <div aria-hidden className="flex w-40 shrink-0 justify-center">
      <span className="inline-flex items-center gap-2 rounded-full border border-line-soft bg-surface-raised px-3 py-1.5 shadow-md">
        <span className="h-2 w-2 rounded-full bg-sage-strong" />
        <span className="font-display text-[0.875rem] text-ink">{f.t('prayers.asr')}</span>
        <bdi dir="ltr" className="tabular text-[0.875rem] font-medium text-sage-strong">
          {f.num('+1:12')}
        </bdi>
      </span>
    </div>
  );
}

function MiniWidget() {
  const f = useFmt();
  return (
    <div aria-hidden className="w-40 shrink-0 rounded-[14px] border border-line-soft bg-surface-raised p-3 shadow-md">
      <div className="text-[0.6875rem] text-ink-muted">{f.t('home.sinceLabel')}</div>
      <div className="font-display text-[0.95rem] text-ink">{f.t('prayers.asr')}</div>
      <bdi dir="ltr" className="tabular block text-lg text-sage-strong">
        {f.num('+1:12:40')}
      </bdi>
      <div className="mt-2 flex flex-col gap-1">
        {['maghrib', 'isha'].map((p) => (
          <div key={p} className="flex justify-between text-[0.6875rem] text-ink-muted">
            <span>{f.t(`prayers.${p}`)}</span>
            <bdi dir="ltr" className="tabular">
              {f.num(p === 'maghrib' ? '18:41' : '20:01')}
            </bdi>
          </div>
        ))}
      </div>
    </div>
  );
}

function MiniPill() {
  const f = useFmt();
  return (
    <div aria-hidden className="flex w-40 shrink-0 items-center justify-end gap-2 rounded-[10px] bg-[#1d2420] px-2 py-2">
      <span className="inline-flex items-center gap-1.5 rounded-full bg-[#2c3a31] px-2.5 py-1 text-[0.75rem] text-[#e6e1d4]">
        <span className="h-1.5 w-1.5 rounded-full bg-[#c7a56a]" />
        {f.t('prayers.maghrib')}{' '}
        <bdi dir="ltr" className="tabular">
          {f.num('−29:59')}
        </bdi>
      </span>
      <span className="text-[0.6875rem] text-[#9fa79d]">
        <bdi dir="ltr" className="tabular">
          {f.num('18:11')}
        </bdi>
      </span>
    </div>
  );
}

function AdhanStep() {
  const { t } = useFmt();
  const adhan = useS((s) => s.adhan);
  const update = useSettings((s) => s.update);
  const [sent, setSent] = useState(false);
  const volume = adhan.perPrayer.dhuhr.volume;
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <span className="font-medium text-ink">{t('onboarding.adhan.adhan')}</span>
        <div className="flex items-center gap-2">
          <SoundSelect
            label={t('onboarding.adhan.adhan')}
            value={adhan.perPrayer.dhuhr.sound}
            onChange={(v) =>
              update((d) => {
                for (const p of ['dhuhr', 'asr', 'maghrib', 'isha'] as const) d.adhan.perPrayer[p].sound = v;
              })
            }
          />
          <PreviewButton sound={adhan.perPrayer.dhuhr.sound} volume={volume} />
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <span className="font-medium text-ink">{t('onboarding.adhan.fajr')}</span>
        <span className="-mt-1 text-[0.875rem] text-ink-muted">{t('onboarding.adhan.fajrHint')}</span>
        <div className="flex items-center gap-2">
          <SoundSelect
            fajr
            label={t('onboarding.adhan.fajr')}
            value={adhan.fajrSound}
            onChange={(v) =>
              update((d) => {
                d.adhan.fajrSound = v;
                d.adhan.perPrayer.fajr.sound = v;
              })
            }
          />
          <PreviewButton sound={adhan.fajrSound} volume={volume} />
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <span className="font-medium text-ink">{t('onboarding.adhan.volume')}</span>
        <Slider
          label={t('onboarding.adhan.volume')}
          value={Math.round(volume * 100)}
          min={5}
          max={100}
          step={5}
          format={(v) => `${v}%`}
          onChange={(v) =>
            update((d) => {
              for (const p of ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'] as const) d.adhan.perPrayer[p].volume = v / 100;
            })
          }
          className="max-w-md"
        />
      </div>
      <div>
        <Button
          variant="secondary"
          icon={sent ? <IconCheck size={18} /> : <IconBell size={18} />}
          onClick={async () => {
            const ok = await sendNotification(t('notify.testTitle'), t('notify.testBody'));
            setSent(ok);
            if (ok) toast(t('onboarding.adhan.testSent'), 'success');
          }}
        >
          {sent ? t('onboarding.adhan.testSent') : t('onboarding.adhan.test')}
        </Button>
      </div>
    </div>
  );
}

function StartupStep() {
  const { t } = useFmt();
  const g = useS((s) => s.general);
  const update = useSettings((s) => s.update);
  return (
    <div className="flex flex-col gap-4 rounded-panel border border-line-soft bg-surface p-6">
      <Checkbox checked={g.startWithSystem} onChange={(v) => update((d) => void (d.general.startWithSystem = v))} label={<span className="font-medium">{t('onboarding.startup.startWithSystem')}</span>} />
      <Checkbox
        checked={g.keepInTray}
        onChange={(v) => update((d) => void (d.general.keepInTray = v))}
        label={<span className="font-medium">{t('onboarding.startup.keepInTray')}</span>}
        hint={t('onboarding.startup.keepInTrayHint')}
      />
    </div>
  );
}

function DoneStep() {
  const f = useFmt();
  const engine = usePrayer((s) => s.engine);
  const now = useClock((s) => s.now);
  const place = useS((s) => s.location.current);
  if (!engine) return null;
  const day = engine.day(localDate(now, engine.zone));
  return (
    <div className="rounded-hero border border-line-soft bg-surface p-6 shadow-sm">
      <p className="mb-4 font-medium text-ink">
        {placeName(place, f.lang)} — {f.hijri(day.date)}
      </p>
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
        {(['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'] as const).map((p) => (
          <div key={p} className="rounded-[12px] bg-surface-sunk px-3 py-2.5 text-center">
            <div className="text-[0.8125rem] text-ink-muted">{f.prayer(p, day.isFriday)}</div>
            <bdi dir="ltr" className="tabular block text-[1.0625rem] font-semibold text-ink">
              {f.time(day.times[p], engine.zone)}
            </bdi>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Onboarding() {
  const f = useFmt();
  const { t } = f;
  const navigate = useNavigate();
  const stepIndex = useS((s) => s.onboarding.step);
  const update = useSettings((s) => s.update);
  const hasLocation = useS((s) => s.location.current !== null);
  const engineReady = usePrayer((s) => s.engine !== null);
  const i = Math.min(Math.max(0, stepIndex), STEPS.length - 1);
  const step: Step = STEPS[i]!;
  const go = (n: number) => update((d) => void (d.onboarding.step = n));
  const finish = () => {
    update((d) => {
      d.onboarding.done = true;
      d.onboarding.step = 0;
    });
    navigate('/', { replace: true });
  };
  const canNext = step !== 'location' || (hasLocation && engineReady);

  const content = useMemo(() => {
    switch (step) {
      case 'language':
        return (
          <StepFrame title={t('onboarding.language.title')} subtitle={t('onboarding.language.subtitle')}>
            <div className="mb-10 flex justify-center">
              <AhdMark size={120} />
            </div>
            <LanguageStep />
          </StepFrame>
        );
      case 'location':
        return (
          <StepFrame title={t('onboarding.location.title')} subtitle={t('onboarding.location.subtitle')}>
            <LocationStep />
          </StepFrame>
        );
      case 'times':
        return (
          <StepFrame title={t('onboarding.times.title')} subtitle={t('onboarding.times.subtitle')} wide>
            <TimesTuner />
            <p className="mt-4 text-[0.875rem] text-ink-muted">{t('onboarding.times.note')}</p>
          </StepFrame>
        );
      case 'theme':
        return (
          <StepFrame title={t('onboarding.theme.title')} subtitle={t('onboarding.theme.subtitle')} wide>
            <ThemeStep />
          </StepFrame>
        );
      case 'widgets':
        return (
          <StepFrame title={t('onboarding.widgets.title')} subtitle={t('onboarding.widgets.subtitle')}>
            <WidgetsStep />
          </StepFrame>
        );
      case 'adhan':
        return (
          <StepFrame title={t('onboarding.adhan.title')} subtitle={t('onboarding.adhan.subtitle')}>
            <AdhanStep />
          </StepFrame>
        );
      case 'startup':
        return (
          <StepFrame title={t('onboarding.startup.title')} subtitle={t('onboarding.startup.subtitle')}>
            <StartupStep />
          </StepFrame>
        );
      case 'done':
        return (
          <StepFrame title={t('onboarding.done.title')} subtitle={t('onboarding.done.body')} wide>
            <DoneStep />
          </StepFrame>
        );
    }
  }, [step, t]);

  return (
    <div className="khatam flex h-full flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto px-8 pt-10 pb-8">{content}</div>
      <footer className="flex items-center gap-4 border-t border-line-soft bg-bg px-8 py-4">
        <div className="flex items-center gap-1.5" aria-label={t('onboarding.stepOf', { n: i + 1, total: STEPS.length })} role="progressbar" aria-valuemin={1} aria-valuemax={STEPS.length} aria-valuenow={i + 1}>
          {STEPS.map((s, k) => (
            <span key={s} className={clsx('h-1.5 rounded-full transition-all duration-300', k === i ? 'w-6 bg-sage-strong' : k < i ? 'w-1.5 bg-sage' : 'w-1.5 bg-line')} />
          ))}
        </div>
        <span className="text-[0.875rem] text-ink-muted">{t('onboarding.stepOf', { n: i + 1, total: STEPS.length })}</span>
        <div className="flex-1" />
        {i > 0 ? (
          <Button variant="ghost" onClick={() => go(i - 1)}>
            {t('common.back')}
          </Button>
        ) : null}
        {step === 'done' ? (
          <Button variant="primary" size="lg" onClick={finish}>
            {t('onboarding.done.finish')}
          </Button>
        ) : (
          <Button variant="primary" size="lg" disabled={!canNext} onClick={() => go(i + 1)}>
            {t('common.next')}
          </Button>
        )}
      </footer>
    </div>
  );
}
