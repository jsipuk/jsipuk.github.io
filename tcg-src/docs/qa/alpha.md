# Functional alpha QA — 7 October 2026

Tested the actual generated `tcg/` output using Node 24, esbuild and Chromium.
The runner serves only that directory over loopback. Production publication is
not part of this local result. Live QA at jsip.uk remains blocked by the cloud
network policy; see `prototype.md` for pre-build baseline attempts.

## Verified

`npm test`: **12 passed**. Covers app identity independent of API IDs, releases,
regions, languages and variants; context-required matching; quantities and
zeroes; total-copy duplicate badges; unique-card completion; incomplete checklist
protection; lossless backups; invalid imports; reference preservation; and real
English source coverage with Charizard 4/102 and Evelyn 175/181.

`npm run test:browser`: **6 passed**, three flows at each of 1440 × 900 and
390 × 900. Fresh isolated browser contexts use the bundled real reference, not
mocked metadata or seeded ownership.

- Add Charizard three times from the explicit English Base Set; undo returns the
  pending review, then re-add. Reload retains ×3 with one unique card owned.
- Expanded view edits one printing separately; three unspecified copies plus one
  explicit printing produce ×4, still one unique owned card.
- Duplicate filters and list/grid preserve correct totals and pocket order.
- Mark all copies needed; undo restores them. Saving an already-needed pocket
  keeps zero and retains the card's metadata.
- Undo remains navy on yellow in normal, hover and keyboard-focus states.
- JSON export includes reference, variant quantities, explicit zeroes, input and
  unresolved review. Preview/import restores a document deeply equal to export;
  reload proves the restored quantities persist.
- Number-only context does not match. Malformed imports and simulated storage
  quota failures preserve the saved collection.
- Corrupt persisted data is preserved, visibly blocked from editing and can be
  recovered by importing a valid backup.
- Nine-binder shelf, 3×3 first page, missing slots, expanded view and the approved
  palette/cover/tab geometry are captured in screenshots. Mobile has no page
  horizontal overflow.

## Remaining verification

The environment denies jsip.uk, api.tcgdex.net and assets.tcgdex.net. Screenshot
card-image fallbacks therefore reflect real network failures, not mock artwork.
Actual scan availability and live API coverage are unverified. Card-image URLs
are documented candidates and remain marked unverified in the reference.
Permanent provider adoption and independently complete checklists remain open.
The shipped reference never reports a completion percentage or 100%.
