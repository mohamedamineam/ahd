import type { ReactNode } from 'react';
import clsx from 'clsx';
import { api } from '@/lib/bridge';
import { useS } from '@/features/settings/store';
import { useAudio } from '@/app/shell/AdhanPlayingPill';
import { glass, useAuxWindow, useLive, useWindowsConfigLock } from '../shared';

/** One line: the prayer (after its dot) on one side, the figure on the other; any spare room stays between them. */
function Line({ lead, name, time, figure, tone, drag }: { lead: ReactNode; name: ReactNode; time?: string; figure: string; tone: string; drag: true | undefined }) {
  return (
    <span className="flex items-center justify-between gap-3" data-tauri-drag-region={drag}>
      <span className="flex min-w-0 items-center gap-2.5" data-tauri-drag-region={drag}>
        {lead}
        {name ? (
          <span className="font-display whitespace-nowrap text-[1rem] leading-none text-ink" data-tauri-drag-region={drag}>
            {name}
          </span>
        ) : null}
        {time ? (
          <bdi dir="ltr" className="tabular whitespace-nowrap text-[0.875rem] leading-none text-ink-muted" data-tauri-drag-region={drag}>
            {time}
          </bdi>
        ) : null}
      </span>
      <bdi dir="ltr" className={clsx('tabular shrink-0 whitespace-nowrap text-[1rem] leading-none font-medium', tone)} data-tauri-drag-region={drag}>
        {figure}
      </bdi>
    </span>
  );
}

/** The very small widget, floating anywhere (above all apps by default): the prayer and its timer, or two prayers at
 *  once (Settings → Widgets → Type): the last one and the next one, or the next one with its time. */
export default function MiniWidget() {
  useAuxWindow();
  const cfg = useS((s) => s.widgets.mini);
  const lock = useWindowsConfigLock();
  const locked = lock.mini || cfg.locked;
  const drag = !locked || undefined;
  const { state, label, value, since, until, nextTime } = useLive();
  const audio = useAudio();
  const countdown = state?.mode === 'countdown';
  const playing = audio.playing && audio.kind === 'adhan';
  const g = glass(cfg.opacity);
  const two = cfg.content === 'two-value' || cfg.content === 'two-time';
  const dot = (tone: 'sage' | 'ochre', breathe = false) => (
    <span className={clsx('h-2.5 w-2.5 shrink-0 rounded-full', tone === 'ochre' ? 'bg-ochre' : 'bg-sage-strong')} style={breathe ? { animation: 'ahd-breathe 2s ease-in-out infinite' } : undefined} />
  );
  // while the adhan plays, the stop button takes the first dot's place (nothing else has to shrink)
  const lead = (fallback: ReactNode) =>
    playing ? (
      <button type="button" aria-label="stop" onClick={() => void api.stopAdhan()} className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sage-strong text-on-sage">
        <span className="h-2 w-2 rounded-[2px] bg-current" />
      </button>
    ) : (
      fallback
    );

  return (
    <div className="flex h-screen w-screen items-center justify-center p-1.5" data-tauri-drag-region={drag}>
      <div
        data-tauri-drag-region={drag}
        onDoubleClick={() => void api.showMain()}
        className={clsx(
          'relative flex h-full w-full overflow-hidden border ps-3.5 pe-4',
          two ? 'flex-col justify-center gap-2 rounded-[20px]' : 'flex-col justify-center rounded-full',
          g.halo && 'float-halo',
        )}
        style={g.style}
      >
        {two ? (
          <>
            <Line lead={lead(dot('sage'))} name={label(state?.prev)} figure={since({ seconds: cfg.seconds })} tone="text-sage-strong" drag={drag} />
            {cfg.content === 'two-value' ? (
              <Line lead={dot('ochre', countdown)} name={label(state?.next)} figure={until({ seconds: cfg.seconds })} tone="text-ochre-strong" drag={drag} />
            ) : (
              <Line lead={dot('ochre')} name={label(state?.next)} figure={nextTime} tone="text-ink" drag={drag} />
            )}
          </>
        ) : cfg.content === 'next-time-value' ? (
          <Line lead={lead(dot('ochre', countdown))} name={label(state?.next)} time={nextTime} figure={until({ seconds: cfg.seconds })} tone="text-ochre-strong" drag={drag} />
        ) : (
          <Line
            lead={lead(dot(countdown ? 'ochre' : 'sage', countdown))}
            name={cfg.showName ? label(state?.event) : null}
            figure={value({ seconds: cfg.seconds })}
            tone={countdown ? 'text-ochre-strong' : 'text-sage-strong'}
            drag={drag}
          />
        )}
        <span className="absolute inset-x-4 bottom-0 h-[2px] rounded-full bg-line-soft">
          <span className={clsx('absolute inset-y-0 start-0 rounded-full', countdown ? 'bg-ochre' : 'bg-sage')} style={{ width: `${Math.round((state?.progress ?? 0) * 100)}%`, transition: 'width 900ms linear' }} />
        </span>
      </div>
    </div>
  );
}
