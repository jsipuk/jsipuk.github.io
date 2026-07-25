'use client';

import { useState } from 'react';
import { MergeBoard } from '@/components/board/MergeBoard';
import { GeneratorTray } from '@/components/generators/GeneratorTray';
import { OrderList } from '@/components/orders/OrderList';
import { SessionSummaryView } from '@/components/sessions/SessionSummary';
import { SessionTimer } from '@/components/sessions/SessionTimer';
import { AppShell } from '@/components/ui/AppShell';
import { Button, Card, LinkButton, SectionTitle, Stat } from '@/components/ui';
import { CraftBench } from '@/components/workshop/CraftBench';
import { WorkshopScene } from '@/components/workshop/WorkshopScene';
import { dailyLimitState } from '@/game/sessionEngine';
import { useSessionClock } from '@/hooks/useSessionClock';
import { useGameStore } from '@/state/gameStore';

export default function WorkshopPage() {
  const status = useGameStore((state) => state.status);
  const save = useGameStore((state) => state.save);
  const lastSummary = useGameStore((state) => state.lastSummary);
  const beginSession = useGameStore((state) => state.beginSession);
  const endSession = useGameStore((state) => state.endSession);
  const undo = useGameStore((state) => state.undo);
  const undoStack = useGameStore((state) => state.undoStack);
  const clock = useSessionClock();
  const [confirmEnd, setConfirmEnd] = useState(false);

  if (status !== 'ready') {
    return (
      <AppShell title="Watch Workshop" backHref="/">
        <p className="text-ink-soft">Opening your bench…</p>
      </AppShell>
    );
  }

  if (lastSummary) {
    return (
      <AppShell title="Session summary" subtitle="Everything below is already saved.">
        <SessionSummaryView summary={lastSummary} />
      </AppShell>
    );
  }

  const limit = dailyLimitState(save);
  const viewingOnly = !clock.active;

  return (
    <AppShell
      title="Watch Workshop"
      subtitle={
        clock.active
          ? clock.phase === 'grace'
            ? 'Time is up. Finish the move you are on — there is no rush.'
            : 'Drag two matching parts together, or tap one and then tap where it should go.'
          : 'Viewing mode. Your bench is exactly as you left it.'
      }
      backHref="/"
      backLabel="My Life Workshop"
      wide
      actions={
        clock.active ? (
          <div className="flex flex-wrap items-center gap-3">
            <SessionTimer clock={clock} />
            <Button variant="secondary" onClick={() => setConfirmEnd(true)}>
              End session
            </Button>
          </div>
        ) : null
      }
    >
      <div className="space-y-6">
        {!clock.active ? (
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="font-semibold text-ink">
                  {limit.canStart ? 'Not in a session' : 'Viewing mode for the rest of today'}
                </h2>
                <p className="mt-1 max-w-prose text-sm text-ink-soft">
                  {limit.canStart
                    ? 'You can look around freely. Generators and merging start when you begin a session.'
                    : `You have used ${limit.used} of ${limit.limit} sessions today. Your workshop, collection and stats stay open to browse. You can change the daily limit in Settings.`}
                </p>
              </div>
              {limit.canStart ? (
                <Button
                  variant="primary"
                  onClick={() => beginSession(save.settings.preferredSessionMinutes)}
                >
                  Begin intentional session
                </Button>
              ) : (
                <LinkButton href="/collection" variant="secondary">
                  Browse collection
                </LinkButton>
              )}
            </div>
          </Card>
        ) : null}

        {confirmEnd ? (
          <Card>
            <h2 className="font-semibold text-ink">End this session now?</h2>
            <p className="mt-1 text-sm text-ink-soft">
              Your board, orders and progress are all saved. Nothing is lost by stopping early.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Button
                variant="primary"
                onClick={() => {
                  setConfirmEnd(false);
                  endSession('player');
                }}
              >
                Yes, end the session
              </Button>
              <Button variant="quiet" onClick={() => setConfirmEnd(false)}>
                Keep working
              </Button>
            </div>
          </Card>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-5">
            <section aria-labelledby="board-heading">
              <SectionTitle
                hint={
                  viewingOnly
                    ? 'Read only until you begin a session.'
                    : 'Two identical parts merge into the next part in the chain.'
                }
                action={
                  <Button
                    variant="quiet"
                    className="whitespace-nowrap"
                    onClick={undo}
                    disabled={undoStack.length === 0 || !clock.canInteract}
                  >
                    Undo last move
                  </Button>
                }
              >
                <span id="board-heading">The bench</span>
              </SectionTitle>
              <MergeBoard interactive={clock.canInteract} />
            </section>

            <section aria-labelledby="generators-heading">
              <SectionTitle
                hint={
                  clock.canUseGenerators
                    ? 'A fixed number of uses per session. No timers, no refills.'
                    : 'Generators rest until your next session.'
                }
              >
                <span id="generators-heading">Parts benches</span>
              </SectionTitle>
              <GeneratorTray enabled={clock.canUseGenerators} />
            </section>

            <section aria-labelledby="craft-heading">
              <h2 id="craft-heading" className="sr-only">
                Case up a watch
              </h2>
              <CraftBench interactive={clock.canInteract} />
            </section>
          </div>

          <aside className="space-y-5">
            <section aria-labelledby="orders-heading">
              <SectionTitle hint="Orders wait for you. They never expire.">
                <span id="orders-heading">Orders</span>
              </SectionTitle>
              <div className="grid gap-3">
                <OrderList compact />
              </div>
            </section>

            <section aria-labelledby="progress-heading">
              <SectionTitle>
                <span id="progress-heading">Workshop</span>
              </SectionTitle>
              <div className="grid grid-cols-2 gap-3">
                <Stat label="Workshop progress" value={save.stats.workshopProgress} />
                <Stat label="Cosmetic tokens" value={save.stats.cosmeticTokens} />
              </div>
              <div className="mt-3">
                <WorkshopScene />
              </div>
            </section>
          </aside>
        </div>
      </div>
    </AppShell>
  );
}
