// Turns raw thumb and key state into semantic movement for the current preset.
//
// Preset A, "pad": push a thumb pad towards a screen direction; the van steers
// to face it and drives. Let go and it rolls to a stop. Brake/Reverse is a
// separate control; while it is held the pad aims the rear of the van.
// Preset B, "wheel": left/right steer, Go is the throttle, let go to slow.
// Brake/Reverse is the same separate control.
// Walking always uses the screen-relative pad in both presets.

import type { Vec } from './math.ts';
import { angleDiff, clamp } from './math.ts';
import type { VehicleControls } from './vehicle.ts';

export type SteeringPreset = 'pad' | 'wheel';

export const PRESETS: Record<SteeringPreset, { letter: string; name: string; summary: string }> = {
  pad: {
    letter: 'A',
    name: 'Thumb pad',
    summary: 'Push towards where you want to go. Let go to stop.',
  },
  wheel: {
    letter: 'B',
    name: 'Wheel and pedals',
    summary: 'Left and right steer. Hold Go. Let go to slow down.',
  },
};

export interface RawInput {
  /** Screen-relative direction from the touch pad or direction keys, magnitude 0..1. */
  padX: number;
  padY: number;
  /** -1 left, 1 right, from steering buttons or left/right keys. */
  wheelSteer: number;
  /** 0..1 from the Go button or the up key. */
  wheelThrottle: number;
  /** Brake/Reverse button or Space. */
  brake: boolean;
  /** Down key. Brakes in the wheel preset; points the pad down in the pad preset. */
  keyDown: boolean;
}

export const NO_INPUT: RawInput = {
  padX: 0,
  padY: 0,
  wheelSteer: 0,
  wheelThrottle: 0,
  brake: false,
  keyDown: false,
};

export const PAD_DEADZONE = 0.18;

/** Pad vector with the dead zone removed and the remainder rescaled to 0..1. */
export function padVector(raw: RawInput): Vec {
  const mag = Math.hypot(raw.padX, raw.padY);
  if (mag < PAD_DEADZONE) return { x: 0, y: 0 };
  const scaled = Math.min(1, (mag - PAD_DEADZONE) / (1 - PAD_DEADZONE));
  return { x: (raw.padX / mag) * scaled, y: (raw.padY / mag) * scaled };
}

export const walkVector = (raw: RawInput): Vec => padVector(raw);

/** Angle error (radians) that gives full steering lock in the pad preset. */
const PAD_FULL_LOCK = 0.45;

export function vehicleControls(raw: RawInput, preset: SteeringPreset, heading: number): VehicleControls {
  if (preset === 'wheel') {
    return {
      throttle: clamp(raw.wheelThrottle, 0, 1),
      steer: clamp(raw.wheelSteer, -1, 1),
      brake: raw.brake || raw.keyDown,
    };
  }

  const pad = padVector(raw);
  const mag = Math.hypot(pad.x, pad.y);
  if (mag === 0) return { throttle: 0, steer: 0, brake: raw.brake };
  const target = Math.atan2(pad.y, pad.x);

  if (raw.brake) {
    // Reversing: swing the rear towards the pushed direction.
    const diff = angleDiff(target, heading + Math.PI);
    return { throttle: 0, steer: clamp(-diff / PAD_FULL_LOCK, -1, 1), brake: true };
  }

  const diff = angleDiff(target, heading);
  const off = Math.abs(diff);
  // Ease off while swinging round so a sharp push turns rather than overshoots.
  const ease = off > 2.3 ? 0.55 : off > 1.2 ? 0.75 : 1;
  return { throttle: mag * ease, steer: clamp(diff / PAD_FULL_LOCK, -1, 1), brake: false };
}
