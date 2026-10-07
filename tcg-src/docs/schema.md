# Collection schema v1

Backups use an envelope with `format: "card-ledger-backup"`, `schemaVersion: 1`,
`applicationVersion` and ISO `exportedAt`, containing the complete ledger in
`collection`. The ledger has `format: "card-ledger"` and `version: 1`. Direct
ledger backups from the first alpha remain importable. Unsupported versions are refused, never silently
converted. Unknown extension fields are retained in valid v1 backup round trips.

## Identity and reference

A card's app ID is the JSON tuple:

```js
[game, region, releaseKey, language, collectorNumber];
```

All values are nonempty strings. `collectorNumber` is an opaque reference string,
not a global integer. Source numbers are preserved literally. Matching may
normalize padded user input to discover candidates. A printed denominator filters
eligible reference releases, but never uniquely identifies a release or card.
Without full release/language context, every discovery result requires explicit
confirmation of a complete card identity, even when there is only one candidate.
Fully contextual matching remains a separate strict domain function.

Release metadata separately contains `game`, `region`, `releaseKey`, `language`,
name, date, printed total and checklist coverage. The curated app release key
must not be changed when switching providers. A provider mapping is provenance,
not the app key. Regional Chinese releases need new registry entries, not copied
English numbers or translated English set IDs.

Each card retains real name, number, release/language, rarity, source provenance,
image candidate/verification state, and supported variant records. A variant ID
is a canonical JSON object of finish, printing, size, sorted stamps and foil,
or the explicit `unspecified` bucket. Separate printing details such as shadowless
and first edition are retained when the source explicitly provides them.

## Ownership

A quantity key is the JSON tuple `[cardId, variantId]` in `quantities`.
Quantities are integers from 0 to 999; total per card also caps at 999, preserving
the prototype's quantity limit. Zero entries stay zero and reference metadata is
retained. Missing quantity keys mean zero. Variant quantities add to the card's
total. Got means total > 0; Need means zero; Duplicate means total > 1. The badge
shows **total copies**, e.g. ×3, while catalogue spare count is total minus one.

Completion counts distinct tracked card IDs with any owned variant, never copies.
A percentage requires `checklist.complete === true`, an explicit expected total,
and an exact nonempty checklist size. Otherwise percent is null and completed
is false, including when all currently known entries are owned. All shipped
checklists have `complete: false`.

## Backup, validation and persistence

The ledger includes the entire `reference`, all `quantities` (including explicit
zeroes), saved input (`draft`), unresolved/ready review (`batch`) and extension
metadata. JSON export/import therefore remains usable if a provider disappears.
CSV omits restore-critical structure and is not the backup format.

Validation checks format/version, card/release identity relationships, unique IDs,
variants, all quantity ranges and referenced keys, draft and pending review.
Malformed imports never write storage. An import preview states copies, unique
owned cards, releases and pending rows before replacement. There is no automatic
merge or lossy matching during restore.

All quantity and batch operations produce a new collection. UI state changes
only after the IndexedDB transaction commits. Database `card-ledger` version 1
has `reference` and `collection` stores, each with a `current` record. The latter
stores `{ revision, state }`; `state` includes ownership, input, pending review
and extensions but excludes reference metadata. Changed reference and ownership
write in one transaction. Ordinary draft/quantity saves do not rewrite unchanged
reference data. A saved reference is available on reload without a network fetch.

Writes are queued per tab and evaluate updates against the last committed state.
Each write checks the persisted revision inside its read/write transaction;
stale tabs cannot silently overwrite another tab. BroadcastChannel refreshes
other open tabs. Failed or aborted transactions preserve both stores. Undo
restores the previous complete ledger through the same persistence boundary.
Reset clears only `quantities`, requires confirmation, offers a backup and Undo,
and preserves reference, drafts, review and extension metadata.

On first open, a valid `cardledger-alpha-v1` localStorage ledger is migrated
transactionally. Its original document remains untouched as a safety copy.
Once IndexedDB has a collection it takes precedence over the legacy key. The
demo key is never migrated. Invalid or newer saved data is preserved for download;
editing is blocked until recovery. Explicit backup replacement can recover a
corrupt database transactionally. Browser-cleared data still requires a backup.
