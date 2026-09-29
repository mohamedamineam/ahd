import { useCallback, useEffect, useMemo, useState } from 'react';
import { Route, Routes, useNavigate, useParams } from 'react-router';
import clsx from 'clsx';
import { convertFileSrc } from '@tauri-apps/api/core';
import { useFmt } from '@/lib/useFmt';
import { useS } from '@/features/settings/store';
import { IS_TAURI } from '@/lib/bridge';
import { useLibrary, type CatalogBook, type LibraryCategory } from '@/features/library/store';
import { formatBytes } from '@/features/library/format';
import { PdfReader } from '@/features/library/PdfReader';
import { Badge, Button, EmptyState, IconButton, Select, Tabs, TextInput } from '@/design/components';
import { IconChevronStart, IconDownload, IconExternal, IconLibrary, IconSearch, IconTrash } from '@/design/icons';

const CATEGORIES: LibraryCategory[] = ['tafsir', 'sirah', 'aqidah', 'tazkiyah', 'hadith', 'fiqh', 'adhkar'];
const COVER: Record<LibraryCategory, string> = {
  tafsir: 'var(--tod-noon)',
  sirah: 'var(--tod-sunset)',
  aqidah: 'var(--sage)',
  tazkiyah: 'var(--tod-dawn)',
  hadith: 'var(--sand)',
  fiqh: 'var(--tod-afternoon)',
  adhkar: 'var(--sage-strong)',
};

async function openExternal(url: string) {
  if (IS_TAURI) {
    const { openUrl } = await import('@tauri-apps/plugin-opener');
    await openUrl(url);
  } else window.open(url, '_blank', 'noopener');
}

function BookCard({ b }: { b: CatalogBook }) {
  const f = useFmt();
  const { t } = f;
  const navigate = useNavigate();
  const { downloaded, progress, errors, download, remove } = useLibrary();
  const allowed = useS((s) => s.privacy.library);
  const local = downloaded.find((d) => d.id === b.id);
  const p = progress[b.id];
  const pct = p?.total ? Math.round((p.received / p.total) * 100) : null;
  return (
    <article className="flex gap-4 rounded-panel border border-line-soft bg-surface p-4">
      <div className="relative flex h-32 w-24 shrink-0 flex-col justify-between overflow-hidden rounded-[8px] p-2.5 shadow-sm" style={{ background: `linear-gradient(160deg, color-mix(in oklab, ${COVER[b.category]} 85%, white), ${COVER[b.category]})` }} aria-hidden>
        <span className="text-[0.625rem] text-white/85">{t(`library.categories.${b.category}`)}</span>
        <span className="font-display line-clamp-3 text-[0.8125rem] leading-snug text-white" dir="rtl">
          {b.title}
        </span>
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <h3 dir="rtl" lang="ar" className="font-display line-clamp-2 text-[1.0625rem] leading-snug text-ink">
          {b.title}
        </h3>
        <p dir="rtl" lang="ar" className="mt-0.5 truncate text-[0.8125rem] text-ink-muted">
          {b.author}
        </p>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <Badge tone="outline">{b.format.toUpperCase()}</Badge>
          <Badge tone="neutral">{f.num(b.sizeText)}</Badge>
          {local ? <Badge tone="sage">{t('common.downloaded')}</Badge> : null}
        </div>
        <div className="mt-auto flex flex-wrap items-center gap-2 pt-3">
          {local ? (
            <>
              <Button size="sm" variant="primary" onClick={() => navigate(`/library/read/${b.id}`)}>
                {local.lastPage > 1 ? t('library.continue', { page: f.num(local.lastPage) }) : t('library.read')}
              </Button>
              <IconButton size="sm" label={t('common.delete')} onClick={() => void remove(b.id)}>
                <IconTrash size={16} />
              </IconButton>
            </>
          ) : p ? (
            <div className="flex w-full items-center gap-2">
              <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-line-soft">
                <span className="block h-full rounded-full bg-sage-strong transition-[width]" style={{ width: `${pct ?? 5}%` }} />
              </span>
              <span className="tabular text-[0.75rem] text-ink-muted">{pct !== null ? `${f.num(pct)}%` : f.num(formatBytes(p.received))}</span>
            </div>
          ) : (
            <Button size="sm" variant="secondary" icon={<IconDownload size={16} />} disabled={!allowed} onClick={() => void download(b)} title={allowed ? undefined : t('errors.networkDisabled')}>
              {t('common.download')}
            </Button>
          )}
          <IconButton size="sm" label={t('library.source')} onClick={() => void openExternal(b.page)}>
            <IconExternal size={16} />
          </IconButton>
        </div>
        {errors[b.id] ? <p className="mt-1 text-[0.75rem] text-danger">{errors[b.id] === 'desktop-only' ? t('library.desktopOnly') : t('library.failed')}</p> : null}
      </div>
    </article>
  );
}

function Catalog({ onlyDownloaded }: { onlyDownloaded?: boolean }) {
  const { t } = useFmt();
  const { catalog, downloaded } = useLibrary();
  const [category, setCategory] = useState<'all' | LibraryCategory>('all');
  const [author, setAuthor] = useState('all');
  const [q, setQ] = useState('');
  const authors = useMemo(() => [...new Set(catalog.books.map((b) => b.author.split('،')[0]!.trim()))], [catalog]);
  const list = catalog.books.filter(
    (b) =>
      (!onlyDownloaded || downloaded.some((d) => d.id === b.id)) &&
      (category === 'all' || b.category === category) &&
      (author === 'all' || b.author.startsWith(author)) &&
      (!q.trim() || b.title.includes(q.trim()) || b.author.includes(q.trim())),
  );
  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="w-64">
          <TextInput value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('library.search')} aria-label={t('library.search')} leading={<IconSearch size={16} className="text-ink-faint" />} />
        </div>
        <Select label={t('library.category')} size="sm" value={category} onChange={(v) => setCategory(v as typeof category)} options={[{ value: 'all', label: t('library.allCategories') }, ...CATEGORIES.map((c) => ({ value: c, label: t(`library.categories.${c}`) }))]} />
        <Select label={t('library.author')} size="sm" value={author} onChange={setAuthor} options={[{ value: 'all', label: t('library.allAuthors') }, ...authors.map((a) => ({ value: a, label: a }))]} />
      </div>
      {list.length ? (
        <div className="grid gap-3 lg:grid-cols-2">
          {list.map((b) => (
            <BookCard key={b.id} b={b} />
          ))}
        </div>
      ) : (
        <EmptyState icon={<IconLibrary size={26} />} title={onlyDownloaded ? t('library.noDownloads') : t('library.noMatch')} />
      )}
    </>
  );
}

function Reader() {
  const { t } = useFmt();
  const navigate = useNavigate();
  const { id = '' } = useParams();
  const { downloaded, setLastPage } = useLibrary();
  const book = downloaded.find((b) => b.id === id);
  const onPage = useCallback((p: number) => void setLastPage(id, p), [id, setLastPage]);
  if (!book) return <EmptyState title={t('library.noDownloads')} />;
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-3 border-b border-line-soft px-4 py-2.5">
        <IconButton size="sm" label={t('common.back')} onClick={() => navigate('/library')}>
          <IconChevronStart size={18} />
        </IconButton>
        <h1 dir="rtl" className="font-display truncate text-[1.125rem] text-ink">
          {book.title}
        </h1>
      </div>
      <div className="min-h-0 flex-1">
        <PdfReader bookId={book.id} src={IS_TAURI ? convertFileSrc(book.path) : book.path} initialPage={book.lastPage} onPage={onPage} />
      </div>
    </div>
  );
}

function Home() {
  const { t } = useFmt();
  const [tab, setTab] = useState<'catalog' | 'downloaded'>('catalog');
  const { catalog, downloaded, refreshCatalog, refreshing } = useLibrary();
  return (
    <div className="mx-auto max-w-[1080px] px-6 pt-5 pb-10">
      <header className="mb-3 flex flex-wrap items-center gap-3">
        <h1 className="font-display flex-1 text-[1.75rem] text-ink">{t('library.title')}</h1>
        <Button size="sm" variant="ghost" loading={refreshing} onClick={() => void refreshCatalog(true)}>
          {t('settings.library.refresh')}
        </Button>
      </header>
      <Tabs
        className="mb-4"
        label={t('library.title')}
        value={tab}
        onChange={setTab}
        items={[
          { value: 'catalog', label: t('library.catalog'), count: catalog.books.length },
          { value: 'downloaded', label: t('library.downloaded'), count: downloaded.length },
        ]}
      />
      <Catalog onlyDownloaded={tab === 'downloaded'} />
      <p className={clsx('mt-8 text-center text-[0.8125rem] text-ink-faint')}>{t('library.attribution')}</p>
    </div>
  );
}

export default function Library() {
  const load = useLibrary((s) => s.load);
  useEffect(() => {
    void load();
  }, [load]);
  return (
    <Routes>
      <Route index element={<Home />} />
      <Route path="read/:id" element={<Reader />} />
    </Routes>
  );
}
