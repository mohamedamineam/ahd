import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import clsx from 'clsx';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'soft';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
  iconEnd?: ReactNode;
  loading?: boolean;
  block?: boolean;
}

const base =
  'relative inline-flex select-none items-center justify-center gap-2 whitespace-nowrap font-medium transition-[background-color,color,box-shadow,transform,border-color] duration-150 ease-out disabled:pointer-events-none disabled:opacity-45 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2';

const variants: Record<ButtonVariant, string> = {
  primary:
    'bg-sage-strong text-on-sage shadow-sm hover:bg-[color-mix(in_oklab,var(--sage-strong)_88%,var(--ink))] dark:hover:bg-[color-mix(in_oklab,var(--sage-strong)_88%,white)]',
  secondary:
    'border border-line bg-surface-raised text-ink shadow-sm hover:border-[color-mix(in_oklab,var(--line)_60%,var(--ink))] hover:bg-surface',
  soft: 'bg-sage-soft text-sage-strong hover:bg-[color-mix(in_oklab,var(--sage-soft)_80%,var(--sage))]',
  ghost: 'text-ink-muted hover:bg-[color-mix(in_oklab,var(--ink)_7%,transparent)] hover:text-ink',
  danger: 'border border-[color-mix(in_oklab,var(--danger)_35%,transparent)] text-danger hover:bg-danger-soft',
};

const sizes: Record<ButtonSize, string> = {
  sm: 'h-8 rounded-[8px] px-3 text-[0.8125rem]',
  md: 'h-10 rounded-control px-4 text-[0.9375rem]',
  lg: 'h-12 rounded-[12px] px-5 text-base',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', icon, iconEnd, loading, block, className, children, type = 'button', disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={clsx(base, variants[variant], sizes[size], block && 'w-full', className)}
      {...rest}
    >
      {loading ? <Spinner /> : icon}
      {children}
      {iconEnd}
    </button>
  );
});

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'ghost' | 'secondary' | 'soft' | 'primary';
  active?: boolean;
}

const iconSizes = { sm: 'h-8 w-8 rounded-[8px]', md: 'h-10 w-10 rounded-control', lg: 'h-12 w-12 rounded-[12px]' };

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, size = 'md', variant = 'ghost', active, className, children, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      title={label}
      aria-pressed={active}
      className={clsx(
        'inline-flex shrink-0 items-center justify-center transition-[background-color,color,transform] duration-150 active:scale-95 disabled:pointer-events-none disabled:opacity-40',
        iconSizes[size],
        variants[variant],
        active && 'bg-sage-soft text-sage-strong',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
});

export function Spinner({ size = 16, className }: { size?: number; className?: string }) {
  return (
    <svg className={clsx('animate-spin', className)} width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeOpacity=".22" strokeWidth="2.5" />
      <path d="M21 12a9 9 0 0 0-9-9" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}
