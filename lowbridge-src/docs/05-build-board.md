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
| Wheel preset (B), retired | Left/Right steer buttons, Go, separate Brake/Reverse. Removed from the game on 22 November. | The owner liked its Go and Brake but not the big Left/Right buttons; steering C keeps the pedals with a pad instead. Older lap logs show it as "B · Wheel and pedals (retired)". |
| Third preset (C, "Pad and pedals") | Thumb pad on the left (label "Steer") always says which way the front of the van should point, going forwards or backwards. Go on the right only drives forwards; pointing behind with Go swings the van round. Brake/Reverse is the only way back and reverses straight with the pad idle. Keyboard: arrows point, Shift is Go, Space reverses, 3 selects it. | Owner liked B's pedals but not its big Left/Right buttons, and asked for a direction pad on the left with Go on the right. Added beside A and B, not replacing B, so lap records stay comparable. The first version also reversed on Go with the pad pulled back; the owner found the forward/back rules counterintuitive, so C now has one rule per control. |
| Stopping near points of interest | Rolling drag doubles within 56 px of the bay. | "Short stopping distance near points of interest." |
| Kerbs | Pavements are drivable but cap the van at 80 px/s. Buildings, lamp posts, the phone box and the barrier are solid. | Readable bumps without trapping the van. |
| Getting out | Allowed below 14 px/s. Tries the driver's door (right, right-hand drive), the left door, a longer step to the kerb, then rear and front, preferring pavement. | "Exit only when slow and a walkable exit point exists." |
| Interruptions | Blur, hidden page and pagehide clear held input and pause. Orientation change clears held input. A key held through an interruption must be pressed again. | A01 and the two-minute test. |
| Time | Fixed 1/60 s step; a frame counts at most 0.1 s; accumulated time resets on resume. | No giant step after backgrounding. |
| Job arrow | While driving, the arrow points at the next junction along the roads (shortest way round), or straight at the target when it is on the same road. Built from the roads' overlaps in `src/rules/route.ts`. | The spec asks for "an arrow towards its street junction". The first build pointed straight at the target, which on Station Road meant through the ticket office; the owner's only bump on 4100c9d was that wall. |
| Courier look | Seen from above: jacket shoulders with a reflective band, head a little forward. Walking steps a light trainer out in front and swings the opposite hand forward, timed by distance walked, so it stands still when you do. Jacket colour is a menu setting: Hi-vis amber (default), Canal teal, Post-box red, Cream, Night blue, each named beside its swatch. | Owner asked to see the courier walk, with legs poking out in front, arms optional depending on pixel detail, and a colour option. Hands are kept small; remove them if they read as clutter on the phone. |
| Steering choice | Settings offer C (default) and A. | Owner, 22 November: keep both as options; slightly prefers C, final call depends on real missions. |
| Camera | North-up. Zoom shows about 26 tiles across and at least 14 tiles top to bottom (1.74× on an 844 × 390 iPhone, 3× cap on desktop). Look-ahead is 0.6 s of travel, capped at 28% of the view. Bounds extend 10 tiles past the block so the courier stays mid-screen, clear of the thumb controls. | First screenshot showed the pad covering the van at the map edge. |
| Storage | Steering, sound, reduced motion and a lap log in `localStorage`, guarded. | Convenience only. Story saves go to IndexedDB in M1. |
| Playtest capture | The game sends nothing anywhere. It fires a `lowbridge:lap` DOM event when a lap is logged, including what each bump hit and its tile (`hits`). Only the private claude.ai test page listens for it, saving each lap and any page error (with build ID, screen size and browser) to that page's own store for Claude to read. | Requested by the owner so remote phone sessions can be reviewed. The technical plan's no-telemetry rule still holds for the jsip.uk build. |
| Rendering | Canvas-drawn placeholder art at 2×; device pixel ratio capped at 2. | Crisp on iPhone without rendering 3× pixels. |

### Van tune (src/rules/vehicle.ts)

Top speed 110 px/s (6.9 tiles/s), reverse 45, pavement 60, accel 150 px/s², brake 460, coast 115 (240 near the bay), turning radius 24 px + 0.26 × speed, yaw cap 3 rad/s. From top speed the brake stops in about 13 px; coasting takes about 50 px. First tune was 150 top speed and 200 accel; slowed on 22 November after the owner asked for "a bit slower".

**Speed boost (owner idea, not built).** "Have a boost during some missions." The spec already gives M1 a quicker express car with a wider turning circle that draws the patrol. Consider that the boost, or a short boost tied to pursuit jobs, when building T07.

### Evidence

| Check | Result | Environment |
| --- | --- | --- |
| Fresh `npm ci`, `npm run typecheck`, `npm test`, `npm run build` | Pass. 37 of 37 tests: full scripted laps with C and A, and a sweep from over 500 road positions showing the job arrow never points through a building. JS about 370 KB gzipped (budget 5 MB). | Linux container, Node 22.23.5, npm 10.9.9 |
| Rules: both presets complete the lap, park, get out on the pavement and answer (scripted, no rendering) | Pass, no bumps | `npm test` |
| Preview at `/lowbridge/` loads with no page errors | Pass | Headless Chromium (Playwright 1.63), 844 × 390 |
| Keyboard lap in the browser | Steering C: walk, get in, lap, park, get out, answer, lap logged; 32 s, 0 bumps. Steering A: drove north, let go and rolled to a stop, pulled back and reversed, reversed on Brake, got out. Steering C short check: pointing alone stays put, Go drives. | `scripts/smoke-m0.mjs` (retired in M1; in git history) |
| Hold a key, lose focus, resume with the key still down | Pass. Paused on blur; 0 px of movement after resume until a fresh press. | `scripts/smoke-m0.mjs` (retired in M1; in git history) |
| First phone session (owner) | "Felt smooth." Pad steering with the separate reverse button was tricky, which led to pull-back reverse. | iPhone, inside the private claude.ai page, not standalone Safari. Device and iOS version not recorded. |
| Fifth phone session (owner), slower van | C: 0:17 with no bumps, then 0:27 with 1 ("wall at 23,34", the ticket office front). A: 0:34, no bumps. Owner slightly prefers C; keep A as an option. | Same iPhone and Claude app, build 4100c9d. |
| Fourth phone session (owner), first steering C | Two laps: 0:45 with 3 bumps, 0:31 with 2. Still "a bit tricky"; forward/back and Go/reverse felt counterintuitive; asked for a slower van. Led to the slower tune, the simpler C and bump logging. | Same iPhone and Claude app. Lamps already moved for these laps. |
| Third phone session (owner), steering B | Two laps: 0:41 with 3 bumps, then 0:17 with no bumps (fastest so far). Liked the pedals, not the big Left/Right buttons. Led to steering C. | Same iPhone and Claude app as above. |
| Second phone session (owner), pull-back reverse | Two full laps logged with steering A: 28 s and 36 s, 2 bumps each, no page errors. | iPhone, iOS 18.7, inside the Claude app at 750 × 324. Captured automatically. |
| Two thumbs at once, rotation, standalone Safari, Home Screen | **Not run.** | |
| M0 gate: three people, iPhone, lap/park/exit/answer, preferred scheme | **Pending** | |

### Known issues and things to watch on the phone

- Lamp posts and the phone box caused every bump in the owner's steering-A laps (lamps were 3 px from the kerb, the phone box 10 px from the bay). Fixed in build after c16a8ce: lamps moved to the back of the pavement, phone box moved 8 px further from the bay. Laps before and after this change are not directly comparable.
- Pull-back reverse is new; the owner rated it better than the separate button. With other testers, check that nobody triggers it by accident when swinging round a corner.
- Keyboard in the pad preset gives eight directions only. A diagonal means "turn 45°", so a scripted driver weaved on straights and overshot corners. Touch is analogue and the rules tests lap cleanly with it, but watch for overshot junctions in the pad preset.
- Turning late into a wall with the pad preset scrapes along it; pulling back or Brake/Reverse backs out. Note whether testers find that without coaching.
- Look-ahead and zoom were tuned on desktop emulation. Check on the phone that the next junction is visible before you reach it.
- Each iPhone tap on Get in, Get out and Answer fires on release. Check it feels immediate while the other thumb holds the pad.
- Audio is synthesised and quiet. Starts only after the Start tap.

### Placeholder call

Answering the payphone always plays Mo's opening line and changes nothing else. That is deliberate for M0. In M1 (T05) answering accepts Q01: the battery enters custody, the quay is marked, and Nell's counteroffer fires on leaving the depot.

### M0 gate status

The owner has completed laps with every scheme on a physical iPhone, but inside the Claude app rather than standalone Safari, and alone. Preferred scheme so far: C, with A kept as an option. Still to do for the formal gate: three people, Safari, without coaching.

### Next ticket

T04: expand the block from the fixture (closed yard, ring road, quay and market), after the M0 phone gate records a preferred steering scheme.

## M1 record • five-minute demo (T04–T08)

Built 22 November 2026, autonomously, on the C and A steering chosen in M0. Every check below ran in the Linux container (Node 22.23.5, headless Chromium via Playwright 1.63). **No M1 check has run on a phone or with a person yet.**

### Decisions where the build differs from or fills in the spec

| Area | Chosen behaviour | Reason |
| --- | --- | --- |
| Node positions | Connections match the fixture; four nodes moved: ring_north (61,12→16), merge (34,12→16), yard_in and yard_out (y 20→23), fork, quay and market (y 7→6). | Five-tile roads need pavement and a building row between them. At the fixture's y 7 and y 12 the harbour road and the ring road would touch. The spec allows the skeleton to move if connections stay. |
| Shutter position | In the yard's south gateway, 4 tiles north of Station Road, instead of on the yard_in–yard_out stretch inside. The gated route is still the only shortcut, and routing treats the gate road as closed until the flag is set. | "On the first lap a camera sightline should reveal the shutter from the main road." At 14 tiles of view height, anything 10 tiles north of Station Road is off-screen. |
| Yard | Fenced on all sides. Reached from Station Road only through the shutter; the inside is also reachable from the north via the yard lane (as in the fixture, where yard_out–merge is always open). | Matches the fixture's open edges. Tests check the fence has no gaps. |
| Footpath | A three-tile alley from Station Road to the ring road, closed to vehicles by bollards a walker can pass between. | "Footpaths also let a player reach either recipient." |
| Washer | The courier carries one from the start (the van's toolbox) and never loses it. | The spec offers a washer without saying where it comes from. |
| Job arrow with two recipients | Points to whichever of Mo or Nell is nearer by road; pins mark both. | One line, one arrow; the pins keep both choices visible. |
| Counteroffer | Captioned radio line that does not stop play, fired the first time the courier leaves the depot area with the battery, on foot or in any vehicle. | "A radio call is captioned." Stopping play mid-drive would be worse. |
| Patrol | Spawns at the ring road's north-east corner 2 s after the car is taken, drives to where it was reported, then chases whatever it can see within 15 tiles. It only knows where it last saw you. The 6 s escape clock starts once it reaches the report or has seen you. Top speed 120 (van 110, express car 165). | First version always knew where you were, so escape was near impossible; a person hides round corners. |
| Express car | Quicker (165), wider turning circle (34 px + 0.34 × speed). Heat once per new taking: taking it from the lay-by. After capture it returns to the lay-by, so the next taking raises heat again. | "Borrowing the express car triggers the patrol once per new taking." |
| Capture | Courier on foot at the depot, van recovered to the forecourt, express car back in the lay-by, battery kept, a "Caught" card. | As specified. |
| Saving | IndexedDB database `lowbridge`, store `saves`, keys `current` and `previous`. Every story change is one transaction that checks the revision, writes the new envelope and keeps the old one as `previous`. Position checkpoints every 5 s of play, never mid-chase, and always with the last committed progress so they cannot roll a story change back. Settings stay in `localStorage`. | Save contract in the technical plan. |
| Reload mid-chase | Restarts the chase from the lay-by in the express car. | "Restore an authored safe chase restart without paying rewards." |
| Storage failure | "Progress hasn’t saved" bar with Try again; the handover is refused until it commits ("Nothing has changed hands"). `?failsave=1` simulates it. | As specified; the query is for testing. |
| Newer or damaged saves | A newer schema is left untouched and the session plays without saving. A damaged current save falls back to `previous` with a "Recovered your last good save" screen. | As specified. Export/import is still M2 (T11). |
| Result card | Appears 2 s after the handover, so the ferry lights or the stalls light up before the card covers the street. Park up and Take the next call are styled the same. | "Stand in the street and see what you changed." |
| Take the next call | Shows the next call's name, lead and duration and says it arrives in the next build; free roam continues. | Q02 is M2 (T09). |
| Playtest events | The game fires `lowbridge:event` on the window for answers, recruits, the shutter, handovers (with simulation and real seconds since Start), heat, escape, capture and bumps. Only the private claude.ai test page records them. | Gate evidence without telemetry in the game. |

### Evidence

| Check | Result | Environment |
| --- | --- | --- |
| `npm run typecheck`, `npm test`, `npm run build` | Pass. 53 tests. JS about 384 KB gzipped. | Container |
| Fixture match | Q01 IDs, branches, trust deltas, flags, next jobs and initial state equal the fixture; every fixture node exists on a road. | `tests/content.test.ts`, `tests/map.test.ts` |
| T04: both destinations by the ring road, shutter shut | Pass; the yard route is less than half the distance once open. | `tests/map.test.ts` |
| T05/A02: direct run to Mo, and to Nell, no recruit | Pass in rules tests and in the browser. Browser handovers at 37 s (Mo) and 41 s (Nell) of simulation by a cautious scripted driver. | `tests/session.test.ts`, `scripts/smoke-m1.mjs` |
| A07: double tap, stale tab, damaged save | One receipt and one trust award; the stale tab adopts the committed outcome; a damaged current save falls back to `previous`. Double tap also passes in the browser. | Tests and smoke |
| Reload | After Park up, reload shows "You gave Mo the battery…". After recruit and Lift, reload keeps the shutter open and Clatterjack in the roster. | `scripts/smoke-m1.mjs` (real IndexedDB) |
| T06/A04: encounter | Early washer bounces and costs a turn; leaving and resuming keeps the turn; Dim then washer recruits once; full team sends to roster; Lift needs Clatterjack. | Tests and smoke |
| T07/A05/A06: express car and patrol | Heat on taking; handover and encounter refused with "Lose the patrol first"; pause freezes the chase; sitting still gets you caught with the battery kept; hiding for 6 s clears heat; reload mid-chase restarts at the lay-by. | Tests; capture and pause also in the browser |
| A10 (failure message part) | `?failsave=1`: "Progress hasn’t saved" shows and nothing changes. | Smoke |
| M1 gate: five people, four reach a handover within five minutes | **Pending.** Needs people. The test page records each handover's real time since Start. | |

### Known issues

- The arrow picks the nearer recipient; a player heading for the other one follows the pins instead. Watch whether that confuses anyone.
- Driving is still the main source of bumps; the patrol now adds car-to-car contact.
- On a narrow phone frame (750 × 324) the job line, caption and toast stack at the top; the patrol chip sits bottom centre between the thumbs.
- Unnamed buildings have no roof outline, so some blocks read as plain dark brick.

### Next ticket

T09–T11 (M2): Q02 both branches, Q03, Q04 and the shift close; quick jobs and the dispatch board; offline assets and export/import. First, run the M1 gate with five people and the M0 controls gate in Safari.

## M2 record • one whole shift (T09–T12)

Built 22 November 2026, autonomously, straight after M1 (the owner asked to continue without testing M1). Every check below ran in the Linux container (Node 22.23.5, headless Chromium via Playwright 1.63). **No M2 check has run on a phone or with a person yet.**

### Decisions where the build differs from or fills in the spec

| Area | Chosen behaviour | Reason |
| --- | --- | --- |
| Story beats as data | Each beat in `src/rules/content.ts` is a caller line plus steps at authored places (talk, act, Wickwing reveal, pickup, puzzle, watch). Small named handlers in `session.ts` do the special parts. One commit per step, so every step is a checkpoint. | "Plain data with small named rule handlers." |
| Q02F Low water | Talk to Mo on the quay, then follow wet footprints (drawn only during that step) to an old council post: a rubbing of the left half of the plate, stamped ≈ Waves, and the old ticket-office address. | As specified; the stamp feeds Q04. |
| Q02M Under the stalls | Talk to Nell, then listen along the stalls; a caption says when the ringing is louder; open the hatch under the end stall: the right half, stamped Ω Bell, and the same address. | "Trace a bell under her stall." Both branches give the same address, so they converge at Q03. |
| Q03 Return to sender | At the ticket office: look under the counter (matching half), then "Dim · Wickwing" reads the painted-over number: depot switchboard, line 3, stamped ◎ Three rings. A missed Clatterjack is still hinted by the coins on the ticket machine. | Uses the starter's field skill. |
| Q04 Crossed lines | Take the relay from the depot switchboard, carry it to a cabinet inside the builders' yard (through the shutter if open, otherwise round the ring road and in by the yard lane), then pick the two symbols from your journal: your branch's stamp plus Three rings. A wrong pair buzzes and you try again; nothing is lost. | "Match two large symbols shown in the journal." Works with or without Clatterjack. |
| Shift close Three rings | The riverside warning lamp lights after Q04. At the viewing point, "Watch the mud": Reedlings ring in turn along the water's edge; log the sighting, then radio Mo or Nell first. Their reply and the journal line differ. Shift one is then complete; shift two is marked as a later build. | As specified. Reedling is a sighting only (recruitable in M3). |
| Next lead | Saved as `shift.lead` and offered by "Take the next call" on every result card, and on the dispatch board (Pause → Dispatch board). | "Persist the next lead between calls." |
| Dispatch board | One card: the waiting story call with its duration, Last post with your best, Lost property with how many found, Drop for a running quick job, Park up, Back to the street. One job at a time. | "Compact dispatch board with Park/Continue and duration estimates." |
| Last post | Collect the sorted mail at the depot switchboard, post it at the quay post box. The clock runs in simulation time only, from collecting the mail. Any heat during the run puts it in the chase category, even if heat clears before posting. Quiet and chase bests are kept apart. | "Quiet runs compete against quiet runs." |
| Lost property | Three sites (a glove at the market, an umbrella by the ring road, a scarf on Back Lane). Each run marks the first one not yet found, then goes round again; hand it in at the depot. Each site is recorded once. Never moves trust. | As specified. |
| Save schema 2 | Adds `shift`, `quick`, `journal` and `sightings`. Schema 1 (M1) saves and exports are migrated in memory on load and written as schema 2 at the next commit. `tests/fixtures/save-v1-mo.json` is a saved M1 export used as the migration fixture. | "An older supported format migrates in a transaction; test with a saved older fixture." |
| Export and import | Pause → Your save. Export downloads a `lowbridge-save` JSON file and also shows the text to copy, because some views block downloads. Import takes a file or pasted text, previews it with its return line, and only replaces the save when you confirm. The replaced save becomes the "previous" slot, so Restore previous save undoes it. Newer, malformed and damaged files are refused and nothing changes. | "Preview the import and retain the previous good save." Safari and Home Screen saves are separate; export/import is the transfer route. |
| Offline | `vite.config.ts` writes `sw.js` at build time with this build's exact file list and a `lowbridge-<build>` cache. Housekeeping deletes only `lowbridge-` caches, as the site's other apps do. Cache-first, with the page shell for navigations. "Available offline" appears in Pause only after the worker reports every file cached and controls the page. Manifest (landscape, standalone) and 192/512 icons added. | Technical plan, offline section. |
| Staged updates | A new build installs beside the old one and waits (no automatic skipWaiting). Pause shows "Update ready · restart now"; pressing it saves a checkpoint, switches workers and reloads. | "Offer a restart at a saved boundary." Pause is a safe boundary. |

### Evidence

| Check | Result | Environment |
| --- | --- | --- |
| `npm run typecheck`, `npm test`, `npm run build` | Pass. 65 tests. | Container |
| T09: both branches reach the close (rules) | Q02F and Q02M run through Q03, Q04 (wrong pair refused) and the close; trust only moves with the battery. | `tests/shift.test.ts` |
| T09: both branches in a session | The Mo branch played straight through; the Nell branch played straight through and split across five relaunches from the save. | `tests/shift.test.ts` |
| A09: continuous vs split | Identical progress for the same choices (receipts compared without instance IDs). | `tests/shift.test.ts` |
| A08: quick job between calls | Park after Q01, relaunch, do Lost property, then take the call: Nell calls, Q02M starts; no trust from the quick job. | `tests/shift.test.ts` |
| A16: chase category and paused time | Paused time is not scored; heat during the run files it as a chase even after heat clears; the quiet best is untouched. | `tests/shift.test.ts` |
| A10: import cases | Saved M1 export migrates with everything earned and the next lead; malformed, newer and damaged files refused; failed import leaves the slot untouched; export round-trips. Browser: export, two refusals with no change, round trip into a fresh profile. | Tests and `scripts/smoke.mjs` |
| A11 (browser half) | After "Available offline on this device", cutting the network and reloading boots the cached build. | `scripts/smoke.mjs` offline |
| Last post in the browser | From an imported M1 save: board, collect, post, quiet best recorded, trust unchanged. | `scripts/smoke.mjs` lastpost |
| Full Mo branch in the browser | From an imported M1 save: Q02F (talk, rubbing), Q03 (counter, Wickwing), Q04 (relay, cabinet pair), the close (watch, radio Mo first), then reload shows “Shift one is done…”. No page errors. | `scripts/smoke.mjs` shift |
| Safari, Home Screen, flight-mode relaunch on a phone (A11), preview deploy over an older build (A12) | **Pending.** Needs a phone and a hosted preview at /lowbridge/. | |
| M2 gate: three first-time shift runs, one five-part split run | **Pending.** Needs people. | |

### Known issues

- Story steps are short walks between existing landmarks. Playtests may find the shift under 20 minutes; the spec says to add a return journey or discovery rather than slow driving.
- The dispatch board lives in Pause and on result cards; there is no in-world board yet.
- Offline was checked in headless Chromium only. iOS Safari and Home Screen behave differently and must be checked on the phone.
- The claude.ai test page cannot use a service worker or start downloads, so offline and the export file only work from jsip.uk or a local preview; the export text box works everywhere.

### Next ticket

T12's people gate, then M3 (T13): Riverside shifts 2–3, Reedling as a recruit, team selection, mastery, trust recovery and the first captain contest.
