import Phaser from 'phaser';
import './style.css';
import { createSfx } from './audio.ts';
import { createHud, formatSeconds, presetLabel } from './hud.ts';
import { createInput } from './input.ts';
import type { SteeringPreset } from './rules/controls.ts';
import { PRESETS } from './rules/controls.ts';
import { buildM0Map } from './rules/map.ts';
import type { GameEvent, Session } from './rules/session.ts';
import { createSession, interact, pause, resume, snapshot } from './rules/session.ts';
import { StreetScene } from './scene.ts';
import {
  appendLap,
  clearLaps,
  loadLaps,
  loadSettings,
  saveSettings,
  systemPrefersReducedMotion,
} from './settings.ts';

const BUILD = __BUILD_ID__;
const dpr = Math.min(window.devicePixelRatio || 1, 2);
const map = buildM0Map();
const settings = loadSettings();
let session: Session = createSession(map, settings.preset);
pause(session); // Start behind the title sheet; audio unlocks on the Start tap.

let touch = (() => {
  try {
    return window.matchMedia('(pointer: coarse)').matches;
  } catch {
    return false;
  }
})();
const reduceMotion = () => settings.reduceMotion ?? systemPrefersReducedMotion();

const sfx = createSfx();
sfx.setMuted(settings.muted);
const hud = createHud();
let scene: StreetScene | null = null;
const PALETTE_AMBER = '#ffb347';

function handleEvents(events: GameEvent[]): void {
  for (const e of events) {
    switch (e.type) {
      case 'enter':
      case 'exit':
        sfx.door();
        break;
      case 'bump':
        sfx.bump(e.strength);
        scene?.pop('bump', e.at);
        break;
      case 'parked':
        sfx.chime();
        scene?.pop(`Parked · ${formatSeconds(e.lapSeconds)}`, session.van, PALETTE_AMBER);
        break;
      case 'logged': {
        // A plain DOM hook for test harnesses; the game itself sends nothing anywhere.
        window.dispatchEvent(new CustomEvent('lowbridge:lap', { detail: { ...e.record, build: BUILD } }));
        const laps = appendLap(e.record, BUILD);
        hud.renderLaps(laps);
        const bumps = e.record.bumps === 0 ? 'no bumps' : `${e.record.bumps} bump${e.record.bumps === 1 ? '' : 's'}`;
        hud.toast(
          `Lap logged: ${presetLabel(e.record.preset)}, ${formatSeconds(e.record.lapSeconds)}, ${bumps}. Pause to switch steering.`,
          7,
        );
        break;
      }
      default:
        break;
    }
  }
}
function openPause(): void {
  input.clear();
  if (session.mode === 'paused') return;
  pause(session);
  hud.showSheet('pause');
}

function closeSheet(): void {
  input.clear();
  sfx.unlock();
  resume(session);
  scene?.resetTime();
  hud.hideSheet();
}

function setPreset(preset: SteeringPreset, announce: boolean): void {
  settings.preset = preset;
  session.preset = preset;
  saveSettings(settings);
  hud.syncSettings(settings);
  if (announce) hud.toast(`Steering ${PRESETS[preset].letter}: ${PRESETS[preset].name}`, 2.5);
}

function setMuted(muted: boolean): void {
  settings.muted = muted;
  sfx.setMuted(muted);
  saveSettings(settings);
  hud.syncSettings(settings);
}

const input = createInput({
  onInteract: () => handleEvents(interact(session)),
  onPauseToggle: () => (session.mode === 'paused' ? closeSheet() : openPause()),
  onPreset: (p) => setPreset(p, true),
  onMuteToggle: () => {
    setMuted(!settings.muted);
    hud.toast(settings.muted ? 'Sound off' : 'Sound on', 2);
  },
  onGesture: () => sfx.unlock(),
  onTouchSeen: () => (touch = true),
  worldKeysActive: () => session.mode !== 'paused',
});

// ------------------------------------------------------------ sheet wiring
const byId = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
byId('resume-btn').addEventListener('click', closeSheet);
byId('dlg-close').addEventListener('click', () => handleEvents(interact(session)));
for (const radio of document.querySelectorAll<HTMLInputElement>('input[name="preset"]')) {
  radio.addEventListener('change', () => radio.checked && setPreset(radio.value as SteeringPreset, false));
}
const muteBox = byId<HTMLInputElement>('mute');
muteBox.addEventListener('change', () => setMuted(muteBox.checked));
const motionBox = byId<HTMLInputElement>('reduce-motion');
motionBox.checked = reduceMotion();
motionBox.addEventListener('change', () => {
  settings.reduceMotion = motionBox.checked;
  saveSettings(settings);
});
byId('restart-btn').addEventListener('click', () => {
  session = createSession(map, settings.preset);
  closeSheet();
  hud.toast('Test restarted from the depot', 2.5);
});
byId('clear-log-btn').addEventListener('click', () => {
  clearLaps();
  hud.renderLaps([]);
});
byId('build-id').textContent = BUILD;
hud.syncSettings(settings);
hud.renderLaps(loadLaps());
hud.showSheet('start');

// --------------------------------------------------------- interruptions
// Any interruption drops held controls; leaving the page also pauses, so
// the van waits for a fresh press when the player comes back.
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    openPause();
    sfx.suspend();
  }
});
window.addEventListener('blur', openPause);
window.addEventListener('pagehide', openPause);
try {
  window.matchMedia('(orientation: portrait)').addEventListener('change', () => input.clear());
} catch {
  // Older engines: resize below still keeps the canvas right.
}

// ------------------------------------------------------------------ game
const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#081012',
  width: Math.round(window.innerWidth * dpr),
  height: Math.round(window.innerHeight * dpr),
  scale: { mode: Phaser.Scale.NONE },
  input: { keyboard: false, mouse: false, touch: false, gamepad: false },
  audio: { noAudio: true },
  banner: false,
  disableContextMenu: true,
});

game.scene.add('street', StreetScene, true, {
  session: () => session,
  input,
  hud,
  dpr,
  reduceMotion,
  touch: () => touch,
  onEvents: handleEvents,
  onReady: (ready: StreetScene) => (scene = ready),
  onFrame: (focus: { x: number; y: number }) => {
    const ph = session.map.phone;
    sfx.updateRing(session.phoneRinging && session.mode === 'world', Math.hypot(ph.x - focus.x, ph.y - focus.y));
  },
});

window.addEventListener('resize', () => {
  game.scale.resize(Math.round(window.innerWidth * dpr), Math.round(window.innerHeight * dpr));
});

// Read-only hook so a coding agent can check state while driving with the keyboard.
Object.defineProperty(window, 'lowbridge', {
  value: Object.freeze({ build: BUILD, snapshot: () => snapshot(session) }),
});
