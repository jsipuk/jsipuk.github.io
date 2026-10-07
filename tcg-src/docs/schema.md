# Collection schema v2 and reference contract

The external catalogue contract remains `/tcg-data/schema/reference-v1.md`, schema
version 1. Application database version 2 and backup schema version 2 are separate
versions. Curated files are not rewritten or supplemented by production fixtures.

## Reference and identity

The manifest supplies release IDs, languages/regions, printed denominators,
numbered targets, status, readiness, aliases, card-file paths and provenance.
Ready card files retain their Card Ledger-controlled IDs, display numbers,
collector-number strings, variants, images and source/provider metadata.

The cache adds `name`/`releaseKey`/`printedTotal` aliases for existing presentation,
`referenceIdentity` (game, region, release ID, language, opaque collector number),
`catalogueSchemaVersion`, validated checklist coverage and imported data version.
Legacy alpha cards retain their original JSON tuple IDs. Source/provider IDs do
not define ownership. Card images accept safe HTTPS or same-origin catalogue
paths; they do not affect identity.

Collector normalization handles leading zeroes, case and presentation spaces,
including TG12, SWSH123 and 30TH-P 004. It never changes the stored opaque number.
A denominator narrows against the card's printed number or release metadata; it
is never a global key. Unknown context requires confirmation, even for one result.
Optional card-name filtering is deterministic. Retired IDs are excluded from entry.

## User ledger

A ledger has `format: card-ledger`, `version: 2`, `reference`, `quantities`,
`trackedSets`, `draft`, `batch` and preserved extension fields (e.g. future notes,
Rapid Entry context). New quantities and tracked sets start empty. Ownership keys
are JSON `[cardId, variantId]` tuples; integer quantities range 0–999, including
explicit zeroes. Variant buckets add to physical total; duplicates are total minus
one; completion counts an owned card once.

A verified completion percentage requires a verified, imported checklist with
an exact nonempty numbered target count. Printed denominator and numbered target
are separate. Outdated/researching/partial checklists cannot claim verified 100%.

## IndexedDB v2

- `referenceSets`: release metadata by release ID.
- `referenceCards`: cards by Card Ledger ID, with a releaseId index.
- `referenceVersions`: manifest/schema/data versions, release import versions,
  provenance and canonical array ordering.
- `collectionEntries`: per-card/variant quantities, supplied only by the user ledger.
- `settings`: tracked sets, pending input/review, extension metadata and revision.

Reference updates change only cached reference records; exact quantity keys and
values survive. Bad replacements are rejected before a transaction. Missing IDs
and finish buckets are retained with a retired flag; saved quantities never move
to a guessed replacement. The UI exposes retired saved records in Catalogue.

Writes are queued and check the persisted revision within the transaction. A
failed/aborted transaction rolls back both reference and ownership. Unchanged
reference is not rewritten for routine draft/quantity updates. BroadcastChannel
refreshes other tabs. Cache-only reload remains usable during endpoint outages.

The first alpha localStorage key `cardledger-alpha-v1` migrates on first use.
Database v1's `reference`/`collection` stores migrate within the upgrade
transaction. Original data stays intact for recovery; corrupt data blocks edits
and can be downloaded, never silently replaced with an empty collection.
Legacy migration preserves the previously displayed shelf as tracked saved
references; new registry releases need explicit tracking. The demo key is excluded.

## Backup and reset

The JSON envelope has `format: card-ledger-backup`, `schemaVersion: 2`,
`applicationVersion`, ISO `exportedAt` and the complete `collection`. Version 1
ledger/envelope backups remain compatible through a deliberate migration.
Unsupported schemas, orphan quantity IDs, duplicate IDs and invalid quantities
fail with no partial write. Extension fields and Unicode survive round trips.

Reset requires deliberate confirmation and clears quantities only. It preserves
reference, tracked releases, draft, review and notes; backup and Undo are available.
Untracking a release only changes `trackedSets`, preserving every quantity.
