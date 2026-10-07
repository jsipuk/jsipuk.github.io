import { imageCandidates } from "./images.js";
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
  return '<div class="note">Private collection · Saved on this device. Use a JSON backup to keep a copy.</div>';
}
export function releaseOptions(state, selected, unknown = false) {
  return (
    (unknown ? '<option value="">Don’t know</option>' : "") +
    state.reference.releases
      .filter(
        (r) =>
          (r.legacy || (r.registryReady !== false && r.readyForApp)) &&
          state.reference.cards.some((c) => c.releaseId === r.id && !c.retired),
      )
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
  const candidates = imageCandidates(card, detail),
    url = candidates[0];
  const allowed = Boolean(url);
  return `<div class="${detail ? "detail-art" : "real-card-art"} ${detail ? "" : "card-art"}">${allowed ? `<img src="${escape(url)}" data-image-fallbacks="${escape(JSON.stringify(candidates.slice(1)))}" alt="${escape(card.name)} reference artwork" ${detail ? "" : 'loading="lazy"'} decoding="async">` : ""}<span class="image-fallback" ${allowed ? "hidden" : ""}>${escape(card.name)}<br><small>Image unavailable</small></span></div>`;
}
export function bindImages(root = document) {
  root.querySelectorAll(".real-card-art img,.detail-art img").forEach((img) => {
    const fail = () => {
      const remaining = JSON.parse(img.dataset.imageFallbacks || "[]");
      if (remaining.length) {
        img.src = remaining.shift();
        img.dataset.imageFallbacks = JSON.stringify(remaining);
        return;
      }
      img.hidden = true;
      img.parentElement.querySelector(".image-fallback").hidden = false;
    };
    img.addEventListener("error", fail);
    img.addEventListener("load", () => {
      img.hidden = false;
      img.parentElement.querySelector(".image-fallback").hidden = true;
    });
    if (img.complete && !img.naturalWidth) fail();
  });
}

export function languageOptions(state, selected) {
  const languages = [
    ...new Set([
      "en",
      ...state.reference.releases
        .filter((r) => r.legacy || r.readyForApp)
        .filter((r) => state.reference.cards.some((c) => c.releaseId === r.id))
        .map((r) => r.language),
    ]),
  ];
  return (
    '<option value="" ' +
    (!selected ? "selected" : "") +
    ">Don’t know</option>" +
    languages
      .map(
        (lang) =>
          `<option value="${escape(lang)}" ${lang === selected ? "selected" : ""}>${escape(langName(lang))}</option>`,
      )
      .join("") +
    (!languages.includes("zh-Hans")
      ? '<option value="zh-Hans" disabled>Simplified Chinese · no ready reference yet</option>'
      : "")
  );
}
