import { useEffect, useState } from 'react';
import clsx from 'clsx';
import { win } from '@/lib/bridge';
import { useFmt } from '@/lib/useFmt';
import { useNowMinute } from '@/lib/clock';
import { usePrayer } from '@/features/prayer/store';
import { localDate } from '@/features/prayer/engine';
import { hijriBaseDate } from '@/features/prayer/dates';
import { weekdayName } from '@/lib/format';
import { IconWinClose, IconWinMaximize, IconWinMinimize, IconWinRestore } from '@/design/icons';
import { useS } from '@/features/settings/store';
import { SakanMark } from '@/design/brand/SakanMark';
import { LocationSwitcher } from './LocationSwitcher';

function WindowControls() {
  const { t } = useFmt();
  const [max, setMax] = useState(false);
  useEffect(() => {
    void win.isMaximized().then(setMax);
    const un = win.onResized(() => void win.isMaximized().then(setMax));
    return () => {
      void un.then((f) => f());
    };
  }, []);
  const btn =
    'no-drag inline-flex h-8 w-10 items-center justify-center rounded-[8px] text-ink-muted transition-colors hover:bg-[color-mix(in_oklab,var(--ink)_8%,transparent)] hover:text-ink';
  return (
    <div className="no-drag flex items-center gap-0.5">
      <button type="button" className={btn} aria-label={t('titlebar.minimize')} title={t('titlebar.minimize')} onClick={() => void win.minimize()}>
        <IconWinMinimize size={18} />
      </button>
      <button
        type="button"
        className={btn}
        aria-label={max ? t('titlebar.restore') : t('titlebar.maximize')}
        title={max ? t('titlebar.restore') : t('titlebar.maximize')}
        onClick={() => void win.toggleMaximize()}
      >
        {max ? <IconWinRestore size={18} /> : <IconWinMaximize size={18} />}
      </button>
      <button
        type="button"
        className={clsx(btn, 'hover:!bg-danger hover:!text-white')}
        aria-label={t('titlebar.close')}
        title={t('titlebar.close')}
        onClick={() => void win.close()}
      >
        <IconWinClose size={18} />
      </button>
    </div>
  );
}

function Dates() {
  const f = useFmt();
  const now = useNowMinute();
  const engine = usePrayer((s) => s.engine);
  const atMaghrib = useS((s) => s.calc.hijriAtMaghrib);
  if (!engine) return null;
  const date = localDate(now, engine.zone);
  return (
    <div className="flex items-center gap-3 text-[0.875rem]" data-tauri-drag-region>
      <span className="text-ink" data-tauri-drag-region>
        <span className="font-medium" data-tauri-drag-region>
          {weekdayName(date, f.lang)}
        </span>{' '}
        {f.hijri(hijriBaseDate(now, engine, atMaghrib))}
      </span>
      <span className="h-4 w-px bg-line" aria-hidden />
      <span className="text-ink-muted" data-tauri-drag-region>
        {f.gregorian(date)}
      </span>
    </div>
  );
}

export function TitleBar({ minimal = false }: { minimal?: boolean }) {
  const { t } = useFmt();
  return (
    <header
      data-tauri-drag-region
      className="drag-region relative z-20 flex h-[52px] shrink-0 items-center gap-3 border-b border-line-soft bg-bg ps-4 pe-2"
    >
      <div className="flex items-center gap-2.5" data-tauri-drag-region>
        <SakanMark size={24} />
        <span className="font-display text-[1.0625rem] leading-none text-ink" data-tauri-drag-region>
          {t('app.name')}
        </span>
      </div>
      {!minimal ? <LocationSwitcher /> : null}
      <div className="min-w-0 flex-1 self-stretch" data-tauri-drag-region />
      {!minimal ? <Dates /> : null}
      <div className="w-2" data-tauri-drag-region />
      <WindowControls />
    </header>
  );
}
