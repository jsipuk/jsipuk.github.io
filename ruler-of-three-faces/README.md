# The Ruler of Three Faces

*A kingdom remembers every choice.*

A text-first interactive narrative RPG. You arrive at a palace gate with no title,
no army and no claim to greatness — and begin a story that can lead to a throne,
ancient relics, and a prophecy of Three Faces.

**Play it:** open `index.html` (or visit `/ruler-of-three-faces/` on the deployed site).
**Run the tests:** open `tests.html` — 30 headless tests against the state model and
narrative engine run automatically in the browser.

---

## What is in this release (Act I vertical slice)

- **Welcome page** with animated mist, palace silhouette, and main menu.
- **Character creation** — name, pronouns, optional title, 8 backgrounds,
  7 personality tendencies (small skill/gold bonuses, never a class lock),
  plus a one-click *skip* that starts you as The Traveller.
- **Chapter 1 — The Gate.** A friendly, honourable gatekeeper admits only those who
  speak the password. He never reveals it. Persuade, bribe, threaten, deceive,
  extract letters, guess — or say the word, even by accident inside a question.
- **Chapter 2 — Secrets of the Palace.** Six explorable locations: the Grand Hall,
  West Corridor, Royal Library, Royal Gardens, Alchemy Room and Dungeon Stair.
- **Five core characters** — Sir Cedric, Lady Eleanor, Lady Elspeth, Master Harold,
  Warden Pike — plus the Gatekeeper and a certain Prisoner G. Characters remember
  you: relationships (trust/respect/affection) shift with your behaviour and are
  summarised in the HUD.
- **A hidden safe** behind a crooked portrait, opened by a year you must find in
  the library ("743 of the Old Reckoning"), yielding the **Ornate Dagger** and a
  **Sealed Scroll**.
- **Items with depth** — the Rose of Eternity Bud (earned through the gardener's
  trust), the Elixir of Vigor (usable, with an unlisted side effect), and the
  dagger whose inscription Lady Elspeth can only partly read.
- **Free-text actions everywhere** — "What do you do?" accepts anything reasonable.
  Impossible actions are refused *in-world* ("You possess no spell, machine, or
  creature capable of such a journey…"), never with a flat error.
- **Quests** (5), **achievements** (10, some hidden), **chronicle-style journal**,
  **codex** that only contains what you have actually discovered, and a
  **kingdom/map placeholder** in the roadmap below.
- **Save system** — autosave every turn, 3 named manual slots, JSON export/import,
  full story transcript export as Markdown. Saves are versioned and validated on load.
- **Accessibility** — adjustable text size, high-contrast mode, reduced motion
  (also honours `prefers-reduced-motion`), dyslexia-friendly font option, keyboard
  focus states, `aria-live` story log, screen-reader labels.
- **Responsive** — three-panel desktop layout; single-column mobile layout with
  slide-out Character and Records drawers.

## Architecture

Static, dependency-free vanilla JS. Four modules on a shared `ROTF` namespace:

| File | Responsibility |
|---|---|
| `js/data.js` | All seed content: items, characters, locations, quests, achievements, codex |
| `js/state.js` | Game-state factory, mutation helpers, save/load/validate — DOM-free |
| `js/engine.js` | Narrative engine: scenes, choice handlers, free-text parser, password recognition — DOM-free |
| `js/ui.js` | Screens, story log rendering, panels, settings, save slots, mobile drawers |

`Engine.turn(state, action)` mutates state and returns render instructions
(`{entries, choices}`), so the whole game can be driven headlessly — which is
exactly what `js/tests.js` does.

### Password recognition

The password (`magic`) is matched as a whole word, case-insensitively, anywhere
in the player's input — so *"What is so magic about the password?"* opens the
gate (and unlocks a hidden achievement). Substrings like *magical* do **not**
match. Gate attempts are classified into approach families (persuasion, bribery,
threats, letter-extraction, claimed authority, distraction, deception, probing);
five distinct approaches unlock **Social Engineer**.

## Documented assumptions

The original brief specifies Next.js, PostgreSQL, Prisma, server-side AI calls
and authentication. This repository is a **static GitHub Pages site** (all other
projects here are static subdirectories), which cannot host a backend and cannot
keep an AI API key secret. So this vertical slice makes these deliberate substitutions:

1. **Rule-based narrative engine instead of a live AI narrator.** The engine
   implements the same contract the brief defines for the AI (structured state in,
   validated `{narrative, dialogue, choices, stateChanges}` out), so an AI backend
   can replace `Engine.turn()` behind the same interface later without touching the UI.
2. **localStorage instead of PostgreSQL** — with versioned, validated saves and
   JSON export/import as the portability path.
3. **No accounts** — saves are per-browser; export/import moves them between devices.
4. **CSS-drawn atmosphere instead of generated artwork** — palace silhouette,
   mist, gold-on-charcoal manuscript styling; no heavy assets.
5. **Admin/debug interface** is deferred: the state is inspectable via
   `localStorage['rotf.autosave']` and the exported JSON, and the test page
   doubles as an engine harness.

To upgrade to the full AI-driven build, host an API route (e.g. Vercel/Netlify
function) that receives the compact game state + player action, calls the model
with the narrator system prompt from the brief, validates the returned JSON, and
returns it; swap it in where `Engine.turn` is called in `js/ui.js`.

## Roadmap (subsequent acts)

- **Act II — Rise to Power:** dungeons proper, Lord William's trial record, the
  poisoned tooth, the royal family tree, trial or seizure of the throne.
- **Act III — Rule:** kingdom management screen (treasury, food, approval,
  factions: Silent Brotherhood, Iron Circle, Order of the One God), policies with
  trade-offs, time-jump reports.
- **Act IV — The Trinity:** the Amulet and the Staff, prophecy alignment,
  the interactive map, rival rulers (Bastian, Morgana, Eamon).
- **Act V — The Sunken Temple:** the Crown of Tides expedition and the Crown of
  Black Gold.
- **Act VI — the time-anomaly arc:** the Library Beyond Time, the Forge of the
  First King, the Garden of Forgotten Names.
- **Engine:** optional AI narrator backend, ambient audio (opt-in), character
  portraits, admin/content tools.

## Development

No build step. Serve the repo root with any static server
(`python3 -m http.server`) and open `/ruler-of-three-faces/`.
Tests: open `/ruler-of-three-faces/tests.html` — all tests should pass.
