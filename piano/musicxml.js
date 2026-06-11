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
