import "./styles.css";
import { createCollection, validateCollection } from "./domain/collection.js";
import { loadCollection, saveCollection } from "./domain/storage.js";
import { loadReference } from "./providers/reference.js";
import { $, escape, download } from "./ui/helpers.js";
import { renderAdd, renderReview } from "./ui/add.js";
import { renderCollection } from "./ui/binders.js";
import { openCard } from "./ui/card.js";
import { renderCatalogue } from "./ui/catalogue.js";
const app = $("#app"),
  modal = $("#detail");
let storage,
  loaded,
  previousFocus,
  renderVersion = 0;
const ctx = {
  app,
  modal,
  view: "collection",
  currentRelease: null,
  page: 0,
  shelf: 0,
  filter: "all",
  list: false,
  exportRelease: null,
  exportMode: "need",
  state: null,
  review: false,
};
ctx.toast = (message, undo) => {
  const el = $("#toast");
  el.innerHTML =
    escape(message) + (undo ? ' <button id="undo">Undo</button>' : "");
  el.style.display = "block";
  clearTimeout(ctx.toast.timer);
  ctx.toast.timer = setTimeout(() => (el.style.display = "none"), 7000);
  if (undo)
    $("#undo").onclick = () => {
      if (undo() !== false) el.style.display = "none";
    };
};
ctx.save = (next, { recovery = false } = {}) => {
  if (loaded.error && !recovery) {
    ctx.toast("Saved data needs recovery. Import a valid backup in Catalogue.");
    return false;
  }
  try {
    const valid = validateCollection(next);
    saveCollection(storage, valid);
    ctx.state = valid;
    if (recovery) {
      loaded.error = null;
      $("#storage-warning").innerHTML = "";
    }
    return true;
  } catch (error) {
    ctx.toast(
      `Could not save: ${error.message}. Your saved collection is unchanged.`,
    );
    return false;
  }
};
ctx.hasStorageError = () => Boolean(loaded?.error);
ctx.change = (next, message, after = ctx.render, afterUndo = ctx.render) => {
  const before = structuredClone(ctx.state);
  if (!ctx.save(next)) return false;
  after();
  ctx.toast(message, () => {
    if (!ctx.save(before)) return false;
    afterUndo();
    return true;
  });
  return true;
};
ctx.openModal = () => {
  previousFocus = document.activeElement;
  modal.classList.remove("closing");
  modal.showModal();
};
ctx.closeModal = () => {
  modal.classList.add("closing");
  setTimeout(
    () => {
      modal.close();
      modal.classList.remove("closing");
      restoreFocus();
    },
    matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 150,
  );
};
function restoreFocus() {
  if (previousFocus?.isConnected) previousFocus.focus();
  else ctx.app.querySelector("button")?.focus();
}
modal.addEventListener("cancel", (e) => {
  e.preventDefault();
  ctx.closeModal();
});
modal.addEventListener("close", restoreFocus);
ctx.openCard = (id) => openCard(ctx, id);
ctx.render = () => {
  renderVersion++;
  document
    .querySelectorAll("[data-nav]")
    .forEach((b) => b.classList.toggle("selected", b.dataset.nav === ctx.view));
  if (ctx.view === "add") {
    if (ctx.review) renderReview(ctx);
    else renderAdd(ctx);
  } else if (ctx.view === "catalogue") renderCatalogue(ctx);
  else renderCollection(ctx);
};
ctx.navigate = (view) => {
  ctx.view = view;
  ctx.review = false;
  location.hash = view;
  ctx.render();
  window.scrollTo(0, 0);
};
ctx.openBinder = (id) => {
  ctx.currentRelease = id;
  ctx.page = 0;
  ctx.filter = "all";
  ctx.render();
  window.scrollTo(0, 0);
};
ctx.animateBinder = (id, cover) => {
  const version = renderVersion;
  cover.classList.add("opening-cover");
  setTimeout(
    () => {
      if (version === renderVersion) ctx.openBinder(id);
    },
    matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 280,
  );
};
try {
  const reference = await loadReference();
  try {
    storage = window.localStorage;
  } catch {
    storage = {
      getItem() {
        throw Error("Browser storage unavailable");
      },
      setItem() {
        throw Error("Browser storage unavailable");
      },
    };
  }
  loaded = loadCollection(storage, createCollection(reference));
  ctx.state = loaded.state;
  ctx.exportRelease = ctx.state.reference.releases[0]?.id;
  ctx.view = ["add", "collection", "catalogue"].includes(location.hash.slice(1))
    ? location.hash.slice(1)
    : "collection";
  if (loaded.error) {
    $("#storage-warning").innerHTML =
      `<div class="note storage-error">Saved data could not be opened: ${escape(loaded.error)}. It has been preserved. Use Catalogue to import a valid backup.${loaded.raw != null ? '<button id="recover-raw">Download saved data</button>' : ""}</div>`;
    if ($("#recover-raw"))
      $("#recover-raw").onclick = () =>
        download(loaded.raw, "card-ledger-recovery.json");
  }
  document
    .querySelectorAll("[data-nav]")
    .forEach((b) => (b.onclick = () => ctx.navigate(b.dataset.nav)));
  window.addEventListener("hashchange", () => {
    const view = location.hash.slice(1);
    if (
      ["add", "collection", "catalogue"].includes(view) &&
      view !== ctx.view
    ) {
      ctx.view = view;
      ctx.review = false;
      ctx.render();
    }
  });
  window.addEventListener("storage", (event) => {
    if (event.storageArea === storage && event.key === "cardledger-alpha-v1") {
      const fresh = loadCollection(storage, ctx.state);
      if (fresh.error || !event.newValue) {
        ctx.toast(
          "Saved collection changed in another tab. Reload before editing.",
        );
        loaded.error = "Changed in another tab";
        return;
      }
      ctx.state = fresh.state;
      modal.close();
      ctx.render();
      ctx.toast("Collection updated from another tab.");
    }
  });
  ctx.render();
} catch (error) {
  app.innerHTML = `<div class="panel"><h1>Reference unavailable</h1><p>${escape(error.message)}</p><button id="retry">Reload reference</button></div>`;
  $("#retry").onclick = () => location.reload();
}
