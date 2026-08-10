# Bobble Squad — project notes

A short decision log. Ideas recorded here are **not** commitments; the fact that
something is written down does not make it a requirement.

Last updated: Phase 2 planning.

---

## Current product state

**Phase 1 is built, tested and on the branch.** A playable 3D block-world
adventure: one neighbourhood, three missions, three gadgets, a drivable buggy,
block building, eleven hidden badges, local save, offline via service worker,
and it also opens straight from `file://`.

Verified numbers: 264 KB package · 1,285 collision boxes · ~54,000 static
vertices in 36 frustum-culled buffers · 20 `drawArrays` calls per frame · 18
interactables · 11 triggers · 16 movers · 2 build zones · smallest touch target
54 px.

Test suites, all green: 76 node checks (`node test/run.js`) · 130 browser checks
at five screen sizes (`node test/browser.js`) · playthrough · systems ·
offline/desktop · layout · Test Kit · new-feature suite.

**Phase 2 is designed, not built.** See `PHASE2-PLAN.md`.

**A Test Kit ships with the game** (`probe.js`): a monitored mode behind a
long-press and a sum, carrying the 54-check iPad plan, recording frame rate,
errors, falls, stuck spots, dead taps and hammered buttons, and exporting one
self-contained HTML report. Nothing leaves the device. Verified by 34 browser
checks; the iPad pass itself has not happened yet.

---

## Confirmed decisions

- Vanilla JS, plain `<script>` tags, no build step, no dependencies. Modules were
  ruled out because they break `file://`.
- Custom WebGL1 renderer rather than a 3D library — the world is only ever
  axis-aligned boxes, and a vendored library would be larger than the game.
- No textures, no models, no audio files. Geometry is generated; face shading is
  baked into vertex colours; every sound is synthesised at play time.
- Auto-step of 1.05 units. Below 1.0, half the town becomes unclimbable for a
  small child.
- Jumps are buffered 0.25 s either side of landing, with coyote time.
- Falling is never a punishment: below y = −26 the player returns to the last
  safe ground.
- The camera self-aligns behind the player when idle and moving.
- Building is restricted to marked coloured pads; the 🧱 button hides elsewhere.
- Placed blocks land flush with the ground being stood on, so walking out over a
  gap builds a level bridge.
- Save is one local JSON blob. No account, no network, no telemetry, ever.
- **Phase 2 launch domains: numeracy, spatial reasoning, logic/reasoning.**
  Phonics is fenced behind its own decision because it is the only one needing
  recorded speech.
- **Phase 2 adds no new gestures and no modal screens.**

---

## Assumptions

- Sessions of roughly 10–25 minutes, adult nearby but not coaching.
- The town is replayed many times, so content must vary on repeat.
- A 5-year-old reads the mission *icon*, not the mission *text*.
- Most play time is free exploration between missions, so educational content
  anchored only inside missions would be under-encountered.
- Numbers must be shown as dots first; numerals are an overlay, not a default.

---

## Open questions

- **Real iPad/Safari behaviour is completely unverified** — frame rate, touch
  feel, safe areas. Highest-priority unknown.
- Will children notice world-anchored challenges without a waypoint?
- Is `speechSynthesis` usable offline on iPadOS with an acceptable voice, and
  does it need a fresh gesture per utterance?
- Is counting objects in an oblique 3D view materially harder than counting flat?
- Is the proposed adult gate (long-press + two-digit sum) actually resistant to
  a 7-year-old?
- How long will a child stay with one machine before wandering off? The 20 s
  first-hint timing is currently a guess.

---

## Bugs found on a real device

**Found on an iPhone, none of which any automated check could see, because all
of them were layout.** All three are fixed and now covered by
`test/browser.js`, which runs at two phone sizes and three tablet sizes.

| Reported as | Actually was | Fix |
| --- | --- | --- |
| "Start again doesn't seem to reset everything" | The confirmation was *added below* the pause menu, so on a phone-height screen the panel outgrew the display and "Yes, start again" sat off screen. The reset was never running. | The confirmation now **replaces** the menu, and the panels are compacted below 560px of height |
| (not reported — found while reproducing) | The rotate-your-tablet card was a full-screen overlay that swallowed every touch. In portrait the game was **completely unplayable** — you could not even press play | It is now a small floating card with `pointer-events: none` |
| (not reported — found while reproducing) | On a phone in portrait the objective card ran underneath the badge counter, and a message covered both | Card capped to the room actually available; messages drop below the top row on narrow screens |

The lesson worth keeping: `test/run.js` had 76 green checks and the game had
three visible bugs on a phone. Geometry needs a browser at the real size.

---

## Open bugs — reported, not yet fixed

### B1 · The buggy steers backwards (v1.2)

**Reported:** "why does the car drive the opposite of the controls? left and
right seem inverted." Push the stick right and the Puttabout turns left.

**Not yet fixed. Do not fix by guessing the sign — read this first.**

Confirmed by reading the code; not yet reproduced in a browser. There are two
opposite yaw conventions in `game.js` and the buggy is on the wrong one:

| | Forward vector | At yaw 0 |
| --- | --- | --- |
| Player (`game.js:1211`) | `(-sin yaw, -cos yaw)` | −Z |
| Buggy (`game.js:1012`) | `(+sin yaw, +cos yaw)` | +Z |

They are exact negatives of each other. The follow camera papers over it at
`game.js:1460` with `want = buggy.yaw + Math.PI` — that `+ Math.PI` **is** the
bug, still visible. It puts the camera on the correct side, so driving *looks*
right, but it means screen-right is −X while `buggy.yaw += steer` (`game.js:1009`)
turns the buggy toward +X. Push right, turn left.

Things to check before touching it, because a naive sign flip will break two
of them:

- `buggy.roll` at `game.js:1010` is derived from the same `steer` and leans the
  body into the turn. Flip the steering without flipping the roll and the buggy
  leans the wrong way — which is subtle enough to ship by accident.
- Reverse already re-inverts steering (`buggy.speed < 0 ? -1 : 1`, same line).
  Reversing must stay correct after the fix.
- Exit position uses `(cos yaw, −sin yaw)` at `game.js:983` — a *third*
  convention. Check the player still steps out beside the buggy, not into a wall.
- `player.yaw = buggy.yaw` at `game.js:1039` copies a buggy yaw straight onto a
  player yaw across the two conventions. Worth checking which way the driver is
  facing when the buggy is drawn.

The cleanest fix is probably to put the buggy on the player's convention and
delete the `+ Math.PI`, rather than to flip one sign in isolation.

**No test would have caught this.** `test/browser.js` and the playthrough
harness both assert only that the buggy *moves* and *arrives*. Whatever the
fix, it needs a check that asserts the sign — "steer right, and the world's
heading changes in the direction the player pushed" — not just displacement.

### B2 · Badge b9 (Buggy Bay roof) cannot be reached (v1.2)

**Reported:** "seemingly impossible to get the last badge", with a map
screenshot. Matching the screenshot against a rendered reference confirms the
objective ring is on **b9, the Buggy Bay roof** — every other badge was
already found.

**Not yet fixed.**

The badge is fine. Placed on the roof, it collects normally. **The stairs are
the bug.** `world.js:670`:

```js
// roof access ladder-of-blocks up the outside (kid-friendly stairs)
for (i = 0; i < 5; i++) w.b(25.2, i * 1.2, 9 + i * 0.9, 2, 1.2, 2.2, C.metal, …);
```

Each riser is **1.2**. `STEP_UP` is **1.05**. They miss being walkable by 0.15
of a unit. The comment says "kid-friendly stairs" — the intent was clearly to
walk up them, and you cannot.

What is left is a five-hop precision climb onto shelves only **0.9 deep**
(each step is 2.2 deep but the next one eats 1.3 of it). Measured in the real
game, driving the real touch stick:

| | Result |
| --- | --- |
| Walk into each of the 5 risers | **0 of 5 climbed** — height never changes |
| Jump at each riser from the shelf below | Only the first one lands; the rest drop you to the ground |
| Same again with Bounce Boots on | No better — boots overshoot a 0.9-deep shelf |
| Player placed directly on the roof | Badge collects immediately, so b9 itself is correct |

**Same bug, second site.** `world.js:689` builds the Build Yard scaffold with
**1.9** risers under the comment "scaffold steps you can walk straight up".
1.9 is above `STEP_UP` *and* above the 1.73 jump apex, so that one is
Boots-only whether or not it was meant to be. Badge b8 sits on top of it. It
is reachable — boots clear 5.64 — so it is a nastier difficulty spike than a
blocker, but the comment is still describing something the geometry does not do.

**The fix is one number in each loop** — bring both risers to 1.0, under
`STEP_UP`, adding steps to keep the same total height. Do not raise `STEP_UP`
to meet them: it is 1.05 precisely so that one block is climbable and two are
not, and moving it would silently make half the town's parapets walkable.

**Why nothing caught it.** `test/run.js` asserts only that a badge has ground
beneath it — a badge on an unreachable roof passes. The missing check is a
walkability flood fill from spawn, and the general rule it should encode:
**any riser a player is meant to walk up must be ≤ `STEP_UP`.** That single
assertion over every stacked-box staircase in `world.js` would have caught
both of these at build time.

## Self-review before going live

A pass over graphics, world placement and the levels, with the fixes applied.

| Found | Why it mattered | Fixed by |
| --- | --- | --- |
| **Pressing a person did nothing.** The action played a *duck quack* and puffed six specks 2.6 units over their head. Every NPC carried a `line` field that was never read — dialogue I designed and never built | The hand icon promises a greeting. Offering an action that does nothing teaches a child the button is a lie | Bobbles turn, wave, pop a picture bubble, and each has a real job: hints, hat colours, badge pointers |
| **No way to know where anything is** | A block town at eye level is a maze of similar boxes, and a child who walks the wrong way has no way back | The map, plus four landmarks tall enough to see over the rooftops |
| **Trampolines and the musical steps were flat mats** | They read as carpet. Nothing about the silhouette said "stand on me" | Trampolines on legs with frames and chevrons; keys raised with white tops in a dark surround, under an arch |
| **Trees were three fat green slabs** | At any distance they were walls of green, not trees | Trunk left visible, canopy steps inwards three times |
| **The paddling pool was ten cubes in a ring** | Read as scattered litter | Continuous rim, one clear water surface |
| **Roofs were featureless slabs** | Badges are up there; arriving at an empty plane is a let-down | Vents, tanks and aerials |
| **The lookout could not look out** | Its own posts and rails filled the view | Thinner posts at the corners, lower rails |
| **The Squad pole was planted in the plaza** | It loomed over the fountain and shed detached cubes into mid-air | Moved onto the café roof where it belongs |
| **Pause offered no way to re-read the controls** | The controls are taught once, in a toast, at the start. A child who put the iPad down for a week had nowhere to look | A Help panel on pause: the current objective plus six control chips drawn as miniatures of the real buttons |
| **No build identity anywhere in the game** | A bug report saying "it did the thing" is unanswerable without knowing which build | Version on the pause panel, and a node check that the service worker cache name carries it |

Still open, deliberately: the sky is a flat colour; the buggy cannot climb to
the deck; free play after mission three is thin (badges only).

## Playtest observations

*None yet. No child has played this.* Everything in the design that claims a
child will do something is a hypothesis until this section has entries.

The Test Kit is the intended way to fill this in: run the P section of
`TEST-PLAN-IPAD.md` with a real 5–7-year-old, then paste the findings here.
The automatic counters worth reading afterwards are **dead taps** (pressed ⭐
with nothing there — confusion), **stuck** (45 seconds without moving) and
**time on each objective**.

---

## Educational observations

*None yet.* To be filled from Phase 2F, and from the next experiment in
particular. The finding that matters most: whether children **count** at the
Quantity Socket or simply **place blocks until it stops accepting them**.

---

## Deferred ideas

- Fizzbot arrow-programming (route planning with a real UI panel). Genuinely
  valuable for early computational thinking, but it is the only proposal that
  adds an app-like panel to a world-first game.
- Recorded speech and phonics.
- Science and world-knowledge content — appealing, but content does not reuse
  the way mechanics do.
- Saving the town between sessions beyond placed blocks.
- Weather, day/night, seasons.
- A second neighbourhood.

---

## Rejected ideas

- **Modal educational activity screens.** Fastest to build, and they would turn
  a toybox into a worksheet. Rejected on the product principles, not on cost.
- **A points or stars economy for learning.** Directly contradicts "I figured it
  out" being the reward.
- **Tap-to-select objects in the 3D scene.** Ray-picking demands precision that
  a five-year-old on a moving camera does not have; walk-up-and-press is already
  proven and far more forgiving.
- **An opaque adaptive learner model.** Four levels and four plain rules are
  enough, and can be explained to a parent in one sentence.
- **Difficulty selector shown to the child.** Labels a child as "easy" and
  invites the wrong choice.
- **Continuous auto-bouncing Bounce Boots** (Phase 1). Fun for ten seconds, then
  impossible to stand still long enough to press anything. Now boots only affect
  the jump button.
- **A `groundYAt` clamp on camera height** (Phase 1). It shoved the camera onto
  house roofs. Replaced with the raycast alone plus a first-person fallback.

---

## Next small experiment

**One machine, one mechanic, three children, no framework.**

Build only the Fountain's Hungry Cogs — hard-coded, ~120 lines, no `learn.js`,
no adaptive system, one timed nudge for a hint. Put it on the existing mission-1
route. Watch three children aged 5–7 play it on a real iPad with no explanation.

Hypothesis: *a machine that only works when you get the counting right feels
like a discovery, not a question — and the child keeps exploring afterwards.*

If it fails, delete the 120 lines and redesign the mechanic family before
anything expensive exists.
