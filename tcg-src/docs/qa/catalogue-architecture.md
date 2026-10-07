# Catalogue architecture checkpoint — 7 October 2026

Application commit on `main`: `ef0451124d8589761ca17e39c50a92ce8c8c977a`.
Domain/storage commit: `0df4b20`. GitHub Pages run `37694314410` completed successfully.
Build assets: `app-N4WTEPEY.js`, `app-CKOPU6QI.css`.

The additional Chromium interaction pass used these exact production build files on
`http://127.0.0.1:4174/tcg/`, verified identical to the published commit. The environment's
network policy blocks direct browser access to `https://jsip.uk/tcg/` and the remote
TCGdex scan hosts. Deployment success is verified through GitHub; this is not a claim
that the live origin was browser-tested or its original scans were downloaded here.

## Real data and synthetic proof

- The independently curated production manifest loads and caches all six releases.
  All six currently have `readyForApp: false` and researching checklists; all Track
  buttons stay disabled. A fresh profile has zero cards, ownership and tracked binders.
  No curated data was changed or promoted to ready by this application work.
- Isolated migration checks use the existing pinned English reference with actual
  Charizard `4/102` metadata. “Don’t know” stays selected, Find cards finds the saved
  reference, explicit release/language confirmation precedes addition, and Undo restores
  zero ownership. The original source image URLs are retained.
- Dynamic ready-file imports, new tracked binders and Rapid Entry are demonstrated
  with the explicitly labelled development fixture. Its Perfect Order label, 100-card
  count and Chinese names are synthetic test data, not verified Pokémon facts. The
  production build contains no fixture catalogue or seeded collection.

## Additional desktop and mobile interaction pass

Both 1440px and 390px widths passed:

- Track a ready fixture release and open its approved ringless binder; nine fixed pockets.
- Enter `94`, `094/088`, `98`, `100`: four physical copies, three unique cards, `×2` on 94.
  Each Enter clears and refocuses the field; reload retains quantities.
- Missing-card Add immediately records one copy; Undo restores Need and reference remains.
- Staged quantity changes discarded on Escape; focus returns to the originating pocket.
  Keyboard Enter toggles expanded artwork zoom.
- Reset cancellation leaves quantities intact; confirmed reset and Undo work.
- Undo has navy text `rgb(16, 30, 73)` on yellow `rgb(255, 218, 34)`, including focus.
- 200% zoom produces zero horizontal overflow at both widths.

Screenshots and structured results are in [catalogue-architecture/](catalogue-architecture/).
Fixture screenshots intentionally show unavailable artwork; the independent image
pipeline browser test verifies a local image and fallback from a failed larger image.
Full-page screenshots capture the fixed bottom navigation at the viewport's position.

## Automated verification

29 unit tests passed. The full 24-case desktop/mobile browser run passed after the
reference-refresh interaction races, modal timing, image fallback and zoom fixes.
After the final data-derived example change, four targeted desktop/mobile cases passed
(two existing cases and two new cases): 26 distinct browser cases exercised successfully.
Coverage includes reference validation, separate language/release/card/variant identities,
normalization and ambiguity, duplicate/unique completion rules, stale and bad refreshes,
storage migration/conflicts, quantities surviving reload, backup/reset/import with Unicode,
retired metadata retention, image fallback and the approved binder/Undo interactions.

## Reproduce

```sh
cd tcg-src
npm ci
npm test
npm run test:browser
npm run dev
```

Open `http://127.0.0.1:4174/tcg/` for the actual registry. To exercise ready-pack import
while real card files remain unavailable, stop that server and run `npm run dev:fixture`
in a fresh browser profile. The development fixture warning must remain visible.

The next real-data proof requires an independently verified card file with its release
marked ready in `/tcg-data/manifest.json`; the application imports it without adding
hardcoded cards or releases to source.
