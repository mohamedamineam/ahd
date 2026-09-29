import clsx from 'clsx';
import { AHD_HADITH } from '@/content/ahdHadith';

function Star({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width="12" height="12" className={className} aria-hidden fill="none" stroke="currentColor" strokeWidth="1.4">
      <rect x="6.5" y="6.5" width="11" height="11" />
      <rect x="6.5" y="6.5" width="11" height="11" transform="rotate(45 12 12)" />
    </svg>
  );
}

/**
 * The hadith the name «عهد» comes from, set like an inscription above a mihrab. Always Arabic, in the
 * owner's exact words (src/content/ahdHadith.ts); quotation marks are rendered as Arabic guillemets.
 */
export function HadithInscription({ className }: { className?: string }) {
  return (
    <figure lang="ar" dir="rtl" className={clsx('hadith-inscription flex items-center justify-center gap-4 text-center', className)}>
      <span aria-hidden className="hidden h-px flex-1 bg-gradient-to-l from-current to-transparent opacity-40 sm:block" />
      <Star className="shrink-0 opacity-70" />
      <blockquote className="min-w-0" cite="https://alsunna.net/hadith/657">
        <p className="leading-[1.9]">
          <span className="hadith-small">{AHD_HADITH.intro}</span>{' '}
          <q className="hadith-text">{AHD_HADITH.text}</q>{' '}
          <cite className="hadith-small not-italic">{AHD_HADITH.reference}</cite>
        </p>
      </blockquote>
      <Star className="shrink-0 opacity-70" />
      <span aria-hidden className="hidden h-px flex-1 bg-gradient-to-r from-current to-transparent opacity-40 sm:block" />
    </figure>
  );
}
