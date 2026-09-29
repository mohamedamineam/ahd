import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import clsx from 'clsx';
import { create } from 'zustand';
import { IconCheck, IconChevronDown, IconClose, IconInfo, IconAlert } from '../icons';
import { IconButton } from './Button';

/* ------------------------------------------------------------------ focus trap */

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

function useFocusTrap(open: boolean, ref: React.RefObject<HTMLElement | null>, onClose: () => void) {
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const node = ref.current;
    const first = node?.querySelector<HTMLElement>('[data-autofocus]') ?? node?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? node)?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== 'Tab' || !node) return;
      const items = Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.offsetParent !== null);
      if (!items.length) return;
      const firstEl = items[0]!;
      const lastEl = items[items.length - 1]!;
      if (e.shiftKey && document.activeElement === firstEl) {
        e.preventDefault();
        lastEl.focus();
      } else if (!e.shiftKey && document.activeElement === lastEl) {
        e.preventDefault();
        firstEl.focus();
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      prev?.focus?.();
    };
  }, [open, ref, onClose]);
}

/* ------------------------------------------------------------------ Dialog */

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
  closeLabel?: string;
}

export function Dialog({ open, onClose, title, description, children, footer, size = 'md', closeLabel = 'Close' }: DialogProps) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descId = useId();
  useFocusTrap(open, ref, onClose);
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
      <div className="animate-fade-in absolute inset-0 bg-[color-mix(in_oklab,var(--ink)_28%,transparent)]" onClick={onClose} />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        className={clsx(
          'animate-scale-in relative flex max-h-[88vh] w-full flex-col overflow-hidden rounded-[18px] border border-line-soft bg-surface-raised shadow-lg',
          size === 'sm' ? 'max-w-sm' : size === 'lg' ? 'max-w-2xl' : 'max-w-md',
        )}
      >
        <div className="flex items-start gap-3 px-6 pt-5 pb-2">
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-lg font-semibold text-ink">
              {title}
            </h2>
            {description ? (
              <p id={descId} className="mt-1 text-[0.875rem] text-ink-muted">
                {description}
              </p>
            ) : null}
          </div>
          <IconButton label={closeLabel} size="sm" onClick={onClose} className="-me-2 -mt-1">
            <IconClose size={18} />
          </IconButton>
        </div>
        <div className="min-h-0 flex-1 overflow-auto px-6 py-3">{children}</div>
        {footer ? <div className="flex items-center justify-end gap-2 border-t border-line-soft px-6 py-4">{footer}</div> : null}
      </div>
    </div>,
    document.body,
  );
}

/* ------------------------------------------------------------------ Sheet (side panel from the inline end) */

export interface SheetProps extends Omit<DialogProps, 'size'> {
  width?: number;
}

export function Sheet({ open, onClose, title, description, children, footer, width = 420, closeLabel = 'Close' }: SheetProps) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useFocusTrap(open, ref, onClose);
  // stays mounted for the closing animation
  const [visible, setVisible] = useState(open);
  if (open && !visible) setVisible(true);
  useEffect(() => {
    if (open) return;
    const t = setTimeout(() => setVisible(false), 220);
    return () => clearTimeout(t);
  }, [open]);
  if (!visible) return null;
  return createPortal(
    <div className="fixed inset-0 z-50">
      <div
        className={clsx(
          'absolute inset-0 bg-[color-mix(in_oklab,var(--ink)_22%,transparent)] transition-opacity duration-200',
          open ? 'opacity-100' : 'opacity-0',
        )}
        onClick={onClose}
      />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        style={{ width }}
        className={clsx(
          'absolute inset-y-0 end-0 flex max-w-[92vw] flex-col border-s border-line-soft bg-surface-raised shadow-lg transition-transform duration-200 ease-out',
          open ? 'translate-x-0' : 'translate-x-full rtl:-translate-x-full',
        )}
      >
        <div className="flex items-start gap-3 px-6 pt-6 pb-3">
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="font-display text-xl text-ink">
              {title}
            </h2>
            {description ? <p className="mt-1.5 text-[0.875rem] text-ink-muted">{description}</p> : null}
          </div>
          <IconButton label={closeLabel} size="sm" onClick={onClose} className="-me-2">
            <IconClose size={18} />
          </IconButton>
        </div>
        <div className="min-h-0 flex-1 overflow-auto px-6 pb-6">{children}</div>
        {footer ? <div className="flex items-center justify-end gap-2 border-t border-line-soft px-6 py-4">{footer}</div> : null}
      </div>
    </div>,
    document.body,
  );
}

/* ------------------------------------------------------------------ Select (listbox) */

export interface SelectOption<T extends string> {
  value: T;
  label: ReactNode;
  hint?: ReactNode;
  group?: string;
  disabled?: boolean;
}

export interface SelectProps<T extends string> {
  value: T;
  onChange: (v: T) => void;
  options: SelectOption<T>[];
  label: string;
  className?: string;
  size?: 'sm' | 'md';
  placeholder?: ReactNode;
  disabled?: boolean;
}

export function Select<T extends string>({ value, onChange, options, label, className, size = 'md', placeholder, disabled }: SelectProps<T>) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const listId = useId();
  const typeahead = useRef({ text: '', t: 0 });
  const selected = options.find((o) => o.value === value);

  const openList = useCallback(() => {
    if (disabled) return;
    setRect(btn.current?.getBoundingClientRect() ?? null);
    setActive(Math.max(0, options.findIndex((o) => o.value === value)));
    setOpen(true);
  }, [disabled, options, value]);

  useLayoutEffect(() => {
    if (!open) return;
    const el = list.current?.querySelector<HTMLElement>(`[data-index="${active}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [open, active]);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!list.current?.contains(e.target as Node) && !btn.current?.contains(e.target as Node)) setOpen(false);
    };
    const onScroll = (e: Event) => {
      if (!list.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('mousedown', close);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', () => setOpen(false), { once: true });
    return () => {
      window.removeEventListener('mousedown', close);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [open]);

  const choose = (i: number) => {
    const o = options[i];
    if (!o || o.disabled) return;
    onChange(o.value);
    setOpen(false);
    btn.current?.focus();
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
        e.preventDefault();
        openList();
      }
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(options.length - 1, a + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === 'Home') {
      e.preventDefault();
      setActive(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      setActive(options.length - 1);
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      choose(active);
    } else if (e.key === 'Tab') {
      setOpen(false);
    } else if (e.key.length === 1) {
      const now = Date.now();
      typeahead.current.text = now - typeahead.current.t < 700 ? typeahead.current.text + e.key.toLowerCase() : e.key.toLowerCase();
      typeahead.current.t = now;
      const i = options.findIndex((o) => String(typeof o.label === 'string' ? o.label : o.value).toLowerCase().startsWith(typeahead.current.text));
      if (i >= 0) setActive(i);
    }
  };

  const spaceBelow = rect ? window.innerHeight - rect.bottom : 0;
  const above = rect ? spaceBelow < 260 && rect.top > spaceBelow : false;

  return (
    <>
      <button
        ref={btn}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={label}
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={onKey}
        className={clsx(
          'inline-flex min-w-0 items-center justify-between gap-2 rounded-control border border-line bg-surface-raised text-start text-ink shadow-sm transition-colors hover:border-[color-mix(in_oklab,var(--line)_60%,var(--ink))] disabled:opacity-45',
          size === 'sm' ? 'h-8 px-2.5 text-[0.8125rem]' : 'h-10 px-3 text-[0.9375rem]',
          className,
        )}
      >
        <span className="min-w-0 truncate">{selected?.label ?? placeholder}</span>
        <IconChevronDown size={16} className={clsx('shrink-0 text-ink-muted transition-transform', open && 'rotate-180')} />
      </button>
      {open && rect
        ? createPortal(
            <ul
              ref={list}
              id={listId}
              role="listbox"
              aria-label={label}
              tabIndex={-1}
              onKeyDown={onKey}
              style={{
                position: 'fixed',
                insetInlineStart: document.documentElement.dir === 'rtl' ? window.innerWidth - rect.right : rect.left,
                top: above ? undefined : rect.bottom + 6,
                bottom: above ? window.innerHeight - rect.top + 6 : undefined,
                minWidth: rect.width,
                maxHeight: Math.min(320, above ? rect.top - 16 : spaceBelow - 16),
              }}
              className="animate-scale-in z-[60] overflow-auto rounded-[12px] border border-line-soft bg-surface-raised p-1 shadow-lg"
            >
              {options.map((o, i) => {
                const prevGroup = i > 0 ? options[i - 1]!.group : undefined;
                return (
                  <li key={o.value} role="presentation">
                    {o.group && o.group !== prevGroup ? (
                      <div className="px-3 pt-2.5 pb-1 text-[0.75rem] font-medium text-ink-faint">{o.group}</div>
                    ) : null}
                    <div
                      role="option"
                      data-index={i}
                      aria-selected={o.value === value}
                      aria-disabled={o.disabled}
                      onMouseEnter={() => setActive(i)}
                      onClick={() => choose(i)}
                      className={clsx(
                        'flex cursor-default items-center gap-2 rounded-[8px] px-3 py-2 text-[0.9375rem]',
                        i === active ? 'bg-sage-soft text-ink' : 'text-ink',
                        o.disabled && 'opacity-40',
                      )}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate">{o.label}</span>
                        {o.hint ? <span className="block truncate text-[0.8125rem] text-ink-muted">{o.hint}</span> : null}
                      </span>
                      {o.value === value ? <IconCheck size={16} className="shrink-0 text-sage-strong" /> : null}
                    </div>
                  </li>
                );
              })}
            </ul>,
            document.body,
          )
        : null}
    </>
  );
}

/* ------------------------------------------------------------------ Toasts (in-app) */

export interface ToastItem {
  id: number;
  message: ReactNode;
  tone?: 'info' | 'success' | 'warning' | 'error';
  action?: { label: string; onClick: () => void };
}

interface ToastState {
  items: ToastItem[];
  push: (t: Omit<ToastItem, 'id'>, ms?: number) => void;
  dismiss: (id: number) => void;
}

let toastId = 0;
export const useToasts = create<ToastState>((set, get) => ({
  items: [],
  push(t, ms = 4200) {
    const id = ++toastId;
    set({ items: [...get().items.slice(-2), { ...t, id }] });
    setTimeout(() => get().dismiss(id), ms);
  },
  dismiss(id) {
    set({ items: get().items.filter((x) => x.id !== id) });
  },
}));

export const toast = (message: ReactNode, tone: ToastItem['tone'] = 'info', action?: ToastItem['action']) =>
  useToasts.getState().push({ message, tone, action });

export function Toaster() {
  const items = useToasts((s) => s.items);
  const dismiss = useToasts((s) => s.dismiss);
  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-6 z-[70] flex flex-col items-center gap-2 px-4">
      {items.map((t) => (
        <div
          key={t.id}
          role="status"
          className="animate-scale-in pointer-events-auto flex max-w-md items-center gap-3 rounded-[12px] border border-line-soft bg-ink px-4 py-3 text-[0.9375rem] text-bg shadow-lg"
        >
          {t.tone === 'success' ? (
            <IconCheck size={18} className="shrink-0 text-sage-soft" />
          ) : t.tone === 'error' || t.tone === 'warning' ? (
            <IconAlert size={18} className="shrink-0 text-ochre-soft" />
          ) : (
            <IconInfo size={18} className="shrink-0 opacity-70" />
          )}
          <span className="min-w-0 flex-1">{t.message}</span>
          {t.action ? (
            <button
              type="button"
              className="rounded-[8px] px-2 py-1 font-medium text-sage-soft hover:bg-white/10"
              onClick={() => {
                t.action!.onClick();
                dismiss(t.id);
              }}
            >
              {t.action.label}
            </button>
          ) : null}
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ Tooltip */

export function Tooltip({ label, children, side = 'top' }: { label: ReactNode; children: React.ReactElement; side?: 'top' | 'bottom' }) {
  const [rect, setRect] = useState<DOMRect | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const show = (e: React.SyntheticEvent) => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setRect(r), 450);
  };
  const hide = () => {
    if (timer.current) clearTimeout(timer.current);
    setRect(null);
  };
  return (
    <span className="inline-flex" onMouseEnter={show} onMouseLeave={hide} onFocus={show} onBlur={hide}>
      {children}
      {rect
        ? createPortal(
            <span
              role="tooltip"
              style={{
                position: 'fixed',
                left: rect.left + rect.width / 2,
                top: side === 'top' ? rect.top - 8 : rect.bottom + 8,
                transform: `translate(-50%, ${side === 'top' ? '-100%' : '0'})`,
              }}
              className="animate-fade-in pointer-events-none z-[80] max-w-xs rounded-[8px] bg-ink px-2.5 py-1.5 text-[0.8125rem] text-bg shadow-md"
            >
              {label}
            </span>,
            document.body,
          )
        : null}
    </span>
  );
}
