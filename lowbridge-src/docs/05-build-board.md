# Build board

Start with M0. Each milestone produces something a person can play. Physical iPhone checks are explicit design evidence; if only a desktop environment is available, deliver the working preview and mark the device gate pending. Record decisions in this board as evidence arrives.

| Release | Player gets | Scope boundary |
| --- | --- | --- |
| M0 • Handling test | Walk, drive, park, exit, answer a phone. | One junction and one parking bay. |
| M1 • Five-minute demo | Deliver the battery by either route, optionally recruit Clatterjack, see a different ending and resume. | One job, one pursuit, two named crews. |
| M2 • One whole shift | Join the calls into a 20–30 minute case, break between beats, take short jobs and play offline. | Riverside shift 1. Enable backup before inviting longer play. |
| M3 • Complete Riverside | Three shifts, a captain, three species and a permanent road into the next district. | One complete district with a seven-day return test. |
| M4 • Campaign | Brickworks and High Locks, final choice, free roam and multi-week test. | Release candidate for the proposed website. |

## Work in dependency order

| Ticket | After | Deliver | Verify |
| --- | --- | --- | --- |
| T01 | Start | Inspect repo, choose an isolated game directory, lock dependencies, add dev/typecheck/build scripts and load an empty street at the intended base. | Fresh install, clean typecheck and production preview load. Record exact commands. |
| T02 | T01 | Draw the walking block, kerbs, phone and parking bay. Add camera, on-foot input and an “Answer” interaction. | Keyboard and touch take a player from pavement to phone, with a visible and captioned response. |
| T03 | T02 | Add one van, enter/exit, collision, brake/reverse and both steering presets. Clear held input on interruptions. | Drive the same lap with each preset; two simultaneous thumb inputs work; park and get out safely. **M0.** |
| T04 | T03 | Expand the block using the fixture, including the closed yard, ring road and both destinations. | Reach both destinations by the ring road with the shutter shut. |
| T05 | T04 | Implement the Q01 rules and durable transaction, scene updates and return summary for both handovers. | Fresh runs for both choices and a double-tap/reload give one receipt, the right street state and the right next call. |
| T06 | T05 | Implement creature interaction, one roster entry and persistent shutter collision. | Can skip, leave, resume, recruit and open. Route stays open on reload. |
| T07 | T05 | Add express car, readable pursuit, escape/recovery and parking/handovers while heat is clear. | Battery and both recipients remain available after capture. |
| T08 | T06, T07 | Test both endings with the recruit skipped and obtained, plus interrupts; tune opening pace. | Short-session gate below and the M1 tests pass. **M1.** |
| T09 | T08 | Ship both Q02 branches, Q03, Q04 and shift close. Persist the next lead between calls. | Both routes reach the close. One continuous run and one split run earn equivalent progress for the same choices. |
| T10 | T08 | Add two quick-job formats and a compact dispatch board with Park/Continue and duration estimates. | Can finish a quick job between story calls and return to the correct beat. |
| T11 | T08 | Add scoped offline assets, export/import, backup recovery and staged-update handling. | Offline cold relaunch, export round trip and save-compatibility checks pass in Safari and Home Screen. |
| T12 | T09, T10, T11 | Test the full shift in real sessions and split sessions; trim dead travel and improve clues. | Longer-session gate below passes. **M2.** |
| T13 | T12 | Build Riverside shifts 2–3, Reedling, team selection, mastery, trust recovery and the first captain contest. | Both crews can be reconciled. The starter can win. Earn the first mark and open the goods road. |
| T14 | T13 | Tune district pacing and run the seven-day return test with backup enabled. | Returning testers can name their next goal and finish an activity from their existing save. **M3.** |
| T15 | T14 | Author Brickworks shifts 4–6, its three species, quick jobs, captain and crossing outcome. | A complete second district runs on an existing Riverside save for either initial battery choice. |
| T16 | T15 | Author High Locks shifts 7–9, its three species, quick jobs, captain, finale and epilogue. | Both finale operators reachable; optional guide entries remain attainable afterwards. |
| T17 | T16 | Run multi-week tests, exercise upgrades/rollback in preview, fix device or progression blockers and package the static build. | Production-candidate gate below. **M4.** |

## Gates and decision rules

- **M0, controls.** Three people try a lap, park, exit and answer the phone on iPhone. At least two complete it without coaching. Record the preferred scheme, overshot junctions and thumb occlusion. If both schemes fail, tune camera and braking before drawing the district.
- **M1, quick play.** In five fresh tests aim for four direct-route players to reach a handover within five minutes without coaching (offer the curious route separately). Ask what changed in town. If the player only remembers the waypoint, improve the handover and street response.
- **M2, a longer session.** Try three first-time shift runs and one five-part split run. Aim for two of the three to finish within 20–30 minutes and describe how the battery choice led to the final call. Reward state must match across equivalent split and continuous runs. Shorten travel or improve the mystery if that link is lost.
- **M3, the return.** Invite three testers back roughly a week later. Aim for two to resume independently within 30 seconds and choose a meaningful next activity. Record any save loss separately as a defect.
- **M4, production candidate.** Play both campaign paths, test a save from the previous candidate, complete the device and offline checks, and run an optional four-week playtest. Collect the activity chosen and where players actually stopped. Fix data loss, inaccessible endings and broken routes before publication. Select a release path after confirming the actual site setup.

## Next prompt after M0

Use this pattern at each handoff: “Read the build board and previous test results. Implement milestone M1, T04–T08, keeping both battery outcomes and the optional creature route. Run the relevant checks. Return a playable preview with the actual commands, results and device checks still to do.” Substitute the desired milestone and ticket range for subsequent releases.

## M0 record • handling test (T01–T03)

Built 21 November 2026 in `jsipuk.github.io/lowbridge-src/`, beside the site's other `*-src` apps. Physical iPhone gate: **pending**. Nothing below was run on a phone.

### Decisions where the build differs from or fills in the spec

| Area | Chosen behaviour | Reason |
| --- | --- | --- |
| Location | Source in `lowbridge-src/`; `npm run build` writes `lowbridge-src/dist/` with base `/lowbridge/`. | Matches the repository's `merge-life-src`, `tcg-src` pattern. Copying `dist/` to `/lowbridge/` would publish it on jsip.uk, so that stays a separate release step. |
| Tests | Node's built-in runner (`node --test`, type stripping) instead of Vitest. Node 22.18 or later. | npm 10.9 crashes resolving Vitest 4 and 5 peer dependencies (`Cannot read properties of null (reading 'edgesOut')`). `tcg-src` already uses `node --test`. |
| Pinned stack | Phaser 4.2.1, Vite 8.3.6, TypeScript 5.9.3, @types/node 22.19.1. Exact versions, lockfile committed. | Spec baseline for Phaser; Vite and TypeScript versions already used elsewhere in the repository. |
| M0 block | A loop in the fixture's 72 × 48 frame: Depot Lane (x 9), Station Road (y 30), **Ticket Street** (x 34) and **Back Lane** (y 44). Station Road ends at a "closed" barrier at x 40, where T04's ring road continues. | T03 asks to drive "the same lap". The fixture has no loop near the depot, so M0 adds two back streets. No fixture connection is removed; Ticket Street sits on the yard_out/merge column. T04 can keep or drop them. |
| Landmarks | Depot and forecourt west of Depot Lane. Ticket office on the south side of Station Road. A shut builders' yard gate north of Station Road at x 20–24, where T04's yard road leaves ticket_office (22,30). | Keeps x 22 north of Station Road clear for the yard road and shutter. |
| Bay and phone | Bay on the northbound (left-hand) kerb of Depot Lane; payphone on the pavement beside its north end. | Fixture puts the payphone at the depot. The lap ends where it started: park, get out, answer. |
| Phone | Rings at spawn, as in Q01. Answering early plays Mo's line. It rings again once you park after a lap; answering then logs the lap. | Both "answer first" and "ignore it" stay valid, and each preset run still ends on answering. |
| Pad preset (A) | The van moves towards the thumb. Ahead or to the side: it steers to face that way (full lock at 26° off), easing throttle on sharp turns. Pulled back more than about 115° from its facing: it brakes in a straight line, then reverses with the rear swinging towards the thumb, and stays in reverse until the thumb is back within about 80°. Release rolls to a stop. The Brake/Reverse button still works, with the same rear-towards-thumb steering. | Same physics as B; only the input mapping differs. Pull-back reverse added on 21 November after the first phone session found the pad plus a separate reverse button tricky. |
| Wheel preset (B) | Left/Right steer zone (a thumb can slide across), Go, separate Brake/Reverse. On a keyboard, Down also brakes. | As specified. |
| Stopping near points of interest | Rolling drag doubles within 56 px of the bay. | "Short stopping distance near points of interest." |
| Kerbs | Pavements are drivable but cap the van at 80 px/s. Buildings, lamp posts, the phone box and the barrier are solid. | Readable bumps without trapping the van. |
| Getting out | Allowed below 14 px/s. Tries the driver's door (right, right-hand drive), the left door, a longer step to the kerb, then rear and front, preferring pavement. | "Exit only when slow and a walkable exit point exists." |
| Interruptions | Blur, hidden page and pagehide clear held input and pause. Orientation change clears held input. A key held through an interruption must be pressed again. | A01 and the two-minute test. |
| Time | Fixed 1/60 s step; a frame counts at most 0.1 s; accumulated time resets on resume. | No giant step after backgrounding. |
| Camera | North-up. Zoom shows about 26 tiles across and at least 14 tiles top to bottom (1.74× on an 844 × 390 iPhone, 3× cap on desktop). Look-ahead is 0.6 s of travel, capped at 28% of the view. Bounds extend 10 tiles past the block so the courier stays mid-screen, clear of the thumb controls. | First screenshot showed the pad covering the van at the map edge. |
| Storage | Steering, sound, reduced motion and a lap log in `localStorage`, guarded. | Convenience only. Story saves go to IndexedDB in M1. |
| Playtest capture | The game sends nothing anywhere. It fires a `lowbridge:lap` DOM event when a lap is logged. Only the private claude.ai test page listens for it, saving each lap and any page error (with build ID, screen size and browser) to that page's own store for Claude to read. | Requested by the owner so remote phone sessions can be reviewed. The technical plan's no-telemetry rule still holds for the jsip.uk build. |
| Rendering | Canvas-drawn placeholder art at 2×; device pixel ratio capped at 2. | Crisp on iPhone without rendering 3× pixels. |

### Van tune (src/rules/vehicle.ts)

Top speed 150 px/s (9.4 tiles/s), reverse 55, accel 200 px/s², brake 460, coast 115 (240 near the bay), turning radius 24 px + 0.26 × speed, yaw cap 3 rad/s. From top speed the brake stops in under 30 px (2 tiles); coasting takes about 100 px.

### Evidence

| Check | Result | Environment |
| --- | --- | --- |
| Fresh `npm ci`, `npm run typecheck`, `npm test`, `npm run build` | Pass. 28 of 28 tests after pull-back reverse. JS 370 KB gzipped (budget 5 MB). | Linux container, Node 22.23.5, npm 10.9.9 |
| Rules: both presets complete the lap, park, get out on the pavement and answer (scripted, no rendering) | Pass, no bumps | `npm test` |
| Preview at `/lowbridge/` loads with no page errors | Pass | Headless Chromium (Playwright 1.63), 844 × 390 |
| Keyboard lap in the browser | Wheel preset: walk, get in, lap, park, get out, answer, lap logged; 36 s, 0 bumps (scripted driver, cautious). Pad preset: drove 82 px north, let go and rolled to a stop, pulled back and reversed 29 px, reversed on Brake, got out. | `scripts/smoke-m0.mjs` |
| Hold a key, lose focus, resume with the key still down | Pass. Paused on blur; 0 px of movement after resume until a fresh press. | `scripts/smoke-m0.mjs` |
| First phone session (owner) | "Felt smooth." Pad steering with the separate reverse button was tricky, which led to pull-back reverse. | iPhone, inside the private claude.ai page, not standalone Safari. Device and iOS version not recorded. |
| Second phone session (owner), pull-back reverse | Two full laps logged with steering A: 28 s and 36 s, 2 bumps each, no page errors. | iPhone, iOS 18.7, inside the Claude app at 750 × 324. Captured automatically. |
| Two thumbs at once, rotation, standalone Safari, Home Screen | **Not run.** | |
| M0 gate: three people, iPhone, lap/park/exit/answer, preferred scheme | **Pending** | |

### Known issues and things to watch on the phone

- Lamp posts and the phone box caused every bump in the owner's two steering-A laps. Lamps sit 3 px from the kerb edge and the phone box 10 px from the bay. Candidate fix after the steering B comparison: move lamps to the back of the pavement and give the bay more clearance from the phone box.
- Pull-back reverse is new; the owner rated it better than the separate button. With other testers, check that nobody triggers it by accident when swinging round a corner.
- Keyboard in the pad preset gives eight directions only. A diagonal means "turn 45°", so a scripted driver weaved on straights and overshot corners. Touch is analogue and the rules tests lap cleanly with it, but watch for overshot junctions in the pad preset.
- Turning late into a wall with the pad preset scrapes along it; pulling back or Brake/Reverse backs out. Note whether testers find that without coaching.
- Look-ahead and zoom were tuned on desktop emulation. Check on the phone that the next junction is visible before you reach it.
- Each iPhone tap on Get in, Get out and Answer fires on release. Check it feels immediate while the other thumb holds the pad.
- Audio is synthesised and quiet. Starts only after the Start tap.

### Next ticket

T04: expand the block from the fixture (closed yard, ring road, quay and market), after the M0 phone gate records a preferred steering scheme.
