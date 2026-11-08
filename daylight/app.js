/* Daylight: the page. Sky maths lives in sky.js. */
(function () {
  "use strict";
  const S = window.Sky, A = window.Astronomy;
  const $ = id => document.getElementById(id);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  /* ── places ───────────────────────────────────────────────────────── */
  const CITIES = [
    ["London", 51.5074, -0.1278], ["Birmingham", 52.4862, -1.8904], ["Manchester", 53.4808, -2.2426],
    ["Leeds", 53.8008, -1.5491], ["Liverpool", 53.4084, -2.9916], ["Newcastle", 54.9783, -1.6178],
    ["Bristol", 51.4545, -2.5879], ["Southampton", 50.9097, -1.4044], ["Brighton", 50.8225, -0.1372],
    ["Norwich", 52.6309, 1.2974], ["Cambridge", 52.2053, 0.1218], ["Oxford", 51.752, -1.2577],
    ["Cardiff", 51.4816, -3.1791], ["Plymouth", 50.3755, -4.1427], ["Belfast", 54.5973, -5.9301],
    ["Glasgow", 55.8642, -4.2518], ["Edinburgh", 55.9533, -3.1883], ["Aberdeen", 57.1497, -2.0943],
    ["Inverness", 57.4778, -4.2247], ["Lerwick", 60.1546, -1.1494]
  ].map(c => ({ name: c[0], lat: c[1], lon: c[2] }));

  /* ── storage (never required: the page works without it) ─────────── */
  const KEY = "daylight:v1", WXKEY = "daylight:wx:v1";
  function load(k) { try { return JSON.parse(localStorage.getItem(k)) || null; } catch (e) { return null; } }
  function save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } }
  const prefs = Object.assign({ place: CITIES[0], wx: false, seenHint: false }, load(KEY) || {});
  const savePrefs = () => save(KEY, prefs);

  /* ── formatting ───────────────────────────────────────────────────── */
  const hm = S.hm;
  function dur(ms, withSeconds) {
    if (ms == null || isNaN(ms)) return "–";
    const neg = ms < 0; ms = Math.abs(ms);
    const h = Math.floor(ms / 3600e3), m = Math.floor(ms % 3600e3 / 60e3), s = Math.round(ms % 60e3 / 1e3);
    let out;
    if (withSeconds) out = (h ? h + "h " : "") + (h || m ? m + "m " : "") + s + "s";
    else if (h) out = h + "h " + m + "m";
    else if (m) out = m + "m";
    else out = "under a minute";
    return (neg ? "−" : "") + out.trim();
  }
  function signed(ms) { return (ms >= 0 ? "+" : "−") + dur(Math.abs(ms), true); }
  const fmtDay = d => d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
  const fmtDayYear = d => d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
  function relDay(d, base) {
    const n = S.daysBetween(base, d);
    if (n === 0) return "today";
    if (n === 1) return "tomorrow";
    if (n === -1) return "yesterday";
    if (n > 1 && n < 7) return d.toLocaleDateString("en-GB", { weekday: "long" });
    return fmtDay(d);
  }
  function inDays(d, base) {
    const n = S.daysBetween(base, d);
    return n === 0 ? "today" : n === 1 ? "tomorrow" : "in " + n + " days";
  }
  const deg = a => Math.round(a) + "°";

  /* ── state ────────────────────────────────────────────────────────── */
  let view = null;              // null = live; otherwise a Date being visited
  const now = () => view ? new Date(view) : new Date();
  const place = () => prefs.place;
  const obs = () => S.observer(place());
  const placeKey = () => place().lat.toFixed(3) + "," + place().lon.toFixed(3);
  const dayCache = new Map();
  function day(d) {
    const k = placeKey() + "|" + S.dayKey(d);
    if (!dayCache.has(k)) {
      const info = S.dayInfo(d, place());
      try { info.tenUp = (() => { const t = A.SearchAltitude("Sun", obs(), +1, info.day, 1, 10); return t && S.sameDay(t.date, info.day) ? t.date : null; })(); } catch (e) { info.tenUp = null; }
      dayCache.set(k, info);
    }
    return dayCache.get(k);
  }

  /* ── dial ─────────────────────────────────────────────────────────── */
  const RO = 168, RI = 134, RM = (RO + RI) / 2;
  const svgNS = "http://www.w3.org/2000/svg";
  const dial = $("dial");
  const ang = mins => mins / 1440 * Math.PI * 2;
  const pt = (r, a) => [(-r * Math.sin(a)).toFixed(2), (r * Math.cos(a)).toFixed(2)];
  function sector(m0, m1, ro, ri) {
    const a0 = ang(m0), a1 = ang(m1);
    const p0 = pt(ro, a0), p1 = pt(ro, a1), p2 = pt(ri, a1), p3 = pt(ri, a0);
    const big = m1 - m0 > 720 ? 1 : 0;
    return `M${p0} A${ro},${ro} 0 ${big} 1 ${p1} L${p2} A${ri},${ri} 0 ${big} 0 ${p3}Z`;
  }
  function arc(m0, m1, r) {
    const a0 = ang(m0), a1 = ang(m1), big = m1 - m0 > 720 ? 1 : 0;
    return `M${pt(r, a0)} A${r},${r} 0 ${big} 1 ${pt(r, a1)}`;
  }
  const SUN_UP = '<path d="M-7 3h14M-4.5-.5a4.5 4.5 0 0 1 9 0M0-9v3M-7-5l2 2M7-5l-2 2" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round"/>';

  let dialDayKey = "";
  function buildDial(t) {
    const k = placeKey() + "|" + S.dayKey(t);
    if (k === dialDayKey) return;
    dialDayKey = k;
    const info = day(t), p = place();
    let s = `<defs>
      <filter id="sunglow" x="-150%" y="-150%" width="400%" height="400%"><feGaussianBlur stdDeviation="6" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      <radialGradient id="sunfill"><stop offset="0" stop-color="#fff6d8"/><stop offset=".6" stop-color="#ffd27a"/><stop offset="1" stop-color="#ffb04f"/></radialGradient>
    </defs>`;
    s += `<circle r="${RO + 52}" fill="rgba(6,9,24,.16)" stroke="rgba(255,255,255,.08)"/>`;
    for (let i = 0; i < 288; i++) {
      const m0 = i * 5, m1 = m0 + 5;
      const alt = S.fastSunAlt(+S.atLocal(t, m0 + 2.5), p.lat, p.lon);
      const c = S.rgb(S.ringColor(alt));
      s += `<path d="${sector(m0, m1 + 0.4, RO, RI)}" fill="${c}"/>`;
    }
    s += `<circle class="ring-outline" r="${RO + .5}" fill="none" stroke="rgba(255,255,255,.18)"/>`;
    // hour ticks
    for (let h = 0; h < 24; h++) {
      const a = ang(h * 60), big = h % 6 === 0;
      s += `<line x1="${pt(RI - 3, a)[0]}" y1="${pt(RI - 3, a)[1]}" x2="${pt(RI - (big ? 12 : 7), a)[0]}" y2="${pt(RI - (big ? 12 : 7), a)[1]}" stroke="rgba(255,255,255,${big ? .55 : .25})" stroke-width="${big ? 2 : 1.2}" stroke-linecap="round"/>`;
    }
    s += `<text class="dial-hour" x="0" y="${-(RI - 26)}" text-anchor="middle" dominant-baseline="middle">NOON</text>`;
    s += `<text class="dial-hour" x="0" y="${RI - 26}" text-anchor="middle" dominant-baseline="middle">MIDNIGHT</text>`;
    // Moon-up arcs for this day
    const d0 = S.startOfDay(t), o = obs();
    let up = null;
    for (let m = 0; m <= 1440; m += 10) {
      const a = S.horizontal("Moon", S.atLocal(d0, m), o).alt > 0;
      if (a && up === null) up = m;
      if ((!a || m === 1440) && up !== null) { if (m - up >= 10) s += `<path d="${arc(up, m, RO + 11)}" stroke="#e9e6dc" stroke-opacity=".7" stroke-width="3" fill="none" stroke-linecap="round"/>`; up = null; }
    }
    // Sunrise and sunset markers
    [[info.sunrise, "rise"], [info.sunset, "set"]].forEach(([e, kind]) => {
      if (!e) return;
      const m = S.minutesOfDay(e), a = ang(m);
      const [x1, y1] = pt(RI - 2, a), [x2, y2] = pt(RO + 4, a), [tx, ty] = pt(RO + 34, a);
      s += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#fff" stroke-width="2" stroke-opacity=".85"/>`;
      s += `<g transform="translate(${tx},${(+ty - 9).toFixed(1)})" style="color:#ffd27a">${kind === "rise" ? SUN_UP : '<g transform="scale(1,-1) translate(0,-2)">' + SUN_UP + "</g>"}</g>`;
      s += `<text class="dial-event" x="${tx}" y="${(+ty + 10).toFixed(1)}" text-anchor="middle" dominant-baseline="middle">${hm(e)}</text>`;
    });
    s += `<g id="moving"></g>`;
    dial.innerHTML = s;
  }

  function moveDial(t) {
    const m = S.minutesOfDay(t), a = ang(m), p = place();
    const alt = S.fastSunAlt(+t, p.lat, p.lon);
    const [x, y] = pt(RM, a), [hx1, hy1] = pt(RI - 14, a), [hx2, hy2] = pt(RI - 2, a);
    const up = alt > -0.8;
    let s = `<line x1="${hx1}" y1="${hy1}" x2="${hx2}" y2="${hy2}" stroke="rgba(255,255,255,.55)" stroke-width="1.5" stroke-linecap="round" stroke-dasharray="2 4"/>`;
    s += up
      ? `<circle cx="${x}" cy="${y}" r="15" fill="url(#sunfill)" filter="url(#sunglow)"/>`
      : `<circle cx="${x}" cy="${y}" r="15" fill="#0b1026" stroke="#fff" stroke-width="3"/><circle cx="${x}" cy="${y}" r="4" fill="#fff"/>`;
    const mo = S.horizontal("Moon", t, obs());
    if (mo.alt > 0) {
      const [mx, my] = pt(RO + 11, a);
      s += `<circle cx="${mx}" cy="${my}" r="6.5" fill="#f1eee4" stroke="rgba(0,0,0,.35)"/>`;
    }
    $("moving").innerHTML = s;
    dial.setAttribute("aria-valuenow", Math.round(m));
    dial.setAttribute("aria-valuetext", hm(t) + ", " + fmtDay(t));
  }

  /* ── the one line that matters right now ─────────────────────────── */
  function headline(t) {
    const today = day(t), tom = day(S.addDays(t, 1));
    const alt = S.sunAlt(t, obs());
    const pm = today.noon ? t > today.noon : t.getHours() >= 12;
    const nextRise = today.sunrise && t < today.sunrise ? today.sunrise : tom.sunrise;
    const firstLight = today.civilDawn && t < today.civilDawn ? today.civilDawn : tom.civilDawn;
    if (!today.sunrise && !today.sunset) {
      return alt > 0 ? { label: "Midnight sun", value: "All day", sub: "The Sun doesn't set today." }
        : { label: "Polar night", value: "No sunrise", sub: "The Sun stays down all day." };
    }
    if (alt >= 6) return { label: "Sunset in", value: dur(today.sunset - t), sub: "at " + hm(today.sunset) + (pm ? " · golden hour from " + hm(today.goldenPmStart) : " · sun peaks at " + hm(today.noon)) };
    if (alt >= -0.8) {
      if (pm) return { label: "Golden hour", value: dur(today.sunset - t), sub: "until sunset at " + hm(today.sunset) + ". Dark by " + hm(today.civilDusk) + "." };
      return { label: "Golden hour", value: dur((today.goldenAmEnd || today.noon) - t), sub: "of warm morning light left. Sun up since " + hm(today.sunrise) + "." };
    }
    if (alt >= -6) {
      if (pm) return { label: "Blue hour", value: dur(today.civilDusk - t), sub: "until dark. The Sun set at " + hm(today.sunset) + "." };
      return { label: "Sunrise in", value: dur(today.sunrise - t), sub: "First light came at " + hm(today.civilDawn) + "." };
    }
    const tomorrow = !S.sameDay(nextRise, t);
    return { label: "Sunrise in", value: dur(nextRise - t), sub: "at " + hm(nextRise) + (tomorrow ? " tomorrow" : "") + " · light from " + hm(firstLight) };
  }

  /* ── sky behind the page ─────────────────────────────────────────── */
  const meta = document.querySelector('meta[name="theme-color"]');
  let starOpacity = 0;
  function paintSky(t) {
    const p = place(), alt = S.fastSunAlt(+t, p.lat, p.lon);
    const [top, bot] = S.skyColors(alt);
    const root = document.documentElement.style;
    root.setProperty("--sky-top", S.rgb(top));
    root.setProperty("--sky-bot", S.rgb(bot));
    meta.setAttribute("content", S.rgb(top));
    starOpacity = Math.max(0, Math.min(1, (-alt - 3) / 10));
    $("stars").style.opacity = starOpacity.toFixed(2);
    const g = Math.max(0, 1 - Math.abs(alt + 1) / 9);
    const glow = $("glow");
    glow.style.opacity = (g * .9).toFixed(2);
    glow.style.setProperty("--glow", alt > -2 ? "rgba(255,160,90,.55)" : "rgba(220,110,150,.45)");
  }

  /* ── stars ────────────────────────────────────────────────────────── */
  const cv = $("stars"), cx = cv.getContext("2d");
  let stars = [];
  const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  function seedStars() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = innerWidth * dpr; cv.height = innerHeight * dpr;
    let seed = 7;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const n = Math.min(420, Math.round(innerWidth * innerHeight / 2600));
    stars = Array.from({ length: n }, () => ({ x: rnd() * cv.width, y: rnd() * cv.height * .92, r: (rnd() ** 3 * 1.5 + .35) * dpr, a: .35 + rnd() * .65, p: rnd() * 6.28, s: .5 + rnd() * 1.5 }));
    drawStars(0);
  }
  function drawStars(time) {
    cx.clearRect(0, 0, cv.width, cv.height);
    for (const s of stars) {
      const tw = still ? 1 : .75 + .25 * Math.sin(s.p + time * .001 * s.s);
      cx.globalAlpha = s.a * tw * (1 - s.y / cv.height * .6);
      cx.fillStyle = "#fff";
      cx.beginPath(); cx.arc(s.x, s.y, s.r, 0, 6.283); cx.fill();
    }
  }
  let lastTw = 0;
  function twinkle(time) {
    if (!still && starOpacity > .05 && !document.hidden && time - lastTw > 80) { drawStars(time); lastTw = time; }
    requestAnimationFrame(twinkle);
  }

  /* ── tiles ────────────────────────────────────────────────────────── */
  function renderTiles(t) {
    const d = day(t), y = day(S.addDays(t, -1));
    const june = day(new Date(t.getFullYear(), place().lat < 0 ? 11 : 5, 21, 12));
    const diff = d.length != null && y.length != null ? d.length - y.length : null;
    const tile = (k, v, s) => `<div class="tile"><p class="k">${k}</p><p class="v">${v}</p><p class="s">${s}</p></div>`;
    $("tiles").innerHTML =
      tile("Sunrise", hm(d.sunrise), "first light " + hm(d.civilDawn)) +
      tile("Sunset", hm(d.sunset), "dark by " + hm(d.civilDusk)) +
      tile("Daylight", d.length != null ? dur(d.length) : "–",
        diff == null ? "" : `<span class="${diff >= 0 ? "up" : "down"}">${signed(diff)}</span> on yesterday`) +
      tile("Sun peaks", d.noonAlt != null ? deg(d.noonAlt) : "–", "at " + hm(d.noon) + (S.sameDay(june.day, d.day) ? "" : " · " + (place().lat < 0 ? "Dec" : "June") + ": " + deg(june.noonAlt)));
  }

  /* ── your light today ────────────────────────────────────────────── */
  const IC = {
    rise: '<svg viewBox="0 0 24 24" fill="none" stroke="#ffd27a" stroke-width="2" stroke-linecap="round"><path d="M3 18h18M7 18a5 5 0 0 1 10 0M12 5v3M5.6 9.6l1.8 1.8M18.4 9.6l-1.8 1.8"/></svg>',
    peak: '<svg viewBox="0 0 24 24" fill="none" stroke="#ffd27a" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
    gold: '<svg viewBox="0 0 24 24" fill="none" stroke="#ffb36b" stroke-width="2" stroke-linecap="round"><path d="M3 18h18M7 18a5 5 0 0 1 10 0M4 14h2M18 14h2"/><path d="M8 21h8" opacity=".6"/></svg>',
    dark: '<svg viewBox="0 0 24 24" fill="none" stroke="#c9c4ff" stroke-width="2" stroke-linecap="round"><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z"/></svg>'
  };
  function renderPlan(t) {
    const d = day(t), live = !view;
    const items = [];
    if (d.sunrise) {
      const shadowNote = d.tenUp ? "Clear of most rooftops (10° up) by " + hm(d.tenUp) + "." : "It stays below 10° all day, so expect long shadows.";
      items.push({ ic: "rise", t: "Sun's up", d: shadowNote, at: d.sunrise, end: d.tenUp || d.noon });
    }
    if (d.noon && d.noonAlt > 0) {
      const ratio = 1 / Math.tan(d.noonAlt * S.RAD);
      items.push({ ic: "peak", t: "Brightest it gets", d: "Sun peaks at " + deg(d.noonAlt) + ". Your shadow is " + (ratio >= 1.1 ? ratio.toFixed(1) + "× your height." : ratio < .9 ? "shorter than you are." : "about your height."), at: d.noon, end: new Date(+d.noon + 45 * 60e3), from: new Date(+d.noon - 45 * 60e3) });
    }
    if (d.goldenPmStart && d.sunset) items.push({ ic: "gold", t: "Golden hour", d: "Warm, low light until sunset at " + hm(d.sunset) + ".", at: d.goldenPmStart, end: d.sunset });
    if (d.civilDusk) items.push({ ic: "dark", t: "Lights on", d: "Too dark to read outside." + (d.astroDusk ? " Fully dark by " + hm(d.astroDusk) + "." : ""), at: d.civilDusk, end: d.civilDusk });
    $("plan-list").innerHTML = items.map(it => {
      const start = it.from || it.at;
      const state = t > it.end ? "past" : t >= start ? "now" : "";
      const w = state === "now" ? "now" : live && state === "" && it.at - t < 3 * 3600e3 ? "in " + dur(it.at - t) : hm(it.at);
      return `<li class="${state}"><span class="ic">${IC[it.ic]}</span><span><span class="t">${it.t}</span><br><span class="d">${it.d}</span></span><span class="w">${w}</span></li>`;
    }).join("");
    renderHours(t);
  }

  /* hourly bars: Sun height, dimmed by cloud when the forecast is on */
  let wx = null;
  function wxHoursFor(t) {
    if (!prefs.wx || !wx || !wx.hours) return null;
    const d0 = S.startOfDay(t), d1 = S.addDays(d0, 1);
    const list = wx.hours.filter(h => h.t >= d0 && h.t < d1);
    return list.length ? list : null;
  }
  function renderHours(t) {
    const d = day(t), p = place();
    const box = $("hours"), note = $("hours-note");
    if (!d.sunrise || !d.sunset) { box.innerHTML = ""; note.textContent = ""; return; }
    const h0 = d.sunrise.getHours(), h1 = d.sunset.getHours();
    const fx = wxHoursFor(t);
    const rows = [];
    for (let h = h0; h <= h1; h++) {
      const at = S.atLocal(t, h * 60);
      let f = fx && fx.find(x => x.t.getHours() === h);
      const base = { t: at, cloud: f ? f.cloud : 0, rain: f ? f.rain : 0, temp: f ? f.temp : null };
      rows.push(S.scoreHours([base], p)[0]);
    }
    const max = Math.max(0.01, ...rows.map(r => Math.max(0, Math.sin(Math.max(0, r.alt) * S.RAD))));
    let best = null;
    rows.forEach(r => { if (r.score > 0 && (!best || r.score > best.score)) best = r; });
    const nowH = !view || S.sameDay(t, new Date()) ? t.getHours() : -1;
    box.innerHTML = rows.map(r => {
      const sun = Math.max(0, Math.sin(Math.max(0, r.alt) * S.RAD)) / max;
      const hgt = fx ? r.score / max : sun;
      const col = S.ringColor(Math.max(r.alt, 1));
      const grey = fx ? r.cloud / 100 * .75 : 0;
      const c = S.rgb(col.map(v => v * (1 - grey) + 150 * grey));
      const cls = (best === r && fx ? "best " : "") + (r.t.getHours() === nowH ? "nowh" : "");
      const rain = fx && r.rain >= 30 ? `<em>${Math.round(r.rain)}%</em>` : "";
      return `<div class="b ${cls}" title="${hm(r.t)}"><i style="height:${Math.max(4, hgt * 100).toFixed(0)}%;background:${c}"></i>${rain}<span>${r.t.getHours()}</span></div>`;
    }).join("");
    if (fx && best) {
      note.innerHTML = `Best hour outside: <b>${hm(best.t)}</b>. ${Math.round(best.cloud)}% cloud${best.temp != null ? ", " + Math.round(best.temp) + "°C" : ""}, ${Math.round(best.rain)}% chance of rain.`;
    } else if (prefs.wx && !fx) {
      note.textContent = wx && wx.error ? "Couldn't fetch the forecast. Showing the Sun's height each hour instead." : "No forecast for this day yet. Bars show the Sun's height each hour.";
    } else {
      note.innerHTML = `Bars show how high the Sun climbs each hour. <button type="button" class="link-btn" id="wx-on">Add the cloud forecast</button> to find the brightest dry hour.`;
      $("wx-on").onclick = () => openSettings(true);
    }
  }

  /* ── the road back to light ───────────────────────────────────────── */
  function renderRoad(t) {
    const p = place(), st = S.seasonStory(t, p);
    const d = day(t), y = day(S.addDays(t, -1));
    const daily = d.length != null && y.length != null ? d.length - y.length : null;
    const m = t.getMonth();
    let title, lead;
    if (st.growing) {
      title = "The light's coming back";
      lead = `<b>${signed(st.changeSincePrev).replace(/ \d+s$/, "")}</b> of daylight since the shortest day. Gaining <b>${dur(Math.abs(daily), true)}</b> a day right now.`;
      if (st.changeSincePrev != null && st.changeSincePrev < 60e3) lead = `The turn has happened. Gaining <b>${dur(Math.abs(daily), true)}</b> a day, and it speeds up.`;
    } else {
      const bright = p.lat >= 0 ? (m >= 5 && m <= 8) : (m >= 11 || m <= 2);
      title = bright ? "Still the bright half" : "The road back to light";
      lead = `<b>${st.daysToNext} days</b> to the shortest day. Losing <b>${dur(Math.abs(daily || 0), true)}</b> of light a day right now.`;
      if (st.daysToNext === 0) lead = "<b>Today's the shortest day.</b> From tomorrow, every day is longer.";
    }
    $("road-title").textContent = title;
    $("road-lead").innerHTML = lead;
    const ms = S.milestones(t, p, 220).slice(0, 6);
    $("road-list").innerHTML = ms.map(x =>
      `<li class="${x.kind}"><div class="row"><span class="t">${esc(x.title)}</span><span class="when"><b>${inDays(x.date, t)}</b> · ${fmtDay(x.date)}</span></div>${x.detail ? `<p class="d">${esc(x.detail)}</p>` : ""}</li>`
    ).join("");
  }

  /* ── tonight ──────────────────────────────────────────────────────── */
  const PCOL = { Venus: "#fff1cf", Jupiter: "#f3dcb4", Mars: "#ff8b5e", Saturn: "#e9d38f", Mercury: "#cfc6b8" };
  function heightWords(alt) { return alt > 55 ? "high up" : alt > 30 ? "halfway up" : alt > 15 ? "low" : "very low"; }
  function kmAway(body, t) { try { return A.GeoVector(body, t, true).Length() * 149597870.7; } catch (e) { return null; } }
  function bigKm(km) { return km > 1e9 ? (km / 1e9).toFixed(1) + " billion km" : Math.round(km / 1e6) + " million km"; }

  function drawMoon(m) {
    const r = 50;
    const lit = S.moonPath(m.angle, r, place().lat < 0);
    $("moon").innerHTML = `<defs>
        <radialGradient id="mg" cx="40%" cy="38%" r="70%"><stop offset="0" stop-color="#fbf8ef"/><stop offset=".7" stop-color="#e6e0d1"/><stop offset="1" stop-color="#bfb8a6"/></radialGradient>
        <filter id="mglow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="5"/></filter>
      </defs>
      <circle r="${r}" fill="#1a1e38" stroke="rgba(255,255,255,.16)"/>
      ${m.fraction > 0.02 ? `<path d="${lit}" fill="#fff" opacity="${(0.15 + m.fraction * .35).toFixed(2)}" filter="url(#mglow)"/>` : ""}
      ${lit ? `<path d="${lit}" fill="url(#mg)"/>` : ""}
      <g fill="#000" opacity=".07"><circle cx="-14" cy="-12" r="9"/><circle cx="12" cy="10" r="12"/><circle cx="-6" cy="22" r="6"/><circle cx="20" cy="-18" r="5"/></g>`;
  }

  function renderTonight(t) {
    const p = place(), live = !view || S.sameDay(t, new Date());
    $("tonight-title").textContent = live ? "Tonight" : "The night of " + fmtDay(t);
    const nw = S.nightWindow(t, p);
    const m = S.moonInfo(t, p);
    drawMoon(m);
    $("moon-name").textContent = m.name + " · " + Math.round(m.fraction * 100) + "% lit";
    const ev = [];
    if (m.rise) ev.push([m.rise, "Rises " + hm(m.rise) + (S.sameDay(m.rise, t) ? "" : " " + relDay(m.rise, t))]);
    if (m.set) ev.push([m.set, "sets " + hm(m.set) + (S.sameDay(m.set, t) ? "" : " " + relDay(m.set, t))]);
    ev.sort((a, b) => a[0] - b[0]);
    $("moon-times").textContent = ev.map((e, i) => i === 0 ? e[1][0].toUpperCase() + e[1].slice(1) : e[1]).join(" · ");
    const nf = m.nextFull, nn = m.nextNew;
    const parts = [];
    if (nn && (!nf || nn < nf)) parts.push("New Moon " + relDay(nn, t));
    if (nf) parts.push((S.daysBetween(t, nf) <= 1 ? "Full " : m.fullName + " (full) ") + relDay(nf, t));
    if (nn && nf && nn > nf) parts.push("new " + relDay(nn, t));
    $("moon-next").textContent = parts.join(" · ");

    const planets = S.planetsTonight(t, p);
    // Something to point at with the kids.
    const lateEvening = S.atLocal(nw.start, 21 * 60 + 30) > nw.start ? S.atLocal(nw.start, 21 * 60 + 30) : new Date(+nw.start + 2 * 3600e3);
    const evening = planets.filter(x => x.first.t <= lateEvening);
    let kids = "";
    const pick = evening.find(x => x.mag < 1.2);
    if (pick) {
      const at = pick.first.t < nw.start ? nw.start : new Date(Math.max(+pick.first.t, +S.atLocal(nw.start, 19 * 60)));
      const pos = S.horizontal(pick.body, at > lateEvening ? pick.first.t : at, obs());
      const km = kmAway(pick.body, at);
      kids = `<b>Show the kids:</b> ${pick.body}, the steady ${pick.mag < -1.8 ? "very bright " : ""}"star" ${heightWords(pos.alt)} in the ${S.simpleDir(pos.az)} around ${hm(at)}. It's a planet${km ? ", " + bigKm(km) + " away" : ""}.`;
    } else {
      const at = S.atLocal(nw.start, 19 * 60) > nw.start ? S.atLocal(nw.start, 19 * 60) : nw.start;
      const mp = S.horizontal("Moon", at, obs());
      if (mp.alt > 8 && m.fraction > 0.15) kids = `<b>Show the kids:</b> the Moon, ${heightWords(mp.alt)} in the ${S.simpleDir(mp.az)} at ${hm(at)}. Binoculars show craters along the shadow edge.`;
      else {
        const morning = planets.find(x => x.mag < -1);
        if (morning) kids = `<b>Early start?</b> ${morning.body} is ${heightWords(morning.best.alt)} in the ${S.simpleDir(morning.best.az)} at ${hm(morning.best.t)}, ${morning.mag < -3 ? "blazing" : "bright"} before dawn.`;
      }
    }
    $("kids").innerHTML = kids;

    let dark = nw.astroStart && nw.astroEnd
      ? `Properly dark from <b>${hm(nw.astroStart)}</b> to <b>${hm(nw.astroEnd)}</b>.`
      : "It never gets fully dark tonight: the Sun stays less than 18° below the horizon.";
    const cloud = cloudTonight(nw);
    if (cloud) dark += " " + cloud;
    $("dark").innerHTML = dark;

    $("planets").innerHTML = planets.length ? planets.map(x => {
      const start = x.first.t <= nw.start ? "Up as it gets dark, in the " + S.simpleDir(x.first.az) : "Rises clear at " + hm(x.first.t) + " in the " + S.simpleDir(x.first.az);
      const bestStr = Math.abs(x.best.t - x.first.t) < 20 * 60e3 ? "" : ". Highest at " + hm(x.best.t) + ", " + heightWords(x.best.alt) + " in the " + S.simpleDir(x.best.az);
      const end = x.last.t < new Date(+nw.end - 20 * 60e3) ? ". Gone by " + hm(new Date(+x.last.t + 10 * 60e3)) : "";
      const magStr = (x.mag < 0 ? "−" : "") + Math.abs(x.mag).toFixed(1);
      return `<li><span class="dot" style="background:${PCOL[x.body]};box-shadow:0 0 10px ${PCOL[x.body]}"></span><div><p class="n">${x.body}<small>mag ${magStr}${x.constellation ? " · in " + x.constellation : ""}</small></p><p class="d">${start}${bestStr}${end}. ${x.words}</p></div></li>`;
    }).join("") : `<li><span class="empty">No bright planets well placed tonight.</span></li>`;

    // Extras: meteor shower, eclipses.
    const ex = [];
    const sh = S.nextShower(t);
    if (sh.days <= 45) {
      ex.push(extra("meteor", sh.name + " " + (sh.days <= 0 ? "peak tonight" : "peak " + inDays(sh.peak, t)),
        `${fmtDay(sh.peak)}. Up to ${sh.zhr} an hour under a perfect sky. ${sh.tip} ${sh.moonVerdict}`));
    }
    const ecl = S.nextEclipses(t, p);
    const list = [];
    if (ecl.solar) list.push(["solar", ecl.solar]);
    if (ecl.lunar) list.push(["lunar", ecl.lunar]);
    list.sort((a, b) => a[1].date - b[1].date);
    if (list.length) {
      const [k, e] = list[0];
      const d = e.date;
      ex.push(extra(k, `Next eclipse you can see: ${e.kind} ${k}`, k === "solar"
        ? `${fmtDayYear(d)}, peak ${hm(d)}. The Moon covers ${Math.round(e.obscuration * 100)}% of the Sun. Never look straight at it: use eclipse glasses or a pinhole.`
        : `${fmtDayYear(d)}, peak ${hm(d)}. The Moon turns ${e.kind === "total" ? "copper-red" : "partly dark"}. Safe to watch with bare eyes.`));
    }
    $("extras").innerHTML = ex.join("");
  }
  const EXIC = {
    meteor: '<svg viewBox="0 0 24 24" fill="none" stroke="#ffd27a" stroke-width="2" stroke-linecap="round"><path d="M4 4l9 9M8 3l7 7M3 8l7 7" opacity=".55"/><circle cx="17" cy="17" r="3" fill="#ffd27a"/></svg>',
    solar: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8" fill="#ffd27a"/><circle cx="15" cy="10" r="7.5" fill="#12162f"/></svg>',
    lunar: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8" fill="#c8553d"/><circle cx="9" cy="10" r="2" fill="#000" opacity=".15"/></svg>'
  };
  const extra = (ic, t, d) => `<div class="extra">${EXIC[ic]}<div><p class="t">${esc(t)}</p><p class="d">${esc(d)}</p></div></div>`;

  function cloudTonight(nw) {
    if (!prefs.wx || !wx || !wx.hours) return "";
    const end = new Date(Math.min(+nw.end, +nw.start + 9 * 3600e3));
    const hrs = wx.hours.filter(h => h.t >= new Date(+nw.start - 30 * 60e3) && h.t <= end);
    if (hrs.length < 3) return "";
    const avg = hrs.reduce((a, h) => a + h.cloud, 0) / hrs.length;
    if (avg < 30) return `<b>Mostly clear</b> (${Math.round(avg)}% cloud). Good night to look up.`;
    let run = null, bestRun = null;
    hrs.forEach(h => {
      if (h.cloud < 40) { run = run || { a: h.t, b: h.t }; run.b = h.t; if (!bestRun || run.b - run.a > bestRun.b - bestRun.a) bestRun = { ...run }; }
      else run = null;
    });
    if (bestRun && bestRun.b - bestRun.a >= 3600e3) return `Clear spell <b>${hm(bestRun.a)}–${hm(new Date(+bestRun.b + 3600e3))}</b>, cloudier either side.`;
    return `<b>Cloudy</b> (${Math.round(avg)}% cover). The sky will probably stay hidden.`;
  }

  /* ── year of light ────────────────────────────────────────────────── */
  const rb = $("ribbon"), rctx = rb.getContext("2d");
  let ribbonBase = null, ribbonKey = "";
  function ribbonYearDays(y) { return S.daysBetween(new Date(y, 0, 1), new Date(y + 1, 0, 1)); }
  function drawRibbon(t) {
    const y = t.getFullYear(), p = place();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = Math.round(rb.clientWidth * dpr), H = Math.round(rb.clientHeight * dpr);
    if (!W || !H) return;
    const k = placeKey() + "|" + y + "|" + W + "x" + H;
    const days = ribbonYearDays(y), rows = 144;
    if (k !== ribbonKey) {
      const off = document.createElement("canvas");
      off.width = days; off.height = rows;
      const oc = off.getContext("2d"), img = oc.createImageData(days, rows);
      for (let d = 0; d < days; d++) {
        const dd = new Date(y, 0, 1 + d);
        for (let r = 0; r < rows; r++) {
          const c = S.ringColor(S.fastSunAlt(+S.atLocal(dd, r * 10 + 5), p.lat, p.lon));
          const i = (r * days + d) * 4;
          img.data[i] = c[0]; img.data[i + 1] = c[1]; img.data[i + 2] = c[2]; img.data[i + 3] = 255;
        }
      }
      oc.putImageData(img, 0, 0);
      ribbonBase = document.createElement("canvas");
      ribbonBase.width = W; ribbonBase.height = H;
      const bc = ribbonBase.getContext("2d");
      bc.imageSmoothingEnabled = true;
      bc.drawImage(off, 0, 0, W, H);
      // month lines and labels
      bc.font = `600 ${11 * dpr}px "DM Sans", system-ui, sans-serif`;
      bc.textBaseline = "bottom";
      for (let mo = 0; mo < 12; mo++) {
        const x = S.daysBetween(new Date(y, 0, 1), new Date(y, mo, 1)) / days * W;
        bc.fillStyle = "rgba(255,255,255,.14)"; bc.fillRect(Math.round(x), 0, Math.max(1, dpr * .6), H);
        bc.fillStyle = "rgba(255,255,255,.7)";
        bc.fillText("JFMAMJJASOND"[mo], x + 4 * dpr, H - 4 * dpr);
      }
      bc.textBaseline = "middle";
      [6, 12, 18].forEach(h => {
        const yy = h / 24 * H;
        bc.fillStyle = "rgba(255,255,255,.12)"; bc.fillRect(0, Math.round(yy), W, Math.max(1, dpr * .6));
        bc.fillStyle = "rgba(255,255,255,.65)"; bc.fillText(h === 12 ? "noon" : h + ":00", 4 * dpr, yy - 8 * dpr);
      });
      ribbonKey = k;
    }
    rb.width = W; rb.height = H;
    rctx.drawImage(ribbonBase, 0, 0);
    const di = S.daysBetween(new Date(y, 0, 1), t), x = (di + .5) / days * W;
    rctx.fillStyle = "rgba(255,255,255,.95)";
    rctx.fillRect(x - dpr, 0, 2 * dpr, H);
    const yy = S.minutesOfDay(t) / 1440 * H;
    rctx.beginPath(); rctx.arc(x, yy, 5 * dpr, 0, 6.283);
    rctx.fillStyle = "#ffd27a"; rctx.fill();
    rctx.lineWidth = 2 * dpr; rctx.strokeStyle = "#fff"; rctx.stroke();
  }
  function renderYearFacts(t) {
    const y = t.getFullYear(), p = place();
    const north = p.lat >= 0;
    const s = A.Seasons(y);
    const long = day(north ? s.jun_solstice.date : s.dec_solstice.date), short = day(north ? s.dec_solstice.date : s.jun_solstice.date);
    const d = day(t);
    const pct = long.length && short.length && d.length ? Math.round((d.length - short.length) / (long.length - short.length) * 100) : null;
    $("year-facts").innerHTML = (view ? `<b>${fmtDayYear(t)}</b>: up ${hm(d.sunrise)}, down ${hm(d.sunset)}, ${dur(d.length)} of daylight. ` : "") +
      `Longest day ${dur(long.length)}, shortest ${dur(short.length)}.` + (pct != null ? ` ${view ? "That day sits" : "Today sits"} ${pct}% of the way from the darkest day to the brightest.` : "");
  }

  /* ── forecast (opt-in) ───────────────────────────────────────────── */
  function wxFromCache() {
    const c = load(WXKEY);
    if (!c || c.key !== wxKey()) return null;
    return { at: c.at, hours: c.hours.map(h => ({ t: new Date(h[0] * 1000), cloud: h[1], rain: h[2], temp: h[3] })) };
  }
  const wxKey = () => place().lat.toFixed(1) + "," + place().lon.toFixed(1);
  let wxBusy = false;
  function loadWx(force) {
    if (!prefs.wx) { wx = null; return; }
    wx = wxFromCache() || wx;
    if (wx && wx.key && wx.key !== wxKey()) wx = null;
    const fresh = wx && wx.at && Date.now() - wx.at < 45 * 60e3;
    if ((fresh && !force) || wxBusy || !navigator.onLine) return;
    wxBusy = true;
    const [la, lo] = wxKey().split(",");
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${la}&longitude=${lo}&hourly=cloud_cover,precipitation_probability,temperature_2m&forecast_days=3&past_days=1&timeformat=unixtime&timezone=GMT`;
    fetch(url, { credentials: "omit", referrerPolicy: "no-referrer" }).then(r => r.ok ? r.json() : Promise.reject(r.status)).then(j => {
      const hh = j.hourly;
      const rows = hh.time.map((s, i) => [s, hh.cloud_cover[i] ?? 0, hh.precipitation_probability[i] ?? 0, hh.temperature_2m[i]]);
      save(WXKEY, { key: wxKey(), at: Date.now(), hours: rows });
      wx = wxFromCache();
    }).catch(() => { wx = wx || { error: true }; }).finally(() => { wxBusy = false; renderDay(true); });
  }

  /* ── rendering pipeline ──────────────────────────────────────────── */
  let renderedDay = "";
  function renderDay(force) {
    const t = now(), k = placeKey() + "|" + S.dayKey(t) + "|" + (view ? "v" : "l");
    if (!force && k === renderedDay) return;
    renderedDay = k;
    $("place-name").textContent = place().name;
    renderTiles(t);
    renderPlan(t);
    renderRoad(t);
    renderTonight(t);
    renderYearFacts(t);
  }
  let heavyTimer = 0;
  function renderMoment(deferHeavy) {
    const t = now();
    buildDial(t);
    moveDial(t);
    const h = headline(t);
    $("h-label").textContent = h.label;
    $("h-value").textContent = h.value;
    $("h-sub").textContent = h.sub;
    paintSky(t);
    drawRibbon(t);
    $("travel").hidden = !view;
    if (view) $("travel-label").textContent = "Visiting " + fmtDay(t) + (t.getFullYear() !== new Date().getFullYear() ? " " + t.getFullYear() : "") + ", " + hm(t);
    if (deferHeavy) { clearTimeout(heavyTimer); heavyTimer = setTimeout(() => { renderDay(); renderPlan(now()); }, 160); }
    else { renderDay(); renderPlan(t); }
  }
  function setView(t, deferHeavy) {
    if (t && Math.abs(t - Date.now()) < 3 * 60e3) t = null;
    view = t;
    renderMoment(deferHeavy);
  }

  /* ── dial interaction ────────────────────────────────────────────── */
  function minutesFromPointer(e) {
    const r = dial.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width * 460 - 230, y = (e.clientY - r.top) / r.height * 460 - 230;
    let a = Math.atan2(-x, y);
    if (a < 0) a += Math.PI * 2;
    return Math.round(a / (Math.PI * 2) * 1440 / 5) * 5 % 1440;
  }
  let dragging = false;
  dial.addEventListener("pointerdown", e => {
    dragging = true; dial.setPointerCapture(e.pointerId);
    setView(S.atLocal(now(), minutesFromPointer(e)), true);
    if (!prefs.seenHint) { prefs.seenHint = true; savePrefs(); }
  });
  dial.addEventListener("pointermove", e => { if (dragging) setView(S.atLocal(now(), minutesFromPointer(e)), true); });
  const endDrag = () => { dragging = false; };
  dial.addEventListener("pointerup", endDrag);
  dial.addEventListener("pointercancel", endDrag);
  dial.addEventListener("keydown", e => {
    const t = now();
    const step = { ArrowRight: 15, ArrowUp: 15, ArrowLeft: -15, ArrowDown: -15 }[e.key];
    if (step) { setView(new Date(+t + step * 60e3), true); e.preventDefault(); }
    else if (e.key === "PageUp" || e.key === "PageDown") { setView(S.addDays(t, e.key === "PageUp" ? 1 : -1), true); e.preventDefault(); }
    else if (e.key === "Home" || e.key === "Escape") { setView(null); e.preventDefault(); }
  });
  $("now-btn").addEventListener("click", () => setView(null));

  rb.addEventListener("click", e => {
    const r = rb.getBoundingClientRect();
    const t = now(), y = t.getFullYear();
    const di = Math.max(0, Math.min(ribbonYearDays(y) - 1, Math.floor((e.clientX - r.left) / r.width * ribbonYearDays(y))));
    const mins = Math.max(0, Math.min(1435, Math.round((e.clientY - r.top) / r.height * 1440 / 5) * 5));
    setView(S.atLocal(new Date(y, 0, 1 + di), mins));
  });

  /* ── settings ────────────────────────────────────────────────────── */
  const dlg = $("settings");
  function openSettings(focusWx) {
    $("cities").innerHTML = CITIES.map((c, i) => `<button type="button" data-i="${i}" aria-pressed="${c.name === place().name}">${c.name}</button>`).join("");
    $("wx-toggle").checked = !!prefs.wx;
    if (dlg.showModal) dlg.showModal(); else dlg.setAttribute("open", "");
    if (focusWx) $("wx-toggle").focus();
  }
  function setPlace(pl) {
    prefs.place = pl; savePrefs();
    dayCache.clear(); dialDayKey = ""; renderedDay = ""; ribbonKey = "";
    wx = null; loadWx();
    renderMoment();
  }
  $("place-btn").addEventListener("click", () => openSettings());
  $("cities").addEventListener("click", e => {
    const b = e.target.closest("button[data-i]");
    if (!b) return;
    setPlace(CITIES[+b.dataset.i]);
    dlg.close();
  });
  $("geo-btn").addEventListener("click", () => {
    const msg = $("geo-msg");
    if (!navigator.geolocation) { msg.textContent = "This browser can't share a location. Pick a city instead."; return; }
    msg.textContent = "Finding you…";
    navigator.geolocation.getCurrentPosition(pos => {
      const lat = +pos.coords.latitude.toFixed(2), lon = +pos.coords.longitude.toFixed(2);
      let near = null, best = 1e9;
      CITIES.forEach(c => { const d = Math.hypot(c.lat - lat, (c.lon - lon) * Math.cos(lat * S.RAD)) * 111; if (d < best) { best = d; near = c; } });
      const name = best < 8 ? near.name : best < 45 ? "Near " + near.name : "Your location";
      msg.textContent = "Rounded to about 1 km and kept on this device.";
      setPlace({ name, lat, lon });
      dlg.close();
    }, () => { msg.textContent = "Location wasn't shared. Pick a city instead."; }, { maximumAge: 6 * 3600e3, timeout: 15000 });
  });
  $("wx-toggle").addEventListener("change", e => {
    prefs.wx = e.target.checked; savePrefs();
    if (prefs.wx) loadWx(true); else { wx = null; try { localStorage.removeItem(WXKEY); } catch (er) { } renderDay(true); }
  });

  /* ── go ───────────────────────────────────────────────────────────── */
  if (prefs.seenHint) $("hint").textContent = "The silver arc shows when the Moon is up.";
  else $("hint").textContent = "Drag the ring to move through the day. Silver arc: Moon's up.";
  seedStars();
  requestAnimationFrame(twinkle);
  let rs = 0;
  addEventListener("resize", () => { clearTimeout(rs); rs = setTimeout(() => { seedStars(); drawRibbon(now()); }, 150); });
  loadWx();
  renderMoment();
  setInterval(() => { if (!view && !document.hidden) renderMoment(); }, 20e3);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) { if (!view) renderMoment(); loadWx(); } });

  if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost" || location.hostname === "127.0.0.1")) {
    addEventListener("load", () => {
      navigator.serviceWorker.register("sw.js").catch(() => { });
      navigator.serviceWorker.ready.then(r => { if (r.active) r.active.postMessage("refill"); }).catch(() => { });
    });
  }
})();
