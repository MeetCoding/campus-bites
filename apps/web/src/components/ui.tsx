import { LoaderCircle } from 'lucide-react';
import { motion } from 'motion/react';
import {
  useId,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
} from 'react';

import { BrandSymbol } from '@/components/BrandMark';
import { DriftingOrbs, KineticText } from '@/components/motion';
import { cn } from '@/lib/cn';

// Alexandria on the web: tonal surfaces instead of borders, pill buttons, one primary action per
// view with the primary → primary-container gradient (stitch-reference/alexandria/DESIGN.md).
// Motion: cards and headers rise in on mount, buttons press down; MotionConfig in main.tsx turns
// movement off for users who ask for reduced motion.

const RISE = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.18, ease: 'easeOut' },
} as const;

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

const buttonStyles: Record<ButtonVariant, string> = {
  primary:
    'bg-linear-to-br from-primary to-primary-container text-on-primary shadow-[0_6px_16px_-8px_rgb(23_77_59/0.6)] hover:brightness-110 active:brightness-95',
  secondary:
    'bg-surface-container-lowest text-on-surface ring-1 ring-card-edge hover:bg-surface-container-low',
  ghost: 'text-primary hover:bg-primary/8',
  danger: 'bg-error-container text-on-error-container hover:brightness-95',
};

export function Button({
  variant = 'secondary',
  loading = false,
  size = 'md',
  icon,
  className,
  children,
  disabled,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  loading?: boolean;
  size?: 'sm' | 'md';
  icon?: ReactNode;
}) {
  return (
    <button
      type="button"
      {...props}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        'inline-flex shrink-0 items-center justify-center gap-space-sm rounded-xl font-label transition duration-150 ease-out active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100',
        size === 'md' ? 'h-10 px-space-md text-label-lg' : 'h-8 px-3 text-label-md',
        buttonStyles[variant],
        className,
      )}>
      {loading ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : icon}
      {children}
    </button>
  );
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <motion.section {...RISE} className={cn(
        'rounded-2xl bg-surface-container-lowest p-space-lg ring-1 ring-card-edge shadow-[0_1px_2px_rgb(0_0_0/0.04),0_8px_20px_-14px] shadow-card-shadow',
        className,
      )}>
      {children}
    </motion.section>
  );
}

const fieldStyles =
  'h-10 w-full rounded-xl bg-surface-container-low px-3 text-body-md text-on-surface outline-none ring-primary/40 placeholder:text-on-surface-variant/70 focus:bg-surface-container-lowest focus:ring-2';

export function TextField({
  label,
  error,
  hint,
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string | null; hint?: string }) {
  const id = useId();
  return (
    <div className={cn('flex min-w-0 flex-col gap-space-xs', className)}>
      <label htmlFor={id} className="font-label text-label-md text-on-surface-variant">
        {label}
      </label>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error || hint ? `${id}-note` : undefined}
        className={cn(fieldStyles, error && 'ring-2 ring-error/60')}
        {...props}
      />
      {error || hint ? (
        <p id={`${id}-note`} className={cn('text-body-sm', error ? 'text-error' : 'text-on-surface-variant')}>
          {error ?? hint}
        </p>
      ) : null}
    </div>
  );
}

export function SelectField({
  label,
  className,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { label: string }) {
  const id = useId();
  return (
    <div className={cn('flex min-w-0 flex-col gap-space-xs', className)}>
      <label htmlFor={id} className="font-label text-label-md text-on-surface-variant">
        {label}
      </label>
      <select id={id} className={cn(fieldStyles, 'pr-8')} {...props}>
        {children}
      </select>
    </div>
  );
}

type PillTone = 'neutral' | 'open' | 'warning' | 'official' | 'error';

const pillStyles: Record<PillTone, string> = {
  neutral: 'bg-surface-container-high text-on-surface-variant',
  open: 'bg-status-open-container text-on-status-open-container',
  warning: 'bg-status-warning-container text-on-status-warning-container',
  official: 'bg-tertiary-fixed text-on-tertiary-fixed-variant',
  error: 'bg-error-container text-on-error-container',
};

export function Pill({ tone = 'neutral', children }: { tone?: PillTone; children: ReactNode }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 font-label text-label-sm uppercase',
        pillStyles[tone],
      )}>
      {children}
    </span>
  );
}

/**
 * Hero banner at the top of each page: still glows, the logo, the title and subtitle. It fades
 * in once, quickly.
 */
export function PageHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <motion.header
      {...RISE}
      className="relative flex items-center gap-space-lg overflow-hidden rounded-3xl bg-linear-to-br from-hero to-primary p-space-lg sm:p-space-xl">
      <DriftingOrbs variant="panel" />
      <div className="relative flex min-w-0 flex-1 flex-col gap-space-xs">
        <h1 className="font-headline font-extrabold text-headline-lg-mobile text-on-primary sm:text-headline-lg">
          <KineticText text={title} />
        </h1>
        <p className="max-w-2xl text-body-lg text-on-primary-container">{subtitle}</p>
        <span aria-hidden className="mt-space-xs h-1 w-12 rounded-full bg-tertiary-container" />
      </div>
      <BrandSymbol animated tone="onDark" className="relative hidden h-20 shrink-0 sm:block" />
    </motion.header>
  );
}

export function Notice({ tone = 'error', children }: { tone?: 'error' | 'success'; children: ReactNode }) {
  return (
    <motion.p
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.15 }}
      role={tone === 'error' ? 'alert' : 'status'}
      className={cn(
        'rounded-xl px-space-md py-space-sm text-body-md',
        tone === 'error'
          ? 'bg-error-container text-on-error-container'
          : 'bg-status-open-container text-on-status-open-container',
      )}>
      {children}
    </motion.p>
  );
}

/** A placeholder block that pulses gently (the pulse stops for reduced-motion users via CSS). */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn('animate-pulse rounded-lg bg-surface-dim motion-reduce:animate-none', className)} />;
}

/** Skeleton rows standing in for a list while it loads. */
export function Loading({ label = 'Loading…', rows = 3 }: { label?: string; rows?: number }) {
  return (
    <div role="status" aria-label={label} className="flex flex-col gap-space-xs py-space-xs">
      <span className="sr-only">{label}</span>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex flex-col gap-2 rounded-xl bg-surface-container-low px-space-md py-space-sm">
          <Skeleton className="h-4 w-2/5" />
          <Skeleton className="h-3 w-3/5" />
        </div>
      ))}
    </div>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-2xl bg-surface-container-low px-space-md py-space-lg text-center text-on-surface-variant">
      {children}
    </p>
  );
}

/**
 * Destructive actions ask once, in place: the button turns into "Confirm / Cancel" (no modal).
 */
export function ConfirmButton({
  label,
  confirmLabel,
  onConfirm,
  loading,
  disabled,
  disabledReason,
  icon,
}: {
  label: string;
  confirmLabel: string;
  onConfirm: () => void;
  loading?: boolean;
  disabled?: boolean;
  disabledReason?: string;
  icon?: ReactNode;
}) {
  const [asking, setAsking] = useState(false);
  if (asking || loading) {
    return (
      <span className="inline-flex items-center gap-space-xs">
        <Button
          size="sm"
          variant="danger"
          loading={loading}
          onClick={() => {
            onConfirm();
            setAsking(false);
          }}>
          {confirmLabel}
        </Button>
        {loading ? null : (
          <Button size="sm" variant="ghost" onClick={() => setAsking(false)}>
            Cancel
          </Button>
        )}
      </span>
    );
  }
  return (
    <Button
      size="sm"
      variant="ghost"
      icon={icon}
      disabled={disabled}
      title={disabled ? disabledReason : undefined}
      onClick={() => setAsking(true)}>
      {label}
    </Button>
  );
}
