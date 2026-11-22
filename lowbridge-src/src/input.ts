// Keyboard and touch both become one RawInput snapshot. Held state is dropped
// on any interruption, and a key still physically held afterwards must be
// pressed again before it counts.

import type { RawInput, SteeringPreset } from './rules/controls.ts';
import { clamp } from './rules/math.ts';

export interface InputHandlers {
  onInteract(): void;
  onPauseToggle(): void;
  onPreset(preset: SteeringPreset): void;
  onMuteToggle(): void;
  /** Any press: used to unlock audio. */
  onGesture(): void;
  onTouchSeen(): void;
  /** False while the pause sheet is open, so its form controls get the keys. */
  worldKeysActive(): boolean;
}

export interface Input {
  read(): RawInput;
  clear(): void;
}

const KEYS = {
  up: ['ArrowUp', 'KeyW'],
  down: ['ArrowDown', 'KeyS'],
  left: ['ArrowLeft', 'KeyA'],
  right: ['ArrowRight', 'KeyD'],
  brake: ['Space'],
  go: ['ShiftLeft', 'ShiftRight'],
};
const HELD_KEYS = new Set(Object.values(KEYS).flat());
const PAD_TRAVEL = 52;

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

export function createInput(h: InputHandlers): Input {
  const held = new Set<string>();
  const any = (codes: string[]) => codes.some((c) => held.has(c));

  // ---------------------------------------------------------- keyboard
  window.addEventListener('keydown', (e) => {
    h.onGesture();
    const target = e.target as HTMLElement | null;
    const onControl = !!target?.closest?.('.sheet, .dialogue');
    if (e.code === 'Escape' || e.code === 'KeyP') {
      e.preventDefault();
      if (!e.repeat) h.onPauseToggle();
      return;
    }
    if (!h.worldKeysActive()) return;
    // A focused prompt button handles Enter, Space, Tab and arrows itself; E still acts.
    if (onControl && (e.code === 'Enter' || e.code === 'Space' || e.code === 'Tab' || e.code.startsWith('Arrow'))) return;
    if (HELD_KEYS.has(e.code)) {
      e.preventDefault();
      // A repeat for a key we are not tracking means it was held through an interruption.
      if (e.repeat && !held.has(e.code)) return;
      held.add(e.code);
      return;
    }
    if (e.repeat) return;
    if (e.code === 'KeyE' || e.code === 'Enter') {
      e.preventDefault();
      h.onInteract();
    } else if (e.code === 'Digit1') h.onPreset('pad');
    else if (e.code === 'Digit3') h.onPreset('hybrid');
    else if (e.code === 'KeyM') h.onMuteToggle();
  });
  window.addEventListener('keyup', (e) => {
    held.delete(e.code);
  });

  // ------------------------------------------------------------- touch
  window.addEventListener(
    'pointerdown',
    (e) => {
      h.onGesture();
      if (e.pointerType === 'touch') h.onTouchSeen();
    },
    { capture: true, passive: true },
  );

  const zone = $('pad-zone');
  const base = $('pad-base');
  const knob = $('pad-knob');
  let padPointer: number | null = null;
  let origin = { x: 0, y: 0 };
  let pad = { x: 0, y: 0 };

  const resetPad = () => {
    padPointer = null;
    pad = { x: 0, y: 0 };
    base.style.transform = '';
    knob.style.transform = '';
    base.classList.remove('active');
  };
  const movePad = (e: PointerEvent) => {
    const dx = e.clientX - origin.x;
    const dy = e.clientY - origin.y;
    const len = Math.hypot(dx, dy);
    const k = len > PAD_TRAVEL ? PAD_TRAVEL / len : 1;
    knob.style.transform = `translate(${dx * k}px, ${dy * k}px)`;
    pad = { x: (dx * k) / PAD_TRAVEL, y: (dy * k) / PAD_TRAVEL };
  };
  zone.addEventListener('pointerdown', (e) => {
    if (padPointer !== null) return;
    e.preventDefault();
    padPointer = e.pointerId;
    zone.setPointerCapture(e.pointerId);
    // The pad re-centres under the thumb, kept inside its zone.
    const zr = zone.getBoundingClientRect();
    const br = base.getBoundingClientRect();
    const half = br.width / 2;
    const cx = clamp(e.clientX, zr.left + half, zr.right - half);
    const cy = clamp(e.clientY, zr.top + half, zr.bottom - half);
    base.style.transform = `translate(${cx - (br.left + half)}px, ${cy - (br.top + half)}px)`;
    base.classList.add('active');
    origin = { x: cx, y: cy };
    movePad(e);
  });
  zone.addEventListener('pointermove', (e) => {
    if (e.pointerId === padPointer) movePad(e);
  });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture'] as const) {
    zone.addEventListener(type, (e) => {
      if (e.pointerId === padPointer) resetPad();
    });
  }

  const holdButton = (el: HTMLElement) => {
    const pointers = new Set<number>();
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      el.setPointerCapture(e.pointerId);
      pointers.add(e.pointerId);
      el.classList.add('pressed');
    });
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture'] as const) {
      el.addEventListener(type, (e) => {
        pointers.delete(e.pointerId);
        el.classList.toggle('pressed', pointers.size > 0);
      });
    }
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    return {
      held: () => pointers.size > 0,
      clear: () => {
        pointers.clear();
        el.classList.remove('pressed');
      },
    };
  };
  const go = holdButton($('go-btn'));
  const brake = holdButton($('brake-btn'));

  const tapButton = (el: HTMLElement, fn: () => void) => {
    let lastPointerTap = 0;
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      el.setPointerCapture(e.pointerId);
      el.classList.add('pressed');
    });
    el.addEventListener('pointerup', (e) => {
      el.classList.remove('pressed');
      const r = el.getBoundingClientRect();
      if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) {
        lastPointerTap = performance.now();
        fn();
      }
    });
    el.addEventListener('pointercancel', () => el.classList.remove('pressed'));
    // Screen readers and switch access arrive as plain clicks.
    el.addEventListener('click', () => {
      if (performance.now() - lastPointerTap > 700) fn();
    });
  };
  tapButton($('act-btn'), () => h.onInteract());
  tapButton($('pause-btn'), () => h.onPauseToggle());

  return {
    read(): RawInput {
      let padX = pad.x;
      let padY = pad.y;
      if (padPointer === null) {
        const kx = Number(any(KEYS.right)) - Number(any(KEYS.left));
        const ky = Number(any(KEYS.down)) - Number(any(KEYS.up));
        const len = Math.hypot(kx, ky);
        padX = len ? kx / len : 0;
        padY = len ? ky / len : 0;
      }
      return {
        padX,
        padY,
        goButton: go.held() || any(KEYS.go) ? 1 : 0,
        brake: brake.held() || any(KEYS.brake),
      };
    },
    clear() {
      held.clear();
      resetPad();
      go.clear();
      brake.clear();
    },
  };
}
