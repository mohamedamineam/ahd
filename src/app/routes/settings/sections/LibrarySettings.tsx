import { useEffect, useState } from 'react';
import { useFmt } from '@/lib/useFmt';
import { db, type LibraryBook } from '@/lib/db';
import { invoke } from '@/lib/bridge';
import { Button, IconButton } from '@/design/components';
import { IconTrash, IconRefresh } from '@/design/icons';
import { formatBytes } from '@/features/library/format';
import { useLibrary } from '@/features/library/store';
import { Group, Row } from './shared';

export default function LibrarySettings() {
  const f = useFmt();
  const { t } = f;
  const [books, setBooks] = useState<LibraryBook[]>([]);
  const refreshCatalog = useLibrary((s) => s.refreshCatalog);
  const reload = () => void db.library.books().then(setBooks);
  useEffect(reload, []);
  const total = books.reduce((n, b) => n + b.size, 0);
  return (
    <>
      <Group>
        <Row k="settings.library.downloads" stacked>
          {books.length ? (
            <ul className="flex flex-col gap-1">
              {books.map((b) => (
                <li key={b.id} className="flex items-center gap-3 rounded-[10px] bg-surface-raised px-3 py-2">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-ink">{b.title}</span>
                    <span className="block truncate text-[0.8125rem] text-ink-muted">{b.author}</span>
                  </span>
                  <span className="tabular text-[0.875rem] text-ink-muted">{f.num(formatBytes(b.size))}</span>
                  <IconButton
                    size="sm"
                    label={t('common.delete')}
                    onClick={async () => {
                      await invoke('library_delete', { id: b.id }).catch(() => {});
                      await db.library.remove(b.id);
                      reload();
                    }}
                  >
                    <IconTrash size={16} />
                  </IconButton>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[0.875rem] text-ink-muted">{t('settings.library.none')}</p>
          )}
          <p className="mt-3 text-[0.875rem] text-ink-muted">{t('settings.library.total', { size: f.num(formatBytes(total)) })}</p>
        </Row>
        <Row k="settings.library.refresh">
          <Button size="sm" variant="secondary" icon={<IconRefresh size={16} />} onClick={() => void refreshCatalog(true)}>
            {t('settings.library.refresh')}
          </Button>
        </Row>
        <Row k="settings.library.folder">
          <Button size="sm" variant="ghost" onClick={() => void invoke('open_library_folder')}>
            {t('common.open')}
          </Button>
        </Row>
      </Group>
    </>
  );
}
