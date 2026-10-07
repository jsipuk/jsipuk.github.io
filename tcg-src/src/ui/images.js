export function safeImageURL(
  value,
  base = new URL("/tcg-data/", globalThis.location?.origin || "https://jsip.uk")
    .href,
) {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const url = new URL(value, base),
      origin = new URL(base).origin;
    if (url.username || url.password) return null;
    const external = /^https:\/\//i.test(value) && url.protocol === "https:";
    const cataloguePath =
      url.origin === origin &&
      url.pathname.startsWith("/tcg-data/") &&
      ["http:", "https:"].includes(url.protocol);
    return external || cataloguePath ? url.href : null;
  } catch {
    return null;
  }
}
export function imageCandidates(card, detail = false, base) {
  const images = card.images;
  return [
    ...new Set(
      [
        detail ? images?.large : images?.small,
        images?.large,
        images?.small,
        card.image?.url,
        images?.localFallback,
      ]
        .map((value) => safeImageURL(value, base))
        .filter(Boolean),
    ),
  ];
}
