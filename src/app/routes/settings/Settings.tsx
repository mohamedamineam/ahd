import { Suspense, lazy, useEffect, useMemo, useRef, useState, type ComponentType } from 'react';
import { NavLink, useLocation, useNavigate, useParams } from 'react-router';
import clsx from 'clsx';
import { useFmt } from '@/lib/useFmt';
import { TextInput } from '@/design/components';
import {
  IconBell,
  IconCalc,
  IconGlobe,
  IconInfo,
  IconLibrary,
  IconPalette,
  IconPin,
  IconQuran,
  IconAdhkar,
  IconSearch,
  IconSettings,
  IconShield,
  IconTimer,
  IconWidget,
  IconClock,
  type IconProps,
} from '@/design/icons';
import en from '@/i18n/en.json';

export const SECTIONS = [
  'general',
  'location',
  'calculation',
  'timer',
  'adhan',
  'reminders',
  'appearance',
  'widgets',
  'quran',
  'adhkar',
  'library',
  'privacy',
  'about',
] as const;
export type SectionId = (typeof SECTIONS)[number];

const ICONS: Record<SectionId, (p: IconProps) => React.ReactElement> = {
  general: IconSettings,
  location: IconPin,
  calculation: IconCalc,
  timer: IconTimer,
  adhan: IconBell,
  reminders: IconClock,
  appearance: IconPalette,
  widgets: IconWidget,
  quran: IconQuran,
  adhkar: IconAdhkar,
  library: IconLibrary,
  privacy: IconShield,
  about: IconInfo,
};

const VIEWS: Record<SectionId, ComponentType> = {
  general: lazy(() => import('./sections/General')),
  location: lazy(() => import('./sections/Location')),
  calculation: lazy(() => import('./sections/Calculation')),
  timer: lazy(() => import('./sections/Timer')),
  adhan: lazy(() => import('./sections/Adhan')),
  reminders: lazy(() => import('./sections/Reminders')),
  appearance: lazy(() => import('./sections/Appearance')),
  widgets: lazy(() => import('./sections/Widgets')),
  quran: lazy(() => import('./sections/QuranSettings')),
  adhkar: lazy(() => import('./sections/AdhkarSettings')),
  library: lazy(() => import('./sections/LibrarySettings')),
  privacy: lazy(() => import('./sections/Privacy')),
  about: lazy(() => import('./sections/About')),
};

// i18n section key → settings section
const KEY_SECTION: Record<string, SectionId> = {
  general: 'general',
  location: 'location',
  calc: 'calculation',
  timer: 'timer',
  adhan: 'adhan',
  reminders: 'reminders',
  appearance: 'appearance',
  widgets: 'widgets',
  quran: 'quran',
  adhkarSettings: 'adhkar',
  library: 'library',
  privacy: 'privacy',
  about: 'about',
};

interface IndexEntry {
  section: SectionId;
  key: string; // i18n key of the label (also the row anchor)
}

function buildIndex(): IndexEntry[] {
  const out: IndexEntry[] = [];
  const settings = (en as unknown as { settings: Record<string, Record<string, unknown>> }).settings;
  for (const [k, section] of Object.entries(KEY_SECTION)) {
    const group = settings[k];
    if (!group || typeof group !== 'object') continue;
    for (const [leaf, v] of Object.entries(group)) {
      if (typeof v !== 'string' || leaf.endsWith('Desc') || /_(one|other|zero|two|few|many)$/.test(leaf)) continue;
      out.push({ section, key: `settings.${k}.${leaf}` });
    }
  }
  return out;
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ًͯ-ٰٟ]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي');

export default function Settings() {
  const f = useFmt();
  const { t } = f;
  const params = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const section = (SECTIONS as readonly string[]).includes(params.section ?? '') ? (params.section as SectionId) : 'general';
  const [query, setQuery] = useState('');
  const index = useMemo(() => buildIndex(), []);
  const content = useRef<HTMLDivElement>(null);

  const results = useMemo(() => {
    const q = norm(query.trim());
    if (q.length < 2) return [];
    return index
      .filter((e) => {
        const label = norm(t(e.key, { defaultValue: '' }));
        const desc = norm(t(`${e.key}Desc`, { defaultValue: '' }));
        return label.includes(q) || desc.includes(q) || norm(t(`settings.sections.${e.section}`)).includes(q);
      })
      .slice(0, 40);
  }, [query, index, t]);

  // scroll to an anchored row (#settings.calc.method)
  useEffect(() => {
    const anchor = decodeURIComponent(location.hash.replace(/^#/, ''));
    if (!anchor) {
      content.current?.scrollTo({ top: 0 });
      return;
    }
    const tm = setTimeout(() => {
      const el = document.getElementById(anchor);
      el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      el?.classList.add('ahd-flash');
      setTimeout(() => el?.classList.remove('ahd-flash'), 1600);
    }, 250);
    return () => clearTimeout(tm);
  }, [location, section]);

  const View = VIEWS[section];

  return (
    <div className="flex h-full min-h-0">
      <aside className="flex w-64 shrink-0 flex-col border-e border-line-soft bg-bg">
        <div className="p-4 pb-2">
          <h1 className="font-display mb-3 text-[1.625rem] text-ink">{t('settings.title')}</h1>
          <TextInput
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('settings.search')}
            aria-label={t('settings.search')}
            leading={<IconSearch size={17} className="text-ink-faint" />}
          />
        </div>
        <nav className="min-h-0 flex-1 overflow-y-auto px-2 pb-4" aria-label={t('settings.title')}>
          {query.trim().length >= 2 ? (
            results.length ? (
              <ul className="flex flex-col gap-0.5">
                {results.map((r) => (
                  <li key={r.key}>
                    <button
                      type="button"
                      onClick={() => navigate(`/settings/${r.section}#${encodeURIComponent(r.key)}`)}
                      className="flex w-full flex-col rounded-[10px] px-3 py-2 text-start hover:bg-[color-mix(in_oklab,var(--ink)_5%,transparent)]"
                    >
                      <span className="text-[0.9375rem] text-ink">{t(r.key)}</span>
                      <span className="text-[0.75rem] text-ink-muted">{t(`settings.sections.${r.section}`)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-3 py-4 text-[0.875rem] text-ink-muted">{t('settings.noMatch', { query })}</p>
            )
          ) : (
            <ul className="flex flex-col gap-0.5">
              {SECTIONS.map((s) => {
                const Icon = ICONS[s];
                return (
                  <li key={s}>
                    <NavLink
                      to={`/settings/${s}`}
                      className={() =>
                        clsx(
                          'flex items-center gap-3 rounded-[10px] px-3 py-2 text-[0.9375rem] transition-colors',
                          section === s ? 'bg-sage-soft font-medium text-ink' : 'text-ink-muted hover:bg-[color-mix(in_oklab,var(--ink)_5%,transparent)] hover:text-ink',
                        )
                      }
                    >
                      <Icon size={18} className={section === s ? 'text-sage-strong' : undefined} />
                      {t(`settings.sections.${s}`)}
                    </NavLink>
                  </li>
                );
              })}
            </ul>
          )}
        </nav>
      </aside>
      <div ref={content} className="min-w-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-8 pt-6 pb-16">
          <h2 className="font-display mb-5 text-[1.625rem] text-ink">{t(`settings.sections.${section}`)}</h2>
          <Suspense fallback={null}>
            <View key={section} />
          </Suspense>
        </div>
      </div>
      <IconGlobe className="hidden" />
    </div>
  );
}
