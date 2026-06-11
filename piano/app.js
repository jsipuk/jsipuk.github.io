/* Aria — piano practice app.
 *
 * Structure:
 *   AudioEngine     Web Audio synthesis (notes + metronome), no assets needed
 *   KeyboardLayout  maps midi notes <-> x positions; shared by the visualiser
 *   SheetRenderer   scrolling notation on a canvas (treble, + bass when needed)
 *   FallRenderer    falling notes + on-screen keyboard on a second canvas
 *   Player          the clock: advances the song position, schedules audio
 *
 * Time is measured in beats (quarter notes). Playback starts at a negative
 * beat to give a one-bar count-in.
 */

'use strict';

// ---------------------------------------------------------------- note maths

const PC_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const PC_LETTER = ['C', 'C', 'D', 'D', 'E', 'F', 'F', 'G', 'G', 'A', 'A', 'B'];
const PC_SHARP = [false, true, false, true, false, false, true, false, true, false, true, false];
const LETTER_INDEX = { C: 0, D: 1, E: 2, F: 3, G: 4, A: 5, B: 6 };

const midiName = m => PC_NAMES[m % 12];
const midiOctave = m => Math.floor(m / 12) - 1;
const isBlackKey = m => PC_SHARP[m % 12];
// Diatonic staff position: one step per letter name (C4 = 28, E4 = 30, ...)
const staffStep = m => midiOctave(m) * 7 + LETTER_INDEX[PC_LETTER[m % 12]];

// ---------------------------------------------------------------- audio

class AudioEngine {
  constructor() { this.ctx = null; this.enabled = true; }

  unlock() { // must be called from a user gesture (iPad Safari requirement)
    if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  playNote(midi, durationSec, velocity = 0.5) {
    if (!this.enabled || !this.ctx) return;
    const t = this.ctx.currentTime;
    const freq = 440 * Math.pow(2, (midi - 69) / 12);
    const out = this.ctx.createGain();
    out.connect(this.ctx.destination);

    // Two detuned-octave partials with a fast attack and exponential decay
    // gives a soft, piano-ish pluck without any samples.
    for (const [mult, level, type] of [[1, 1, 'triangle'], [2, 0.25, 'sine']]) {
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = type;
      osc.frequency.value = freq * mult;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(velocity * level, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.001, t + Math.max(durationSec, 0.3) + 0.25);
      osc.connect(g).connect(out);
      osc.start(t);
      osc.stop(t + Math.max(durationSec, 0.3) + 0.3);
    }
  }

  tick(accent = false) { // metronome / count-in click
    if (!this.enabled || !this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.value = accent ? 1320 : 880;
    g.gain.setValueAtTime(0.15, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
    osc.connect(g).connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + 0.07);
  }
}

// ---------------------------------------------------------------- keyboard layout

class KeyboardLayout {
  /* Chooses a key range covering the song and computes x positions so the
   * falling notes and the drawn keyboard always line up exactly. */
  constructor(song, width) {
    let lo = 60, hi = 71; // default C4..B4
    for (const n of song.notes) { lo = Math.min(lo, n.midi); hi = Math.max(hi, n.midi); }
    lo = Math.floor(lo / 12) * 12;          // round down to a C
    hi = Math.ceil((hi + 1) / 12) * 12 - 1; // round up to a B
    if (hi - lo < 23) hi = lo + 23;         // show at least two octaves
    this.lo = lo; this.hi = hi;

    this.whiteKeys = [];
    for (let m = lo; m <= hi; m++) if (!isBlackKey(m)) this.whiteKeys.push(m);
    this.whiteW = width / this.whiteKeys.length;
    this.blackW = this.whiteW * 0.62;

    this.x = new Map(); // midi -> left x of the key
    let wx = 0;
    for (let m = lo; m <= hi; m++) {
      if (!isBlackKey(m)) { this.x.set(m, wx); wx += this.whiteW; }
      else this.x.set(m, wx - this.blackW / 2);
    }
  }
  keyWidth(m) { return isBlackKey(m) ? this.blackW : this.whiteW; }
  centerX(m) { return this.x.get(m) + this.keyWidth(m) / 2; }

  midiAt(px, py, keyTop, keyHeight) { // hit-testing for touch input
    const blackBottom = keyTop + keyHeight * 0.62;
    if (py <= blackBottom) {
      for (let m = this.lo; m <= this.hi; m++)
        if (isBlackKey(m) && px >= this.x.get(m) && px < this.x.get(m) + this.blackW) return m;
    }
    for (let m = this.lo; m <= this.hi; m++)
      if (!isBlackKey(m) && px >= this.x.get(m) && px < this.x.get(m) + this.whiteW) return m;
    return null;
  }
}

// ---------------------------------------------------------------- sheet music

class SheetRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.pxPerBeat = 56;
    this.cursorX = 130; // playhead position from the left edge
  }

  resize() {
    const dpr = window.devicePixelRatio || 1;
    const r = this.canvas.getBoundingClientRect();
    this.canvas.width = r.width * dpr;
    this.canvas.height = r.height * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.w = r.width; this.h = r.height;
  }

  draw(song, beat, opts) {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.w, this.h);
    if (!song) return;

    const hasBass = song.notes.some(n => n.hand === 'L' || n.midi < 55);
    const gap = hasBass ? Math.min(11, this.h / 16) : Math.min(13, this.h / 9);
    // Treble staff: bottom line E4 (step 30). Bass staff: bottom line G2 (step 18).
    const trebleBottom = hasBass ? this.h * 0.36 : this.h * 0.56;
    const bassBottom = this.h * 0.82;
    const yFor = (step, clef) => clef === 'bass'
      ? bassBottom - (step - 18) * gap / 2
      : trebleBottom - (step - 30) * gap / 2;

    const scrollX = beat * this.pxPerBeat - this.cursorX;
    const xFor = b => b * this.pxPerBeat - scrollX;
    const ink = getComputedStyle(this.canvas).getPropertyValue('--ink').trim() || '#2b2620';

    // Staves
    ctx.strokeStyle = 'rgba(43,38,32,0.55)';
    ctx.lineWidth = 1;
    const staves = hasBass ? [['treble', trebleBottom], ['bass', bassBottom]] : [['treble', trebleBottom]];
    for (const [, bottom] of staves) {
      for (let i = 0; i < 5; i++) {
        const y = bottom - i * gap;
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(this.w, y); ctx.stroke();
      }
    }
    // Clefs
    ctx.fillStyle = ink;
    ctx.font = `${gap * 5.4}px serif`;
    ctx.textBaseline = 'alphabetic';
    ctx.fillText('\u{1D11E}', 8, trebleBottom + gap * 1.4);            // 𝄞
    if (hasBass) { ctx.font = `${gap * 4.4}px serif`; ctx.fillText('\u{1D122}', 8, bassBottom - gap * 0.6); } // 𝄢

    // Barlines
    ctx.strokeStyle = 'rgba(43,38,32,0.35)';
    const lastBeat = song.notes.reduce((m, n) => Math.max(m, n.start + n.duration), 0);
    for (let b = 0; b <= lastBeat + song.beatsPerBar; b += song.beatsPerBar) {
      const x = xFor(b);
      if (x < -10 || x > this.w + 10) continue;
      for (const [, bottom] of staves) {
        ctx.beginPath(); ctx.moveTo(x, bottom - 4 * gap); ctx.lineTo(x, bottom); ctx.stroke();
      }
    }

    // Notes
    for (const n of song.notes) {
      const x = xFor(n.start);
      if (x < -60 || x > this.w + 60) continue;
      const clef = hasBass && (n.hand === 'L' || (n.hand !== 'R' && n.midi < 60)) ? 'bass' : 'treble';
      const step = staffStep(n.midi);
      const y = yFor(step, clef);
      const active = beat >= n.start && beat < n.start + n.duration;
      const color = active ? (n.hand === 'L' ? '#0e7d72' : '#c2541b') : ink;

      this.drawLedgerLines(ctx, x, step, clef, gap, yFor);
      this.drawNote(ctx, x, y, n.duration, step, clef, gap, color);

      if (isBlackKey(n.midi)) { // sharp sign
        ctx.fillStyle = color;
        ctx.font = `${gap * 1.9}px serif`;
        ctx.fillText('♯', x - gap * 1.7, y + gap * 0.6);
      }
      if (opts.noteNames) {
        ctx.fillStyle = active ? color : 'rgba(43,38,32,0.6)';
        ctx.font = `600 ${Math.max(10, gap * 0.95)}px -apple-system, sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(midiName(n.midi), x, (clef === 'bass' ? bassBottom : trebleBottom) + gap * 2.4);
        ctx.textAlign = 'left';
      }
      if (opts.fingers && n.finger) {
        ctx.fillStyle = active ? color : 'rgba(43,38,32,0.6)';
        ctx.font = `700 ${Math.max(10, gap * 0.95)}px -apple-system, sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(String(n.finger), x, (clef === 'bass' ? bassBottom : trebleBottom) - 4 * gap - gap * 0.8);
        ctx.textAlign = 'left';
      }
    }

    // Playhead
    ctx.strokeStyle = 'rgba(194,84,27,0.8)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(this.cursorX, 6); ctx.lineTo(this.cursorX, this.h - 6); ctx.stroke();
  }

  drawLedgerLines(ctx, x, step, clef, gap, yFor) {
    const [bottomStep, topStep] = clef === 'bass' ? [18, 26] : [30, 38];
    ctx.strokeStyle = 'rgba(43,38,32,0.55)';
    ctx.lineWidth = 1;
    for (let s = bottomStep - 2; s >= step; s -= 2) this.ledger(ctx, x, yFor(s, clef), gap);
    for (let s = topStep + 2; s <= step; s += 2) this.ledger(ctx, x, yFor(s, clef), gap);
  }
  ledger(ctx, x, y, gap) {
    ctx.beginPath(); ctx.moveTo(x - gap, y); ctx.lineTo(x + gap, y); ctx.stroke();
  }

  drawNote(ctx, x, y, beats, step, clef, gap, color) {
    // Pick the closest simple notation value (with optional dot).
    const base = [4, 2, 1, 0.5, 0.25].reduce((best, v) =>
      Math.abs(v - beats) < Math.abs(best - beats) || Math.abs(v * 1.5 - beats) < Math.abs(best - beats) ? v : best, 4);
    const dotted = Math.abs(base * 1.5 - beats) < Math.abs(base - beats);
    const hollow = base >= 2;
    const rx = gap * 0.62, ry = gap * 0.48;

    ctx.fillStyle = color; ctx.strokeStyle = color;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-0.3);
    ctx.beginPath();
    ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
    ctx.restore();
    if (hollow) { ctx.lineWidth = 1.8; ctx.stroke(); } else ctx.fill();

    if (dotted) { ctx.beginPath(); ctx.arc(x + rx + 5, y - 2, 2, 0, Math.PI * 2); ctx.fill(); }

    if (base < 4) { // stem (whole notes have none)
      const midStep = clef === 'bass' ? 22 : 34;
      const up = step < midStep;
      const sx = up ? x + rx - 1 : x - rx + 1;
      const sy = up ? y - gap * 3.2 : y + gap * 3.2;
      ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(sx, y); ctx.lineTo(sx, sy); ctx.stroke();
      if (base <= 0.5) { // flag for eighths/sixteenths
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.bezierCurveTo(sx + gap, sy + (up ? gap * 0.6 : -gap * 0.6), sx + gap * 0.8, sy + (up ? gap * 1.6 : -gap * 1.6), sx + gap * 0.5, sy + (up ? gap * 2 : -gap * 2));
        ctx.stroke();
      }
    }
  }
}

// ---------------------------------------------------------------- falling notes + keyboard

class FallRenderer {
  constructor(canvas, audio) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.audio = audio;
    this.pxPerBeat = 90;
    this.layout = null;
    this.pressed = new Set(); // keys the user is touching
    this.bindTouch();
  }

  resize(song) {
    const dpr = window.devicePixelRatio || 1;
    const r = this.canvas.getBoundingClientRect();
    this.canvas.width = r.width * dpr;
    this.canvas.height = r.height * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.w = r.width; this.h = r.height;
    this.keyH = Math.min(150, this.h * 0.3);
    this.hitY = this.h - this.keyH; // the timing line = top of the keyboard
    if (song) this.layout = new KeyboardLayout(song, this.w);
  }

  bindTouch() {
    const active = new Map(); // pointerId -> midi
    this.canvas.addEventListener('pointerdown', e => {
      if (!this.layout) return;
      this.audio.unlock();
      const rect = this.canvas.getBoundingClientRect();
      const px = e.clientX - rect.left, py = e.clientY - rect.top;
      if (py < this.hitY) return;
      const midi = this.layout.midiAt(px, py, this.hitY, this.keyH);
      if (midi === null) return;
      active.set(e.pointerId, midi);
      this.pressed.add(midi);
      this.audio.playNote(midi, 0.6, 0.6);
    });
    const release = e => {
      const midi = active.get(e.pointerId);
      if (midi !== undefined) { this.pressed.delete(midi); active.delete(e.pointerId); }
    };
    this.canvas.addEventListener('pointerup', release);
    this.canvas.addEventListener('pointercancel', release);
    this.canvas.addEventListener('pointerleave', release);
  }

  draw(song, beat, opts) {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.w, this.h);
    if (!song || !this.layout) return;
    const L = this.layout;

    // Lane guides for black-key positions, so falling notes are easy to track.
    ctx.fillStyle = 'rgba(255,255,255,0.025)';
    for (let m = L.lo; m <= L.hi; m++)
      if (isBlackKey(m)) ctx.fillRect(L.x.get(m), 0, L.blackW, this.hitY);

    const activeNow = new Set();

    // Falling notes: the bottom edge reaches the hit line exactly at note.start.
    for (const n of song.notes) {
      const yBottom = this.hitY - (n.start - beat) * this.pxPerBeat;
      const height = n.duration * this.pxPerBeat;
      const yTop = yBottom - height;
      if (yBottom < 0 || yTop > this.hitY) {
        if (beat >= n.start && beat < n.start + n.duration) activeNow.add(n.midi);
        continue;
      }
      const active = beat >= n.start && beat < n.start + n.duration;
      if (active) activeNow.add(n.midi);

      const x = L.x.get(n.midi), w = L.keyWidth(n.midi);
      const clipBottom = Math.min(yBottom, this.hitY);
      const left = n.hand === 'L';
      ctx.fillStyle = active
        ? (left ? '#36d6c3' : '#ffb05c')
        : (left ? 'rgba(20,160,145,0.85)' : 'rgba(235,140,60,0.85)');
      this.roundRect(ctx, x + 2, Math.max(yTop, -height), w - 4, clipBottom - Math.max(yTop, -height), 6);
      ctx.fill();

      if (opts.noteNames && clipBottom - yTop > 18) {
        ctx.fillStyle = 'rgba(15,18,26,0.9)';
        ctx.font = `700 ${Math.min(15, w * 0.42)}px -apple-system, sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(midiName(n.midi), x + w / 2, clipBottom - 8);
      }
      if (opts.fingers && n.finger && clipBottom - yTop > 40) {
        const cy = clipBottom - 32;
        ctx.beginPath(); ctx.arc(x + w / 2, cy, 9, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(15,18,26,0.85)'; ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.font = '700 12px -apple-system, sans-serif';
        ctx.fillText(String(n.finger), x + w / 2, cy + 4);
      }
      ctx.textAlign = 'left';
    }

    // Hit line
    ctx.strokeStyle = 'rgba(255,176,92,0.9)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, this.hitY); ctx.lineTo(this.w, this.hitY); ctx.stroke();

    this.drawKeyboard(activeNow, opts);

    // Count-in overlay
    if (beat < 0) {
      ctx.fillStyle = 'rgba(255,255,255,0.92)';
      ctx.font = `700 ${Math.min(72, this.h * 0.18)}px -apple-system, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(String(Math.ceil(-beat)), this.w / 2, this.hitY * 0.5);
      ctx.textAlign = 'left';
    }
  }

  drawKeyboard(activeNow, opts) {
    const ctx = this.ctx, L = this.layout;
    // White keys
    for (const m of L.whiteKeys) {
      const x = L.x.get(m);
      const lit = activeNow.has(m), touched = this.pressed.has(m);
      ctx.fillStyle = lit ? '#ffb05c' : touched ? '#d9e2ec' : '#f7f3ec';
      this.roundRect(ctx, x + 1, this.hitY, L.whiteW - 2, this.keyH, 5, true);
      ctx.fill();
      if (opts.noteNames) {
        ctx.fillStyle = lit ? '#3a2410' : 'rgba(40,40,50,0.55)';
        ctx.font = `600 ${Math.min(14, L.whiteW * 0.4)}px -apple-system, sans-serif`;
        ctx.textAlign = 'center';
        const label = m % 12 === 0 ? `C${midiOctave(m)}` : midiName(m);
        ctx.fillText(label, x + L.whiteW / 2, this.h - 10);
        ctx.textAlign = 'left';
      }
    }
    // Black keys
    for (let m = L.lo; m <= L.hi; m++) {
      if (!isBlackKey(m)) continue;
      const x = L.x.get(m);
      const lit = activeNow.has(m), touched = this.pressed.has(m);
      ctx.fillStyle = lit ? '#e8852f' : touched ? '#3a4252' : '#1b202b';
      this.roundRect(ctx, x, this.hitY, L.blackW, this.keyH * 0.62, 4, true);
      ctx.fill();
    }
  }

  roundRect(ctx, x, y, w, h, r, bottomOnly = false) {
    if (h <= 0) { ctx.beginPath(); return; }
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    if (bottomOnly) {
      ctx.moveTo(x, y);
      ctx.lineTo(x + w, y);
      ctx.lineTo(x + w, y + h - r); ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
      ctx.lineTo(x + r, y + h); ctx.arcTo(x, y + h, x, y + h - r, r);
      ctx.closePath();
    } else {
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
    }
  }
}

// ---------------------------------------------------------------- player

class Player {
  constructor(audio, onTick) {
    this.audio = audio;
    this.onTick = onTick;
    this.song = null;
    this.beat = 0;
    this.speed = 1;
    this.playing = false;
    this._raf = null;
    this._lastTime = 0;
    this._lastBeat = 0;
    this._lastClick = 0;
  }

  load(song) {
    this.pause();
    this.song = song;
    this.reset();
  }

  reset() {
    this.beat = this.song ? -this.song.beatsPerBar : 0; // one-bar count-in
    this._lastBeat = this.beat;
    this._lastClick = Math.floor(this.beat) - 1;
    this.onTick();
  }

  get duration() {
    return this.song ? this.song.notes.reduce((m, n) => Math.max(m, n.start + n.duration), 0) : 0;
  }

  play() {
    if (!this.song || this.playing) return;
    this.audio.unlock();
    if (this.beat >= this.duration) this.reset();
    this.playing = true;
    this._lastTime = performance.now();
    const loop = now => {
      if (!this.playing) return;
      const dt = (now - this._lastTime) / 1000;
      this._lastTime = now;
      const bps = (this.song.bpm * this.speed) / 60;
      this._lastBeat = this.beat;
      this.beat += dt * bps;

      // Count-in clicks on every whole beat before 0
      if (this.beat < 0.0001) {
        const b = Math.floor(this.beat);
        if (b > this._lastClick) { this._lastClick = b; this.audio.tick(((b % this.song.beatsPerBar) + this.song.beatsPerBar) % this.song.beatsPerBar === 0); }
      }
      // Trigger notes whose onset we just crossed
      for (const n of this.song.notes) {
        if (n.start >= this._lastBeat && n.start < this.beat) {
          this.audio.playNote(n.midi, n.duration / bps, n.hand === 'L' ? 0.4 : 0.55);
        }
      }
      if (this.beat >= this.duration + 1) { this.pause(); this.beat = this.duration; }
      this.onTick();
      this._raf = requestAnimationFrame(loop);
    };
    this._raf = requestAnimationFrame(loop);
    this.onTick();
  }

  pause() {
    this.playing = false;
    if (this._raf) cancelAnimationFrame(this._raf);
    this.onTick();
  }
}

// ---------------------------------------------------------------- UI wiring

const $ = id => document.getElementById(id);

const audio = new AudioEngine();
const sheet = new SheetRenderer($('sheet'));
const fall = new FallRenderer($('fall'), audio);
const opts = { noteNames: true, fingers: true };

const player = new Player(audio, render);

function render() {
  sheet.draw(player.song, Math.max(player.beat, 0), opts);
  fall.draw(player.song, player.beat, opts);
  $('play').textContent = player.playing ? '❚❚' : '▶';
  $('play').setAttribute('aria-label', player.playing ? 'Pause' : 'Play');
}

function resize() {
  sheet.resize();
  fall.resize(player.song);
  render();
}

function loadSong(song) {
  fall.resize(song); // compute the new keyboard layout before the first render
  player.load(song);
  render();
}

// Song picker
const select = $('song-select');
const customSongs = [];
function refreshSongList() {
  select.innerHTML = '';
  [...DEMO_SONGS, ...customSongs].forEach((s, i) => {
    const o = document.createElement('option');
    o.value = i; o.textContent = s.title;
    select.appendChild(o);
  });
}
refreshSongList();
select.addEventListener('change', () => loadSong([...DEMO_SONGS, ...customSongs][+select.value]));

// Transport
$('play').addEventListener('click', () => player.playing ? player.pause() : player.play());
$('reset').addEventListener('click', () => { player.pause(); player.reset(); });

// Speed
const speedInput = $('speed');
speedInput.addEventListener('input', () => {
  player.speed = +speedInput.value;
  $('speed-label').textContent = `${Math.round(player.speed * 100)}%`;
});

// Beginner toggles
$('toggle-names').addEventListener('change', e => { opts.noteNames = e.target.checked; render(); });
$('toggle-fingers').addEventListener('change', e => { opts.fingers = e.target.checked; render(); });
$('toggle-sound').addEventListener('change', e => { audio.enabled = e.target.checked; });

// MusicXML import
$('import-btn').addEventListener('click', () => $('file-input').click());
$('file-input').addEventListener('change', async e => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const buf = await file.arrayBuffer();
    const head = new Uint8Array(buf.slice(0, 2));
    if (head[0] === 0x50 && head[1] === 0x4B) { // zip magic: compressed .mxl
      throw new Error('Compressed .mxl files aren’t supported yet — export as uncompressed MusicXML (.musicxml or .xml) instead.');
    }
    const song = parseMusicXML(new TextDecoder().decode(buf));
    customSongs.push(song);
    refreshSongList();
    select.value = String(DEMO_SONGS.length + customSongs.length - 1);
    loadSong(song);
    showToast(`Imported “${song.title}” — ${song.notes.length} notes`);
  } catch (err) {
    showToast(err.message, true);
  }
  e.target.value = '';
});

let toastTimer;
function showToast(msg, isError = false) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.toggle('error', isError);
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 4000);
}

// Boot
window.addEventListener('resize', resize);
sheet.resize();
fall.resize(null);
loadSong(DEMO_SONGS[0]);

// Offline support (PWA)
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(() => { /* offline support is optional */ });
}
