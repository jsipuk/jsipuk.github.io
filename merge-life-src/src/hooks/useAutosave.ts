'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useGameStore } from '@/state/gameStore';

/**
 * Saves at every moment the player could lose work:
 * when the tab is hidden, when the page is being unloaded, and just before
 * navigating between screens. The store also autosaves after each action.
 */
export function useAutosave(): void {
  const flush = useGameStore((state) => state.flush);
  const status = useGameStore((state) => state.status);
  const pathname = usePathname();

  useEffect(() => {
    if (status !== 'ready') return;

    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') void flush();
    };
    const handlePageHide = () => {
      void flush();
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('pagehide', handlePageHide);
    window.addEventListener('beforeunload', handlePageHide);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('pagehide', handlePageHide);
      window.removeEventListener('beforeunload', handlePageHide);
      // Leaving this screen: persist before the next one mounts.
      void flush();
    };
  }, [flush, status, pathname]);
}
