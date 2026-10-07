export const $ = (s) => document.querySelector(s);
export const escape = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
export const langName = (language) =>
  language === "en"
    ? "English"
    : language === "zh-Hans"
      ? "Simplified Chinese"
      : language;
export const pos = (i) => `${(i % 3) * 50}% ${Math.floor(i / 3) * 50}%`;
export function note() {
  return '<div class="note">English alpha · Known reference entries; checklists are not certified complete. Saved on this device.</div>';
}
export function releaseOptions(state, selected, unknown = false) {
  return (
    (unknown ? '<option value="">Choose a release</option>' : "") +
    state.reference.releases
      .map(
        (r) =>
          `<option value="${escape(r.id)}" ${r.id === selected ? "selected" : ""}>${escape(r.name)} · ${escape(langName(r.language))}</option>`,
      )
      .join("")
  );
}
export function swipe(el, fn) {
  let start;
  el.addEventListener(
    "touchstart",
    (e) => (start = [e.changedTouches[0].clientX, e.changedTouches[0].clientY]),
    { passive: true },
  );
  el.addEventListener(
    "touchend",
    (e) => {
      if (!start) return;
      const dx = e.changedTouches[0].clientX - start[0],
        dy = e.changedTouches[0].clientY - start[1];
      if (Math.abs(dx) > 65 && Math.abs(dx) > Math.abs(dy) * 1.4)
        fn(dx < 0 ? 1 : -1);
      start = null;
    },
    { passive: true },
  );
}
export function download(text, name, type = "application/json") {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function cardArt(card, detail = false) {
  const url = card.image?.url;
  let allowed = false;
  try {
    const parsed = new URL(url);
    allowed =
      parsed.protocol === "https:" &&
      parsed.hostname === "assets.tcgdex.net" &&
      !parsed.username &&
      !parsed.password;
  } catch {}
  return `<div class="${detail ? "detail-art" : "real-card-art"} ${detail ? "" : "card-art"}">${allowed ? `<img src="${escape(url)}" alt="${escape(card.name)} reference artwork" ${detail ? "" : 'loading="lazy"'} decoding="async">` : ""}<span class="image-fallback" ${allowed ? "hidden" : ""}>${escape(card.name)}<br><small>Image unavailable</small></span></div>`;
}
export function bindImages(root = document) {
  root.querySelectorAll(".real-card-art img,.detail-art img").forEach((img) => {
    const fail = () => {
      img.hidden = true;
      img.parentElement.querySelector(".image-fallback").hidden = false;
    };
    img.addEventListener("error", fail, { once: true });
    if (img.complete && !img.naturalWidth) fail();
  });
}
