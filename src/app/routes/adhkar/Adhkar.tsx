import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Route, Routes, useNavigate, useParams } from 'react-router';
import clsx from 'clsx';
import { useFmt } from '@/lib/useFmt';
import { useS, useSettings } from '@/features/settings/store';
import { usePrayer } from '@/features/prayer/store';
import { useNowMinute } from '@/lib/clock';
import { db } from '@/lib/db';
import { itemsOf, keepDates, sessionKey, useAdhkar, type AdhkarData, type Dhikr } from '@/features/adhkar/data';
import { localDate } from '@/features/prayer/engine';
import { Button, Checkbox, CounterButton, EmptyState, IconButton, Skeleton } from '@/design/components';
import { IconChevronEnd, IconChevronStart, IconClose, IconFocus, IconReset, IconSettings } from '@/design/icons';

const FEATURED = ['morning', 'evening'] as const;

function useSession(categoryId: string) {
  const engine = usePrayer((s) => s.engine);
  const now = useNowMinute();
  const key = sessionKey(categoryId, engine, now);
  const [counts, setCounts] = useState<Record<string, number>>({});
  useEffect(() => {
    let alive = true;
    void db.adhkar.progress(key).then((c) => alive && setCounts(c));
    return () => {
      alive = false;
    };
  }, [key]);
  const done = useCallback((d: Dhikr) => Math.min(d.count, counts[d.id] ?? 0), [counts]);
  const count = useCallback(
    (d: Dhikr) => {
      setCounts((c) => {
        const n = Math.min(d.count, (c[d.id] ?? 0) + 1);
        void db.adhkar.setCount(key, d.id, n, keepDates(engine, Date.now()));
        return { ...c, [d.id]: n };
      });
    },
    [key, engine],
  );
  const reset = useCallback(() => {
    setCounts({});
    void db.adhkar.reset(key);
  }, [key]);
  return { done, count, reset };
}

function CategoryCard({ data, id, featured, current }: { data: AdhkarData; id: string; featured?: boolean; current?: boolean }) {
  const { t } = useFmt();
  const navigate = useNavigate();
  const items = itemsOf(data, id).flatMap((g) => g.items);
  const { done } = useSession(id);
  const completed = items.filter((d) => done(d) >= d.count).length;
  const pct = items.length ? completed / items.length : 0;
  return (
    <button
      type="button"
      onClick={() => navigate(`/adhkar/${id}`)}
      className={clsx(
        'group relative flex flex-col items-start overflow-hidden rounded-panel border text-start transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md',
        featured ? 'min-h-[9.5rem] p-6' : 'p-4',
        current ? 'border-sage bg-sage-soft' : 'border-line-soft bg-surface',
      )}
    >
      {current ? <span className="mb-2 rounded-full bg-sage-strong px-2.5 py-0.5 text-[0.75rem] font-medium text-on-sage">{t('adhkar.now')}</span> : null}
      <span className={clsx('font-display text-ink', featured ? 'text-[1.75rem]' : 'text-[1.125rem] leading-snug')}>{t(`adhkar.categories.${id}`)}</span>
      <span className="mt-1 text-[0.8125rem] text-ink-muted">{t('adhkar.items', { count: items.length })}</span>
      {featured || completed ? (
        <span className="mt-auto flex w-full items-center gap-3 pt-4">
          <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-line-soft">
            <span className="block h-full rounded-full bg-sage-strong transition-[width] duration-500" style={{ width: `${pct * 100}%` }} />
          </span>
          <span className="tabular text-[0.8125rem] text-ink-muted">{t('adhkar.progress', { done: completed, total: items.length })}</span>
        </span>
      ) : null}
    </button>
  );
}

function Index({ data }: { data: AdhkarData }) {
  const { t } = useFmt();
  const navigate = useNavigate();
  const notifications = useS((s) => s.adhkar.notifications);
  const update = useSettings((s) => s.update);
  const engine = usePrayer((s) => s.engine);
  const now = useNowMinute();
  const current = useMemo(() => {
    if (!engine) return null;
    const day = engine.day(localDate(now, engine.zone));
    if (now >= day.times.fajr && now < day.times.asr) return 'morning';
    if (now >= day.times.asr) return 'evening';
    return null;
  }, [engine, now]);
  const others = data.categories.map((c) => c.id).filter((id) => !(FEATURED as readonly string[]).includes(id));
  return (
    <div className="mx-auto max-w-[1080px] px-6 pt-5 pb-10">
      <header className="mb-5 flex flex-wrap items-center gap-4">
        <h1 className="font-display flex-1 text-[1.75rem] text-ink">{t('adhkar.title')}</h1>
        <Checkbox checked={notifications} onChange={(v) => update((d) => void (d.adhkar.notifications = v))} label={<span className="font-medium">{t('adhkar.notifications')}</span>} />
        <Button size="sm" variant="secondary" icon={<IconSettings size={16} />} onClick={() => navigate('/settings/adhkar')}>
          {t('adhkar.schedule')}
        </Button>
      </header>
      <div className="grid grid-cols-2 gap-4">
        {FEATURED.map((id) => (
          <CategoryCard key={id} data={data} id={id} featured current={current === id} />
        ))}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
        {others.map((id) => (
          <CategoryCard key={id} data={data} id={id} />
        ))}
      </div>
      <p className="mt-8 text-center text-[0.8125rem] text-ink-faint">{t('adhkar.source')}</p>
    </div>
  );
}

function DhikrCard({ d, done, onCount, fontScale, animate, innerRef }: { d: Dhikr; done: number; onCount: () => void; fontScale: number; animate: boolean; innerRef?: (el: HTMLElement | null) => void }) {
  const f = useFmt();
  const remaining = d.count - done;
  const complete = remaining <= 0;
  return (
    <article
      ref={innerRef}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          if (!complete) onCount();
        }
      }}
      className={clsx('flex gap-5 rounded-panel border p-6 transition-colors', complete ? 'border-sage/50 bg-sage-soft/50' : 'border-line-soft bg-surface')}
    >
      <div className="min-w-0 flex-1">
        <p lang="ar" dir="rtl" className="selectable font-dhikr text-ink" style={{ fontSize: `${1.5 * fontScale}rem`, lineHeight: 2.05 }}>
          {d.text}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[0.8125rem] text-ink-muted">
          {d.reference ? (
            <span lang="ar" dir="rtl" className="selectable">
              {d.reference}
            </span>
          ) : null}
          <span className="rounded-full bg-surface-sunk px-2 py-0.5">{f.t('adhkar.times', { count: d.count })}</span>
        </div>
      </div>
      <div className="flex flex-col items-center justify-center">
        <CounterButton remaining={remaining} total={d.count} onCount={onCount} label={f.t('adhkar.count')} doneLabel={f.t('adhkar.done')} animate={animate} />
      </div>
    </article>
  );
}

function FocusMode({ items, index, setIndex, done, onCount, fontScale, onClose }: { items: Dhikr[]; index: number; setIndex: (i: number) => void; done: (d: Dhikr) => number; onCount: (d: Dhikr, i: number) => void; fontScale: number; onClose: () => void }) {
  const f = useFmt();
  const d = items[index]!;
  const remaining = d.count - done(d);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === ' ') {
        e.preventDefault();
        if (remaining > 0) onCount(d, index);
        else if (index < items.length - 1) setIndex(index + 1);
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        const forward = (e.key === 'ArrowLeft') === (f.dir === 'rtl');
        setIndex(Math.min(items.length - 1, Math.max(0, index + (forward ? 1 : -1))));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [d, index, items.length, onClose, onCount, remaining, setIndex, f.dir]);
  return (
    <div className="khatam fixed inset-0 z-50 flex flex-col bg-bg" role="dialog" aria-modal="true">
      <div className="flex items-center gap-3 px-6 py-4">
        <span className="tabular text-ink-muted">{f.t('adhkar.progress', { done: index + 1, total: items.length })}</span>
        <span className="flex-1" />
        <IconButton label={f.t('common.close')} onClick={onClose}>
          <IconClose size={20} />
        </IconButton>
      </div>
      <div className="flex min-h-0 flex-1 items-center justify-center overflow-y-auto px-10">
        <p key={d.id} lang="ar" dir="rtl" className="animate-fade-in selectable max-w-3xl text-center font-dhikr text-ink" style={{ fontSize: `${2 * fontScale}rem`, lineHeight: 2.1 }}>
          {d.text}
        </p>
      </div>
      <p lang="ar" dir="rtl" className="px-10 pb-4 text-center text-[0.875rem] text-ink-muted">
        {d.reference}
      </p>
      <div className="flex items-center justify-center gap-6 pb-10">
        <IconButton label={f.t('adhkar.previous')} size="lg" variant="secondary" disabled={index === 0} onClick={() => setIndex(index - 1)}>
          <IconChevronStart size={22} />
        </IconButton>
        <CounterButton remaining={remaining} total={d.count} onCount={() => onCount(d, index)} label={f.t('adhkar.count')} doneLabel={f.t('adhkar.done')} />
        <IconButton label={f.t('adhkar.next')} size="lg" variant="secondary" disabled={index === items.length - 1} onClick={() => setIndex(index + 1)}>
          <IconChevronEnd size={22} />
        </IconButton>
      </div>
    </div>
  );
}

function Category({ data }: { data: AdhkarData }) {
  const { t } = useFmt();
  const navigate = useNavigate();
  const { category = '' } = useParams();
  const settings = useS((s) => s.adhkar);
  const update = useSettings((s) => s.update);
  const groups = itemsOf(data, category);
  const all = groups.flatMap((g) => g.items);
  const { done, count, reset } = useSession(category);
  const [focus, setFocus] = useState<number | null>(null);
  const refs = useRef<Map<string, HTMLElement>>(new Map());
  const completed = all.filter((d) => done(d) >= d.count).length;

  if (!groups.length) return <EmptyState title={t('common.notAvailable')} />;

  const onCount = (d: Dhikr, index: number) => {
    const willComplete = done(d) + 1 >= d.count;
    count(d);
    if (willComplete && settings.autoAdvance) {
      const next = all[index + 1];
      if (next) setTimeout(() => refs.current.get(next.id)?.scrollIntoView({ block: 'center', behavior: 'smooth' }), 250);
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-6 pb-16">
      <div className="sticky top-0 z-10 -mx-6 mb-4 border-b border-line-soft bg-bg/95 px-6 py-3 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <IconButton label={t('common.back')} size="sm" onClick={() => navigate('/adhkar')}>
            <IconChevronStart size={18} />
          </IconButton>
          <h1 className="font-display flex-1 truncate text-[1.5rem] text-ink">{t(`adhkar.categories.${category}`)}</h1>
          <IconButton label={t('adhkar.smaller')} size="sm" onClick={() => update((d) => void (d.adhkar.fontScale = Math.max(0.8, +(d.adhkar.fontScale - 0.1).toFixed(2))))}>
            <span className="text-[0.8125rem] font-semibold">A−</span>
          </IconButton>
          <IconButton label={t('adhkar.larger')} size="sm" onClick={() => update((d) => void (d.adhkar.fontScale = Math.min(1.8, +(d.adhkar.fontScale + 0.1).toFixed(2))))}>
            <span className="text-[0.9375rem] font-semibold">A+</span>
          </IconButton>
          <IconButton label={t('adhkar.focus')} size="sm" onClick={() => setFocus(Math.max(0, all.findIndex((d) => done(d) < d.count)))}>
            <IconFocus size={18} />
          </IconButton>
          <IconButton label={t('adhkar.reset')} size="sm" onClick={reset}>
            <IconReset size={17} />
          </IconButton>
        </div>
        <div className="mt-2 flex items-center gap-3">
          <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-line-soft">
            <span className="block h-full rounded-full bg-sage-strong transition-[width] duration-500" style={{ width: `${(completed / all.length) * 100}%` }} />
          </span>
          <span className="tabular text-[0.8125rem] text-ink-muted">{t('adhkar.progress', { done: completed, total: all.length })}</span>
        </div>
      </div>

      {groups.map((g) => (
        <section key={g.chapter.index} className="mb-6">
          {groups.length > 1 ? (
            <h2 lang="ar" dir="rtl" className="mb-3 font-dhikr text-[1.125rem] text-ink-muted">
              {g.chapter.title}
            </h2>
          ) : null}
          <div className="flex flex-col gap-3">
            {g.items.map((d) => {
              const index = all.indexOf(d);
              return (
                <DhikrCard
                  key={d.id}
                  d={d}
                  done={done(d)}
                  onCount={() => onCount(d, index)}
                  fontScale={settings.fontScale}
                  animate={settings.counterAnimation}
                  innerRef={(el) => {
                    if (el) refs.current.set(d.id, el);
                  }}
                />
              );
            })}
          </div>
        </section>
      ))}
      {completed === all.length ? <p className="mt-6 text-center font-medium text-sage-strong">{t('adhkar.completed')}</p> : null}
      {focus !== null && all[focus] ? (
        <FocusMode items={all} index={focus} setIndex={setFocus} done={done} onCount={onCount} fontScale={settings.fontScale} onClose={() => setFocus(null)} />
      ) : null}
    </div>
  );
}

export default function Adhkar() {
  const data = useAdhkar();
  if (!data)
    return (
      <div className="mx-auto grid max-w-[1080px] grid-cols-2 gap-4 px-6 pt-20">
        <Skeleton className="h-36" />
        <Skeleton className="h-36" />
      </div>
    );
  return (
    <Routes>
      <Route index element={<Index data={data} />} />
      <Route path=":category" element={<Category data={data} />} />
    </Routes>
  );
}
