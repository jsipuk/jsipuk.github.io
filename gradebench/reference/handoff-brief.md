# Gradebench — Claude Code handoff brief

Port the existing single-file artifact (`gradebench.jsx`) to a local Vite app that takes
**ten uploaded photos per card** instead of cropping corner macros out of one front shot.

Drop `gradebench.jsx` into the repo alongside this brief. It is the reference
implementation — the grading maths in it is correct and should be ported as-is unless
this brief says otherwise.

---

## Stack

- Vite + React (JS, not TS — matches the existing file)
- `lucide-react` for icons
- A Vite dev-server plugin exposing two local endpoints. No separate Express process.
- No Tailwind. The existing app uses inline styles and a token object; keep it.

```
gradebench/
  .env                 ANTHROPIC_API_KEY=sk-ant-...
  vite.config.js       dev-server plugin: /api/inspect, /api/vault
  server/
    inspect.js         builds + sends the Anthropic request, normalises the reply
    vault.js           read/write data/vault.json
  data/vault.json      gitignored
  src/
    App.jsx
    grading.js         tables + engines, lifted verbatim from gradebench.jsx
    images.js          downscale, crop, thumbnail
    Caliper.jsx        lifted verbatim
    SlabLabel.jsx      lifted verbatim
```

`.gitignore`: `.env`, `data/`, `node_modules`, `dist`.

---

## The ten photos

Two sides, five slots each:

| Slot | Used for |
|---|---|
| Front — full card | Centering (calipers) + edges + surface |
| Front — TL, TR, BR, BL macros | Corner subgrade (primary) |
| Back — full card | Back centering (calipers) + back edges + surface |
| Back — TL, TR, BR, BL macros | Corner subgrade (secondary) |

Only **front — full card** is required. Everything else degrades gracefully: the app must
run an inspection on whatever subset is loaded, and say in the report which regions were
never photographed rather than silently scoring them 9.

UI: two collapsible side panels, each a 2×2 grid of corner slots with a wide full-card slot
above. Label the corner slots as they sit on the card, not as a list — TL top-left of the
grid, and so on. Use `<input type="file" accept="image/*" capture="environment">` so the
phone opens the camera directly. Keep `e.target.value = ''` after each pick or re-shooting
the same slot won't fire `onChange`.

### Delete from the old version

`cropDataURL` is no longer used for corners — the `cor` object and the four derived crops in
`inspect()` go entirely. Keep `cropDataURL` only for cropping the full-card shots down to the
seated caliper frame before sending, and keep `thumbDataURL` for vault thumbnails.

---

## Image preparation — do not skip

Raw phone photos base64'd ten at a time will produce a request in the tens of megabytes.
Downscale in the browser before upload:

- Corner macros: long edge **1568px**, JPEG quality 0.85. Detail is the whole point here.
- Full cards: long edge **1200px**. They are used for centering and gross defects only.
- Strip EXIF by virtue of the canvas round-trip, but **honour EXIF orientation first** — iOS
  portrait shots will otherwise land sideways and every corner label will be wrong. Use
  `createImageBitmap(file, { imageOrientation: 'from-image' })`.

Budget: roughly 2k tokens per macro, ~1.2k per full card, so a full ten-photo inspection is
~18–20k input tokens. Worth surfacing an estimated cost line in the UI.

---

## `/api/inspect`

Request: `{ images: [{ role, dataUrl }], sides: { front: true, back: true } }`
where `role` is one of `front-full`, `front-tl`, `front-tr`, `front-br`, `front-bl`,
`back-full`, `back-tl`, `back-tr`, `back-br`, `back-bl`.

The server builds the Anthropic call. Things the artifact did not have to do:

- `x-api-key: process.env.ANTHROPIC_API_KEY`
- `anthropic-version: 2023-06-01`
- **Never name the env var `VITE_ANYTHING`.** Vite inlines any `VITE_`-prefixed variable into
  the client bundle. That is how the key leaks.
- Raise `max_tokens` from 1000 to **2500**. Eight corners, eight edges and a surface block
  will not fit in 1000.
- Confirm the current model ID against the Anthropic docs before hardcoding it.

Build the image manifest dynamically from what was actually sent, and state it in the prompt
in the same order the images appear. Rewrite the prompt so it:

- Names each image by its role rather than by number alone.
- Asks for per-corner scores keyed `front-tl` … `back-bl`, only for corners supplied.
- Asks for edges per side (`front-top`, `front-right`, … `back-left`), read from the full-card
  shots but cross-checked against the macros, which show where each edge terminates.
- Asks for surface per side.
- Keeps the existing instruction to ignore centering entirely, and the instruction to score
  conservatively and say so when an image is too blurry or glared to assess.

Normalise the reply **server-side** — port `normalise()` and `extractJSON()` out of the
artifact and have them run in `inspect.js`, so the client only ever sees clean data. Extend
`normalise()` to mark absent regions as `null` rather than defaulting them to 9.

---

## Grading maths changes

Everything in `grading.js` — `PSA_FRONT`, `PSA_BACK`, `BGS_FRONT`, `BGS_BACK`, `lookup`,
`half`, `centeringSub`, `bgsFinal`, `psaFinal` — ports across untouched. Centering is still
measured by the calipers on the two full-card shots, unchanged.

What changes is the corner and surface aggregation, because there is now real back data:

- **Corners.** Anchor on the four front macros using the existing `anchor()` helper. Then, if
  the worst back corner scores below that anchor, pull the subgrade down by 0.5 — once, not
  per corner. Back corner damage is real but graders weight the front far more heavily.
- **Edges.** Same shape: front edges anchor, worst back edge can cost 0.5.
- **Surface.** Take the front score. A back surface score two or more points below it costs
  0.5.
- When back photos are absent, all three fall back to the front-only behaviour the artifact
  already has, and the report says so.

These weightings are heuristics, not published rules. Keep them in one clearly commented
block at the top of `grading.js` so they are easy to tune once real submission results come
back — that is the whole point of the vault.

Carry over the existing disclaimer text verbatim. It is accurate and it matters: Beckett has
never published its final-grade formula, and PSA's published centering figures cover the 10
and 9 thresholds only.

---

## `/api/vault`

`GET` returns `data/vault.json`, `POST` writes it. Same entry shape as the artifact's
localStorage version, plus:

- `photos` — the ten thumbnails, or at least the two full cards, so a saved card can be
  reviewed later without re-shooting.
- `actual` — nullable. The grade the card genuinely came back as.

That last field is the reason the vault exists. Add a small form on each vault row to record
what the slab actually graded, and a summary at the top of the Vault tab showing predicted vs
actual across all recorded cards, split by vendor. Without it this is a toy; with it the
heuristics above become tunable against evidence.

Cap the file at 200 entries. Since it is on disk now rather than in a 5MB key, thumbnails can
be larger — 300px long edge.

---

## Keep exactly as-is

- The Caliper component, including the loupe. It is the signature interaction.
- The token object `C`, the three typefaces, and the slab-label rendering.
- The severity system — icon plus word, never colour alone.
- The copy throughout. It is written for a person at a desk with a card in front of them.

## Quality floor

Responsive to phone width, visible keyboard focus, `prefers-reduced-motion` respected — all
three are already in the artifact and must survive the port.
