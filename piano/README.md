# Aria — Piano Practice

A framework-free piano learning app for iPad (and any modern browser), served
at `/piano/` on the site. Scrolling sheet music on top, a Guitar Hero-style
falling-note visualiser with an on-screen keyboard below.

## Files

| File | Purpose |
| --- | --- |
| `index.html` | App shell: top bar (song picker, import + help, transport, A–B loop, hands, speed, toggles) + two canvas panels |
| `style.css` | Layout and theme. Dark "stage" UI with a paper-coloured sheet panel |
| `app.js` | All app logic: `AudioEngine`, `KeyboardLayout`, `SheetRenderer`, `FallRenderer`, `Player`, UI wiring |
| `songs.js` | Demo songs/exercises in the internal song format (documented at the top of the file) |
| `musicxml.js` | MusicXML importer: uncompressed `.musicxml`/`.xml` and compressed `.mxl` (browser-native unzip) |
| `demo.musicxml` | Sample file for testing the Import button |
| `samples/` | One piano sample per octave (FluidR3 GM soundfont, MIT licence), pitch-shifted to cover all notes |
| `test/run.js` | Node test suite — `node piano/test/run.js` (MusicXML tests need `npm i linkedom`) |
| `sw.js`, `manifest.webmanifest`, `icons/` | PWA: offline cache + Add to Home Screen |

## Concepts

- **Time is in beats** (quarter notes). The `Player` advances `beat` each
  animation frame by `dt × bpm × speed / 60` and triggers Web Audio notes as
  their onsets are crossed. Playback starts at `-beatsPerBar` for a one-bar
  count-in with metronome clicks.
- **Wait mode** (`waitMode` predicate): instead of crossing an onset, the
  player clamps to it and arms `waiting` — a Set of midi numbers. Key taps go
  through `keyPressed()`; when the set empties, playback resumes. In this
  mode the user's taps make the sound, not the scheduler.
- **A–B loop** (`player.loop = {start, end}` in beats): the frame loop wraps
  the beat back to `start` when it reaches `end`. `seek()` and the wrap both
  land an epsilon *before* the target so an onset exactly there still fires.
- **Song format**: `{ title, bpm, beatsPerBar, notes: [{ midi, start, duration, finger?, hand? }] }`.
  Anything that can be converted to this format (MIDI files, other notation
  formats) can be played — importers just need to produce it.
- **`KeyboardLayout`** computes key x-positions once per song/resize; both the
  falling notes and the drawn keyboard use it, so they always align.
- **Persistence**: settings (song, speed, hands, toggles) live in
  `localStorage['aria-settings']`; imported songs in `aria-imports`.

## Releasing changes

Bump `VERSION` in `sw.js` whenever app-shell files change, or returning
visitors will keep the old cached version. Run `node piano/test/run.js`
before pushing.

## Credits

Piano samples are single notes from the FluidR3 GM soundfont via
[gleitz/midi-js-soundfonts](https://github.com/gleitz/midi-js-soundfonts) (MIT).

## Roadmap (not yet implemented)

- Web MIDI input for real keyboards (not in iPad Safari; works in Chrome desktop)
- Repeats/voltas, tuplets, grace notes, key signatures in the importer
- Beamed notes and proper engraving in the sheet renderer
- Removing songs from the imported library; IndexedDB once libraries grow
- Curated CC0 starter library from the OpenScore corpus
- GitHub Action running `piano/test/run.js` on push
