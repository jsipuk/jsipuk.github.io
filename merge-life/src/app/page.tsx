'use client';

import Link from 'next/link';
import { ROOMS } from '@/data/rooms';
import { WATCH_ARCHETYPES } from '@/data/watchArchetypes';
import { RoomPreview } from '@/components/workshop/RoomPreview';
import { SessionSetup } from '@/components/sessions/SessionSetup';
import { OrderList } from '@/components/orders/OrderList';
import { Button, Card, LinkButton, ProgressBar, SectionTitle, Stat } from '@/components/ui';
import { dailyLimitState, playTimeToday, timeReclaimedThisWeek } from '@/game/sessionEngine';
import { useGameStore } from '@/state/gameStore';
import { countItems } from '@/game/mergeEngine';
import { formatDuration } from '@/utils/time';

export default function HomePage() {
  const status = useGameStore((state) => state.status);
  const save = useGameStore((state) => state.save);
  const returningPlayer = useGameStore((state) => state.returningPlayer);
  const replaceOrders = useGameStore((state) => state.replaceOrders);

  if (status !== 'ready') {
    return (
      <main className="flex min-h-screen items-center justify-center px-6">
        <p className="text-ink-soft">Opening your workshop…</p>
      </main>
    );
  }

  const limit = dailyLimitState(save);
  const today = playTimeToday(save.sessions);
  const reclaimed = timeReclaimedThisWeek(save.sessions, save.settings);
  const itemsOnBoard = countItems(save.board);
  const archetypesBuilt = new Set(save.collection.map((entry) => entry.archetypeId)).size;

  return (
    <div className="min-h-screen px-4 pb-24 pt-[max(1.5rem,env(safe-area-inset-top))] sm:px-6">
      <main id="main" className="mx-auto max-w-5xl space-y-7">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="ml-label">Merge Life</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
              My Life Workshop
            </h1>
            <p className="mt-2 max-w-prose text-ink-soft">
              {returningPlayer
                ? 'Welcome back. Everything is exactly where you left it.'
                : 'A quiet place to build watches, one short session at a time.'}
            </p>
          </div>
          <Link href="/settings" className="ml-button-secondary">
            Settings
          </Link>
        </header>

        <section aria-labelledby="session-heading" className="space-y-3">
          <h2 id="session-heading" className="sr-only">
            Start a session
          </h2>
          <SessionSetup hasBoard={itemsOnBoard > 0} />
        </section>

        <section aria-labelledby="today-heading">
          <SectionTitle hint="Nothing here counts down or expires.">
            <span id="today-heading">Today</span>
          </SectionTitle>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Play time today" value={formatDuration(today, { short: true })} />
            <Stat label="Sessions used today" value={`${limit.used} of ${limit.limit}`} />
            <Stat
              label="Time reclaimed this week"
              value={formatDuration(reclaimed, { short: true })}
              hint="Against your baseline"
            />
            <Stat label="Items on the bench" value={itemsOnBoard} />
          </div>
        </section>

        <section aria-labelledby="watch-heading">
          <SectionTitle
            hint="Your board, generators and orders are saved exactly as you left them."
            action={
              <LinkButton href="/workshop" variant="primary">
                {itemsOnBoard > 0 ? 'Continue where you left off' : 'Open Watch Workshop'}
              </LinkButton>
            }
          >
            <span id="watch-heading">Continue Watch Workshop</span>
          </SectionTitle>

          <Card>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <ProgressBar
                  label="Watch collection"
                  value={archetypesBuilt}
                  max={WATCH_ARCHETYPES.length}
                  valueText={`${archetypesBuilt} of ${WATCH_ARCHETYPES.length} archetypes`}
                />
                <p className="mt-2 text-sm text-ink-soft">
                  {save.collection.length} watch{save.collection.length === 1 ? '' : 'es'} built in
                  total. They stay in your collection permanently.
                </p>
              </div>
              <div className="flex flex-wrap items-end gap-2 sm:justify-end">
                <LinkButton href="/collection" variant="secondary">
                  Watch collection
                </LinkButton>
                <LinkButton href="/wellbeing" variant="secondary">
                  Wellbeing
                </LinkButton>
              </div>
            </div>
          </Card>
        </section>

        <section aria-labelledby="orders-heading">
          <SectionTitle
            hint={
              save.activeSession
                ? 'Orders stay put during a session.'
                : 'Orders wait for you. Swap them now if you fancy something else.'
            }
            action={
              !save.activeSession && save.activeOrders.length > 0 ? (
                <Button variant="secondary" onClick={replaceOrders}>
                  Replace orders
                </Button>
              ) : null
            }
          >
            <span id="orders-heading">Orders</span>
          </SectionTitle>
          <OrderList />
        </section>

        <section aria-labelledby="rooms-heading">
          <SectionTitle hint="More rooms are designed and will open when they are genuinely good.">
            <span id="rooms-heading">Rooms</span>
          </SectionTitle>
          <ul className="grid gap-4 sm:grid-cols-2">
            {ROOMS.map((room) => (
              <li key={room.id}>
                <RoomPreview room={room} />
              </li>
            ))}
          </ul>
        </section>

        <p className="pb-6 text-center text-sm text-ink-faint">
          No streaks, no daily rewards, no adverts. Taking days off does not reduce your progress.
        </p>
      </main>
    </div>
  );
}
