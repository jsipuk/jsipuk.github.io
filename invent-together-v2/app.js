/* Invent Together V2.
   Behaviour changes from V1, all driven by the review:
   - nothing is lost by accident (unload guard + opt-in draft)
   - the child gets an output of their own (poster + read aloud)
   - an empty form cannot produce a confident empty brief
   - feedback is inline and announced, not five browser alerts
   - buildSummary is pure; rendering is separate */

(function () {
  "use strict";

  var DRAFT_KEY = "invent-together-v2";

  var TEXT_FIELDS = [
    "inventor", "bigIdea", "thingName", "thingType", "appearance", "special",
    "home", "playerDoes", "goal", "challenge", "reward", "world", "funny",
    "difficulty", "sounds", "mustHave", "learningIdea", "quotes", "extra"
  ];

  /* Fields that count towards "has anything actually been answered", i.e.
     everything except the inventor's own name. A name alone is not an idea. */
  var CONTENT_FIELDS = TEXT_FIELDS.filter(function (id) { return id !== "inventor"; });

  var form = document.getElementById("ideaForm");
  var body = document.body;
  var settled = false;
  var lastBrief = "";

  /* ---------- small helpers ---------- */

  function el(id) { return document.getElementById(id); }

  function val(id) {
    var node = el(id);
    return node ? (node.value || "").trim() : "";
  }

  function radio(name) {
    var node = form.querySelector('input[name="' + name + '"]:checked');
    return node ? node.value : "";
  }

  function checks(name) {
    return Array.prototype.slice
      .call(form.querySelectorAll('input[name="' + name + '"]:checked'))
      .map(function (n) { return n.value; });
  }

  function say(id, message, isWarning) {
    var node = el(id);
    if (!node) return;
    node.textContent = message || "";
    node.classList.toggle("is-warn", !!isWarning);
  }

  function slug(text) {
    return (text || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40);
  }

  function today() {
    var d = new Date();
    return d.getFullYear() + "-" +
      String(d.getMonth() + 1).padStart(2, "0") + "-" +
      String(d.getDate()).padStart(2, "0");
  }

  function longDate() {
    try {
      return new Date().toLocaleDateString("en-GB", {
        day: "numeric", month: "long", year: "numeric"
      });
    } catch (e) {
      return today();
    }
  }

  /* ---------- state ---------- */

  function collect() {
    var data = { direction: radio("direction"), learning: checks("learning") };
    TEXT_FIELDS.forEach(function (id) { data[id] = val(id); });
    return data;
  }

  function answeredCount() {
    var n = 0;
    CONTENT_FIELDS.forEach(function (id) { if (val(id)) n++; });
    if (radio("direction")) n++;
    if (checks("learning").length) n++;
    return n;
  }

  function isDirty() {
    return answeredCount() > 0 || !!val("inventor");
  }

  function visibleQuestionCount() {
    var quick = body.classList.contains("mode-quick");
    var nodes = form.querySelectorAll("textarea, input[type=text], select");
    var n = 0;
    Array.prototype.forEach.call(nodes, function (node) {
      if (node.id === "inventor") return;
      if (quick && node.closest("[data-optional]")) return;
      n++;
    });
    return n + 1; /* + the direction choice */
  }

  function visibleAnswered() {
    var quick = body.classList.contains("mode-quick");
    var nodes = form.querySelectorAll("textarea, input[type=text], select");
    var n = 0;
    Array.prototype.forEach.call(nodes, function (node) {
      if (node.id === "inventor") return;
      if (quick && node.closest("[data-optional]")) return;
      if ((node.value || "").trim()) n++;
    });
    if (radio("direction")) n++;
    return n;
  }

  function updateProgress() {
    var total = visibleQuestionCount();
    var done = visibleAnswered();
    var pct = total ? Math.round((done / total) * 100) : 0;
    var fill = el("progressFill");
    if (fill) fill.style.width = pct + "%";

    var text = el("progressText");
    if (!text) return;
    if (done === 0) {
      text.textContent = "Nothing answered yet";
    } else if (done >= total) {
      text.textContent = "All " + total + " answered — ready to make it";
    } else {
      text.textContent = done + " of " + total + " answered";
    }
  }

  function markSettled() {
    if (settled) return;
    settled = true;
    body.classList.add("settled");
  }

  /* ---------- quick / full mode ---------- */

  function setMode(mode) {
    var quick = mode === "quick";
    body.classList.toggle("mode-quick", quick);
    Array.prototype.forEach.call(document.querySelectorAll(".mode"), function (btn) {
      var on = btn.getAttribute("data-mode") === mode;
      btn.classList.toggle("is-on", on);
      btn.setAttribute("aria-pressed", String(on));
    });
    updateProgress();
  }

  /* ---------- the brief (pure) ---------- */

  function line(label, value) {
    return value ? label + ": " + value + "\n" : "";
  }

  function buildSummary(data) {
    var out = "Build this as a small web app or game. The ideas below came from a child. " +
      "Follow the build guardrails at the end exactly.\n\n";
    out += "CHILD-DIRECTED APP / WEBSITE DISCOVERY BRIEF\n";
    out += "Captured " + longDate() + (data.inventor ? " with " + data.inventor : "") + "\n\n";

    out += line("Starting direction", data.direction);
    out += line("Big idea", data.bigIdea);

    var creation = line("Name", data.thingName) + line("Type", data.thingType) +
      line("Appearance", data.appearance) + line("Special feature / ability", data.special) +
      line("Where it belongs", data.home);
    if (creation) out += "\nFIRST CREATION\n" + creation;

    var core = line("What the user does", data.playerDoes) + line("Goal", data.goal) +
      line("Challenge", data.challenge) + line("Success / reward", data.reward);
    if (core) out += "\nCORE EXPERIENCE\n" + core;

    var style = line("World", data.world) + line("Tone", data.funny) +
      line("Difficulty", data.difficulty) + line("Sounds", data.sounds) +
      line("Must-have feature", data.mustHave);
    if (style) out += "\nSTYLE & WORLD\n" + style;

    var learning = line("Possible learning themes", data.learning.join(", ")) +
      line("Learning idea", data.learningIdea);
    if (learning) out += "\nLEARNING\n" + learning;

    var raw = line("Exact quotes", data.quotes) + line("Other observations / ideas", data.extra);
    if (raw) out += "\nRAW CHILD INPUT\n" + raw;

    out += "\nBUILD GUARDRAILS\n";
    out += "- Child directs the concept; adult operates the computer.\n";
    out += "- Original characters and world only; do not copy copyrighted IP.\n";
    out += "- Prefer offline drawing and invention before screen interaction.\n";
    out += "- No adverts, social mechanics, loot boxes, streaks or endless-play loops.\n";
    out += "- First version should be extremely small and testable.\n";
    out += "- Preserve unusual wording and ideas from the child rather than polishing them away.\n";

    return out.trim();
  }

  /* ---------- the poster (the output the child gets) ---------- */

  var POSTER_FACTS = [
    ["appearance", "What it looks like"],
    ["special", "What is special"],
    ["home", "Where it lives"],
    ["playerDoes", "What you do"],
    ["sounds", "Noises it makes"],
    ["mustHave", "Must not forget"]
  ];

  function posterName(data) {
    if (data.thingName) return data.thingName;
    if (data.bigIdea) {
      var words = data.bigIdea.split(/\s+/).slice(0, 6).join(" ");
      return words + (data.bigIdea.split(/\s+/).length > 6 ? "…" : "");
    }
    return "Our invention";
  }

  function renderPoster(data) {
    var name = posterName(data);
    el("posterName").textContent = name;
    el("posterEyebrow").textContent = data.thingType || data.direction || "An invention";
    el("posterBy").textContent = data.inventor ? "Invented by " + data.inventor : "Invented together";
    el("posterDate").textContent = longDate();

    var quote = el("posterQuote");
    var firstQuote = (data.quotes || "").split("\n")[0].trim();
    if (firstQuote) {
      quote.textContent = "“" + firstQuote.replace(/^["“”']+|["“”']+$/g, "") + "”";
      quote.hidden = false;
    } else {
      quote.hidden = true;
    }

    var facts = el("posterFacts");
    facts.textContent = "";
    POSTER_FACTS.forEach(function (pair) {
      var value = data[pair[0]];
      if (!value) return;
      var wrap = document.createElement("div");
      var dt = document.createElement("dt");
      dt.textContent = pair[1];
      var dd = document.createElement("dd");
      dd.textContent = value;
      wrap.appendChild(dt);
      wrap.appendChild(dd);
      facts.appendChild(wrap);
    });

    return name;
  }

  function posterSpeech(data, name) {
    var parts = [];
    parts.push(data.inventor ? data.inventor + " invented " + name + "." : "We invented " + name + ".");
    if (data.appearance) parts.push("It looks like " + data.appearance + ".");
    if (data.special) parts.push("What is special about it: " + data.special + ".");
    if (data.home) parts.push("It lives in " + data.home + ".");
    if (data.playerDoes) parts.push("In the game you " + data.playerDoes + ".");
    if (data.sounds) parts.push("It sounds like " + data.sounds + ".");
    parts.push("What a good idea.");
    return parts.join(" ");
  }

  /* ---------- generate ---------- */

  function generate() {
    var data = collect();

    if (answeredCount() === 0) {
      say("status", "Answer at least one question first, then press this again.", true);
      return;
    }

    lastBrief = buildSummary(data);
    el("summary").textContent = lastBrief;
    var name = renderPoster(data);

    var results = el("results");
    results.hidden = false;
    showTab("poster");
    say("status", "");
    say("posterStatus", "");
    say("briefStatus", "");

    results.scrollIntoView({ behavior: "smooth", block: "start" });
    el("readButton").focus({ preventScroll: true });
    return name;
  }

  function showTab(which) {
    var poster = which === "poster";
    el("tabPoster").classList.toggle("is-on", poster);
    el("tabBrief").classList.toggle("is-on", !poster);
    el("tabPoster").setAttribute("aria-selected", String(poster));
    el("tabBrief").setAttribute("aria-selected", String(!poster));
    el("panelPoster").hidden = !poster;
    el("panelBrief").hidden = poster;
  }

  /* ---------- output actions ---------- */

  function copyBrief() {
    if (!lastBrief) { say("briefStatus", "Make the invention first.", true); return; }
    if (!navigator.clipboard) {
      say("briefStatus", "Copying is not available here — select the text and copy it by hand.", true);
      return;
    }
    navigator.clipboard.writeText(lastBrief).then(function () {
      say("briefStatus", "Copied. Paste it into ChatGPT or Codex.");
    }, function () {
      say("briefStatus", "The browser blocked copying — select the text and copy it by hand.", true);
    });
  }

  function downloadBrief() {
    if (!lastBrief) { say("briefStatus", "Make the invention first.", true); return; }
    var name = slug(val("thingName")) || "invention";
    var blob = new Blob([lastBrief], { type: "text/plain" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = name + "-" + today() + ".txt";
    a.click();
    URL.revokeObjectURL(url);
    say("briefStatus", "Saved as " + a.download);
  }

  function readAloud() {
    var synth = window.speechSynthesis;
    if (!synth) {
      say("posterStatus", "This browser cannot read aloud. The poster still prints.", true);
      return;
    }
    if (synth.speaking) {
      synth.cancel();
      say("posterStatus", "Stopped.");
      return;
    }
    var data = collect();
    var utterance = new SpeechSynthesisUtterance(posterSpeech(data, posterName(data)));
    utterance.rate = 0.92;
    utterance.pitch = 1.05;
    utterance.onend = function () { say("posterStatus", ""); };
    synth.speak(utterance);
    say("posterStatus", "Reading it out. Press again to stop.");
  }

  /* ---------- draft storage (opt in, never automatic) ---------- */

  function storageAvailable() {
    try {
      window.localStorage.setItem("__t", "1");
      window.localStorage.removeItem("__t");
      return true;
    } catch (e) {
      return false;
    }
  }

  function saveDraft() {
    if (!el("draftToggle").checked || !storageAvailable()) return;
    try {
      window.localStorage.setItem(DRAFT_KEY, JSON.stringify({
        saved: new Date().toISOString(),
        data: collect()
      }));
      say("draftState", "");
      el("draftState").textContent = "On. Saved on this device only. Delete it whenever you like.";
    } catch (e) {
      el("draftState").textContent = "On, but this device refused to store it.";
    }
  }

  function loadDraft() {
    if (!storageAvailable()) return false;
    var raw = window.localStorage.getItem(DRAFT_KEY);
    if (!raw) return false;
    var parsed;
    try { parsed = JSON.parse(raw); } catch (e) { return false; }
    if (!parsed || !parsed.data) return false;

    var data = parsed.data;
    TEXT_FIELDS.forEach(function (id) {
      var node = el(id);
      if (node && data[id]) node.value = data[id];
    });
    if (data.direction) {
      var r = form.querySelector('input[name="direction"][value="' + CSS.escape(data.direction) + '"]');
      if (r) r.checked = true;
    }
    (data.learning || []).forEach(function (v) {
      var c = form.querySelector('input[name="learning"][value="' + CSS.escape(v) + '"]');
      if (c) c.checked = true;
    });

    el("draftToggle").checked = true;
    el("deleteDraft").hidden = false;
    el("draftState").textContent = "On. Restored the draft saved on this device.";
    return true;
  }

  function deleteDraft(announce) {
    try { window.localStorage.removeItem(DRAFT_KEY); } catch (e) { /* nothing to do */ }
    el("deleteDraft").hidden = true;
    if (announce) {
      el("draftState").textContent = el("draftToggle").checked
        ? "On. Nothing saved yet."
        : "Off. Nothing is stored. Closing this page loses the answers.";
    }
  }

  function onDraftToggle() {
    if (el("draftToggle").checked) {
      el("deleteDraft").hidden = false;
      saveDraft();
    } else {
      deleteDraft(false);
      el("draftState").textContent = "Off. Nothing is stored. Closing this page loses the answers.";
    }
  }

  /* ---------- clear ---------- */

  function clearAll() {
    if (!isDirty()) { say("status", "There is nothing to clear yet."); return; }
    if (!window.confirm("Start again? This clears every answer.")) return;
    form.reset();
    deleteDraft(false);
    el("draftToggle").checked = false;
    el("draftState").textContent = "Off. Nothing is stored. Closing this page loses the answers.";
    el("deleteDraft").hidden = true;
    lastBrief = "";
    el("results").hidden = true;
    say("status", "");
    updateProgress();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  /* ---------- share ---------- */

  function share() {
    var payload = {
      title: "Invent Together",
      text: "A child-led idea discovery form for inventing something together.",
      url: window.location.href
    };
    if (navigator.share) {
      navigator.share(payload).catch(function () { /* dismissed, or unavailable */ });
      return;
    }
    if (navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href).then(function () {
        say("status", "Link copied.");
      }, function () {
        say("status", "Copy the address from the address bar to share it.", true);
      });
      return;
    }
    say("status", "Copy the address from the address bar to share it.", true);
  }

  /* ---------- chips ---------- */

  function addChip(button) {
    var group = button.closest("[data-chips-for]");
    if (!group) return;
    var target = el(group.getAttribute("data-chips-for"));
    if (!target) return;

    var current = target.value.trim();
    var word = button.textContent.trim();
    target.value = current ? current.replace(/[,\s]+$/, "") + ", " + word : word;

    button.classList.add("just-added");
    window.setTimeout(function () { button.classList.remove("just-added"); }, 550);

    markSettled();
    updateProgress();
    saveDraft();
  }

  /* ---------- wiring ---------- */

  var ACTIONS = {
    generate: generate,
    copy: copyBrief,
    download: downloadBrief,
    readaloud: readAloud,
    print: function () { window.print(); },
    clear: clearAll,
    share: share,
    reveal: function () { setMode("full"); },
    deletedraft: function () { deleteDraft(true); }
  };

  document.addEventListener("click", function (event) {
    var chip = event.target.closest(".chip");
    if (chip) { addChip(chip); return; }

    var mode = event.target.closest(".mode");
    if (mode) { setMode(mode.getAttribute("data-mode")); return; }

    var tab = event.target.closest(".tab");
    if (tab) { showTab(tab.id === "tabPoster" ? "poster" : "brief"); return; }

    var actor = event.target.closest("[data-action]");
    if (!actor) return;
    var fn = ACTIONS[actor.getAttribute("data-action")];
    if (fn) fn();
  });

  form.addEventListener("submit", function (event) { event.preventDefault(); });

  form.addEventListener("input", function () {
    markSettled();
    updateProgress();
    saveDraft();
  });

  form.addEventListener("change", function () {
    markSettled();
    updateProgress();
    saveDraft();
  });

  el("draftToggle").addEventListener("change", onDraftToggle);

  /* The guard V1 did not have. Only nags when there is something to lose and
     no draft is being kept. */
  window.addEventListener("beforeunload", function (event) {
    if (!isDirty() || el("draftToggle").checked) return;
    event.preventDefault();
    event.returnValue = "";
  });

  /* ---------- start ---------- */

  setMode("quick");
  if (loadDraft()) {
    markSettled();
    setMode("full");
  }
  updateProgress();

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("sw.js").catch(function () { /* offline is a bonus */ });
    });
  }
}());
