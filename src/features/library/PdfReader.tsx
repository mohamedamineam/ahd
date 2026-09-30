import { useEffect, useRef, useState } from 'react';
import * as pdfjs from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { useFmt } from '@/lib/useFmt';
import { db, type LibraryBookmark } from '@/lib/db';
import { Button, IconButton, Spinner } from '@/design/components';
import { IconBookmark, IconChevronLeft, IconChevronRight, IconTrash, IconZoomIn, IconZoomOut } from '@/design/icons';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

/** Decoders for scanned pages (JBIG2, JPEG 2000) and CMYK profiles; the build copies them to /pdfjs/ (vite.config.ts). */
const PDFJS_ASSETS = new URL('/pdfjs/', window.location.href).href;
/** Upper bound for the page bitmap (16 MP): a large zoom on a HiDPI screen would otherwise exhaust canvas memory. */
const MAX_CANVAS_PIXELS = 4096 * 4096;

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
  /** Width available to the page (CSS px): the page is fitted to it, and refitted when the window is resized. */
  const [width, setWidth] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [marks, setMarks] = useState<LibraryBookmark[]>([]);

  useEffect(() => {
    const el = container.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => entry && setWidth(Math.floor(entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;
    const task = pdfjs.getDocument({ url: src, wasmUrl: `${PDFJS_ASSETS}wasm/`, iccUrl: `${PDFJS_ASSETS}iccs/` });
    task.promise.then(
      (d) => !cancelled && setLoaded({ src, doc: d }),
      // destroy() below rejects this promise ("Loading aborted"): not an error to show
      (e) => !cancelled && setError(String(e)),
    );
    void db.library.bookmarks(bookId).then(setMarks);
    return () => {
      cancelled = true;
      void task.destroy();
    };
  }, [src, bookId]);

  useEffect(() => {
    if (!doc || !width || !canvas.current) return;
    let cancelled = false;
    let renderTask: pdfjs.RenderTask | null = null;
    void doc.getPage(Math.min(page, doc.numPages)).then((p) => {
      if (cancelled || !canvas.current) return;
      const base = p.getViewport({ scale: 1 });
      // CSS px per PDF unit: fit the page to the width, then zoom
      const css = (width / base.width) * zoom;
      const scale = Math.min(css * window.devicePixelRatio, Math.sqrt(MAX_CANVAS_PIXELS / (base.width * base.height)));
      const viewport = p.getViewport({ scale });
      const c = canvas.current;
      c.width = Math.floor(viewport.width);
      c.height = Math.floor(viewport.height);
      // both axes are set, so the page keeps its proportions whatever the layout around it does
      c.style.width = `${base.width * css}px`;
      c.style.height = `${base.height * css}px`;
      renderTask = p.render({ canvas: c, viewport });
      renderTask.promise.catch(() => {}); // cancelled when the page, zoom or width changes
    });
    onPage(page);
    return () => {
      cancelled = true;
      renderTask?.cancel();
    };
  }, [doc, page, zoom, width, onPage]);

  // a new page starts at its top
  useEffect(() => {
    container.current?.scrollTo({ top: 0 });
  }, [page]);

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
        {/* block layout: a canvas in a flex row is stretched to the row height, which squashed the page */}
        <div ref={container} className="min-w-0 flex-1 overflow-auto bg-surface-sunk p-6 [scrollbar-gutter:stable]">
          {doc ? (
            <canvas ref={canvas} className="mx-auto block shadow-md" />
          ) : (
            <div className="flex justify-center">
              <Spinner size={28} className="mt-20 text-sage" />
            </div>
          )}
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
