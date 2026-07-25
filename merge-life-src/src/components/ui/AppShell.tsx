'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';

/**
 * Shared page frame: a back link, a title, and a wide, comfortable column that
 * works from a phone to a desktop without changing its character.
 */
export function AppShell({
  title,
  subtitle,
  backHref,
  backLabel = 'Back',
  actions,
  children,
  wide,
}: {
  title: string;
  subtitle?: ReactNode;
  backHref?: string;
  backLabel?: string;
  actions?: ReactNode;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="min-h-screen pb-24">
      <header className="px-4 pt-[max(1rem,env(safe-area-inset-top))] sm:px-6">
        <div className={wide ? 'mx-auto max-w-6xl' : 'mx-auto max-w-3xl'}>
          {backHref ? (
            <Link
              href={backHref}
              className="ml-button-quiet -ml-3 mb-1 inline-flex px-3 text-sm"
            >
              <span aria-hidden="true">←</span>
              {backLabel}
            </Link>
          ) : null}
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">{title}</h1>
              {subtitle ? <p className="mt-1 text-ink-soft">{subtitle}</p> : null}
            </div>
            {actions}
          </div>
        </div>
      </header>
      <main id="main" className="px-4 pt-5 sm:px-6">
        <div className={wide ? 'mx-auto max-w-6xl' : 'mx-auto max-w-3xl'}>{children}</div>
      </main>
    </div>
  );
}
