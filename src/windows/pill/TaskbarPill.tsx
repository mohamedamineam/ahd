import { useEffect, useState } from 'react';
import clsx from 'clsx';
import { api } from '@/lib/bridge';
import { useS } from '@/features/settings/store';
import { useAuxWindow, useLive, useWindowsConfigLock } from '../shared';

/** Is the taskbar light? Checked every half minute, since the Windows theme can change while the pill is shown. */
function useTaskbarLight(check: boolean) {
  const [light, setLight] = useState(false);
  useEffect(() => {
    if (!check) return;
    const read = () =>
      void api
        .taskbarIsLight()
        .then((v) => setLight(!!v))
        .catch(() => {});
    read();
    const id = window.setInterval(read, 30_000);
    return () => window.clearInterval(id);
  }, [check]);
  return light;
}

/** Windows taskbar pill (brief §11.3): "العصر +1:12" beside the notification area. Click opens the panel. */
export default function TaskbarPill() {
  useAuxWindow();
  const locked = useWindowsConfigLock().pill;
  const seconds = useS((s) => s.timer.secondsTaskbar);
  const background = useS((s) => s.widgets.indicator.pillBackground);
  const text = useS((s) => s.widgets.indicator.pillText);
  const transparent = background === 'transparent';
  const taskbarLight = useTaskbarLight(transparent ? text === 'auto' : background === 'auto');
  // the tone behind the text: the pill's own colour, or the taskbar itself when the pill is transparent
  const light = transparent ? (text === 'auto' ? taskbarLight : text === 'dark') : background === 'auto' ? taskbarLight : background === 'light';
  const { state, label, value } = useLive();
  const countdown = state?.mode === 'countdown';
  return (
    <div className="flex h-screen w-screen items-center justify-center" data-tauri-drag-region={!locked || undefined}>
      <button
        type="button"
        onClick={() => void api.openPanel()}
        className={clsx(
          'flex h-[28px] items-center gap-2 rounded-full px-3 text-[0.8125rem]',
          light ? 'text-[#1f2722]' : transparent ? 'text-white' : 'text-[#ece7db]',
          transparent
            ? // no pill: a soft halo keeps the text readable on a busy or translucent taskbar
              light
              ? '[text-shadow:0_0_3px_rgb(255_255_255/0.7)]'
              : '[text-shadow:0_1px_3px_rgb(0_0_0/0.6)]'
            : light
              ? 'border border-black/10 bg-[#f4f1ea]/90 shadow-sm'
              : 'bg-[#1f2722]/90 shadow-sm',
        )}
      >
        <span className={clsx('h-1.5 w-1.5 rounded-full', countdown ? (light ? 'bg-[#a07a35]' : 'bg-[#c7a56a]') : light ? 'bg-[#5d7d63]' : 'bg-[#8ea993]')} />
        <span>{label(state?.event)}</span>
        <bdi dir="ltr" className="tabular font-medium">
          {value({ seconds })}
        </bdi>
      </button>
    </div>
  );
}
