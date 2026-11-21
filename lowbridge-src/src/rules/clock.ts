// Fixed simulation step with a capped catch-up, so a long frame or a return
// from the background never becomes one giant step.

export const STEP_SECONDS = 1 / 60;
export const MAX_FRAME_SECONDS = 0.1;
export const MAX_STEPS_PER_FRAME = 6;

export interface FixedClock {
  acc: number;
}

export const createClock = (): FixedClock => ({ acc: 0 });

/** Feed one rendered frame; returns how many fixed steps to simulate. */
export function framesToSteps(clock: FixedClock, frameSeconds: number): number {
  const dt = Math.min(Math.max(frameSeconds, 0), MAX_FRAME_SECONDS);
  clock.acc += dt;
  let steps = 0;
  while (clock.acc >= STEP_SECONDS && steps < MAX_STEPS_PER_FRAME) {
    clock.acc -= STEP_SECONDS;
    steps++;
  }
  if (steps === MAX_STEPS_PER_FRAME) clock.acc = 0;
  return steps;
}

/** Drop accumulated time, e.g. on resume, so time spent away is never simulated. */
export function resetClock(clock: FixedClock): void {
  clock.acc = 0;
}
