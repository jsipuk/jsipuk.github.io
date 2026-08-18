// The 1-5 effort control, shared by the workout reflection and the other
// activity sheet so the two can never drift apart.
//
// Every star up to the value is filled and the rest are outlines, so 3 out of
// 5 reads as three filled stars and two empty ones. Shape carries the meaning,
// not colour, and the word underneath spells it out.
import { h, fill, icon, haptic } from "../js/utils.js";
import { DIFFICULTY_WORDS } from "../js/models.js";

export function createEffortRating({ value = null, onChange, showWord = true, size = 34 } = {}) {
  let current = value;
  const row = h("div", { class: "rating", role: "group", "aria-label": "How hard did it feel?" });
  const word = showWord ? h("div", { class: "rating-word" }) : null;
  const el = h("div", {}, row, word);

  function paint() {
    const stars = [];
    for (let star = 1; star <= 5; star += 1) {
      const filled = current !== null && star <= current;
      stars.push(
        h(
          "button",
          {
            class: "rating-btn",
            type: "button",
            dataset: { value: String(star) },
            "aria-pressed": String(filled),
            "aria-label": `${star} of 5, ${DIFFICULTY_WORDS[star]}`,
            onclick: () => {
              current = star;
              haptic(10);
              paint();
              onChange?.(star);
            },
          },
          icon(filled ? "star-filled" : "star", size),
          h("span", { class: "rating-num", text: String(star) })
        )
      );
    }
    fill(row, stars);
    if (word) word.textContent = DIFFICULTY_WORDS[current] || "Tap to rate";
  }

  paint();

  return {
    el,
    getValue: () => current,
    setValue(next) {
      if (next === current) return;
      current = next;
      paint();
    },
  };
}
