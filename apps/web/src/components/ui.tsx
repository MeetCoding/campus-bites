import { LoaderCircle } from 'lucide-react';
import {
  useId,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
} from 'react';

import { cn } from '@/lib/cn';

// Alexandria on the web: tonal surfaces instead of borders, pill buttons, one primary action per
// view with the primary → primary-container gradient (stitch-reference/alexandria/DESIGN.md).

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

const buttonStyles: Record<ButtonVariant, string> = {
  primary:
    'bg-linear-to-br from-primary to-primary-container text-on-primary hover:brightness-110 active:brightness-95',
  secondary:
    'bg-surface-container-high text-on-surface hover:bg-surface-container-highest',
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
        'inline-flex shrink-0 items-center justify-center gap-space-sm rounded-full font-label transition disabled:opacity-50',
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
    <section className={cn('rounded-3xl bg-surface-container-lowest p-space-lg', className)}>
      {children}
    </section>
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

export function PageHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <header className="flex flex-col gap-space-xs">
      <h1 className="font-headline font-bold text-headline-lg-mobile text-on-surface sm:text-headline-lg">{title}</h1>
      <p className="max-w-2xl text-body-lg text-on-surface-variant">{subtitle}</p>
    </header>
  );
}

export function Notice({ tone = 'error', children }: { tone?: 'error' | 'success'; children: ReactNode }) {
  return (
    <p
      role={tone === 'error' ? 'alert' : 'status'}
      className={cn(
        'rounded-xl px-space-md py-space-sm text-body-md',
        tone === 'error'
          ? 'bg-error-container text-on-error-container'
          : 'bg-status-open-container text-on-status-open-container',
      )}>
      {children}
    </p>
  );
}

export function Loading({ label = 'Loading…' }: { label?: string }) {
  return (
    <div role="status" className="flex items-center gap-space-sm py-space-lg text-on-surface-variant">
      <LoaderCircle className="size-5 animate-spin" aria-hidden />
      {label}
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
