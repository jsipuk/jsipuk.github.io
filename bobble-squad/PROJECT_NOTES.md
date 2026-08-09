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

Test suites, all green: 69 node checks (`node test/run.js`) · 40-check browser
playthrough · systems suite · offline/desktop suite · 5-viewport layout suite.

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
