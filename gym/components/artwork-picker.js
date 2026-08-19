// Pick an exercise from the artwork that ships with the app.
//
// The alternative is remembering that the picture is called
// "goblet-box-squat" and typing a name that matches it exactly. Choosing from
// a list of pictures is both quicker and impossible to get wrong.
import { h } from "../js/utils.js";
import { openSheet, emptyState } from "./controls.js";
import { bundledArtworkList, imageEl, PLACEHOLDERS } from "./image.js";

/**
 * @param {object} options
 * @param {string} options.title
 * @param {(choice: {slug, file, label}) => void} options.onSelect
 * @param {{label: string, onSelect: () => void}} [options.blank] an escape hatch
 *   for an exercise with no artwork
 */
export function openArtworkPicker({ title = "Choose an exercise", onSelect, blank }) {
  const artwork = bundledArtworkList();

  openSheet({
    title,
    full: artwork.length > 4,
    build: (close) =>
      h(
        "div",
        {},
        artwork.length
          ? h(
              "ul",
              { class: "list", role: "list" },
              artwork.map((choice) =>
                h(
                  "li",
                  {},
                  h(
                    "button",
                    {
                      class: "row artwork-row",
                      type: "button",
                      onclick: () => {
                        close();
                        onSelect(choice);
                      },
                    },
                    h(
                      "span",
                      { class: "artwork-thumb" },
                      imageEl(choice.file, { alt: "", placeholder: PLACEHOLDERS.exercise })
                    ),
                    h(
                      "span",
                      { class: "row-main" },
                      h("span", { class: "row-title", text: choice.label })
                    )
                  )
                )
              )
            )
          : emptyState({
              image: PLACEHOLDERS.empty,
              title: "No artwork yet",
              message: "Pictures added to assets/exercises appear here.",
            }),
        blank
          ? h(
              "div",
              {},
              h("div", { class: "divider" }),
              h("button", {
                class: "btn btn-outline btn-block btn-lg",
                type: "button",
                text: blank.label,
                onclick: () => {
                  close();
                  blank.onSelect();
                },
              })
            )
          : null
      ),
  });
}
