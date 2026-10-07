import test from "node:test";
import assert from "node:assert/strict";
import { safeImageURL, imageCandidates } from "../src/ui/images.js";
const base = "http://127.0.0.1:4174/tcg-data/";
test("images support independent HTTPS providers and same-origin catalogue fallback paths", () => {
  assert.equal(
    safeImageURL("https://assets.tcgdex.net/en/card.webp", base),
    "https://assets.tcgdex.net/en/card.webp",
  );
  assert.equal(
    safeImageURL("images/card.webp", base),
    base + "images/card.webp",
  );
  assert.equal(
    safeImageURL("/tcg-data/images/card.webp", base),
    base + "images/card.webp",
  );
  for (const value of [
    "javascript:alert(1)",
    "data:image/svg+xml,evil",
    "http://example.com/image.png",
    "https://user:secret@example.com/image.png",
    "../unrelated/private.png",
    null,
  ])
    assert.equal(safeImageURL(value, base), null);
  const card = {
    images: {
      small: "images/small.webp",
      large: "images/large.webp",
      localFallback: "images/fallback.webp",
    },
  };
  assert.deepEqual(imageCandidates(card, true, base), [
    base + "images/large.webp",
    base + "images/small.webp",
    base + "images/fallback.webp",
  ]);
  assert.equal(
    imageCandidates(card, false, base)[0],
    base + "images/small.webp",
  );
});
