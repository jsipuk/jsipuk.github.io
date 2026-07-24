'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useGameStore } from '@/state/gameStore';

export type FeedbackKind = 'merge' | 'create' | 'complete' | 'gentle';

/** Short, soft tones generated with the Web Audio API — no audio files, no music. */
const TONES: Record<FeedbackKind, { frequency: number; duration: number; gain: number }> = {
  merge: { frequency: 528, duration: 0.16, gain: 0.05 },
  create: { frequency: 396, duration: 0.12, gain: 0.04 },
  complete: { frequency: 660, duration: 0.24, gain: 0.05 },
  gentle: { frequency: 294, duration: 0.14, gain: 0.03 },
};

const VIBRATIONS: Record<FeedbackKind, number | number[]> = {
  merge: 12,
  create: 8,
  complete: [10, 40, 12],
  gentle: 6,
};

/**
 * Optional sound and haptics. Sound is off by default and only ever plays in
 * response to something the player did.
 */
export function useFeedback() {
  const soundEnabled = useGameStore((state) => state.save.settings.soundEnabled);
  const hapticsEnabled = useGameStore((state) => state.save.settings.hapticsEnabled);
  const contextRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    return () => {
      void contextRef.current?.close();
      contextRef.current = null;
    };
  }, []);

  return useCallback(
    (kind: FeedbackKind) => {
      if (hapticsEnabled && typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate?.(VIBRATIONS[kind]);
      }
      if (!soundEnabled || typeof window === 'undefined') return;

      const AudioCtor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtor) return;

      try {
        if (!contextRef.current) contextRef.current = new AudioCtor();
        const context = contextRef.current;
        if (context.state === 'suspended') void context.resume();

        const tone = TONES[kind];
        const oscillator = context.createOscillator();
        const gain = context.createGain();

        oscillator.type = 'sine';
        oscillator.frequency.value = tone.frequency;
        gain.gain.setValueAtTime(0.0001, context.currentTime);
        gain.gain.exponentialRampToValueAtTime(tone.gain, context.currentTime + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + tone.duration);

        oscillator.connect(gain).connect(context.destination);
        oscillator.start();
        oscillator.stop(context.currentTime + tone.duration + 0.02);
      } catch {
        // Audio is a nicety; never let it break play.
      }
    },
    [soundEnabled, hapticsEnabled],
  );
}
