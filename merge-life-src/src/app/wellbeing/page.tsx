'use client';

import { WellbeingDashboard } from '@/components/wellbeing/WellbeingDashboard';
import { AppShell } from '@/components/ui/AppShell';
import { useGameStore } from '@/state/gameStore';

export default function WellbeingPage() {
  const status = useGameStore((state) => state.status);

  return (
    <AppShell
      title="Wellbeing"
      subtitle="An honest picture of how much you have played, kept on this device."
      backHref="/"
      backLabel="My Life Workshop"
    >
      {status === 'ready' ? (
        <WellbeingDashboard />
      ) : (
        <p className="text-ink-soft">Adding up your sessions…</p>
      )}
    </AppShell>
  );
}
