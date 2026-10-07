# Card Ledger reference schema v1

## Release

Required fields:

```json
{
  "id": "perfect-order-en",
  "game": "pokemon",
  "displayName": "Perfect Order",
  "officialName": "Mega Evolution—Perfect Order",
  "language": "en",
  "region": "international",
  "series": "Mega Evolution",
  "releaseDate": "2026-03-27",
  "setCode": "ME03",
  "printedDenominator": 88,
  "numberedCardCount": 124,
  "checklistStatus": "verified",
  "readyForApp": true,
  "cardsFile": "sets/en/perfect-order.json",
  "aliases": ["Perfect Order", "PO", "ME03"],
  "source": {
    "primary": "https://www.pokemon.com/uk/pokemon-news/the-pokemon-tcg-mega-evolution-perfect-order-expansion-is-available-now",
    "secondary": []
  }
}
```

`checklistStatus` is one of:

- `planned`
- `researching`
- `partial`
- `verified`

`readyForApp` must only be true when the referenced card file exists and passes validation.

## Card

```json
{
  "id": "pokemon:en:perfect-order:094",
  "releaseId": "perfect-order-en",
  "language": "en",
  "collectorNumber": "94",
  "displayNumber": "094",
  "printedNumber": "094/088",
  "sortNumber": 94,
  "name": "Example",
  "rarity": "Illustration Rare",
  "illustrator": null,
  "variants": [],
  "images": {
    "small": null,
    "large": null,
    "source": null
  },
  "providerRefs": {},
  "source": {}
}
```

### Identity rule

The canonical Card Ledger printing identity is based on Card Ledger-controlled fields, conceptually:

`game + language + release + collectorNumber + printing/variant identity`

Never use an external provider's card ID as the canonical collection key.

### Numbers

Collector numbers are strings. They must support values such as:

- `94`
- `094`
- `TG12`
- `SWSH123`
- `30TH-P 004`

The printed denominator is metadata and may help candidate resolution, but is not globally unique.

## Runtime stores

The app should import this catalogue into IndexedDB using separate logical stores:

- `referenceSets`
- `referenceCards`
- `referenceVersions`
- `collectionEntries`
- `settings`

`collectionEntries` is user data and is never supplied by this catalogue.

## Validation

A release can become `readyForApp: true` only when:

1. its card file parses successfully;
2. every card has a unique Card Ledger ID;
3. collector numbers are unique within the numbered checklist unless an explicitly modelled variant requires otherwise;
4. the highest/expected numbered checklist has been reconciled;
5. language and release IDs match the manifest;
6. source/provenance is present;
7. images may be missing, but missing images must not invalidate card identity.
