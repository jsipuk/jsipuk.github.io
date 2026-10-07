> Current app v0.3 uses the independently curated `/tcg-data/` catalogue at
> runtime. This document records the earlier provider investigation. Its pinned
> nine-release snapshot now serves only migration/data tests, and is not bundled
> as a second production registry. Provider selection/curation remains separate
> from the app. See the authoritative `tcg-data/sources.md` and reference contract.

# Provider verification — 7 October 2026

Permanent provider choice is **open**. The initial alpha used a reproducible
pinned English TCGdex snapshot through an adapter. That snapshot is now isolated
as a migration fixture; normal runtime reads the curated catalogue. Ownership
has no dependency on provider IDs, API credentials or subscriptions.

## Sources inspected

- https://github.com/tcgdex/cards-database at commit
  `4199850a6af49665db0080fa2bb9ef751750a406` (cloned successfully).
  README and LICENSE identify the database as MIT; the copyright/license is
  distributed with the snapshot. This does not establish independent rights to
  Pokémon artwork. No scans are redistributed in the build.
- https://tcgdex.dev/ and https://tcgdex.dev/faq: English is supported;
  Simplified Chinese is listed as coming soon, distinct from Traditional Chinese.
  Community-maintained card/variant data may have omissions. No API key required;
  cache for bulk usage. These claims were verified in the current documentation.
- https://tcgdex.dev/assets: documented high/low PNG/WebP/JPG addresses.
  Compiler `server/compiler/utils/cardUtil.ts` only emits image URLs after
  checking a separate image manifest. **A constructed URL proves no scan exists.**
- https://pokemontcg.io/ and https://github.com/PokemonTCG/pokemon-tcg-data:
  legacy source, migration to Scrydex; shutdown announced for 1 March 2027.
  Rejected as a new permanent integration. Scrydex requires a separate service
  evaluation/choice; not adopted or subscribed to.

## What is actually verified

The importer enumerates every English source card in nine curated release
folders, checks source release IDs, reads the real English names, literal collector
numbers and explicit variant fields, and validates unique app identities.
Source reference provenance is retained in every card and release. No LLM
matching or rarity-based variant guessing exists in this path.

The curated release registry maps app release keys to provider release IDs.
Region is `international` for these English releases. A Chinese regional release
must receive a separate registry entry, region and release key; language alone
cannot turn an English release into a Chinese release.

## Unverified / blockers

HTTP attempts to `api.tcgdex.net` and `assets.tcgdex.net` are denied (403 CONNECT)
by the cloud environment's network policy. Actual image availability and live API
coverage cannot be certified here. The UI tries the documented image candidate;
on load failure it displays “Image unavailable” with the real name/number. It
never substitutes generated cover artwork for a card scan. A generic set scan
is labelled as reference artwork, not proof of a particular finish or printing.

All checklists are marked incomplete pending independent checklist verification,
including secrets/promos and regional/printing scope. The UI reports unique
known entries owned and **no completion percentage**. Even owning every current
entry cannot produce a 100% claim. Missing variant metadata is represented as
“Finish not specified”; only explicitly supplied variants are selectable.

Refresh: clone the source repository, checkout the pinned commit, then run
`npm run reference:import -- /path/to/cards-database`. Updating the pin or
registry requires reviewing the source and rerunning identity/data tests.
