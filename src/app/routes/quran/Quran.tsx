import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router';
import clsx from 'clsx';
import '@/features/quran/quran.css';
import { useFmt } from '@/lib/useFmt';
import { useS, useSettings } from '@/features/settings/store';
import { resolvedTheme } from '@/app/appearance';
import { db, type QuranBookmark } from '@/lib/db';
import { ayatOfPage, loadQuran, mapPosition, pageOf, searchQuran, useQuran, type AyahRow, type QuranData, type Riwaya } from '@/features/quran/data';
import { ShapedText, type ShapedSegment } from '@/features/shaping/ShapedText';
import { quranFont } from '@/features/quran/warshEastern';
import { Button, Dialog, IconButton, Segmented, Skeleton, Tabs, TextInput, toast } from '@/design/components';
import { IconBookmark, IconChevronLeft, IconChevronRight, IconClose, IconFocus, IconSearch, IconSinglePage, IconSpread } from '@/design/icons';

const RIBBONS = ['#6F8A74', '#A8864F', '#9C5F55', '#6E7890', '#B9A780'];

interface Sel {
  surah: number;
  ayah: number;
}

function SurahHeader({ data, surah }: { data: QuranData; surah: number }) {
  const s = data.surahs[surah - 1]!;
  return (
    <div className="my-3 select-none" aria-label={s.ar}>
      <div
        className="relative mx-auto flex h-12 max-w-[92%] items-center justify-center rounded-[10px] border-2 border-[var(--paper-frame)] px-8"
        style={{ boxShadow: 'inset 0 0 0 3px var(--paper), inset 0 0 0 4px var(--paper-frame)' }}
      >
        <span className="absolute start-3 text-[0.75rem] text-[var(--paper-accent)] opacity-80" style={{ fontFamily: 'var(--font-ui)' }}>
          {s.ayat}
        </span>
        <span className="font-display text-[1.35rem] text-[var(--paper-ink)]">سورة {s.ar}</span>
        <span className="absolute end-3 text-[0.75rem] text-[var(--paper-accent)] opacity-80" style={{ fontFamily: 'var(--font-ui)' }}>
          {s.n}
        </span>
      </div>
    </div>
  );
}

/** U+FDFD ARABIC LIGATURE BISMILLAH — one standard Unicode character, set in Amiri (shaped: Amiri builds it from
 *  offset parts that the Linux webview would misplace). */
function Basmala({ fontSize }: { fontSize: number }) {
  return (
    <div className="mx-auto mb-2 w-[78%] text-[var(--paper-ink)]" aria-hidden>
      <ShapedText font="amiri" text={'\uFDFD'} size={fontSize * 2.1} lineHeight={1.1} align="center" fit fallbackClassName="font-dhikr" />
    </div>
  );
}

type Block = { kind: 'header'; surah: number } | { kind: 'text'; rows: AyahRow[] };

const ayahKey = (a: { 0: number; 1: number }) => `${a[0]}:${a[1]}`;

/** One run of ayat between surah headers, justified like a printed page; each ayah is a clickable segment. */
function AyatBlock({ riwaya, rows, fontSize, selected, onSelect }: { riwaya: Riwaya; rows: AyahRow[]; fontSize: number; selected: Sel | null; onSelect: (s: Sel) => void }) {
  const segments = useMemo<ShapedSegment[]>(() => rows.map((a) => ({ key: ayahKey(a), text: a[4] })), [rows]);
  const warshScript = useS((s) => s.quran.warshScript);
  const onClick = useCallback((key: string) => {
    const [surah, ayah] = key.split(':').map(Number);
    onSelect({ surah: surah!, ayah: ayah! });
  }, [onSelect]);
  return (
    <ShapedText
      font={quranFont(riwaya, warshScript)}
      segments={segments}
      size={fontSize}
      lineHeight={2.05}
      justify
      lastAlign="center"
      wordSpacing={0.04}
      selected={selected ? ayahKey([selected.surah, selected.ayah]) : null}
      onSegmentClick={onClick}
      fallbackClassName={riwaya === 'hafs' ? 'mushaf-hafs' : 'mushaf-warsh'}
    />
  );
}

function MushafPage({ data, page, paper, fontSize, selected, onSelect, bookmarks }: { data: QuranData; page: number; paper: string; fontSize: number; selected: Sel | null; onSelect: (s: Sel) => void; bookmarks: QuranBookmark[] }) {
  const f = useFmt();
  const blocks = useMemo(() => {
    const out: Block[] = [];
    for (const a of ayatOfPage(data, page)) {
      if (a[1] === 1) out.push({ kind: 'header', surah: a[0] });
      const last = out[out.length - 1];
      if (last && last.kind === 'text') last.rows.push(a);
      else out.push({ kind: 'text', rows: [a] });
    }
    return out;
  }, [data, page]);
  const first = ayatOfPage(data, page)[0];
  const ribbons = bookmarks.filter((b) => b.riwaya === data.riwaya && b.page === page);
  return (
    <article data-paper={paper} className="mushaf-page relative flex min-w-0 max-w-[640px] flex-1 basis-0 flex-col rounded-[14px] bg-[var(--paper)] px-7 pt-5 pb-4 shadow-md" aria-label={f.t('quran.pageN', { n: page })}>
      <div className="pointer-events-none absolute inset-2 rounded-[10px] border border-[var(--paper-frame)] opacity-70" />
      <div className="pointer-events-none absolute inset-3 rounded-[8px] border border-[var(--paper-frame)] opacity-40" />
      {ribbons.map((b, i) => (
        <span key={b.slot} className="absolute -top-1 h-9 w-3 rounded-b-[3px] shadow-sm" style={{ insetInlineEnd: 28 + i * 16, background: b.color }} title={b.name} />
      ))}
      <header className="relative mb-2 flex items-center justify-between px-2 text-[0.8125rem] text-[var(--paper-accent)]" dir="rtl">
        <span className="font-display">{first ? `سورة ${data.surahs[first[0] - 1]!.ar}` : ''}</span>
        <span>{first ? f.t('quran.juzN', { n: f.num(first[3]) }) : ''}</span>
      </header>
      <div className="relative flex-1 px-2 text-[var(--paper-ink)]" dir="rtl" lang="ar" style={{ fontSize }}>
        {blocks.map((b, i) =>
          b.kind === 'header' ? (
            <div key={`h${b.surah}`}>
              <SurahHeader data={data} surah={b.surah} />
              {b.surah !== 9 && !(data.riwaya === 'hafs' && b.surah === 1) ? <Basmala fontSize={fontSize} /> : null}
            </div>
          ) : (
            <AyatBlock key={`t${i}`} riwaya={data.riwaya} rows={b.rows} fontSize={fontSize} selected={selected} onSelect={onSelect} />
          ),
        )}
      </div>
      <footer className="relative mt-2 text-center text-[0.875rem] text-[var(--paper-accent)]">{f.num(page)}</footer>
    </article>
  );
}

function useWide(threshold = 1180) {
  const [wide, setWide] = useState(() => window.innerWidth >= threshold);
  useEffect(() => {
    const on = () => setWide(window.innerWidth >= threshold);
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, [threshold]);
  return wide;
}

export default function Quran() {
  const f = useFmt();
  const { t } = f;
  const params = useParams();
  const settings = useS((s) => s.quran);
  const allSettings = useSettings((s) => s.s);
  const update = useSettings((s) => s.update);
  const [riwaya, setRiwaya] = useState<Riwaya>(settings.riwaya);
  const { data, error } = useQuran(riwaya);
  const [page, setPage] = useState<number | null>(null);
  const [selected, setSelected] = useState<Sel | null>(null);
  const [tab, setTab] = useState<'surahs' | 'juz' | 'bookmarks'>('surahs');
  const [query, setQuery] = useState('');
  const [focus, setFocus] = useState(false);
  const [bookmarks, setBookmarks] = useState<QuranBookmark[]>([]);
  const [saving, setSaving] = useState<{ slot: number; name: string } | null>(null);
  const [replacing, setReplacing] = useState(false);
  const wide = useWide();
  const spread = settings.layout === 'spread' || (settings.layout === 'auto' && wide);
  const appPaper = allSettings.appearance.quranPaper === 'auto' ? 'parchment' : allSettings.appearance.quranPaper;
  const paper = settings.theme === 'auto' ? (resolvedTheme(allSettings) === 'dark' ? 'dark' : appPaper) : settings.theme;
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const reloadBookmarks = useCallback(() => {
    void db.quran.bookmarks().then(setBookmarks);
  }, []);
  useEffect(reloadBookmarks, [reloadBookmarks]);

  // initial position: /quran/surah/18 → last read → page 1
  useEffect(() => {
    if (!data || page !== null) return;
    let alive = true;
    const surahParam = params['*']?.match(/^surah\/(\d+)/)?.[1];
    const start = surahParam ? Promise.resolve(data.surahs[Number(surahParam) - 1]?.page ?? 1) : db.quran.lastRead(riwaya).then((p) => p?.page ?? 1);
    void start.then((p) => alive && setPage(p));
    return () => {
      alive = false;
    };
  }, [data, page, params, riwaya]);

  // last-read auto-save (debounced 1 s, one position per riwaya)
  useEffect(() => {
    if (!data || page === null) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      const first = ayatOfPage(data, page)[0];
      if (first) void db.quran.setLastRead({ riwaya, page, surah: first[0], ayah: first[1], scroll: 0, updatedAt: Date.now() });
    }, 1000);
  }, [data, page, riwaya]);

  const go = useCallback(
    (p: number) => {
      if (!data) return;
      const clamped = Math.min(data.pages, Math.max(1, p));
      setPage(spread ? (clamped % 2 === 0 ? clamped - 1 : clamped) : clamped);
      setSelected(null);
    },
    [data, spread],
  );
  const step = spread ? 2 : 1;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!data || page === null || (e.target as HTMLElement)?.tagName === 'INPUT') return;
      const leftIsNext = settings.arrowNextIsLeft;
      if (e.key === 'ArrowLeft') go(page + (leftIsNext ? step : -step));
      else if (e.key === 'ArrowRight') go(page + (leftIsNext ? -step : step));
      else if (e.key === 'PageDown') go(page + step);
      else if (e.key === 'PageUp') go(page - step);
      else if (e.key === 'Escape' && focus) setFocus(false);
      else if (e.key === 'Home' || e.key === 'End') {
        const first = ayatOfPage(data, page)[0];
        if (!first) return;
        const s = data.surahs[first[0] - 1]!;
        go(e.key === 'Home' ? s.page : pageOf(data, s.n, s.ayat));
      } else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [data, page, step, go, settings.arrowNextIsLeft, focus]);

  const hits = useMemo(() => (data && query.trim().length >= 2 ? searchQuran(data, query) : []), [data, query]);

  if (error) return <p className="p-8 text-danger">{error}</p>;
  if (!data || page === null)
    return (
      <div className="flex h-full items-center justify-center gap-6 p-10">
        <Skeleton className="h-[70vh] w-[420px]" />
        {wide ? <Skeleton className="h-[70vh] w-[420px]" /> : null}
      </div>
    );

  const firstOnPage = ayatOfPage(data, page)[0]!;
  const target: Sel = selected ?? { surah: firstOnPage[0], ayah: firstOnPage[1] };

  const switchRiwaya = async (to: Riwaya) => {
    if (to === riwaya) return;
    const next = await loadQuran(to);
    const mapped = mapPosition(next, firstOnPage[0], page);
    setRiwaya(to);
    setPage(mapped.page);
    setSelected(null);
    if (!mapped.exact) toast(t('quran.mappedStart'), 'info');
  };

  const saveBookmark = () => {
    const used = new Set(bookmarks.map((b) => b.slot));
    const free = [1, 2, 3, 4, 5].find((s) => !used.has(s));
    const name = `${data.surahs[target.surah - 1]!.ar} ${f.num(target.ayah)}`;
    if (free) setSaving({ slot: free, name });
    else setReplacing(true);
  };
  const commitBookmark = async (slot: number, name: string) => {
    await db.quran.setBookmark({ slot, name, color: RIBBONS[slot - 1]!, riwaya, page: pageOf(data, target.surah, target.ayah), surah: target.surah, ayah: target.ayah, createdAt: Date.now() });
    reloadBookmarks();
    setSaving(null);
    toast(t('common.saved'), 'success');
  };

  const pages = spread ? [page, page + 1].filter((p) => p <= data.pages) : [page];
  // the Uthmani fonts are small for their size, and their dots are tiny: a little larger than ordinary text
  const fontSize = (spread ? 25 : 29) * settings.fontScale;
  const selRow = selected ? data.ayat.find((a) => a[0] === selected.surah && a[1] === selected.ayah) : null;
  const nextLabel = settings.arrowNextIsLeft ? t('quran.nextPage') : t('quran.prevPage');
  const prevLabel = settings.arrowNextIsLeft ? t('quran.prevPage') : t('quran.nextPage');

  const reader = (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-line-soft px-5 py-2.5">
        <Segmented
          size="sm"
          label={t('settings.quran.riwaya')}
          value={riwaya}
          onChange={(v) => void switchRiwaya(v)}
          options={[
            { value: 'hafs', label: t('settings.quran.hafs') },
            { value: 'warsh', label: t('settings.quran.warsh') },
          ]}
        />
        <label className="ms-2 flex items-center gap-2 text-[0.875rem] text-ink-muted">
          {t('quran.page')}
          <input
            key={page}
            defaultValue={page}
            inputMode="numeric"
            aria-label={t('quran.goToPage')}
            onKeyDown={(e) => {
              if (e.key === 'Enter') go(Number((e.target as HTMLInputElement).value) || page);
            }}
            className="tabular h-8 w-16 rounded-[8px] border border-line bg-surface-raised px-2 text-center text-ink outline-none focus:border-sage"
          />
          <span>/ {f.num(data.pages)}</span>
        </label>
        <span className="flex-1" />
        <IconButton size="sm" label={t('adhkar.smaller')} onClick={() => update((d) => void (d.quran.fontScale = Math.max(0.7, +(d.quran.fontScale - 0.1).toFixed(2))))}>
          <span className="text-[0.8125rem] font-semibold">A−</span>
        </IconButton>
        <IconButton size="sm" label={t('adhkar.larger')} onClick={() => update((d) => void (d.quran.fontScale = Math.min(1.8, +(d.quran.fontScale + 0.1).toFixed(2))))}>
          <span className="text-[0.9375rem] font-semibold">A+</span>
        </IconButton>
        <IconButton size="sm" label={spread ? t('quran.single') : t('quran.spread')} onClick={() => update((d) => void (d.quran.layout = spread ? 'single' : 'spread'))}>
          {spread ? <IconSinglePage size={18} /> : <IconSpread size={18} />}
        </IconButton>
        <IconButton size="sm" label={t('quran.saveBookmark')} onClick={saveBookmark}>
          <IconBookmark size={18} />
        </IconButton>
        <IconButton size="sm" label={focus ? t('quran.exitFocus') : t('quran.focus')} onClick={() => setFocus((x) => !x)}>
          {focus ? <IconClose size={18} /> : <IconFocus size={18} />}
        </IconButton>
      </div>
      <div className="flex min-h-0 flex-1 items-start gap-2 overflow-y-auto px-3 py-6" dir="ltr">
        <IconButton label={nextLabel} size="lg" className="sticky top-1/2 shrink-0" onClick={() => go(page + (settings.arrowNextIsLeft ? step : -step))}>
          <IconChevronLeft size={24} />
        </IconButton>
        {/* right page first, as in a printed mushaf */}
        <div className="flex min-w-0 flex-1 flex-row-reverse items-stretch justify-center gap-5" dir="ltr">
          {pages.map((p) => (
            <MushafPage key={`${riwaya}-${p}`} data={data} page={p} paper={paper} fontSize={fontSize} selected={selected} onSelect={setSelected} bookmarks={bookmarks} />
          ))}
        </div>
        <IconButton label={prevLabel} size="lg" className="sticky top-1/2 shrink-0" onClick={() => go(page + (settings.arrowNextIsLeft ? -step : step))}>
          <IconChevronRight size={24} />
        </IconButton>
      </div>
      {selRow ? (
        <div className="flex items-center gap-3 border-t border-line-soft bg-surface px-5 py-2.5">
          <span className="text-[0.9375rem] text-ink">{t('quran.ayahRef', { surah: data.surahs[selRow[0] - 1]!.ar, ayah: f.num(selRow[1]) })}</span>
          <span className="flex-1" />
          <Button size="sm" variant="ghost" icon={<IconBookmark size={16} />} onClick={saveBookmark}>
            {t('quran.saveBookmark')}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => void navigator.clipboard.writeText(selRow[4]).then(() => toast(t('common.copied'), 'success'))}>
            {t('quran.copy')}
          </Button>
          <IconButton size="sm" label={t('common.close')} onClick={() => setSelected(null)}>
            <IconClose size={16} />
          </IconButton>
        </div>
      ) : null}
    </div>
  );

  const mushafFont = riwaya === 'hafs' ? 'mushaf-hafs' : 'mushaf-warsh';

  return (
    <div className="flex h-full min-h-0">
      {!focus ? (
        <aside className="flex w-72 shrink-0 flex-col border-e border-line-soft bg-bg">
          <div className="p-3">
            <TextInput value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('quran.searchPlaceholder')} aria-label={t('quran.search')} leading={<IconSearch size={17} className="text-ink-faint" />} dir="rtl" />
          </div>
          {query.trim().length >= 2 ? (
            <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
              <p className="px-2 pb-2 text-[0.8125rem] text-ink-muted">{hits.length ? t('quran.results', { count: hits.length }) : t('quran.noResults')}</p>
              {hits.map((h) => (
                <button
                  key={`${h.surah}:${h.ayah}`}
                  type="button"
                  onClick={() => {
                    go(h.page);
                    setSelected({ surah: h.surah, ayah: h.ayah });
                  }}
                  className="mb-1 w-full rounded-[10px] px-3 py-2 text-start hover:bg-[color-mix(in_oklab,var(--ink)_5%,transparent)]"
                >
                  <span className="block text-[0.8125rem] text-sage-strong">{t('quran.ayahRef', { surah: data.surahs[h.surah - 1]!.ar, ayah: f.num(h.ayah) })}</span>
                  <ShapedText font={quranFont(riwaya, settings.warshScript)} text={h.text} size={17} lineHeight={2} maxLines={2} lazy className="text-ink" fallbackClassName={clsx('line-clamp-2', mushafFont)} />
                </button>
              ))}
            </div>
          ) : (
            <>
              <Tabs
                className="px-3"
                label={t('quran.index')}
                value={tab}
                onChange={setTab}
                items={[
                  { value: 'surahs', label: t('quran.surahs') },
                  { value: 'juz', label: t('quran.juz') },
                  { value: 'bookmarks', label: t('quran.bookmarks'), count: bookmarks.length },
                ]}
              />
              <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
                {tab === 'surahs'
                  ? data.surahs.map((s) => (
                      <button
                        key={s.n}
                        type="button"
                        onClick={() => go(s.page)}
                        className={clsx('flex w-full items-center gap-3 rounded-[10px] px-3 py-2 text-start', firstOnPage[0] === s.n ? 'bg-sage-soft' : 'hover:bg-[color-mix(in_oklab,var(--ink)_5%,transparent)]')}
                      >
                        <span className="tabular flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-sunk text-[0.8125rem] text-ink-muted">{f.num(s.n)}</span>
                        <span className="min-w-0 flex-1">
                          <span className="font-display block text-[1.0625rem] text-ink">{s.ar}</span>
                          <span className="block truncate text-[0.75rem] text-ink-muted">
                            {f.lang === 'en' ? `${s.en} — ` : ''}
                            {t(`quran.${s.type}`)} — {t('quran.ayatCount', { count: s.ayat })}
                          </span>
                        </span>
                        <span className="tabular text-[0.75rem] text-ink-faint">{f.num(s.page)}</span>
                      </button>
                    ))
                  : tab === 'juz'
                    ? data.juzStart.slice(1).map((p, i) => (
                        <button key={i} type="button" onClick={() => go(p)} className="flex w-full items-center justify-between rounded-[10px] px-3 py-2.5 text-start hover:bg-[color-mix(in_oklab,var(--ink)_5%,transparent)]">
                          <span className="text-ink">{t('quran.juzN', { n: f.num(i + 1) })}</span>
                          <span className="tabular text-[0.8125rem] text-ink-faint">{t('quran.pageN', { n: f.num(p) })}</span>
                        </button>
                      ))
                    : [1, 2, 3, 4, 5].map((slot) => {
                        const b = bookmarks.find((x) => x.slot === slot);
                        return (
                          <div key={slot} className="flex items-center gap-3 rounded-[10px] px-3 py-2">
                            <span className="h-7 w-2.5 rounded-b-[3px]" style={{ background: RIBBONS[slot - 1], opacity: b ? 1 : 0.3 }} />
                            {b ? (
                              <button
                                type="button"
                                className="min-w-0 flex-1 text-start"
                                onClick={() => {
                                  if (b.riwaya !== riwaya) setRiwaya(b.riwaya);
                                  setPage(b.page);
                                  setSelected({ surah: b.surah, ayah: b.ayah });
                                }}
                              >
                                <span className="block truncate font-medium text-ink">{b.name}</span>
                                <span className="block text-[0.75rem] text-ink-muted">
                                  {t(`settings.quran.${b.riwaya}`)} — {t('quran.pageN', { n: f.num(b.page) })}
                                </span>
                              </button>
                            ) : (
                              <span className="flex-1 text-[0.875rem] text-ink-faint">{t('quran.emptySlot')}</span>
                            )}
                          </div>
                        );
                      })}
              </div>
            </>
          )}
          <p className="border-t border-line-soft px-4 py-2 text-[0.6875rem] leading-snug text-ink-faint">{t('quran.source')}</p>
        </aside>
      ) : null}
      {focus ? <div className="fixed inset-0 z-40 flex bg-bg">{reader}</div> : reader}

      <Dialog
        open={saving !== null}
        onClose={() => setSaving(null)}
        title={t('quran.saveBookmark')}
        size="sm"
        closeLabel={t('common.close')}
        footer={
          <Button variant="primary" onClick={() => saving && void commitBookmark(saving.slot, saving.name.trim() || '—')}>
            {t('common.save')}
          </Button>
        }
      >
        <TextInput
          autoFocus
          label={t('quran.bookmarkName')}
          value={saving?.name ?? ''}
          onChange={(e) => setSaving((s) => (s ? { ...s, name: e.target.value } : s))}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && saving) void commitBookmark(saving.slot, saving.name.trim() || '—');
          }}
        />
      </Dialog>
      <Dialog open={replacing} onClose={() => setReplacing(false)} title={t('quran.replaceBookmark')} size="sm" closeLabel={t('common.close')}>
        <div className="flex flex-col gap-1 pb-2">
          {bookmarks.map((b) => (
            <button
              key={b.slot}
              type="button"
              onClick={() => {
                setReplacing(false);
                setSaving({ slot: b.slot, name: `${data.surahs[target.surah - 1]!.ar} ${f.num(target.ayah)}` });
              }}
              className="flex items-center gap-3 rounded-[10px] px-3 py-2 text-start hover:bg-surface-sunk"
            >
              <span className="h-6 w-2.5 rounded-b-[3px]" style={{ background: b.color }} />
              <span className="flex-1 text-ink">{b.name}</span>
            </button>
          ))}
        </div>
      </Dialog>
    </div>
  );
}
