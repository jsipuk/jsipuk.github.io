'use client';

import { useEffect, useState } from 'react';
import {
  generatorsEnabled,
  graceRemaining,
  interactionsEnabled,
  sessionPhase,
  shouldShowTwoMinuteNotice,
  timeRemaining,
  type SessionPhase,
} from '@/game/sessionEngine';
import { useGameStore } from '@/state/gameStore';

export interface SessionClock {
  active: boolean;
  phase: SessionPhase;
  remainingMs: number;
  graceMs: number;
  canUseGenerators: boolean;
  canInteract: boolean;
}

/**
 * Drives the visible countdown. Ticks once a second — no faster, so the clock
 * stays calm — and closes the session itself when the grace window runs out.
 */
export function useSessionClock(): SessionClock {
  const activeSession = useGameStore((state) => state.save.activeSession);
  const markTwoMinuteNotice = useGameStore((state) => state.markTwoMinuteNotice);
  const endSession = useGameStore((state) => state.endSession);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!activeSession) return;
    setNow(Date.now());
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [activeSession]);

  useEffect(() => {
    if (!activeSession) return;
    if (shouldShowTwoMinuteNotice(activeSession, now)) {
      markTwoMinuteNotice();
    }
    if (sessionPhase(activeSession, now) === 'ended') {
      endSession('timer');
    }
  }, [activeSession, now, markTwoMinuteNotice, endSession]);

  if (!activeSession) {
    return {
      active: false,
      phase: 'idle',
      remainingMs: 0,
      graceMs: 0,
      canUseGenerators: false,
      canInteract: false,
    };
  }

  return {
    active: true,
    phase: sessionPhase(activeSession, now),
    remainingMs: timeRemaining(activeSession, now),
    graceMs: graceRemaining(activeSession, now),
    canUseGenerators: generatorsEnabled(activeSession, now),
    canInteract: interactionsEnabled(activeSession, now),
  };
}
