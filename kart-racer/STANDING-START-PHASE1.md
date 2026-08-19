# Standing Start — Phase 1 Feel Prototype

## Status

Phase 0 design is sufficiently locked to begin implementation.

This document is the source of truth for the **Phase 1 feel prototype only**.

Do not expand scope beyond this document unless explicitly instructed.

---

## 1. Product definition

**Game:** Original mobile arcade kart racer  
**Working title:** Standing Start  
**Platform:** Mobile web / PWA first  
**Orientation:** Portrait  
**Primary input:** One thumb  
**Typical play session:** 3–8 minutes  
**Target race duration:** ~90 seconds  
**Hosting:** Static website / GitHub Pages compatible  
**Offline:** Fully offline-capable after first load  
**Backend:** None  
**Accounts:** None  
**Monetisation:** None  
**Nintendo IP:** None

### Player

A casual arcade-racing player who wants:

- immediate controls
- short races
- satisfying drifting
- readable chaos
- quick recovery after mistakes
- a strong “one more race” feeling

### Core player emotion

> Fast, clever and slightly reckless, without ever feeling like the controls are fighting the player.

### Skill philosophy

Target approximately:

- **70% driving skill**
- **30% items, disruption and recovery**

Phase 1 contains no items, but the handling model must leave room for this balance later.

---

## 2. Phase 1 purpose

Phase 1 answers one question:

> Is driving around an ugly oval fun for two minutes with nothing else in the game?

This is a **feel prototype**, not a vertical slice.

### Build only

- portrait canvas
- simple oval track
- one placeholder vehicle
- auto acceleration
- steering
- drifting
- three drift-boost tiers
- camera behaviour
- live tuning controls
- FPS / performance readout
- reset control

### Explicitly do not build

- menus
- polished UI
- items
- AI opponents
- multiple vehicles
- characters
- progression
- rewards
- economy
- cups
- multiple tracks
- audio
- final artwork
- multiplayer
- ghosts
- accounts
- backend
- analytics
- monetisation
- native app packaging

If a feature is not required to answer the Phase 1 question, it is out of scope.

---

## 3. Technical direction

### Renderer

Start with:

**HTML5 Canvas 2D with pseudo-3D projection**

Do not introduce Three.js, React, Godot, Phaser or another engine unless a measured technical constraint makes Canvas 2D unsuitable.

### Implementation principles

- Prefer plain HTML, CSS and TypeScript/JavaScript.
- Keep simulation and rendering separated.
- Keep all driving values in one tunable configuration object.
- Track data must be data-driven rather than hard-coded into rendering logic.
- Use `requestAnimationFrame`.
- Make movement frame-rate independent using delta time.
- Avoid per-frame object allocation where practical.
- Keep the project statically deployable.
- Do not require a build service or backend.
- Keep dependencies minimal.

### Performance target

**60 fps** on a mid-range Android phone approximately three years old.

Frame budget: **16.67 ms**

Initial budget:

- simulation: < 3 ms
- world / track projection: < 4 ms
- rendering: < 6 ms
- controls / camera / prototype UI: < 1 ms
- browser / GC / spare: ~2.5 ms

Measure before optimising.

---

## 4. Driving feel specification v0.1

All values below are **starting tunables**, not final constants.

### Base driving

| Parameter | Starting value |
|---|---:|
| Baseline top speed | 100 speed units |
| Time from 0 to full speed | 1.6 s |
| Minimum speed required to drift | 40% of top speed |
| Steering assist | 18% |
| Wall impact speed loss | 20% |
| Off-track speed | 70% of normal |

### Desired feel

- acceleration feels immediate and arcade-like
- steering is forgiving but not automatic
- the player can intentionally choose a line
- mistakes cost time without destroying the race

---

## 5. Drift model

### Drift entry

A drift begins when:

1. the player is above the drift minimum speed
2. the player is already steering
3. the player makes a sufficiently fast and committed sideways gesture

Starting gesture target:

**~180 ms committed movement**

The exact touch thresholds must be exposed as tunables.

### Drift behaviour

- vehicle visibly slides outward
- drift steering authority: **+35%**
- maximum drift speed loss: **~8%**
- thumb remains held to maintain the drift
- thumb movement continues to steer during drift
- releasing the thumb exits drift
- releasing after a charged tier fires the corresponding boost
- no spin-outs

### Overcooking

After approximately **2.5 seconds** of continuous drift:

- steering progressively becomes harder
- vehicle must not automatically spin out
- the behaviour should encourage release rather than punish experimentation

Target emotion:

> “I could hold this longer, but should I?”

---

## 6. Boost model

### Tier 1

- charge threshold: **0.65 s**
- speed increase: **+12%**
- duration: **0.55 s**

Emotion:

> Nice, I got something.

### Tier 2

- charge threshold: **1.25 s**
- speed increase: **+20%**
- duration: **0.85 s**

Emotion:

> That corner was good.

### Tier 3

- charge threshold: **2.0 s**
- speed increase: **+30%**
- duration: **1.15 s**

Emotion:

> I absolutely nailed that.

### Design requirement

Tier 3 must not always be the automatically optimal choice.

Track geometry, drift difficulty and overcook behaviour should create situations where releasing Tier 1 or Tier 2 is better.

---

## 7. One-thumb controls

### Interaction area

Primary steering / gameplay area:

**lower ~65% of the screen**

### Starting touch interpretation

| Gesture | Behaviour |
|---|---|
| Quick tap | Item use later; in Phase 1 may show a debug event only |
| Horizontal drag | Steering |
| Fast committed sideways drag while steering | Start drift |
| Hold during drift | Maintain drift |
| Move left/right while drifting | Adjust line |
| Release during charged drift | Exit drift and fire boost |

### Starting ambiguity thresholds

- tap maximum duration: **160 ms**
- tap movement tolerance: **< 10 px**
- steering begins after horizontal movement exceeds approximately **10 px**
- drift gesture starting target: approximately **35 px within 180 ms**

These values must be tunable.

### Input priority

When an input could be interpreted as both movement and a tap:

> Driving input always wins.

### V1 control exclusions

No:

- brake
- manual reverse
- second-thumb requirement
- virtual steering wheel
- separate drift button

---

## 8. Recovery behaviour

If the player collides badly or becomes effectively stuck:

- automatically reorient towards the track
- temporarily increase steering assistance
- resume automatic acceleration
- target return to meaningful racing within approximately **1 second**

Player emotion:

> Oops. Recover.

Not:

> My race is ruined.

---

## 9. Camera specification v0.1

### Normal driving

- follow lag: approximately **100 ms**
- slight look-ahead in steering direction
- minimal camera shake
- prioritise readability over spectacle

### During boost

- camera pulls back approximately **6%**
- pull-back transition: approximately **120 ms**
- return transition: approximately **250 ms**
- lightweight speed effect may be added if cheap

The camera should amplify speed perception so the physics does not need extreme speed changes.

All camera values must be tunable.

---

## 10. Track prototype

Phase 1 requires one simple oval.

### Requirements

- obvious inside and outside boundaries
- enough width to test different lines
- at least two broad corners that allow sustained drift
- off-track area
- collision boundaries
- start / reset point

### Data-driven requirement

Even this prototype track must be represented as track data.

Do not couple the oval geometry directly to the renderer.

The future track system will need to represent concepts such as:

- centreline
- width
- corners
- elevation
- surface
- barriers
- scenery zones
- item positions
- start grid
- checkpoints
- AI racing line

Phase 1 does not need all of these implemented.

---

## 11. Live tuning panel

This is mandatory.

The prototype must allow important feel values to be changed **without editing code** and ideally while driving.

At minimum expose:

### Base driving

- acceleration
- top speed
- base steering strength
- steering assist
- off-track penalty
- collision penalty

### Drift

- minimum drift speed
- drift gesture threshold
- drift steering multiplier
- drift speed loss
- overcook start time
- overcook steering penalty

### Boost

For each tier:

- charge threshold
- speed multiplier
- duration

### Camera

- follow lag
- steering look-ahead
- boost pull-back
- boost pull-back transition
- camera recovery transition

### Prototype controls

Provide:

- restore defaults
- reset vehicle
- hide/show tuning panel

The panel may be visually ugly.

Usability matters more than appearance.

---

## 12. Debug / telemetry overlay

Show at minimum:

- FPS
- frame time
- current speed
- steering input
- drift state
- drift duration
- current boost tier
- boost time remaining
- vehicle heading
- whether steering assist is active

Do not add remote analytics.

---

## 13. Mobile requirements

The prototype must:

- run in portrait
- prevent accidental page scrolling while driving
- use touch input correctly
- work with one hand
- account for device pixel ratio sensibly
- resize correctly when viewport dimensions change
- avoid tiny debug controls
- avoid hover-dependent behaviour

Desktop keyboard controls may be added **only as a development convenience**.

They must not influence the mobile control design.

---

## 14. Repository structure

Keep this simple.

Suggested starting structure:

```text
/
├─ index.html
├─ src/
│  ├─ main.*
│  ├─ game/
│  │  ├─ config.*
│  │  ├─ simulation.*
│  │  ├─ vehicle.*
│  │  ├─ input.*
│  │  ├─ drift.*
│  │  ├─ camera.*
│  │  └─ track.*
│  ├─ render/
│  │  └─ canvas-renderer.*
│  └─ debug/
│     └─ tuning-panel.*
├─ public/
├─ README.md
└─ PHASE1.md
```

Adjust where sensible.

Do not create architecture for hypothetical future features.

---

## 15. Phase 1 acceptance gate

Phase 1 is complete only when:

1. it runs reliably on a real mobile browser
2. it can be played comfortably one-handed in portrait
3. all important feel values can be tuned live
4. performance can be observed directly
5. drifting and releasing boosts are readable without explanation
6. the vehicle can recover quickly from ordinary mistakes
7. no out-of-scope game systems have been introduced

Then test:

> Is driving this oval fun for two minutes with no art, items or opponents?

### Pass

Proceed to Phase 2 vertical slice.

### Fail but promising

Tune the feel model and repeat.

### Fail fundamentally

Stop or rethink the handling/control model before adding content.

---

## 16. Phase 2 is not authorised

Do not begin Phase 2 automatically.

Phase 2 will eventually introduce:

- final-quality art direction
- one complete track
- AI opponents
- original item set
- race results
- reward moment

It requires an explicit go-ahead after the Phase 1 gate.
