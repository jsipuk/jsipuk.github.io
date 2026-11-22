# Lowbridge After Dark

A single-player, top-down iPhone game set in a British river town. You work the night shift as a courier. The roads belong to rival crews. Some of the things living beside them will ride with you.

**Status** • M2 one whole shift built in `lowbridge-src/`: Q01 plus both Q02 branches, Q03, Q04 and the Three rings close; Last post and Lost property on a dispatch board; saves with export/import; offline play from the built site. Free play added on top: people to bump into and talk to, pigeons to scatter, a van horn, wrong-number calls, chips, a clothes shop and a van paint shop with looks you unlock by playing. Container and headless-browser checks pass; phone and people gates are pending. Production deployment is future work.

## Run the M0 build

Needs Node 22.18 or later (`.nvmrc` says 22) and npm. Run everything from this folder.

| Step | Command | Open |
| --- | --- | --- |
| Install | `npm ci` | |
| Play while editing | `npm run dev` | http://localhost:5173/lowbridge/ |
| Checks | `npm run typecheck && npm test` | |
| Production build | `npm run build` | writes `dist/` |
| Preview the build | `npm run preview` | http://localhost:4173/lowbridge/ |
| Phone on the same Wi-Fi | `npm run preview:lan` | the `Network:` address it prints, plus `/lowbridge/` |
| Browser play-through | `node scripts/smoke.mjs` while the preview runs | needs Playwright and Chromium; `SMOKE_ONLY=shift,offline` runs a subset |
| Storage failure test | open the preview with `?failsave=1` | saving is switched off for that tab |

`npm run build` does not touch the live site. Copying `dist/` to the repository's `/lowbridge/` folder is the separate release step.

**Keyboard:** WASD or arrows walk and point the pad, Shift is Go, Space brakes then reverses, E or Enter does the action on the amber button, Esc pauses, 3 and 1 switch steering C and A, M mutes. In steering A, pressing away from where the van faces reverses it. A read-only `window.lowbridge.snapshot()` reports state for agents, and a `lowbridge:lap` window event fires when a lap is logged.

## Start in Codex or Claude Code

1. Extract the ZIP. Open the extracted folder as a new project, or bring its planning files into a new game directory in your existing website repository. Preserve any existing root instructions. (Done: this pack lives in `jsipuk.github.io/lowbridge-src/`.)
2. Paste the prompt below. It applies equally to a fresh repository or an existing site.
3. The first delivery is a locally playable steering test. Use the physical-phone test before committing to final controls.

> Read AGENTS.md, docs/01-game-design.md, docs/02-first-shift.md and docs/05-build-board.md. Inspect the repository and implement milestone M0 only. Produce a playable top-down block with touch and keyboard controls, a van to enter and exit, a parking bay and a ringing phone to answer. Include both steering presets in the test build. Run the available checks and build. Tell me the exact launch command, preview path and two-minute iPhone test. Record what you verified and which physical-device checks remain.

## Read in this order

| File | Use it for |
| --- | --- |
| [Game plan](lowbridge-game-plan.pdf) | Four-page illustrated overview for John or a collaborator. |
| [Game design](docs/01-game-design.md) | Session lengths, control feel, creatures, crews, rules and art direction. |
| [The first shift](docs/02-first-shift.md) | First job, district layout, branching outcomes, optional pursuit and first 20–30 minutes. |
| [Campaign](docs/03-campaign.md) | Nine shifts, three districts, optional collecting and how progress lasts across weeks. |
| [Technical plan](docs/04-technical-plan.md) | Stack, map/content boundaries, save contract, offline support, deployment and sources. |
| [Build board](docs/05-build-board.md) | Milestones, task IDs, dependencies and acceptance gates. |
| [Playtests](docs/06-playtests.md) | Device, branch, interruption and real-player tests. |
| [First-job fixture](fixtures/riverside-first-job.json) | Canonical IDs, route graph, checkpoints and outcomes. A design fixture for implementation. |

**Agreed direction:** Lowbridge, iPhone first, short play and longer sessions, progress that carries across weeks. **Proposed defaults:** landscape driving, a finite single-player campaign, offline local saves and a static build at `/lowbridge/`. The map sizes, content budget and timing targets can change after playtests.

The original concept brief has been incorporated. No previous chat, paid service, game assets or production access is required to start M0.
