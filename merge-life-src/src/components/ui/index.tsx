'use client';

import Link from 'next/link';
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';

export function classNames(...values: (string | false | null | undefined)[]): string {
  return values.filter(Boolean).join(' ');
}

/* ------------------------------------------------------------------ */

export function Card({
  children,
  className,
  as: Component = 'section',
}: {
  children: ReactNode;
  className?: string;
  as?: 'section' | 'div' | 'article' | 'li';
}) {
  return <Component className={classNames('ml-card p-5', className)}>{children}</Component>;
}

export function SectionTitle({
  children,
  hint,
  action,
}: {
  children: ReactNode;
  hint?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3">
      <div>
        <h2 className="text-lg font-semibold tracking-tight text-ink">{children}</h2>
        {hint ? <p className="mt-0.5 text-sm text-ink-soft">{hint}</p> : null}
      </div>
      {action}
    </div>
  );
}

/* ------------------------------------------------------------------ */

type ButtonVariant = 'primary' | 'secondary' | 'quiet';

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary: 'ml-button-primary',
  secondary: 'ml-button-secondary',
  quiet: 'ml-button-quiet',
};

export const Button = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; full?: boolean }
>(function Button({ variant = 'secondary', full, className, ...props }, ref) {
  return (
    <button
      ref={ref}
      type="button"
      className={classNames(VARIANT_CLASS[variant], full && 'w-full', className)}
      {...props}
    />
  );
});

export function LinkButton({
  href,
  children,
  variant = 'secondary',
  full,
  className,
}: {
  href: string;
  children: ReactNode;
  variant?: ButtonVariant;
  full?: boolean;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={classNames(VARIANT_CLASS[variant], full && 'w-full', className)}
    >
      {children}
    </Link>
  );
}

/* ------------------------------------------------------------------ */

export function Stat({
  label,
  value,
  hint,
  tone = 'default',
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: 'default' | 'quiet';
}) {
  return (
    <div
      className={classNames(
        'rounded-2xl border border-line/60 px-4 py-3',
        tone === 'quiet' ? 'bg-surface/60' : 'bg-surface-raised',
      )}
    >
      <p className="ml-label">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums text-ink">{value}</p>
      {hint ? <p className="mt-1 text-sm text-ink-soft">{hint}</p> : null}
    </div>
  );
}

/**
 * Progress bars always carry a text value as well as a bar, so nothing is
 * conveyed by colour or length alone.
 */
export function ProgressBar({
  value,
  max,
  label,
  valueText,
}: {
  value: number;
  max: number;
  label: string;
  valueText?: string;
}) {
  const percent = max <= 0 ? 0 : Math.min(100, Math.round((value / max) * 100));
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-3">
        <span className="text-sm text-ink-soft">{label}</span>
        <span className="text-sm font-medium tabular-nums text-ink">
          {valueText ?? `${value} of ${max}`}
        </span>
      </div>
      <div
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-label={label}
        className="h-2.5 w-full overflow-hidden rounded-pill bg-surface-sunken"
      >
        <div
          className="h-full rounded-pill bg-brass transition-[width] duration-500 ease-calm"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

export function Badge({
  children,
  tone = 'neutral',
}: {
  children: ReactNode;
  tone?: 'neutral' | 'sage' | 'brass' | 'slate';
}) {
  const toneClass = {
    neutral: 'border-line text-ink-soft',
    sage: 'border-sage/50 text-sage',
    brass: 'border-brass/50 text-brass',
    slate: 'border-slate/50 text-slate',
  }[tone];
  return (
    <span
      className={classNames(
        'inline-flex items-center gap-1 rounded-pill border bg-surface-raised px-2.5 py-1 text-xs font-medium',
        toneClass,
      )}
    >
      {children}
    </span>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-card border border-dashed border-line bg-surface/50 p-6 text-center">
      <p className="font-medium text-ink">{title}</p>
      {children ? <p className="mt-1 text-sm text-ink-soft">{children}</p> : null}
    </div>
  );
}
