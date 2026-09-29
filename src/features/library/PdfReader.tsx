import { useEffect, useRef, useState } from 'react';
import * as pdfjs from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { useFmt } from '@/lib/useFmt';
import { db, type LibraryBookmark } from '@/lib/db';
import { Button, IconButton, Spinner } from '@/design/components';
import { IconBookmark, IconChevronLeft, IconChevronRight, IconTrash, IconZoomIn, IconZoomOut } from '@/design/icons';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

/** pdf.js viewer: one page at a time, zoom, RTL page order (Arabic books), last page, up to 10 bookmarks. */
export function PdfReader({ bookId, src, initialPage, onPage }: { bookId: string; src: string; initialPage: number; onPage: (p: number) => void }) {
  const f = useFmt();
  const { t } = f;
  const canvas = useRef<HTMLCanvasElement>(null);
  const container = useRef<HTMLDivElement>(null);
  const [loaded, setLoaded] = useState<{ src: string; doc: pdfjs.PDFDocumentProxy } | null>(null);
  const doc = loaded?.src === src ? loaded.doc : null;
  const [page, setPage] = useState(initialPage);
  const [zoom, setZoom] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [marks, setMarks] = useState<LibraryBookmark[]>([]);

  useEffect(() => {
    const task = pdfjs.getDocument({ url: src });
    task.promise.then((d) => setLoaded({ src, doc: d })).catch((e) => setError(String(e)));
    void db.library.bookmarks(bookId).then(setMarks);
    return () => {
      void task.destroy();
    };
  }, [src, bookId]);

  useEffect(() => {
    if (!doc || !canvas.current || !container.current) return;
    let cancelled = false;
    let renderTask: pdfjs.RenderTask | null = null;
    void doc.getPage(Math.min(page, doc.numPages)).then((p) => {
      if (cancelled || !canvas.current || !container.current) return;
      const base = p.getViewport({ scale: 1 });
      const fit = (container.current.clientWidth - 48) / base.width;
      const viewport = p.getViewport({ scale: fit * zoom * window.devicePixelRatio });
      const c = canvas.current;
      c.width = viewport.width;
      c.height = viewport.height;
      c.style.width = `${viewport.width / window.devicePixelRatio}px`;
      renderTask = p.render({ canvas: c, viewport });
    });
    onPage(page);
    return () => {
      cancelled = true;
      renderTask?.cancel();
    };
  }, [doc, page, zoom, onPage]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!doc) return;
      // Arabic books: the next page is to the left
      if (e.key === 'ArrowLeft' || e.key === 'PageDown') setPage((p) => Math.min(doc.numPages, p + 1));
      if (e.key === 'ArrowRight' || e.key === 'PageUp') setPage((p) => Math.max(1, p - 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [doc]);

  if (error) return <p className="p-8 text-danger">{error}</p>;
  const marked = marks.some((m) => m.page === page);
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-2 border-b border-line-soft px-4 py-2" dir="ltr">
        <IconButton size="sm" label={t('quran.nextPage')} onClick={() => doc && setPage((p) => Math.min(doc.numPages, p + 1))}>
          <IconChevronLeft size={18} />
        </IconButton>
        <span className="tabular min-w-[6rem] text-center text-[0.875rem] text-ink-muted">
          {f.num(page)} / {f.num(doc?.numPages ?? 0)}
        </span>
        <IconButton size="sm" label={t('quran.prevPage')} onClick={() => setPage((p) => Math.max(1, p - 1))}>
          <IconChevronRight size={18} />
        </IconButton>
        <span className="flex-1" />
        <IconButton size="sm" label="−" onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.15).toFixed(2)))}>
          <IconZoomOut size={18} />
        </IconButton>
        <IconButton size="sm" label="+" onClick={() => setZoom((z) => Math.min(3, +(z + 0.15).toFixed(2)))}>
          <IconZoomIn size={18} />
        </IconButton>
        <IconButton
          size="sm"
          label={t('quran.saveBookmark')}
          active={marked}
          onClick={async () => {
            if (marked) await db.library.removeBookmark(bookId, page);
            else await db.library.addBookmark({ bookId, page, note: '', createdAt: Date.now() });
            setMarks(await db.library.bookmarks(bookId));
          }}
        >
          <IconBookmark size={18} />
        </IconButton>
      </div>
      <div className="flex min-h-0 flex-1">
        <div ref={container} className="flex min-w-0 flex-1 justify-center overflow-auto bg-surface-sunk p-6">
          {doc ? <canvas ref={canvas} className="h-auto shadow-md" /> : <Spinner size={28} className="mt-20 text-sage" />}
        </div>
        {marks.length ? (
          <aside className="w-44 shrink-0 border-s border-line-soft p-2">
            <p className="px-2 pb-1 text-[0.8125rem] text-ink-muted">{t('quran.bookmarks')}</p>
            {marks.map((m) => (
              <div key={m.page} className="flex items-center gap-1">
                <Button size="sm" variant="ghost" className="flex-1 justify-start" onClick={() => setPage(m.page)}>
                  {t('quran.pageN', { n: f.num(m.page) })}
                </Button>
                <IconButton size="sm" label={t('common.delete')} onClick={async () => setMarks((await db.library.removeBookmark(bookId, m.page), await db.library.bookmarks(bookId)))}>
                  <IconTrash size={14} />
                </IconButton>
              </div>
            ))}
          </aside>
        ) : null}
      </div>
    </div>
  );
}
