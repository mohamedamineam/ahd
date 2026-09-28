import { useRef, type HTMLAttributes, type ReactNode } from 'react';
import clsx from 'clsx';
import { IconCheck } from '../icons';

/* ------------------------------------------------------------------ Card / Panel */

export function Card({ className, children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={clsx('rounded-panel border border-line-soft bg-surface shadow-sm', className)} {...rest}>
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ Badge */

export function Badge({
  children,
  tone = 'neutral',
  className,
}: {
  children: ReactNode;
  tone?: 'neutral' | 'sage' | 'ochre' | 'danger' | 'outline';
  className?: string;
}) {
  return (
    <span
      className={clsx(
        'inline-flex h-6 items-center gap-1 rounded-full px-2.5 text-[0.75rem] font-medium whitespace-nowrap',
        tone === 'neutral' && 'bg-surface-sunk text-ink-muted',
        tone === 'sage' && 'bg-sage-soft text-sage-strong',
        tone === 'ochre' && 'bg-ochre-soft text-ochre-strong',
        tone === 'danger' && 'bg-danger-soft text-danger',
        tone === 'outline' && 'border border-line text-ink-muted',
        className,
      )}
    >
      {children}
    </span>
  );
}

/* ------------------------------------------------------------------ Bidi-isolated LTR value (times, counters) */

export function Ltr({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <bdi dir="ltr" className={clsx('tabular', className)}>
      {children}
    </bdi>
  );
}

/* ------------------------------------------------------------------ Kbd */

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex h-6 min-w-6 items-center justify-center rounded-[6px] border border-line bg-surface-raised px-1.5 font-ui text-[0.75rem] text-ink-muted shadow-[0_1px_0_var(--line)]">
      {children}
    </kbd>
  );
}

/* ------------------------------------------------------------------ Tabs */

export interface TabItem<T extends string> {
  value: T;
  label: ReactNode;
  count?: number;
}

export function Tabs<T extends string>({ value, onChange, items, label, className }: { value: T; onChange: (v: T) => void; items: TabItem<T>[]; label: string; className?: string }) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  return (
    <div role="tablist" aria-label={label} className={clsx('flex items-center gap-1 border-b border-line-soft', className)}>
      {items.map((it, i) => {
        const active = it.value === value;
        return (
          <button
            key={it.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            role="tab"
            type="button"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(it.value)}
            onKeyDown={(e) => {
              const rtl = getComputedStyle(e.currentTarget).direction === 'rtl';
              const d = e.key === 'ArrowRight' ? (rtl ? -1 : 1) : e.key === 'ArrowLeft' ? (rtl ? 1 : -1) : 0;
              if (!d) return;
              e.preventDefault();
              const n = (i + d + items.length) % items.length;
              onChange(items[n]!.value);
              refs.current[n]?.focus();
            }}
            className={clsx(
              'relative -mb-px inline-flex h-10 items-center gap-2 px-3 text-[0.9375rem] font-medium transition-colors',
              active ? 'text-ink' : 'text-ink-muted hover:text-ink',
            )}
          >
            {it.label}
            {it.count !== undefined ? (
              <span className="rounded-full bg-surface-sunk px-1.5 text-[0.75rem] text-ink-muted tabular">{it.count}</span>
            ) : null}
            <span
              aria-hidden
              className={clsx('absolute inset-x-2 bottom-0 h-[2px] rounded-full transition-colors', active ? 'bg-sage-strong' : 'bg-transparent')}
            />
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ Empty state */

export function EmptyState({ icon, title, body, action, className }: { icon?: ReactNode; title: ReactNode; body?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={clsx('flex flex-col items-center justify-center px-6 py-12 text-center', className)}>
      {icon ? (
        <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-sage-soft text-sage-strong">{icon}</div>
      ) : null}
      <h3 className="font-display text-xl text-ink">{title}</h3>
      {body ? <p className="mt-2 max-w-sm text-balance text-ink-muted">{body}</p> : null}
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}

/* ------------------------------------------------------------------ Skeleton */

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={clsx('rounded-[8px]', className)}
      style={{
        background: 'linear-gradient(90deg, var(--surface-sunk) 0%, var(--surface) 50%, var(--surface-sunk) 100%)',
        backgroundSize: '200% 100%',
        animation: 'sakan-shimmer 1.6s linear infinite',
      }}
    />
  );
}

/* ------------------------------------------------------------------ Progress ring */

export function ProgressRing({
  value,
  size = 44,
  stroke = 3,
  tone = 'sage',
  children,
  label,
}: {
  value: number; // 0..1
  size?: number;
  stroke?: number;
  tone?: 'sage' | 'ochre';
  children?: ReactNode;
  label?: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.min(1, Math.max(0, value));
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }} role={label ? 'img' : undefined} aria-label={label}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--line-soft)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={tone === 'ochre' ? 'var(--ochre)' : 'var(--sage)'}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - v)}
          style={{ transition: 'stroke-dashoffset 600ms var(--ease-out)' }}
        />
      </svg>
      {children ? <div className="absolute inset-0 flex items-center justify-center">{children}</div> : null}
    </div>
  );
}

/* ------------------------------------------------------------------ Counter button (adhkar) */

export function CounterButton({
  remaining,
  total,
  onCount,
  label,
  doneLabel,
  animate = true,
}: {
  remaining: number;
  total: number;
  onCount: () => void;
  label: string;
  doneLabel: string;
  animate?: boolean;
}) {
  const done = remaining <= 0;
  const progress = total > 0 ? (total - remaining) / total : 1;
  const size = 76;
  const r = 34;
  const c = 2 * Math.PI * r;
  return (
    <button
      type="button"
      onClick={onCount}
      disabled={done}
      aria-label={done ? doneLabel : label}
      className={clsx(
        'group relative inline-flex shrink-0 items-center justify-center rounded-full transition-transform duration-150 active:scale-95 disabled:active:scale-100',
        done ? 'text-on-sage' : 'text-sage-strong',
      )}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="absolute inset-0 -rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill={done ? 'var(--sage-strong)' : 'var(--sage-soft)'} style={{ transition: 'fill 300ms' }} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--sage-strong)"
          strokeWidth={3}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - progress)}
          style={{ transition: animate ? 'stroke-dashoffset 260ms var(--ease-out)' : undefined }}
        />
      </svg>
      <span className="relative flex items-center justify-center">
        {done ? (
          <IconCheck size={30} strokeWidth={2.2} className={animate ? 'animate-scale-in' : undefined} />
        ) : (
          <span className="tabular text-2xl font-semibold">{remaining}</span>
        )}
      </span>
    </button>
  );
}

/* ------------------------------------------------------------------ Swatch picker */

export interface Swatch<T extends string> {
  value: T;
  label: string;
  colors: string[];
}

export function SwatchPicker<T extends string>({ value, onChange, swatches, label }: { value: T; onChange: (v: T) => void; swatches: Swatch<T>[]; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {swatches.map((s) => {
        const active = s.value === value;
        return (
          <button
            key={s.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(s.value)}
            className={clsx(
              'flex items-center gap-3 rounded-[12px] border p-2.5 text-start transition-colors',
              active ? 'border-sage bg-sage-soft' : 'border-line-soft bg-surface-raised hover:border-line',
            )}
          >
            <span className="flex -space-x-1.5 rtl:space-x-reverse">
              {s.colors.map((c, i) => (
                <span key={i} className="h-6 w-6 rounded-full border-2 border-surface-raised shadow-sm" style={{ background: c }} />
              ))}
            </span>
            <span className="min-w-0 flex-1 truncate text-[0.875rem] font-medium text-ink">{s.label}</span>
            {active ? <IconCheck size={16} className="text-sage-strong" /> : null}
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ Settings row */

export function SettingRow({
  label,
  description,
  children,
  htmlFor,
  stacked,
  id,
}: {
  label: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  htmlFor?: string;
  stacked?: boolean;
  id?: string;
}) {
  return (
    <div id={id} className={clsx('flex gap-x-6 gap-y-3 py-4', stacked ? 'flex-col' : 'flex-wrap items-center justify-between')}>
      <div className="min-w-0 flex-1 basis-64">
        <label htmlFor={htmlFor} className="block font-medium text-ink">
          {label}
        </label>
        {description ? <p className="mt-0.5 text-[0.875rem] leading-relaxed text-ink-muted">{description}</p> : null}
      </div>
      {children ? <div className={clsx('flex items-center gap-2', stacked ? 'w-full' : 'shrink-0')}>{children}</div> : null}
    </div>
  );
}

export function SettingGroup({ title, children, description }: { title?: ReactNode; description?: ReactNode; children: ReactNode }) {
  return (
    <section className="mb-6">
      {title ? <h3 className="mb-1 text-[0.9375rem] font-semibold text-ink">{title}</h3> : null}
      {description ? <p className="mb-2 text-[0.875rem] text-ink-muted">{description}</p> : null}
      <div className="divide-y divide-line-soft rounded-panel border border-line-soft bg-surface px-5">{children}</div>
    </section>
  );
}
