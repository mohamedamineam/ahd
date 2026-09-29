import clsx from 'clsx';
import { api } from '@/lib/bridge';
import { useS } from '@/features/settings/store';
import { useAudio } from '@/app/shell/AdhanPlayingPill';
import { useAuxWindow, useLive, useWindowsConfigLock } from '../shared';

/** The very small widget: prayer name + timer, floating anywhere (above all apps by default). */
export default function MiniWidget() {
  useAuxWindow();
  const cfg = useS((s) => s.widgets.mini);
  const lock = useWindowsConfigLock();
  const locked = lock.mini || cfg.locked;
  const { state, label, value } = useLive();
  const audio = useAudio();
  const countdown = state?.mode === 'countdown';
  const playing = audio.playing && audio.kind === 'adhan';
  return (
    <div className="flex h-screen w-screen items-center justify-center p-1.5" data-tauri-drag-region={!locked || undefined}>
      <div
        data-tauri-drag-region={!locked || undefined}
        onDoubleClick={() => void api.showMain()}
        className="relative flex h-full w-full items-center gap-2.5 overflow-hidden rounded-full border border-line-soft px-4 shadow-md"
        style={{ background: `color-mix(in oklab, var(--surface) ${Math.round(cfg.opacity * 100)}%, transparent)` }}
      >
        <span className={clsx('h-2.5 w-2.5 shrink-0 rounded-full', countdown ? 'bg-ochre' : 'bg-sage-strong')} style={countdown ? { animation: 'ahd-breathe 2s ease-in-out infinite' } : undefined} />
        {cfg.showName ? (
          <span className="font-display min-w-0 truncate text-[1rem] text-ink" data-tauri-drag-region={!locked || undefined}>
            {label(state?.event)}
          </span>
        ) : null}
        <bdi dir="ltr" className={clsx('tabular ms-auto text-[1.0625rem] font-medium', countdown ? 'text-ochre-strong' : 'text-sage-strong')} data-tauri-drag-region={!locked || undefined}>
          {value({ seconds: cfg.seconds })}
        </bdi>
        {playing ? (
          <button type="button" aria-label="stop" onClick={() => void api.stopAdhan()} className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sage-strong text-on-sage">
            <span className="h-2 w-2 rounded-[2px] bg-current" />
          </button>
        ) : null}
        <span className="absolute inset-x-4 bottom-0 h-[2px] rounded-full bg-line-soft">
          <span className={clsx('absolute inset-y-0 start-0 rounded-full', countdown ? 'bg-ochre' : 'bg-sage')} style={{ width: `${Math.round((state?.progress ?? 0) * 100)}%`, transition: 'width 900ms linear' }} />
        </span>
      </div>
    </div>
  );
}
