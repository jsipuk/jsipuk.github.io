/* Daylight: the weather.
   Only used if the person switches the weather on. Forecasts come from
   Open-Meteo (free, no key, no cookies). Location is rounded to ~10 km. */
(function (root) {
  "use strict";

  /* WMO weather codes → words and an icon kind. */
  const WMO = {
    0: ["Clear", "clear"], 1: ["Mostly clear", "clear"], 2: ["Partly cloudy", "partly"], 3: ["Cloudy", "cloud"],
    45: ["Fog", "fog"], 48: ["Freezing fog", "fog"],
    51: ["Light drizzle", "drizzle"], 53: ["Drizzle", "drizzle"], 55: ["Heavy drizzle", "drizzle"],
    56: ["Freezing drizzle", "drizzle"], 57: ["Freezing drizzle", "drizzle"],
    61: ["Light rain", "rain"], 63: ["Rain", "rain"], 65: ["Heavy rain", "rain"],
    66: ["Freezing rain", "rain"], 67: ["Freezing rain", "rain"],
    71: ["Light snow", "snow"], 73: ["Snow", "snow"], 75: ["Heavy snow", "snow"], 77: ["Snow grains", "snow"],
    80: ["Light showers", "showers"], 81: ["Showers", "showers"], 82: ["Heavy showers", "showers"],
    85: ["Snow showers", "snow"], 86: ["Heavy snow showers", "snow"],
    95: ["Thunderstorm", "thunder"], 96: ["Thunder and hail", "thunder"], 99: ["Thunder and hail", "thunder"]
  };
  function describe(code) { return WMO[code] || ["Unsettled", "cloud"]; }
  const WET = new Set(["drizzle", "rain", "showers", "snow", "thunder"]);

  /* ── icons (32×32) ───────────────────────────────────────────────── */
  const CLOUD = "M6 18.5h11.5a4.5 4.5 0 0 0 .4-8.98A6.5 6.5 0 0 0 5.6 11 3.75 3.75 0 0 0 6 18.5Z";
  function sun(cx, cy, r) {
    let s = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#ffd27a"/>`;
    for (let i = 0; i < 8; i++) {
      const a = i * Math.PI / 4, r1 = r + 2.2, r2 = r + 4.4;
      s += `<line x1="${(cx + r1 * Math.cos(a)).toFixed(1)}" y1="${(cy + r1 * Math.sin(a)).toFixed(1)}" x2="${(cx + r2 * Math.cos(a)).toFixed(1)}" y2="${(cy + r2 * Math.sin(a)).toFixed(1)}" stroke="#ffd27a" stroke-width="2" stroke-linecap="round"/>`;
    }
    return s;
  }
  function moon(cx, cy, r) {
    return `<path transform="translate(${cx},${cy}) rotate(-25)" d="M0,${-r} A${r},${r} 0 0 0 0,${r} A${(r * .55).toFixed(2)},${r} 0 0 1 0,${-r}Z" fill="#ece8dc"/>`;
  }
  function cloud(x, y, s, fill) { return `<path transform="translate(${x},${y}) scale(${s})" d="${CLOUD}" fill="${fill || "#e9edf5"}"/>`; }
  function drops(xs, y1, y2, col, dash) {
    return xs.map(x => `<line x1="${x}" y1="${y1}" x2="${x - 2}" y2="${y2}" stroke="${col}" stroke-width="2.2" stroke-linecap="round"${dash ? ' stroke-dasharray="0.1 4"' : ""}/>`).join("");
  }
  function icon(kind, isDay) {
    const orb = (cx, cy, r) => isDay ? sun(cx, cy, r) : moon(cx, cy, r + 1);
    let g;
    switch (kind) {
      case "clear": g = isDay ? sun(16, 16, 6.5) : moon(16, 16, 9); break;
      case "partly": g = orb(11.5, 11.5, 4.6) + cloud(6.5, 7, 1, "#eef1f7"); break;
      case "cloud": g = cloud(5, 2.5, .95, "#9aa4b8") + cloud(2.5, 6, 1.12); break;
      case "fog": g = cloud(4, 0, 1.05, "#c9cfdb") + [21.5, 25.5, 29].map((y, i) => `<line x1="${5 + i * 2}" y1="${y}" x2="${27 - i}" y2="${y}" stroke="#c9cfdb" stroke-width="2" stroke-linecap="round"/>`).join(""); break;
      case "drizzle": g = cloud(2.5, -1, 1.12) + drops([11, 16.5, 22], 23, 30, "#8cc4ff", true); break;
      case "rain": g = cloud(2.5, -1.5, 1.12) + drops([11, 16.5, 22], 22.5, 29, "#8cc4ff"); break;
      case "showers": g = orb(10.5, 9.5, 4) + cloud(6, 4, 1, "#eef1f7") + drops([14, 19.5, 25], 24, 29.5, "#8cc4ff"); break;
      case "snow": g = cloud(2.5, -1.5, 1.12) + [11, 16.5, 22].map((x, i) => `<circle cx="${x}" cy="${i % 2 ? 28 : 25}" r="1.9" fill="#fff"/>`).join(""); break;
      case "thunder": g = cloud(2.5, -2, 1.12, "#aab3c6") + '<path d="M17.5 18.5l-4.5 6.5h4l-2 6 6.5-8h-4l2-4.5Z" fill="#ffd27a"/>'; break;
      default: g = cloud(2.5, 4, 1.12);
    }
    return `<svg viewBox="0 0 32 32" aria-hidden="true">${g}</svg>`;
  }

  /* ── request + parse ─────────────────────────────────────────────── */
  function url(lat, lon) {
    return "https://api.open-meteo.com/v1/forecast?latitude=" + lat + "&longitude=" + lon +
      "&current=temperature_2m,apparent_temperature,is_day,precipitation,weather_code,cloud_cover,wind_speed_10m,wind_gusts_10m" +
      "&hourly=temperature_2m,apparent_temperature,precipitation_probability,precipitation,weather_code,cloud_cover,wind_gusts_10m,is_day" +
      "&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_gusts_10m_max,uv_index_max" +
      "&wind_speed_unit=mph&timezone=auto&timeformat=unixtime&forecast_days=7";
  }
  const num = v => (typeof v === "number" && isFinite(v) ? v : null);
  function col(obj, key, i) { return obj && Array.isArray(obj[key]) ? num(obj[key][i]) : null; }

  function parse(j, fetchedAt) {
    if (!j || j.error) throw new Error(j && j.reason ? j.reason : "Bad forecast");
    const H = j.hourly || {}, D = j.daily || {}, C = j.current || {};
    const hours = (H.time || []).map((s, i) => ({
      t: new Date(s * 1000),
      temp: col(H, "temperature_2m", i), feels: col(H, "apparent_temperature", i),
      rain: col(H, "precipitation_probability", i) || 0, precip: col(H, "precipitation", i) || 0,
      code: col(H, "weather_code", i), cloud: col(H, "cloud_cover", i) || 0,
      gust: col(H, "wind_gusts_10m", i), isDay: col(H, "is_day", i) !== 0
    })).filter(h => h.temp != null);
    const days = (D.time || []).map((s, i) => {
      const t = new Date(s * 1000);
      // Daily rows are local midnights; normalise to this device's date.
      const date = new Date(t.getFullYear(), t.getMonth(), t.getDate() + (t.getHours() >= 12 ? 1 : 0));
      return {
        date, code: col(D, "weather_code", i), max: col(D, "temperature_2m_max", i), min: col(D, "temperature_2m_min", i),
        rain: col(D, "precipitation_probability_max", i) || 0, gust: col(D, "wind_gusts_10m_max", i), uv: col(D, "uv_index_max", i)
      };
    }).filter(d => d.max != null);
    const current = C.temperature_2m != null ? {
      t: C.time ? new Date(C.time * 1000) : new Date(fetchedAt),
      temp: num(C.temperature_2m), feels: num(C.apparent_temperature), code: num(C.weather_code),
      isDay: C.is_day !== 0, cloud: num(C.cloud_cover) || 0, wind: num(C.wind_speed_10m), gust: num(C.wind_gusts_10m),
      precip: num(C.precipitation) || 0
    } : null;
    return { at: fetchedAt, current, hours, days };
  }

  /* The hour row that covers a moment. */
  function hourAt(wx, t) {
    if (!wx || !wx.hours) return null;
    let best = null;
    for (const h of wx.hours) { if (h.t <= t && t - h.t < 3600e3) best = h; }
    return best;
  }

  /* Current conditions: the live block if it's fresh, else the hour row. */
  function nowAt(wx, t) {
    if (wx && wx.current && Math.abs(t - wx.current.t) < 90 * 60e3) return wx.current;
    const h = hourAt(wx, t);
    return h ? { t: h.t, temp: h.temp, feels: h.feels, code: h.code, isDay: h.isDay, cloud: h.cloud, gust: h.gust, wind: null, precip: h.precip } : null;
  }

  /* ── plain-English advice ────────────────────────────────────────── */
  const isWet = h => h.rain >= 50 && (h.precip >= 0.1 || WET.has(describe(h.code)[1]));
  function hhmm(d) { return (d.getHours() < 10 ? "0" : "") + d.getHours() + ":00"; }

  /* When does it start or stop raining, in the next 12 hours? */
  function rainLine(wx, t) {
    if (!wx || !wx.hours) return "";
    const next = wx.hours.filter(h => h.t > new Date(+t - 3600e3) && h.t < new Date(+t + 12 * 3600e3));
    if (!next.length) return "";
    const wetNow = isWet(next[0]) || (wx.current && Math.abs(t - wx.current.t) < 90 * 60e3 && wx.current.precip > 0.05);
    if (wetNow) {
      const dry = next.slice(1).find(h => !isWet(h));
      return dry ? "Wet right now, drying up around " + hhmm(dry.t) + "." : "Wet for the next 12 hours.";
    }
    const wet = next.find(isWet);
    if (!wet) return "Dry for the next 12 hours.";
    const kind = describe(wet.code)[1];
    const word = kind === "snow" ? "Snow" : kind === "thunder" ? "Thunder" : kind === "showers" ? "Showers" : "Rain";
    return word + " likely from " + hhmm(wet.t) + ".";
  }

  /* What to wear for the rest of the daylight (or tomorrow, after dark). */
  function wear(wx, t, until) {
    if (!wx || !wx.hours) return null;
    let from = t, to = until;
    let label = "Today";
    if (!to || to - t < 90 * 60e3) {
      const tm = new Date(t); tm.setDate(tm.getDate() + 1); tm.setHours(8, 0, 0, 0);
      from = tm; to = new Date(tm); to.setHours(17);
      label = "Tomorrow";
    }
    const hrs = wx.hours.filter(h => h.t >= new Date(+from - 3600e3) && h.t <= to);
    if (!hrs.length) return null;
    const feels = Math.min(...hrs.map(h => h.feels != null ? h.feels : h.temp));
    const warm = Math.max(...hrs.map(h => h.temp));
    const rain = Math.max(...hrs.map(h => h.rain));
    const gust = Math.max(...hrs.map(h => h.gust || 0));
    const snow = hrs.some(h => describe(h.code)[1] === "snow");
    const parts = [];
    if (feels < 2) parts.push("Big coat, hat and gloves");
    else if (feels < 8) parts.push("Warm coat");
    else if (feels < 13) parts.push("A jacket");
    else if (warm < 19) parts.push("A jumper should do");
    else parts.push("T-shirt weather");
    if (snow) parts.push("snow boots");
    else if (rain >= 60) parts.push("waterproofs");
    else if (rain >= 35) parts.push("maybe a brolly");
    let extra = "";
    if (gust >= 45) extra = " Very windy, gusts to " + Math.round(gust) + " mph.";
    else if (gust >= 32) extra = " Breezy.";
    const day = wx.days && wx.days.find(d => d.date.toDateString() === from.toDateString());
    if (day && day.uv != null && day.uv >= 5) extra += " Suncream: UV " + Math.round(day.uv) + ".";
    const text = (parts.length > 1 ? parts.slice(0, -1).join(", ") + " and " + parts[parts.length - 1] : parts[0]) + "." + extra;
    return { label, text };
  }

  root.Weather = { describe, icon, url, parse, hourAt, nowAt, rainLine, wear };
})(typeof window !== "undefined" ? window : globalThis);
