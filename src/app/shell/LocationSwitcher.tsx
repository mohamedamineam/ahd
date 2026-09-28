import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import clsx from 'clsx';
import { useFmt } from '@/lib/useFmt';
import { useS } from '@/features/settings/store';
import { useLocations } from '@/features/location/useLocations';
import { placeName, placeSubtitle } from '@/features/location/search';
import { LocationPicker } from '@/features/location/LocationPicker';
import { Dialog } from '@/design/components';
import { IconCheck, IconChevronDown, IconPin, IconPlus } from '@/design/icons';

export function LocationSwitcher() {
  const { t, lang } = useFmt();
  const current = useS((s) => s.location.current);
  const { saved, load, choose } = useLocations();
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const btn = useRef<HTMLButtonElement>(null);
  const pop = useRef<HTMLDivElement>(null);
  const [rect, setRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!pop.current?.contains(e.target as Node) && !btn.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('mousedown', close);
    window.addEventListener('keydown', esc);
    return () => {
      window.removeEventListener('mousedown', close);
      window.removeEventListener('keydown', esc);
    };
  }, [open]);

  return (
    <>
      <button
        ref={btn}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t('home.switchLocation')}
        onClick={() => {
          setRect(btn.current?.getBoundingClientRect() ?? null);
          setOpen((o) => !o);
        }}
        className="no-drag group inline-flex h-9 max-w-[18rem] items-center gap-2 rounded-full border border-line-soft bg-surface px-3 text-[0.9375rem] text-ink shadow-sm transition-colors hover:border-line"
      >
        <IconPin size={16} className="shrink-0 text-sage-strong" />
        <span className="truncate font-medium">{placeName(current, lang) || t('home.chooseLocation')}</span>
        <IconChevronDown size={15} className={clsx('shrink-0 text-ink-muted transition-transform', open && 'rotate-180')} />
      </button>
      {open && rect
        ? createPortal(
            <div
              ref={pop}
              role="menu"
              style={{ position: 'fixed', top: rect.bottom + 8, insetInlineStart: lang === 'ar' ? window.innerWidth - rect.right : rect.left }}
              className="animate-scale-in z-50 w-80 rounded-[14px] border border-line-soft bg-surface-raised p-1.5 shadow-lg"
            >
              <p className="px-3 pt-2 pb-1 text-[0.8125rem] text-ink-faint">{t('home.locations')}</p>
              <ul className="max-h-72 overflow-auto">
                {(saved.length ? saved : current ? [{ id: current.id, name: '', place: current, createdAt: 0 }] : []).map((l) => {
                  const active = l.place.id === current?.id;
                  return (
                    <li key={l.id}>
                      <button
                        type="button"
                        role="menuitemradio"
                        aria-checked={active}
                        onClick={() => {
                          void choose(l.place);
                          setOpen(false);
                        }}
                        className={clsx('flex w-full items-center gap-3 rounded-[10px] px-3 py-2 text-start', active ? 'bg-sage-soft' : 'hover:bg-[color-mix(in_oklab,var(--ink)_5%,transparent)]')}
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium text-ink">{l.name || placeName(l.place, lang)}</span>
                          <span className="block truncate text-[0.8125rem] text-ink-muted">{placeSubtitle(l.place, lang)}</span>
                        </span>
                        {active ? <IconCheck size={16} className="text-sage-strong" /> : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
              <div className="mt-1 border-t border-line-soft pt-1">
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setOpen(false);
                    setAdding(true);
                  }}
                  className="flex w-full items-center gap-3 rounded-[10px] px-3 py-2 text-start text-sage-strong hover:bg-sage-soft"
                >
                  <IconPlus size={17} />
                  <span className="font-medium">{t('home.addLocation')}</span>
                </button>
              </div>
            </div>,
            document.body,
          )
        : null}
      <Dialog open={adding} onClose={() => setAdding(false)} title={t('home.addLocation')} size="lg" closeLabel={t('common.close')}>
        <div className="pb-3">
          <LocationPicker
            autoFocus
            onPick={(p) => {
              void choose(p);
              setAdding(false);
            }}
          />
        </div>
      </Dialog>
    </>
  );
}
