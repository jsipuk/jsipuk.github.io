# Departures

Six small games for the airport and the plane, at [jsip.uk/departures](https://jsip.uk/departures/).

Built for a family journey: one phone, no signal, two kids of different ages and
a parent who would quite like a turn too.

## The games

| Game | Players | Ages | What it is |
| --- | --- | --- | --- |
| Cloud Hop | 1 | 4+ | One-tap endless flyer. Two difficulties — gentle has big gaps for small hands. |
| Baggage Match | 1–2 | 3+ | Pairs. Three picture packs, three board sizes, solo timer or pass-and-play. |
| Dots & Boxes | 1–2 | 6+ | The paper classic, with a phone opponent that plays a sensible game. |
| Sky Quiz | 1+ | 4+ | ~110 questions across three levels, solo or two teams. |
| Word Wings | 1 | 9+ | Seven letters, every word hiding in them. No timer; saves as you play. |
| Airport Bingo | any | 3+ | Sixteen things to spot around you. Three decks, three different cards. |

## How it works offline

Everything is precached by `sw.js` on first load and served cache-first
afterwards, so the whole pack runs in flight mode. It is installable to a home
screen via `manifest.webmanifest` and then opens without a browser bar.

Scores, saved puzzles and half-finished bingo cards live in `localStorage` under
the `departures:` prefix. Nothing is sent anywhere, and there is no network call
of any kind after the first visit — no fonts, no analytics, no CDN.

Sound is **off** by default (cabins are quiet) and the theme is **dark** by
default (cabins are dark, and it is easier on the battery). Both are in ⚙.

## Structure

```
index.html                 shell markup
app.js                     registry, routing, storage, sound, DOM helpers
data.js                    quiz bank, bingo decks, memory picture sets
words.js                   generated word list for Word Wings
games/*.js                 one file per game, each self-registering
boot.js                    starts the shell once every game has registered
sw.js                      precache + cache-first service worker
```

A game registers itself with `window.Departures.register({...})` and gets a
`mount(root, api)` call when opened; whatever it returns is used as a teardown
function. `api` carries storage, sound, haptics, a small `h()` DOM helper and a
few utilities. Adding a seventh game means adding one file and one `<script>`
tag — plus its path in the `ASSETS` list in `sw.js`, or it will not be there
when the wi-fi is.

Bump `CACHE` in `sw.js` whenever a file changes, so returning devices pick up
the new version.

### Regenerating the word list

`words.js` is generated from a public-domain frequency list of common English
words, filtered to 3–7 letters and screened for family-friendly play. The build
script lives in `tools/build-words.js`; it expects `words.txt` (the source list)
alongside it.
