# Acceptance and playtest cards

These are planned checks. Mark pass/fail with an actual build identifier, device, iOS/browser version and date. Keep simulated and physical-device results distinct.

## The two-minute M0 test

Open the preview in landscape. Begin on the pavement. Walk to the van, enter it, turn the corner, stop in the marked bay, exit and answer the phone on foot. Repeat with the other steering preset. Ask which scheme made parking easier and note any button covering a landmark. Switch away mid-acceleration, then resume. The van must wait for fresh input.

## Regression cases

| ID | Setup and action | Expected result |
| --- | --- | --- |
| A01 | Touch and keyboard run the M0 lap. Rotate while driving, then lose focus with controls held. | No stuck throttle, giant time step or trapped exit. Phone can be answered. |
| A02 | Run Q01 direct to Mo without recruiting. Run a fresh slot direct to Nell. | Both recipients reachable by road. Correct crew +1, other -1, world flag and follow-up persist. |
| A03 | Repeat both endings with Clatterjack and the shortcut. Try the shutter before recruiting and after reload. | Initially closed, then open after using Lift. Either recipient still reachable. |
| A04 | Offer the washer early. Back away. Return, use Dim, quit on the settled calm turn and resume. | Washer remains available, turn matches, recruit and guide entry committed once. |
| A05 | Leave the depot on foot, take a different car, get caught carrying cargo, retry. | Counteroffer appears. Depot recovery preserves the one battery, companions and both delivery options. |
| A06 | While in pursuit approach a handover. Escape or recover, then try again. Background mid-chase. | Blocked action explains “Lose the patrol”. Freeze/resume or restore the last valid chase checkpoint. |
| A07 | Double-tap the handover. Kill/reopen around save; have a second tab try the opposite recipient. | Only one battery outcome and trust award; stale view refreshes. Recovery produces the old or new complete snapshot. |
| A08 | Finish Q01 and park. Relaunch, start a quick job between story calls, then resume the shift. | Correct caller, branch and next location preserved. Quick result never adds duplicate story trust. |
| A09 | Complete each Q02 branch and the rest of shift 1 continuously and across five sessions using equivalent choices. | Same case completion, next offer, crew flags and unique recruits. |
| A10 | Simulate storage write failure or quota pressure, retry and export. Import malformed, newer and older supported data. | Visible save status and safe recovery; existing slot survives failed imports. Valid and migrated data preserve earned unlocks. |
| A11 | In Safari and in Home Screen mode, load online, wait for offline-ready, close and relaunch in flight mode. | Shell, current district, encounter and audio assets available. Continue a saved job. Use explicit export/import for a transfer between contexts. |
| A12 | Deploy preview build B over A under /lowbridge/. Keep an old tab open and roll back in preview. | Other jsip.uk paths unaffected, running client has its assets, compatible saves reopen or stay preserved for the matching build. |
| A13 | Complete Ada’s contest with only Wickwing and on another save with Clatterjack. Lose and retry. Reduce trust and complete the amends job. | Both win paths work; one mark per district; main story stays accessible; trust repair is applied once. |
| A14 | Complete shifts 3, 6 and 9 on saves originating from different battery recipients. Choose both finale outcomes across runs. | District gates open in order, epilogue reflects the operator, all habitats reachable. |
| A15 | Collect three accomplishments for one species; repeat a mastered action; enter the guide after a week away. | One mastery reward, stable guide counts, active team intact, a useful next lead within 30 seconds. |
| A16 | Re-run a delivery using the express car, clear heat before arrival, pause twice. | Result stays in pursuit category; only active simulation time counts; quiet-run record is untouched. |

**Earliest useful runs:** M0 A01. M1 A02–A07. M2 A08–A12 and A16. M3 A13 and A15. M4 A14 plus all regressions. During M1 also exercise the failure message in A10; the backup and import portions arrive in M2.

## Questions for people, away from the debugger

| When | Observe first | Ask afterwards |
| --- | --- | --- |
| Five-minute visit | Time to control, missed landmark, time to handover, source of hesitation. | “What changed because of your delivery?” |
| Twenty-minute visit | Whether they hear a lead, follow it voluntarily and recognise where to stop. | “Which job would you tell someone else about?” |
| One week later | Time to resume and reason for the next chosen activity. | “What were you trying to get back to?” |
| Across four weeks | Actual sessions, case progress and whether optional trips get repetitive. | “Which street or creature did you go looking for again?” |

A small test group gives directional feedback. Record observations in a simple local sheet with build, device, session length, observed choice and one friction point. Timing budgets and content quantity can change in response. End each round by naming one change to test next.

## Phone test plan, M1 to free play

A printable one-page version is in [test-run-sheet.html](test-run-sheet.html) (A4; print it, or render it to PDF with Chromium). Update its build ID when a new test build goes out.

Play on the claude.ai test page (it logs events and errors for review) or a local preview. Start each numbered run from Pause → New game unless it says otherwise. Copy the build ID from the bottom of Pause into the results log.

**Sitting 1 · M1, about 20 minutes**

| # | Do | Look for |
| --- | --- | --- |
| 1 | Answer the phone, drive the roads to Mo, give him the battery. Park up, close the page, reopen. | Ferry lights up first, result card about 2 s later. Reopen says you gave Mo the battery. Time to handover under 5 minutes. |
| 2 | New game. Answer, walk to the ticket machine, recruit the crab (try a wrong move once), lift the yard shutter, shortcut to Nell. | Stalls light one by one. Shutter stays open after a reload. Clatterjack in the journal. |
| 3 | New game. Answer, take the red express car by the ticket office. Lose the patrol once (out of sight 6 s). Next time, let it box you in. | Heat chip reads clearly. Caught puts you at the depot on foot with the battery still yours. |
| 4 | Mid-drive: lock the phone, swipe home, turn to portrait, come back. | Paused, nothing moved, no stuck steering. |

**Sitting 2 · M2, about 30 minutes plus a split run over a day**

| # | Do | Look for |
| --- | --- | --- |
| 5 | From run 1 or 2: Take the next call and play straight through Q02, Q03, Q04 and Three rings. | Total time (aim 20–30 min). Can you say how the battery choice led to the last call? Where did you hesitate? |
| 6 | Same shift on a fresh save, in five parts: Park up after each call, close the page, come back later. | Each return line says where you are and what's next. Same ending as the straight run. |
| 7 | Pause → Dispatch board: Last post (one quiet run, one with a chase), then Lost property three times. | Quiet and chase bests kept apart. Trust never moves. |
| 8 | Pause → Your save: Export, New game, Import (check the preview), then Restore previous save. | Nothing changes until you confirm. Restore undoes the import. |

**Sitting 3 · free play, about 15 minutes**

| # | Do | Look for |
| --- | --- | --- |
| 9 | Give someone the game with one word: "explore". Watch for 10 minutes, don't help. | What they found first. Did they find a shop on their own? What did they do twice? |
| 10 | Walk through the pigeons by the depot; drive through some; honk near a flock. | They scatter and come back. Horn button is easy to hit and not in the way. |
| 11 | Talk to Arthur (quay), Priya (Station Road), Kez (market), Dee (north side of Station Road) and a passer-by. Nudge someone with the van. | Lines read well. A bump is funny, not upsetting. "Get in" never turns into "Talk" by accident. |
| 12 | Drive onto the dashed bay at Body & Paint and stop. Walk to the lit window at Second Thread. Buy chips on Harbour Road. | Shop panel readable on the phone. Locked pieces explain themselves. Van and jacket change on the street. |
| 13 | After Mo's call, hang around the depot until the phone rings again. Then Pause → Journal → Around town. | Wrong number answers. Counts match what you did. An unlock toast when you earn one (five chats unlocks the flat cap). |
| 14 | Pause: switch steering A and C, pick a jacket, Sound off, Reduce motion. | Each one sticks after a reload. |

**Blocked until the jsip.uk release (needs the owner's OK)**: offline relaunch in flight mode and from the Home Screen (A11), an update over an older build (A12), plain Safari outside the Claude app.

**People gates**: M1 wants five fresh testers on run 1; M2 wants three testers on run 5 and one on run 6; free play wants one tester on run 9. Record device, time, where they stopped and one friction point each.

## Results log

Simulated and physical results stay in separate rows. Copy the build ID from the bottom of the pause screen.

| Date | Build | Device, iOS, browser | Test | Physical? | Result | Preferred scheme, overshot junctions, thumb occlusion, notes |
| --- | --- | --- | --- | --- | --- | --- |
| 2026-11-21 | m0-2026-11-21 (pre-commit) | Linux container, headless Chromium 844 × 390 | A01 keyboard lap, both presets; held key through blur | No (simulated) | See build board M0 record | Scripted driver, not a person. |
| 2026-11-21 | m0-2026-11-21-27de4d6 | iPhone (model and iOS not recorded), private claude.ai page | Free play, both presets | Yes, but framed inside claude.ai | Smooth | Pad plus separate Reverse button felt tricky. Pull-back reverse added in the next build. |
| 2026-11-22 | m0-2026-11-21-c16a8ce | iPhone, iOS 18.7, Claude app 1.261116.19 (framed page, 750 × 324 CSS px, landscape) | Two logged laps, steering A with pull-back reverse | Yes, but framed inside the Claude app | Pass: lap 1 0:28, 2 bumps; lap 2 0:36, 2 bumps; no errors | Captured by the test page. Pull-back reverse: "better" than the separate button. Bumps were lamp posts and the phone box. |
| 2026-11-22 | m0-2026-11-21-c16a8ce | iPhone, iOS 18.7, Claude app 1.261116.19 (framed, 750 × 324) | Two logged laps, steering B | Yes, but framed inside the Claude app | Pass: 0:41, 3 bumps; 0:17, 0 bumps; no errors | Liked B's Go and Brake, not the big Left/Right buttons. Asked for a direction pad on the left and Go on the right: added as steering C. |
| 2026-11-22 | m0-2026-11-22-44af693 | iPhone, iOS 18.7, Claude app 1.261116.19 (framed, 750 × 324) | Two logged laps, first steering C | Yes, but framed inside the Claude app | Pass: 0:45, 3 bumps; 0:31, 2 bumps; no errors | Still a bit tricky. Wants a slower van, maybe a boost in some missions. Forward/back and Go/reverse felt counterintuitive. |
| 2026-11-22 | m0-2026-11-22-4100c9d | iPhone, iOS 18.7, Claude app 1.261116.19 (framed, 750 × 324) | Two laps with simpler C, one with A, slower van | Yes, but framed inside the Claude app | Pass: C 0:17 (0 bumps), C 0:27 (1 bump: wall at 23,34), A 0:34 (0 bumps); no errors | Slightly prefers C; keep A as a setting. The bump was the ticket office front, where the job arrow pointed through the building: arrow now follows the roads. |
| 2026-11-22 | m0-2026-11-22-2bc0b49 | Owner notes | Free play | Yes, framed in the Claude app | Notes | Phone line never changes (expected for M0). Wants to see the courier walk, legs stepping in front, arms maybe, and a jacket colour option: added. |
| 2026-11-22 | m1 (this branch) | Linux container, headless Chromium 844 × 390 | A02–A07 scripted: both endings, crab and shutter with reload, patrol with pause and capture, double tap, ?failsave | No (simulated) | Pass, 7 of 7 scenarios (incl. A01 held key through blur) | Scripted driver, not a person. Handovers at 37 s and 39–41 s of simulation. |
| | | iPhone ___, iOS ___, Safari | M1 five-minute test, tester 1 to 5 | Yes | Pending | Record real seconds to handover and the answer to “What changed because of your delivery?” |
| 2026-11-22 | m2 (this branch) | Linux container, headless Chromium 844 × 390 | A08–A11 and A16 scripted: Mo branch to the close from an imported M1 save, Last post, export/import, offline relaunch; plus all M1 scenarios | No (simulated) | See build board M2 record | Scripted driver, not a person. |
| 2026-11-22 | m2 + free play (this branch) | Linux container, headless Chromium 844 × 390 | Free play scripted: pigeons, horn, Body & Paint, Second Thread, a chat, journal, reload; plus every M1 and M2 scenario | No (simulated) | See build board free play record | Scripted driver, not a person. |
| | | iPhone ___, iOS ___, Safari | Free play, 10 minutes, no instructions beyond "explore" | Yes | Pending | Record what they found first, whether they found a shop on their own, and what they did twice. |
| | | iPhone ___, iOS ___, Safari and Home Screen | M2 shift run, testers 1 to 3, and one five-part split run | Yes | Pending | Record total time, where they stopped, and whether they can say how the battery choice led to the final call. |
| | | iPhone ___, iOS ___, Safari | Two-minute M0 test, tester 1 | Yes | Pending | |
| | | iPhone ___, iOS ___, Safari | Two-minute M0 test, tester 2 | Yes | Pending | |
| | | iPhone ___, iOS ___, Safari | Two-minute M0 test, tester 3 | Yes | Pending | |
