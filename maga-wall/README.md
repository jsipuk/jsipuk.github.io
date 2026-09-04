# Build The MAGA Wall

An 8-bit arcade parody for phones. Falling blocks build a defensive wall; zombies
chew through it from the left; an exaggerated pixel rally cheers from the right;
a bald eagle occasionally carries one of the zombies away.

Play it at `/maga-wall/`. No build step — open `index.html` from any static server.

**This is satire.** It is not affiliated with, endorsed by or connected to Donald
Trump, any political campaign, the Republican Party, any MAGA organisation, or
the US government. Every pixel, sound and word in it is original; see
[Assets and rights](#assets-and-rights).

---

## The loop, and why it is not Tetris

The grid is not a scoreboard, it is the wall, seen side-on. Pieces fall into a
7 x 11 grid and stack. Rows are never cleared by the player.

Four rules do the work:

1. **Zombies eat the bottom.** They walk in from the left and bite whatever
   block is in front of them at their own height. When a block dies, the column
   above it **settles down** onto the gap. Damage therefore removes the wall's
   *mass* rather than punching neat holes, and the wall always rests on the
   ground.
2. **Closing a course is the armour mechanic.** Fill a whole row and every block
   in it is promoted one material: BRICK (3hp) → STONE (6) → STEEL (11) → GOLD
   (18). A gold course loses blocks six times slower than a brick one. At wave
   12 that is the entire difference between holding and being overrun.
3. **Building tall is a mistake.** A piece that locks in the top two rows
   topples: you lose the piece, the combo and 150 points, and the top course
   crumbles. Wide and solid beats tall. This inverts the falling-block instinct
   and is the main thing new players have to unlearn.
4. **Dropping a piece on a zombie's head kills it.** That is the player's only
   direct weapon, and it only works once zombies have chewed their way into the
   grid — so offence requires letting them in a little.

You lose when three zombies get past the right-hand face and reach the rally.

### The eagle

Perched on the flagpole, framed by pulsing brackets and a blinking `TAP` when
it is available. Tap it: it dives, grabs the zombie furthest through the wall,
carries it off screen and awards 750. Then it is gone for 22 seconds.

Tapping it when there is nothing to grab makes it screech and costs nothing, so
a wasted tap is never punished. It cannot be spammed: it is only tappable in the
perched state, which the state machine does not re-enter until the cooldown ends.

Two other tap targets, kept rare on purpose: **balloon zombies** (from wave 5)
float over the wall at a height that always clears it — the eagle cannot reach
them, so popping them by hand is the only counter — and a **supply crate** (from
wave 2) which fully repairs every standing block.

---

## Running it

```
python3 -m http.server 8099     # or any static server
open http://127.0.0.1:8099/
```

Add `?dev=1` for developer mode (see [Paywall](#paywall)). Serving from
`localhost` enables it automatically.

### Tests

```
node test/run.js
```

110 checks over the deterministic logic: piece geometry and rotation kicks at
every column, grid boundaries, wall settling, sealing (including the exploit
where zombie attrition used to pay the player), overbuild recovery, the zombie
queue, climbing, breaches, the eagle state machine, scoring, run isolation,
and whether the service worker still lists every source file.

---

## Controls

| | Touch | Keyboard |
|---|---|---|
| Move | `◀` `▶` (hold to repeat) | `←` `→` or `A` `D` |
| Rotate | ring-arrow button | `↑`, `W`, `X` (clockwise), `Z` (anticlockwise) |
| Soft drop | `▼` (hold) | `↓` or `S` |
| Hard drop | the wide `DROP` bar | `Space` |
| Pause | `II` | `P` or `Esc` |
| Eagle / balloon / crate | tap it in the scene | `E` fires the eagle |
| Menus | tap | `↑` `↓` to move, `Enter` to choose |

Movement is on buttons, not gestures, deliberately. The scene already spends
taps on three objects; putting movement on swipes as well would make those
fight the piece. Sliding a thumb between `◀` and `▶` hands the press over, so
the pair behaves like a d-pad rather than two islands.

---

## Architecture

Vanilla ES modules, canvas 2D, no build step, no dependencies — matching the
other projects on this site. A framework would add a toolchain and megabytes to
a game whose entire renderer is `fillRect`.

Everything is drawn into a fixed **208 x ~370 pixel buffer** and blitted up with
smoothing off. Because the buffer is tiny, every rectangle lands on a whole
pixel, so the result is real pixel art rather than a smooth drawing made blocky
afterwards. 208 = 13 cells of 16px: 3 of zombie approach, 7 of wall, 3 of rally.

```
src/
  config.js       every balancing number, and the wave curves as pure functions
  rng.js          seeded PRNG, so a run can be replayed in a test
  pieces.js       shape definitions, rotation states, the shuffled-bag dealer
  sim.js          the game. No canvas, no DOM, no timers, no audio.
  palette.js      the whole colour set
  font.js         a hand-drawn 5x7 bitmap font
  sprites.js      character-grid pixel art, baked to canvases once at boot
  render.js       all drawing; owns particles and popups
  input.js        pointer + keyboard, auto-repeat, button layout
  audio.js        chiptune synth and a step sequencer. No audio files.
  storage.js      settings and high scores
  entitlement.js  the payment boundary. Deliberately inert.
  ui.js           title, how-to-play, settings, about, scores, pause, game over, paywall
  main.js         boot, screen manager, frame loop. The only file that knows about the rest.
```

The dependency direction is strict: `sim.js` imports only `config`, `rng` and
`pieces`. It emits events onto `g.events`; `render.js` turns those into
particles and `audio.js` turns them into noises, and neither can write back.
That is what lets `test/run.js` play thousands of simulated seconds under node
with no browser.

Balancing lives entirely in `config.js`. `hordeDps(wave, tierHp)` states the
curve the tuning is aimed at, and the test suite asserts it stays monotonic.

---

## Paywall

`src/entitlement.js` is an interface with a working shape and **no payment
provider behind it**. It grants three free rounds, then shows a locked screen.
The "unlock" writes a flag to `localStorage` that any user could set themselves.

That is fine for a demo and is not fine for a paid release. Shipping this
commercially needs, at minimum:

- a merchant account and a provider SDK (Stripe Checkout, Paddle, RevenueCat for
  store-wrapped builds) with production credentials that must not live in this repo;
- a server that creates the checkout session and records the purchase on the
  provider's webhook;
- a verification call on boot — client-side state must never be the source of truth;
- restore-purchase backed by that same server, keyed on something the user can
  present on a new device (an account login, or an emailed licence key);
- consumer-law copy: price, what is being sold, refund and cancellation rights,
  terms, privacy. UK/EU distance-selling rules apply.

Swapping provider is one line in `main.js`. Purchase state lives under its own
storage key (`magawall.entitlement.v1`), separate from scores
(`magawall.scores.v1`) and settings, so payment logic can never corrupt save
data — there is a test for it.

## PWA

`manifest.webmanifest` (portrait, fullscreen, 192/512/maskable icons) plus a
cache-first service worker holding the whole shell, so the game runs offline
after one visit. Verified in Chromium: the worker registers and caches 19
entries. **Bump `VERSION` in `sw.js` whenever a shell file changes**, or
returning players keep the old build.

Not yet verified on a real iOS or Android home screen — see Known limitations.

---

## Assets and rights

Nothing here needs clearing before the game is sold:

- **Art** — original, drawn as character grids in `sprites.js` and as rectangles
  in `render.js`. The Americana is generic civic architecture (a domed
  legislature, a columned white residence, an obelisk), not traced from
  photographs. Rally iconography is a red cap and a striped placard. No logos,
  no slogans, no campaign material, no likeness of any real person.
- **Font** — hand-drawn 5x7 bitmap in `font.js`, so there is no font licence.
- **Audio** — synthesised from oscillators at run time in `audio.js`. There are
  no sound files and no music licence.
- **Disclaimer** — on the title screen and in full on the About screen, which is
  reachable from the title and from Settings. Never interrupts gameplay.

If you later add real logos, campaign artwork, photographs or licensed music,
that changes and needs legal review first.

---

## Manual verification checklist

The things a test runner cannot judge. Run through this on an actual phone.

**Feel**
- [ ] A piece slides one column per tap and repeats smoothly when held.
- [ ] Rotation near either wall kicks sensibly instead of refusing.
- [ ] `DROP` lands where the ghost outline said it would.
- [ ] Landing a piece on a zombie's head is satisfying.
- [ ] Sealing a course feels like an event: flash, gold particles, crowd.
- [ ] Screen shake is felt on breaks and breaches, never nauseating.

**Clarity at arm's length**
- [ ] Which column the piece is over is obvious without staring.
- [ ] Damaged blocks read as damaged.
- [ ] The red danger line is noticed before the first topple.
- [ ] The eagle's glowing state is spotted without being told.
- [ ] Score and breach pips are legible in daylight.

**Touch**
- [ ] The page never scrolls, bounces or zooms, including two-finger and
      double-tap.
- [ ] Buttons are comfortable one-thumbed on a 320px-wide phone.
- [ ] Tapping the eagle never accidentally triggers a control.
- [ ] `II` is not hit by accident while reaching for `DROP`.

**Audio**
- [ ] Music starts only after the first tap (browsers require a gesture).
- [ ] Music and SFX toggles take effect immediately and persist.
- [ ] Nothing clips or distorts when many events fire at once.

**Lifecycle**
- [ ] Backgrounding the tab pauses rather than quietly running on.
- [ ] Rotating the device relays out cleanly.
- [ ] Installing to the home screen gives a fullscreen portrait app with the
      right icon.
- [ ] Aeroplane mode: the installed game still launches and plays.

---

## Known limitations

- **Difficulty is tuned against a bot, not against people.** A scripted player
  that never misplaces reaches wave 15-19 at casual input speed and wave 28+ at
  expert speed. Humans will sit lower, but the numbers in `config.js` should be
  re-checked against real playtesting.
- **Not tested on physical hardware.** All browser verification was headless
  Chromium at several viewport sizes. Real iOS Safari, real touch latency and
  real audio behaviour are unverified.
- **The paywall takes no money.** See above. It is a boundary, not a product.
- **Not linked from the site homepage.** The game stands alone at `/maga-wall/`.
- **No landscape layout.** Portrait only, by design; landscape letterboxes.
