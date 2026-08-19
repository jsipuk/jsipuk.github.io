// Shared interactive pieces: sheets, toasts, the numeric keypad, steppers,
// switches and segmented controls. Everything here is deliberately chunky —
// it is used with sweaty hands, one-handed, in a hurry.
import { h, fill, icon, formatNumber, haptic } from "../js/utils.js";
import { state } from "../js/state.js";

const overlayRoot = () => document.getElementById("overlays");
const toastRoot = () => document.getElementById("toasts");

/* ---------------------------------------------------------------------------
 * Sheets
 * ------------------------------------------------------------------------- */
const openSheets = [];

/**
 * Bottom sheet. `build(close)` returns the body content, so the content can
 * dismiss the sheet itself.
 */
export function openSheet({ title, build, buildFooter, full = false, onClose } = {}) {
  const scrim = h("div", { class: "scrim" });
  const sheet = h("section", {
    class: `sheet${full ? " sheet-full" : ""}`,
    role: "dialog",
    "aria-modal": "true",
    "aria-label": title || "Options",
    tabindex: "-1",
  });

  const entry = { scrim, sheet, onClose };
  const close = () => closeSheet(entry);

  const head = h(
    "div",
    { class: "sheet-head" },
    h("div", { class: "sheet-title", text: title || "" }),
    h("button", { class: "icon-btn", type: "button", "aria-label": "Close", onclick: close }, icon("close"))
  );
  const body = h("div", { class: "sheet-body" });
  const content = build ? build(close) : null;
  if (content) body.append(content);

  // An optional footer sits outside the scrolling area, so a primary action
  // stays put however long the form is.
  const footerContent = buildFooter ? buildFooter(close) : null;
  const footer = footerContent ? h("div", { class: "sheet-footer" }, footerContent) : null;

  // append(null) would insert the literal text "null", so only append a real
  // footer.
  sheet.append(head, body);
  if (footer) sheet.append(footer);
  scrim.addEventListener("click", close);
  overlayRoot().append(scrim, sheet);
  openSheets.push(entry);
  document.body.style.overflow = "hidden";

  // Move focus into the dialog for keyboard and VoiceOver users, but onto the
  // sheet itself: focusing the first field would pop a keyboard or a date
  // wheel over the very options the user came to tap.
  sheet.focus?.();

  return { close, sheet, body };
}

function closeSheet(entry) {
  const index = openSheets.indexOf(entry);
  if (index === -1) return;
  openSheets.splice(index, 1);
  entry.scrim.remove();
  entry.sheet.remove();
  if (!openSheets.length) document.body.style.overflow = "";
  entry.onClose?.();
}

export function closeTopSheet() {
  const entry = openSheets[openSheets.length - 1];
  if (entry) closeSheet(entry);
}

export function closeAllSheets() {
  while (openSheets.length) closeSheet(openSheets[openSheets.length - 1]);
}

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeTopSheet();
});

/* ---------------------------------------------------------------------------
 * Toast, with Undo. Preferred over confirmation dialogs for routine actions.
 * ------------------------------------------------------------------------- */
const MAX_TOASTS = 2;

export function toast(message, { actionLabel, onAction, duration } = {}) {
  const root = toastRoot();
  // Never let a run of quick actions bury the screen in toasts.
  while (root.children.length >= MAX_TOASTS) root.firstElementChild.remove();
  const node = h("div", { class: "toast", role: "status" }, h("span", { class: "toast-msg", text: message }));
  let timeoutId;
  const dismiss = () => {
    clearTimeout(timeoutId);
    node.remove();
  };
  if (actionLabel && onAction) {
    node.append(
      h("button", {
        class: "toast-action",
        type: "button",
        text: actionLabel,
        onclick: () => {
          dismiss();
          onAction();
        },
      })
    );
  }
  root.append(node);
  timeoutId = setTimeout(dismiss, duration || (actionLabel ? 6000 : 3000));
  return dismiss;
}

/* ---------------------------------------------------------------------------
 * Numeric keypad. Used instead of the system keyboard: bigger targets, no
 * layout shift, and no keyboard covering the screen mid-set.
 * ------------------------------------------------------------------------- */
export function openNumberPad({ title, value, unit, allowDecimal = false, max = 9999, onSet }) {
  let buffer = value === null || value === undefined ? "" : formatNumber(value);
  let fresh = true; // the first key press replaces the starting value

  const display = h("div", { class: "pad-display" });
  const paint = () => {
    fill(
      display,
      h("span", { text: buffer === "" ? "0" : buffer }),
      unit ? h("span", { class: "stepper-unit", text: ` ${unit}` }) : null
    );
  };
  paint();

  const press = (key) => {
    haptic(8);
    if (fresh && /[0-9.]/.test(key)) {
      buffer = "";
      fresh = false;
    }
    if (key === "back") buffer = buffer.slice(0, -1);
    else if (key === ".") {
      if (!allowDecimal || buffer.includes(".")) return;
      buffer = (buffer || "0") + ".";
    } else {
      const next = buffer + key;
      if (Number(next) > max) return;
      buffer = next.replace(/^0(?=\d)/, "");
    }
    paint();
  };

  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", allowDecimal ? "." : "", "0", "back"];

  const sheet = openSheet({
    title,
    build: (close) =>
      h(
        "div",
        {},
        display,
        h(
          "div",
          { class: "pad-grid" },
          keys.map((key) =>
            key === ""
              ? h("span")
              : h(
                  "button",
                  {
                    class: "pad-key",
                    type: "button",
                    "aria-label": key === "back" ? "Delete" : key,
                    onclick: () => press(key),
                  },
                  key === "back" ? icon("back") : key
                )
          )
        ),
        h("div", { style: { height: "12px" } }),
        h("button", {
          class: "btn btn-primary btn-block btn-lg",
          type: "button",
          text: "Set",
          onclick: () => {
            const parsed = buffer === "" || buffer === "." ? 0 : Number(buffer);
            close();
            onSet(Number.isFinite(parsed) ? parsed : 0);
          },
        })
      ),
  });
  return sheet;
}

/* ---------------------------------------------------------------------------
 * Stepper: minus / value / plus. Tapping the value opens the keypad.
 * ------------------------------------------------------------------------- */
export function stepper({ label, value, unit, onStep, onPick, decimals = false }) {
  const valueButton = h(
    "button",
    {
      class: "stepper-value",
      type: "button",
      "aria-label": `${label}: ${formatNumber(value)}${unit ? ` ${unit}` : ""}. Tap to type a number.`,
      onclick: onPick,
    },
    h("span", { class: "stepper-num", text: formatNumber(value) }),
    unit ? h("span", { class: "stepper-unit", text: unit }) : null
  );

  return h(
    "div",
    { class: "field" },
    h("div", { class: "field-label", text: label }),
    h(
      "div",
      { class: "stepper" },
      h(
        "button",
        {
          class: "stepper-btn",
          type: "button",
          "aria-label": `Decrease ${label.toLowerCase()}`,
          onclick: () => {
            haptic(8);
            onStep(-1);
          },
        },
        icon("minus")
      ),
      valueButton,
      h(
        "button",
        {
          class: "stepper-btn",
          type: "button",
          "aria-label": `Increase ${label.toLowerCase()}`,
          onclick: () => {
            haptic(8);
            onStep(1);
          },
        },
        icon("plus")
      )
    )
  );
}

/* ---------------------------------------------------------------------------
 * Small form pieces
 * ------------------------------------------------------------------------- */
/** The whole row is the switch, so the tap target is the full width. */
export function switchRow({ label, hint, checked, onChange }) {
  const knob = h("span", { class: "switch", "aria-hidden": "true" });
  knob.setAttribute("aria-checked", String(Boolean(checked)));
  const row = h(
    "button",
    {
      class: "row row-switch",
      type: "button",
      role: "switch",
      "aria-checked": String(Boolean(checked)),
      onclick: () => {
        const next = row.getAttribute("aria-checked") !== "true";
        row.setAttribute("aria-checked", String(next));
        knob.setAttribute("aria-checked", String(next));
        onChange(next);
      },
    },
    h(
      "span",
      { class: "row-main" },
      h("span", { class: "row-title", text: label }),
      hint ? h("span", { class: "row-sub", text: hint }) : null
    ),
    knob
  );
  return row;
}

export function segmented({ label, options, value, onChange }) {
  const group = h("div", { class: "segmented", role: "group", "aria-label": label });
  for (const option of options) {
    group.append(
      h("button", {
        type: "button",
        text: option.label,
        "aria-pressed": String(option.value === value),
        onclick: () => onChange(option.value),
      })
    );
  }
  return group;
}

export function chipRow({ label, options, value, onChange, allowCustom, customLabel = "Custom", onCustom }) {
  const row = h("div", { class: "chips", role: "group", "aria-label": label });
  const known = options.some((option) => option.value === value);
  for (const option of options) {
    row.append(
      h("button", {
        class: "chip",
        type: "button",
        text: option.label,
        "aria-pressed": String(option.value === value),
        onclick: () => onChange(option.value),
      })
    );
  }
  if (allowCustom) {
    row.append(
      h("button", {
        class: "chip",
        type: "button",
        text: known ? customLabel : `${customLabel}: ${formatNumber(value)}`,
        "aria-pressed": String(!known),
        onclick: onCustom,
      })
    );
  }
  return row;
}

export function labelledField(label, control, hint) {
  return h(
    "div",
    { class: "field" },
    h("label", { class: "field-label", for: control.id || undefined, text: label }),
    control,
    hint ? h("div", { class: "field-hint", text: hint }) : null
  );
}

/* ---------------------------------------------------------------------------
 * Confirm sheet. Reserved for genuinely destructive things (Rule 9: routine
 * actions get an Undo toast instead).
 * ------------------------------------------------------------------------- */
export function confirmSheet({ title, message, confirmLabel = "Confirm", destructive = true, onConfirm }) {
  openSheet({
    title,
    build: (close) =>
      h(
        "div",
        {},
        h("p", { text: message, style: { marginBottom: "16px" } }),
        h("button", {
          class: `btn btn-block btn-lg ${destructive ? "btn-primary" : "btn-outline"}`,
          type: "button",
          text: confirmLabel,
          onclick: () => {
            close();
            onConfirm();
          },
        }),
        h("button", { class: "btn btn-quiet btn-block", type: "button", text: "Cancel", onclick: close })
      ),
  });
}

/** A sheet with a single text field, for notes and names. */
export function textSheet({ title, label, value = "", multiline = false, placeholder = "", saveLabel = "Save", onSave }) {
  let input;
  openSheet({
    title,
    build: (close) => {
      input = multiline
        ? h("textarea", { class: "textarea", placeholder, rows: "5" })
        : h("input", { class: "input", type: "text", placeholder });
      input.value = value;
      return h(
        "div",
        {},
        label ? h("div", { class: "field-label", text: label }) : null,
        input,
        h("div", { style: { height: "14px" } }),
        h("button", {
          class: "btn btn-primary btn-block btn-lg",
          type: "button",
          text: saveLabel,
          onclick: () => {
            const next = input.value;
            close();
            onSave(next);
          },
        })
      );
    },
  });
  setTimeout(() => input?.focus(), 60);
}

/** Menu of large rows, used for the More menu and similar. */
export function menuSheet({ title, items }) {
  openSheet({
    title,
    build: (close) =>
      h(
        "div",
        { class: "list", role: "list" },
        items
          .filter(Boolean)
          .map((item) =>
            h(
              "button",
              {
                class: "row",
                type: "button",
                onclick: () => {
                  close();
                  item.onSelect();
                },
              },
              item.icon ? h("span", { class: "row-chev" }, icon(item.icon)) : null,
              h(
                "span",
                { class: "row-main" },
                h("span", { class: "row-title", text: item.label }),
                item.hint ? h("span", { class: "row-sub", text: item.hint }) : null
              )
            )
          )
      ),
  });
}

export function emptyState({ image, title, message, action }) {
  return h(
    "div",
    { class: "empty" },
    image ? h("img", { src: image, alt: "", width: "140" }) : null,
    h("h2", { text: title, style: { fontSize: "1.1rem", marginBottom: "6px" } }),
    message ? h("p", { text: message }) : null,
    action ? h("div", { style: { marginTop: "16px" } }, action) : null
  );
}

/** The unit label to show beside a weight. */
export function unitLabel() {
  return state.settings.unit;
}
