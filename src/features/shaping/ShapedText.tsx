import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import clsx from 'clsx';
import { glyphHref, loadedShapingFont, loadShapingFont, type ShapingFont, type ShapingFontId } from './engine';
import { layoutText, type Layout, type LayoutSegment } from './layout';

export type ShapedSegment = LayoutSegment;

interface Props {
  font: ShapingFontId;
  /** a single paragraph; or use `segments` for clickable parts (ayat) or parts with their own size */
  text?: string;
  segments?: ShapedSegment[];
  /** px */
  size: number;
  lineHeight?: number;
  justify?: boolean;
  align?: 'start' | 'center';
  lastAlign?: 'start' | 'center';
  wordSpacing?: number;
  maxLines?: number;
  /** key of the highlighted segment */
  selected?: string | null;
  /** makes segments hoverable and clickable */
  onSegmentClick?: (key: string) => void;
  /** lay out only once scrolled near the viewport (long lists) */
  lazy?: boolean;
  /** scale a single line down so it fits the width (e.g. the calligraphic basmala) … */
  fit?: boolean;
  /** … but not below this size (px): wrap onto more lines instead */
  minFit?: number;
  /** shown with the browser's own text rendering if shaping cannot run */
  fallbackClassName?: string;
  className?: string;
  style?: CSSProperties;
}

function useShapingFont(id: ShapingFontId) {
  const [state, setState] = useState<{ font: ShapingFont | null; error: boolean }>(() => ({ font: loadedShapingFont(id), error: false }));
  useEffect(() => {
    if (state.font?.id === id) return;
    let alive = true;
    loadShapingFont(id).then(
      (font) => alive && setState({ font, error: false }),
      (e: unknown) => {
        console.error('shaping font', id, e);
        if (alive) setState({ font: null, error: true });
      },
    );
    return () => {
      alive = false;
    };
  }, [id, state.font]);
  return state;
}

function useWidth(lazy: boolean) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [visible, setVisible] = useState(!lazy);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setWidth(el.clientWidth);
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    let io: IntersectionObserver | null = null;
    if (lazy) {
      io = new IntersectionObserver((es) => es.some((e) => e.isIntersecting) && setVisible(true), { rootMargin: '300px' });
      io.observe(el);
    }
    return () => {
      ro.disconnect();
      io?.disconnect();
    };
  }, [lazy]);
  return { ref, width, visible };
}

/**
 * Width of an outline in the text colour around each glyph, in screen px. Glyphs drawn as SVG shapes get none of
 * the hinting and contrast that text rendering gives small type, so at reading sizes thin strokes and the dots came
 * out faint (dots of 2 px looked missing); this brings them to the weight of native text, and is lost at large sizes.
 */
const GLYPH_OUTLINE = 0.4;

const Glyphs = memo(function Glyphs({ layout }: { layout: Layout }) {
  return (
    <g pointerEvents="none" stroke="currentColor" strokeWidth={GLYPH_OUTLINE} strokeLinejoin="round">
      {layout.lines.map((line, li) =>
        line.words.map((w, wi) => (
          <g key={`${li}-${wi}`} transform={`translate(${w.x} ${line.baseline}) scale(${w.size} ${-w.size})`}>
            {w.word.glyphs.map((g, gi) => (
              <use key={gi} href={glyphHref(g)} x={g.x} y={g.y} />
            ))}
          </g>
        )),
      )}
    </g>
  );
});

/** Rectangles behind each segment on each line: hover and selection highlight, and the click target. */
function Marks({ layout, segments, selected, hovered, setHovered, onClick }: { layout: Layout; segments: ShapedSegment[]; selected?: string | null; hovered: string | null; setHovered: (k: string | null) => void; onClick?: (k: string) => void }) {
  const rects: { key: string; x: number; y: number; w: number; h: number }[] = [];
  for (const line of layout.lines) {
    const spans = new Map<number, [number, number]>();
    for (const w of line.words) {
      const right = w.x + w.word.width * w.size;
      const s = spans.get(w.segment);
      spans.set(w.segment, s ? [Math.min(s[0], w.x), Math.max(s[1], right)] : [w.x, right]);
    }
    for (const [seg, [l, r]] of spans) {
      const pad = line.height * 0.08;
      rects.push({ key: segments[seg]!.key, x: l - pad, y: line.top + line.height * 0.14, w: r - l + pad * 2, h: line.height * 0.72 });
    }
  }
  return (
    <g>
      {rects.map((r, i) => (
        <rect
          key={i}
          className="shaped-mark"
          data-hover={hovered === r.key || undefined}
          data-selected={selected === r.key || undefined}
          x={r.x}
          y={r.y}
          width={r.w}
          height={r.h}
          rx={6}
          onMouseEnter={onClick ? () => setHovered(r.key) : undefined}
          onMouseLeave={onClick ? () => setHovered(null) : undefined}
          onClick={onClick ? () => onClick(r.key) : undefined}
        />
      ))}
    </g>
  );
}

/** "…" after the last visible word (at the left end: the text is right-to-left). */
function Ellipsis({ layout }: { layout: Layout }) {
  const line = layout.lines[layout.lines.length - 1]!;
  const x = Math.min(...line.words.map((w) => w.x));
  return (
    <text x={x - 2} y={line.baseline} textAnchor="end" fontSize={line.words[0]?.size ?? 16} style={{ fontFamily: 'var(--font-ui)' }}>
      …
    </text>
  );
}

/** Width of the text set on one line, in px — for shrink-wrapping short text such as the hadith inscription. */
export function useShapedWidth(fontId: ShapingFontId, segments: ShapedSegment[], size: number, wordSpacing?: number): number | null {
  const { font } = useShapingFont(fontId);
  return useMemo(() => (font ? layoutText(font, segments, { size, width: 1e7, lineHeight: 1, wordSpacing }).natural : null), [font, segments, size, wordSpacing]);
}

/**
 * Arabic text shaped with HarfBuzz and drawn as SVG (see engine.ts for why). The real text stays in the DOM for
 * screen readers; the drawing is hidden from them.
 */
export function ShapedText({ font: fontId, text, segments: segs, size, lineHeight = 1.9, justify, align = 'start', lastAlign, wordSpacing, maxLines, selected, onSegmentClick, lazy = false, fit = false, minFit = 0, fallbackClassName, className, style }: Props) {
  const segments = useMemo<ShapedSegment[]>(() => segs ?? [{ key: '0', text: text ?? '' }], [segs, text]);
  const { font, error } = useShapingFont(fontId);
  const { ref, width, visible } = useWidth(lazy);
  const [hovered, setHovered] = useState<string | null>(null);
  const layout = useMemo(() => {
    if (!font || width <= 0 || !visible) return null;
    let px = size;
    if (fit) {
      const natural = layoutText(font, segments, { size, width: 1e7, lineHeight }).natural;
      if (natural > width) px = Math.max(minFit, ((size * width) / natural) * 0.995);
    }
    return layoutText(font, segments, { size: px, width, lineHeight, justify, align, lastAlign, wordSpacing, maxLines });
  }, [font, width, visible, fit, minFit, segments, size, lineHeight, justify, align, lastAlign, wordSpacing, maxLines]);
  const plain = segments.map((s) => s.text).join(' ');

  if (error)
    return (
      <p lang="ar" dir="rtl" className={clsx(fallbackClassName, className)} style={{ fontSize: size, lineHeight, textAlign: justify ? 'justify' : align === 'center' ? 'center' : 'start', ...style }}>
        {plain}
      </p>
    );
  return (
    <div ref={ref} lang="ar" dir="rtl" className={clsx('relative', className)} style={{ minHeight: layout ? layout.height : size * lineHeight, ...style }}>
      <span className="sr-only">{plain}</span>
      {layout ? (
        <svg aria-hidden width={layout.width} height={layout.height} className="absolute inset-0 block overflow-visible" fill="currentColor" style={{ direction: 'ltr' }}>
          {onSegmentClick || selected ? <Marks layout={layout} segments={segments} selected={selected} hovered={hovered} setHovered={setHovered} onClick={onSegmentClick} /> : null}
          <Glyphs layout={layout} />
          {layout.truncated ? <Ellipsis layout={layout} /> : null}
        </svg>
      ) : null}
    </div>
  );
}
