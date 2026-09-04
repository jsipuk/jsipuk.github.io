/* Chiptune, synthesised in the browser.
 *
 * There are no audio files in this project. Every sound is generated from
 * oscillators and a noise buffer at run time, which keeps the download tiny,
 * makes the game work offline on first load, and means there is no music
 * licence to clear before it can be sold.
 *
 * The music is a small step sequencer: three voices (bass, lead, noise
 * percussion) reading patterns, with the tempo nudged up as the waves climb.
 */

const A4 = 440;
/** Note name -> frequency. 'A4', 'C#3', or '-' for a rest. */
const NOTE_OFFSET = { C: -9, D: -7, E: -5, F: -4, G: -2, A: 0, B: 2 };

export function noteFreq(name) {
  if (!name || name === '-') return 0;
  const m = /^([A-G])(#|b)?(-?\d)$/.exec(name);
  if (!m) return 0;
  let semis = NOTE_OFFSET[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
  semis += (Number(m[3]) - 4) * 12;
  return A4 * Math.pow(2, semis / 12);
}

/* --- The tune -------------------------------------------------------------
 * Deliberately daft: a marching, major-key fanfare that would not be out of
 * place over a 1988 arcade attract screen. 16 steps per pattern.
 */
const PATTERNS = {
  bass: [
    ['C2', '-', 'C2', '-', 'G2', '-', 'C2', '-', 'F2', '-', 'F2', '-', 'G2', '-', 'G2', 'B2'],
    ['A2', '-', 'A2', '-', 'E2', '-', 'A2', '-', 'F2', '-', 'F2', '-', 'G2', '-', 'G2', 'G2'],
  ],
  lead: [
    ['C4', 'E4', 'G4', 'E4', 'C4', '-', 'G3', '-', 'A3', 'C4', 'F4', 'C4', 'G3', '-', 'B3', '-'],
    ['C5', '-', 'B4', 'G4', 'E4', '-', 'C4', '-', 'D4', 'F4', 'A4', 'F4', 'G4', '-', '-', '-'],
  ],
  drum: [
    ['K', '-', 'H', '-', 'S', '-', 'H', 'H', 'K', '-', 'H', '-', 'S', '-', 'H', 'S'],
    ['K', 'K', 'H', '-', 'S', '-', 'H', '-', 'K', '-', 'H', 'K', 'S', '-', 'S', 'S'],
  ],
};

export function createAudio() {
  let ctx = null;
  let master = null;
  let musicGain = null;
  let sfxGain = null;
  let noiseBuf = null;
  let timer = null;
  let step = 0;
  let nextTime = 0;
  let bpm = 132;
  const state = { music: true, sfx: true, started: false, playing: false };

  function ensure() {
    if (ctx) return true;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
    musicGain = ctx.createGain();
    musicGain.gain.value = 0.26;
    musicGain.connect(master);
    sfxGain = ctx.createGain();
    sfxGain.gain.value = 0.5;
    sfxGain.connect(master);

    const len = Math.floor(ctx.sampleRate * 0.4);
    noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return true;
  }

  /** Browsers will not start audio until a real gesture; call this from one. */
  function unlock() {
    if (!ensure()) return;
    if (ctx.state === 'suspended') ctx.resume();
    state.started = true;
  }

  /* ---- one-shot voices --------------------------------------------------- */

  function tone(freq, dur, type = 'square', vol = 0.3, slideTo = 0, dest = null) {
    if (!ctx || !state.sfx) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    const gn = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    gn.gain.setValueAtTime(vol, t);
    gn.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    o.connect(gn).connect(dest || sfxGain);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  function noise(dur, vol = 0.3, filterHz = 2000, dest = null) {
    if (!ctx || (!state.sfx && !dest)) return;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = filterHz;
    const gn = ctx.createGain();
    gn.gain.setValueAtTime(vol, t);
    gn.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    src.connect(f).connect(gn).connect(dest || sfxGain);
    src.start(t);
    src.stop(t + dur);
  }

  /** Two or three notes in quick succession — the arcade "you did a thing". */
  function arp(freqs, gap = 0.055, dur = 0.09, type = 'square', vol = 0.28) {
    if (!ctx || !state.sfx) return;
    freqs.forEach((f, i) => {
      const t = ctx.currentTime + i * gap;
      const o = ctx.createOscillator();
      const gn = ctx.createGain();
      o.type = type;
      o.frequency.setValueAtTime(f, t);
      gn.gain.setValueAtTime(vol, t);
      gn.gain.exponentialRampToValueAtTime(0.0008, t + dur);
      o.connect(gn).connect(sfxGain);
      o.start(t);
      o.stop(t + dur + 0.02);
    });
  }

  const N = noteFreq;

  /** Every sound the game can make, in one table. */
  const SFX = {
    move: () => tone(320, 0.035, 'square', 0.15),
    rotate: () => tone(520, 0.06, 'square', 0.18, 660),
    lock: () => { tone(150, 0.09, 'square', 0.28, 90); noise(0.06, 0.16, 1200); },
    combo: (n) => arp([N('C5'), N('E5'), N('G5')].slice(0, 2 + Math.min(1, n)), 0.045, 0.08),
    harddrop: () => { tone(500, 0.09, 'sawtooth', 0.22, 110); noise(0.1, 0.22, 900); },
    seal: () => arp([N('C5'), N('E5'), N('G5'), N('C6')], 0.06, 0.16, 'square', 0.3),
    repair: () => arp([N('G4'), N('C5')], 0.05, 0.1, 'triangle', 0.26),
    chew: () => noise(0.05, 0.1, 700),
    bite: () => noise(0.07, 0.16, 520),
    break: () => { noise(0.22, 0.3, 420); tone(180, 0.18, 'square', 0.2, 60); },
    kill: () => { noise(0.14, 0.26, 1500); tone(400, 0.12, 'square', 0.22, 120); },
    squish: () => { noise(0.18, 0.3, 380); tone(220, 0.16, 'sawtooth', 0.22, 70); },
    eagle_launch: () => arp([N('C4'), N('G4'), N('C5'), N('E5'), N('G5')], 0.04, 0.09, 'square', 0.26),
    eagle_grab: () => { arp([N('G5'), N('C6'), N('E6')], 0.05, 0.14, 'square', 0.3); noise(0.2, 0.14, 2600); },
    eagle_screech: () => tone(1400, 0.18, 'sawtooth', 0.16, 700),
    eagle_ready: () => arp([N('E5'), N('A5')], 0.06, 0.12, 'triangle', 0.22),
    balloon_pop: () => { noise(0.09, 0.32, 2200); tone(900, 0.08, 'square', 0.2, 200); },
    crate_drop: () => arp([N('C4'), N('E4')], 0.08, 0.14, 'triangle', 0.2),
    crate_take: () => arp([N('C5'), N('F5'), N('A5'), N('C6')], 0.05, 0.14, 'triangle', 0.3),
    breach: () => { tone(260, 0.5, 'sawtooth', 0.34, 60); noise(0.4, 0.28, 300); },
    topple: () => { tone(200, 0.3, 'sawtooth', 0.26, 70); noise(0.3, 0.2, 500); },
    wave_clear: () => arp([N('C5'), N('E5'), N('G5'), N('C6'), N('G5'), N('C6')], 0.07, 0.16, 'square', 0.3),
    wave_start: () => arp([N('G3'), N('C4'), N('G4')], 0.08, 0.18, 'square', 0.28),
    gameover: () => arp([N('C5'), N('G4'), N('E4'), N('C4'), N('G3'), N('C3')], 0.13, 0.3, 'square', 0.32),
    menu: () => tone(660, 0.05, 'square', 0.2),
    select: () => arp([N('C5'), N('G5')], 0.05, 0.1),
    back: () => arp([N('G4'), N('C4')], 0.05, 0.1),
    coin: () => arp([N('B5'), N('E6')], 0.06, 0.2, 'square', 0.3),
  };

  function play(name, arg) {
    if (!ctx || !state.sfx) return;
    const fn = SFX[name];
    if (fn) fn(arg);
  }

  /* ---- music sequencer ---------------------------------------------------- */

  function scheduleStep(when) {
    const bar = Math.floor(step / 16) % 2;
    const s = step % 16;

    const bassNote = PATTERNS.bass[bar][s];
    if (bassNote !== '-') voice(noteFreq(bassNote), when, 0.13, 'triangle', 0.5);

    const leadNote = PATTERNS.lead[bar][s];
    if (leadNote !== '-') voice(noteFreq(leadNote), when, 0.11, 'square', 0.24);

    const d = PATTERNS.drum[bar][s];
    if (d === 'K') { voice(70, when, 0.09, 'sine', 0.7, 40); }
    else if (d === 'S') { musNoise(when, 0.09, 0.34, 1400); }
    else if (d === 'H') { musNoise(when, 0.03, 0.14, 6000); }
  }

  function voice(freq, when, dur, type, vol, slideTo) {
    if (!freq) return;
    const o = ctx.createOscillator();
    const gn = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, when);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, when + dur);
    gn.gain.setValueAtTime(0.0001, when);
    gn.gain.linearRampToValueAtTime(vol, when + 0.006);
    gn.gain.exponentialRampToValueAtTime(0.0008, when + dur);
    o.connect(gn).connect(musicGain);
    o.start(when);
    o.stop(when + dur + 0.02);
  }

  function musNoise(when, dur, vol, hz) {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = hz;
    const gn = ctx.createGain();
    gn.gain.setValueAtTime(vol, when);
    gn.gain.exponentialRampToValueAtTime(0.0008, when + dur);
    src.connect(f).connect(gn).connect(musicGain);
    src.start(when);
    src.stop(when + dur);
  }

  /** Look ahead ~120ms and schedule any steps that fall inside it. */
  function pump() {
    if (!ctx || !state.playing) return;
    const stepDur = 60 / bpm / 4;
    while (nextTime < ctx.currentTime + 0.12) {
      if (nextTime < ctx.currentTime) nextTime = ctx.currentTime + 0.01;
      scheduleStep(nextTime);
      nextTime += stepDur;
      step = (step + 1) % 32;
    }
  }

  function startMusic() {
    if (!ensure() || !state.music || state.playing) return;
    state.playing = true;
    step = 0;
    nextTime = ctx.currentTime + 0.06;
    if (timer) clearInterval(timer);
    timer = setInterval(pump, 40);
  }

  function stopMusic() {
    state.playing = false;
    if (timer) { clearInterval(timer); timer = null; }
  }

  /** Waves push the tempo. 132 at wave 1 up to a frantic 190. */
  function setWave(wave) {
    bpm = Math.min(190, 132 + (wave - 1) * 4);
  }

  function setMusic(on) {
    state.music = on;
    if (!on) stopMusic();
  }
  function setSfx(on) { state.sfx = on; }

  function suspend() {
    stopMusic();
    if (ctx && ctx.state === 'running') ctx.suspend();
  }
  function resume() {
    if (ctx && ctx.state === 'suspended') ctx.resume();
  }

  return {
    unlock, play, startMusic, stopMusic, setWave, setMusic, setSfx, suspend, resume, state,
    get available() { return !!ctx; },
  };
}

/** Which sound each simulation event makes. Kept out of sim.js on purpose. */
export const EVENT_SFX = {
  move: 'move',
  rotate: 'rotate',
  harddrop: 'harddrop',
  topple: 'topple',
  seal: 'seal',
  repair: 'repair',
  chew: 'chew',
  break: 'break',
  breach: 'breach',
  eagle_launch: 'eagle_launch',
  eagle_grab: 'eagle_grab',
  eagle_screech: 'eagle_screech',
  eagle_ready: 'eagle_ready',
  balloon_pop: 'balloon_pop',
  crate_drop: 'crate_drop',
  crate_take: 'crate_take',
  wave_clear: 'wave_clear',
  wave_start: 'wave_start',
  gameover: 'gameover',
};
