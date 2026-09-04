# Build The MAGA Wall

An 8-bit arcade parody for phones. Falling blocks build a defensive wall; zombies
chew through it from the left; an exaggerated pixel rally cheers from the right;
a bald eagle occasionally carries one of the zombies away.

A standalone site: Cloudflare Pages serves `public/`, Cloudflare Pages Functions
in `functions/api/` handle the $4.99 unlock through Stripe. No build step, no
dependencies, no framework. See [DEPLOY.md](DEPLOY.md) to put it online.

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
npm run dev          # game only; the paywall reports payments unconfigured
npm run dev:pay      # adds a fake Stripe, so the whole purchase flow works
```

Then open <http://127.0.0.1:8100/>. On a development machine the game uses a
free local unlock; append `?pay=live` to exercise the real payment path instead.

`wrangler pages dev public` runs the genuine Cloudflare stack and is what to use
before shipping. `test/serve.js` exists so the flow is testable offline and in CI.

### Tests

```
npm test             # 175 checks, no browser needed
```

`test/run.js` (131) covers the deterministic game logic: piece geometry and
rotation kicks at every column, grid boundaries, wall settling, sealing
(including the exploit where zombie attrition used to pay the player), overbuild
recovery, the zombie queue, climbing, breaches, the eagle state machine,
scoring, run isolation, licence-token forgery, and whether the service worker
still lists every source file.

`test/api.js` (44) drives the payment endpoints as real HTTP against a fake
Stripe and a fake KV: checkout creation, the claim exchange and its idempotency,
licence validation and revocation, restore, webhook signature verification,
replay and tampering.

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
kind of project. A framework would add a toolchain and megabytes to
a game whose entire renderer is `fillRect`.

Everything is drawn into a fixed **208 x ~370 pixel buffer** and blitted up with
smoothing off. Because the buffer is tiny, every rectangle lands on a whole
pixel, so the result is real pixel art rather than a smooth drawing made blocky
afterwards. 208 = 13 cells of 16px: 3 of zombie approach, 7 of wall, 3 of rally.

```
public/                 the site, served as-is
  index.html style.css sw.js manifest.webmanifest icons/
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
    entitlement.js  the client half of the paywall
    prompt.js       the one DOM dialog, for typing a licence key
    ui.js           every screen that is not the game
    main.js         boot, screen manager, frame loop. Knows about all the rest.

functions/              Cloudflare Pages Functions, mounted at /api/*
  _lib.js           licence keys, HMAC tokens, Stripe REST, the KV store
  api/config.js     what the paywall should say
  api/checkout.js   start a Stripe Checkout session
  api/claim.js      exchange a finished session for a licence
  api/licence.js    is this token still valid?
  api/restore.js    unlock another device from the key
  api/webhook.js    Stripe's own word that the payment completed

test/
  run.js            game logic and licence crypto
  api.js            the payment endpoints, as real HTTP
  serve.js          local dev server; mounts functions/ like Pages does
```

The dependency direction is strict: `sim.js` imports only `config`, `rng` and
`pieces`. It emits events onto `g.events`; `render.js` turns those into
particles and `audio.js` turns them into noises, and neither can write back.
That is what lets `test/run.js` play thousands of simulated seconds under node
with no browser.

Balancing lives entirely in `config.js`. `hordeDps(wave, tierHp)` states the
curve the tuning is aimed at, and the test suite asserts it stays monotonic.

---

## The paywall

Three free rounds, then a one-off $4.99 unlock through Stripe Checkout.

```
UNLOCK -> /api/checkout -> Stripe -> back to /?purchase=cs_...
       -> /api/claim    -> licence key + HMAC token, stored locally
every online boot:
       -> /api/licence  -> still valid? if not, the game locks itself again
another device:
       -> /api/restore  -> the licence key exchanges for a fresh token
```

The token is an HMAC minted at the edge. The browser never sees the signing key,
so it cannot forge one, and the test suite proves a swapped payload with a stolen
signature is rejected.

**Offline, the game trusts its cached token.** It has to — a PWA that locks you
out on a train is a worse product than one that can be cheated by somebody
willing to edit `localStorage`. Any client-side game can be unlocked by a
determined person. This design makes casual copying pointless and keeps the edge
authoritative whenever it can be reached, which is the right trade at this price.

Two things worth knowing:

- Dev mode is decided by **hostname only**, never by the query string. An earlier
  version honoured `?dev=1` anywhere, which meant anyone could append it to the
  live site and take the free local unlock.
- Purchase state lives under its own storage key (`magawall.entitlement.v1`),
  separate from scores and settings, so payment logic cannot corrupt save data.
  There is a test for it.

Everything needing your credentials, plus tax and consumer-law obligations, is
in [DEPLOY.md](DEPLOY.md).

## PWA

`manifest.webmanifest` (portrait, fullscreen, 192/512/maskable icons) plus a
cache-first service worker holding the whole shell, so the game runs offline
after one visit. The worker never caches `/api/*` — a stale licence check, or an
`index.html` served in place of a failed API call, would be worse than no worker
at all.

**Bump `VERSION` in `public/sw.js` whenever a shell file changes**, or returning
players keep the old build. This is the easiest thing here to forget.

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

**Buying it** (test mode, see DEPLOY.md)
- [ ] The paywall shows the real price, not a placeholder.
- [ ] Checkout opens, and cancelling returns you to the game still locked.
- [ ] Paying returns you to WALL UNLOCKED with a licence key.
- [ ] The key is also on the Settings screen afterwards.
- [ ] COPY KEY works, or fails gracefully with the key still readable.
- [ ] Restoring on a second device works with the key typed messily.

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
- **The payment path has never seen a real card.** It is verified end to end
  against a fake Stripe — purchase, claim, restore, revoke, webhook signatures —
  but Stripe's own hosted Checkout page is not in that loop. Run the test-mode
  checklist in DEPLOY.md before trusting it.
- **The licence key is not emailed.** It is shown after purchase and on the
  Settings screen. A buyer who clears their browser data and did not keep it
  needs you to look it up in KV. Wiring the webhook to a mail provider is the
  obvious next job.
- **No account system, so a key can be shared.** Deliberate: accounts cost more
  in support than they save in piracy at this price.
- **Nothing legal is implemented.** No terms, no privacy notice, no refund
  policy, no tax registration. All required before taking real money.
- **No landscape layout.** Portrait only, by design; landscape letterboxes.
