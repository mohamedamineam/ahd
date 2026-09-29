import { useMemo } from 'react';
import clsx from 'clsx';
import { AHD_HADITH } from '@/content/ahdHadith';
import { ShapedText, useShapedWidth, type ShapedSegment } from '@/features/shaping/ShapedText';

function Star({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width="12" height="12" className={className} aria-hidden fill="none" stroke="currentColor" strokeWidth="1.4">
      <rect x="6.5" y="6.5" width="11" height="11" />
      <rect x="6.5" y="6.5" width="11" height="11" transform="rotate(45 12 12)" />
    </svg>
  );
}

const SIZE = 16;

/**
 * The hadith the name «عهد» comes from, set like an inscription above a mihrab. Always Arabic, in the
 * owner's exact words (src/content/ahdHadith.ts), with the hadith itself between Arabic guillemets and larger.
 * Shaped with HarfBuzz (Aref Ruqaa positions its letters and dots with offsets the Linux webview drops).
 */
export function HadithInscription({ className }: { className?: string }) {
  const segments = useMemo<ShapedSegment[]>(
    () => [
      { key: 'intro', text: AHD_HADITH.intro },
      { key: 'text', text: `«${AHD_HADITH.text}»`, scale: 1.6 },
      { key: 'ref', text: AHD_HADITH.reference },
    ],
    [],
  );
  const natural = useShapedWidth('ruqaa', segments, SIZE);
  return (
    <figure lang="ar" dir="rtl" className={clsx('hadith-inscription flex items-center justify-center gap-4 text-center', className)}>
      <span aria-hidden className="hidden h-px flex-1 bg-gradient-to-l from-current to-transparent opacity-40 sm:block" />
      <Star className="shrink-0 opacity-70" />
      <blockquote className="min-w-0 shrink" cite="https://alsunna.net/hadith/657" style={{ width: natural ? Math.ceil(natural) + 2 : undefined, maxWidth: '100%' }}>
        {/* always one line, like an inscription: scaled down rather than wrapped when space is short */}
        <ShapedText font="ruqaa" segments={segments} size={SIZE} lineHeight={1.9} align="center" fit fallbackClassName="hadith-fallback" />
      </blockquote>
      <Star className="shrink-0 opacity-70" />
      <span aria-hidden className="hidden h-px flex-1 bg-gradient-to-r from-current to-transparent opacity-40 sm:block" />
    </figure>
  );
}
