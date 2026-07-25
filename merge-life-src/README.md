# Merge Life

A calm, local-first merge game about hobbies, craftsmanship and playing less.

Merge Life gives you the satisfying part of a merge game — combining small parts
into better ones, finishing short orders, filling a collection — without any of
the machinery that is designed to keep you playing. There are no streaks, no
energy timers, no loot boxes, no premium currency, no adverts and no "play
again" button. Sessions are 5, 10 or 15 minutes, start only when you press a
button, and end when they end.

Everything is stored on your device in IndexedDB. There is no account, no
server and nothing is uploaded anywhere.

---

## Contents

- [Product concept](#product-concept)
- [Setup](#setup)
- [Local development](#local-development)
- [Testing](#testing)
- [Build](#build)
- [Deployment to Vercel](#deployment-to-vercel)
- [Deployment on this repository (jsip.uk, GitHub Pages)](#deployment-on-this-repository-jsipuk-github-pages)
- [Deployment to any static host](#deployment-to-any-static-host)
- [PWA installation](#pwa-installation)
- [Save export and import](#save-export-and-import)
- [Database structure](#database-structure)
- [Project structure](#project-structure)
- [How to add a new room](#how-to-add-a-new-room)
- [How to add a new item chain](#how-to-add-a-new-item-chain)
- [How to add new watch archetypes](#how-to-add-new-watch-archetypes)
- [Design rules this game keeps](#design-rules-this-game-keeps)

---

## Product concept

You have a persistent hub called **My Life Workshop**. It contains four themed
areas:

| Room | Status | Chains |
| --- | --- | --- |
| Watch Workshop | Playable | Watch Movement, Watch Exterior, Watch Design |
| Fitness Garage | Coming soon (chains defined) | Strength Kit |
| Bike Workshop | Coming soon (chains defined) | Bike Build |
| Play Room | Coming soon (chains defined) | Model Making, Making Art, Puzzling, Toy Workshop |

In the Watch Workshop you:

1. Take low-level parts from three generators (12 uses each, per session).
2. Merge two identical parts into the next part in that chain — two Watch Screws
   make a Watch Gear, and so on up seven levels.
3. Complete three short orders per session.
4. Case up a movement, a case and a dial into a **finished watch**, which joins
   your collection permanently.
5. Spend workshop progress on permanent upgrades — a better bench, a desk lamp,
   a walnut watch box, a window.

The wellbeing dashboard reports honestly how long you have played today, this
week and this month, and how much time you have **reclaimed** against your own
previous weekly gaming baseline (9 hours 10 minutes by default).

---

## Setup

Requirements: Node 18.18+ (Node 20 or 22 recommended) and npm.

```bash
cd merge-life-src
npm install
```

## Local development

```bash
npm run dev          # http://localhost:3000
```

Other useful scripts:

```bash
npm run typecheck    # tsc --noEmit
npm run lint         # next lint
npm run test         # vitest run
npm run test:watch   # vitest in watch mode
npm run build        # static export into ./out
```

Development extras (the three browser scripts below need Playwright, which is
deliberately *not* a dependency so `npm install` stays quick — install it only
if you want them: `npm i -D playwright`; this container already provides
Chromium at `/opt/pw-browsers`, otherwise set `CHROMIUM_PATH`):

- **Seeded demo save** — Settings → Development only → "Load seeded demo save".
  Deterministic: a part-built board, discovered items, two finished watches,
  three unlocked upgrades and five past sessions. Never shown in production
  builds; production always starts from a clean save.
- **Browser smoke test** — with the dev server running:
  `node scripts/smoke.mjs http://localhost:3000`. It drives a real browser
  through a session (generators, tap-merge, drag-merge, undo, reload
  persistence, crafting a watch, the daily limit, ending a session), writes
  screenshots to `/tmp/merge-life-shots` and fails on any console error or any
  dark-pattern wording appearing in the UI. Point it at a built site to check a
  deployment: `node scripts/smoke.mjs https://jsip.uk/merge-life`
  (the seeded-save steps are skipped automatically in production builds).
- **Offline check** — `npx serve out -l 4321` then
  `node scripts/offline-check.mjs http://localhost:4321` confirms the service
  worker installs, the app loads with the network disabled and the board is
  restored from IndexedDB.
- **Accessibility check** — `node scripts/a11y-check.mjs` toggles high contrast
  and reduced motion, prints the keyboard tab order and lists any touch target
  under 44px.
- **Icons** — `node scripts/generate-icons.mjs` regenerates the PWA PNGs from
  pure Node, with no image libraries.

## Testing

```bash
npm run test
npm run test:coverage
```

Vitest + React Testing Library, jsdom, and `fake-indexeddb` for the save layer.
The suite covers:

| Area | File |
| --- | --- |
| Valid merges, invalid merges, top-of-chain behaviour, board movement, normalisation | `src/tests/mergeEngine.test.ts` |
| Save/restore, backup and corruption recovery, export/import, migrations, seeded save | `src/tests/saveLayer.test.ts` |
| Session timer phases, grace window, daily limits, date rollover, time reclaimed, returning after inactive days | `src/tests/sessionEngine.test.ts` |
| Order generation and completion | `src/tests/orderEngine.test.ts` |
| Finished-watch creation, archetype rules, serial numbers | `src/tests/watchBuilder.test.ts` |
| Generator use limits, session count limits, undo, crafting, hydration, autosave | `src/tests/gameStore.test.ts` |
| Board interaction, keyboard control, generators, orders, collection UI | `src/tests/components.test.tsx` |

## Build

```bash
npm run build
```

The app is a fully static export (`output: 'export'` in `next.config.mjs`); the
result lands in `out/`. There is no server component, no API route and no
runtime backend.

Serve it locally with any static file server:

```bash
npx serve out
```

## Deployment to Vercel

1. Push the repository to GitHub.
2. In Vercel, "Add New… → Project", pick the repository and set the **root
   directory** to `merge-life-src`.
3. Framework preset: **Next.js**. Build command `npm run build`, output
   directory `out` (Vercel detects both automatically).
4. Deploy. No environment variables are required.

## Deployment on this repository (jsip.uk, GitHub Pages)

This repository is the GitHub Pages site for **jsip.uk** (see `CNAME`), served
from the repository root with Jekyll disabled (`.nojekyll`, which matters
because Next writes a `_next/` folder). The layout is therefore:

| Path | What it is |
| --- | --- |
| `merge-life-src/` | this Next.js project (source) |
| `merge-life/` | the built static site, served at `https://jsip.uk/merge-life/` |

The source lives in a separate folder so that `merge-life/` contains exactly
what the URL serves. To rebuild the deployed copy after a change:

```bash
cd merge-life-src
rm -rf .next out
NEXT_PUBLIC_BASE_PATH=/merge-life npm run build
rm -rf ../merge-life && cp -r out ../merge-life
```

Then commit both folders. Pages publishes from the repository's default branch,
so the change goes live once it is merged there.

Check the result the way Pages will serve it, from the repository root:

```bash
npx serve . -l 4400          # then http://localhost:4400/merge-life/
node scripts/smoke.mjs http://localhost:4400/merge-life
node scripts/offline-check.mjs http://localhost:4400/merge-life
```

Do not put the build inside `merge-life-src/` — a folder named `app/` in the
project root would be mistaken for Next's App Router directory.

## Deployment to any static host

`out/` is a plain folder of HTML, JS, CSS and images — copy it to Netlify,
Cloudflare Pages, S3, GitHub Pages or an nginx root.

If the game is served from a subfolder (for example
`https://example.com/merge-life/`), build with the base path set:

```bash
NEXT_PUBLIC_BASE_PATH=/merge-life npm run build
```

This sets Next's `basePath` and `assetPrefix`, and the service worker and
manifest resolve their URLs relative to their own scope.

## PWA installation

The app ships a web manifest (`public/manifest.webmanifest`) and a hand-written
service worker (`public/sw.js`). The worker is registered only in production
builds.

- **iPhone / iPad**: open the site in Safari → Share → *Add to Home Screen*.
- **Android / Chrome**: menu → *Install app* (or the install prompt).
- **Desktop Chrome / Edge**: install icon in the address bar.

Offline behaviour: the app shell and the five routes are precached on install,
other assets are cached as they are used, and navigations fall back to the
cached page. After the first load the game works with no network at all — all
game state lives in IndexedDB, which the service worker never touches.

## Save export and import

Settings → *Your save*:

- **Export save to JSON** downloads `merge-life-save-YYYY-MM-DD.json` containing
  a `{ format, exportedAt, version, save }` wrapper.
- **Import save from JSON** accepts that wrapper *or* a bare save object, runs it
  through the migration and repair pipeline, and writes it to IndexedDB.
- **Reset progress** requires an explicit confirmation and cannot be undone.

Saves from older versions are migrated on import and on load, so an exported
file stays usable across releases.

## Database structure

Dexie database `merge-life`, version 1:

| Table | Key | Contents |
| --- | --- | --- |
| `saves` | `key` | Two rows: `current` (live save) and `backup` (previous good save). Indexed on `savedAt` and `version`. |
| `meta` | `key` | Small key/value entries, indexed on `updatedAt`. |

Each `saves` row is `{ key, save, savedAt, version }`.

**Load order** (`src/db/repositories.ts`): read `current` → if it fails to parse
or migrate, read `backup` → if that fails too, create a fresh default save. Every
write copies the previous `current` into `backup` inside one transaction, so a
crash mid-write cannot lose both.

**Autosave** happens after every meaningful action (debounced by 400 ms), and
immediately when:

- the tab becomes hidden (`visibilitychange`),
- the page is being unloaded (`pagehide` / `beforeunload`),
- you navigate between screens,
- a session ends or a watch is built.

**Save schema** (`SaveGame` in `src/types/index.ts`) holds the board with every
item and its position, generator uses, active and completed orders, discovered
items, the watch collection, unlocked rooms and decorations, all session history,
player stats, settings and per-archetype serial counters.

**Migrations** live in `src/db/migrations.ts` and run in order:

| From → to | What it does |
| --- | --- |
| 1 → 2 | Adds workshop decorations and the wellbeing weekly baseline. |
| 2 → 3 | Converts the legacy flat item list into the addressable 6×8 cell grid; adds deterministic watch serial counters. |

To add a migration: bump `CURRENT_SAVE_VERSION` in `src/db/defaultSave.ts`, append
a `SaveMigration` to `MIGRATIONS`, and add a test with a realistic old save.
`normaliseSave` then fills in any field the migration did not set, so a partially
damaged save is repaired rather than discarded.

## Project structure

```
src/
  app/            routes: / (hub), /workshop, /collection, /wellbeing, /settings
  components/
    board/        MergeBoard, BoardCellView, ItemArt (all original SVG)
    collection/   WatchBox, WatchIllustration
    generators/   GeneratorTray
    orders/       OrderList
    sessions/     SessionSetup, SessionTimer, SessionSummary
    workshop/     CraftBench, WorkshopScene, RoomPreview
    wellbeing/    WellbeingDashboard
    ui/           shared primitives, AppShell, ToastStack
  data/           itemChains.ts, rooms.ts, watchArchetypes.ts
  db/             database.ts, migrations.ts, repositories.ts, defaultSave.ts, seed.ts
  game/           mergeEngine.ts, orderEngine.ts, sessionEngine.ts, watchBuilder.ts
  hooks/          useAutosave, useSessionClock, useFeedback, useReducedMotion
  state/          gameStore.ts (Zustand)
  types/          shared domain types
  utils/          ids.ts, time.ts
  tests/          Vitest suites
```

Game rules live in `src/game/*` and are pure functions over plain data. React
components render state and call store actions; they never implement rules.

## How to add a new room

1. **Chains** — add one or more chain seeds to `chainSeeds` in
   `src/data/itemChains.ts` with your new `roomId`, and add the ids to the
   `ChainId` and `RoomId` unions in `src/types/index.ts`.
2. **Room entry** — add a `WorkshopRoom` to `ROOMS` in `src/data/rooms.ts`. Set
   `status: 'coming-soon'` while it is being built; the hub renders a preview
   card automatically.
3. **Generators** — add generator templates alongside `WATCH_GENERATOR_TEMPLATES`
   and return them from a `createGenerators`-style factory for that room.
4. **Artwork** — add a `case` per `art` key in
   `src/components/board/ItemArt.tsx`. Anything without a case falls back to a
   generic shape, so the room is playable before the art is finished.
5. **Open it** — change `status` to `'available'`, add the room id to
   `unlockedRoomIds` in `createDefaultSave`, and give it a route that renders
   `MergeBoard` with that room's board and generators.

Because the board, orders and sessions are room-agnostic, a second room mostly
means data plus a page.

## How to add a new item chain

Append a `ChainSeed` to `chainSeeds` in `src/data/itemChains.ts`:

```ts
{
  id: 'garden-beds',        // add to the ChainId union
  roomId: 'garden-shed',
  name: 'Raised Beds',
  role: 'general',          // 'movement' | 'exterior' | 'design' | 'general'
  description: 'From a bag of compost to a bed that feeds you all summer.',
  tone: 'sage',             // brass | slate | sage | clay
  levels: [
    { name: 'Seed', description: '…', art: 'seed' },
    // …seven levels is the house style
  ],
}
```

Item definition ids are generated as `<chainId>-<level>`, so nothing else needs
to know about the new chain. Add matching `art` cases in `ItemArt.tsx`, and add
orders that reference the new definition ids in `src/game/orderEngine.ts` if you
want them to appear.

## How to add new watch archetypes

Add a `WatchArchetype` to `WATCH_ARCHETYPES` in `src/data/watchArchetypes.ts`:

```ts
{
  id: 'skeleton',                    // add to the WatchArchetypeId union
  name: 'Skeleton Watch',
  serialPrefix: 'SKL',
  caseStyle: 'Polished steel, 39mm',
  dialStyle: 'Open-worked, no dial plate',
  accentStyle: 'Exposed bridges',
  description: 'One original sentence about what it is like to own.',
  requires: { movement: 7, exterior: 5, design: 5 },
  tier: 7,                            // highest satisfied tier wins
  palette: { case: '#a7acb2', dial: '#2c2f36', accent: '#d8c9ae', strap: '#3a2c24' },
}
```

`resolveArchetype` picks the **highest-tier** archetype whose minimum component
levels are all met, so better parts reliably make rarer watches with no
randomness. Add a `WATCH_NAME_PREFIXES` entry for the new id, and optionally a
dial treatment in `WatchIllustration` (`src/components/collection/WatchIllustration.tsx`).
The collection screen picks up the new archetype automatically, including its
empty silhouette.

## Design rules this game keeps

- No daily streaks, expiring rewards, loot boxes, premium currency, energy
  regeneration, adverts, shopping links, coupons or fear of missing out.
- No punishment for taking breaks: **taking days off does not reduce progress**,
  and nothing decays or expires.
- No "play again", "extend session" or "come back in X minutes" at the end of a
  session. The end screen offers exactly two things: close the workshop, or look
  at your collection.
- Generators refresh only when you deliberately start a session — never on a
  timer, never for money.
- Orders persist until completed and are never swapped out mid-session.
- Nothing leaves the board without a deliberate, confirmed action; a move onto an
  occupied cell swaps rather than overwrites, and the last move can be undone.
- Accessibility: reduced-motion and high-contrast modes, sound off by default,
  44px minimum touch targets, visible focus rings, full keyboard control, screen
  reader labels on every item, and no information conveyed by colour alone.

---

Artwork is original SVG and CSS drawn in code. No copyrighted game assets, brand
names or character names are used anywhere.
