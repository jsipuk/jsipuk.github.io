# Unknown-context search and storage QA — 7 October 2026

## Reported regression

“Don’t know” cleared the release/language dropdowns, but their blank options still
said “Choose…”. Find cards then rejected missing context, so the advertised
unknown-context path could not proceed.

Discovery now searches the pinned reference deterministically. Candidate cards
show their image URL/fallback, release, language, region and collector number.
Unknown context always requires explicit confirmation, even for one result.
Fully contextual matching remains strict; search alone records no ownership.
English `4/102` offers Base Set Charizard; `4` offers nine distinct release
identities. The unresolved remainder persists after adding only confirmed cards.
The same original TCGdex scan URLs are retained.

## Storage and backup evidence

19 Node domain/data/storage tests pass, including:

- App identity separates releases, regions, languages and variants; quantities,
  duplicates and incomplete completion retain the established rules.
- Legacy alpha ownership and UTF-8 notes migrate into IndexedDB atomically, while
  the original localStorage document remains untouched. Prototype data is excluded.
- Ownership and reference occupy separate stores. An injected failure after the
  ownership write rolls both stores back; stale revisions cannot overwrite another tab.
- Simultaneous first-time migration preserves the first committed collection.
- Reset clears every ownership quantity while preserving reference and metadata.
- Versioned, timestamped backups round-trip losslessly; original alpha backups
  still import; malformed or orphan ownership entries are rejected.

The six functional browser scenarios pass at 1440×900 and 390×900 (12 cases):
real addition/variants/duplicates/Undo/reload/backup; unknown-context safety and
failed writes; corrupt database recovery; ambiguous candidate confirmation;
legacy migration/reset/cancel/backup/Undo/binder context; cross-tab updates and
reload with the reference request blocked.

After the final CSS adjustment, the quantity/backup scenario and a new 200% zoom
scenario pass at both widths (four targeted cases). Undo remains navy on yellow,
including hover/focus, and its minimum height is 44px. The original binder shelf,
fixed 3×3 page positions, missing pockets, filters and expanded view are retained.

## Additional manual interaction pass

The final generated production build was exercised at both widths, with a touch
context at 390px. Unknown search → confirm → add, quantity Cancel/Save, returning
focus to the originating pocket, fixed duplicate-filter positions, artwork zoom,
Escape and reset cancellation all pass with no page exceptions.

A first 200% zoom inspection found a 21px horizontal overflow on mobile from the
header badge. Allowing the header to wrap removes it without changing the normal
layout. The final repeat reports zero horizontal overflow at both widths.
Screenshots are in `search-storage/`: unknown confirmation, zoom and reset for
each width. These screenshots are local-build evidence, not live-site captures.

## Deployment limitation

GitHub Pages completed successfully for the search fix `800f87d`. Direct Chromium
navigation to `https://jsip.uk/tcg/` still returns `ERR_TUNNEL_CONNECTION_FAILED`;
the managed policy also excludes `assets.tcgdex.net`. Consequently scan loading
and live-origin browser interactions cannot be independently verified here.
The user reports the original artwork loads correctly in their browser. No scan
URLs were replaced; the locally blocked scans display the explicit fallback.
Final publication is verified through GitHub Pages and the committed build.
