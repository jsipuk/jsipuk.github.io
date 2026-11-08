/* Daylight: the sky maths.
   Everything here is computed on the device from the date and a location.
   Precise work (rise/set, Moon, planets, eclipses) uses Astronomy Engine
   (MIT, vendored as astronomy.min.js). Bulk colouring of the dial and the
   year chart uses a fast low-precision Sun formula, good to about 0.02°. */
(function (root) {
  "use strict";
  const A = root.Astronomy;
  const RAD = Math.PI / 180;
  const MIN = 60e3, HOUR = 3600e3, DAY = 86400e3;

  /* ── dates (local wall-clock, so clock changes behave) ───────────── */
  function startOfDay(d) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
  function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
  function atLocal(day, minutes) { const x = startOfDay(day); x.setHours(0, minutes, 0, 0); return x; }
  function minutesOfDay(d) { return d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60; }
  function dayKey(d) { return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate(); }
  function sameDay(a, b) { return a && b && dayKey(a) === dayKey(b); }
  function daysBetween(a, b) { return Math.round((startOfDay(b) - startOfDay(a)) / DAY); }

  /* ── fast Sun altitude (degrees, geometric, no refraction) ───────── */
  function fastSunAlt(ms, lat, lon) {
    const d = ms / DAY - 10957.5;
    const g = (357.529 + 0.98560028 * d) * RAD;
    const q = 280.459 + 0.98564736 * d;
    const L = (q + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g)) * RAD;
    const e = (23.439 - 0.00000036 * d) * RAD;
    const ra = Math.atan2(Math.cos(e) * Math.sin(L), Math.cos(L));
    const dec = Math.asin(Math.sin(e) * Math.sin(L));
    const gmst = ((18.697374558 + 24.06570982441908 * d) % 24) * 15 * RAD;
    const ha = gmst + lon * RAD - ra;
    const la = lat * RAD;
    return Math.asin(Math.sin(la) * Math.sin(dec) + Math.cos(la) * Math.cos(dec) * Math.cos(ha)) / RAD;
  }

  /* ── colour ramps ─────────────────────────────────────────────────── */
  function hex(h) { return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function mix(c1, c2, t) { return [lerp(c1[0], c2[0], t), lerp(c1[1], c2[1], t), lerp(c1[2], c2[2], t)]; }
  function rampAt(stops, alt) {
    if (alt <= stops[0][0]) return stops[0].slice(1);
    for (let i = 1; i < stops.length; i++) {
      if (alt <= stops[i][0]) {
        const t = (alt - stops[i - 1][0]) / (stops[i][0] - stops[i - 1][0]);
        return stops[i].slice(1).map((c, k) => mix(stops[i - 1][k + 1], c, t));
      }
    }
    return stops[stops.length - 1].slice(1);
  }
  const RING = [
    [-18, "#0b1026"], [-12, "#19214d"], [-6, "#3b3577"], [-3, "#7b4a87"], [0, "#e0795d"],
    [3, "#f2a35a"], [6, "#f5c77b"], [12, "#a9d0ee"], [30, "#68ade6"], [60, "#4092dc"]
  ].map(s => [s[0], hex(s[1])]);
  const SKY = [
    [-90, "#03050d", "#070b1a"], [-18, "#050817", "#0b1029"], [-12, "#0b1030", "#1c1f4e"],
    [-6, "#141a46", "#4a3977"], [-2, "#2a2e6a", "#b95f7c"], [0, "#3a4686", "#ec855e"],
    [4, "#4d74b4", "#f4b06c"], [10, "#4a8bd2", "#bcd8ee"], [30, "#2f7dd4", "#94c4ee"], [90, "#1f6ccd", "#7ab4ec"]
  ].map(s => [s[0], hex(s[1]), hex(s[2])]);
  function rgb(c) { return "rgb(" + c.map(Math.round).join(",") + ")"; }
  function ringColor(alt) { return rampAt(RING, alt)[0]; }
  function skyColors(alt) { return rampAt(SKY, alt); }

  /* ── observer + precise helpers ───────────────────────────────────── */
  function observer(place) { return new A.Observer(place.lat, place.lon, place.elev || 30); }
  function when(t) { return t ? t.date : null; }
  function riseSet(body, obs, dir, from, limitDays) {
    try { return when(A.SearchRiseSet(body, obs, dir, from, limitDays)); } catch (e) { return null; }
  }
  function altCross(obs, dir, from, alt, limitDays) {
    try { return when(A.SearchAltitude("Sun", obs, dir, from, limitDays, alt)); } catch (e) { return null; }
  }
  function horizontal(body, t, obs) {
    const eq = A.Equator(body, t, obs, true, true);
    const h = A.Horizon(t, obs, eq.ra, eq.dec, "normal");
    return { alt: h.altitude, az: h.azimuth, ra: eq.ra, dec: eq.dec };
  }
  function sunAlt(t, obs) { return horizontal("Sun", t, obs).alt; }

  /* Keep an event only if it lands on the given local day. */
  function onDay(t, day) { return t && sameDay(t, day) ? t : null; }

  /* ── one day of light ─────────────────────────────────────────────── */
  function dayInfo(day, place) {
    const obs = observer(place);
    const d0 = startOfDay(day);
    const noonSearch = (() => { try { return A.SearchHourAngle("Sun", obs, 0, d0, +1); } catch (e) { return null; } })();
    const info = {
      day: d0,
      astroDawn: onDay(altCross(obs, +1, d0, -18, 1), d0),
      nautDawn: onDay(altCross(obs, +1, d0, -12, 1), d0),
      civilDawn: onDay(altCross(obs, +1, d0, -6, 1), d0),
      sunrise: onDay(riseSet("Sun", obs, +1, d0, 1), d0),
      goldenAmEnd: onDay(altCross(obs, +1, d0, 6, 1), d0),
      noon: noonSearch ? noonSearch.time.date : null,
      noonAlt: noonSearch ? noonSearch.hor.altitude : null,
      goldenPmStart: onDay(altCross(obs, -1, d0, 6, 1), d0),
      sunset: onDay(riseSet("Sun", obs, -1, d0, 1), d0),
      civilDusk: onDay(altCross(obs, -1, d0, -6, 1), d0),
      nautDusk: onDay(altCross(obs, -1, d0, -12, 1), d0),
      astroDusk: onDay(altCross(obs, -1, d0, -18, 1), d0)
    };
    info.length = info.sunrise && info.sunset ? info.sunset - info.sunrise : null;
    return info;
  }

  /* ── "the road back to light": upcoming milestones ───────────────── */
  function hm(d) { return d ? pad(d.getHours()) + ":" + pad(d.getMinutes()) : "–"; }
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function clock12(h) { return (h % 12 === 0 ? 12 : h % 12) + (h >= 12 ? "pm" : "am"); }

  function milestones(from, place, horizonDays) {
    horizonDays = horizonDays || 200;
    const obs = observer(place);
    const start = startOfDay(from);
    const rows = [];
    for (let i = -1; i <= horizonDays + 1; i++) {
      const day = addDays(start, i);
      const rise = riseSet("Sun", obs, +1, day, 1);
      const set = riseSet("Sun", obs, -1, day, 1);
      rows.push({ day, rise: onDay(rise, day), set: onDay(set, day), off: atLocal(day, 720).getTimezoneOffset() });
    }
    const out = [];
    const push = (date, kind, title, detail) => { if (date >= start) out.push({ date: startOfDay(date), kind, title, detail }); };

    for (let i = 1; i < rows.length - 1; i++) {
      const p = rows[i - 1], c = rows[i], n = rows[i + 1];
      if (!p.set || !c.set || !n.set || !p.rise || !c.rise || !n.rise) continue;
      const ps = minutesOfDay(p.set), cs = minutesOfDay(c.set), ns = minutesOfDay(n.set);
      const pr = minutesOfDay(p.rise), cr = minutesOfDay(c.rise), nr = minutesOfDay(n.rise);
      const steady = p.off === c.off && c.off === n.off;
      if (steady && cs < ps && cs <= ns) push(c.day, "turn", "Earliest sunset", hm(c.set) + ". Evenings get lighter from here.");
      if (steady && cs > ps && cs >= ns) push(c.day, "turn", "Latest sunset", hm(c.set) + ". Evenings start drawing in.");
      if (steady && cr > pr && cr >= nr) push(c.day, "turn", "Latest sunrise", hm(c.rise) + ". Mornings brighten from here.");
      if (steady && cr < pr && cr <= nr) push(c.day, "turn", "Earliest sunrise", hm(c.rise) + ".");
      if (c.off !== p.off) {
        const fwd = c.off < p.off;
        push(c.day, "clock", fwd ? "Clocks go forward" : "Clocks go back",
          "Sunset jumps from " + hm(p.set) + " to " + hm(c.set) + ".");
      }
      // Sunset crossing a whole hour (ignore jumps caused by clock changes).
      if (p.off === c.off) {
        const ph = Math.floor(ps / 60), ch = Math.floor(cs / 60);
        if (ch > ph) push(c.day, "hour", "First sunset after " + clock12(ch), "Sun sets at " + hm(c.set) + ".");
        if (ch < ph) push(p.day, "hour", "Last sunset after " + clock12(ph), "Sun sets at " + hm(p.set) + ". Before " + clock12(ph) + " from tomorrow.");
      }
    }
    // Solstices and equinoxes.
    const y = start.getFullYear();
    [y, y + 1].forEach(yr => {
      const s = A.Seasons(yr);
      push(s.mar_equinox.date, "season", "Spring equinox", "Day and night roughly equal.");
      push(s.jun_solstice.date, "season", "Longest day", "Peak light. Days shorten after this.");
      push(s.sep_equinox.date, "season", "Autumn equinox", "Day and night roughly equal.");
      push(s.dec_solstice.date, "season", "Shortest day", "The turn. Every day after this is longer.");
    });
    const limit = addDays(start, horizonDays);
    return out.filter(m => m.date <= limit && m.date >= start).sort((a, b) => a.date - b.date);
  }

  /* The solstice story: where are we in the year's light? */
  function seasonStory(now, place) {
    const obs = observer(place);
    const y = now.getFullYear();
    const marks = [];
    [y - 1, y, y + 1].forEach(yr => {
      const s = A.Seasons(yr);
      marks.push({ t: s.jun_solstice.date, kind: "jun" }, { t: s.dec_solstice.date, kind: "dec" });
    });
    marks.sort((a, b) => a.t - b.t);
    const prev = marks.filter(m => m.t <= now).pop();
    const next = marks.find(m => m.t > now);
    const lenOn = d => { const i = dayInfo(d, place); return i.length; };
    const todayLen = lenOn(now);
    const prevLen = lenOn(prev.t);
    const growing = prev.kind === "dec";
    // Winter-hemisphere aware: in the south the December solstice is the long day.
    const south = place.lat < 0;
    const shrinkingToShort = south ? growing : !growing;
    return {
      growing: south ? !growing : growing,
      prev: prev.t, prevKind: prev.kind, next: next.t, nextKind: next.kind,
      daysToNext: daysBetween(now, next.t),
      daysSincePrev: daysBetween(prev.t, now),
      changeSincePrev: todayLen != null && prevLen != null ? todayLen - prevLen : null,
      shrinkingToShort
    };
  }

  /* ── Moon ─────────────────────────────────────────────────────────── */
  const MOON_NAMES = ["Wolf", "Snow", "Worm", "Pink", "Flower", "Strawberry", "Buck", "Sturgeon", "Harvest", "Hunter's", "Beaver", "Cold"];
  function phaseName(angle) {
    const w = 360 / 29.53 / 2 * 1.4;
    const near = (a, b) => Math.abs(((a - b + 540) % 360) - 180) <= w;
    if (near(angle, 0)) return "New Moon";
    if (near(angle, 90)) return "First quarter";
    if (near(angle, 180)) return "Full Moon";
    if (near(angle, 270)) return "Last quarter";
    if (angle < 90) return "Waxing crescent";
    if (angle < 180) return "Waxing gibbous";
    if (angle < 270) return "Waning gibbous";
    return "Waning crescent";
  }
  function moonInfo(t, place) {
    const obs = observer(place);
    const angle = A.MoonPhase(t);
    const illum = A.Illumination("Moon", t);
    const next = (target) => { try { return A.SearchMoonPhase(target, t, 40).date; } catch (e) { return null; } };
    const nextFull = next(180), nextNew = next(0);
    const pos = horizontal("Moon", t, obs);
    return {
      angle, fraction: illum.phase_fraction, name: phaseName(angle),
      waxing: angle < 180,
      ageDays: angle / 360 * 29.530588,
      alt: pos.alt, az: pos.az,
      nextFull, nextNew,
      fullName: nextFull ? MOON_NAMES[nextFull.getMonth()] + " Moon" : null,
      rise: riseSet("Moon", obs, +1, t, 2),
      set: riseSet("Moon", obs, -1, t, 2)
    };
  }
  /* Rise/set nearest to a window, for a tidy "up from … to …" line. */
  function moonWindow(start, end, place) {
    const obs = observer(place);
    const up = [];
    let inUp = false, from = null;
    for (let ms = +start; ms <= +end; ms += 10 * MIN) {
      const t = new Date(ms);
      const a = horizontal("Moon", t, obs).alt;
      if (a > 0 && !inUp) { inUp = true; from = t; }
      if (a <= 0 && inUp) { inUp = false; up.push([from, t]); }
    }
    if (inUp) up.push([from, new Date(+end)]);
    return up;
  }

  /* SVG path for the lit part of a Moon of radius r centred on 0,0. */
  function moonPath(angle, r, south) {
    const phi = ((angle % 360) + 360) % 360;
    const k = Math.cos(phi * RAD);         // +1 new, 0 quarter, -1 full
    const rx = Math.abs(k) * r;
    const waxing = phi < 180;
    const crescent = k > 0;                 // less than half lit
    // Northern hemisphere: waxing is lit on the right.
    let rightLit = waxing;
    if (south) rightLit = !rightLit;
    const outer = rightLit ? 1 : 0;
    let inner;
    if (rightLit) inner = crescent ? 0 : 1;
    else inner = crescent ? 1 : 0;
    if (phi < 0.5 || phi > 359.5) return "";
    return "M0," + (-r) + " A" + r + "," + r + " 0 0 " + outer + " 0," + r +
      " A" + rx.toFixed(3) + "," + r + " 0 0 " + inner + " 0," + (-r) + " Z";
  }

  /* ── tonight ──────────────────────────────────────────────────────── */
  /* "Tonight" is the coming dark, or the dark we are in. */
  function nightWindow(now, place) {
    const obs = observer(place);
    const today = dayInfo(now, place);
    const yest = dayInfo(addDays(now, -1), place);
    const tom = dayInfo(addDays(now, 1), place);
    let start, end;
    const dawnToday = today.civilDawn || today.sunrise;
    if (dawnToday && now < dawnToday) { start = yest.civilDusk || yest.sunset; end = dawnToday; }
    else { start = today.civilDusk || today.sunset; end = tom.civilDawn || tom.sunrise; }
    if (!start || !end) {   // no proper dusk: summer far north
      start = atLocal(now, 22 * 60); end = new Date(+start + 8 * HOUR);
    }
    const astroStart = (dawnToday && now < dawnToday) ? yest.astroDusk : today.astroDusk;
    const astroEnd = (dawnToday && now < dawnToday) ? today.astroDawn : tom.astroDawn;
    return { start, end, astroStart, astroEnd, obs };
  }

  const COMPASS = ["north", "north-north-east", "north-east", "east-north-east", "east", "east-south-east", "south-east", "south-south-east",
    "south", "south-south-west", "south-west", "west-south-west", "west", "west-north-west", "north-west", "north-north-west"];
  const COMPASS_SHORT = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
  function compass(az) { return COMPASS[Math.round(((az % 360) + 360) % 360 / 22.5) % 16]; }
  function compassShort(az) { return COMPASS_SHORT[Math.round(((az % 360) + 360) % 360 / 22.5) % 16]; }
  function simpleDir(az) { return ["north", "north-east", "east", "south-east", "south", "south-west", "west", "north-west"][Math.round(((az % 360) + 360) % 360 / 45) % 8]; }

  function brightnessWords(mag) {
    if (mag < -3) return "Dazzling. Only the Moon beats it.";
    if (mag < -1.8) return "Very bright, steady, no twinkle.";
    if (mag < -0.5) return "Bright and easy to spot.";
    if (mag < 1.2) return "Easy once you know where to look.";
    return "Faint. Needs a dark spot.";
  }
  const PLANET_NOTE = {
    Mercury: "Low and brief. Look just after sunset or before sunrise.",
    Venus: "The 'evening star' or 'morning star'.",
    Mars: "Look for a red-orange tint.",
    Jupiter: "Binoculars show up to four moons as tiny dots.",
    Saturn: "Any small telescope shows the rings."
  };

  function planetsTonight(now, place) {
    const nw = nightWindow(now, place);
    const obs = nw.obs;
    const out = [];
    ["Venus", "Jupiter", "Mars", "Saturn", "Mercury"].forEach(body => {
      const minAlt = body === "Mercury" || body === "Venus" ? 4 : 8;
      let first = null, last = null, best = null;
      for (let ms = +nw.start; ms <= +nw.end; ms += 10 * MIN) {
        const t = new Date(ms);
        const p = horizontal(body, t, obs);
        if (p.alt >= minAlt && sunAlt(t, obs) <= -5) {
          if (!first) first = { t, ...p };
          last = { t, ...p };
          if (!best || p.alt > best.alt) best = { t, ...p };
        }
      }
      if (!best) return;
      const mag = A.Illumination(body, best.t).mag;
      let con = "";
      try { con = A.Constellation(best.ra, best.dec).name; } catch (e) { }
      out.push({
        body, mag, first, last, best, constellation: con,
        words: brightnessWords(mag), note: PLANET_NOTE[body],
        durationH: (last.t - first.t) / HOUR
      });
    });
    return out.sort((a, b) => a.mag - b.mag);
  }

  /* ── meteor showers (peak dates are fixed to within a day) ──────── */
  const SHOWERS = [
    { name: "Quadrantids", m: 0, d: 3, zhr: 110, tip: "Short, sharp peak. Best before dawn, look north-east." },
    { name: "Lyrids", m: 3, d: 22, zhr: 18, tip: "Best after midnight." },
    { name: "Eta Aquariids", m: 4, d: 6, zhr: 50, tip: "Low from the UK. Try the hour before dawn." },
    { name: "Perseids", m: 7, d: 12, zhr: 100, tip: "The big summer one. Good from 11pm, best before dawn." },
    { name: "Draconids", m: 9, d: 8, zhr: 10, tip: "Unusually, best in the evening." },
    { name: "Orionids", m: 9, d: 21, zhr: 20, tip: "Debris from Halley's Comet. Best after midnight." },
    { name: "Leonids", m: 10, d: 17, zhr: 15, tip: "Fast meteors. Best after midnight." },
    { name: "Geminids", m: 11, d: 14, zhr: 150, tip: "The best of the year. Good from 9pm, all night." },
    { name: "Ursids", m: 11, d: 22, zhr: 10, tip: "Quiet, but up all night near the Plough." }
  ];
  function nextShower(now) {
    const today = startOfDay(now);
    const list = [];
    [now.getFullYear(), now.getFullYear() + 1].forEach(y => SHOWERS.forEach(s => {
      const peak = new Date(y, s.m, s.d, 2, 0, 0);
      if (startOfDay(peak) >= addDays(today, -1)) list.push({ ...s, peak });
    }));
    list.sort((a, b) => a.peak - b.peak);
    const s = list[0];
    const moonFrac = A.Illumination("Moon", s.peak).phase_fraction;
    s.days = daysBetween(today, s.peak);
    s.moonFrac = moonFrac;
    s.moonVerdict = moonFrac < 0.25 ? "Dark Moon: good year for it." : moonFrac < 0.6 ? "Some moonlight. Still worth a look." : "Bright Moon washes out the faint ones.";
    return s;
  }

  /* ── eclipses you can actually see from here ─────────────────────── */
  function nextEclipses(now, place) {
    const obs = observer(place);
    const res = {};
    try {
      let s = A.SearchLocalSolarEclipse(now, obs);
      for (let i = 0; i < 12 && s; i++) {
        if (s.peak.altitude > 2) { res.solar = { kind: s.kind, date: s.peak.time.date, obscuration: s.obscuration, alt: s.peak.altitude }; break; }
        s = A.NextLocalSolarEclipse(s.peak.time, obs);
      }
    } catch (e) { }
    try {
      let l = A.SearchLunarEclipse(now);
      for (let i = 0; i < 12 && l; i++) {
        const alt = horizontal("Moon", l.peak.date, obs).alt;
        if (alt > 3 && l.kind !== "penumbral") { res.lunar = { kind: l.kind, date: l.peak.date, alt }; break; }
        l = A.NextLunarEclipse(l.peak);
      }
    } catch (e) { }
    return res;
  }

  /* ── weather scoring (only if the person switched forecasts on) ──── */
  function scoreHours(hours, place) {
    // hours: [{t: Date, cloud: %, rain: %, temp: °C}]
    return hours.map(h => {
      const alt = fastSunAlt(+h.t + 30 * MIN, place.lat, place.lon);
      const sun = Math.max(0, Math.sin(Math.max(0, alt) * RAD));
      const score = alt <= 0 ? 0 : sun * (1 - 0.7 * h.cloud / 100) * (1 - 0.85 * (h.rain || 0) / 100);
      return { ...h, alt, score };
    });
  }

  root.Sky = {
    RAD, MIN, HOUR, DAY,
    startOfDay, addDays, atLocal, minutesOfDay, dayKey, sameDay, daysBetween, hm,
    fastSunAlt, ringColor, skyColors, rgb,
    observer, horizontal, sunAlt, dayInfo, milestones, seasonStory,
    moonInfo, moonWindow, moonPath, phaseName,
    nightWindow, planetsTonight, compass, compassShort, simpleDir,
    nextShower, nextEclipses, scoreHours
  };
})(typeof window !== "undefined" ? window : globalThis);
