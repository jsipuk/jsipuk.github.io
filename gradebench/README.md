# Gradebench by CONSAU

**Know before you send.**

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

## Brand

Gradebench is a CONSAU product and follows the CONSAU guidelines. The product
name leads and CONSAU endorses — `Gradebench` in Inter Bold with `by CONSAU`
beneath it, never the other way round.

Everything lives in `src/tokens.js` and `src/Brand.jsx`:

| | |
|---|---|
| Foundation | Deep Navy `#0B1320`, roughly 60% of any screen |
| Accent | Teal `#00BFA6` — actions, active states, the maker's mark |
| Energy | Ocean Blue `#2563EB` — the caliper's print-border line, secondary marks |
| Support | Mist Green `#7EE2B8`, Warm White `#F7F7F5`, Slate `#6B7280` |
| Type | Inter, four weights: Bold headings, SemiBold subheads, Regular body, Light captions |
| Icons | `lucide-react` — open shapes, rounded corners, purpose driven |

The submark is two identical open arcs — each a C — offset along the ↘
diagonal and rotated 180° against each other, so together they read as an S.
The second arc is literally the first rotated about the centre (`p` → `48 − p`),
which is why `Brand.jsx` draws the whole mark in two paths. It is drawn as SVG
rather than shipped as an asset so it stays sharp at every size and inverts by
prop (`ring` / `curve`); it holds down to 16px. The app icon is that submark on
Deep Navy, per the CONSAU icon family — `public/icon.svg`.

Inter is bundled via `@fontsource-variable/inter` rather than pulled from
Google Fonts. This is a tool you use at a desk with a card in front of you; it
should look right with the network off.

Two things worth flagging back to the brand:

1. **Warm White's hex reads `#F7F775` on the guidelines sheet**, which is a pale
   yellow and doesn't match the swatch or the name. Implemented as `#F7F7F5`.
   Worth correcting on the sheet either way.
2. **The palette has no caution or negative colour.** A grading tool has to be
   able to say "this corner is damaged", so `tokens.js` adds exactly two
   semantic colours (`#E0A33C`, `#E8825A`) outside the palette, deliberately
   muted so they never compete with Teal. Severity is always icon + word as
   well as colour, so they are reinforcement rather than the signal. Teal is
   reserved for "go": only a **Submit** verdict wears it, never Borderline or
   Hold.

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
    Brand.jsx          CONSAU submark, logo, product lockup, app icon
    tokens.js          CONSAU palette, type scale, semantic colours
  public/icon.svg      app icon — submark on Deep Navy
```

## Notes on the port

- `tokens.js` and `Brand.jsx` are not in the original handoff structure.
  `Caliper.jsx` and `SlabLabel.jsx` both need the token object, and importing
  it from `App.jsx` would make a cycle; `Brand.jsx` holds the CONSAU marks.
- The artifact's Archivo / Instrument Serif / JetBrains Mono trio is gone —
  CONSAU is a single-typeface brand. Numeric readouts that used the mono face
  now use Inter with `tabular-nums`, which holds the columns steady without a
  second family.
- `max_tokens` is 8000, not the 2500 the brief specified. On `claude-opus-5`
  adaptive thinking is on by default and shares the `max_tokens` budget with
  the response, so 2500 truncates the JSON mid-object. 2500 was right for the
  artifact's non-thinking `claude-sonnet-4-6`.
- The request uses **structured outputs** (`output_config.format` with a schema
  built from whichever slots were actually filled) rather than asking for raw
  JSON in the prompt. `extractJSON` is still there as a belt-and-braces parser.
- The Anthropic call goes through the official `@anthropic-ai/sdk` rather than
  hand-rolled `fetch`, so auth, retries and typed errors come for free.
