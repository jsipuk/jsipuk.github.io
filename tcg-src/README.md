# Card Ledger — functional alpha

Source is `tcg-src/`; `tcg/` is the generated GitHub Pages build. The independent,
curated reference catalogue lives in `tcg-data/`, outside application source.
The app uses static files and versioned IndexedDB, with no backend or credentials.

## Run

Node 24 is the tested runtime:

```sh
cd tcg-src
npm ci
npm test
npm run dev
```

Open http://127.0.0.1:4174/tcg/. The loopback server serves only the generated
`/tcg/` app and the repository's `/tcg-data/` reference files. Restart after edits.
The current real manifest has six researching releases and no app-ready card
files. A new production collection therefore starts with no tracked binders;
Manage sets shows their availability honestly. Existing saved alpha collections
keep their card metadata, images, quantities and binders as saved references.

For the full architecture interaction, use the **isolated synthetic fixture**:

```sh
npm run dev:fixture
```

Use a fresh browser profile for fixture testing. This command serves a schema-v1
test manifest and synthetic card files only from the loopback server; no fixture
is copied into production. A visible banner identifies the fixture. In Manage
sets, add Perfect Order, open its binder and choose Rapid Entry. Enter `94`,
`094/088`, `98`, `100`: four copies across three cards, with ×2 for number 94.
These names and numbers demonstrate architecture, not verified Pokémon facts.

## Reference integration

At startup and on Refresh reference catalogue, the app fetches
`/tcg-data/manifest.json`, validates schema/data versions and indexes release
metadata locally. Only `readyForApp: true` entries can import their `cardsFile` and
be newly tracked. JSON card files import on demand; routine entry then queries
local reference records without a live provider API.

The contract's Card Ledger IDs are retained as canonical IDs. Provider references
are provenance only. The cache augments original wire fields with internal
presentation/identity checks; it does not modify the curated contract or files.
A card file may be a card array, or an object containing `cards` and optional
`schemaVersion`, `releaseId`, `language`; provided envelope values are checked.
Empty variants use an explicit unspecified bucket. Supplied variants need explicit stable IDs (strings or records); display labels
use supplied labels/names/finish metadata. Unknown identities are rejected rather
than guessed.

Refresh validates every replacement before committing it. Bad/missing files keep
cached cards and quantities usable. Removed IDs/finish metadata remain in the
cache and backup; removed cards appear in Catalogue under saved entries outside
the current checklist. No quantity is guessed onto a renamed ID. Checklists only
claim completion when status and the reconciled numbered count justify it.

## Collection interaction

- Manage sets adds/removes shelf membership. Removing a binder keeps ownership.
- Binders use canonical checklist order with fixed 3×3 pockets, including missing
  cards. Filters dim pockets without changing their positions.
- Rapid Entry inherits binder context, adds deterministic matches on Enter and
  clears/refocuses the input. Ambiguity requires a candidate choice.
- Batch entry saves draft/review and adds only ready, confirmed identities.
- Missing slots open the identified card with Add to collection; detail changes
  otherwise need explicit Save. Cancel/Escape preserve quantities and focus.
- Quantity badges show physical copies (×3), not spare copies. Completion counts
  unique tracked cards; incomplete references cannot claim verified 100%.
- Catalogue exports versioned, timestamped lossless JSON and previews imports.
  Original alpha backups still import. CSV/print are filtered views, not backups.
- Reset Collection requires confirmation, offers a backup and Undo, and clears
  ownership while preserving reference, tracked sets, input and notes.

## Storage and migration

Database `card-ledger` version 2 has `referenceSets`, `referenceCards`,
`referenceVersions`, `collectionEntries` and `settings`. Reference and ownership
commit atomically when needed. Writes check revisions and notify other tabs.
Original localStorage and the earlier two-store IndexedDB ledger migrate without
resetting ownership; original records remain as recovery copies. Demo quantities
are never migrated. Browser-cleared data still needs a JSON backup.

## Checks and build

```sh
npm test
npx playwright install chromium  # only when no local Chromium is available
npm run test:browser
npm run build
```

Browser QA uses Chromium at 1440px and 390px. Tests cover the actual registry,
readiness, dynamic fixtures, tracking, Rapid Entry, ambiguity, migration, quantities,
reference refresh/failure, Unicode backups, reset, Undo and the approved binder UI.
The old nine-release snapshot exists solely as a migration/data test fixture;
production no longer bundles it as a second reference catalogue.

The build copies application public assets and hashes JS/CSS. It never changes or
copies `tcg-data/`, which GitHub Pages serves independently. Commit only relevant
source and generated output; preserve unrelated repository changes.

Direct browser QA of jsip.uk and remote scan availability are blocked by this
managed environment's network policy. Local generated-build screenshots and
limits are recorded in `docs/qa/`. Publication is checked through GitHub Pages.
