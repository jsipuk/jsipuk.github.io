# Real catalogue integration — 8 October 2026

Reference source: independently curated `main` commit `a29478b`, manifest
`2026-10-08.2`. Perfect Order: 124 numbered cards / denominator88. Destined Rivals:
244 numbered cards / denominator 182. Five other releases remain researching.
The application work does not change `/tcg-data/`.

## Audit and exact reproduced failure

Before application edits, the then-published `app-QT6DCRWN.js` build was tested
locally against the new real files. Both files already passed the existing adapter.
Tracking, pinned Rapid Entry and reload worked: PO `94`, `094`, `094/088` matched
Clefairy, DR `49` matched Misty's Gyarados and `101` matched Regirock ex. This
does not establish a reproduced failure on the remote live origin.

The confirmed cache defect was narrower: an imported Perfect Order checklist
at `.1`, later untracked, kept importedVersion `.1` even when startup fetched
manifest `.2`. The refresh loop visited trackedSets only. The regression failed
at both desktop/mobile widths before the fix. Refresh now visits tracked and
previously imported ready releases, including untracked ones. Quantities, shelf
membership, input/context and notes remain unchanged; no IndexedDB clearing is
required. Data is still queried locally during number entry.

The manifest already uses cache:`no-cache`; there is no service worker in this
application. The app's generated bundle matched the checked-in published build
before editing. A live-origin stale HTML, CDN/browser cache or deployment issue
cannot be diagnosed without live-origin browser access; it is not assumed here.

Pack-level source provenance was previously dropped even though row-level source
and manifest provenance were retained. The validated envelope source now persists
as release.cardSource and survives storage/backup. Normal set addition displays
"Adding Perfect Order…" and "Perfect Order added." without import/JSON/storage
terminology. An empty entry screen also updates when background loading makes
ready data available, without replacing an editable draft.

## Ownership safety

The first Perfect Order file from curator commit `5241214` used
`pokemon:en:perfect-order-en:094` and collectorNumber`094`. The current file uses
`pokemon:en:perfect-order:094` and collectorNumber `94`. The application does not
guess that ownership should transfer. Old controlled IDs remain retired with
their quantities/source metadata, and appear in Catalogue saved entries outside
the current checklist. New canonical slots start at zero. The historical file
is an isolated migration test fixture, copied unchanged from that curator commit;
it is not a production data source. The old researching manifest fixture is copied
unchanged from `fa22885` to prove normal upgrades.

## Browser acceptance and images

The additional interaction pass at 1440px and 390px used the generated production
bundle `app-VTPPSWC5.js` with actual local `/tcg-data/` files and fresh profiles:

1. Add Perfect Order; binder starts 0/124 and has 14 fixed 3×3 pages.
2. Add 94 → Clefairy 094/088; clear/refocus input; reload retains ownership.
3. Add 94 again → ×2; reference card identity is unchanged.
4. Reset Collection → zero quantities; PO reference/tracking remain.
5. Add Destined Rivals; binder starts 0/244 and has 28 fixed 3×3 pages.
6. Add 49 → Misty's Gyarados 049/182; add 101 → Regirock ex 101/182.
7. Inspect the three identified owned slots and expanded views.

All non-image steps passed at both widths with no uncaught page errors.
All 124/244 active collector numbers remain in canonical numeric order. Fresh
profiles have no ownership seed. Global 49 produces two candidates with real
metadata/image elements and requires choice. Image fallback and Undo preserve
the approved UI. Screenshots/structured results are in [real-catalogue/](real-catalogue/).

The browser attempted `https://jsip.uk/tcg/` and received
`ERR_TUNNEL_CONNECTION_FAILED`. The environment's enforced policy also excludes
`assets.tcgdex.net`. Its runtime inspection confirmed both hosts are blocked.
The three actual supplied TCGdex image URLs are used unchanged; all have
naturalWidth 0 here and correctly show Image unavailable, with no demo scan
substitution. **Actual image availability/display and the exact live-site
acceptance sequence remain unverified.** Host access was requested asynchronously
while implementation continued. Deployment verification is separate from that
browser/image acceptance.

## Checks

All 36 unit tests and 54 desktop/mobile browser cases passed. The real-catalogue
unit cases validate 124/244 records, unique controlled IDs and
collector numbers, all supplied image/provenance metadata, specified real lookup
examples, global ambiguity, invalid-file rejection and incompatible old-ID
retention. Browser cases cover old researching manifest upgrades, older untracked
cache refreshes, settings/ownership preservation and the real entry/reset flow.

```sh
cd tcg-src
npm test
npm run test:browser
npm run build
npm run dev
```

Open `http://127.0.0.1:4174/tcg/` to test the actual ready datasets. A fixture server
is unnecessary for these real-data tasks.
