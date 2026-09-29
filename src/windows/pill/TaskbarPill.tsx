import clsx from 'clsx';
import { api } from '@/lib/bridge';
import { useS } from '@/features/settings/store';
import { useAuxWindow, useLive, useWindowsConfigLock } from '../shared';

/** Windows taskbar pill (brief §11.3): "العصر +1:12" beside the notification area. Click opens the panel. */
export default function TaskbarPill() {
  useAuxWindow();
  const locked = useWindowsConfigLock().pill;
  const seconds = useS((s) => s.timer.secondsTaskbar);
  const { state, label, value } = useLive();
  const countdown = state?.mode === 'countdown';
  return (
    <div className="flex h-screen w-screen items-center justify-center" data-tauri-drag-region={!locked || undefined}>
      <button
        type="button"
        onClick={() => void api.openPanel()}
        className="flex h-[28px] items-center gap-2 rounded-full bg-[#1f2722]/90 px-3 text-[0.8125rem] text-[#ece7db] shadow-sm"
      >
        <span className={clsx('h-1.5 w-1.5 rounded-full', countdown ? 'bg-[#c7a56a]' : 'bg-[#8ea993]')} />
        <span>{label(state?.event)}</span>
        <bdi dir="ltr" className="tabular font-medium">
          {value({ seconds })}
        </bdi>
      </button>
    </div>
  );
}
