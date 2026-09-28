import type { TFunction } from 'i18next';

/** "+1 min 20 s" / "+1 د 20 ث" style offset label; empty for zero. */
export function offsetLabel(seconds: number, t: TFunction): string {
  if (!seconds) return '';
  const sign = seconds < 0 ? '−' : '+';
  const abs = Math.abs(seconds);
  const m = Math.floor(abs / 60);
  const s = abs % 60;
  const parts: string[] = [];
  if (m) parts.push(t('time.m', { count: m }));
  if (s) parts.push(t('time.s', { count: s }));
  return `${sign}${parts.join(' ')}`;
}

/** Compact clock-style offset for badges: "+1:20", "−0:30". */
export function offsetClock(seconds: number): string {
  if (!seconds) return '';
  const sign = seconds < 0 ? '−' : '+';
  const abs = Math.abs(seconds);
  return `${sign}${Math.floor(abs / 60)}:${String(abs % 60).padStart(2, '0')}`;
}
