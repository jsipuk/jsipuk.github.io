# Card Ledger reference data

This directory is the static, versioned reference catalogue for the Card Ledger TCG collection app.

It is deliberately separate from `tcg-src/` so application code and reference-data curation can progress independently.

## Runtime contract

The deployed app may fetch this data from the same GitHub Pages origin:

`/tcg-data/manifest.json`

A release is **not app-ready** until `readyForApp` is true and its referenced card file exists.

The app must cache reference data locally (IndexedDB) and keep user ownership data in a separate store. Updating reference data must never overwrite collection quantities.

## Files

- `manifest.json` - registry of supported/planned releases and their data status.
- `schema/reference-v1.md` - Card Ledger reference-data contract.
- `sources.md` - provenance and validation sources.

Future card files will live under:

`sets/<language>/<release-id>.json`

For example:

`sets/en/perfect-order.json`

`sets/zh-Hans/30th-celebration.json`

## Rules

1. Collector numbers are strings.
2. English and Simplified Chinese releases are separate records, even if their display names are similar.
3. Provider IDs are provenance only; they are never Card Ledger's primary key.
4. Do not mark a checklist complete unless the full numbered checklist has been independently verified.
5. Card images are presentation metadata, not identity.
6. Demo ownership quantities do not belong in this catalogue.
