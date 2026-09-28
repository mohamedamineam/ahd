import { useEffect, useRef, useState, type ReactNode } from 'react';

/**
 * Hero card whose top edge rises into a gentle mihrab (ogee) arch. The outline is an SVG path sized to the
 * card, so the arch stays proportional at any width.
 */
export function MihrabCard({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 1000, h: 400 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => {
      if (e) setSize({ w: e.contentRect.width, h: e.contentRect.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const { w, h } = size;
  const r = 20; // hero radius
  const rise = 26; // how high the arch rises above the shoulders
  const top = rise;
  const archHalf = Math.min(170, w * 0.2);
  const cx = w / 2;
  // shoulders → ogee curves meeting in a soft point at the centre
  const d = [
    `M 0 ${top + r}`,
    `Q 0 ${top} ${r} ${top}`,
    `L ${cx - archHalf} ${top}`,
    `C ${cx - archHalf * 0.45} ${top} ${cx - archHalf * 0.3} ${top - rise * 0.15} ${cx - 10} ${top - rise * 0.88}`,
    `Q ${cx} ${top - rise * 1.02} ${cx + 10} ${top - rise * 0.88}`,
    `C ${cx + archHalf * 0.3} ${top - rise * 0.15} ${cx + archHalf * 0.45} ${top} ${cx + archHalf} ${top}`,
    `L ${w - r} ${top}`,
    `Q ${w} ${top} ${w} ${top + r}`,
    `L ${w} ${h - r}`,
    `Q ${w} ${h} ${w - r} ${h}`,
    `L ${r} ${h}`,
    `Q 0 ${h} 0 ${h - r}`,
    'Z',
  ].join(' ');

  return (
    <div ref={ref} className="relative isolate">
      <svg className="pointer-events-none absolute inset-0 -z-10 h-full w-full overflow-visible" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden>
        <path d={d} fill="var(--surface)" stroke="var(--line-soft)" strokeWidth="1" style={{ filter: 'drop-shadow(0 1px 2px rgb(var(--shadow-color) / 0.06))' }} />
        <path d={d} fill="none" stroke="var(--sand)" strokeOpacity="0.28" strokeWidth="1" transform={`translate(0 5)`} style={{ clipPath: `inset(0 0 ${h - top - 12}px 0)` }} />
      </svg>
      {children}
    </div>
  );
}
