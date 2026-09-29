import { useFmt } from '@/lib/useFmt';

/** Tafsir downloads (Quran module). */
export function TafsirManager() {
  const { t } = useFmt();
  return <p className="text-[0.875rem] text-ink-muted">{t('common.notAvailable')}</p>;
}
