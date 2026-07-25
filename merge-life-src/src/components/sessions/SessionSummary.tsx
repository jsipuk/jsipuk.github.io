'use client';

import { useRouter } from 'next/navigation';
import { getDefinition } from '@/data/itemChains';
import { Button, Card, LinkButton, Stat } from '@/components/ui';
import { timeReclaimedThisWeek } from '@/game/sessionEngine';
import { useGameStore, type SessionSummary as Summary } from '@/state/gameStore';
import { formatDuration } from '@/utils/time';

/**
 * The end of a session.
 *
 * Deliberately missing: "play again", "extend session", "buy more time",
 * "watch an advert", "come back in X minutes". The only ways forward are to
 * close the workshop or to look at the collection.
 */
export function SessionSummaryView({ summary }: { summary: Summary }) {
  const router = useRouter();
  const save = useGameStore((state) => state.save);
  const clearSummary = useGameStore((state) => state.clearSummary);

  const reclaimed = timeReclaimedThisWeek(save.sessions, save.settings);
  const { session } = summary;

  const close = () => {
    clearSummary();
    router.push('/');
  };

  return (
    <div className="space-y-5">
      <Card>
        <p className="ml-label">Session complete</p>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight text-ink">
          Good session. Everything is saved.
        </h2>
        <p className="mt-1 text-ink-soft">Your workshop will be here when you return.</p>
      </Card>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat label="Session duration" value={formatDuration(session.actualDurationMs, { short: true })} />
        <Stat label="Items created" value={session.itemsCreated} />
        <Stat label="Merges completed" value={session.merges} />
        <Stat label="Orders completed" value={session.ordersCompleted} />
        <Stat label="Watches completed" value={session.watchesCompleted} />
        <Stat label="Workshop progress" value={`+${summary.workshopProgressGained}`} />
      </div>

      <Card>
        <h3 className="font-semibold text-ink">New discoveries</h3>
        {summary.discoveries.length === 0 ? (
          <p className="mt-1 text-sm text-ink-soft">
            No new items this time. The chains keep for next session.
          </p>
        ) : (
          <ul className="mt-2 flex flex-wrap gap-2">
            {summary.discoveries.map((definitionId) => (
              <li key={definitionId} className="ml-chip">
                {getDefinition(definitionId).name}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <h3 className="font-semibold text-ink">Time reclaimed this week</h3>
        <p className="mt-1 text-xl font-semibold tabular-nums text-ink">
          {formatDuration(reclaimed)}
        </p>
        <p className="mt-1 text-sm text-ink-soft">
          Measured against your previous weekly gaming baseline of{' '}
          {formatDuration(save.settings.weeklyBaselineMinutes * 60_000)}.
        </p>
      </Card>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Button variant="primary" full onClick={close}>
          Close workshop
        </Button>
        <LinkButton href="/collection" variant="secondary" full>
          View collection
        </LinkButton>
      </div>
    </div>
  );
}
