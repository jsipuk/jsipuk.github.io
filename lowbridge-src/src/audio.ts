// Small synthesised sounds. The context starts only after a user gesture.

export interface Sfx {
  unlock(): void;
  setMuted(muted: boolean): void;
  /** Call every frame. Rings a UK-style double burst every three seconds while active. */
  updateRing(active: boolean, distancePx: number): void;
  bump(strength: number): void;
  door(): void;
  chime(): void;
  /** Two-tone wail while the patrol is chasing; quieter with distance. */
  updateSiren(active: boolean, distancePx: number): void;
  horn(): void;
  /** The van's own short horn. */
  honk(): void;
  /** Wings: busier for a bigger flock. */
  flutter(count: number): void;
  shopBell(): void;
  radio(): void;
  rumble(): void;
  /** Three short rings, as the Reedlings answer the lamp. */
  ringOnce(): void;
  suspend(): void;
}

export function createSfx(): Sfx {
  let ctx: AudioContext | null = null;
  let master: GainNode | null = null;
  let muted = false;
  let nextRing = 0;
  let nextSiren = 0;

  const ready = () => (ctx && master && !muted && ctx.state === 'running' ? { ctx, master } : null);

  function tone(freq: number, start: number, dur: number, gain: number, type: OscillatorType = 'sine') {
    const a = ready();
    if (!a) return;
    const osc = a.ctx.createOscillator();
    const g = a.ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0, start);
    g.gain.linearRampToValueAtTime(gain, start + 0.01);
    g.gain.setValueAtTime(gain, start + dur - 0.03);
    g.gain.linearRampToValueAtTime(0, start + dur);
    osc.connect(g).connect(a.master);
    osc.start(start);
    osc.stop(start + dur + 0.02);
  }

  return {
    unlock() {
      try {
        if (!ctx) {
          const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
          if (!Ctor) return;
          ctx = new Ctor();
          master = ctx.createGain();
          master.gain.value = 0.9;
          master.connect(ctx.destination);
        }
        if (ctx.state !== 'running') void ctx.resume();
      } catch {
        ctx = null;
      }
    },
    setMuted(m) {
      muted = m;
    },
    updateRing(active, distancePx) {
      const a = ready();
      if (!a || !active) {
        nextRing = 0;
        return;
      }
      const now = a.ctx.currentTime;
      if (now < nextRing) return;
      nextRing = now + 3;
      const level = Math.max(0.12, Math.min(1, 1 - distancePx / 420)) * 0.16;
      for (const offset of [0, 0.6]) {
        tone(400, now + offset, 0.4, level);
        tone(450, now + offset, 0.4, level);
      }
    },
    bump(strength) {
      const a = ready();
      if (!a) return;
      const now = a.ctx.currentTime;
      const level = Math.min(0.5, 0.15 + strength / 400);
      tone(70, now, 0.12, level, 'triangle');
      tone(140, now, 0.05, level * 0.5, 'square');
    },
    door() {
      const a = ready();
      if (!a) return;
      const now = a.ctx.currentTime;
      tone(220, now, 0.05, 0.12, 'square');
      tone(160, now + 0.06, 0.06, 0.1, 'square');
    },
    chime() {
      const a = ready();
      if (!a) return;
      const now = a.ctx.currentTime;
      tone(660, now, 0.15, 0.1);
      tone(880, now + 0.12, 0.22, 0.1);
    },
    updateSiren(active, distancePx) {
      const a = ready();
      if (!a || !active) {
        nextSiren = 0;
        return;
      }
      const now = a.ctx.currentTime;
      if (now < nextSiren) return;
      nextSiren = now + 1.2;
      const level = Math.max(0.03, Math.min(1, 1 - distancePx / 500)) * 0.07;
      tone(640, now, 0.6, level, 'triangle');
      tone(820, now + 0.6, 0.6, level, 'triangle');
    },
    horn() {
      const a = ready();
      if (!a) return;
      const now = a.ctx.currentTime;
      tone(165, now, 1.3, 0.16, 'sawtooth');
      tone(220, now, 1.3, 0.08, 'sawtooth');
    },
    honk() {
      const a = ready();
      if (!a) return;
      const now = a.ctx.currentTime;
      tone(392, now, 0.22, 0.09, 'square');
      tone(494, now, 0.22, 0.06, 'square');
    },
    flutter(count) {
      const a = ready();
      if (!a) return;
      const now = a.ctx.currentTime;
      const n = Math.min(10, 3 + count);
      for (let i = 0; i < n; i++) tone(1800 + ((i * 337) % 900), now + i * 0.035, 0.03, 0.025, 'square');
    },
    shopBell() {
      const a = ready();
      if (!a) return;
      const now = a.ctx.currentTime;
      tone(1568, now, 0.5, 0.05);
      tone(2093, now + 0.12, 0.6, 0.04);
    },
    radio() {
      const a = ready();
      if (!a) return;
      const now = a.ctx.currentTime;
      tone(1200, now, 0.06, 0.05, 'square');
      tone(900, now + 0.08, 0.06, 0.05, 'square');
    },
    rumble() {
      const a = ready();
      if (!a) return;
      const now = a.ctx.currentTime;
      for (let i = 0; i < 6; i++) tone(90 + i * 6, now + i * 0.15, 0.14, 0.12, 'square');
    },
    ringOnce() {
      const a = ready();
      if (!a) return;
      const now = a.ctx.currentTime;
      for (let i = 0; i < 3; i++) {
        tone(880 - i * 60, now + i * 0.45, 0.25, 0.08);
        tone(1320 - i * 90, now + i * 0.45, 0.25, 0.04);
      }
    },
    suspend() {
      nextRing = 0;
      nextSiren = 0;
      if (ctx && ctx.state === 'running') void ctx.suspend();
    },
  };
}
