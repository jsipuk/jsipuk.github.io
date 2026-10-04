/*
 * The welcome demo, as a pure function of time.
 *
 * render(t) draws frame t (seconds) from scratch-ish: nothing depends on the
 * previous frame except a cache of the phone's markup. That makes the export
 * deterministic: demo/render.mjs calls render(frame / FPS) and screenshots.
 *
 * The phone screen is an iframe styled by the site's real globals.css at a
 * real 390px width, so it looks exactly like the site on a phone.
 */

const DURATION = 30
const DATA = window.DEMO_DATA
const URL_TEXT = window.DEMO_URL

/* ───────── easing and helpers ───────── */

const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x))
const ease = (x) => 1 - Math.pow(1 - clamp(x), 3) // ease-out cubic
const easeInOut = (x) => {
  x = clamp(x)
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2
}
/** 0→1 over [start, start + dur]. */
const prog = (t, start, dur) => clamp((t - start) / dur)
/** Fade in at `a`, out at `b`. */
const window01 = (t, a, b, fin = 0.35, fout = 0.3) => Math.min(ease(prog(t, a, fin)), 1 - ease(prog(t, b - fout, fout)))
const lerp = (a, b, x) => a + (b - a) * x
const $ = (id) => document.getElementById(id)

/* ───────── the script ───────── */

const QUESTIONS = [
  { q: "How much are you happy to spend?", opts: ["Nothing", "Up to £10", "Up to £25", "Up to £50", "Custom"], pick: [1], start: 5.2, taps: [5.95] },
  { q: "How much time have you got?", opts: ["15 mins", "About an hour", "A couple of hours", "Half a day", "All day"], pick: [1], start: 6.35, taps: [7.05] },
  { q: "Who’s involved?", opts: ["Just me", "Me + partner", "Friend(s)", "Family"], pick: [0], start: 7.5, taps: [8.15] },
  { q: "How much effort have you got in you?", opts: ["Basically none", "Not much", "I’m alright", "I need to move"], pick: [1], start: 8.6, taps: [9.25] },
  {
    q: "What would help most?",
    hint: "Pick one or two.",
    opts: ["Comfort me", "Distract me", "Make me laugh", "Get me outside", "Give me something to do", "Help me feel accomplished", "Get me around people", "Show me something new", "Surprise me"],
    pick: [2, 3],
    start: 9.7,
    taps: [10.35, 10.85],
    next: 11.4,
  },
  { q: "Where are we doing this?", opts: ["Stay home", "Get me out", "Either"], pick: [1], start: 11.85, taps: [12.45], go: 13.05 },
]
const LEANS = ["Buy something", "Go somewhere", "Make something", "Do something", "Learn something", "No preference"]
const TOKENS = [
  [5.95, "£10"],
  [7.05, "an hour"],
  [8.15, "just me"],
  [9.25, "not much energy"],
  [10.35, "a laugh"],
  [10.85, "outside"],
  [12.45, "out and about"],
]

const T = {
  landingTap: 4.85,
  results: 13.5,
  nahTap: 20.75,
  saveTap: 23.95,
  doTap: 25.05,
  phoneIn: 3.3,
  phoneOut: 27.2,
}

/** Every tap: when, and how to find what was tapped. */
const TAPS = [
  { t: T.landingTap, find: () => byText(".btn-go", "Find me something") },
  ...QUESTIONS.flatMap((q) => [
    ...q.taps.map((t, i) => ({ t, find: () => byText(".chip", q.opts[q.pick[i]]) })),
    ...(q.next ? [{ t: q.next, find: () => byText(".btn-go", "Next") }] : []),
    ...(q.go ? [{ t: q.go, find: () => byText(".btn-go", "Show me three") }] : []),
  ]),
  { t: T.nahTap, find: () => sdoc().querySelector(".rec-2 .btn-quiet") },
  { t: T.saveTap, find: () => sdoc().querySelector(".rec-2 .btn-line") },
  { t: T.doTap, find: () => sdoc().querySelector(".rec-2 .btn-go") },
]

/* ───────── phone screen markup (mirrors the real components) ───────── */

const sdoc = () => $("screen").contentDocument
const byText = (sel, text) => [...sdoc().querySelectorAll(sel)].find((el) => el.textContent.replace("✓", "").trim() === text)
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;")

const header = (saved) => `
  <header class="site-header">
    <a class="wordmark">not feeling <em>you</em></a>
    <a class="header-link">Saved${saved ? '<span class="count"> (1)</span>' : ""}</a>
  </header>`

const chip = (label, on) =>
  `<button type="button" class="chip" aria-pressed="${on}"><span class="chip-tick" aria-hidden="true">${on ? "✓" : ""}</span>${esc(label)}</button>`

function landing() {
  return `<div class="landing">
    <h1 class="title">What to do when you’re not feeling <em>you</em></h1>
    <p class="lede">A few questions. Three ideas. No life coaching.</p>
    <div class="landing-actions">
      <button type="button" class="btn btn-go btn-big">Find me something</button>
      <a class="text-link">Just surprise me</a>
    </div>
    <p class="aside">You feel a bit rubbish. That’s enough information. Let’s find something to do.</p>
  </div>`
}

function question(i, t) {
  const q = QUESTIONS[i]
  const picked = q.pick.filter((_, k) => t >= q.taps[k])
  const choices = q.opts.map((o, k) => chip(o, picked.includes(k))).join("")
  let footer = ""
  if (q.next) footer = `<div class="step-next"><button type="button" class="btn btn-go" ${picked.length ? "" : "disabled"}>Next</button></div>`
  if (q.go)
    footer = `<h3 class="subquestion">Anything you’re leaning towards? <span class="optional">Optional</span></h3>
      <div class="choices choices-small">${LEANS.map((l) => chip(l, false)).join("")}</div>
      <div class="step-next"><button type="button" class="btn btn-go btn-big" ${picked.length ? "" : "disabled"}>Show me three</button></div>`
  return `<div class="flow">
    <div class="flow-top">
      <button type="button" class="text-btn back">← Back</button>
      <div class="progress"><div class="progress-track"><div class="progress-fill" style="width:${((i + 1) / 6) * 100}%"></div></div><span class="progress-label">${i + 1} of 6</span></div>
    </div>
    <div class="step-wrap"><section class="step">
      <h2 class="question">${esc(q.q)}</h2>
      ${q.hint ? `<p class="hint">${esc(q.hint)}</p>` : ""}
      <div class="choices">${choices}</div>
      ${footer}
    </section></div>
  </div>`
}

const LABELS = ["The obvious one", "Something different", "Wildcard"]

function recCard(i, c, s) {
  const actions = s.committed
    ? `<div class="committed" role="status"><p class="committed-head">Go on then.</p><p>Close this tab and go. Tell someone you’re doing it; it’s harder to back out.</p><button type="button" class="text-btn">Actually, back to the three</button></div>`
    : `<div class="card-actions">
        <button type="button" class="btn btn-quiet">Nah</button>
        <button type="button" class="btn btn-line" aria-pressed="${i === 2 && s.saved}">${i === 2 && s.saved ? "Saved ✓" : "Save this"}</button>
        <button type="button" class="btn btn-go">Let’s do it</button>
      </div>`
  return `<article class="rec rec-${i}">
    <p class="rec-label"><span class="rec-num">0${i}</span> ${LABELS[i - 1]}</p>
    <div class="rec-body">
      <h2 class="rec-title">${esc(c.title)}</h2>
      <p class="rec-meta">${esc(c.meta)}</p>
      <p class="rec-summary">${esc(c.summary)}</p>
      <dl class="rec-notes">
        <div><dt>Why this fits</dt><dd>${esc(c.why)}</dd></div>
        ${c.better ? `<div><dt>Make it better</dt><dd>${esc(c.better)}</dd></div>` : ""}
      </dl>
      ${actions}
    </div>
  </article>`
}

function results(s) {
  const cards = [DATA.cards[0], s.nah ? DATA.nah : DATA.cards[1], DATA.cards[2]]
  const list = cards.map((c, k) => (s.committed && k !== 1 ? "" : recCard(k + 1, c, s))).join("")
  return `<div class="results">
    <header class="results-head">
      <h1 class="results-title">Right. Here are three.</h1>
      <p class="results-context">${esc(DATA.context)}. <a class="text-link">Change answers</a></p>
    </header>
    <div class="rec-list">${list}</div>
    <footer class="small-print"><p>Feeling a lot worse than “a bit off”? Samaritans are free, any time, on <a>116&nbsp;123</a>.</p></footer>
  </div>`
}

/** Discrete phone state at time t. */
function phoneState(t) {
  if (t < QUESTIONS[0].start) return { screen: "landing" }
  if (t < T.results) {
    let i = QUESTIONS.length - 1
    while (i > 0 && t < QUESTIONS[i].start) i--
    const q = QUESTIONS[i]
    return { screen: "q", i, picks: q.taps.filter((x) => t >= x).length }
  }
  return {
    screen: "results",
    nah: t >= T.nahTap + 0.2,
    saved: t >= T.saveTap,
    committed: t >= T.doTap + 0.12,
  }
}

let lastKey = ""
function drawPhone(t) {
  const s = phoneState(t)
  const key = JSON.stringify(s)
  const page = sdoc().getElementById("page")
  if (key !== lastKey) {
    const body = s.screen === "landing" ? landing() : s.screen === "q" ? question(s.i, t) : results(s)
    page.innerHTML = header(s.saved) + `<main id="main">${body}</main>`
    lastKey = key
  }

  // Question steps slide in, and the progress line grows, as on the site.
  if (s.screen === "q") {
    const q = QUESTIONS[s.i]
    const x = ease(prog(t, q.start, 0.22))
    const wrap = sdoc().querySelector(".step-wrap")
    wrap.style.opacity = x
    wrap.style.transform = `translateY(${(1 - x) * 8}px)`
    const fill = sdoc().querySelector(".progress-fill")
    fill.style.width = `${lerp(s.i, s.i + 1, ease(prog(t, q.start, 0.22))) * (100 / 6)}%`
  }

  // Results: cards rise in, then the page scrolls through them.
  if (s.screen === "results") {
    const cards = [...sdoc().querySelectorAll(".rec")]
    cards.forEach((el, k) => {
      const x = ease(prog(t, T.results + 0.2 + k * 0.18, 0.3))
      el.style.opacity = s.committed ? 1 : x
      el.style.transform = s.committed ? "" : `translateY(${(1 - x) * 14}px)`
    })
    const head = sdoc().querySelector(".results-head")
    head.style.opacity = ease(prog(t, T.results, 0.25))

    // The swapped card fades through.
    if (t >= T.nahTap && t < T.nahTap + 0.6) {
      const body = sdoc().querySelector(".rec-2 .rec-body")
      const out = prog(t, T.nahTap, 0.2)
      const inn = ease(prog(t, T.nahTap + 0.2, 0.3))
      body.style.opacity = t < T.nahTap + 0.2 ? 1 - out : inn
      body.style.transform = t < T.nahTap + 0.2 ? "" : `translateY(${(1 - inn) * 6}px)`
    }
  }

  // Whole pixels only: half-pixel offsets blur the text.
  page.style.transform = `translateY(${-Math.round(scrollAt(t, s))}px)`
  // A quick dip when "Let's do it" collapses the list, as the site jumps to the top.
  page.style.opacity = s.screen === "results" ? 1 - 0.85 * Math.max(0, 1 - Math.abs(t - (T.doTap + 0.12)) / 0.15) : 1
}

/** Where a card sits on the page, for scrolling to it. */
function topOf(sel, offset = 0) {
  const el = sdoc().querySelector(sel)
  const page = sdoc().getElementById("page")
  if (!el) return 0
  return el.getBoundingClientRect().top - page.getBoundingClientRect().top + offset
}

const maxScroll = () => Math.max(0, sdoc().getElementById("page").scrollHeight - 844)

function scrollAt(t, s) {
  if (s.screen !== "results" || s.committed) return 0
  const keys = [
    { t: 15.5, to: () => topOf(".rec-2", -28) },
    { t: 17.3, to: () => topOf(".rec-3", -28) },
    { t: 19.15, to: () => topOf(".rec-2 .card-actions", -600) },
  ]
  let y = 0
  for (const k of keys) {
    if (t < k.t) break
    const target = Math.min(maxScroll(), Math.max(0, k.to()))
    y = lerp(y, target, easeInOut(prog(t, k.t, 0.75)))
  }
  return y
}

/* ───────── stage: titles, captions, phone, taps ───────── */

function setStyle(el, opacity, dy = 0, extra = "") {
  el.style.opacity = opacity
  el.style.transform = `translateY(${dy}px) ${extra}`
}

function drawTitle(t) {
  const out = ease(prog(t, 3.15, 0.4))
  const lines = [
    ["t1", 0.15],
    ["t2", 0.55],
    ["t3", 1.0],
    ["t4", 1.9],
  ]
  for (const [id, at] of lines) {
    const x = ease(prog(t, at, 0.55))
    setStyle($(id), x * (1 - out), (1 - x) * 26 - out * 24)
  }
  const draw = easeInOut(prog(t, 1.45, 0.5))
  const path = $("t3-line")
  const len = path.getTotalLength()
  path.style.strokeDasharray = `${len}`
  path.style.strokeDashoffset = `${len * (1 - draw)}`
  $("title-card").style.visibility = t < 3.6 ? "visible" : "hidden"
}

const CAPTIONS = [
  {
    from: 3.75, to: 13.35, num: "01", title: "Tell it what you’ve got.", sub: "Six quick taps. No forms. No sign-up.",
    extra: (t) => `<div class="tokens">${TOKENS.filter(([at]) => t >= at).map(([at, w]) => `<span class="token" style="${tokenStyle(t, at)}">${w}</span>`).join("")}</div>`,
  },
  {
    from: 13.45, to: 19.7, num: "02", title: "Get three things you could actually do.", sub: null,
    extra: (t) => {
      const on = t < 15.6 ? 0 : t < 17.4 ? 1 : 2
      return `<div class="labels">${LABELS.map((l, k) => {
        const lit = k === on && t >= 13.9
        const x = ease(prog(t, 13.75 + k * 0.15, 0.35))
        return `<div class="label${lit ? " on" : ""}" style="opacity:${x};transform:translateY(${(1 - x) * 10}px)"><span class="n">0${k + 1}</span>${l}<span class="bar" style="width:${lit ? 60 * ease(prog(t, [13.9, 15.6, 17.4][k], 0.4)) : 0}px"></span></div>`
      }).join("")}</div>`
    },
  },
  { from: 19.8, to: 23.65, num: "03", title: "Not for you? Say Nah.", sub: "Only that card changes. The other two stay put." },
  { from: 23.75, to: 27.25, num: "04", title: "Save it for later. Or just go.", sub: "Saved ideas stay on your phone. No account." },
]

function tokenStyle(t, at) {
  const x = ease(prog(t, at, 0.3))
  return `opacity:${x};transform:translateY(${(1 - x) * 10}px)`
}

function drawCaptions(t) {
  const html = CAPTIONS.filter((c) => t >= c.from && t < c.to)
    .map((c) => {
      const x = window01(t, c.from, c.to)
      const dy = (1 - ease(prog(t, c.from, 0.4))) * 20
      return `<div class="cap" style="opacity:${x};transform:translateY(calc(-50% + ${dy}px))">
        <p class="cap-num">${c.num}</p>
        <h2 class="cap-title">${c.title}</h2>
        ${c.sub ? `<p class="cap-sub">${c.sub}</p>` : ""}
        ${c.extra ? c.extra(t) : ""}
      </div>`
    })
    .join("")
  $("captions").innerHTML = html
}

function drawPhoneFrame(t) {
  const inn = ease(prog(t, T.phoneIn, 0.8))
  const out = ease(prog(t, T.phoneOut, 0.5))
  const wrap = $("phone-wrap")
  wrap.style.opacity = inn * (1 - out)
  wrap.style.transform = `translateY(${(1 - inn) * 140 + out * 60}px)`
  wrap.style.visibility = t >= T.phoneIn && t < T.phoneOut + 0.5 ? "visible" : "hidden"
}

function drawTaps(t) {
  const stage = $("stage").getBoundingClientRect()
  const scale = stage.width / 1920
  const frame = $("screen").getBoundingClientRect()
  let html = ""
  for (const tap of TAPS) {
    if (t < tap.t - 0.35 || t > tap.t + 0.45) continue
    // Find the target on screen; once it's gone (the screen moved on), keep the last spot.
    const el = tap.find()
    if (el) {
      const r = el.getBoundingClientRect()
      tap.pos = [(frame.left - stage.left) / scale + r.left + r.width / 2, (frame.top - stage.top) / scale + r.top + r.height / 2]
    }
    if (!tap.pos) continue
    const [x, y] = tap.pos
    const appear = ease(prog(t, tap.t - 0.35, 0.2))
    const leave = prog(t, tap.t + 0.15, 0.3)
    const press = t >= tap.t && t < tap.t + 0.14 ? 0.82 : 1
    const ring = prog(t, tap.t, 0.45)
    html += `<div class="tap" style="left:${x}px;top:${y}px;opacity:${appear * (1 - leave)}">
      <div class="dot" style="transform:scale(${press})"></div>
      <div class="ring" style="opacity:${t >= tap.t ? 0.7 * (1 - ring) : 0};transform:scale(${1 + ring * 1.4})"></div>
    </div>`
    // The button itself dips while pressed.
    if (el) el.style.transform = t >= tap.t && t < tap.t + 0.14 ? "translateY(2px)" : ""
  }
  $("taps").innerHTML = html
}

function drawEnd(t) {
  const lines = [
    ["e1", 27.75],
    ["e2", 28.35],
    ["e3", 28.75],
  ]
  for (const [id, at] of lines) {
    const x = ease(prog(t, at, 0.55))
    setStyle($(id), x, (1 - x) * 26)
  }
  $("end-card").style.visibility = t >= 27.7 ? "visible" : "hidden"
}

function render(t) {
  t = clamp(t, 0, DURATION)
  drawTitle(t)
  drawCaptions(t)
  drawPhoneFrame(t)
  if (t >= T.phoneIn - 0.1 && t < T.phoneOut + 0.6) drawPhone(t)
  drawTaps(t)
  drawEnd(t)
}

/* ───────── boot: preview plays in real time; export drives render() ───────── */

window.__ready = new Promise((resolve) => {
  const frame = $("screen")
  const go = async () => {
    await document.fonts.ready
    await sdoc().fonts.ready
    $("e3").textContent = URL_TEXT
    render(0)
    resolve()
  }
  if (frame.contentDocument && frame.contentDocument.readyState === "complete" && sdoc().getElementById("page")) go()
  else frame.addEventListener("load", go, { once: true })
})
window.__render = render
window.__duration = DURATION

const exporting = new URLSearchParams(location.search).has("export")
if (exporting) document.body.classList.add("export")
else {
  const fit = () => {
    const s = Math.min((innerWidth - 32) / 1920, (innerHeight - 80) / 1080)
    $("stage").style.transform = `scale(${s})`
    $("stage").style.marginBottom = `${-1080 * (1 - s)}px`
    $("stage").style.marginRight = `${-1920 * (1 - s)}px`
  }
  addEventListener("resize", fit)
  fit()
  let start = 0
  const loop = (now) => {
    if (!start) start = now
    const t = (now - start) / 1000
    render(t)
    if (t < DURATION) requestAnimationFrame(loop)
  }
  window.__ready.then(() => requestAnimationFrame(loop))
  $("replay").addEventListener("click", () => {
    start = 0
    lastKey = ""
    requestAnimationFrame(loop)
  })
}
