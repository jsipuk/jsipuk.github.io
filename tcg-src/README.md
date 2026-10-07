# Card Ledger — functional alpha

Maintained source lives in `tcg-src/`. `tcg/` is the generated static GitHub Pages
build. Only these two directories belong to this project. Do not edit generated
HTML or bundles; rerun the build. There is no backend, account, runtime framework
or API credential. Browser storage is private to this origin and device; use JSON
backups to move the collection or protect it against cleared browser data.

## Run

Node 24 (the tested runtime):

```sh
cd tcg-src
npm ci
npm test
npm run dev
```

Open http://127.0.0.1:4174/tcg/. The dev command builds first and serves **only**
the generated `tcg` directory over loopback. Restart it after source changes.
Alternatively, `npm run build` then serve `tcg/` with any static server.

Try Add cards → Base Set → English → `004/102`, then Find cards and Add ready
cards. Repeating the number adds copies. Open the Base Set binder and tap
Charizard to edit quantities; select a variant to track it separately. In Catalogue,
Download lossless backup exports the entire ledger; Import backup validates and
previews it before replacing local data. CSV/print are filtered views, not backups.

## Tests and build

```sh
npm test
npx playwright install chromium  # only if a local Chromium is unavailable
npm run test:browser
npm run build
```

The Playwright configuration uses `/usr/bin/chromium` when available. Browser
QA runs at 1440px and 390px and covers real-card addition, pending review undo,
reload persistence, variant quantities, unique ownership, Got/Need/Duplicate
filters, readable Undo, explicit zero, backup round trips, invalid imports,
failed writes, and corrupt-storage recovery.

`npm run build` uses esbuild to produce hashed JS/CSS, copy the pinned reference
and decorative cover atlas, and regenerate `../tcg/index.html` with relative URLs.
GitHub Pages serves the checked-in `tcg/` output at `/tcg/`; no route fallback,
server secrets, external runtime API or deployment service is required. Commit
source and regenerated output together. Publishing/pushing is a separate step.

## Structure

- `src/domain/`: pure identity, quantities, matching, completion, backup validation
  and storage boundary; unit tests run before UI integration.
- `src/providers/`: curated app release registry and isolated TCGdex adapter.
- `src/ui/`: approved add/review, binder, expanded-card and catalogue flows.
- `src/app.js`: navigation, storage transactions, modal/focus and undo orchestration.
- `public/data/`: pinned real English reference and database license.
- `public/assets/`: approved decorative binder-cover artwork, never card scans.
- `scripts/`: import, build and loopback development server.
- `docs/`: provider verification, schema and browser QA evidence.

## Scope and known limits

889 real English reference entries across nine releases. No sample quantities are
seeded or migrated from `cardledger-demo-v1`; prototype identities and artwork
were illustrative. The old demo key is left intact. English is the first supported
reference language. Schema can represent Simplified Chinese regional releases,
but there is no Chinese catalogue or inferred translation in this alpha.

The permanent provider is undecided. The pinned community snapshot is MIT
licensed; source provenance and the license ship with the build. All checklists
are explicitly incomplete, so no 100% completion claim is possible from the
shipped reference. Printings/finishes supplied explicitly by the source get separate
quantity buckets. Missing finish data remains unspecified, not guessed.

Live browser QA at jsip.uk and actual scan availability at assets.tcgdex.net are
blocked by the managed environment's outbound policy. The repository prototype
snapshot was QA’d before features; exact hash and screenshots are recorded in
`docs/qa/prototype.md`. The alpha displays real reference metadata when a scan
fails, with an explicit “Image unavailable” label. Real artwork, API coverage and
independent checklist completeness require further verification before selecting
a permanent provider. See `docs/data-provider.md` for sources and evidence.
