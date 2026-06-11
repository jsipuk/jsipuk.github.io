/* Minimal MusicXML importer.
 *
 * Converts an uncompressed MusicXML document (.musicxml / .xml) into the
 * app's song format (see songs.js). Scope for the MVP:
 *   - first <part> only
 *   - pitch, duration, chords, ties, rests
 *   - <backup>/<forward> (so multi-voice piano parts keep correct timing)
 *   - tempo (first <sound tempo>) and time signature (first <time>)
 *   - staff 2 → left hand, staff 1 → right hand
 *
 * Not handled yet: compressed .mxl (zip), repeats/voltas, tuplet timing
 * beyond what <duration> already encodes, grace notes (skipped), dynamics.
 */

const STEP_TO_SEMITONE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

function parseMusicXML(xmlText) {
  const doc = new DOMParser().parseFromString(xmlText, 'application/xml');
  if (doc.querySelector('parsererror')) {
    throw new Error('Not valid XML. If this is a .mxl file, export it as uncompressed MusicXML.');
  }
  const part = doc.querySelector('part');
  if (!part) throw new Error('No <part> found in this MusicXML file.');

  const title =
    doc.querySelector('work > work-title')?.textContent.trim() ||
    doc.querySelector('movement-title')?.textContent.trim() ||
    'Imported song';

  let divisions = 1;          // MusicXML ticks per quarter note
  let bpm = 90;
  let beatsPerBar = 4;
  let sawTempo = false, sawTime = false;

  const notes = [];
  let cursor = 0;             // current time in beats
  let lastNote = null;        // for <chord/> alignment
  const openTies = new Map(); // midi -> note awaiting tie stop

  for (const measure of part.querySelectorAll(':scope > measure')) {
    for (const el of measure.children) {
      switch (el.tagName) {
        case 'attributes': {
          const div = el.querySelector('divisions');
          if (div) divisions = parseFloat(div.textContent) || divisions;
          const time = el.querySelector('time');
          if (time && !sawTime) {
            const beats = parseInt(time.querySelector('beats')?.textContent, 10);
            const beatType = parseInt(time.querySelector('beat-type')?.textContent, 10);
            if (beats && beatType) {
              beatsPerBar = beats * (4 / beatType); // normalise to quarter-note beats
              sawTime = true;
            }
          }
          break;
        }
        case 'sound':
        case 'direction': {
          const sound = el.tagName === 'sound' ? el : el.querySelector('sound');
          const tempo = sound?.getAttribute('tempo');
          if (tempo && !sawTempo) { bpm = parseFloat(tempo); sawTempo = true; }
          break;
        }
        case 'backup':
          cursor -= ticksToBeats(el, divisions);
          break;
        case 'forward':
          cursor += ticksToBeats(el, divisions);
          break;
        case 'note': {
          if (el.querySelector('grace')) break; // grace notes: skip for MVP
          const beats = ticksToBeats(el, divisions);
          const isChord = !!el.querySelector('chord');
          const start = isChord && lastNote ? lastNote.start : cursor;

          if (el.querySelector('rest')) {
            if (!isChord) cursor += beats;
            break;
          }

          const pitch = el.querySelector('pitch');
          if (pitch) {
            const step = pitch.querySelector('step')?.textContent.trim();
            const octave = parseInt(pitch.querySelector('octave')?.textContent, 10);
            const alter = parseFloat(pitch.querySelector('alter')?.textContent || '0');
            if (step in STEP_TO_SEMITONE && !Number.isNaN(octave)) {
              const midi = (octave + 1) * 12 + STEP_TO_SEMITONE[step] + alter;
              const staff = parseInt(el.querySelector('staff')?.textContent || '1', 10);
              const tieTypes = [...el.querySelectorAll(':scope > tie')].map(t => t.getAttribute('type'));

              if (tieTypes.includes('stop') && openTies.has(midi)) {
                openTies.get(midi).duration += beats;        // extend the tied note
                if (!tieTypes.includes('start')) openTies.delete(midi);
              } else {
                const note = { midi, start, duration: beats, hand: staff === 2 ? 'L' : 'R' };
                notes.push(note);
                if (tieTypes.includes('start')) openTies.set(midi, note);
              }
            }
          }
          if (!isChord) { cursor += beats; lastNote = { start }; }
          else lastNote = { start };
          break;
        }
      }
    }
    cursor = Math.max(cursor, 0);
  }

  if (notes.length === 0) throw new Error('No playable notes found in the first part.');
  notes.sort((a, b) => a.start - b.start || a.midi - b.midi);
  // Normalise so the first note starts on beat 0 (drops leading silence).
  const offset = notes[0].start;
  if (offset > 0) for (const n of notes) n.start -= offset;

  return { title, bpm, beatsPerBar, notes };
}

function ticksToBeats(el, divisions) {
  const d = parseFloat(el.querySelector(':scope > duration')?.textContent || '0');
  return divisions > 0 ? d / divisions : 0;
}

/* Extract the score XML from a compressed .mxl file (a zip archive).
 * Uses the browser-native DecompressionStream — no zip library needed. */
async function extractMusicXMLFromMxl(buf) {
  if (typeof DecompressionStream === 'undefined') {
    throw new Error('This device can’t unzip .mxl files (needs iPadOS 16.4+). Export as uncompressed MusicXML instead.');
  }
  const dv = new DataView(buf);
  const td = new TextDecoder();

  // Find the zip End Of Central Directory record, then walk the directory.
  let p = buf.byteLength - 22;
  while (p >= 0 && dv.getUint32(p, true) !== 0x06054b50) p--;
  if (p < 0) throw new Error('Could not read this .mxl file (no zip directory found).');
  const count = dv.getUint16(p + 10, true);
  let off = dv.getUint32(p + 16, true);

  const entries = [];
  for (let i = 0; i < count && dv.getUint32(off, true) === 0x02014b50; i++) {
    const method = dv.getUint16(off + 10, true);
    const csize = dv.getUint32(off + 20, true);
    const nameLen = dv.getUint16(off + 28, true);
    const extraLen = dv.getUint16(off + 30, true);
    const commentLen = dv.getUint16(off + 32, true);
    const headerOff = dv.getUint32(off + 42, true);
    entries.push({ name: td.decode(new Uint8Array(buf, off + 46, nameLen)), method, csize, headerOff });
    off += 46 + nameLen + extraLen + commentLen;
  }

  const inflate = async e => {
    const nameLen = dv.getUint16(e.headerOff + 26, true);
    const extraLen = dv.getUint16(e.headerOff + 28, true);
    const data = new Uint8Array(buf, e.headerOff + 30 + nameLen + extraLen, e.csize);
    if (e.method === 0) return td.decode(data); // stored, not compressed
    if (e.method !== 8) throw new Error('Unsupported compression inside this .mxl file.');
    const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return new Response(stream).text();
  };

  // META-INF/container.xml names the main score file; fall back to the
  // first .xml/.musicxml entry outside META-INF.
  let main = null;
  const container = entries.find(e => e.name === 'META-INF/container.xml');
  if (container) {
    const m = (await inflate(container)).match(/full-path="([^"]+)"/);
    if (m) main = entries.find(e => e.name === m[1]);
  }
  if (!main) main = entries.find(e => /\.(musicxml|xml)$/i.test(e.name) && !e.name.startsWith('META-INF'));
  if (!main) throw new Error('No MusicXML score found inside the .mxl file.');
  return inflate(main);
}
