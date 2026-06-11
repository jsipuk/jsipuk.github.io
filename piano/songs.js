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

// Combine hands (or any parts) into one sorted note list.
function merge(...parts) {
  return parts.flat().sort((a, b) => a.start - b.start || a.midi - b.midi);
}

const C3 = 48, D3 = 50, Eb3 = 51, E3 = 52, F3 = 53, G3 = 55, Ab3 = 56, A3 = 57, B3 = 59;
const C4 = 60, D4 = 62, Eb4 = 63, E4 = 64, F4 = 65, G4 = 67, Ab4 = 68, A4 = 69, B4 = 71;
const C5 = 72, D5 = 74, E5 = 76, F5 = 77, G5 = 79;

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
    title: 'Exercise: Scale — Both Hands',
    bpm: 60,
    beatsPerBar: 4,
    // Parallel motion, left hand one octave below the right.
    notes: merge(
      seq('R', [
        [C4, 1, 1], [D4, 1, 2], [E4, 1, 3], [F4, 1, 1],
        [G4, 1, 2], [A4, 1, 3], [B4, 1, 4], [C5, 1, 5],
        [C5, 1, 5], [B4, 1, 4], [A4, 1, 3], [G4, 1, 2],
        [F4, 1, 1], [E4, 1, 3], [D4, 1, 2], [C4, 1, 1],
      ]),
      seq('L', [
        [C3, 1, 5], [D3, 1, 4], [E3, 1, 3], [F3, 1, 2],
        [G3, 1, 1], [A3, 1, 3], [B3, 1, 2], [C4, 1, 1],
        [C4, 1, 1], [B3, 1, 2], [A3, 1, 3], [G3, 1, 1],
        [F3, 1, 2], [E3, 1, 3], [D3, 1, 4], [C3, 1, 5],
      ]),
    ),
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
    title: 'Ode to Joy — Two Hands',
    bpm: 90,
    beatsPerBar: 4,
    notes: merge(
      seq('R', [
        [E4, 1, 3], [E4, 1, 3], [F4, 1, 4], [G4, 1, 5],
        [G4, 1, 5], [F4, 1, 4], [E4, 1, 3], [D4, 1, 2],
        [C4, 1, 1], [C4, 1, 1], [D4, 1, 2], [E4, 1, 3],
        [E4, 1.5, 3], [D4, 0.5, 2], [D4, 2, 2],
        [E4, 1, 3], [E4, 1, 3], [F4, 1, 4], [G4, 1, 5],
        [G4, 1, 5], [F4, 1, 4], [E4, 1, 3], [D4, 1, 2],
        [C4, 1, 1], [C4, 1, 1], [D4, 1, 2], [E4, 1, 3],
        [D4, 1.5, 2], [C4, 0.5, 1], [C4, 2, 1],
      ]),
      // Simple half-note accompaniment: chord roots and thirds.
      seq('L', [
        [C3, 2, 5], [E3, 2, 3],
        [C3, 2, 5], [G3, 2, 1],
        [C3, 2, 5], [E3, 2, 3],
        [G3, 2, 1], [G3, 2, 1],
        [C3, 2, 5], [E3, 2, 3],
        [C3, 2, 5], [G3, 2, 1],
        [C3, 2, 5], [E3, 2, 3],
        [G3, 2, 1], [C3, 2, 5],
      ]),
    ),
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
  {
    title: 'Happy Birthday — Two Hands',
    bpm: 90,
    beatsPerBar: 3,
    // Public domain (melody copyright invalidated in 2016). In 3/4 with a
    // two-quaver pickup, padded with a leading rest to keep bars aligned.
    notes: merge(
      seq('R', [
        [null, 2], [G4, 0.5, 1], [G4, 0.5, 1],
        [A4, 1, 2], [G4, 1, 1], [C5, 1, 4],
        [B4, 2, 3], [G4, 0.5, 1], [G4, 0.5, 1],
        [A4, 1, 2], [G4, 1, 1], [D5, 1, 5],
        [C5, 2, 4], [G4, 0.5, 1], [G4, 0.5, 1],
        [G5, 1, 5], [E5, 1, 3], [C5, 1, 1],
        [B4, 1, 2], [A4, 1, 1], [F5, 0.5, 4], [F5, 0.5, 4],
        [E5, 1, 3], [C5, 1, 1], [D5, 1, 2],
        [C5, 3, 1],
      ]),
      // One bass note per bar: C | G | G | C | C | F | G | C
      seq('L', [
        [null, 3],
        [C3, 3, 5], [G3, 3, 1], [G3, 3, 1], [C3, 3, 5],
        [C3, 3, 5], [F3, 3, 2], [G3, 3, 1], [C3, 3, 5],
      ]),
    ),
  },
  {
    title: 'Symphony No. 5 Theme (Beethoven)',
    bpm: 100,
    beatsPerBar: 2,
    // Simplified arrangement of the opening motif in C minor (2/4),
    // hands in octaves. E♭/A♭ display as D♯/G♯ for now (sharps only).
    notes: merge(
      seq('R', [
        [null, 0.5], [G4, 0.5, 3], [G4, 0.5, 3], [G4, 0.5, 3], [Eb4, 4, 1],
        [null, 0.5], [F4, 0.5, 2], [F4, 0.5, 2], [F4, 0.5, 2], [D4, 4, 1],
        [null, 0.5], [G4, 0.5, 3], [G4, 0.5, 3], [G4, 0.5, 3], [Eb4, 2, 1],
        [null, 0.5], [Ab4, 0.5, 4], [Ab4, 0.5, 4], [Ab4, 0.5, 4], [G4, 2, 3],
        [null, 0.5], [F4, 0.5, 2], [F4, 0.5, 2], [F4, 0.5, 2], [D4, 2, 1],
        [C4, 4, 1],
      ]),
      seq('L', [
        [null, 0.5], [G3, 0.5, 1], [G3, 0.5, 1], [G3, 0.5, 1], [Eb3, 4, 3],
        [null, 0.5], [F3, 0.5, 2], [F3, 0.5, 2], [F3, 0.5, 2], [D3, 4, 4],
        [null, 0.5], [G3, 0.5, 1], [G3, 0.5, 1], [G3, 0.5, 1], [Eb3, 2, 3],
        [null, 0.5], [Ab3, 0.5, 1], [Ab3, 0.5, 1], [Ab3, 0.5, 1], [G3, 2, 2],
        [null, 0.5], [F3, 0.5, 2], [F3, 0.5, 2], [F3, 0.5, 2], [D3, 2, 4],
        [C3, 4, 5],
      ]),
    ),
  },
];
