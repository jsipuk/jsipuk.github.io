# The Ruler of Three Faces

*A kingdom remembers every choice.*

A text-first interactive fantasy RPG, built as a polished vertical slice covering the
first two chapters of a much larger design: **The Gate** (the password tutorial) and
**Secrets of the Palace** (exploration, characters, items, and the first threads of the
main mystery).

**Play it at:** `/ruler-of-three-faces/`

---

## What's in the vertical slice

- **Welcome page** — dark, refined fantasy aesthetic; palace silhouette, mist, stars.
- **Character creation** — name, pronouns, 8 backgrounds, 7 temperaments (each grants a
  small skill bonus and flavour), or skip and play as *The Traveller*.
- **Chapter I — The Gate**: a friendly, honourable knight who will not reveal the
  password. Persuade, deceive, challenge, claim authority, distract, bribe, plead or
  guess — via suggested choices **or free text**. Saying the password (`magic`) in any
  reasonable context — even buried in a longer sentence or a question — grants entry.
  The guard never reveals it, though he drops an in-character hint after enough turns.
- **Chapter II — Secrets of the Palace**: the Grand Hall hub plus six explorable
  locations (west corridor, library, gardens, alchemy room, dungeon stair, throne-room
  doors), four core characters (Sir Cedric, Lady Eleanor, Lady Elspeth, Master Harold),
  and the chapter's key discoveries: the hidden safe behind the first king's portrait,
  the ornate dagger, the sealed scroll, the Rose of Eternity, the Elixir of Vigor, and
  the rumour of Prisoner G.
- **Systems**: inventory, characters, quests, journal (chronicle-style), codex (records
  only what you have genuinely discovered), 10 achievements (4 hidden), interactive
  free-text parser, suggested choices, scene art (inline SVG, subtle).
- **Saves**: autosave after every action, 3 named manual slots, export/import save as
  JSON (validated on import), story transcript export as Markdown.
- **Settings & accessibility**: text size (3 steps), high-contrast mode, reduced motion,
  dyslexia-friendly font, keyboard navigation, visible focus states, `aria-live` story
  log, respects `prefers-reduced-motion`.
- **Responsive**: three-column desktop layout → two-column → single-column mobile with
  bottom navigation and slide-out drawers.
- **Debug view**: append `?debug=1` to the URL for a 🐞 button that shows the full live
  game state (not linked from the normal UI).

## Architecture

Pure static web app — no build step, no dependencies, no server.

```
ruler-of-three-faces/
├── index.html          App shell: welcome / creation / game screens, modals
├── style.css           Design system (dark fantasy, gold accents, a11y modes)
├── js/
│   ├── data.js         Static content: items, characters, quests, achievements,
│   │                   codex, locations, backgrounds (seed data)
│   ├── engine.js       Narrative engine: state model, free-text interpretation,
│   │                   password recognition, quests/achievements/journal/codex.
│   │                   No DOM access — runs in browser and Node.
│   └── ui.js           Rendering, tabs, saves, settings, modals. All state changes
│                       flow through the engine; the UI only renders events.
└── test/
    └── run-tests.mjs   Node test suite (57 assertions)
```

### The event contract

Every player action goes through `Engine.perform(state, action)` which returns an
ordered list of typed events (`scene`, `narrative`, `dialogue`, `thought`, `system`,
`item`, `achievement`, `quest`). This mirrors the structured-JSON response schema the
full design specifies for a server-side AI narrator — when an AI endpoint is added, it
slots in behind the same contract and the UI does not change. Saves are versioned
(`saveVersion`) and validated on load/import; unknown items are stripped and
incompatible versions rejected rather than half-loaded.

## Running & testing

It's a static site — open `index.html` via any web server:

```sh
cd ruler-of-three-faces
python3 -m http.server 8000    # then visit http://localhost:8000
```

Run the engine test suite (password recognition, gate flow, achievements, exploration
state updates, save validation):

```sh
node test/run-tests.mjs
```

## Assumptions & deviations from the full brief

The full build prompt assumes a hosted stack (Next.js, PostgreSQL, Prisma, server-side
AI requests, auth). **This repository is a GitHub Pages static site**, so this slice
deliberately adapts:

| Brief item | Decision here |
|---|---|
| Next.js / React / Tailwind | Vanilla HTML/CSS/JS, matching every other app in this repo; no build step |
| PostgreSQL + Prisma + migrations | `localStorage` with versioned, validated save data; JSON export/import as the portable format |
| Server-side AI narrator | Deterministic rule-based narrative engine behind the same structured event contract, so an AI endpoint can be swapped in later without UI changes |
| Auth + cloud saves | Local saves + file export (no server to authenticate against) |
| Environment variable template | Not applicable — there are no secrets in a static, serverless build. When the AI endpoint is added it must live behind a server (see roadmap); API keys must never ship to the client |
| Sound design | Deferred (roadmap); settings modal notes it will be optional with independent volume controls |
| Admin/content CMS | Minimal `?debug=1` state inspector; a content editor only makes sense once content is data-driven from a backend |
| Kingdom management, map | Present as in-fiction placeholders (Realm and Map tabs) as the brief's deliverables list requests |

Other notable design decisions:

- The password matcher requires `magic` as a whole word — “magical”/“magician” do not
  count, which keeps the guard a stickler and the puzzle honest.
- *The Password Was in the Question* unlocks when the password arrives inside a longer
  sentence ending in `?`; a bare one-word guess never triggers it.
- *Social Engineer* counts **distinct** approach categories (clue, claim, challenge,
  authority, distraction, bribe, threat, pleading, guessing), not raw attempts.
- Impossible free-text actions are refused in-world (“You possess no spell, machine or
  creature capable of such a thing — yet.”) rather than with an error message.
- UK English throughout, per the narrator brief.

## Roadmap (subsequent acts)

1. **Act III — Rise to Power**: the dungeon proper, Lord William (Prisoner G), the
   poisoned tooth, the trial of the king, multiple paths to (or away from) the throne.
2. **AI narrator endpoint**: a small server (e.g. Cloudflare Worker / Vercel function)
   implementing the event contract with model-generated narration, state validation on
   every response, and the compact game-state prompt described in the design (recent
   events + summarised history, never the full transcript).
3. **Act IV — Rule of the Kingdom**: the Realm tab becomes live — treasury, food,
   approval, factions (Silent Brotherhood, Iron Circle, Order of the One God), policies
   with costs, supporters and hidden consequences; time-jump reports.
4. **Act V–VI — The Trinity and the Sunken Temple**: relic mechanics (dagger + amulet +
   staff + crown), the *Crown of Tides* expedition, prophecy alignment.
5. **Act VII + second-act anomaly arc**: endings, the Grand Parade, and the temporal
   anomaly arc (the Library Beyond Time, the Forge of the First King, the Garden of
   Forgotten Names).
6. **Platform**: sound design (optional, subtle), cloud saves, content tooling,
   full stylised map.
