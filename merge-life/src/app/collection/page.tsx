'use client';

import { WatchBox } from '@/components/collection/WatchBox';
import { AppShell } from '@/components/ui/AppShell';
import { useGameStore } from '@/state/gameStore';

export default function CollectionPage() {
  const status = useGameStore((state) => state.status);

  return (
    <AppShell
      title="Watch Collection"
      subtitle="Every watch you have finished stays here permanently, whatever happens on the bench."
      backHref="/"
      backLabel="My Life Workshop"
      wide
    >
      {status === 'ready' ? <WatchBox /> : <p className="text-ink-soft">Opening the watch box…</p>}
    </AppShell>
  );
}
