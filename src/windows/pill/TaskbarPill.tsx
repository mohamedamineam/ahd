import { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { api } from '@/lib/bridge';
import { useS } from '@/features/settings/store';
import { useAuxWindow, useLive } from '../shared';

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

/** On a vertical taskbar the window is narrow (Rust sizes it to the taskbar): name and value are stacked. */
function useVertical() {
  const [vertical, setVertical] = useState(() => window.innerWidth < 110);
  useEffect(() => {
    const on = () => setVertical(window.innerWidth < 110);
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  return vertical;
}

/** Windows taskbar pill (brief §11.3): "العصر +1:12" on the taskbar. A click opens the app; unless locked, it can be
 *  dragged along the taskbar (Rust keeps it on the taskbar). */
export default function TaskbarPill() {
  useAuxWindow();
  const seconds = useS((s) => s.timer.secondsTaskbar);
  const { pillBackground: background, pillText: text, pillLocked: locked, labelFormat } = useS((s) => s.widgets.indicator);
  const transparent = background === 'transparent';
  const taskbarLight = useTaskbarLight(transparent ? text === 'auto' : background === 'auto');
  // the tone behind the text: the pill's own colour, or the taskbar itself when the pill is transparent
  const light = transparent ? (text === 'auto' ? taskbarLight : text === 'dark') : background === 'auto' ? taskbarLight : background === 'light';
  const vertical = useVertical();
  const { state, label, value, timeline } = useLive();
  const countdown = state?.mode === 'countdown';

  // "Label format", as in the tray: name and timer, timer only, or the next prayer and its time
  const next = state ? timeline.find((e) => e.at === state.next.at) : undefined;
  const [name, figure] =
    labelFormat === 'value' ? ['', value({ seconds })] : labelFormat === 'name-time' ? [label(state?.next), next?.timeText ?? ''] : [label(state?.event), value({ seconds })];

  // press and release: open the app; press and move: drag along the taskbar (not when locked)
  const drag = useRef<{ x: number; y: number; dx: number; dy: number; moved: boolean; frame: number | null } | null>(null);
  const end = (open: boolean) => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    if (d.frame !== null) cancelAnimationFrame(d.frame);
    if (d.moved) void api.pillDrag('move', d.dx, d.dy).then(() => api.pillDrag('end'));
    else {
      if (!locked) void api.pillDrag('end');
      if (open) void api.showMain();
    }
  };

  return (
    <div className="flex h-screen w-screen items-center justify-center">
      <button
        type="button"
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          e.currentTarget.setPointerCapture(e.pointerId);
          drag.current = { x: e.screenX, y: e.screenY, dx: 0, dy: 0, moved: false, frame: null };
          if (!locked) void api.pillDrag('start');
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (!d || locked) return;
          const scale = window.devicePixelRatio || 1;
          d.dx = Math.round((e.screenX - d.x) * scale);
          d.dy = Math.round((e.screenY - d.y) * scale);
          if (!d.moved && Math.hypot(d.dx, d.dy) < 4 * scale) return;
          d.moved = true;
          d.frame ??= requestAnimationFrame(() => {
            d.frame = null;
            void api.pillDrag('move', d.dx, d.dy);
          });
        }}
        onPointerUp={() => end(true)}
        onPointerCancel={() => end(false)}
        onLostPointerCapture={() => end(false)}
        onClick={(e) => {
          // keyboard only (a mouse click is handled on pointer up)
          if (e.detail === 0) void api.showMain();
        }}
        className={clsx(
          'flex items-center rounded-full',
          vertical ? 'h-full w-full flex-col justify-center gap-0.5 rounded-[10px] px-1 text-[0.6875rem] leading-none' : 'h-full max-h-[28px] gap-2 px-3 text-[0.8125rem]',
          locked ? 'cursor-pointer' : 'cursor-grab active:cursor-grabbing',
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
        {vertical ? null : <span className={clsx('h-1.5 w-1.5 shrink-0 rounded-full', countdown ? (light ? 'bg-[#a07a35]' : 'bg-[#c7a56a]') : light ? 'bg-[#5d7d63]' : 'bg-[#8ea993]')} />}
        {name ? <span className={clsx('whitespace-nowrap', vertical && 'max-w-full truncate')}>{name}</span> : null}
        <bdi dir="ltr" className="tabular font-medium whitespace-nowrap">
          {figure}
        </bdi>
      </button>
    </div>
  );
}
