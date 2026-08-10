# Bobble Squad — Phase 2 Educational Enhancement Plan

**Status: design and planning only. No gameplay code has been written for this phase.**

---

## 1. Executive recommendation

Bobble Squad already teaches. A child who plays it counts three Fizzbots, judges
whether a gap is jumpable, works out that a hidden thing needs the Sniffer, and
builds a bridge one block at a time. None of that is labelled as learning, and
that is exactly why it works.

Phase 2 should therefore **not add an educational system**. It should add
**machines to the town that only work when you get the thinking right** — and
route every learning objective through those machines.

The recommendation in one sentence:

> Build a small, data-driven *challenge* layer that attaches learning goals to
> physical objects in Bumbleblock Bay, solved with the movement, building and
> gadget controls the child already knows, with no modal screens, no scores, no
> quiz UI and no new buttons.

Three learning domains for the first release — **early numeracy, spatial
reasoning, and logic/reasoning** — with **early phonics as a fourth, fenced
off** behind a separate decision because it is the only one that needs recorded
speech and therefore materially changes the package.

The MVP proves one thing: that a child who meets an educational machine keeps
exploring afterwards. If they stop exploring, the layer has failed regardless of
how good the pedagogy is.

**The single most important constraint discovered during inspection:** the town's
static geometry is baked to the GPU once at startup and the source vertex data is
discarded. Every educational prop must therefore be a *mover*, a *placed block*,
or a new dynamic-batch draw. This is a real architectural boundary and it shapes
the whole plan. Details in §2 and §17.

---

## 2. Verified Phase 1 architecture

Everything in this section was read from the files in `bobble-squad/` on this
branch. Nothing here is inferred.

### 2.1 Stack and structure — CONFIRMED

No framework, no build step, no package manager, no bundler. Plain
`<script>` tags in dependency order, each file an IIFE hanging one global off
`window`.

| File | Lines | Global | Responsibility |
| --- | ---: | --- | --- |
| `engine.js` | 441 | `BSEngine` | WebGL1 renderer, `M4` maths, `Builder` box batcher |
| `audio.js` | 155 | `BSAudio` | Web Audio synthesis; no files |
| `input.js` | 221 | `BSInput` | Touch joystick, camera drag, buttons, keyboard/mouse |
| `world.js` | 749 | `BSWorld` | Bumbleblock Bay as data + geometry |
| `missions.js` | 395 | `BSMissions` | Three missions as step lists |
| `game.js` | 1672 | `BS` | Physics, player, camera, actors, buggy, building, gadgets, HUD, loop |
| `style.css` | 556 | — | HUD, safe areas, responsive rules |
| `index.html` | 146 | — | Canvas, HUD markup, overlays |
| `sw.js` | 74 | — | Precache + cache-first service worker |
| `test/run.js` | 149 | — | 69 headless checks (`node test/run.js`) |

Total package: **264 KB**, of which 38 KB is two woff2 fonts and 3.4 KB is icons.
Everything else is source. **There are no textures, no models and no audio files.**

Run: open `index.html` directly (`file://` works — this is why plain scripts are
used rather than ES modules), or serve the folder. Test: `node test/run.js`.

### 2.2 Rendering — CONFIRMED

- Static town: baked at init into **36 vertex buffers** bucketed on a 24-unit
  grid, ~54,000 vertices, frustum-culled per bucket.
- **`game.js:436` sets `bk.builder = null` immediately after upload, and
  `Renderer.clearChunks` does not exist.** Static geometry is therefore
  **immutable after startup**. This is the key constraint for Phase 2.
- Everything that moves is re-baked CPU-side into **one** dynamic buffer per
  frame, plus one blended buffer.
- Measured in Chromium/SwiftShader at 1180×820: **20 `drawArrays` calls per
  frame**, stable.
- Per-frame dynamic draw lists are hard-coded in `render()`:
  `world.decoAnim` (clouds) → `world.movers` → `BS.blocks` → `world.badges` →
  fizzbots → npcs → waddlers → buggy → player → particles. **There is no
  general-purpose "prop" list.** Adding one is a small, contained change.

### 2.3 World data — CONFIRMED

`BSWorld.build()` returns one object. Live counts:

| Collection | Count | Mutable at runtime? |
| --- | ---: | --- |
| `solids` | 1,285 | Hashed once into a spatial grid at init — **no** |
| `interactables` | 18 | **Yes** — rescanned every frame by `currentTarget()` |
| `triggers` | 11 | **Yes** — rescanned every frame by `checkTriggers()` |
| `movers` | 16 | Rendered every frame, but `solidRef` is only wired at init — **needs a helper** |
| `badges` | 11 | Yes |
| `buildZones` | 2 | Yes |
| `places` | ~14 named anchors | Yes |
| `water`, `decoAnim` | — | Yes |

Interactable shape: `{ id, kind, x, y, z, r, icon, label, locked?, hidden?,
revealed?, done?, data? }`. Handled kinds: `honk`, `fountain`, `tube`, `lift`,
`panel`, `crate`, `bench`. Trigger kinds: `bounce`, `note`.

### 2.4 Event bus — CONFIRMED

`BS.on(name, fn)` / `BS.emit(name, data)` already exists and `missions.js`
already subscribes to all of it. Events emitted today: `fizzbot`, `npc`,
`fountain`, `tube`, `panel`, `crate`, `bench`, `enterVehicle`, `exitVehicle`,
`placeBlock`, `buildMode`, `scan`, `bounce`, `note`, `badge`.

**Phase 2 needs no new bus.** This is the single largest piece of good luck in
the codebase.

### 2.5 Missions — CONFIRMED

A mission is `{ id, icon, title, steps: [...] }`. A step is:

```js
{ icon, text, target(), check(event), enter?, exit?, poll?, total?, done? }
```

`BSMissions.update(dt)` polls `check(null)` every frame and also feeds it every
queued event. `BSMissions.current()` returns `{ icon, text, target, done, total }`
which drives the HUD card, the 3D marker and the off-screen chevron. Progress
saves as `{ m, s }` and `applyProgress()` replays world side effects on load.

**A step can already be anything that can answer "am I done?".** An educational
challenge is a legitimate step with no changes to the mission engine.

### 2.6 Building — CONFIRMED

Three block types (`block`, `bouncy`, `plank`). Ghost lands **flush** with the
ground the player stands on (`Math.round(player.y) - 1`), riding up if occupied.
Placement only allowed inside a `buildZone` AABB; the 🧱 button hides itself
elsewhere. Placed blocks push into `dynSolids` so they are genuinely walkable.
**Placed blocks are not saved.**

### 2.7 Gadgets — CONFIRMED

- **Clue Sniffer** — reveals `hidden` interactables within **16 units**, pings
  unfound badges within **22 units**, lasts **14 seconds**, drives a four-pip
  hot/cold meter, emits `scan`.
- **Bounce Boots** — toggle; jump velocity 10.2 → 18.4.
- **Magnet Mitt** — activates the nearest `crate`/`panel`/`lift`/`honk` within
  20 units.

The Sniffer is *already* a "find things matching a rule" gadget. It is the most
under-used system in the game and the best educational vehicle available.

### 2.8 Save — CONFIRMED

One JSON blob at `localStorage['bobblesquad:v1']`:
`{ badges: [], gadgets: {}, mission: {m,s}, colour, sound }`. No account, no
network, no telemetry, no identifiers.

### 2.9 Audio — CONFIRMED

`BSAudio.play(name, arg)` over a fixed table of ~23 synthesised effects, plus an
8-note pentatonic scale so any accidental combination stays consonant. Mute in
the pause menu. **No recorded audio exists anywhere in the project.**

### 2.10 Input and HUD — CONFIRMED

Joystick anywhere in the bottom-left; camera drag anywhere else; DOM buttons for
jump / action / build / three gadgets / pause; a build bar inside the action
stack. Smallest touch target measured 54 px, most 60–104 px. Verified at
1366×1024, 1180×820, 1024×768, 844×390 and portrait 820×1180 with no overlaps.

### 2.11 Offline — CONFIRMED

`sw.js` precaches 15 files. Verified: reload with networking disabled boots and
plays; `file://` load makes **zero** network requests of any kind.

---

## 3. Assumptions and unknowns

### ASSUMED (reasonable, revisit if wrong)

- The target child plays in sessions of roughly 10–25 minutes, often with an
  adult nearby but not supervising every moment.
- The same child replays the town many times; content must survive repetition.
- Ages 5–7 spans pre-numeral (counts objects, does not read "7") to early
  numeral fluency. Every numeric challenge must therefore work with **dots
  first, numerals as an optional overlay**.
- A 5-year-old will not read the mission card. They read the *icon* and follow
  the arrow. Current mission text is 2–4 words and is best treated as
  decoration for the child and a label for the adult.
- Free exploration between missions is where most play time goes, so educational
  content anchored only inside missions will be under-encountered.

### UNKNOWN (must be tested, do not design around)

- **Real iPad/Safari behaviour.** Phase 1 was never run on iOS hardware. Frame
  rate, touch feel and safe areas are unverified on device.
- **Whether children notice world-anchored challenges at all** without a
  waypoint pointing at them. This is the central risk and the subject of the
  recommended next experiment.
- **Whether `speechSynthesis` is usable offline on iPadOS**, whether a suitable
  child-appropriate voice exists, and whether it requires a fresh user gesture
  each utterance. Do not build phonics on this until measured.
- Attention span for a single challenge before the child wanders off.
- Whether the adult gate (§14) is genuinely child-resistant for a 7-year-old.
- Whether counting objects in a 3D perspective view is materially harder than
  counting them flat. Suspected yes at oblique angles; needs observation.

---

## 4. Recommended learning domains

Scored against the brief's eight criteria. 5 = excellent.

| Domain | Fit | Value | Fun | Age | Touch | Reuse | Feasible | Total | Call |
| --- | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | --- |
| **Early numeracy** | 5 | 5 | 4 | 5 | 5 | 5 | 5 | **34** | MUST |
| **Spatial reasoning** | 5 | 4 | 5 | 5 | 5 | 5 | 4 | **33** | MUST |
| **Logic & reasoning** | 5 | 5 | 5 | 4 | 5 | 4 | 4 | **32** | MUST |
| Early phonics | 3 | 5 | 3 | 4 | 4 | 4 | 2 | 25 | SHOULD (fenced) |
| Science / world knowledge | 3 | 3 | 3 | 4 | 4 | 3 | 3 | 23 | LATER |
| Memory & attention | 3 | 2 | 3 | 4 | 4 | 4 | 4 | 24 | Emergent, not tracked |
| Social & emotional | 2 | 4 | 2 | 3 | 2 | 2 | 2 | 17 | LATER |
| Creativity | 4 | 4 | 5 | 5 | 5 | 4 | 4 | 31 | Design value, not a tracked domain |

### The three launch domains

**Early numeracy** — counting to 10, subitising 1–5, one-to-one correspondence,
"how many more?", comparison (more / fewer / same), simple addition and
subtraction within 10, ordering by size. Every one of these is *already* the
building system with a target number attached.

**Spatial reasoning** — 2D and 3D shape naming, orientation and rotation,
part-and-whole, position language (on / under / behind / next to), route and
direction, length and distance estimation. The game is a 3D box world with a
grid-snapped placement system; this domain costs almost nothing to serve.

**Logic and reasoning** — sequencing, repeating and growing patterns, sorting
and classification, odd-one-out, attribute elimination ("it isn't the tall one,
it isn't the red one"), simple cause-and-effect prediction. This is the *native*
skill of the secret-agent mystery genre the game already uses.

### Why creativity is a value, not a domain

Creativity cannot be honestly measured by success criteria, and attaching a
progress state to it would push the design toward grading a child's building.
It stays as a first-class design requirement (the open-ended mission in §8,
mission 11) with **no skill tracking whatsoever**.

### Why memory is emergent

The Sequence Machine exercises working memory hard. Tracking it as a separate
domain would tempt us into memory drills. It is left as a by-product.

---

## 5. Domains deferred, and why

| Deferred | Reason |
| --- | --- |
| **Reading, sight words, spelling** | Directly contradicts the "minimal reading" constraint. Any word-reading challenge excludes the younger half of the audience from their own game. |
| **Phonics beyond initial sounds** | Blending and segmenting need reliable recorded speech and careful sequencing. Initial-sound matching is the only slice that survives an icon-first design. |
| **Time, money, calendar** | Culturally specific, numeral-heavy, no natural home in the town without inventing a shop economy — which drags monetisation-shaped mechanics into a game that deliberately has none. |
| **Formal measurement (cm, kg)** | Units require numerals and reading. Comparison ("taller / heavier") is already covered inside spatial and numeracy. |
| **Science and world knowledge** | Real appeal (the harbour, the animals, the weather), but it is *content* rather than a mechanic, and content does not reuse. Revisit once the mechanic families are proven. |
| **Social and emotional learning** | Very easy to become preachy, very hard to do without dialogue, and dialogue means reading. The town's kindness should stay in its *behaviour* (nobody is ever hurt, the villain apologises) rather than in taught lessons. |
| **Multi-step written arithmetic** | Above age band and inherently worksheet-shaped. |

---

## 6. The educational gameplay loop

Phase 1's loop is preserved exactly. The educational layer inserts **one extra
beat** and never interrupts:

```
EXPLORE
  └─ NOTICE  a machine that is obviously broken / hungry / waiting
       └─ EXPERIMENT  press it, drop something in, step on it
            └─ THE MACHINE ANSWERS BACK  immediately, visibly, without judgement
                 └─ APPLY  the child works out what it actually wants
                      └─ THE WORLD CHANGES  it runs, opens, sings, launches you
                           └─ EXPLORE  (now with somewhere new to go)
```

Four rules that keep it a game:

1. **Never modal.** No challenge ever takes over the screen. The child can walk
   away mid-challenge and come back; state persists on the object, not in a UI.
2. **Wrong is a physical event, not a verdict.** A block that does not belong
   pops back out with a soft *boing* and a shrug. There is no "incorrect".
3. **The machine always does *something*.** Even a wrong attempt produces motion,
   noise and light, because "what happens if I try this?" must always be
   rewarded.
4. **The reward is the world.** Never a star, a point or a tick.

---

## 7. Reusable educational mechanics

Five families. The design test for each: *can one mechanic serve at least three
different learning objectives just by changing data?*

---

### M1 — The Quantity Socket

> A machine with visible empty slots. Fill them correctly and it runs.

| | |
| --- | --- |
| **Reuses** | Building system (`placeBlock` event, `BS.blocks`, `buildZones`), movers for the machine body, `BS.emit` |
| **Skills** | Counting to 10 · subitising · one-to-one correspondence · "how many more?" · addition and subtraction within 10 · comparison (more/fewer/same) · repeating patterns · height and length measurement |
| **Child does** | Walks to the machine, opens the build bar, places blocks into glowing sockets. Sockets fill with a *clunk*. Wrong-coloured blocks pop back out. |
| **Difficulty variables** | Target count (1–10) · starting count (0 = pure counting, >0 = "how many more") · target shown as dots / dots+numeral / numeral · sockets pre-marked or unmarked · one block type or a colour pattern to continue · exact-equal vs more-than |
| **Replay variation** | Target number, machine skin, block colour, socket layout (row / stack / ring), and whether the machine wants *the same again* or *one more than last time* |
| **Complexity** | **Medium.** Needs a socket prop, runtime mover creation, and a check on the existing `placeBlock` event. No new input, no new UI. |

**Why this one first:** it converts the most enjoyable existing system into the
most valuable learning domain with no new controls at all.

---

### M2 — The Sniffer Sort

> A rule card appears. Scan, then go and press the things that match.

| | |
| --- | --- |
| **Reuses** | Clue Sniffer wholesale — reveal radius, hot/cold pip meter, `scan` event, `hidden`/`revealed` flags, the action button, world markers |
| **Skills** | Classification and sorting · odd-one-out · attribute elimination · shape recognition · colour and size sorting · vocabulary · initial sounds (phonics tier) |
| **Child does** | Presses 🔎. Candidate objects glow. Walks to each and presses ⭐ to claim it. Non-matching objects give a friendly wobble and stay put. |
| **Difficulty variables** | Number of targets (1–4) · number of distractors (0–6) · rule concreteness (colour → shape → category → "not X") · scan radius · whether the rule card stays on screen |
| **Replay variation** | Rule attribute, which objects are seeded, which district, and single-rule vs two-rule ("round **and** blue") |
| **Complexity** | **Low.** Almost entirely existing code. The only new pieces are a rule card and a per-challenge candidate list. |

**Why this one:** cheapest possible mechanic, and it turns the least-used gadget
into the most-used one.

---

### M3 — The Sequence Machine

> The machine plays a pattern. Do it back.

| | |
| --- | --- |
| **Reuses** | The eight musical step pads and their `note` trigger, `tr.lit` highlighting, the pentatonic scale, movers for lights |
| **Skills** | Sequencing and ordinal position · repeating patterns (AB, ABB, AABB) · growing patterns · working memory · following multi-step instructions · left-to-right directionality |
| **Child does** | Watches the pads light and sing in order, then walks across them in the same order. Pads stay lit as they go. |
| **Difficulty variables** | Sequence length (2–5) · demo repeats (always / on request / once) · pads stay lit or fade · pattern type (copy / continue / reverse) · number of decoy pads |
| **Replay variation** | New sequence every time, different pad set, different instrument colour, and "continue the pattern" instead of "copy it" |
| **Complexity** | **Low–Medium.** The pads, triggers, lighting and audio all exist. New: a demo player and a comparison buffer. |

**Note:** must not require memorising more than four items, and the demo must be
re-playable on demand forever. Never a timed memory test.

---

### M4 — The Shape Fitter

> Something has a hole in it. Find the piece that fits and put it back.

| | |
| --- | --- |
| **Reuses** | Build ghost and grid snapping, the build bar as a **piece palette**, movers for holes and pieces |
| **Skills** | 2D and 3D shape recognition · orientation and rotation · part-and-whole · symmetry · spatial matching · position language |
| **Child does** | Sees a wall/roof/bridge with a gap and a silhouette. Picks a piece from the palette (three big swatches, exactly the existing control) and places it. Wrong pieces do not stick. |
| **Difficulty variables** | Number of candidate pieces (2–4) · silhouette shown or not · rotation required · gap in an obvious place vs found by looking · one gap or three |
| **Replay variation** | Different building, different missing piece, different distractor set |
| **Complexity** | **Medium.** Reuses the build bar as a palette, which avoids inventing a carry-and-drop mechanic — the single biggest touch risk avoided. |

---

### M5 — The Route Plotter

> Tell the little robot how to get there, then watch it try.

| | |
| --- | --- |
| **Reuses** | Fizzbot actors and their follow behaviour, the buggy, waypoint markers and the off-screen chevron, roads |
| **Skills** | Sequencing · directional and position language · spatial mapping · route planning · estimating distance · debugging (early computational thinking) |
| **Child does** | Two forms. **(a) Delivery run:** drive the buggy to three stops in the order shown by pictures. **(b) Fizzbot programmer:** tap 3–5 big arrow tiles, press GO, watch the Fizzbot walk it and bump comically into things, then fix the wrong arrow. |
| **Difficulty variables** | Number of stops or steps · whether order matters · route shown or hidden · obstacles present · turns as well as straights |
| **Replay variation** | New stops, new start point, new obstacles, and "get there in fewer steps" |
| **Complexity** | **(a) Low.** Waypoints and vehicle exist. **(b) Medium–High** and the riskiest new mechanic in the plan — it introduces a real UI panel, which every other mechanic avoids. |

**Decision: ship (a) first.** (b) is deferred to a later stage and must earn its
place with a playtest, because a program-the-robot panel is the one idea here
that could genuinely make the game feel like an app instead of a world.

---

### Note on a sixth family

A **Balance Rig** (a see-saw bridge that only levels when both sides match) looks
like a new mechanic but is **M1 with a different success criterion** —
`countA === countB` instead of `count === target`. That is the reuse test
working: it ships as a Quantity Socket variant, not as new code.

---

## 8. Learning skill map

Skill IDs are stable strings; this table is the contract between `learn.js` and
the challenge data.

| Skill ID | Domain | Description | Mechanics |
| --- | --- | --- | --- |
| `count.to5` | Numeracy | Count and produce sets up to 5 | M1 |
| `count.to10` | Numeracy | Count and produce sets up to 10 | M1 |
| `count.subitise` | Numeracy | Recognise 1–5 without counting | M1, M2 |
| `num.howManyMore` | Numeracy | Complete a set from a partial start | M1 |
| `num.addWithin10` | Numeracy | Combine two groups | M1 |
| `num.takeAway` | Numeracy | Remove to reach a target | M1 |
| `num.compare` | Numeracy | More / fewer / same | M1 (balance) |
| `num.order` | Numeracy | Order 3–4 items by size or count | M1, M2 |
| `space.shape2d` | Spatial | Recognise square, circle, triangle, rectangle | M4, M2 |
| `space.shape3d` | Spatial | Recognise cube, slab, ramp | M4 |
| `space.orientation` | Spatial | Rotate a piece to fit | M4 |
| `space.partWhole` | Spatial | See a missing part of a whole | M4 |
| `space.position` | Spatial | On / under / behind / next to | M2, M5 |
| `space.route` | Spatial | Plan and follow a path | M5 |
| `space.length` | Spatial | Compare and estimate distance | M1, M5 |
| `logic.sequence` | Logic | Reproduce an order | M3, M5 |
| `logic.patternCopy` | Logic | Copy a repeating pattern | M3, M1 |
| `logic.patternExtend` | Logic | Continue a pattern | M3, M1 |
| `logic.sort` | Logic | Group by one attribute | M2 |
| `logic.oddOneOut` | Logic | Find the non-member | M2 |
| `logic.eliminate` | Logic | Narrow by successive clues | M2 |
| `logic.causeEffect` | Logic | Predict what a machine will do | M1, M3, M5 |
| `phon.initialSound` | Phonics *(fenced)* | Match first sounds | M2 |
| `vocab.name` | Phonics *(fenced)* | Name town objects | M2 |

**24 skills, 5 mechanics.** That ratio is the point of the whole design.

---

## 9. Ten-plus educational mission concepts

Format is compressed; every mission includes all the required fields.

---

### 1. The Fountain's Hungry Cogs — numeracy

- **Skill:** `num.howManyMore`, `count.to5`
- **Objective:** the Bubble Fountain splutters and stops. Get it going again.
- **Educational interaction:** the pump has 5 sockets; 3 already hold cogs. The
  child places 2 more blocks. Each socket clunks and lights as it fills.
- **Reuses:** M1 · building system · the existing `fountain` interactable
- **Gadget/vehicle/build:** build only
- **Instruction:** the machine shows 5 empty dots, 3 already filled. No words.
- **Hints:** L1 the empty sockets pulse · L2 an arrow points at the block swatch
  · L3 the ghost block appears over the first empty socket · L4 one block places
  itself, leaving one for the child
- **Success:** water erupts, bubbles everywhere, confetti, a Fizzbot does a
  backflip
- **Replay:** the fountain gets blocked again with a different start/target
  (2 of 6, 4 of 7…)
- **Difficulty:** target 3→10 · start count 0 or partial · dots → dots+numeral

---

### 2. The Bun Round — numeracy

- **Skill:** `count.subitise`, `count.to10`, one-to-one correspondence
- **Objective:** deliver buns from the Wonky Waffle to four houses on Sherbet St.
- **Educational interaction:** each doorstep shows a picture of how many buns are
  wanted (dots on a plate). The child places that many blocks in the delivery
  crate at each door.
- **Reuses:** M1 + M5(a) · buggy · doorbell interactables
- **Gadget/vehicle/build:** buggy strongly encouraged, building required
- **Instruction:** a plate icon with dots above each door
- **Hints:** L1 the plate enlarges and the dots pulse one by one · L2 the crate
  outlines the required number of slots · L3 the first block drops itself · L4 a
  Fizzbot delivers one door for you and cheers
- **Success:** the door opens, someone waves, a happy noise, the buggy gets a
  small decoration
- **Replay:** different houses, different counts, sometimes "one more than the
  last house"
- **Difficulty:** 1–3 → 1–10 · number of houses · dots → numerals

---

### 3. The Copycat Bell Tower — logic

- **Skill:** `logic.sequence`, working memory
- **Objective:** a machine in the park has forgotten its tune. Teach it back.
- **Educational interaction:** three (then four) of the musical pads light and
  sing in order; the child walks across them in the same order.
- **Reuses:** M3 · musical step triggers · pentatonic scale
- **Gadget/vehicle/build:** none — pure movement
- **Instruction:** the demo plays itself; a big ▶ marker replays it forever
- **Hints:** L1 demo repeats automatically · L2 pads stay lit after being played
  · L3 the next pad in the sequence glows · L4 the tune shortens by one
- **Success:** the tower plays the full tune, the roof opens, a badge rises out
- **Replay:** new tune each time; later "carry on the pattern" instead of copy
- **Difficulty:** length 2→5 · fade time · decoy pads · copy → continue → reverse

---

### 4. Who Made the Muddy Prints? — logic

- **Skill:** `logic.eliminate`, `logic.sort`
- **Objective:** muddy footprints across Bobbin Square. Find who left them.
- **Educational interaction:** three Fizzbot suspects. The Sniffer surfaces
  clues one at a time as icon cards — *not tall* … *not red* … — and the child
  walks up and presses the one that is left.
- **Reuses:** M2 · Clue Sniffer · fizzbot actors · scan meter
- **Gadget/vehicle/build:** Clue Sniffer required
- **Instruction:** clue cards are pictures with a red diagonal for "not"
- **Hints:** L1 non-matching suspects dim slightly · L2 the ruled-out suspect
  visibly steps back and shrugs · L3 two are ruled out · L4 the culprit hiccups
  and points at itself
- **Success:** the Fizzbot confesses by producing a comedy mop and cleaning up
- **Replay:** new suspects, new attributes, 3 → 4 suspects
- **Difficulty:** suspects 2→4 · clues 1→3 · positive clues → negative ("not")

---

### 5. The Odd Crate Out — logic

- **Skill:** `logic.oddOneOut`, `logic.sort`, `space.shape2d`
- **Objective:** the harbour delivery is wrong; one crate doesn't belong.
- **Educational interaction:** four crates, one differing by a single attribute.
  Sniff, then press the odd one; it floats away on a balloon.
- **Reuses:** M2 · harbour crates already in `world.js`
- **Gadget/vehicle/build:** Clue Sniffer
- **Instruction:** a rule card showing the three that match
- **Hints:** L1 the three matching crates hum in unison · L2 they visibly line up
  together · L3 the odd one wobbles · L4 the odd one lifts slightly
- **Success:** balloon, honk, the crates rearrange into a staircase you can climb
- **Replay:** attribute varies (colour / shape / size / count of stripes)
- **Difficulty:** 3→5 crates · one attribute → two attributes

---

### 6. Mind the Gap — spatial / numeracy

- **Skill:** `space.length`, `count.to10`, estimation
- **Objective:** the Build Yard gap needs a bridge exactly wide enough.
- **Educational interaction:** a sign shows how many planks the gap needs. The
  child estimates first, then builds and counts. Too few and the last plank
  wobbles at the edge; too many and a spare plank comically falls off.
- **Reuses:** M1 · existing gap and build zone from mission 3
- **Gadget/vehicle/build:** building required
- **Instruction:** a picture of a plank with a number of dots
- **Hints:** L1 shimmering ghost planks show the span · L2 they pulse one at a
  time as if counting · L3 the first two place themselves · L4 all but one place
- **Success:** the bridge locks with a satisfying clunk and a rail appears
- **Replay:** the yard reconfigures with different gaps
- **Difficulty:** span 3→8 · shown count → estimate-then-check

---

### 7. The Wonky Roof — spatial

- **Skill:** `space.shape2d`, `space.orientation`, `space.partWhole`
- **Objective:** the Hat & Boot Shop lost a roof piece in the wind.
- **Educational interaction:** a gap with a visible silhouette. Three candidate
  pieces on the build bar. One fits; one is the wrong shape; one is the right
  shape the wrong way round.
- **Reuses:** M4 · build bar as palette · building movers
- **Gadget/vehicle/build:** building required
- **Instruction:** the silhouette in the gap
- **Hints:** L1 silhouette outline pulses · L2 wrong pieces grey slightly · L3
  the correct piece jiggles on the palette · L4 the piece hovers into place and
  waits for a press
- **Success:** roof completes, rain stops dripping inside, shopkeeper waves
- **Replay:** different buildings, different missing pieces
- **Difficulty:** 2→4 candidates · silhouette shown/hidden · rotation needed

---

### 8. Sorting the Harbour — numeracy / logic

- **Skill:** `num.order`, `logic.sort`, `num.compare`
- **Objective:** the harbour master wants the crates stacked properly.
- **Educational interaction:** four crates of different sizes; three marked bays
  labelled with size icons. The child pushes/places each into the right bay,
  smallest to largest.
- **Reuses:** M1 (variant) · crates · movers
- **Gadget/vehicle/build:** Magnet Mitt can pull distant crates — its first real job
- **Instruction:** bays show small / medium / large silhouettes
- **Hints:** L1 the smallest crate hops · L2 its bay glows · L3 an arrow arcs
  from crate to bay · L4 it slides itself in
- **Success:** a crane lifts the stack, a boat sails off, a badge is revealed
- **Replay:** different crate sets; sometimes largest-first
- **Difficulty:** 3→5 items · size-only → size *and* colour

---

### 9. The Post Round — combined domain

- **Skill:** `space.route`, `logic.sequence`, `count.to5` (combined)
- **Objective:** deliver three parcels, in the order shown, before the town clock
  finishes its tune (which is generous and never actually fails you).
- **Educational interaction:** three destination pictures appear in order.
  The child drives to each in turn; arriving out of order gets a friendly "not
  yet" wobble and the parcel stays in the buggy. At each stop, place the number
  of blocks shown on the parcel.
- **Reuses:** M5(a) + M1 · buggy · waypoints · chevron
- **Gadget/vehicle/build:** vehicle and building both required
- **Instruction:** three pictures in a row, current one enlarged
- **Hints:** L1 the chevron points at the current stop · L2 a dotted road line
  appears · L3 the buggy nudges itself in the right direction · L4 the first stop
  auto-completes
- **Success:** the whole town honks; the buggy gains a flag; a rooftop opens
- **Replay:** new stop sets, new order, sometimes "any order"
- **Difficulty:** 2→4 stops · order matters or not · with/without the road line

---

### 10. Sound Sniffer — phonics *(fenced tier)*

- **Skill:** `phon.initialSound`, `vocab.name`
- **Objective:** the Sniffer has caught a sound and wants more of it.
- **Educational interaction:** the gadget speaks a word ("**b**oat") and shows
  its picture. Four town objects glow; the child presses the ones starting with
  the same sound. Every object is a real thing already in the town — boat, ball,
  badge, bell, bench, bucket.
- **Reuses:** M2 · Clue Sniffer · existing props
- **Gadget/vehicle/build:** Clue Sniffer
- **Instruction:** **spoken**, with a picture equivalent always shown; a repeat
  button replays it forever
- **Hints:** L1 the sound repeats, stretched · L2 non-matching objects dim · L3
  one match glows · L4 the matches line up and wave
- **Success:** the Sniffer learns the sound and gains a silly new noise
- **Replay:** different sound families
- **Difficulty:** 2→4 targets · 0→4 distractors · unrelated → confusable sounds
- **Blocker:** requires recorded speech. See §13.

---

### 11. Build Us a Bandstand — open creative *(no skill tracked)*

- **Skill:** none recorded — deliberately
- **Objective:** the town wants something built in the empty corner of the park.
- **Educational interaction:** a large build zone opens with no target and no
  correct answer. Townsfolk wander over, look at whatever the child made, and
  react — pointing, clapping, sitting on it, dancing if it has a flat top,
  climbing it if it has steps, sheltering under it if it has a roof.
- **Reuses:** building system · NPC wander behaviour · new build zone
- **Instruction:** an empty plinth with a big ✨
- **Hints:** none. This one cannot be got wrong. If the child places nothing for
  a long time, a Fizzbot places one block and looks pleased with itself.
- **Success:** the structure stays in the world for the rest of the session, and
  the crowd keeps using it
- **Replay:** a new empty plot appears elsewhere
- **Note:** the *only* place where placed blocks must persist. That makes block
  saving a requirement of this mission, not an optional extra.

---

### 12. The Lopsided Bridge — numeracy

- **Skill:** `num.compare`, `count.to10`
- **Objective:** a see-saw bridge across the stream tips over unless it is balanced.
- **Educational interaction:** blocks on one side already; the child adds to the
  other until it levels. The bridge tips visibly and continuously — it *is* the
  feedback, with no separate readout.
- **Reuses:** M1 (balance variant) · movers with a rotation
- **Gadget/vehicle/build:** building required
- **Instruction:** the tipping bridge itself
- **Hints:** L1 the bridge tips harder and creaks · L2 dots appear over each
  side · L3 the missing count outlines itself · L4 one block places itself
- **Success:** the bridge levels, locks, and can be walked across to a new area
- **Replay:** different starting imbalance; later "make the left side heavier"
- **Difficulty:** 1–5 → 1–10 · exact match → "more than" / "fewer than"

---

## 10. First 30 seconds / first 5 minutes

### First 30 seconds

The educational layer must be **invisible** in the first 30 seconds. Phase 1's
opening — pick a hat, press ▶, see the fountain, follow the arrow to a giggling
robot — is the strongest thing in the game and Phase 2 must not touch it.

The first educational machine should appear **after** the first Fizzbot is woken,
and should be the Fountain's Hungry Cogs (mission 1 above), because the fountain
is already the visual centre of the square and already presses.

Checks: no reading required · the sockets are 1-unit blocks, unmissable ·
pressing anything makes something move · the machine reacts before the child
understands it.

### First 5 minutes — the pass condition

| Question | How Phase 2 satisfies it |
| --- | --- |
| Explored voluntarily? | Unchanged — the free-roam town is untouched |
| Discovered something? | The fountain machine is on the existing route |
| Manipulated the world? | Places blocks into sockets |
| Used a learning mechanic naturally? | M1, without knowing it is one |
| Cause and effect? | Fountain erupts on completion |
| Rewarded for curiosity? | Confetti, a Fizzbot backflip, water everywhere |
| Did it feel like a lesson? | **Must be observed, not assumed** — this is the playtest question |

**Redesign trigger:** if, in playtest, a child asks an adult "what do I have to
do?" at the machine, the machine's visual language has failed and must be
redesigned before any more content is authored.

---

## 11. Adaptive difficulty

Small, local, transparent, and invisible to the child.

### State per skill

```js
{ level: 1,          // 1..4
  seen: 0, ok: 0, miss: 0,
  hintMax: 0,        // deepest hint used in the last attempt
  streakOk: 0, streakMiss: 0,
  contexts: [],      // distinct challenge ids where this skill succeeded
  lastSeenSession: 0 }
```

### The rules — all of them

| Trigger | Effect |
| --- | --- |
| 2 consecutive successes with no hint deeper than L1 | `level += 1` (max 4) |
| 2 consecutive attempts needing hint L3+ **or** 3 wrong attempts in one challenge | `level -= 1` (min 1) |
| Level changed | reset both streaks (hysteresis — prevents oscillation) |
| Skill unseen for 3 sessions | `level -= 1` (min 1) on next appearance, as a gentle warm-up |

That is the entire adaptive system. **No model, no weights, no profile.**

### What each level changes

| Level | Numeracy | Spatial | Logic |
| --- | --- | --- | --- |
| 1 | 1–3, dots only, sockets pre-marked | 2 pieces, silhouette shown, no rotation | 2 items, demo repeats free |
| 2 | 1–5, dots, partial start | 3 pieces, silhouette shown | 3 items, demo on request |
| 3 | 1–8, dots + numeral | 3 pieces, rotation needed | 4 items, one decoy |
| 4 | 1–10, numeral first | 4 pieces, silhouette hidden | 4 items, extend not copy |

**Never shown to the child.** No difficulty selector. The adult view (§14) may
describe it in plain words ("currently working with numbers up to 8").

---

## 12. Progressive hint system

Hints are **time-based, never failure-based**, so a thoughtful child who is
staring and thinking is not interrupted as if they were wrong.

| Level | Trigger | Form | Example (Fountain Cogs) |
| --- | --- | --- | --- |
| **0** | — | Nothing | The child plays |
| **1** | 20 s at the challenge | Ambient world cue | Empty sockets pulse and hum |
| **2** | 45 s, or 1 wrong attempt + 10 s | Highlight the object or control | An arrow points at the 🧱 button; the sockets outline |
| **3** | 75 s, or 2 wrong attempts | Demonstrate part of the action | The ghost block appears over the first socket and bobs |
| **4** | 110 s, or 3 wrong attempts | Do most of it, leave the last step | All but one cog drops itself in; the last is left for the child |

Additional rules:

- A **? button** on the mission card lets the child request the next hint level
  immediately. Child-controlled help is better than timed help.
- Hint level never *decreases* within one attempt at a challenge, so help never
  disappears from under them.
- Hints reset when the child walks away and comes back — arriving fresh should
  feel fresh.
- **No praise for not using hints, no penalty for using them**, and hint usage is
  never shown to the child.
- Language: only "Try another one", "Nearly!", "Look over here", "What happens if
  we move this?" — and even those are last resorts behind icons and animation.
- **Nobody can be stuck.** After L4, the challenge can always be completed by the
  remaining single action, and every challenge can be abandoned by walking away
  with no consequence.

---

## 13. Progression, repetition and rewards

### Progress states

| State | Entered when | Meaning |
| --- | --- | --- |
| `NOT_YET_SEEN` | default | Never encountered |
| `INTRODUCED` | first encounter, regardless of outcome | Has met it |
| `PRACTISING` | ≥ 2 successes across ≥ 2 different challenge IDs | Doing it, with support |
| `CONFIDENT` | ≥ 4 successes, ≥ 2 contexts, ≥ 1 at level 3+, no hint deeper than L1 in the last two | Doing it independently, in more than one place |

- **One success never advances a state.** Two contexts are required precisely so
  a lucky guess in one machine cannot count as learning.
- `CONFIDENT` decays to `PRACTISING` after 3 sessions without the skill, so it
  comes back around rather than disappearing.
- **These are gameplay progression states, not assessments.** The plan and the
  adult view must both say so in those words.

### Repetition with variation

A skill returns in a *different mechanic* wherever possible: counting appears in
the fountain (M1), in the bun round (M1 + vehicle), and in the bridge span (M1 +
estimation). Same skill, three different-feeling activities. Identical challenges
never repeat back-to-back; a challenge that has just been completed is suppressed
for the rest of the session.

### Rewards — world only

Permitted: something switches on · a door or roof opens · a character reacts ·
an object transforms · a funny event · **a new block colour joins the build bar**
· a buggy decoration · a gadget gains a silly extra noise · a badge · a new area
becomes reachable.

Forbidden: points · stars · percentages · streak counters · "well done, you have
completed 6 of 12 activities" · any number that measures the child.

---

## 14. Optional adult view

**Entry:** long-press the ⏸ button for 3 seconds, then answer a two-digit
addition on a keypad (e.g. "24 + 17"). No PIN to remember, no data collected,
child-resistant for the target band. A 7-year-old who defeats it finds a page of
words about themselves, which is harmless.

**Shows:** skills encountered · what they have been practising · where hints were
used most (framed as "this one needed more help — worth doing together") ·
roughly how long they have played · three suggested real-world follow-ups
("count the stairs on the way up tonight").

**Language rules — enforced in review:** never *failing, weak, behind, below
average, level, score, grade, assessment, diagnosis*. Never compares children.
The page must carry a plain sentence: *"This is a record of play, not a test.
It cannot tell you how your child is doing at school."*

**Privacy:** the adult view reads the same local save. Nothing is transmitted,
nothing is exported unless the adult explicitly copies text themselves.

---

## 15. Touchscreen implications

Every mechanic above is playable with the **existing** controls: joystick,
camera drag, ⭐ action, ⤴ jump, 🧱 build, ＋ place, － remove, 🔎 sniff.

**Phase 2 adds no new gestures.** Specifically ruled out:

- dragging small objects across the screen
- pinch, rotate or two-finger gestures
- drag-and-drop onto targets
- tapping objects in the 3D scene (ray-picking is precision-dependent; the
  walk-up-and-press model is far more forgiving and already proven)
- anything requiring a tap within a time limit

**Two new passive UI elements only:** a **rule card** (an icon strip on the
mission card, never interactive) and a **? hint button** (76 px, in the existing
action stack). Both must survive the same layout tests already in the suite.

The Route Plotter's arrow panel (M5b) is the only proposal that would break this
rule, which is why it is deferred and gated behind a playtest.

---

## 16. Audio and emerging readers

**Position: keep everything synthesised, and treat recorded speech as a separate,
explicit decision that is not part of the MVP.**

Where speech would genuinely help:

1. **Phonics** — impossible without it. This is the only hard requirement.
2. Short mission instructions — helpful but the icons already carry the load.
3. Hint lines — helpful; a warm "look over here" beats a text toast.

Costs and risks, honestly stated:

- ~40 short recorded words at 16 kHz mono Opus ≈ 3–5 KB each ≈ **150–200 KB**,
  which is **roughly a 70% increase on the current 264 KB package**. Acceptable,
  but it changes the project from "all code" to "code plus assets", which affects
  the precache list, the test suite and the licensing story.
- `speechSynthesis` is tempting (zero bytes) but voice availability, quality and
  gesture requirements on iPadOS are **UNKNOWN**. Do not build phonics on it
  without measuring on a real device first.
- Any recorded voice must be original or clearly licensed, and consistent.

**Non-negotiable rules if audio ships:** every spoken instruction has a picture
equivalent · audio remains optional and mutable · nothing is unsolvable with
sound off · no microphone, no speech recognition, no streaming, no cloud.

---

## 17. Technical integration plan

### The constraints that decide the architecture

1. **Static geometry is immutable after startup** (`bk.builder = null`, no
   `clearChunks`). Educational props must be movers, placed blocks, or a new
   dynamic draw list.
2. **`interactables` and `triggers` are rescanned every frame** → challenges can
   register and unregister at runtime today, with no engine change.
3. **`movers` need `solidRef` wiring** that only happens in `BS.init` → needs a
   small `BS.addMover(def)` helper. ~15 lines.
4. **The event bus already exists and missions already ride it** → challenges
   ride the same bus. No new plumbing.
5. **Save is one JSON blob** → add a `learn` key, bump to `v2`, migrate `v1`
   fields forward.

### New files (keeping the flat, plain-script convention)

| File | Est. lines | Responsibility |
| --- | ---: | --- |
| `learn.js` | ~220 | Skill registry, progress states, adaptive level, session counters. **No DOM, no world access.** Pure state + rules. |
| `challenges.js` | ~420 | The mechanic families, challenge instances, hint controller, world binding. Talks to `BS` through its public API only. |
| `adult.js` | ~180 | The adult view. Lazily created DOM, only built when the gate is passed. |

Existing files touched, minimally:

| File | Change |
| --- | --- |
| `game.js` | Add `BS.addMover()`, `BS.addInteractable()`, `BS.removeInteractable()`; add one `challenges` draw hook in `render()`; extend `save()`/`load()` for `learn`; add the ? button wiring |
| `missions.js` | Allow a step to carry `challengeId` and resolve when that challenge completes |
| `world.js` | Add named **anchor points** only (positions where machines may appear). No new geometry. |
| `index.html` | 2 new elements: `#ruleCard`, `#btnHint` |
| `style.css` | Styles for those 2 elements |
| `sw.js` | 3 new filenames (the existing test already enforces this) |
| `test/run.js` | New checks: every challenge's skills exist; every anchor exists; every challenge is completable at level 1 |

**Not doing:** no educational CMS, no rules engine, no plugin system, no
scene-graph refactor, no state-management library, no build step.

---

## 18. Proposed data structures

```js
// learn.js — the only educational vocabulary in the project
BSLearn.SKILLS = {
  'count.to5': { domain: 'numeracy', label: 'Counting to 5' },
  // …24 entries, see §8
};

// challenges.js — a challenge instance is data, not code
{
  id: 'fountain-cogs',
  mechanic: 'quantitySocket',       // one of five families
  skills: ['num.howManyMore', 'count.to5'],
  anchor: 'fountain',               // a named place in world.js
  levels: {                         // parameters per adaptive level
    1: { target: 3, start: 2, show: 'dots' },
    2: { target: 5, start: 3, show: 'dots' },
    3: { target: 8, start: 3, show: 'dots+numeral' },
    4: { target: 10, start: 4, show: 'numeral' }
  },
  reward: { kind: 'worldEvent', event: 'fountainErupts' },
  repeatable: true
}

// save v2 — additive; v1 fields unchanged
{
  badges: [], gadgets: {}, mission: {}, colour: 0, sound: true,
  blocks: [],                       // NEW: needed by the creative mission
  learn: {
    session: 7,
    skills: { 'count.to5': { level: 2, seen: 5, ok: 4, miss: 1,
                             state: 'PRACTISING', contexts: ['fountain-cogs','bun-round'],
                             lastSeenSession: 6 } },
    challenges: { 'fountain-cogs': { done: 3, lastSession: 6 } }
  }
}
```

Success criteria stay as **named functions inside the mechanic**, not as data.
Encoding arbitrary predicates in JSON is the first step toward a rules engine and
is exactly the speculative complexity the brief warns against.

---

## 19. Privacy and offline architecture

Phase 2 changes nothing here, and must be shown not to.

- No new runtime network requests of any kind. The existing `file://` test
  (zero requests) and the offline reload test both remain in the suite and must
  keep passing with the educational layer present.
- No account, name, email, birthday, profile, location, microphone or camera.
- All progress in `localStorage`, same origin, same single key.
- The adult view is a local render of local data. No export, no sharing, no
  reporting.
- The existing "no remote URLs anywhere in the shipped code" check in
  `test/run.js` extends automatically to the new files.
- **If recorded audio ships**, the files join the precache list and the existing
  "every precached file exists on disk" and "every script is precached" checks
  cover them.

**Offline is not claimed until tested with networking disabled.** Loading
successfully is not evidence.

---

## 20. Project adaptability

A concise `PROJECT_NOTES.md` accompanies this plan in the same folder, holding
current state, confirmed decisions, assumptions, open questions, playtest
observations, educational observations, deferred ideas, rejected ideas, and the
next experiment. It is a decision log, not a requirements document — ideas
recorded there are not commitments.

---

## 21. QA strategy

Nothing in Phase 2 has been built, so **every row below is NOT VERIFIED**. This
table is the gate, not a report.

| Category | Check | Status |
| --- | --- | --- |
| **Educational** | Activity exercises the stated skill | NOT VERIFIED |
| | Difficulty is age-appropriate at each level | NOT VERIFIED |
| | Reading required never exceeds the learning task | NOT VERIFIED |
| | Hints genuinely reduce difficulty (measured: time-to-complete falls) | NOT VERIFIED |
| | No misconceptions introduced (e.g. counting must not imply the last object *is* the number) | NOT VERIFIED |
| **Gameplay** | Child keeps exploring after a challenge | NOT VERIFIED |
| | Exploration is never blocked or forced | NOT VERIFIED |
| | Cannot become permanently stuck | NOT VERIFIED |
| | Enjoyable on replay with new parameters | NOT VERIFIED |
| **Touch** | Completable with touch only, no keyboard | NOT VERIFIED |
| | All new targets ≥ 54 px; no new gestures | NOT VERIFIED |
| | New UI passes the existing 5-viewport overlap suite | NOT VERIFIED |
| **Offline** | Educational content works with networking disabled | NOT VERIFIED |
| | Progress saves and restores offline | NOT VERIFIED |
| | Zero runtime network requests from `file://` | NOT VERIFIED |
| **Accessibility** | Every essential instruction has a visual equivalent | NOT VERIFIED |
| | Sound is never the only cue | NOT VERIFIED |
| | Colour is never the only cue (shape/pattern/position back it up) | NOT VERIFIED |
| | No precision or timing requirements | NOT VERIFIED |
| **Performance** | Draw calls stay near the measured 20/frame | NOT VERIFIED |
| | No new per-frame allocation in the challenge update | NOT VERIFIED |
| | Package growth stated and justified | NOT VERIFIED |
| **Adult view** | Every statement traces to recorded gameplay evidence | NOT VERIFIED |
| | No diagnostic or judgemental language (word-list check, automatable) | NOT VERIFIED |

Automatable in `test/run.js`: skill IDs resolve · anchors exist · every challenge
is completable at level 1 · no banned words in adult-view strings · new files
precached · no remote URLs.

---

## 22. Risks and mitigations

| Risk | Severity | Mitigation |
| --- | --- | --- |
| **The layer turns the game into a worksheet** | Critical | No modal screens, no scores, world-only rewards, and the first-5-minutes test as a hard gate before authoring content |
| **Children never find world-anchored challenges** | High | Put the first one on the existing mission route; give unstarted challenges a gentle idle animation; if playtest shows they are missed, add an optional waypoint — but only then |
| **Counting in 3D perspective is harder than expected** | Medium | Sockets always face the approach direction; filled sockets differ by *shape* as well as colour; a dot readout floats above the machine |
| **Adaptive system oscillates or feels arbitrary** | Medium | Two-signal hysteresis, streak reset on change, only four levels, and it is invisible so a wrong guess costs nothing visible |
| **Wrong-answer feedback reads as failure** | High | Physical comedy only (pop out, wobble, shrug); no red, no cross, no sound that resembles a buzzer |
| **Recorded audio inflates the package and the licensing story** | Medium | Fenced behind its own decision; MVP ships silent-but-visual; measure `speechSynthesis` on device first |
| **Scope creep from 24 skills** | High | Only 3 mechanics in the MVP; skills are cheap *data*, mechanics are expensive *code*; the fence is on mechanics, not skills |
| **Placed blocks not persisting undermines the creative mission** | Medium | Block saving becomes a MUST, scoped to placed blocks only |
| **Static geometry immutability blocks a mechanic** | Medium | Already designed around: every prop is a mover or a placed block. Flag immediately if a mechanic needs new static geometry |
| **Adult view drifts toward assessment** | Medium | Banned-word list enforced by test; a fixed disclaimer sentence; no numbers that rank the child |

---

## 23. Phase 2 MVP

### MUST HAVE — proves the concept

1. `learn.js`: 24 skills, 4 levels, 4 progress states, the 4 adaptive rules.
2. **Three mechanics**: Quantity Socket (M1), Sniffer Sort (M2), Sequence
   Machine (M3) — chosen because together they cost the least new code and cover
   all three launch domains.
3. **Four missions**: Fountain's Hungry Cogs · Copycat Bell Tower · Who Made the
   Muddy Prints? · Mind the Gap.
4. Five-level hint controller with the ? button.
5. World-only rewards; no points anywhere.
6. Save v2 with `learn` + placed blocks, migrating cleanly from v1.
7. `BS.addMover` / `BS.addInteractable` helpers and one challenge draw hook.
8. No new gestures; existing layout suite still passes.

### SHOULD HAVE — high value, not needed for proof

- Shape Fitter (M4) + The Wonky Roof, Sorting the Harbour.
- Route Plotter delivery form (M5a) + The Bun Round, The Post Round.
- The open creative mission (Build Us a Bandstand) with crowd reactions.
- The adult view.
- The Lopsided Bridge as a balance variant.

### LATER — deliberately out of scope

- Fizzbot arrow-programming (M5b) — the only proposal that adds real UI.
- Phonics and any recorded speech.
- Science/world-knowledge content.
- Any skill beyond the 24 listed.
- Cross-session content scheduling ("today's challenge").
- Anything resembling reporting, export or comparison.

### A flagged deviation from the brief

The brief suggests ~5 mechanics in the MVP. **This plan puts 3 in MUST and 2 in
SHOULD.** Front-loading all five would mean five half-tuned mechanics instead of
three well-tuned ones, which is precisely the breadth-over-quality trap the
brief's own quality bar warns against. All five are designed; the fence is on
*build order*, not on scope. Easy to revise if the first playtest goes well.

---

## 24. Implementation roadmap

### Phase 2A — Foundation

- **Goal:** skills, levels, progress and hints exist and are testable, with no
  visible game change.
- **Reuses:** save system, event bus.
- **Changes:** new `learn.js`; `game.js` save/load; `test/run.js`.
- **Player sees:** nothing. Deliberately.
- **Depends on:** nothing.
- **QA gate:** node tests pass; v1 saves migrate to v2 without loss; existing
  playthrough suite still green.
- **Done when:** skill state can be advanced and decayed in a unit test, and a
  v1 save loads with progress intact.

### Phase 2B — First mechanic in the world

- **Goal:** one Quantity Socket machine at the fountain, fully playable.
- **Reuses:** building, movers, `placeBlock`, interactables.
- **Changes:** `challenges.js`; `BS.addMover`/`addInteractable`; one draw hook;
  `#ruleCard`, `#btnHint`.
- **Player sees:** the fountain breaks and can be fixed by placing blocks.
- **Depends on:** 2A.
- **QA gate:** completable by touch only at every level; hints fire on schedule;
  cannot get stuck; draw calls unchanged; offline still clean.
- **Done when:** **a real child completes it without an adult explaining it.**
  This gate is a playtest, not a code review.

### Phase 2C — The other two MUST mechanics and four missions

- **Goal:** Sniffer Sort and Sequence Machine; the four MVP missions integrated.
- **Reuses:** Clue Sniffer, musical pads, mission steps.
- **Changes:** `challenges.js`; `missions.js` gains `challengeId` on steps.
- **Player sees:** three genuinely different-feeling activities across the town.
- **Depends on:** 2B passing its playtest gate.
- **QA gate:** full educational + gameplay + touch + offline table.
- **Done when:** all three MVP domains are exercised and the existing 40-check
  playthrough suite still passes unmodified.

### Phase 2D — Adaptation and variation

- **Goal:** levels actually move; repeats feel different.
- **Changes:** parameter tables per challenge; suppression of just-completed
  challenges.
- **Player sees:** the fountain asks for something different next time.
- **QA gate:** a scripted run of 12 attempts moves a skill 1→3 and back down
  when hints are forced.
- **Done when:** no identical challenge appears twice in one session.

### Phase 2E — Adult view

- **Goal:** local, honest, non-judgemental progress summary.
- **Changes:** `adult.js`; long-press + keypad gate.
- **QA gate:** every statement traceable to recorded evidence; automated
  banned-word check passes; a 7-year-old playtester cannot get in easily.
- **Done when:** an adult reads it and can name one thing to do at home.

### Phase 2F — Child playtesting and refinement

- **Goal:** evidence, not opinion.
- **Method:** 3–5 children aged 5–7, 20 minutes each, on a real iPad, observed
  and not coached. Record: did they find the machine · did they ask what to do ·
  did they keep exploring after · which hint level did they reach · did they
  choose to do another one.
- **QA gate:** ≥ 3 of 5 complete the first machine unaided; ≥ 4 of 5 return to
  free exploration within a minute of finishing.
- **Done when:** `PROJECT_NOTES.md` carries real observations and at least one
  design decision has been changed because of them.

**Deviation from the suggested order:** the brief places adaptation before the
adult view, which this plan keeps — but it moves the *first* playtest forward to
the end of 2B rather than waiting for 2F. Building three mechanics before finding
out whether children notice the first one would be the single most expensive
mistake available here.

---

## 25. Acceptance criteria for the Phase 2 implementation

Before Phase 2 can be called done:

- All three launch domains are represented by working, playable machines.
- At least three reusable mechanics work, each serving ≥ 3 distinct skills.
- At least four educational missions are completable start to finish by touch.
- No educational interaction uses a modal screen, a score, or a new gesture.
- Every essential instruction has a visual form; nothing needs sound.
- Colour is never the only carrier of essential information.
- Hints reach a level at which no child can remain stuck.
- Adaptive difficulty moves in both directions and is invisible to the child.
- Progress persists locally and survives a reload; v1 saves migrate cleanly.
- The full Phase 1 test suites still pass unmodified: 69 node checks, the
  40-check playthrough, the systems suite, the offline/desktop suite, the
  layout suite.
- Zero runtime network requests from `file://`; offline reload verified with
  networking actually disabled.
- Package growth stated explicitly and justified.
- The adult view contains no diagnostic, comparative or judgemental language.
- QA reported as PASS / FAIL / NOT VERIFIED with nothing claimed untested.
- Observed playtest evidence exists for the first-5-minutes test.

---

## 26. Recommended next experiment

**One machine. One mechanic. Three children. No framework.**

Build *only* the Fountain's Hungry Cogs — hard-coded, roughly 120 lines, no
`learn.js`, no adaptive system, no hint controller beyond a single timed nudge.
Put it on the existing mission-1 route. Then watch three children aged 5–7 play
it on a real iPad without any explanation.

**The hypothesis:** *a machine that only works when you get the counting right
feels like a discovery, not a question — and the child keeps exploring
afterwards.*

**What to record:**

| Observation | Why it decides something |
| --- | --- |
| Did they approach the machine unprompted? | Tests world-anchoring vs needing waypoints |
| Did they ask an adult what to do? | Tests whether the visual language works at all |
| How long until first block placed? | Tests hint timing (currently guessed at 20 s) |
| Did they count aloud, or place until it stopped? | Tells us whether it teaches counting or trial-and-error — **the single most important finding** |
| Did they go back to exploring within a minute? | Tests whether learning breaks the game's flow |
| Did they want to do it again? | Tests replay value before any variation system is built |

**Why this and not something bigger:** every other decision in this plan — the
five mechanics, the 24 skills, the adaptive rules, the hint ladder — is
downstream of whether an embedded challenge reads as *world* or as *test* to an
actual five-year-old. That is one cheap experiment away, and everything built
before it is built on a guess.

**Cost:** roughly half a day to build, one afternoon to test. If it fails, the
120 lines are deleted and the mechanic family is redesigned before anything
expensive exists.
