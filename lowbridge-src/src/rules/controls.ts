// Turns raw thumb and key state into semantic movement for the current preset.
//
// Preset A, "pad": the van moves towards the thumb. Push ahead or to the side
// and it steers to face that way and drives. Pull back (well behind where it
// faces) and it brakes, then reverses with its rear swinging towards the thumb.
// Let go and it rolls to a stop. Brake/Reverse is also a separate button.
// Preset B, "wheel": left/right steer, Go is the throttle, let go to slow.
// Brake/Reverse is the same separate control.
// Preset C, "hybrid": the pad on the left always says which way the front of
// the van should point, going forwards or backwards. Go only drives forwards;
// Brake/Reverse is the only way back, and reverses straight with the pad idle.
// Walking always uses the screen-relative pad in both presets.

import type { Vec } from './math.ts';
import { angleDiff, clamp } from './math.ts';
import type { VehicleControls } from './vehicle.ts';

export type SteeringPreset = 'pad' | 'wheel' | 'hybrid';

export const PRESETS: Record<SteeringPreset, { letter: string; name: string; summary: string }> = {
  pad: {
    letter: 'A',
    name: 'Thumb pad',
    summary: 'Push where you want to go. Pull back to reverse. Let go to stop.',
  },
  wheel: {
    letter: 'B',
    name: 'Wheel and pedals',
    summary: 'Left and right steer. Hold Go. Let go to slow down.',
  },
  hybrid: {
    letter: 'C',
    name: 'Pad and pedals',
    summary: 'Point the pad where the front should face. Go drives forwards. Brake/Reverse backs up.',
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
  /** 0..1 from the Go button or Shift only; preset C keeps the arrow keys for pointing. */
  goButton: number;
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
  goButton: 0,
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
/** Pull the pad further than this from the van's facing (about 115°) and it backs up. */
export const PAD_REVERSE_START = 2.0;
/** Once reversing, it stays in reverse until the thumb is back within about 80°. */
export const PAD_REVERSE_HOLD = 1.4;

export function vehicleControls(
  raw: RawInput,
  preset: SteeringPreset,
  heading: number,
  speed = 0,
): VehicleControls {
  if (preset === 'wheel') {
    return {
      throttle: clamp(raw.wheelThrottle, 0, 1),
      steer: clamp(raw.wheelSteer, -1, 1),
      brake: raw.brake || raw.keyDown,
    };
  }
  if (preset === 'hybrid') return hybridControls(raw, heading, speed);

  const pad = padVector(raw);
  const mag = Math.hypot(pad.x, pad.y);
  const drive = mag;
  if (mag === 0) return { throttle: 0, steer: 0, brake: raw.brake };
  const target = Math.atan2(pad.y, pad.x);
  const diff = angleDiff(target, heading);
  const off = Math.abs(diff);
  const backwards = off > (speed < -2 ? PAD_REVERSE_HOLD : PAD_REVERSE_START);

  if ((backwards && drive > 0) || raw.brake) {
    // Still rolling forwards: brake first. Pulling back brakes in a straight line.
    if (speed > 4) return { throttle: 0, steer: backwards ? 0 : clamp(diff / PAD_FULL_LOCK, -1, 1), brake: true };
    // Stopped or reversing: back up, swinging the rear towards the thumb.
    const rear = angleDiff(target, heading + Math.PI);
    return { throttle: 0, steer: clamp(-rear / PAD_FULL_LOCK, -1, 1), brake: true };
  }

  // Ease off while swinging round so a sharp push turns rather than overshoots.
  const ease = off > 1.2 ? 0.75 : 1;
  return { throttle: drive * ease, steer: clamp(diff / PAD_FULL_LOCK, -1, 1), brake: false };
}

function hybridControls(raw: RawInput, heading: number, speed: number): VehicleControls {
  const pad = padVector(raw);
  const go = raw.goButton > 0;
  if (Math.hypot(pad.x, pad.y) === 0) return { throttle: go ? 1 : 0, steer: 0, brake: raw.brake };
  // Turn the front towards the thumb. Going backwards the same wheel angle turns
  // the nose the other way, so the steer flips to keep that promise.
  const nose = angleDiff(Math.atan2(pad.y, pad.x), heading);
  const backing = speed < -2 || (raw.brake && speed <= 4);
  const steer = clamp(((backing ? -1 : 1) * nose) / PAD_FULL_LOCK, -1, 1);
  if (raw.brake) return { throttle: 0, steer, brake: true };
  const off = Math.abs(nose);
  // Pointing behind with Go held swings the van round rather than reversing.
  const ease = off > 2.3 ? 0.55 : off > 1.2 ? 0.75 : 1;
  return { throttle: go ? ease : 0, steer, brake: false };
}
