// Exercise artwork. References are either a path ("assets/exercises/x.svg")
// or "idb:<id>" for an image the user added. Resolved object URLs are cached
// so a re-render never flashes the placeholder.
import { h } from "../js/utils.js";
import { imageURL } from "../js/state.js";

const resolved = new Map();

export const PLACEHOLDERS = {
  exercise: "assets/exercises/placeholder.svg",
  warmup: "assets/exercises/warmup-placeholder.svg",
  cooldown: "assets/exercises/cooldown-placeholder.svg",
  none: "assets/icons/no-image.svg",
  empty: "assets/icons/empty-state.svg",
};

/** Synchronous best guess, for building DOM without awaiting. */
export function knownURL(ref) {
  if (!ref) return null;
  if (!ref.startsWith("idb:")) return ref;
  return resolved.get(ref) || null;
}

/**
 * An <img> that shows the placeholder until the stored blob resolves.
 * @param {string|null} ref
 * @param {{alt?: string, placeholder?: string}} options
 */
export function imageEl(ref, { alt = "", placeholder = PLACEHOLDERS.exercise } = {}) {
  const img = h("img", { alt, src: knownURL(ref) || placeholder, decoding: "async" });
  if (ref && ref.startsWith("idb:") && !resolved.has(ref)) {
    imageURL(ref).then((url) => {
      if (!url) return;
      resolved.set(ref, url);
      img.src = url;
    });
  }
  return img;
}

/** Drops a cached URL after the underlying image is replaced or removed. */
export function forgetImage(ref) {
  resolved.delete(ref);
}
