import "./styles.css";
import { createCollection, validateCollection } from "./domain/collection.js";
import {
  openDatabase,
  readCollection,
  loadCollection,
  saveCollection,
} from "./domain/storage.js";
import { loadReference } from "./providers/reference.js";
import { $, escape, download } from "./ui/helpers.js";
import { renderAdd, renderReview } from "./ui/add.js";
import { renderCollection } from "./ui/binders.js";
import { openCard } from "./ui/card.js";
import { renderCatalogue } from "./ui/catalogue.js";
const app = $("#app"),
  modal = $("#detail");
let storage,
  channel,
  pending = Promise.resolve(),
  loaded,
  previousFocus,
  focusSelector,
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
  if (modal.open) {
    const toast = $("#toast");
    clearTimeout(ctx.toast.timer);
    toast.style.display = "none";
    let feedback = modal.querySelector("#modal-feedback");
    if (!feedback) {
      feedback = document.createElement("div");
      feedback.id = "modal-feedback";
      feedback.className = "note";
      feedback.setAttribute("role", "status");
      modal.append(feedback);
    }
    feedback.textContent = message;
    feedback.scrollIntoView({ block: "nearest" });
    return;
  }
  const el = $("#toast");
  el.innerHTML =
    escape(message) + (undo ? ' <button id="undo">Undo</button>' : "");
  el.style.display = "block";
  clearTimeout(ctx.toast.timer);
  ctx.toast.timer = setTimeout(() => (el.style.display = "none"), 7000);
  if (undo)
    $("#undo").onclick = async () => {
      if ((await undo()) !== false) el.style.display = "none";
    };
};
// Evaluate updates in order, after earlier transactions have committed.
ctx.save = (update, { recovery = false } = {}) => {
  const operation = pending.then(async () => {
    if (loaded.error && !recovery) {
      ctx.toast(
        "Saved data needs recovery. Reload or import a valid backup in Catalogue.",
      );
      return false;
    }
    try {
      const next = typeof update === "function" ? update(ctx.state) : update;
      const valid = validateCollection(next);
      const revision = await saveCollection(storage, valid, loaded.revision, {
        recovery,
      });
      ctx.state = valid;
      loaded.revision = revision;
      if (recovery) {
        loaded.error = null;
        $("#storage-warning").innerHTML = "";
      }
      channel?.postMessage({ revision });
      return true;
    } catch (error) {
      if (error.code === "STALE_REVISION") loaded.error = error.message;
      ctx.toast(
        `Could not save: ${error.message}. Your saved collection is unchanged.`,
      );
      return false;
    }
  });
  pending = operation;
  return operation;
};
ctx.flush = () => pending;
ctx.hasStorageError = () => Boolean(loaded?.error);
ctx.change = async (
  update,
  message,
  after = ctx.render,
  afterUndo = ctx.render,
) => {
  if (ctx.changing) return false;
  ctx.changing = true;
  let before;
  try {
    const saved = await ctx.save((state) => {
      before = structuredClone(state);
      return typeof update === "function" ? update(state) : update;
    });
    if (!saved) return false;
    after();
    ctx.toast(message, async () => {
      if (!(await ctx.save(before))) return false;
      afterUndo();
      return true;
    });
    return true;
  } finally {
    ctx.changing = false;
  }
};
ctx.openModal = () => {
  previousFocus = document.activeElement;
  focusSelector = previousFocus?.dataset.card
    ? `[data-card="${CSS.escape(previousFocus.dataset.card)}"]`
    : previousFocus?.dataset.review
      ? `[data-review="${CSS.escape(previousFocus.dataset.review)}"]`
      : previousFocus?.id
        ? `#${CSS.escape(previousFocus.id)}`
        : null;
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
  else
    (
      (focusSelector && ctx.app.querySelector(focusSelector)) ||
      ctx.app.querySelector("button")
    )?.focus();
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
ctx.navigate = async (view) => {
  await pending;
  if (
    view === "add" &&
    ctx.currentRelease &&
    !ctx.state.draft.text.trim() &&
    !ctx.state.batch.length
  ) {
    const release = ctx.state.reference.releases.find(
      (r) => r.id === ctx.currentRelease,
    );
    if (release)
      await ctx.save((state) => ({
        ...state,
        draft: {
          ...state.draft,
          releaseId: release.id,
          language: release.language,
        },
      }));
  }
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
  let cached, databaseError;
  try {
    storage = await openDatabase();
    cached = await readCollection(storage);
  } catch (error) {
    databaseError = error;
  }
  const reference = cached?.state.reference || (await loadReference());
  if (!storage) {
    loaded = {
      state: createCollection(reference),
      error: databaseError.message,
      revision: 0,
    };
  } else {
    let legacy;
    try {
      legacy = window.localStorage;
    } catch {
      legacy = {
        getItem() {
          throw Error("Previous collection storage is unavailable");
        },
      };
    }
    loaded = await loadCollection(storage, legacy, createCollection(reference));
  }
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
  if (typeof BroadcastChannel !== "undefined" && storage) {
    channel = new BroadcastChannel("card-ledger-updates");
    channel.onmessage = () => {
      pending = pending.then(async () => {
        try {
          const fresh = await readCollection(storage);
          if (!fresh || fresh.revision <= loaded.revision) return;
          ctx.state = fresh.state;
          loaded.revision = fresh.revision;
          loaded.error = null;
          $("#storage-warning").innerHTML = "";
          if (modal.open) modal.close();
          ctx.render();
          ctx.toast("Collection updated from another tab.");
        } catch (error) {
          loaded.error = error.message;
          ctx.toast("Saved collection needs recovery. Reload before editing.");
        }
      });
    };
  }
  ctx.render();
} catch (error) {
  app.innerHTML = `<div class="panel"><h1>Reference unavailable</h1><p>${escape(error.message)}</p><button id="retry">Reload reference</button></div>`;
  $("#retry").onclick = () => location.reload();
}
