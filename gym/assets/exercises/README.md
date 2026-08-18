# Exercise artwork

Drop a picture in this folder, name it after the exercise, and the app uses it.
Nothing in the workout data needs to change.

## Naming

Lower case, words separated by hyphens — the exercise name with the spaces
turned into dashes:

| Exercise name | File |
| --- | --- |
| Bench Press | `bench-press.png` |
| Incline Dumbbell Press | `incline-dumbbell-press.png` |
| Cable Fly | `cable-fly.png` |
| Warm Up | `warm-up.png` |
| Cool Down | `cool-down.png` |

Punctuation and accents are ignored, and `&` counts as "and", so
"Rows & Pulls" is `rows-and-pulls.png`. The exercise editor tells you the exact
filename it is looking for, so you never have to guess.

`.png`, `.jpg`, `.webp`, `.svg` and `.gif` all work. Landscape at roughly 16:10
suits the exercise screen best — 1600 × 1000 is plenty. Images are shown with
`object-fit: contain`, so nothing is ever cropped; anything that is not 16:10
just gets a little space either side.

## After adding or renaming files

```bash
node tools/sync-assets.mjs
```

That regenerates `manifest.json` (which the app reads to match names to files)
and the precache list in `service-worker.js` (so the pictures work offline).
Then bump `CACHE` in `service-worker.js` so installed copies pick up the change.

## Which picture wins

1. An image attached in the app through the exercise editor (stored on that
   device only, and included in a backup export).
2. Artwork in this folder whose filename matches the exercise name.
3. The placeholder.

Removing an attached image falls back to the folder, then to the placeholder.

## Placeholders

`placeholder.svg`, `warmup-placeholder.svg` and `cooldown-placeholder.svg` are
the fallbacks. They are deliberately excluded from name matching, so an
exercise can never accidentally match one. Replace them if you want a different
default look.
