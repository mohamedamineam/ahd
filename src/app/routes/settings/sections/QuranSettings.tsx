import { useEffect, useState } from 'react';
import { useFmt } from '@/lib/useFmt';
import { useS } from '@/features/settings/store';
import { db, type QuranBookmark } from '@/lib/db';
import { Button, IconButton, Segmented, Slider, toast } from '@/design/components';
import { IconTrash } from '@/design/icons';
import { TafsirManager } from '@/features/quran/TafsirManager';
import { Group, ResetSection, Row, useUpdate } from './shared';

export default function QuranSettings() {
  const f = useFmt();
  const { t } = f;
  const q = useS((s) => s.quran);
  const update = useUpdate();
  const [bookmarks, setBookmarks] = useState<QuranBookmark[]>([]);
  const reload = () => void db.quran.bookmarks().then(setBookmarks);
  useEffect(reload, []);
  return (
    <>
      <Group>
        <Row k="settings.quran.riwaya">
          <Segmented
            label={t('settings.quran.riwaya')}
            value={q.riwaya}
            onChange={(v) => update((d) => void (d.quran.riwaya = v))}
            options={[
              { value: 'hafs', label: t('settings.quran.hafs') },
              { value: 'warsh', label: t('settings.quran.warsh') },
            ]}
          />
        </Row>
        {q.riwaya === 'warsh' ? (
          <Row k="settings.quran.warshScript">
            <Segmented
              size="sm"
              label={t('settings.quran.warshScript')}
              value={q.warshScript}
              onChange={(v) => update((d) => void (d.quran.warshScript = v))}
              options={[
                { value: 'eastern', label: t('settings.quran.warshEastern') },
                { value: 'maghrebi', label: t('settings.quran.warshMaghrebi') },
              ]}
            />
          </Row>
        ) : null}
        <Row k="settings.quran.fontSize">
          <Slider label={t('settings.quran.fontSize')} value={Math.round(q.fontScale * 100)} min={80} max={180} step={10} format={(v) => `${v}%`} onChange={(v) => update((d) => void (d.quran.fontScale = v / 100))} className="w-56" />
        </Row>
        <Row k="settings.quran.layout">
          <Segmented
            size="sm"
            label={t('settings.quran.layout')}
            value={q.layout}
            onChange={(v) => update((d) => void (d.quran.layout = v))}
            options={[
              { value: 'auto', label: t('settings.quran.layoutAuto') },
              { value: 'single', label: t('settings.quran.layoutSingle') },
              { value: 'spread', label: t('settings.quran.layoutSpread') },
            ]}
          />
        </Row>
        <Row k="settings.quran.arrows">
          <Segmented
            size="sm"
            label={t('settings.quran.arrows')}
            value={q.arrowNextIsLeft ? 'mushaf' : 'book'}
            onChange={(v) => update((d) => void (d.quran.arrowNextIsLeft = v === 'mushaf'))}
            options={[
              { value: 'mushaf', label: t('settings.quran.arrowsMushaf') },
              { value: 'book', label: t('settings.quran.arrowsBook') },
            ]}
          />
        </Row>
        <Row k="settings.quran.theme">
          <Segmented
            size="sm"
            label={t('settings.quran.theme')}
            value={q.theme}
            onChange={(v) => update((d) => void (d.quran.theme = v))}
            options={[
              { value: 'auto', label: t('settings.quran.themeAuto') },
              { value: 'parchment', label: t('settings.quran.parchment') },
              { value: 'sepia', label: t('settings.quran.sepia') },
              { value: 'dark', label: t('common.dark') },
            ]}
          />
        </Row>
      </Group>
      <Group title={t('settings.quran.tafsir')}>
        <div id="settings.quran.tafsir" className="py-4">
          <p className="mb-3 text-[0.875rem] text-ink-muted">{t('settings.quran.tafsirDesc')}</p>
          <TafsirManager />
        </div>
      </Group>
      <Group>
        <Row k="settings.quran.bookmarks" stacked>
          {bookmarks.length ? (
            <ul className="flex flex-col gap-1">
              {bookmarks.map((b) => (
                <li key={b.slot} className="flex items-center gap-3 rounded-[10px] bg-surface-raised px-3 py-2">
                  <span className="h-5 w-2 rounded-full" style={{ background: b.color }} />
                  <span className="flex-1 font-medium text-ink">{b.name}</span>
                  <span className="text-[0.875rem] text-ink-muted">
                    {t(`settings.quran.${b.riwaya}`)} — {f.num(`${b.surah}:${b.ayah}`)}
                  </span>
                  <IconButton size="sm" label={t('common.delete')} onClick={() => void db.quran.removeBookmark(b.slot).then(reload)}>
                    <IconTrash size={16} />
                  </IconButton>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[0.875rem] text-ink-muted">{t('settings.quran.noBookmarks')}</p>
          )}
        </Row>
        <Row k="settings.quran.clearLastRead">
          <Button
            size="sm"
            variant="secondary"
            onClick={async () => {
              await db.quran.clearLastRead();
              toast(t('common.saved'), 'success');
            }}
          >
            {t('common.clear')}
          </Button>
        </Row>
      </Group>
      <ResetSection keys={['quran']} />
    </>
  );
}
