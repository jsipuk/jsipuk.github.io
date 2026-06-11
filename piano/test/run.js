/* Node test runner for the non-browser logic. No framework needed:
 *     node piano/test/run.js
 * The MusicXML/.mxl tests additionally need `npm i linkedom` (anywhere on
 * the module path) for a DOM; they are skipped with a notice if missing.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { execSync } = require('child_process');

const PIANO = path.join(__dirname, '..');
const UI_MARKER = '// ---------------------------------------------------------------- UI wiring';
const read = f => fs.readFileSync(path.join(PIANO, f), 'utf8');
let failures = 0;

async function check(name, fn) {
  try { await fn(); console.log('  ok  ' + name); }
  catch (e) { failures++; console.error('FAIL  ' + name + ': ' + e.message); }
}

function makePlayer() {
  global.window = {};
  let rafCb = null, t = 0;
  global.performance = { now: () => t };
  global.requestAnimationFrame = cb => { rafCb = cb; return 1; };
  global.cancelAnimationFrame = () => {};
  const src = read('app.js');
  const playerSrc = src.slice(src.indexOf('class Player'), src.indexOf(UI_MARKER));
  const Player = new Function(playerSrc + '; return Player;')();
  const played = [];
  const audio = { unlock() {}, tick() {}, playNote(m) { played.push(m); } };
  const p = new Player(audio, () => {});
  return { p, played, step: ms => { t += ms; rafCb(t); } };
}

const SONG = {
  title: 't', bpm: 60, beatsPerBar: 4,
  notes: [
    { midi: 60, start: 0, duration: 1 }, { midi: 64, start: 0, duration: 1 }, // chord
    { midi: 62, start: 1, duration: 1 },
    { midi: 65, start: 2, duration: 2 },
  ],
};

(async () => {
  // -------------------------------------------------------------- songs.js

  const songs = vm.runInContext(read('songs.js') + ';DEMO_SONGS', vm.createContext({}));

  await check('demo songs are well-formed', () => {
    if (songs.length < 5) throw new Error('expected at least 5 demo songs');
    for (const s of songs) {
      if (!s.title || !s.bpm || !s.beatsPerBar) throw new Error('bad meta: ' + s.title);
      let prev = -1;
      const seen = new Set();
      for (const n of s.notes) {
        if (n.midi < 21 || n.midi > 108) throw new Error('midi range: ' + s.title);
        if (n.duration <= 0) throw new Error('duration: ' + s.title);
        if (n.start < prev) throw new Error('order: ' + s.title);
        prev = n.start;
        const k = n.start + '_' + n.midi;
        if (seen.has(k)) throw new Error('unison clash in ' + s.title + ' @' + n.start);
        seen.add(k);
      }
      const total = s.notes.reduce((m, n) => Math.max(m, n.start + n.duration), 0);
      if (total % s.beatsPerBar !== 0) throw new Error(s.title + ' ends off-bar (' + total + ' beats)');
    }
  });

  // -------------------------------------------------------------- Player

  await check('wait mode stops on onsets, chords need every key, no auto audio', () => {
    const { p, played, step } = makePlayer();
    p.waitMode = () => true;
    p.load(SONG);
    p.play();
    for (let i = 0; i < 45; i++) step(100); // through the 4-beat count-in
    if (!p.waiting || Math.abs(p.beat) > 1e-6) throw new Error('not clamped at beat 0: ' + p.beat);
    if (p.waiting.size !== 2) throw new Error('chord should require 2 keys');
    if (p.keyPressed(61) !== false || p.waiting.size !== 2) throw new Error('wrong key consumed');
    p.keyPressed(60); p.keyPressed(64);
    if (p.waiting !== null) throw new Error('chord should release the hold');
    for (let i = 0; i < 16; i++) step(100);
    if (!p.waiting || !p.waiting.has(62)) throw new Error('missed onset at 1 (float drift?): ' + p.beat);
    if (played.length) throw new Error('wait mode must not auto-play');
  });

  await check('A-B loop wraps and replays, seek arms the target onset', () => {
    const { p, played, step } = makePlayer();
    let wait = false;
    p.waitMode = () => wait;
    p.load(SONG);
    p.play();
    for (let i = 0; i < 41; i++) step(100); // count-in done
    p.loop = { start: 0, end: 2 };
    const beats = [];
    for (let i = 0; i < 30; i++) { step(100); beats.push(p.beat); }
    if (Math.max(...beats) >= 2.01) throw new Error('overran loop end');
    if (!beats.some(b => b < 1)) throw new Error('never wrapped');
    if (!played.includes(60) || !played.includes(62)) throw new Error('notes not replayed after wrap');
    wait = true;
    p.loop = null;
    p.seek(2);
    step(100);
    if (!p.waiting || !p.waiting.has(65)) throw new Error('seek missed onset at 2');
  });

  // -------------------------------------------------------------- MusicXML (optional)

  let DOMParser = null;
  try { ({ DOMParser } = require('linkedom')); } catch { /* optional dep */ }

  if (!DOMParser) {
    console.log('skip  MusicXML tests (npm i linkedom to enable)');
  } else {
    const ctx = vm.createContext({ DOMParser, DecompressionStream, Blob, Response, TextDecoder, DataView, Uint8Array });
    const { parse, extract } = vm.runInContext(
      read('musicxml.js') + ';({parse: parseMusicXML, extract: extractMusicXMLFromMxl})', ctx);

    await check('parses demo.musicxml: pitch, tie merge, tempo, meter', () => {
      const song = parse(read('demo.musicxml'));
      if (song.notes.length !== 11) throw new Error('expected 11 notes, got ' + song.notes.length);
      if (!song.notes.some(n => n.midi === 66)) throw new Error('missing F#4');
      const last = song.notes[song.notes.length - 1];
      if (last.midi !== 69 || last.duration !== 4) throw new Error('tie not merged');
      if (song.bpm !== 84 || song.beatsPerBar !== 4) throw new Error('meta wrong');
    });

    await check('.mxl round-trip via zip + DecompressionStream', async () => {
      const mxl = '/tmp/aria-test.mxl';
      const py = `
import zipfile
c = '<?xml version="1.0"?><container><rootfiles><rootfile full-path="score.xml"/></rootfiles></container>'
with zipfile.ZipFile('${mxl}','w',zipfile.ZIP_DEFLATED) as z:
    z.writestr('META-INF/container.xml', c)
    z.writestr('score.xml', open('${path.join(PIANO, 'demo.musicxml')}').read())
`;
      fs.writeFileSync('/tmp/aria-make-mxl.py', py);
      execSync('python3 /tmp/aria-make-mxl.py');
      const buf = fs.readFileSync(mxl);
      const xml = await extract(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
      const song = parse(xml);
      if (song.notes.length !== 11) throw new Error('mxl parse mismatch');
    });
  }

  console.log(failures ? `\n${failures} test(s) FAILED` : '\nAll tests passed');
  process.exitCode = failures ? 1 : 0;
})();
