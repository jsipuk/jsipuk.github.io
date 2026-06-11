# Aria — Piano Practice

A framework-free piano learning app for iPad (and any modern browser), served
at `/piano/` on the site. Scrolling sheet music on top, a Guitar Hero-style
falling-note visualiser with an on-screen keyboard below.

## Files

| File | Purpose |
| --- | --- |
| `index.html` | App shell: top bar (song picker, import, transport, speed, toggles) + two canvas panels |
| `style.css` | Layout and theme. Dark "stage" UI with a paper-coloured sheet panel |
| `app.js` | All app logic: `AudioEngine`, `KeyboardLayout`, `SheetRenderer`, `FallRenderer`, `Player`, UI wiring |
| `songs.js` | Demo songs/exercises in the internal song format (documented at the top of the file) |
| `musicxml.js` | Minimal MusicXML → song-format importer (uncompressed `.musicxml`/`.xml`) |
| `demo.musicxml` | Sample file for testing the Import button |
| `sw.js`, `manifest.webmanifest`, `icons/` | PWA: offline cache + Add to Home Screen |

## Concepts

- **Time is in beats** (quarter notes). The `Player` advances `beat` each
  animation frame by `dt × bpm × speed / 60` and triggers Web Audio notes as
  their onsets are crossed. Playback starts at `-beatsPerBar` for a one-bar
  count-in with metronome clicks.
- **Song format**: `{ title, bpm, beatsPerBar, notes: [{ midi, start, duration, finger?, hand? }] }`.
  Anything that can be converted to this format (MIDI files, other notation
  formats) can be played — importers just need to produce it.
- **`KeyboardLayout`** computes key x-positions once per song/resize; both the
  falling notes and the drawn keyboard use it, so they always align.

## Releasing changes

Bump `VERSION` in `sw.js` whenever app-shell files change, or returning
visitors will keep the old cached version.

## Roadmap (not yet implemented)

- Compressed `.mxl` import (unzip via `DecompressionStream`, then reuse `parseMusicXML`)
- MIDI file import and Web MIDI input (scoring what the user actually plays)
- Repeats/voltas, tuplets, grace notes, key signatures in the importer
- Beamed notes and proper engraving in the sheet renderer
- Wait-for-note practice mode and per-hand mute
