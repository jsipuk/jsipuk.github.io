# Phase 1 spec review

Review of `STANDING-START-PHASE1.md` and `CODEX-KICKOFF.md` before implementation begins.

The spec is in good shape: tunables rather than constants, an explicit not-building list, a stated acceptance gate, and an intended emotion attached to each boost tier. The findings below are the places where, as written, the spec would either cost rework or cause Phase 1 to fail its gate for reasons that are not about whether the driving is fun.

Findings are ordered by cost of getting them wrong.

---

## 1. Specify the simulation as 2D world space, projected for rendering

**Risk: rewrite.**

The spec picks Canvas 2D with pseudo-3D projection but does not say how the vehicle is represented in the simulation. There are two conventional models and they are not interchangeable:

- **Track-relative** (classic OutRun / pseudo-3D road): the vehicle has a distance along the track and a lateral offset. Cheap, simple, and the default an implementer will reach for when told "pseudo-3D".
- **World-space**: the vehicle has `x`, `y`, `heading` and a velocity vector, simulated in true 2D top-down space and projected to the pseudo-3D view at render time.

§5 requires that the vehicle "visibly slides outward" during a drift, which means its heading diverges from its direction of travel. The track-relative model has no heading to diverge — it would have to be faked, and the fake breaks down at exactly the moments Phase 1 exists to evaluate. Recovery (§8), and later AI lines and item trajectories, have the same problem.

**Recommendation:** state explicitly that simulation is world-space `(x, y, heading, velocity)` and that the pseudo-3D projection is a rendering concern only. This is consistent with §3's own "keep simulation and rendering separated", but that line is not specific enough to prevent the cheaper choice being made.

---

## 2. The drift-entry gesture collides with ordinary hard steering

**Risk: the prototype answers the wrong question.**

§7 defines steering as horizontal drag beyond ~10px, and drift entry as ~35px within 180ms while already steering. In a real corner, turning in hard *is* a fast committed sideways drag. As specified, these two gestures are separated only by speed, and they overlap in the exact situation where both are plausible.

The likely outcomes are a high accidental-drift rate, or thresholds tuned so conservatively that deliberate drifting becomes unreliable. Either one makes the two-minute test feel bad for a reason that has nothing to do with whether the drift model itself is good.

This is the single riskiest unknown in Phase 1, and the spec commits to one interpretation without testing it.

**Recommendation:** build two or three drift-entry models behind a switch in the tuning panel and decide empirically. Candidates:

- **A — flick, as specified.** Velocity-based, current spec.
- **B — deflection-relative.** Drift triggers when the thumb moves a threshold distance *beyond* the current steering deflection, so a player already at full lock cannot trigger it by turning harder.
- **C — absolute-position steering.** Thumb x-position within the zone maps directly to steering angle; drift is a quick outward flick past the edge of the zone, then hold.

Add an accidental-drift counter (§12) so the comparison is evidence rather than impression.

---

## 3. Outward slide is the main balancing lever and is not a tunable

§5 requires a visible outward slide but gives it no number, and §11 omits it from the tuning panel entirely. This is the wrong omission, because the slide rate is the primary thing that makes holding a drift *cost* something: hold longer and you run wide, so on a tight corner you cannot afford the long charge.

**Recommendation:** promote drift lateral slide rate to a first-class tunable and list it in §11. The overcook steering penalty is a secondary lever; the slide is the primary one.

---

## 4. Tier 3 is strictly dominant as numbered, contradicting §6

§6 states Tier 3 "must not always be the automatically optimal choice". But Tier 3 charges at 2.0s and overcooking does not begin until 2.5s. There is a 0.5s free window in which reaching the top tier costs the player nothing at all. Given that, holding for Tier 3 is always correct wherever the corner physically allows it.

**Recommendation:** set the overcook start at or slightly before the Tier 3 threshold — 1.8s against a 2.0s Tier 3 is a reasonable starting point — so the top tier is bought with degraded steering. Combined with finding 3, the cost then shows up as a worse line, which is the behaviour §6 is actually asking for. Keep both values tunable and expect to move them together.

---

## 5. Boost as a raised speed cap will make Tier 1 imperceptible

**Risk: a real feature reads as broken.**

The tiers are specified as speed *increases* with durations, but not as a mechanism. If boost simply raises the top-speed cap and lets normal acceleration close the gap, the ramp consumes a large share of each boost:

- Baseline acceleration is 100 units in 1.6s, so roughly 62.5 units/s if linear.
- Tier 1 raises the cap by 12 units: ~0.19s of ramp inside a 0.55s boost, average gain about 9%.
- Tier 3 raises the cap by 30 units: ~0.48s of ramp inside a 1.15s boost.

Tier 1 would deliver a few hundredths of a second per use — below the threshold of noticing. And if acceleration is implemented as the common asymptotic approach (`speed += (cap - speed) * k * dt`) rather than linear, Tier 1 becomes effectively invisible, because speed never actually reaches the raised cap within 0.55s.

**Recommendation:** specify boost as an immediate velocity impulse plus a raised cap for the duration, with the split between the two as a tunable, and add a tunable post-boost decay so speed does not snap back. Also re-express the tier feel targets in something measurable — lap time gained per use — so tuning has a target rather than a vibe.

---

## 6. Tuned values must survive a reload, and be exportable

§11 makes the tuning panel mandatory but says nothing about persistence. If a tuning session is lost on refresh — which on mobile happens constantly — the panel fails at its purpose.

**Recommendation:** persist the current tunables to local storage, and add an **Export JSON** control that emits the current values in a form that can be pasted straight back into the config object as new defaults. Without the export step, a good tuning session produces a feeling and no artefact.

---

## 7. The repository structure would overwrite your website

§14 puts `index.html` and `src/` at the repository root. This repo is `jsipuk.github.io` — the root `index.html` is your site's homepage, and root `src/` would sit alongside the existing apps.

**Recommendation:** scope the whole structure under a subdirectory, matching how `bobble-squad`, `piano` and `gym` already work. `kart-racer/prototype/` keeps it beside the design docs; `standing-start/` at root matches the existing per-app convention. Either is fine, but the spec must say which, because an implementer following §14 literally will clobber the homepage.

---

## 8. TypeScript contradicts the no-build-step constraint

§3 asks for "plain HTML, CSS and TypeScript/JavaScript" and, three lines later, "do not require a build service or backend", with static GitHub Pages hosting. TypeScript needs a compile step; GitHub Pages serves files as committed.

The options are to accept a build step and commit compiled output, or to use plain JavaScript with JSDoc type annotations, which gives editor type-checking with no build. Your existing apps are plain JS, and the second option keeps the prototype consistent with them and removes a whole category of "why won't it deploy" friction.

**Recommendation:** pick one in the spec. Plain JS with JSDoc is the lower-friction choice here.

---

## 9. Item use is unresolved and could invalidate the control model

§7 reserves a quick tap for item use "later" and confines gameplay to the lower 65% of the screen. But in Phase 2 the player must use an item *while* drifting, and during a drift the thumb is already held down. A tap therefore requires either a second contact or a different zone — and the upper 35% of a portrait phone screen is not reachable one-handed, which is the whole premise.

Phase 1 could pass its gate and Phase 2 could then force a control redesign, invalidating the tuning work.

**Recommendation:** decide the item-use gesture now, even though items are not built. A brief second contact anywhere in the lower zone is the most likely answer — it works one-handed and cannot collide with a held drift. Add it to Phase 1 as a debug event only, so the gesture is proven not to interfere with driving.

---

## 10. Undefined units will be guessed

Several values have no unit and an implementer will pick one:

- **Steering assist, 18%** — of what? A per-second correction toward the track tangent, a blend factor on input, or a widened collision tolerance are all defensible readings with very different feel.
- **Base steering strength** — degrees per second at full deflection, or a torque?
- **"Effectively stuck"** (§8) — needs a concrete trigger, e.g. speed below X% of top speed for more than Y ms, or off-track beyond Z.
- **Off-track speed 70%** — a hard cap, or a drag coefficient? These feel different on entry and exit.

**Recommendation:** define each in the spec, or accept that the first tuning session will partly be spent discovering what the implementer chose.

---

## 11. Cap device pixel ratio from day one

At DPR 3 on a 1080p phone, a full-screen canvas is over 3 million pixels per frame, and pseudo-3D scanline rendering draws hundreds of trapezoids across them. This is the most likely cause of missing the 16.67ms budget, and the cheapest thing to fix.

**Recommendation:** render at a capped DPR — 1.5 is a good starting point — and expose the cap as a tunable next to the FPS readout, so the performance/sharpness trade-off can be felt directly rather than argued about.

---

## 12. Instrument the gate

The gate is a subjective two-minute test, which is right. But a few free local counters would make the decision much better, and tell you *what* to tune when the answer is "fail but promising":

- lap timer and best lap — so tuning changes can be checked against the clock, not just feel
- drifts initiated, and drifts released under 300ms (the accidental-drift proxy)
- distribution across the three tiers
- time spent off-track

All local, no remote analytics, consistent with §12's existing prohibition.

---

## 13. Filename mismatch

The kickoff prompt tells Codex to read `STANDING-START-PHASE1.md`; §14 of the spec calls it `PHASE1.md`; the uploaded file is `STANDINGSTARTPHASE1.md`. Pick one name and use it in both documents.

---

## Suggested order of changes

Before handing to any implementer:

1. Findings 7, 8 and 13 — mechanical, no design judgement needed.
2. Findings 1, 5 and 10 — specification gaps that will otherwise be guessed.
3. Findings 2, 3 and 4 — the design changes, and the ones worth thinking about rather than accepting.
4. Findings 6, 9, 11 and 12 — additions to the prototype's scope. Each is small and each protects the value of the phase.

Findings 2, 3 and 4 are the substantive ones. The rest are cheap to fix and expensive to discover later.
