'use client';

import { useEffect } from 'react';
import { useAutosave } from '@/hooks/useAutosave';
import { useGameStore } from '@/state/gameStore';
import { ToastStack } from '@/components/ui/ToastStack';

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

function useSettingsAttributes() {
  const reducedMotion = useGameStore((state) => state.save.settings.reducedMotion);
  const highContrast = useGameStore((state) => state.save.settings.highContrast);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.motion = reducedMotion ? 'reduced' : 'full';
    root.dataset.contrast = highContrast ? 'high' : 'normal';
  }, [reducedMotion, highContrast]);
}

function useServiceWorker() {
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    if (process.env.NODE_ENV !== 'production') return;
    const register = () => {
      navigator.serviceWorker.register(`${basePath}/sw.js`).catch(() => {
        // Offline support is an enhancement; failing to register is not fatal.
      });
    };

    // React usually mounts after `load` has already fired, so waiting for the
    // event alone would mean the worker is never registered.
    if (document.readyState === 'complete') {
      register();
      return;
    }
    window.addEventListener('load', register);
    return () => window.removeEventListener('load', register);
  }, []);
}

export function AppProviders({ children }: { children: React.ReactNode }) {
  const hydrate = useGameStore((state) => state.hydrate);
  const status = useGameStore((state) => state.status);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  useSettingsAttributes();
  useServiceWorker();
  useAutosave();

  return (
    <>
      <div aria-busy={status !== 'ready'}>{children}</div>
      <ToastStack />
    </>
  );
}
