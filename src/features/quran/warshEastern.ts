/**
 * Warsh in Eastern (Mashriqi) writing, for display. The KFGQPC Warsh text (public/quran/warsh.json) writes some
 * Maghrebi conventions in its characters, not only in its font; set in the Eastern (Hafs) font they would be wrong:
 *
 *  - U+06D2 ے is its final yā' written without dots (فِے, اِ۬لذِے, شَےْءٖ): Eastern writing has ي, and ئ when
 *    a hamza sits on it (U+06D2 U+0654, as in يَسْتَهْزِۓُ).
 *  - hamzat al-wasl is a word-initial alif (or one after the prefix وَ / فَ) carrying its starting vowel and then a
 *    dot above, below or in the middle (U+06EC, U+06EA, U+06DF): اِ۬لْحَمْدُ, اُ۪هْدِنَا, اُ۟عْبُدُواْ. Eastern writing
 *    has ٱ (no vowel, no dot). The order tells it apart from the other two uses of these dots, which stay as written:
 *    the dot *before* the vowel is tashīl of a hamza of qaṭʿ after a word ending in hamza (اَ۬لسُّفَهَآءُ اَ۬لَآ), and
 *    U+06DF on an alif *without* a vowel marks a hamza of qaṭʿ dropped by naql (فَإِنُ ا۟حْصِرْتُمْ); the same dot on
 *    an alif after a hamza (ءَاٰ۬مَنتُم) is tashīl too.
 *
 * Everything else — harakat, madd, small waw and ya, the imāla dot, the Warsh pause sign — is kept as written. The
 * stored text, search and copying are unchanged; this only changes what is drawn (src/features/shaping/engine.ts).
 */
import type { ShapingFontId } from '@/features/shaping/engine';
import type { Riwaya } from '@/lib/db';

/** The font the Quran text of a riwaya is drawn with (Settings → Quran → Warsh writing). */
export function quranFont(riwaya: Riwaya, warshScript: 'eastern' | 'maghrebi'): ShapingFontId {
  return riwaya === 'warsh' && warshScript === 'eastern' ? 'warsh-eastern' : riwaya;
}

/** The Warsh text in its Eastern form (see above); the input is one word or more. */
export function easternWarsh(text: string): string {
  return text
    .replace(/\u06D2\u0654/g, '\u0626')
    .replace(/\u06D2/g, '\u064A')
    .replace(/(^|[\s\u00A0])([\u0648\u0641]\u064E)?\u0627[\u064E\u064F\u0650][\u06EC\u06EA\u06DF]/g, '$1$2\u0671');
}
