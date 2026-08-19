# Codex Kickoff Prompt — Standing Start Phase 1

You are the primary implementation engineer for **Standing Start**, an original portrait mobile arcade kart racer.

Your job is to build **Phase 1 only: the driving-feel prototype**.

Read `STANDING-START-PHASE1.md` in full before changing anything. Treat it as the source of truth.

## Objective

Build the smallest working prototype that answers:

> Is driving around an ugly oval fun for two minutes with nothing else in the game?

The prototype must contain only:

- portrait Canvas game view
- one simple data-driven oval track
- one placeholder vehicle
- auto acceleration
- one-thumb steering
- drift initiation and sustained drifting
- three drift-boost charge tiers
- boost release
- camera behaviour
- collision / off-track response
- automatic recovery when badly stuck
- live tuning panel
- FPS / performance overlay
- reset / restore-default controls

## Do not build

Do not add:

- menus
- polished game UI
- artwork beyond primitive placeholder geometry
- items
- opponents / AI
- progression
- currencies
- unlocks
- multiple tracks
- multiple vehicles
- characters
- audio
- ghosts
- multiplayer
- accounts
- backend
- analytics
- monetisation
- native packaging

Do not “prepare for” these with unnecessary abstractions.

## Technical default

Use **HTML5 Canvas 2D with pseudo-3D projection**.

Prefer plain HTML/CSS plus TypeScript or JavaScript.

Do not introduce React, Three.js, Godot, Phaser or another engine unless you first demonstrate a concrete blocker against the Phase 1 requirements.

Requirements:

- `requestAnimationFrame`
- frame-rate-independent simulation using delta time
- driving tunables centralised in a configuration object
- simulation separated from rendering
- track represented as data, not hard-coded renderer geometry
- minimal dependencies
- statically hostable
- mobile-first
- offline/PWA structure only where it is cheap and does not distract from feel
- target 60fps on a roughly three-year-old mid-range Android phone

## Starting feel values

Implement these as editable defaults, not hard-coded magic numbers.

### Base driving

- top speed: `100`
- 0 → top speed: `1.6 s`
- drift minimum speed: `40%` of top speed
- steering assist: `18%`
- wall impact speed loss: `20%`
- off-track speed: `70%` of normal

### Drift

- committed drift-entry gesture target: `~180 ms`
- starting gesture distance target: `~35 px`
- drift steering authority: `+35%`
- maximum drift speed loss: `~8%`
- overcook begins: `~2.5 s`
- overcook progressively reduces steering effectiveness
- no spin-out

The vehicle should have an obvious outward slide during drift.

### Boost tiers

Tier 1:
- charge: `0.65 s`
- speed: `+12%`
- duration: `0.55 s`

Tier 2:
- charge: `1.25 s`
- speed: `+20%`
- duration: `0.85 s`

Tier 3:
- charge: `2.0 s`
- speed: `+30%`
- duration: `1.15 s`

### Touch interpretation

- interaction area: lower ~65% of viewport
- quick tap maximum: `160 ms`
- tap movement tolerance: `<10 px`
- steering begins after roughly `10 px` horizontal movement
- fast committed sideways motion while steering initiates drift
- hold maintains drift
- horizontal movement while held adjusts drift line
- release exits drift and fires earned boost
- ambiguous input always favours driving

No brake.
No manual reverse.
No separate drift button.

### Camera

- follow lag: `~100 ms`
- slight steering-direction look-ahead
- boost camera pull-back: `~6%`
- pull-back transition: `~120 ms`
- return transition: `~250 ms`

## Live tuning

Create an on-screen tuning panel that can change the important parameters while testing.

At minimum expose:

- acceleration
- top speed
- base steering
- steering assist
- collision penalty
- off-track penalty
- drift minimum speed
- drift gesture thresholds
- drift steering multiplier
- drift speed loss
- overcook timing / penalty
- every boost tier threshold / multiplier / duration
- camera follow lag
- camera look-ahead
- boost camera behaviour

Also provide:

- Restore Defaults
- Reset Vehicle
- Hide / Show Panel

The panel can be ugly.

## Debug overlay

Show:

- FPS
- frame time
- speed
- steering input
- drift state
- drift duration
- charged boost tier
- active boost remaining
- heading
- steering-assist state

## Mobile quality bar

The prototype must:

- work in portrait
- prevent page scrolling / browser gestures interfering with driving where reasonably possible
- resize correctly
- use touch/pointer events sensibly
- remain usable with one thumb
- avoid hover dependencies
- keep debug controls finger-friendly

Keyboard controls are allowed for desktop development, but mobile touch behaviour is authoritative.

## Working method

1. Inspect the existing repository first.
2. Summarise what exists and whether anything conflicts with the Phase 1 spec.
3. Propose the **smallest implementation plan** required to reach a playable prototype.
4. Then implement it.
5. Keep commits/changes small and understandable.
6. Run available tests/lint/build checks.
7. Fix issues you find rather than merely reporting them.
8. Do not expand scope.
9. Where a feel value is subjective, make it tunable rather than spending time pretending the initial number is correct.
10. Do not ask me to choose implementation details that you can reasonably decide yourself.

## Definition of done for this Codex task

Stop when I can open the project on a phone and:

1. drive automatically around the oval
2. steer comfortably with one thumb
3. enter, hold and exit a visible outward drift
4. charge Tier 1 / Tier 2 / Tier 3 boosts
5. release the thumb to trigger the earned boost
6. feel a visible camera response to boosting
7. go off-track and hit boundaries with readable penalties
8. recover automatically from getting badly stuck
9. tune the key feel parameters live
10. see FPS and useful driving state
11. reset instantly and repeat
12. run the prototype without any backend

Do **not** begin items, AI, art, progression or Phase 2.

At completion, give me:

- a short summary of what you built
- files changed
- how to run it locally
- how to test it on a phone
- known limitations
- the first five feel parameters you recommend I tune during the two-minute driving test
