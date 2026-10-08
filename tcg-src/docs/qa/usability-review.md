# UI, UX and engineering review — 8 October 2026

The review used three perspectives: collection tasks as an end user, keyboard/mobile
usability, and ownership/reference correctness. The approved cobalt/yellow/navy tabs,
ringless binder covers, nine binders per shelf, fixed 3×3 pockets, missing slots,
original reference image URLs and quantity/Undo behaviour are retained.

## Confirmed findings and fixes

| Priority | Reproduction / problem | Result after fixing |
| --- | --- | --- |
| High | Add in Rapid Entry, restore a backup with different card IDs, then open Add: stale recent IDs threw `Unknown reference card`. | Replacement clears old view identities and invalidates their pending requests; Add remains usable. |
| High | A card file arrives after a newer manifest retracts or changes its release. | The cache rejects obsolete version/readiness/identity/path/count contracts instead of re-enabling stale data. |
| High | Old startup/refresh responses arrive after a backup restore or a newer explicit refresh. | Collection and request generations prevent those responses rewriting the current reference. |
| Medium | Track only the second manifest release; Catalogue showed that release in its selector but used the unimported first release for preview/export. | Selector, preview, CSV and print share the same cached release; unavailable exports are disabled. |
| Medium | Fresh Add/Rapid Entry appeared actionable despite having no reference cards. | Clear availability explanation and direct Manage sets / backup restore actions replace searches that cannot succeed. |
| Medium | A finish is retired after it was chosen in a pending review; detail and batch still offered new copies. | Historical metadata/quantities remain, but new entry is blocked. Saved copies can decrease and pending entries require a current choice. |
| Medium | All cached releases are retracted while a review is pending. | Resume review remains reachable from the empty state; input and unresolved entries survive. |
| Medium | Import or refresh several releases in different request orders. | Existing shelf order is preserved. |
| Medium | Keyboard page/filter/view/export actions replace their focused DOM controls; mobile focus can sit behind fixed navigation. | Focus returns to the corresponding control and scrolls clear of the navigation when needed. Selected controls expose pressed/current state. |
| Medium | Add a batch, type new input, then Undo the addition. | Undo reverses changed fields without discarding the new draft or rolling back reference updates. |
| Medium | Print a complete verified cached checklist. | Print distinguishes complete verified reference from incomplete/retracted reference, rather than always claiming incompleteness. |
| Low | Imported sets still said Ready to import; retracted languages remained selectable for entry. | Set status distinguishes cached/current/update available, loading is visible, and language choices use current eligibility. |

The first integration run caught an introduced cross-tab regression: resetting all
transient state for any remote update closed a binder. Ordinary cross-tab updates now
retain valid binder/context/page state while pruning IDs that disappeared. Full backup
replacement still clears obsolete identities. The existing cross-tab regression test
checks the quantity badge without reopening the binder.

## Verification and limits

The automated checks cover actual curated manifest readiness, real saved English
metadata/migration, deterministic identity/quantity rules, dynamic fixture imports,
reference failures/races, backup/import/reset, cross-tab updates, keyboard flows and
the original binder/Undo interactions. All 32 unit tests and the full 48-case
desktop/mobile browser run passed. After the final focus-scroll adjustment, the
12 UX cases passed again, including a geometry assertion that focused controls
remain above the fixed navigation. Final production bundle: `app-QT6DCRWN.js`.
Root worktree commits: `2f70bc0` (reference/ownership guards), `8f615b9` (UI and
interaction fixes). The core extra interaction pass used `app-RQI2ZYSV.js` before
that last focus adjustment; the final UX screenshots and 12-case rerun used the
final bundle.

The additional interaction and visual pass at 1440px and 390px checked repeated
Rapid Entry (`94`, `094/088`, `98`, `100` → four copies / three unique cards / ×2),
reload, missing-card Add/Undo, Escape/cancel, keyboard zoom, reset confirmation/
cancellation/Undo, empty-state routes, export selection, focus and 200% zoom.
Screenshots/results are in [usability-review/](usability-review/).

The production registry still has six researching releases and no ready card files.
Ready-release and Chinese architecture checks use clearly labelled synthetic fixtures;
they do not establish actual card coverage for those releases. Existing saved card
metadata and original scan URLs remain available. Direct browser access to jsip.uk
and the remote scan hosts is blocked by the environment network policy, so browser
verification uses the generated production files locally and publication is checked
through GitHub Pages. This is not a full accessibility conformance certification.

## Run

```sh
cd tcg-src
npm test
npm run test:browser
npm run dev
```

Open `http://127.0.0.1:4174/tcg/`. For ready-file architecture tasks while actual
reference files remain unavailable, use `npm run dev:fixture` in a fresh browser
profile and keep the development-fixture banner visible.
