// Daylight checks. Run: node daylight/test/run.js
// Reference values are from timeanddate.com / HM Nautical Almanac Office tables for London.
process.env.TZ = "Europe/London";
const fs = require("fs"), path = require("path"), vm = require("vm");
const dir = path.join(__dirname, "..");
const ctx = vm.createContext({ console, Date, Math });
ctx.globalThis = ctx;
vm.runInContext(fs.readFileSync(path.join(dir, "astronomy.min.js"), "utf8"), ctx);
vm.runInContext(fs.readFileSync(path.join(dir, "sky.js"), "utf8"), ctx);
vm.runInContext(fs.readFileSync(path.join(dir, "weather.js"), "utf8"), ctx);
const S = ctx.Sky, W = ctx.Weather;

let fails = 0, passes = 0;
function ok(cond, msg) { if (cond) passes++; else { fails++; console.log("FAIL", msg); } }
function near(a, b, tol, msg) { ok(Math.abs(a - b) <= tol, msg + ` (got ${a}, want ${b} ±${tol})`); }
const mins = d => d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60;
const london = { lat: 51.5074, lon: -0.1278, name: "London" };
const edinburgh = { lat: 55.9533, lon: -3.1883, name: "Edinburgh" };

// 1. Sunrise and sunset, London, 8 Nov 2026: 07:08 / 16:21.
const d = S.dayInfo(new Date(2026, 10, 8, 12), london);
near(mins(d.sunrise), 7 * 60 + 8, 2, "London sunrise 8 Nov");
near(mins(d.sunset), 16 * 60 + 21, 2, "London sunset 8 Nov");
ok(d.civilDawn < d.sunrise && d.sunset < d.civilDusk, "twilight order");
ok(d.goldenAmEnd > d.sunrise && d.goldenPmStart < d.sunset, "golden hour order");
near(d.noonAlt, 21.6, 0.6, "London noon altitude 8 Nov");

// 2. Midsummer, London: 04:43 / 21:21 BST, about 16h 38m.
const j = S.dayInfo(new Date(2026, 5, 21, 12), london);
near(mins(j.sunrise), 4 * 60 + 43, 2, "London sunrise 21 Jun");
near(mins(j.sunset), 21 * 60 + 21, 2, "London sunset 21 Jun");
ok(j.astroDusk === null, "no astronomical night in London at midsummer");

// 3. Fast Sun agrees with the precise one.
const obs = S.observer(london);
for (let h = 0; h < 24; h += 3) {
  const t = new Date(2026, 10, 8, h, 17);
  const precise = S.horizontal("Sun", t, obs).alt;
  near(S.fastSunAlt(+t, london.lat, london.lon), precise, 0.7, "fast sun at " + h + ":17"); // precise includes refraction
}

// 4. Milestones from 8 Nov 2026.
const ms = S.milestones(new Date(2026, 10, 8), london, 200);
const find = t => ms.find(m => m.title === t);
const es = find("Earliest sunset");
ok(es && es.date.getMonth() === 11 && es.date.getDate() >= 11 && es.date.getDate() <= 14, "earliest sunset ~12 Dec: " + (es && es.date.toDateString()));
const sd = find("Shortest day");
ok(sd && sd.date.getDate() === 21 && sd.date.getMonth() === 11, "shortest day 21 Dec");
const lr = find("Latest sunrise");
ok(lr && ((lr.date.getMonth() === 11 && lr.date.getDate() >= 28) || (lr.date.getMonth() === 0 && lr.date.getDate() <= 3)), "latest sunrise ~30 Dec: " + (lr && lr.date.toDateString()));
const cf = find("Clocks go forward");
ok(cf && cf.date.getMonth() === 2 && cf.date.getDate() === 28, "clocks forward 28 Mar 2027");
const f5 = find("First sunset after 5pm");
ok(f5 && f5.date.getMonth() === 1, "first 5pm sunset in Feb: " + (f5 && f5.date.toDateString()));
const l4 = find("Last sunset after 4pm");
ok(l4 && l4.date.getMonth() === 10, "last 4pm sunset in Nov: " + (l4 && l4.date.toDateString()));
ok(ms.every((m, i) => i === 0 || ms[i - 1].date <= m.date), "milestones sorted");
console.log("  milestones:", ms.slice(0, 8).map(m => m.date.toDateString().slice(4, 10) + " " + m.title).join(" | "));

// 5. Season story.
const st = S.seasonStory(new Date(2026, 10, 8, 12), london);
ok(!st.growing && st.nextKind === "dec" && st.daysToNext === 43, "43 days to the shortest day");
const st2 = S.seasonStory(new Date(2027, 0, 10, 12), london);
ok(st2.growing && st2.changeSincePrev > 15 * 60e3, "January: gaining daylight since solstice");

// 6. Moon.
const m = S.moonInfo(new Date(2026, 10, 8, 20), london);
ok(m.fraction < 0.05 && m.name === "New Moon", "near new moon 8 Nov 2026: " + m.name + " " + m.fraction.toFixed(3));
ok(m.nextFull && m.nextFull.getMonth() === 10 && m.nextFull.getDate() === 24, "next full moon 24 Nov 2026: " + m.nextFull);
ok(m.fullName === "Beaver Moon", "November full moon name");
ok(S.moonPath(90, 10) !== "" && S.moonPath(0.1, 10) === "", "moon paths");

// 7. Planets, eclipses, showers produce sane output.
const pl = S.planetsTonight(new Date(2026, 10, 8, 18), london);
ok(pl.length >= 1, "at least one planet tonight: " + pl.map(p => p.body + " " + p.mag.toFixed(1) + " " + S.hm(p.first.t) + "-" + S.hm(p.last.t) + " " + p.constellation).join(", "));
ok(pl.every((p, i) => i === 0 || pl[i - 1].mag <= p.mag), "planets sorted by brightness");
const ec = S.nextEclipses(new Date(2026, 10, 8), london);
ok(ec.solar && ec.solar.date.getFullYear() === 2027 && ec.solar.date.getMonth() === 7, "next solar eclipse from London: 2 Aug 2027");
const sh = S.nextShower(new Date(2026, 10, 8));
ok(sh.name === "Leonids" && sh.days === 9, "next shower Leonids in 9 days");

// 8. Edinburgh is darker in winter than London.
const e = S.dayInfo(new Date(2026, 11, 21, 12), edinburgh), l = S.dayInfo(new Date(2026, 11, 21, 12), london);
ok(e.length < l.length, "Edinburgh shorter day at solstice");

// 9. Night window when it is already past midnight.
const nw = S.nightWindow(new Date(2026, 10, 9, 2), london);
ok(nw.start.getDate() === 8 && nw.end.getDate() === 9, "2am belongs to the night that started yesterday");

// 10. Weather scoring prefers a clear midday hour.
const hrs = [9, 12, 15, 20].map(h => ({ t: new Date(2026, 10, 8, h), cloud: h === 12 ? 10 : 90, rain: 0 }));
const sc = S.scoreHours(hrs, london);
ok(sc[1].score > sc[0].score && sc[1].score > sc[2].score && sc[3].score === 0, "scoring");

// 11. Sky calendar, 120 days from 8 Nov 2026.
const t0 = Date.now();
const ev = S.skyEvents(new Date(2026, 10, 8), london, 120);
console.log("  sky calendar: " + ev.length + " events in " + (Date.now() - t0) + "ms");
const has = (re, m, d) => ev.some(e => re.test(e.title) && e.date.getMonth() === m && (d == null || Math.abs(e.date.getDate() - d) <= 1));
ok(has(/Supermoon: Beaver Moon/, 10, 24), "supermoon 24 Nov 2026");
ok(has(/Geminids/, 11, 14), "Geminids 14 Dec");
ok(has(/Jupiter at its best/, 1, 11), "Jupiter opposition ~11 Feb 2027");
ok(has(/lunar eclipse/i, 1, 20), "penumbral lunar eclipse 20 Feb 2027");
ok(has(/Jupiter and Mars side by side/, 10, 16), "Jupiter-Mars conjunction mid Nov 2026");
ok(ev.every((e, i) => i === 0 || ev[i - 1].date <= e.date || e.far), "calendar sorted");

// 12. Weather parsing and advice.
const base = Date.UTC(2026, 10, 8) / 1000;
const hourly = { time: [], temperature_2m: [], apparent_temperature: [], precipitation_probability: [], precipitation: [], weather_code: [], cloud_cover: [], wind_gusts_10m: [], is_day: [] };
for (let i = 0; i < 48; i++) {
  const h = i % 24, wet = i >= 15 && i <= 17;
  hourly.time.push(base + i * 3600); hourly.temperature_2m.push(9); hourly.apparent_temperature.push(6);
  hourly.precipitation_probability.push(wet ? 80 : 5); hourly.precipitation.push(wet ? 1 : 0);
  hourly.weather_code.push(wet ? 61 : 3); hourly.cloud_cover.push(wet ? 100 : 60); hourly.wind_gusts_10m.push(20); hourly.is_day.push(h > 7 && h < 16 ? 1 : 0);
}
const wx = W.parse({ hourly, daily: { time: [base, base + 86400], weather_code: [61, 3], temperature_2m_max: [10, 9], temperature_2m_min: [4, 3], precipitation_probability_max: [80, 5], wind_gusts_10m_max: [20, 20], uv_index_max: [1, 1] }, current: { time: base + 9 * 3600, temperature_2m: 9, apparent_temperature: 6, weather_code: 3, is_day: 1, cloud_cover: 60, wind_speed_10m: 8, wind_gusts_10m: 20, precipitation: 0 } }, Date.now());
ok(wx.hours.length === 48 && wx.days.length === 2 && wx.current.temp === 9, "weather parses");
ok(wx.days[0].date.getDate() === 8, "daily rows land on the right date");
ok(W.rainLine(wx, new Date(2026, 10, 8, 9)) === "Rain likely from 15:00.", "rain timing: " + W.rainLine(wx, new Date(2026, 10, 8, 9)));
ok(/drying up around 18:00/.test(W.rainLine(wx, new Date(2026, 10, 8, 16, 10))), "rain stopping");
const wr = W.wear(wx, new Date(2026, 10, 8, 9), new Date(2026, 10, 8, 17));
ok(wr.label === "Today" && wr.text === "Warm coat and waterproofs.", "what to wear: " + wr.text);
ok(W.wear(wx, new Date(2026, 10, 8, 20), null).label === "Tomorrow", "after dark, advice is for tomorrow");
ok(W.describe(95)[1] === "thunder" && /<svg/.test(W.icon("rain", true)), "codes and icons");
let threw = false; try { W.parse({ error: true, reason: "bad" }, 0); } catch (e) { threw = true; }
ok(threw, "API errors are rejected");

console.log(`${passes} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
