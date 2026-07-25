'use client';

import { useEffect, useState } from 'react';
import { useGameStore } from '@/state/gameStore';

/** True when either the system or the in-game setting asks for less motion. */
export function useReducedMotion(): boolean {
  const setting = useGameStore((state) => state.save.settings.reducedMotion);
  const [systemPreference, setSystemPreference] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    setSystemPreference(query.matches);
    const listener = (event: MediaQueryListEvent) => setSystemPreference(event.matches);
    query.addEventListener?.('change', listener);
    return () => query.removeEventListener?.('change', listener);
  }, []);

  return setting || systemPreference;
}
