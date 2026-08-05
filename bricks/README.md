# /bricks/ — Brick Lab

Five brick-building concepts at [jsip.uk/bricks](https://jsip.uk/bricks/), all
clipped onto one shared system. Static files, no build step, no dependencies, no
network requests.

The brief was "get started on 5 concepts, which can be developed, merged or
dropped". So they are deliberately five *starts*, each unfinished in a different
direction, and the shared core exists precisely so that merging two of them
later is cheap.

## The five

| | Concept | What it is | Status |
|---|---|---|---|
| 01 | [Bench](c1-bench/) | Brick builder. Snaps to studs, refuses to float or overlap, tells you if the model would fall apart. | Playable |
| 02 | [Steps](c2-steps/) | Instruction compiler. Any model → a real booklet with build order, parts callouts and a printable contact sheet. | Playable |
| 03 | [The Tub](c3-tub/) | Inspiration engine constrained by the bricks you actually own. | Playable |
| 04 | [Three Views](c4-three-views/) | Puzzle game: rebuild a hidden shape from its three shadows. Twelve levels. | Playable |
| 05 | [Blind Build](c5-blind-build/) | Two-player game with real bricks. One describes, one builds. The screen only referees. | Playable |

## The system

`system/` is the reason these are one thing rather than five.

| File | What it holds |
|---|---|
| `system.js` | Units, part catalogue, colours, collision, support, bill of materials, the share format, the seeded generator. No browser globals, so it is testable in node. |
| `iso.js` | Isometric canvas renderer. Face normals, back-face culling, painter's sort, studs. |
| `steps.js` | The build-order compiler. Also free of browser globals. |
| `system.css` | Site tokens plus the controls every concept needs. |

### Geometry

Real dimensions, so anything measured off a brick on the carpet lines up with
anything drawn on screen:

| | |
|---|---|
| Stud pitch | 8.0 mm (X and Z) |
| Plate height | 3.2 mm (Y) |
| Brick height | 9.6 mm — three plates |
| Stud diameter | 4.8 mm |
| Stud height | 1.8 mm |

A placement sits on an integer grid: `x`/`z` in studs, `y` in **plates** so that
plates and bricks share one axis, and `r` as quarter turns about Y.

Internally everything converts to **stud widths** (one plate is `0.4`), which
keeps the space isotropic — face normals stay true and the projection stays
honest.

### Why isometric

Instruction booklets are drawn isometrically, so it is the native view of the
thing being modelled, and it needs no WebGL. The projection is:

```
screenX = (X − Z) · cos30 · S
screenY = (X + Z) · 0.5 · S − Y · S
```

A point moving along `(1,1,1)` does not move on screen, so `(1,1,1)` is exactly
the view direction. Two things fall out of that:

- a face is visible when its outward normal has a positive dot product with
  `(1,1,1)` — that is the whole of back-face culling, and it is why slopes shade
  themselves without a special case;
- depth along the view ray is `X + Y + Z`, which is the painter's sort key.

Parts are convex, so culling alone orders the faces *within* a part. Only the
parts themselves need sorting.

### Why the build order is free

This is the nicest result in here. A part's supporters are exactly those whose
top surface meets its underside, and every part is at least one plate tall — so
a supporter's `y` is always strictly less than the part it holds up. **Sorting
by `y` ascending therefore cannot put a part before its own support.** The
dependency graph is already topologically sorted by height. No toposort, no
cycle detection.

What is left is grouping, which is three rules: never more than four parts in a
step; break when the colour changes; break when the next part is far from the
ones already in the step. Then a merge pass joins adjacent steps where nothing
in the later one rests on anything in the earlier one — which is what stops a
tall thin model producing a dozen one-part steps.

### Picking, in Bench

A screen point does not name a cell, it names a line. Because `(1,1,1)` is the
view direction, that line is `(X₀+t, t, Z₀+t)` where `X₀,Z₀` come from
unprojecting at ground level. March `t` from near the camera to far, stop at the
first filled cell, and the empty cell just before it is the one you meant. The
part then falls to the lowest level at or below it that will actually hold, so
clicking the side of a wall drops a brick to the floor beside it rather than
leaving it hanging.

## Tests

```bash
node bricks/test/run.js     # 487 checks, no dependencies
```

It covers the catalogue's shape, collision and support, the share format's round
trip *and its tolerance of rubbish input*, the generator's promise that every
model it produces is buildable (checked across 60 seeds), and the compiler's
central promise — that no step ever places a part before something that holds it
up — checked across 30 generated models.

There is also a Playwright smoke test that was used during development but is
not committed: it loads all six pages, drives the core interaction of each, and
checks that every canvas actually draws. Worth rebuilding if this goes further.

## Known limits

- **31 generic parts**, not a real inventory. No minifigures, no Technic, no
  hinges, no printed parts. A real catalogue means a real parts database, which
  means a download, which means giving up the promise that these pages fetch
  nothing.
- **Support is checked downwards only.** A part held on from above — a plate
  clipped to the underside of something — is reported as floating.
- **Slopes are treated as their full box** for collision, so you cannot tuck a
  plate under an overhang that in reality would accept it.

Both of those last two are *stricter* than the bricks are, which is the right
way round to be wrong: it will never tell a child something will stand up when
it will not.

## The trademark

LEGO® is a trademark of the LEGO Group, which does not sponsor, authorise or
endorse any of this. Everything here describes a generic system of plastic
bricks: no official part numbers, artwork or data are used, and the colour names
are the community-standard ones. The disclaimer appears in the footer of every
page in this directory. If any of it is ever promoted to a headline feature of
the site, that is the thing to re-check first.

## If this goes further

The recommendation on the hub page, in short: **merge Bench, Steps and Three
Views into one product** (build → compile → practise), **keep The Tub separate**
because it is the one with no screen in it, and **park Blind Build** until it has
been played at a real kitchen table three times. It is the most fun idea here and
the one most likely to be wrong, and that is not a question code can answer.

The first real feature Steps is missing is **sub-assemblies** — a chimney built
separately and then attached — which is what booklets do and what the compiler
cannot yet see.
