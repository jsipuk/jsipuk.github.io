'use client';

import { formatCountdown } from '@/utils/time';
import { classNames } from '@/components/ui';
import type { SessionClock } from '@/hooks/useSessionClock';

/**
 * A calm countdown. No colour flashing, no ticking sound, no red at the end —
 * the state is always spelled out in words as well as numbers.
 */
export function SessionTimer({ clock }: { clock: SessionClock }) {
  if (!clock.active) return null;

  const isGrace = clock.phase === 'grace';
  const isFinalMinutes = clock.phase === 'final-minutes';

  return (
    <div
      className={classNames(
        'flex items-center gap-3 rounded-card border bg-surface-raised px-4 py-2.5 shadow-card',
        isGrace ? 'border-sage' : 'border-line',
      )}
    >
      <span
        aria-hidden="true"
        className={classNames(
          'inline-block h-2.5 w-2.5 rounded-full',
          isGrace ? 'bg-sage' : isFinalMinutes ? 'bg-brass' : 'bg-ink-faint',
        )}
      />
      <div className="leading-tight">
        <p className="ml-label">{isGrace ? 'Finishing up' : 'Session time left'}</p>
        <p className="text-xl font-semibold tabular-nums text-ink" aria-live="off">
          {isGrace ? formatCountdown(clock.graceMs) : formatCountdown(clock.remainingMs)}
        </p>
      </div>
      <p className="sr-only" aria-live="polite">
        {isGrace
          ? 'Time is up. You have a moment to finish the move you are on.'
          : `${Math.ceil(clock.remainingMs / 60000)} minutes left in this session.`}
      </p>
    </div>
  );
}
