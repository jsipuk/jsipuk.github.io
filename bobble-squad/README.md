# Bobble Squad

A block-built town adventure for a five-year-old, at
[jsip.uk/bobble-squad](https://jsip.uk/bobble-squad/).

You are the newest member of the Bobble Squad, the junior explorers who look
after Bumbleblock Bay. Somebody has been causing perfectly harmless trouble
around town — googly-eyed robots loose in the square, the playground slide
gone missing, the bubble fountain refusing to bubble — and it is your job to
go and find out why.

Nobody gets hurt, nothing can be failed, and falling off something just puts
you back on the ground with an apologetic *boing*.

## The three missions

| # | Mission | What it teaches |
| --- | --- | --- |
| 1 | **Wake the Fizzbots** — three giggling robot cubes are hiding in Bobbin Square. Wake them all up and they follow you home to the secret hatch under the café. | Walking, looking around, pressing things. Reward: the Clue Sniffer. |
| 2 | **The Missing Slide** — the playground has two empty footings where the slide used to be. Sniff around the big rock in the park and something opens. | Using a gadget to find what you cannot see. Reward: the Bounce Boots. |
| 3 | **The Bubble Cog** — the fountain has stopped. The missing part is in a crate on a half-built tower, on the far side of a gap. | Everything at once: drive there, bridge the gap, get up, sniff, carry it home. Reward: the Magnet Mitt, and a party. |

When all three are done the objective quietly becomes "go and find the eleven
Bobble Badges", pointing at whichever one is nearest, so there is always
somewhere to go next.

## What is in the town

One neighbourhood, built to be dense rather than large. Bobbin Square with
the bubble fountain, the Wonky Waffle café with the Bobble Burrow (HQ) hidden
underneath it, a walk-in hat and boot shop, Giggle Park with trampolines, a
musical staircase, a climbing frame and a lift up to a lookout deck, Sherbet
Street and its mooing doorbells, the harbour with a jetty and paddling depth
water, Buggy Bay with the Puttabout, and the Build Yard with the tower.
Underneath: a secret tunnel from HQ to a vault under the park.

## The map

🗺 in the top corner opens a map of the whole town, drawn from the same
`surfaceAt()` that builds the ground, so it can never disagree with the world.
It shows where you are (an arrow pointing the way you face), where you are
going, the buildings, the buggy, and the badges you have **already** found.
The ones still hidden stay hidden — a map that gives away the secrets would
take the game away with them. The game pauses while it is open.

## Talking to a Bobble

Everyone in town does something when you press ⭐ at them. They turn to face
you and wave, a picture bubble pops over their head, and then:

- **Captain Pom (🧢)** points at your current job and lights up the marker.
  He is the way out of being lost.
- **The shopkeeper** changes your bobble hat colour, free, forever, for fun.
- **Townsfolk** joke, hop about, or point at a badge if there is one nearby —
  which makes every Bobble in the town an optional hint you never have to take.
- **Grumbo** does an apologetic little dance.

## Notes on how it behaves

A few decisions that are easy to undo by accident:

- **You automatically step up anything one block high.** Kerbs, stairs, the
  deck steps and blocks you placed yourself never need a jump. `STEP_UP` is
  1.05 for exactly this reason — drop it below 1.0 and half the town becomes
  unclimbable for a small child.
- **Jumping is buffered.** Pressing jump up to a quarter of a second before
  landing still jumps, and there is coyote time after walking off an edge.
  Without this, a five-year-old's jumps silently vanish.
- **The camera swings itself round behind you** if nobody has dragged it for
  a moment and you are moving. Children otherwise walk towards the camera and
  get hopelessly lost.
- **The Bounce Boots do not bounce you on landing**, only when you press jump.
  An earlier version bounced constantly and it was impossible to stand still
  long enough to press anything.
- **Built blocks land flush with the ground you are standing on**, so walking
  out over the gap placing blocks makes a level bridge with no steps in it.
  If that space is full, the block rides up until it finds room, which is
  what makes stacking work.
- **Falling is never a punishment.** Below y = −26 you are put back at the
  last safe patch of ground you stood on, with a puff and a cheerful noise.
- **Building only works on the marked coloured squares.** The build button
  hides itself everywhere else, so the town cannot be scribbled over.
- **Anything a child can use has a silhouette that says so.** The trampolines
  stand on legs with a bright frame and chevrons; the musical staircase has
  white key tops in a dark surround and an arch over it. Both were flat mats
  on the grass at first and read as carpet.
- **Four things are tall enough to see over the rooftops** — the bobble-hat
  pole on the café, the harbour lighthouse, the park balloon and the crane.
  They are the difference between "I am lost" and "the lighthouse is that way".

## How it works offline

There are no textures, no models and no audio files. Every block is generated
in code, and every sound is synthesised by the Web Audio API at the moment it
plays. The only binary assets in the whole game are two woff2 fonts and three
icons, all local.

`sw.js` precaches the lot on first load and serves cache-first afterwards, so
it runs with the wi-fi off and installs to an iPad home screen through
`manifest.webmanifest`. It also opens straight off the filesystem by
double-clicking `index.html` — the scripts are plain `<script>` tags rather
than modules precisely so that `file://` works.

Progress lives in `localStorage` under `bobblesquad:v1`: badges found,
gadgets unlocked, which mission step you are on, and the hat colour you
picked. Nothing is sent anywhere. Clearing it loses nothing but progress, and
"Start again" in the pause menu clears only that one key.

## The Test Kit

There is a monitored mode built into the game for real-device testing. Press
and hold the ⏸ button for 2.5 seconds and answer the sum. It carries the
54-check plan from `TEST-PLAN-IPAD.md` so results can be ticked off on the iPad
itself, and while it is armed it records frame rate, stutters, errors, falls,
times the player stood still for 45 seconds, times ⭐ was pressed with nothing
to press, buttons that got hammered, and how long each objective took.

Marking a check as failed — or pressing the 🐞 button while playing — grabs a
screenshot of the 3D view, the exact on-screen position of every HUD control,
and the last forty things that happened. **Report → Save report** writes it all
out as one self-contained HTML file.

Everything stays on the device. `test/run.js` asserts that `probe.js` contains
no `fetch`, `XMLHttpRequest`, `sendBeacon` or `WebSocket`, and that its check
list is identical to the one in `TEST-PLAN-IPAD.md`.

## Structure

```
index.html      shell markup and the HUD
style.css       the interface: fat brick buttons, safe areas, responsive sizes
engine.js       tiny WebGL1 renderer — box batching, chunks, frustum culling
world.js        Bumbleblock Bay, authored by hand as coloured boxes
input.js        touch joystick, camera drag, buttons, keyboard and mouse
audio.js        every sound, generated by Web Audio; no files
missions.js     the three missions as lists of steps
game.js         physics, player, camera, actors, buggy, building, gadgets, loop
probe.js        the Test Kit: monitored mode, checklist and report
sw.js           precache + cache-first service worker
```

Planning documents live alongside the code: `PHASE2-PLAN.md` (the educational
layer, designed but not built), `PROJECT_NOTES.md` (decision log) and
`TEST-PLAN-IPAD.md` (the real-device pass).

The renderer's one trick is that static town geometry is baked once into 36
buffers bucketed on a 24-unit grid (about 54,000 vertices in total) and
frustum-culled per bucket, while everything that moves is re-baked into a
single dynamic buffer each frame. A busy scene is roughly 15–20 draw calls.

## Performance notes

Device pixel ratio is capped at 2, and at 1.5 above about 4.6 megapixels, so a
large high-density screen does not quietly quadruple the fill cost. There are
no textures, no post-processing, no shadow maps (shadows are flat blended
quads) and no dynamic lights — face brightness is baked into the vertex
colours at build time, so the fragment shader does nothing but a fog mix.

## Testing

`test/run.js` checks the parts that can be checked without a browser: that the
world builds, that every mission target and interactable referenced by
`missions.js` actually exists in `world.js`, that the badges are reachable
heights, and that the service worker's asset list matches the files on disk.

```
node test/run.js                                  # no browser needed
npx http-server . -p 8099 -c-1 & node test/browser.js   # needs Playwright
```

`test/browser.js` exists because three visible bugs reached a phone while
`test/run.js` was fully green — all three were geometry, which a node test
cannot see. It runs the layout, the pause menu and the whole "Start again"
flow at two phone sizes and three tablet sizes.

The gameplay itself was tested by driving a real browser: all three missions
from beginning to end using only touch input, offline with networking
disabled, and from `file://`.
