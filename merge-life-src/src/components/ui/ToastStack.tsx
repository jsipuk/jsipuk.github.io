'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useGameStore } from '@/state/gameStore';
import { useReducedMotion } from '@/hooks/useReducedMotion';

/**
 * Quiet inline feedback. Toasts never block play, never demand a tap and never
 * carry a call to action.
 */
export function ToastStack() {
  const toasts = useGameStore((state) => state.toasts);
  const dismiss = useGameStore((state) => state.dismissToast);
  const reducedMotion = useReducedMotion();

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex flex-col items-center gap-2 px-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
      role="status"
      aria-live="polite"
    >
      <AnimatePresence initial={false}>
        {toasts.map((toast) => (
          <motion.button
            key={toast.id}
            type="button"
            onClick={() => dismiss(toast.id)}
            initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.98 }}
            animate={reducedMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
            exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
            transition={{ duration: reducedMotion ? 0.01 : 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="pointer-events-auto max-w-md rounded-pill border border-line bg-surface-raised px-4 py-2.5
              text-sm text-ink shadow-raised"
          >
            <span className="mr-2" aria-hidden="true">
              {toast.tone === 'success' ? '✦' : '·'}
            </span>
            {toast.message}
          </motion.button>
        ))}
      </AnimatePresence>
    </div>
  );
}
