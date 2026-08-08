# Gradebench

Pre-submission inspection bench for trading cards. You photograph a card — up to
ten shots, two sides, five slots each — seat the calipers on the print border,
and it predicts what PSA, BGS and CGC would grade it, with the reasoning shown.

It is a pre-screen for deciding what goes in the envelope, not a grade.

## Running it

```sh
npm install
cp .env.example .env      # add your ANTHROPIC_API_KEY
npm run dev               # http://localhost:5173
```

The dev server hosts the UI *and* two local endpoints — there is no separate
backend process to start.

| Endpoint | Method | Does |
|---|---|---|
| `/api/inspect` | `GET` | Reports the configured model, so the on-screen cost estimate matches what actually runs |
| `/api/inspect` | `POST` | Builds and sends the Anthropic request, normalises the reply |
| `/api/vault` | `GET` / `POST` | Reads and writes `data/vault.json` |

`ANTHROPIC_API_KEY` is deliberately **not** prefixed `VITE_`. Vite inlines any
`VITE_`-prefixed variable into the client bundle, which is exactly how a key
leaks. `vite.config.js` reads the whole `.env` with `loadEnv(mode, cwd, '')`
into the config process only, and never passes it to `define`.

Set `GRADEBENCH_MODEL` in `.env` to use something other than `claude-opus-5`.

## The ten photos

Only **front — full card** is required. Everything else degrades gracefully:
the app inspects whatever subset is loaded and the report names the regions
that were never photographed rather than quietly scoring them 9.

| Slot | Used for |
|---|---|
| Front — full card | Centering (calipers) + front edges + front surface |
| Front — TL, TR, BR, BL macros | Corner subgrade (primary) |
| Back — full card | Back centering (calipers) + back edges + back surface |
| Back — TL, TR, BR, BL macros | Corner subgrade (secondary) |

Photos are downscaled in the browser before upload — macros to a 1568px long
edge, full cards to 1200px, both JPEG q0.85. EXIF orientation is honoured
*first*, via `createImageBitmap(file, { imageOrientation: 'from-image' })`;
skip that and an iOS portrait shot lands sideways, which silently makes every
corner label wrong. A full ten-photo inspection runs about 18–20k input tokens;
the estimated cost is on screen before you spend it.

## How the grade is assembled

Centering is measured geometrically by the calipers, on each side's own
tolerance table. Everything else comes from the model, then aggregates:

- **Corners** — anchor on the four front macros. If the worst *back* corner
  scores below that anchor, the subgrade drops 0.5 once, not per corner.
- **Edges** — same shape: front edges anchor, worst back edge can cost 0.5.
- **Surface** — front score stands; a back surface two or more points below it
  costs 0.5.

With no back photos, all three fall back to front-only behaviour and the report
says so.

**Those weightings are heuristics, not published rules.** They live in one
commented block at the top of `src/grading.js` so they are easy to tune. That
is what the vault is for: record what each slab actually came back as, and the
Vault tab shows predicted vs actual per vendor — sample size, exact-hit rate,
hits within 0.5, and average bias. Once bias is consistently off in one
direction, tune the weights against the evidence instead of intuition.

Beckett has never published its final-grade formula; the rules applied here are
reverse-engineered from submission data by the collecting community and are
wrong often enough to matter. PSA's published figures cover the 10 and 9
thresholds only.

## Layout

```
gradebench/
  .env                 ANTHROPIC_API_KEY=sk-ant-...   (gitignored)
  vite.config.js       dev-server plugin: /api/inspect, /api/vault
  server/
    inspect.js         builds + sends the Anthropic request, normalises the reply
    vault.js           read/write data/vault.json
  data/vault.json      gitignored, capped at 200 entries
  src/
    App.jsx
    grading.js         tables + engines + the tunable weights
    images.js          EXIF-safe downscale, crop, thumbnail, frame detection
    Caliper.jsx        the draggable frames and loupe
    SlabLabel.jsx      the slab label rendering
    tokens.js          colour/type tokens shared by the three components
```

## Notes on the port

- `tokens.js` is not in the original handoff structure. `Caliper.jsx` and
  `SlabLabel.jsx` both need the token object, and importing it from `App.jsx`
  would make a cycle.
- `max_tokens` is 8000, not the 2500 the brief specified. On `claude-opus-5`
  adaptive thinking is on by default and shares the `max_tokens` budget with
  the response, so 2500 truncates the JSON mid-object. 2500 was right for the
  artifact's non-thinking `claude-sonnet-4-6`.
- The request uses **structured outputs** (`output_config.format` with a schema
  built from whichever slots were actually filled) rather than asking for raw
  JSON in the prompt. `extractJSON` is still there as a belt-and-braces parser.
- The Anthropic call goes through the official `@anthropic-ai/sdk` rather than
  hand-rolled `fetch`, so auth, retries and typed errors come for free.
