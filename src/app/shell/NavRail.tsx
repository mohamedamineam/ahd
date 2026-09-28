import { NavLink } from 'react-router';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import { IconAdhkar, IconLibrary, IconPrayer, IconQibla, IconQuran, IconSettings, type IconProps } from '@/design/icons';

const ITEMS: { to: string; key: string; Icon: (p: IconProps) => React.ReactElement; end?: boolean }[] = [
  { to: '/', key: 'prayer', Icon: IconPrayer, end: true },
  { to: '/quran', key: 'quran', Icon: IconQuran },
  { to: '/adhkar', key: 'adhkar', Icon: IconAdhkar },
  { to: '/qibla', key: 'qibla', Icon: IconQibla },
  { to: '/library', key: 'library', Icon: IconLibrary },
];

function Item({ to, label, Icon, end }: { to: string; label: string; Icon: (p: IconProps) => React.ReactElement; end?: boolean }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        clsx(
          'group flex w-full flex-col items-center gap-1 rounded-[14px] px-1 py-1.5 text-[0.75rem] font-medium transition-colors',
          isActive ? 'text-ink' : 'text-ink-muted hover:text-ink',
        )
      }
    >
      {({ isActive }) => (
        <>
          <span
            className={clsx(
              'flex h-8 w-14 items-center justify-center rounded-full transition-[background-color,transform] duration-200',
              isActive ? 'bg-sage-soft text-sage-strong' : 'group-hover:bg-[color-mix(in_oklab,var(--ink)_6%,transparent)]',
            )}
          >
            <Icon size={21} />
          </span>
          <span className="leading-tight">{label}</span>
        </>
      )}
    </NavLink>
  );
}

export function NavRail() {
  const { t } = useTranslation();
  return (
    <nav aria-label={t('nav.label')} className="flex w-[84px] shrink-0 flex-col items-center gap-1 border-e border-line-soft bg-bg px-2 py-3">
      {ITEMS.map((it) => (
        <Item key={it.key} to={it.to} end={it.end} label={t(`nav.${it.key}`)} Icon={it.Icon} />
      ))}
      <div className="flex-1" />
      <Item to="/settings" label={t('nav.settings')} Icon={IconSettings} />
    </nav>
  );
}
