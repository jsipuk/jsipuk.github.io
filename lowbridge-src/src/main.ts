import Phaser from 'phaser';
import './style.css';
import { JACKETS } from './art.ts';
import { createSfx } from './audio.ts';
import type { SheetInfo } from './hud.ts';
import { createHud } from './hud.ts';
import { createInput } from './input.ts';
import type { SteeringPreset } from './rules/controls.ts';
import { PRESETS } from './rules/controls.ts';
import { buildRiverside } from './rules/map.ts';
import type { Progress } from './rules/progress.ts';
import { initialProgress, returnSummary } from './rules/progress.ts';
import type { Checkpoint, SaveEnvelope, SaveStore } from './rules/save.ts';
import { SCHEMA_VERSION, SaveController, checkImport, createIdbStore, createMemoryStore, exportSave } from './rules/save.ts';
import { startOffline } from './offline.ts';
import type { Commit, Session, WorldEvent } from './rules/session.ts';
import {
  checkpoint,
  choose,
  createSession,
  encounterChoose,
  interact,
  openBoard,
  pause,
  resume,
  settled,
  snapshot,
} from './rules/session.ts';
import { StreetScene } from './scene.ts';
import { loadSettings, saveSettings, systemPrefersReducedMotion } from './settings.ts';

const BUILD = __BUILD_ID__;
const params = new URLSearchParams(window.location.search);
const dpr = Math.min(window.devicePixelRatio || 1, 2);
const map = buildRiverside();
const settings = loadSettings();
const sfx = createSfx();
sfx.setMuted(settings.muted);

let touch = (() => {
  try {
    return window.matchMedia('(pointer: coarse)').matches;
  } catch {
    return false;
  }
})();
const reduceMotion = () => settings.reduceMotion ?? systemPrefersReducedMotion();

// ------------------------------------------------------------------ saving

function makeStore(): { store: SaveStore; note: string } {
  if (params.has('failsave')) {
    return { store: createMemoryStore({ failWrites: true }), note: 'Test mode: saving is switched off (?failsave).' };
  }
  try {
    if (window.indexedDB) return { store: createIdbStore(window.indexedDB), note: '' };
  } catch {
    // Fall through to memory.
  }
  return { store: createMemoryStore(), note: 'This browser can’t keep progress. It lasts until you close the page.' };
}

let { store, note: storageNote } = makeStore();
let saves = new SaveController(store);
let session: Session;
let scene: StreetScene | null = null;

const commit: Commit = async (progress) => {
  const ok = await saves.write(progress, checkpoint(session));
  updateSaveState();
  if (ok) return 'ok';
  return saves.status === 'failed' ? 'failed' : 'conflict';
};

function updateSaveState() {
  const failed = saves.status === 'failed';
  const text = failed ? 'progress hasn’t saved' : saves.status === 'saved' ? `saved (revision ${saves.revision})` : 'not saved yet';
  hud.setSaveState(storageNote ? `${text} · ${storageNote}` : text, failed);
}

function saveCheckpoint(): void {
  if (!session) return;
  void saves.writeCheckpoint(() => checkpoint(session)).then(updateSaveState);
}

// -------------------------------------------------------------------- HUD

const hud = createHud({
  onChoose: (id) => void choose(session, id),
  onEncounter: (action) => void encounterChoose(session, action),
  onRetrySave: () => {
    const retry = session.saveFailed?.retry;
    if (retry) void retry().then(updateSaveState);
    else saveCheckpoint();
  },
});

function sheetFor(kind: 'start' | 'pause' | 'parked', p: Progress): SheetInfo {
  const sum = returnSummary(p);
  if (kind === 'parked') {
    return { eyebrow: 'Parked up', title: 'See you next shift', lede: sum.recall, next: sum.next, button: 'Keep driving' };
  }
  if (kind === 'pause') {
    return { eyebrow: 'Paused', title: 'Lowbridge After Dark', lede: sum.recall, next: sum.next, button: 'Resume' };
  }
  if (welcome === 'newer') {
    return {
      eyebrow: 'Save from a newer version',
      title: 'Lowbridge After Dark',
      lede: 'This device has a save from a newer version of the game. It has been left untouched. This session won’t save.',
      next: '',
      button: 'Play without saving',
    };
  }
  if (welcome === 'back' || welcome === 'recovered') {
    return {
      eyebrow: welcome === 'recovered' ? 'Recovered your last good save' : 'Welcome back',
      title: 'Lowbridge After Dark',
      lede: sum.recall,
      next: sum.next,
      button: 'Resume',
    };
  }
  return {
    eyebrow: 'Riverside · shift one',
    title: 'Lowbridge After Dark',
    lede: 'You drive nights for the depot in a British river town. Two crews need the same spare battery, and something small is living in the ticket machine.',
    next: 'About 5 minutes to a delivery. Progress saves on this device.',
    button: 'Start',
  };
}

function openSheet(kind: 'pause' | 'parked'): void {
  input.clear();
  pause(session);
  hud.showSheet(sheetFor(kind, session.progress), session.progress);
}

/** Real time since the player first pressed Start, for the five-minute gate. */
let startedWall = 0;

function closeSheet(): void {
  if (!startedWall) startedWall = performance.now();
  input.clear();
  sfx.unlock();
  resume(session);
  scene?.resetTime();
  hud.hideSheet();
}

// ------------------------------------------------------------------ events

function onEvents(events: WorldEvent[]): void {
  for (const e of events) {
    switch (e.type) {
      case 'enter':
      case 'exit':
        sfx.door();
        break;
      case 'bump':
        sfx.bump(e.strength);
        break;
      case 'accepted':
      case 'recruited':
      case 'noticed':
        sfx.chime();
        break;
      case 'counteroffer':
        sfx.radio();
        break;
      case 'shutter_opened':
        sfx.rumble();
        break;
      case 'delivered':
        if (e.recipient === 'mo_vale') sfx.horn();
        else sfx.chime();
        break;
      case 'escaped':
      case 'step_done':
      case 'beat_done':
      case 'quick_done':
        sfx.chime();
        break;
      case 'call_taken':
      case 'quick_started':
        sfx.radio();
        break;
      case 'sighting':
        sfx.ringOnce();
        break;
      case 'shift_complete':
        sfx.horn();
        break;
      case 'save_failed':
        // The red "Progress hasn't saved" bar stays up until a save succeeds.
        break;
      case 'checkpoint':
        saveCheckpoint();
        break;
      case 'parked':
        void settled(session).then(() => {
          saveCheckpoint();
          openSheet('parked');
        });
        break;
      default:
        break;
    }
    // A plain DOM hook for test harnesses; the game itself sends nothing anywhere.
    const detail: Record<string, unknown> = { type: e.type, simTime: Number(session.simTime.toFixed(2)), build: BUILD };
    if (e.type === 'delivered') {
      Object.assign(detail, {
        recipient: e.recipient,
        handoverAt: session.handoverAt,
        wallSeconds: startedWall ? Math.round((performance.now() - startedWall) / 1000) : null,
        shortcut: session.progress.flags.includes('yard_shutter_open'),
        recruited: session.progress.roster.includes('clatterjack'),
      });
    }
    if (e.type === 'bump') Object.assign(detail, { x: Math.round(e.at.x), y: Math.round(e.at.y) });
    if (e.type === 'enter') detail.vehicle = e.vehicle;
    if (e.type === 'call_taken' || e.type === 'beat_done') detail.beat = e.beat;
    if (e.type === 'step_done') Object.assign(detail, { beat: e.beat, step: e.step });
    if (e.type === 'shift_complete') detail.first = e.first;
    if (e.type === 'quick_done') Object.assign(detail, { job: e.job, time: e.time, category: e.category, improved: e.improved, site: e.site });
    if (e.type !== 'checkpoint') window.dispatchEvent(new CustomEvent('lowbridge:event', { detail }));
  }
}

// ------------------------------------------------------------------ input

function setPreset(preset: SteeringPreset, announce: boolean): void {
  settings.preset = preset;
  if (session) session.preset = preset;
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
  onInteract: () => {
    if (!session) return;
    if (session.mode === 'world') void interact(session);
    else if (session.mode === 'prompt' && session.prompts[0]?.choices.length === 1) {
      void choose(session, session.prompts[0].choices[0].id);
    }
  },
  onPauseToggle: () => {
    if (!session) return;
    if (hud.sheetOpen()) closeSheet();
    else openSheet('pause');
  },
  onPreset: (p) => setPreset(p, true),
  onMuteToggle: () => {
    setMuted(!settings.muted);
    hud.toast(settings.muted ? 'Sound off' : 'Sound on', 2);
  },
  onGesture: () => sfx.unlock(),
  onTouchSeen: () => (touch = true),
  worldKeysActive: () => !!session && session.mode !== 'paused',
});

// ----------------------------------------------------------------- menu

const byId = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
byId('resume-btn').addEventListener('click', closeSheet);
for (const radio of document.querySelectorAll<HTMLInputElement>('input[name="preset"]')) {
  radio.addEventListener('change', () => radio.checked && setPreset(radio.value as SteeringPreset, false));
}
const jacketList = byId('jackets');
for (const j of JACKETS) {
  const label = document.createElement('label');
  label.className = 'swatch';
  const radio = document.createElement('input');
  radio.type = 'radio';
  radio.name = 'jacket';
  radio.value = j.id;
  radio.id = `jacket-${j.id}`;
  radio.addEventListener('change', () => {
    if (!radio.checked) return;
    settings.jacket = j.id;
    saveSettings(settings);
  });
  const chip = document.createElement('span');
  chip.className = 'chip';
  chip.style.background = j.fill;
  chip.style.borderColor = j.trim;
  label.append(radio, chip, document.createTextNode(j.name));
  jacketList.append(label);
}
const muteBox = byId<HTMLInputElement>('mute');
muteBox.addEventListener('change', () => setMuted(muteBox.checked));
const motionBox = byId<HTMLInputElement>('reduce-motion');
motionBox.checked = reduceMotion();
motionBox.addEventListener('change', () => {
  settings.reduceMotion = motionBox.checked;
  saveSettings(settings);
});
byId('new-game-btn').addEventListener('click', () => {
  byId('new-game-btn').hidden = true;
  byId('new-game-confirm').hidden = false;
});
byId('new-game-no').addEventListener('click', () => {
  byId('new-game-btn').hidden = false;
  byId('new-game-confirm').hidden = true;
});
byId('new-game-yes').addEventListener('click', () => {
  void saves.clear().finally(() => window.location.reload());
});
byId('build-id').textContent = BUILD;

// ------------------------------------------------------ dispatch and saves

byId('board-btn').addEventListener('click', () => {
  if (!session) return;
  closeSheet();
  openBoard(session);
});

const importResult = byId('import-result');
const importConfirm = byId('import-confirm');
let pendingImport: SaveEnvelope | null = null;

function currentEnvelope(): SaveEnvelope {
  return {
    schemaVersion: SCHEMA_VERSION,
    revision: saves.revision,
    savedAt: new Date().toISOString(),
    progress: saves.committed ?? session.progress,
    checkpoint: checkpoint(session),
  };
}

byId('export-btn').addEventListener('click', () => {
  if (!session) return;
  const text = exportSave(currentEnvelope(), BUILD);
  byId('export-box').hidden = false;
  byId<HTMLTextAreaElement>('export-text').value = text;
  try {
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `lowbridge-save-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.append(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 5000);
  } catch {
    // Some views block downloads; the text box above still works.
  }
  importResult.textContent = 'Exported. Keep the file (or the text) somewhere safe.';
});

function previewImport(text: string): void {
  const c = checkImport(text);
  pendingImport = null;
  importConfirm.hidden = true;
  if (!c.ok) {
    importResult.textContent = c.message;
    return;
  }
  const sum = returnSummary(c.envelope.progress);
  const when = c.exportedAt ? new Date(c.exportedAt).toLocaleString('en-GB') : 'unknown time';
  importResult.textContent = `Save from ${when}${c.migratedFrom ? ' (older version, will be upgraded)' : ''}: ${sum.recall} ${sum.next}.`;
  pendingImport = c.envelope;
  importConfirm.hidden = false;
}

byId('import-btn').addEventListener('click', () => {
  byId('import-box').hidden = false;
  importResult.textContent = '';
});
byId('import-choose').addEventListener('click', () => byId<HTMLInputElement>('import-file').click());
byId<HTMLInputElement>('import-file').addEventListener('change', async (e) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;
  const text = await file.text();
  byId<HTMLTextAreaElement>('import-text').value = text;
  previewImport(text);
});
byId('import-check').addEventListener('click', () => previewImport(byId<HTMLTextAreaElement>('import-text').value));
byId('restore-btn').addEventListener('click', async () => {
  const prev = await saves.loadPrevious();
  if (!prev) {
    importResult.textContent = 'There’s no earlier save on this device yet.';
    importConfirm.hidden = true;
    return;
  }
  const sum = returnSummary(prev.progress);
  importResult.textContent = `The save before your last change: ${sum.recall}`;
  pendingImport = prev;
  importConfirm.hidden = false;
});
byId('import-no').addEventListener('click', () => {
  pendingImport = null;
  importConfirm.hidden = true;
  importResult.textContent = 'Kept your current save.';
});
byId('import-yes').addEventListener('click', async () => {
  if (!pendingImport) return;
  // The current save becomes "previous", so this can be undone with Restore previous save.
  const ok = await saves.replace(pendingImport);
  if (!ok) {
    importResult.textContent = 'That didn’t save. Your current save is untouched; try again.';
    return;
  }
  window.location.reload();
});

let offlineReady = false;
const offline = startOffline((st) => {
  offlineReady = st.ready;
  byId('offline-state').textContent = !st.supported
    ? 'Offline play works when the game is opened from jsip.uk.'
    : st.ready
      ? 'Available offline on this device.'
      : `Getting ready for offline play${st.missing ? ` (${st.missing} files to go)` : ''}…`;
  byId('update-btn').hidden = !st.updateReady;
});
byId('update-btn').addEventListener('click', () => {
  saveCheckpoint();
  offline.applyUpdate();
});
hud.syncSettings(settings);

// --------------------------------------------------------- interruptions

document.addEventListener('visibilitychange', () => {
  if (!session) return;
  if (document.hidden) {
    if (session.mode !== 'paused') openSheet('pause');
    saveCheckpoint();
    sfx.suspend();
  }
});
window.addEventListener('blur', () => session && session.mode !== 'paused' && openSheet('pause'));
window.addEventListener('pagehide', () => {
  if (!session) return;
  if (session.mode !== 'paused') openSheet('pause');
  saveCheckpoint();
});
try {
  window.matchMedia('(orientation: portrait)').addEventListener('change', () => input.clear());
} catch {
  // Older engines: resize below still keeps the canvas right.
}

// ------------------------------------------------------------------- boot

let welcome: 'new' | 'back' | 'recovered' | 'newer' = 'new';

async function loadSave(): Promise<{ progress: Progress; cp: Checkpoint | null }> {
  try {
    const v = await saves.load();
    if (!v) return { progress: initialProgress(), cp: null };
    if (v.ok) {
      welcome = 'back';
      return { progress: v.envelope.progress, cp: v.envelope.checkpoint };
    }
    if (v.reason === 'newer') {
      // Leave the newer save untouched and play this session in memory only.
      welcome = 'newer';
      store = createMemoryStore();
      saves = new SaveController(store);
      storageNote = 'A newer save on this device is being left alone; this session won’t save.';
      return { progress: initialProgress(), cp: null };
    }
    const prev = await saves.loadPrevious();
    if (prev) {
      welcome = 'recovered';
      saves.committed = prev.progress;
      return { progress: prev.progress, cp: prev.checkpoint };
    }
  } catch {
    storageNote = 'Saving isn’t available in this browser right now.';
  }
  return { progress: initialProgress(), cp: null };
}

async function boot(): Promise<void> {
  const { progress, cp } = await loadSave();
  session = createSession(map, settings.preset, progress, commit, cp);
  saves.onAdopt = (env) => {
    session.progress = env.progress;
    hud.toast('Another tab saved newer progress. This one has caught up.', 5);
  };
  // A fresh slot writes its starting state straight away, so later checkpoints have something to build on.
  if (welcome === 'new' || welcome === 'recovered') void saves.write(session.progress, checkpoint(session)).then(updateSaveState);
  pause(session);
  updateSaveState();
  hud.showSheet(sheetFor('start', session.progress), session.progress);

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

  let lastCheckpoint = 0;
  game.scene.add('street', StreetScene, true, {
    session: () => session,
    input,
    hud,
    dpr,
    reduceMotion,
    jacket: () => settings.jacket,
    touch: () => touch,
    onEvents,
    onReady: (ready: StreetScene) => (scene = ready),
    onFrame: (focus: { x: number; y: number }) => {
      const ph = map.phone;
      const world = session.mode === 'world';
      sfx.updateRing(session.progress.story.stage === 'offered' && world, Math.hypot(ph.x - focus.x, ph.y - focus.y));
      const p = session.pursuit;
      sfx.updateSiren(!!p && p.delay <= 0 && world, p ? Math.hypot(p.car.x - focus.x, p.car.y - focus.y) : 0);
      // Save where things are every five seconds of ordinary play, but not mid-chase.
      if (world && !p && session.simTime - lastCheckpoint > 5) {
        lastCheckpoint = session.simTime;
        saveCheckpoint();
      }
    },
  });

  window.addEventListener('resize', () => {
    game.scale.resize(Math.round(window.innerWidth * dpr), Math.round(window.innerHeight * dpr));
  });
}

// Read-only hook so a coding agent can check state while driving with the keyboard.
Object.defineProperty(window, 'lowbridge', {
  value: Object.freeze({
    build: BUILD,
    snapshot: () => (session ? snapshot(session) : null),
    saveStatus: () => ({ status: saves.status, revision: saves.revision, offlineReady }),
  }),
});

void boot();
