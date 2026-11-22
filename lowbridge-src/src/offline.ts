// Offline play: a service worker scoped to /lowbridge/ caches this build's
// files under a lowbridge- cache name. "Available offline" shows only after
// the worker reports every file cached. A new build installs alongside and
// waits; the player restarts into it from the pause screen.

export interface OfflineState {
  supported: boolean;
  ready: boolean;
  updateReady: boolean;
  missing?: number;
}

export interface Offline {
  /** Switch to the waiting build and reload. Call at a saved boundary. */
  applyUpdate(): void;
}

export function startOffline(onChange: (s: OfflineState) => void): Offline {
  let reg: ServiceWorkerRegistration | null = null;
  const state: OfflineState = { supported: false, ready: false, updateReady: false };
  const emit = () => onChange({ ...state });

  const ok = import.meta.env.PROD && 'serviceWorker' in navigator && window.isSecureContext;
  if (!ok) {
    emit();
    return { applyUpdate() {} };
  }
  const sw = navigator.serviceWorker;
  sw.addEventListener('message', (e) => {
    if (e.data?.type !== 'status') return;
    state.ready = !!e.data.ready && !!sw.controller;
    state.missing = e.data.missing;
    emit();
  });
  const check = () => sw.controller?.postMessage({ type: 'status' });

  sw.register('./sw.js', { scope: './' })
    .then((r) => {
      reg = r;
      state.supported = true;
      if (r.waiting && sw.controller) state.updateReady = true;
      emit();
      r.addEventListener('updatefound', () => {
        const w = r.installing;
        w?.addEventListener('statechange', () => {
          if (w.state === 'installed' && sw.controller) {
            state.updateReady = true;
            emit();
          }
          if (w.state === 'activated') check();
        });
      });
      void sw.ready.then(() => window.setTimeout(check, 300));
      sw.addEventListener('controllerchange', check);
    })
    .catch(() => {
      state.supported = false;
      emit();
    });

  return {
    applyUpdate() {
      const waiting = reg?.waiting;
      if (!waiting) return;
      sw.addEventListener('controllerchange', () => window.location.reload(), { once: true });
      waiting.postMessage({ type: 'skipWaiting' });
    },
  };
}
