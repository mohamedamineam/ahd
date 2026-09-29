import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import clsx from 'clsx';
import { fromDigits, parseHHMM } from '@/lib/format';
import { IconCheck, IconClock, IconMinus, IconPlus } from '../icons';

/* ------------------------------------------------------------------ Toggle */

export interface ToggleProps {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
  disabled?: boolean;
  id?: string;
  size?: 'sm' | 'md';
}

export function Toggle({ checked, onChange, label, disabled, id, size = 'md' }: ToggleProps) {
  const sm = size === 'sm';
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={clsx(
        'relative inline-flex shrink-0 items-center rounded-full border transition-colors duration-200 ease-out disabled:opacity-45',
        sm ? 'h-5 w-9' : 'h-6 w-11',
        checked ? 'border-transparent bg-sage-strong' : 'border-line bg-surface-sunk',
      )}
    >
      <span
        aria-hidden
        className={clsx(
          'absolute rounded-full shadow-sm transition-[inset-inline-start,background-color] duration-200 ease-out',
          sm ? 'h-3.5 w-3.5' : 'h-[18px] w-[18px]',
          checked ? 'bg-on-sage' : 'bg-surface-raised',
        )}
        style={{ insetInlineStart: checked ? (sm ? 18 : 22) : 3 }}
      />
    </button>
  );
}

/* ------------------------------------------------------------------ Checkbox */

export interface CheckboxProps {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: ReactNode;
  hint?: ReactNode;
  disabled?: boolean;
  className?: string;
}

export function Checkbox({ checked, onChange, label, hint, disabled, className }: CheckboxProps) {
  const id = useId();
  return (
    <label
      htmlFor={id}
      className={clsx('group flex cursor-default items-start gap-3', disabled && 'opacity-50', className)}
    >
      <span className="relative mt-[3px] flex h-5 w-5 shrink-0 items-center justify-center">
        <input
          id={id}
          type="checkbox"
          className="peer absolute inset-0 appearance-none rounded-[6px] border border-line bg-surface-raised transition-colors checked:border-transparent checked:bg-sage-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
        />
        <IconCheck size={14} strokeWidth={2.4} className="pointer-events-none relative text-on-sage opacity-0 transition-opacity peer-checked:opacity-100" />
      </span>
      <span className="min-w-0">
        <span className="block leading-6 text-ink">{label}</span>
        {hint ? <span className="block text-[0.8125rem] leading-5 text-ink-muted">{hint}</span> : null}
      </span>
    </label>
  );
}

/* ------------------------------------------------------------------ Segmented control */

export interface SegmentedOption<T extends string | number> {
  value: T;
  label: ReactNode;
  icon?: ReactNode;
  disabled?: boolean;
}

export interface SegmentedProps<T extends string | number> {
  value: T;
  onChange: (v: T) => void;
  options: SegmentedOption<T>[];
  label?: string;
  size?: 'sm' | 'md';
  block?: boolean;
}

export function Segmented<T extends string | number>({ value, onChange, options, label, size = 'md', block }: SegmentedProps<T>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const onKey = (e: React.KeyboardEvent, i: number) => {
    const dir = getComputedStyle(e.currentTarget).direction === 'rtl' ? -1 : 1;
    let next: number;
    if (e.key === 'ArrowRight') next = i + dir;
    else if (e.key === 'ArrowLeft') next = i - dir;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = options.length - 1;
    else return;
    e.preventDefault();
    next = (next + options.length) % options.length;
    const opt = options[next];
    if (opt && !opt.disabled) {
      onChange(opt.value);
      refs.current[next]?.focus();
    }
  };
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={clsx(
        'inline-flex items-stretch gap-1 rounded-[12px] border border-line-soft bg-surface-sunk p-1',
        block && 'flex w-full',
      )}
    >
      {options.map((o, i) => {
        const active = o.value === value;
        return (
          <button
            key={String(o.value)}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            disabled={o.disabled}
            onClick={() => onChange(o.value)}
            onKeyDown={(e) => onKey(e, i)}
            className={clsx(
              'inline-flex items-center justify-center gap-1.5 rounded-[9px] px-3 font-medium transition-[background-color,color,box-shadow] duration-150 disabled:opacity-40',
              size === 'sm' ? 'h-7 text-[0.8125rem]' : 'h-8 text-[0.875rem]',
              block && 'flex-1',
              active ? 'bg-surface-raised text-ink shadow-sm' : 'text-ink-muted hover:text-ink',
            )}
          >
            {o.icon}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ Slider */

export interface SliderProps {
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
  label: string;
  format?: (v: number) => string;
  className?: string;
  disabled?: boolean;
}

export function Slider({ value, onChange, min, max, step = 1, label, format, className, disabled }: SliderProps) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className={clsx('flex items-center gap-3', className)}>
      <input
        type="range"
        className="ahd-range flex-1"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        aria-label={label}
        aria-valuetext={format ? format(value) : undefined}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ '--pct': `${pct}%` } as React.CSSProperties}
      />
      {format ? <span className="tabular min-w-[3.5rem] text-end text-[0.875rem] text-ink-muted">{format(value)}</span> : null}
    </div>
  );
}

/* ------------------------------------------------------------------ Stepper (−/+ with long-press repeat) */

function useRepeat(action: () => void) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const actionRef = useRef(action);
  useEffect(() => {
    actionRef.current = action;
  }, [action]);
  const stop = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }, []);
  const start = useCallback(() => {
    stop();
    actionRef.current();
    let delay = 420;
    const loop = () => {
      actionRef.current();
      delay = Math.max(40, delay * 0.82);
      timer.current = setTimeout(loop, delay);
    };
    timer.current = setTimeout(loop, delay);
  }, [stop]);
  useEffect(() => stop, [stop]);
  return { start, stop };
}

export interface StepperProps {
  onDecrement: () => void;
  onIncrement: () => void;
  decrementLabel: string;
  incrementLabel: string;
  children?: ReactNode;
  size?: 'sm' | 'md';
  disabled?: boolean;
}

export function Stepper({ onDecrement, onIncrement, decrementLabel, incrementLabel, children, size = 'md', disabled }: StepperProps) {
  const dec = useRepeat(onDecrement);
  const inc = useRepeat(onIncrement);
  const btn = clsx(
    'inline-flex shrink-0 items-center justify-center text-ink-muted transition-colors hover:bg-[color-mix(in_oklab,var(--ink)_8%,transparent)] hover:text-ink active:bg-sage-soft active:text-sage-strong disabled:opacity-40',
    size === 'sm' ? 'h-7 w-7 rounded-[7px]' : 'h-9 w-9 rounded-[9px]',
  );
  const handlers = (r: ReturnType<typeof useRepeat>) => ({
    onPointerDown: (e: React.PointerEvent) => {
      if (e.button !== 0) return;
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      r.start();
    },
    onPointerUp: r.stop,
    onPointerCancel: r.stop,
    onLostPointerCapture: r.stop,
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (!e.repeat) r.start();
        else r.stop();
      }
    },
    onKeyUp: r.stop,
  });
  return (
    <div className="inline-flex items-center gap-0.5 rounded-[11px] border border-line-soft bg-surface-sunk p-0.5">
      <button type="button" aria-label={decrementLabel} title={decrementLabel} disabled={disabled} className={btn} {...handlers(dec)}>
        <IconMinus size={size === 'sm' ? 15 : 17} />
      </button>
      {children}
      <button type="button" aria-label={incrementLabel} title={incrementLabel} disabled={disabled} className={btn} {...handlers(inc)}>
        <IconPlus size={size === 'sm' ? 15 : 17} />
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ Number field */

export interface NumberFieldProps {
  value: number | null;
  onChange: (v: number | null) => void;
  min?: number;
  max?: number;
  step?: number;
  label: string;
  suffix?: string;
  placeholder?: string;
  className?: string;
  /** −/+ buttons (default on) */
  stepper?: boolean;
}

export function NumberField({ value, onChange, min, max, step = 1, label, suffix, placeholder, className, stepper = true }: NumberFieldProps) {
  // The typed text is kept until Enter/blur: clamping on every key press made numbers impossible to type
  // (typing "30" with a minimum of 5 turned the "3" into "5").
  const [draft, setDraft] = useState<string | null>(null);
  const decimals = (String(step).split('.')[1] ?? '').length;
  const fit = (v: number) => Number(Math.min(max ?? Infinity, Math.max(min ?? -Infinity, v)).toFixed(decimals));
  const commit = (raw: string) => {
    setDraft(null);
    const text = fromDigits(raw).trim().replace(/[٫,]/g, '.').replace(/[−–]/g, '-');
    if (text === '') return onChange(null);
    const v = Number(text);
    if (Number.isFinite(v)) onChange(fit(v));
  };
  const bump = (dir: 1 | -1) => {
    setDraft(null);
    onChange(fit((value ?? min ?? 0) + dir * step));
  };
  const btn = 'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] text-ink-muted transition-colors hover:bg-[color-mix(in_oklab,var(--ink)_8%,transparent)] hover:text-ink disabled:opacity-35';
  const symbol = !!suffix && /^[°%]$/.test(suffix);
  return (
    <div className={clsx('inline-flex h-10 items-center gap-0.5 rounded-control border border-line bg-surface-raised px-1 focus-within:border-sage', className)}>
      {stepper ? (
        <button type="button" tabIndex={-1} aria-label={`${label} −`} className={btn} disabled={value !== null && min !== undefined && value <= min} onClick={() => bump(-1)}>
          <IconMinus size={15} />
        </button>
      ) : null}
      {/* a symbol (°, %) belongs to the number, left to right; a word (دقيقة) reads after it in the text direction */}
      <span dir={symbol ? 'ltr' : undefined} className="inline-flex min-w-0 items-center">
        <input
          type="text"
          inputMode="decimal"
          dir="ltr"
          aria-label={label}
          className="tabular w-12 min-w-0 bg-transparent text-center text-ink outline-none placeholder:text-ink-faint"
          value={draft ?? (value === null ? '' : String(value))}
          placeholder={placeholder}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={(e) => commit(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit(e.currentTarget.value);
            else if (e.key === 'Escape') setDraft(null);
            else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
              e.preventDefault();
              bump(e.key === 'ArrowUp' ? 1 : -1);
            }
          }}
        />
        {suffix ? <span className={clsx('text-[0.875rem] text-ink-muted', symbol ? 'ps-0.5 pe-1' : 'pe-1')}>{suffix}</span> : null}
      </span>
      {stepper ? (
        <button type="button" tabIndex={-1} aria-label={`${label} +`} className={btn} disabled={value !== null && max !== undefined && value >= max} onClick={() => bump(1)}>
          <IconPlus size={15} />
        </button>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ Time field */

export interface TimeFieldProps {
  /** "HH:MM", 24 h */
  value: string;
  onChange: (hhmm: string) => void;
  label: string;
  /** how the time is shown when not editing (the user's 12/24 h format and digits) */
  format: (hhmm: string) => string;
  className?: string;
}

/**
 * A time of day that follows the app's own time format. The browser's time input ignores it (it showed
 * "09:00 AM" with a 24-hour setting) and looks different in every engine.
 */
export function TimeField({ value, onChange, label, format, className }: TimeFieldProps) {
  const [draft, setDraft] = useState<string | null>(null);
  const shift = (minutes: number) => {
    const [h, m] = value.split(':').map(Number);
    const total = ((((h ?? 0) * 60 + (m ?? 0) + minutes) % 1440) + 1440) % 1440;
    onChange(`${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`);
  };
  const commit = (raw: string) => {
    const v = parseHHMM(raw);
    if (v) onChange(v);
    setDraft(null);
  };
  return (
    <div className={clsx('inline-flex h-10 items-center gap-2 rounded-control border border-line bg-surface-raised px-3 focus-within:border-sage', className)}>
      <IconClock size={16} className="shrink-0 text-ink-faint" />
      <input
        type="text"
        inputMode="numeric"
        dir="ltr"
        aria-label={label}
        className="tabular w-24 min-w-0 bg-transparent text-ink outline-none"
        value={draft ?? format(value)}
        onFocus={(e) => {
          setDraft(value);
          const el = e.currentTarget;
          requestAnimationFrame(() => el.select());
        }}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
          else if (e.key === 'Escape') {
            setDraft(value);
            e.currentTarget.blur();
          } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            e.preventDefault();
            shift(e.key === 'ArrowUp' ? 5 : -5);
            setDraft(null);
          }
        }}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ Text input */

export interface TextInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: ReactNode;
  error?: ReactNode;
  leading?: ReactNode;
  trailing?: ReactNode;
}

export function TextInput({ label, hint, error, leading, trailing, className, id, ...rest }: TextInputProps) {
  const auto = useId();
  const inputId = id ?? auto;
  return (
    <div className={clsx('flex flex-col gap-1.5', className)}>
      {label ? (
        <label htmlFor={inputId} className="text-[0.875rem] font-medium text-ink">
          {label}
        </label>
      ) : null}
      <div
        className={clsx(
          'flex h-10 items-center gap-2 rounded-control border bg-surface-raised px-3 transition-colors focus-within:border-sage focus-within:shadow-[0_0_0_3px_color-mix(in_oklab,var(--sage)_18%,transparent)]',
          error ? 'border-danger' : 'border-line',
        )}
      >
        {leading}
        <input id={inputId} className="min-w-0 flex-1 bg-transparent text-ink outline-none placeholder:text-ink-faint" {...rest} />
        {trailing}
      </div>
      {error ? <p className="text-[0.8125rem] text-danger">{error}</p> : hint ? <p className="text-[0.8125rem] text-ink-muted">{hint}</p> : null}
    </div>
  );
}
