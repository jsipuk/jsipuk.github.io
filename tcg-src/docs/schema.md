# Collection schema v1

A backup is the complete stored JSON document. `format: "card-ledger"` and
`version: 1` identify it. Unsupported versions are refused, never silently
converted. Unknown extension fields are retained in valid v1 backup round trips.

## Identity and reference

A card's app ID is the JSON tuple:

```js
[game, region, releaseKey, language, collectorNumber];
```

All values are nonempty strings. `collectorNumber` is an opaque reference string,
not a global integer. Source numbers are preserved literally. Matching may
normalize padded user input only within an explicitly chosen release and language;
multiple candidates require confirmation. A printed denominator only validates
the selected release. It does not identify a set or a card globally.

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
only after localStorage accepts the entire validated document. Failed writes
leave the current and persisted collection intact. Undo restores the previous
complete document through the same persistence boundary. Invalid or newer saved
data is preserved for download/recovery and editing is blocked until recovery.
The real ledger uses `cardledger-alpha-v1`; it never converts prototype data.
