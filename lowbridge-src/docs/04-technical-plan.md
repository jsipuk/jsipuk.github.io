# Technical plan

## Delivery target

Single-player static web game for iPhone Safari and Home Screen, plus keyboard support for desktop testing. Proposed production path: https://jsip.uk/lowbridge/ . Hosting provider, repository layout and release process are unverified. M0 needs only a local preview. Inspect the actual host and any existing root service worker before a hosted playtest.

Use TypeScript, Phaser **4.2.1** and Vite. Pin the engine version and commit the package manager lockfile. This is a known published baseline. Use documentation and types for that major. Use an existing compatible toolchain where the repository already has one. Prefer an orthogonal Tiled JSON map when the greybox graduates to authored landmarks. Bundle assets locally. Desktop-only development tools and test dependencies stay out of the player download.

For a fresh standalone repo use npm. Have M0 supply `npm run dev`, `npm run typecheck`, `npm run build` and `npm run preview`; add `npm test` when game rules exist. If existing equivalents are used, record the exact commands. Choose a compatible supported Node version from tool package requirements, pin it in the repository and document the device preview URL. For phone testing on a trusted LAN, bind the dev server to the LAN interface. A hosted HTTPS preview is required for testing service-worker installation on a phone.

## Boundaries

| Part | Owns | First needed |
| --- | --- | --- |
| Input | Touch pointers, keyboard and selected steering preset produce the same semantic actions. Reset held inputs on blur, hidden or pointer cancel. | M0 |
| Street scene | Camera, tiles, collisions, on-foot and car movement, contextual prompts. Route checks and navigation use stable location IDs. | M0 |
| Session controller | Explicit world, dialogue, encounter, paused and result states. Opening a menu stops world time and pursuit. | M0–M1 |
| Game rules | Job start, recruit, open route, chase outcome and delivery produce a next game state. Effects play only after a successful commit. | M1 |
| Content | Authored definitions for creatures, jobs, districts, conditions and branch effects. Validate references and use plain data with small named rule handlers. | M1 onwards |
| Persistence | Versioned snapshots in the lowbridge-specific IndexedDB database, plus export/import, migration and conflict handling. | M1–M2 |
| Presentation | Phaser draws streets and creatures. Use labelled HTML for menus, buttons and journal where practical. No game engine objects in saves. | M0 onwards |

Start with one street scene and a few plain modules for input, state and saving. Split scenes or add abstractions only when a milestone needs them. Keep render-frame updates separate from durable story transitions. Use a capped simulation step for movement and reset accumulated time on resume.

## Map and content contract

The route graph in [the fixture](../fixtures/riverside-first-job.json) describes mandatory connectivity. It is a design input, not an import-ready Tiled JSON file. For the authored map use named tile layers for ground and buildings and object layers for solids, spawns, interactions and navigation. Every interactable has a stable content ID, location, verb and condition. Parse Tiled data once at load and validate references during build. Verify world and screen scaling on the target phone before committing to sprite production.

A job definition has a stable ID, offer conditions, a duration estimate, checkpoints, outcomes with effects and subsequent offers. A creature definition has an ID, habitat tell, encounter actions, field skill and guide milestones. A captain uses the same turn resolver with a small scripted intent sequence. Keep tests on content actually shipped. Do not allocate empty files or classes for the full campaign during M0.

## Minimal save contract

Persist a plain serialisable envelope. Suggested fields grow with their owning milestone:

| Field | Meaning |
| --- | --- |
| schemaVersion, revision, savedAt | Integer schema and revision, with an informational timestamp. Progress derives from state, not elapsed wall time. |
| checkpoint | District, last valid anchor, locomotion, current vehicle, cargo and an optional safe position. Include pursuit state when active. |
| story, currentJob, journal | Current shift and beat, job ID with settled stage and unique instance ID, next lead ID. Parking a story between calls preserves its place while a quick job runs. |
| roster, team, guide | Unique species, up to two active IDs, observed actions and mastery flags. |
| crews, flags | Bounded standing per crew, one-time events, unlocked routes, mutually exclusive battery recipient. |
| encounter | Creature ID, stable turn/pose, available offer item. Resume the last settled turn and replay its cue. |
| completed, personalBests, settings | Completion receipts by authored outcome group or repeatable run instance, bests by route and heat category, steering and accessibility options. |

**Example transaction.** Deliver-battery requires active Q01 carrying its battery and no receipt for its exclusive outcome group. In one IndexedDB read/write transaction, compare the stored revision, debit cargo, set exactly one recipient, adjust trust, write the world flag and correct next offer, append the completion receipt, advance the revision and rotate the previous snapshot. Double taps, a stale tab and a retry after a crash cannot award it again. On conflict reload the latest committed state. Automatic repeats use their own run IDs and cannot affect story trust. Reopening the phone or taking another car cannot mint a second battery.

Save after each settled state change and periodically at a safe street position, with a five-second target during ordinary travel. A hidden event pauses immediately and attempts a final small save; the last committed checkpoint is the fallback if iOS terminates the app first. Save chase timers at checkpoints; if an exact chase position is invalid after an update, restore an authored safe chase restart without paying rewards. Store status-tied vehicle ownership and position or resolve them deterministically. Make the depot van recoverable.

On storage failure keep the current state in memory, show “Progress hasn’t saved” with retry/export and keep the player out of irreversible handovers until they can be committed or explicitly retained for that session. Never present an uncommitted checkpoint as saved. Before longer playtests, implement export/import of versioned JSON. Validate versions, IDs and ranges, preview the import and retain the previous good save. A newer unsupported format should be preserved untouched. An older supported format migrates in a transaction; test with a saved older fixture. Fresh installs start a new slot. Test Safari and Home Screen independently; export/import is the explicit transfer route.

## Offline, release and recovery

- Configure Vite’s asset base for `/lowbridge/`. Put the manifest start URL, icons, service worker and scope under that path. If the website already has routing or a worker, verify compatibility on the preview host. Use build-specific cache names with a Lowbridge prefix. Housekeeping only touches caches owned by this game.
- Precache the shell and first district as a versioned set. Display “Available offline” only after all required resources are present and the active worker can serve them. For later districts, download a complete asset set before promising offline access.
- Keep old asset sets available to running clients during an update. Offer a restart at a saved boundary. Verify a return from an older tab, flight-mode relaunch and a corrupted or missing asset. Keep the last known good build deployable. Test save compatibility before rollback or retain the newer save for a compatible build.
- Target 60 fps on the primary device. Investigate repeated frames above 33 ms during a representative one-minute drive; record the phone, iOS and build. Aim for a first district cold download under 5 MB compressed and control response within one rendered frame after input processing. Treat these as proposed budgets to measure and revise. Start audio only after a user gesture.
- Verify ordinary Safari first, then Home Screen and an older physical iPhone if available. Desktop device emulation covers layout and input regressions. Record physical Safari play separately. Proposed MVP excludes accounts, telemetry and server-side saves. An optional tester notebook suffices for early sessions.

## Technical sources

- Phaser release documentation, pinned engine baseline: https://phaser.io/download/release/v4.2.1
- Vite deployment documentation, subpath builds and previews: https://vite.dev/guide/static-deploy.html
- Tiled reference for exported maps and layers: https://doc.mapeditor.org/en/stable/reference/json-map-format/
- Apple iPhone guide, Home Screen web apps: https://support.apple.com/en-gb/guide/iphone/iphea86e5236/27/ios/27
- WebKit engineering, storage eviction and persistence: https://webkit.org/blog/14403/updates-to-storage-policy/
- MDN reference, page visibility and background behaviour: https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API
- MDN guide, cached assets and worker lifecycle: https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API/Using_Service_Workers

Design precedents: the [original GTA manual](https://www.gamesdatabase.org/Media/SYSTEM/Microsoft_DOS/manual/Formated/Grand_Theft_Auto_-_1997_-_Take-Two_Interactive.pdf), the [GTA 2 manual](https://oldgamesdownload.com/wp-content/uploads/Grand_Theft_Auto_2_Manual_EN.pdf) and [Nintendo UK’s Pokémon Blue page](https://www.nintendo.com/en-gb/Games/Game-Boy/Pokemon-Blue-Version-266054.html). The game’s story, assets, balancing and names are original design proposals.
