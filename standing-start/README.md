# Standing Start — Phase 1 feel prototype

One thumb, one oval, no art. This exists to answer a single question:

> Is driving around an ugly oval fun for two minutes with nothing else in the game?

Nothing here is a game yet. There are no items, no opponents, no menus, no
progression and no audio, and none of those should be added before the Phase 1
gate is answered.

## Running it

No build step, no dependencies, no backend. It is plain ES modules served as
static files.

```
npx http-server -p 8099 .        # from the repository root
```

Then open `http://localhost:8099/standing-start/`.

Keyboard controls exist for desktop development only — arrows or A/D to steer,
Shift or Space to hold a drift. **Mobile touch is the authoritative design.**
Anything that feels right with a keyboard and wrong with a thumb is wrong.

### Testing it on a phone

Both devices on the same network, then from the repository root:

```
npx http-server -p 8099 . -a 0.0.0.0
```

Open `http://<your-computer-ip>:8099/standing-start/` on the phone and add it
to the home screen. It caches itself on first load and runs offline after that.

Hold the phone in one hand, standing up, and play for two minutes. That is the
test. Sitting at a desk with two hands tells you nothing about this design.

## The controls

Everything happens in the lower 65% of the screen.

| Gesture | What it does |
| --- | --- |
| Drag left or right | Steer |
| Push past the end of the steering range | Start a drift |
| Keep holding | Hold the drift and charge the boost |
| Move while holding | Adjust the line through the drift |
| Lift | Exit the drift and fire whatever boost was earned |
| Quick tap, or a second finger | Item gesture — counted only, nothing happens yet |

The car accelerates by itself. There is no brake and no reverse.

## Tuning

**TUNE** opens the panel. Every driving value is there, changeable while
driving, and changes take effect on the next frame.

- Values persist across reloads, so a tuning session survives the phone
  locking or the tab reloading.
- **Export** writes the current values as JSON and copies them to the
  clipboard, ready to paste into `src/config.js` as new defaults. Use it — the
  whole point of the session is to produce numbers, not just a feeling.
- **Defaults** restores the shipped values. **Reset car** returns to the grid
  and clears the counters.

## Reading the overlay

The block top-left is the instrumentation. Beyond frame time and the driving
state, it counts what the two-minute test cannot tell you by feel:

- **drifts / aborted** — an aborted drift is one dropped inside 300ms, which is
  the signature of one the player did not mean to start. If this number climbs,
  the drift-entry model is wrong, not the drift model.
- **T1/2/3** — the spread across boost tiers. If it is all one tier, the tier
  thresholds are not producing a decision.
- **walls / offtrack / recover** — where the track is beating the player.
- **laps / best** — so a tuning change can be checked against the clock instead
  of against an impression. This matters more than it sounds: almost every
  change feels faster.

## What was built against the spec

This follows `../kart-racer/STANDING-START-PHASE1.md`, with the changes argued
for in `../kart-racer/PHASE1-REVIEW.md` applied:

- **The simulation is world-space.** The car has a position, a heading and a
  separate direction of travel. The drift is the divergence between the last
  two; a track-relative model has no heading to diverge and the outward slide
  would have to be faked.
- **Three drift-entry models, switchable in the panel.** The spec's flick test
  (model A) overlaps with ordinary hard cornering. Model B — the drift starts
  once the thumb travels past the end of the steering range — is the default
  because it cannot fire by accident. Model C maps thumb position to steering
  absolutely.
- **The outward slide is a first-class tunable.** It is the main thing making a
  long drift cost something, and the spec described it without giving it a
  number or a slider.
- **Overcooking starts at 1.8s, before the 2.0s Tier 3 threshold.** As
  specified — overcook at 2.5s, Tier 3 at 2.0s — the top tier was free, which
  contradicts the spec's own requirement that Tier 3 not always be optimal.
- **Boost is an impulse plus a raised cap plus a faster acceleration**, all
  tunable, rather than a raised cap alone. With a cap alone the acceleration
  ramp eats most of a Tier 1 boost and the player feels nothing.
- **Recovery aims across the track**, not merely along it. Correcting heading
  alone leaves a car pinned against a barrier driving parallel to it for ever.
- **Lap timing and local counters** were added, so the gate decision has
  evidence behind it. Nothing is sent anywhere.

Everything else follows the spec as written. Values that the spec fixed are the
shipped defaults, and all of them are tunable.

## Known limitations

- **The oval's corners are gentle.** In testing, an adequate line needs about
  60% steering lock, so the corners can be taken flat without drifting. Drifting
  is currently worth doing for the boost, not because the corner demands it.
  That weakens the "should I hold this?" tension the spec is aiming at, and a
  tighter second corner is probably the first track change to try.
- **Drift entry has only been proven safe against a synthetic driver**, which
  moves the thumb too smoothly to produce the accidental flicks model A is
  vulnerable to. Model A's real accidental-drift rate needs a human thumb. The
  aborted-drift counter is there to measure it.
- **No audio at all**, which flatters the prototype: engine note and a boost
  sound do a great deal of the work in a real kart racer, and their absence
  makes the driving feel quieter than it will be.
- **One car, no opponents**, so nothing tests whether the handling model holds
  up in traffic.
- **The item gesture is counted but does nothing.** It exists now only to prove
  it does not interfere with steering or drifting.
- Particles very close to the camera are culled rather than drawn small, which
  is occasionally visible as a puff vanishing at the bottom edge.

## The first five things to tune

In this order, during the two-minute test:

1. **Steering rate** (`Base driving`). Everything else is judged relative to
   whether the car goes where you point it. Get this right first.
2. **Drift overtravel** (`Touch`). How far past full lock the thumb must go to
   start a drift. Too small and drifts happen by accident; too large and they
   feel like a wrestling match. Watch the aborted counter.
3. **Outward slide** (`Drift`). How much a held drift costs you in line. This is
   the dial that decides whether holding for Tier 3 is a real decision.
4. **Overcook begins** (`Drift`), against the Tier 3 threshold. The gap between
   them is the size of the free ride.
5. **Tier 1 speed and duration** (`Boost`). Tier 1 fires most often and is the
   easiest to make imperceptible. If you cannot feel it, it is not a reward.

Check the best lap after each change. Almost everything feels faster.

## Tests

```
node test/run.js
```

39 checks covering track geometry, the drift and boost state machines, the
design invariants above, barriers, recovery, lap timing and determinism.
Whether the driving is fun is not testable here — that is what the phone is for.
