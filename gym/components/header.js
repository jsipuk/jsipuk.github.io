// The bar at the top of every screen: one action on the left, one on the right.
import { h, icon } from "../js/utils.js";

export function header({ title, subtitle, left = null, right = null, plain = false } = {}) {
  return h(
    "header",
    { class: `app-header${plain ? " header-plain" : ""}` },
    left || h("span"),
    h(
      "div",
      { class: "header-title" },
      subtitle ? h("span", { class: "header-sub", text: subtitle }) : null,
      title ? h("span", { text: title }) : null
    ),
    right || h("span")
  );
}

export function iconButton(name, label, onClick, extraClass = "") {
  return h(
    "button",
    { class: `icon-btn ${extraClass}`.trim(), type: "button", "aria-label": label, onclick: onClick },
    icon(name)
  );
}

export function backButton(onClick, label = "Back") {
  return iconButton("back", label, onClick);
}
