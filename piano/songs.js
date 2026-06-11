/* Demo songs and exercises.
 *
 * Song format (the app's internal representation — imports convert to this):
 *   title         display name
 *   bpm           default tempo (quarter notes per minute)
 *   beatsPerBar   time signature numerator (4/4 assumed, denominator = quarter)
 *   notes         array of { midi, start, duration, finger?, hand? }
 *     midi        MIDI note number (60 = middle C)
 *     start       onset in beats from 0
 *     duration    length in beats
 *     finger      1–5, optional (thumb = 1)
 *     hand        'R' or 'L', optional (defaults to 'R')
 *
 * All demo material is public-domain (folk tunes / Beethoven) or original.
 */

// Tiny helper to write melodies compactly: seq(startBeat, [[midi, dur, finger], ...])
function seq(hand, pairs) {
  let t = 0;
  return pairs.map(([midi, duration, finger]) => {
    if (midi === null) { t += duration; return null; } // rest
    const n = { midi, start: t, duration, hand };
    if (finger) n.finger = finger;
    t += duration;
    return n;
  }).filter(Boolean);
}

const C4 = 60, D4 = 62, E4 = 64, F4 = 65, G4 = 67, A4 = 69, B4 = 71, C5 = 72;

const DEMO_SONGS = [
  {
    title: 'Exercise: C Major Scale',
    bpm: 70,
    beatsPerBar: 4,
    notes: seq('R', [
      [C4, 1, 1], [D4, 1, 2], [E4, 1, 3], [F4, 1, 1],
      [G4, 1, 2], [A4, 1, 3], [B4, 1, 4], [C5, 1, 5],
      [C5, 1, 5], [B4, 1, 4], [A4, 1, 3], [G4, 1, 2],
      [F4, 1, 1], [E4, 1, 3], [D4, 1, 2], [C4, 1, 1],
    ]),
  },
  {
    title: 'Exercise: Five-Finger March',
    bpm: 80,
    beatsPerBar: 4,
    // Original short exercise: steps and skips within the C position.
    notes: seq('R', [
      [C4, 1, 1], [E4, 1, 3], [G4, 1, 5], [E4, 1, 3],
      [F4, 1, 4], [D4, 1, 2], [E4, 1, 3], [C4, 1, 1],
      [D4, 1, 2], [F4, 1, 4], [A4, 2, 5],
      [G4, 1, 5], [E4, 1, 3], [C4, 2, 1],
    ]),
  },
  {
    title: 'Ode to Joy (Beethoven)',
    bpm: 100,
    beatsPerBar: 4,
    notes: seq('R', [
      [E4, 1, 3], [E4, 1, 3], [F4, 1, 4], [G4, 1, 5],
      [G4, 1, 5], [F4, 1, 4], [E4, 1, 3], [D4, 1, 2],
      [C4, 1, 1], [C4, 1, 1], [D4, 1, 2], [E4, 1, 3],
      [E4, 1.5, 3], [D4, 0.5, 2], [D4, 2, 2],
      [E4, 1, 3], [E4, 1, 3], [F4, 1, 4], [G4, 1, 5],
      [G4, 1, 5], [F4, 1, 4], [E4, 1, 3], [D4, 1, 2],
      [C4, 1, 1], [C4, 1, 1], [D4, 1, 2], [E4, 1, 3],
      [D4, 1.5, 2], [C4, 0.5, 1], [C4, 2, 1],
    ]),
  },
  {
    title: 'Twinkle, Twinkle (folk)',
    bpm: 90,
    beatsPerBar: 4,
    notes: seq('R', [
      [C4, 1, 1], [C4, 1, 1], [G4, 1, 5], [G4, 1, 5],
      [A4, 1, 5], [A4, 1, 5], [G4, 2, 5],
      [F4, 1, 4], [F4, 1, 4], [E4, 1, 3], [E4, 1, 3],
      [D4, 1, 2], [D4, 1, 2], [C4, 2, 1],
      [G4, 1, 5], [G4, 1, 5], [F4, 1, 4], [F4, 1, 4],
      [E4, 1, 3], [E4, 1, 3], [D4, 2, 2],
      [G4, 1, 5], [G4, 1, 5], [F4, 1, 4], [F4, 1, 4],
      [E4, 1, 3], [E4, 1, 3], [D4, 2, 2],
      [C4, 1, 1], [C4, 1, 1], [G4, 1, 5], [G4, 1, 5],
      [A4, 1, 5], [A4, 1, 5], [G4, 2, 5],
      [F4, 1, 4], [F4, 1, 4], [E4, 1, 3], [E4, 1, 3],
      [D4, 1, 2], [D4, 1, 2], [C4, 2, 1],
    ]),
  },
  {
    title: 'Mary Had a Little Lamb (folk)',
    bpm: 95,
    beatsPerBar: 4,
    notes: seq('R', [
      [E4, 1, 3], [D4, 1, 2], [C4, 1, 1], [D4, 1, 2],
      [E4, 1, 3], [E4, 1, 3], [E4, 2, 3],
      [D4, 1, 2], [D4, 1, 2], [D4, 2, 2],
      [E4, 1, 3], [G4, 1, 5], [G4, 2, 5],
      [E4, 1, 3], [D4, 1, 2], [C4, 1, 1], [D4, 1, 2],
      [E4, 1, 3], [E4, 1, 3], [E4, 1, 3], [E4, 1, 3],
      [D4, 1, 2], [D4, 1, 2], [E4, 1, 3], [D4, 1, 2],
      [C4, 4, 1],
    ]),
  },
];
