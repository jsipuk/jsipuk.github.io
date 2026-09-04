/* Boot, the screen manager, and the frame loop.
 *
 * This is the only file that knows about all the others. Everything below it
 * is a leaf: sim.js does not import render.js, render.js does not import
 * audio.js, entitlement.js has no idea a game exists.
 */

import { SCENE_H, VW } from './config.js';
import { createRenderer, reactToEvent } from './render.js';
import { createInput, lockViewport } from './input.js';
import { createAudio, EVENT_SFX } from './audio.js';
import { loadSettings, saveSettings, loadScores, recordRun, countStart, resetScores, storageAvailable } from './storage.js';
import { createEntitlement, devProvider, isDevEnvironment } from './entitlement.js';
import { createGame, update as stepSim, tapScene, launchEagle, displayScore } from './sim.js';
import * as UI from './ui.js';
import { P } from './palette.js';

const canvas = document.getElementById('view');
const renderer = createRenderer(canvas);
const audio = createAudio();

const settings = loadSettings();
let scores = loadScores();
const dev = isDevEnvironment();
const storageOk = storageAvailable();

const ent = createEntitlement({
  provider: devProvider,           // swap here for a real provider; see entitlement.js
  runsPlayed: () => loadScores().runs,
});

/* -------------------------------------------------------------------------- */
/* Screen state                                                               */
/* -------------------------------------------------------------------------- */

const S = {
  screen: 'boot',
  prev: 'title',
  t: 0,                 // time on the current screen
  sel: 0,
  page: 0,
  items: [],
  game: null,
  result: null,
  busy: false,
  error: '',
  banner: null,         // { msg, sub, life }
};

const isPlaying = () => S.screen === 'play';

function go(screen) {
  S.prev = S.screen;
  S.screen = screen;
  S.t = 0;
  S.sel = 0;
  S.error = '';
  S.items = [];
  input.reset();
}

/* -------------------------------------------------------------------------- */
/* Starting and ending a run                                                  */
/* -------------------------------------------------------------------------- */

function startRun() {
  if (!ent.canPlay()) { go('paywall'); return; }
  countStart();
  scores = loadScores();
  S.game = createGame();
  S.result = null;
  S.banner = { msg: 'WAVE 1', sub: 'HOLD THE LINE', life: 2.2 };
  audio.setWave(1);
  audio.startMusic();
  go('play');
}

function endRun() {
  const g = S.game;
  const score = displayScore(g);
  const { scores: s, isBest } = recordRun(score, g.wave);
  scores = s;
  S.result = { score, wave: g.wave, best: s.best, isBest };
  audio.stopMusic();
  go('gameover');
}

/* -------------------------------------------------------------------------- */
/* Menu actions                                                               */
/* -------------------------------------------------------------------------- */

function activate(id) {
  audio.unlock();
  if (id !== 'any') audio.play('menu');

  switch (S.screen) {
    case 'boot':
      go('title');
      break;

    case 'title':
      if (id === 'play') { audio.play('select'); startRun(); }
      else if (id === 'how') { S.page = 0; go('how'); }
      else if (id === 'settings') go('settings');
      else if (id === 'scores') go('scores');
      else if (id === 'about') go('about');
      break;

    case 'how':
      if (id === 'next') { S.page = Math.min(1, S.page + 1); S.sel = 0; }
      else if (id === 'prev') { S.page = Math.max(0, S.page - 1); S.sel = 0; }
      else if (id === 'back') { audio.play('back'); go(S.prev === 'pause' ? 'pause' : 'title'); }
      break;

    case 'settings':
      if (id === 'music') { settings.music = !settings.music; audio.setMusic(settings.music); if (settings.music && isPlaying()) audio.startMusic(); saveSettings(settings); }
      else if (id === 'sfx') { settings.sfx = !settings.sfx; audio.setSfx(settings.sfx); saveSettings(settings); }
      else if (id === 'crt') { settings.crt = !settings.crt; saveSettings(settings); }
      else if (id === 'shake') { settings.shake = !settings.shake; saveSettings(settings); }
      else if (id === 'reset') { scores = resetScores(); audio.play('back'); }
      else if (id === 'about') go('about');
      else if (id === 'back') { audio.play('back'); go(S.prev === 'pause' ? 'pause' : 'title'); }
      break;

    case 'about':
    case 'scores':
      if (id === 'back') { audio.play('back'); go(S.prev === 'pause' ? 'pause' : (S.prev === 'gameover' ? 'gameover' : 'title')); }
      break;

    case 'pause':
      if (id === 'resume') resume();
      else if (id === 'how') { S.page = 0; go('how'); S.prev = 'pause'; }
      else if (id === 'settings') { go('settings'); S.prev = 'pause'; }
      else if (id === 'quit') { audio.stopMusic(); S.game = null; go('title'); }
      break;

    case 'gameover':
      if (id === 'again') startRun();
      else if (id === 'scores') { go('scores'); S.prev = 'gameover'; }
      else if (id === 'title') go('title');
      break;

    case 'paywall':
      if (id === 'buy') doPurchase();
      else if (id === 'restore') doRestore();
      else if (id === 'back') { audio.play('back'); go('title'); }
      break;

    default:
      break;
  }
}

async function doPurchase() {
  if (S.busy) return;
  S.busy = true;
  S.error = '';
  try {
    const ok = await ent.purchase();
    if (ok) { audio.play('coin'); go('title'); }
    else S.error = 'Purchase did not complete.';
  } catch (e) {
    S.error = e && e.message ? e.message : 'Purchase failed.';
  } finally {
    S.busy = false;
  }
}

async function doRestore() {
  if (S.busy) return;
  S.busy = true;
  S.error = '';
  try {
    const ok = await ent.restore();
    if (ok) { audio.play('coin'); go('title'); }
    else S.error = 'No previous purchase found on this device.';
  } catch (e) {
    S.error = e && e.message ? e.message : 'Restore failed.';
  } finally {
    S.busy = false;
  }
}

/* -------------------------------------------------------------------------- */
/* Pause                                                                      */
/* -------------------------------------------------------------------------- */

function pause() {
  if (!isPlaying()) return;
  audio.play('menu');
  audio.stopMusic();
  go('pause');
}

function resume() {
  audio.play('select');
  if (settings.music) audio.startMusic();
  go('play');
}

/* -------------------------------------------------------------------------- */
/* Input wiring                                                               */
/* -------------------------------------------------------------------------- */

const input = createInput(canvas, renderer, {
  isPlaying,
  onPause: () => (isPlaying() ? pause() : activate('back')),
  onEagle: () => { if (isPlaying() && S.game) launchEagle(S.game); },
  onSceneTap: (x, y) => {
    if (!S.game) return;
    audio.unlock();
    tapScene(S.game, x, y);
  },
  onUiTap: (x, y) => {
    audio.unlock();
    for (const it of S.items) {
      if (x >= it.x && x < it.x + it.w && y >= it.y && y < it.y + it.h) { activate(it.id); return; }
    }
    if (S.screen === 'boot') activate('any');
  },
  onUiKey: (key) => {
    audio.unlock();
    const n = S.items.length;
    if (S.screen === 'boot') { activate('any'); return; }
    if (key === 'rotate') { S.sel = (S.sel - 1 + n) % n; audio.play('menu'); }
    else if (key === 'soft') { S.sel = (S.sel + 1) % n; audio.play('menu'); }
    else if (key === 'enter' || key === 'hard') { const it = S.items[S.sel]; if (it) activate(it.id); }
    else if (key === 'pause') {
      if (S.screen === 'pause') resume();
      else if (S.screen !== 'title') activate('back');
    }
  },
});

lockViewport();

/* -------------------------------------------------------------------------- */
/* Events from the simulation -> sound and confetti                           */
/* -------------------------------------------------------------------------- */

function drainEvents(g) {
  for (const e of g.events) {
    reactToEvent(renderer.fx, e);
    const sfx = EVENT_SFX[e.t];
    if (sfx) audio.play(sfx);
    if (e.t === 'lock') audio.play(e.solid && e.combo >= 3 ? 'combo' : 'lock', e.combo);
    if (e.t === 'kill') audio.play(e.how === 'squish' || e.how === 'crush' ? 'squish' : 'kill');
    if (e.t === 'wave_clear') S.banner = { msg: 'WAVE ' + e.wave + ' HELD', sub: 'BONUS ' + (800 * e.wave), life: 2.4 };
    if (e.t === 'wave_start') {
      S.banner = { msg: 'WAVE ' + e.wave, sub: waveNote(e.wave), life: 2.2 };
      audio.setWave(e.wave);
    }
    if (e.t === 'gameover') endRun();
  }
  g.events.length = 0;
}

/** A one-line heads-up about what is new this wave. */
function waveNote(wave) {
  if (wave === 2) return 'RUNNERS INCOMING';
  if (wave === 3) return 'THEY CAN CLIMB NOW';
  if (wave === 4) return 'BRUTES. DROP ON THEM';
  if (wave === 5) return 'WATCH THE SKY';
  if (wave === 6) return 'AWKWARD SHAPES';
  if (wave % 5 === 0) return 'THEY KEEP COMING';
  return 'HOLD THE LINE';
}

/* -------------------------------------------------------------------------- */
/* Frame loop                                                                 */
/* -------------------------------------------------------------------------- */

let last = performance.now();

function frame(now) {
  let dt = (now - last) / 1000;
  last = now;
  // A backgrounded tab can hand us a ten second dt; never simulate that.
  if (!(dt > 0)) dt = 0;
  dt = Math.min(dt, 1 / 20);

  S.t += dt;
  const b = renderer.b;
  const vh = renderer.view.vh;

  if (S.screen === 'play' && S.game) {
    const inp = input.consume(dt);
    stepSim(S.game, dt, inp);
    drainEvents(S.game);
    renderer.drawGame(S.game, dt, input, settings);
    if (S.banner) {
      S.banner.life -= dt;
      if (S.banner.life <= 0) S.banner = null;
      else UI.drawBanner(b, S.banner.msg, S.banner.sub, 176, S.t);
    }
    if (S.game.phase === 'break' && !S.banner) {
      UI.drawBanner(b, 'WAVE ' + (S.game.wave + 1), 'GET READY', 176, S.t);
    }
    renderer.present();
    S.items = [];
  } else {
    // Menus keep the last game frame behind them where it makes sense.
    if ((S.screen === 'pause' || S.screen === 'gameover') && S.game) {
      renderer.drawScene(S.game, 0);
      b.fillStyle = P.ink;
      b.fillRect(0, SCENE_H, VW, vh - SCENE_H);
    }
    S.items = drawScreen(b, vh);
    if (settings.crt) {
      b.fillStyle = 'rgba(0,0,0,0.16)';
      for (let y = 0; y < vh; y += 2) b.fillRect(0, y, VW, 1);
    }
    renderer.present();
  }

  requestAnimationFrame(frame);
}

function drawScreen(b, vh) {
  switch (S.screen) {
    case 'boot': return UI.drawBoot(b, vh, S.t);
    case 'title': return UI.drawTitle(b, vh, S.t, S.sel, scores, ent);
    case 'how': return UI.drawHow(b, vh, S.page, S.sel);
    case 'settings': return UI.drawSettings(b, vh, settings, S.sel, storageOk);
    case 'about': return UI.drawAbout(b, vh, S.sel);
    case 'scores': return UI.drawScores(b, vh, scores, S.sel);
    case 'pause': return UI.drawPause(b, vh, S.sel);
    case 'gameover': return UI.drawGameOver(b, vh, S.game, S.result, S.sel);
    case 'paywall': return UI.drawPaywall(b, vh, ent, S.sel, dev, S.busy, S.error);
    default: return [];
  }
}

/* -------------------------------------------------------------------------- */
/* Lifecycle                                                                  */
/* -------------------------------------------------------------------------- */

function fit() {
  renderer.resize(
    window.innerWidth,
    window.innerHeight,
    Math.min(3, window.devicePixelRatio || 1),
  );
}

window.addEventListener('resize', fit);
window.addEventListener('orientationchange', () => setTimeout(fit, 120));

// Losing focus mid-run must pause, not quietly keep spawning zombies.
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    if (isPlaying()) pause();
    audio.suspend();
  } else {
    audio.resume();
    last = performance.now();
  }
});

audio.setMusic(settings.music);
audio.setSfx(settings.sfx);
fit();
requestAnimationFrame(frame);

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => { /* offline is a bonus, not a requirement */ });
  });
}
