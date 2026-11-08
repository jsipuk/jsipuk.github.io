# Daylight

A live sky clock for jsip.uk. Open it once a day and it tells you:

- **Weather** (opt-in): now, a plain "what to wear" line, when rain starts or stops, the next 24 hours with sunrise and sunset slotted in, and the week. Cloud from the forecast greys the sky background and hides the stars.
- **The one thing that matters now**: sunset in 2h 14m, golden hour, blue hour, or sunrise in 10h.
- **Today's light** as a 24-hour dial. Drag it to move through the day; the page background becomes the sky at that time.
- **Your light today**: sun's up, when it clears the rooftops, the peak (with your shadow length), golden hour, lights on.
- **The road back to light**: last 4pm sunset, earliest sunset, shortest day, latest sunrise, first 5pm sunset, clocks changing.
- **Tonight**: Moon phase and times, which planets are up and where, something to show the kids, the next meteor shower and the next eclipse you can see from where you are.
- **Sky calendar**: the next four months. Full moons and supermoons, meteor showers (with how much the Moon will spoil them), eclipses you can see from where you are, planets at their best, Mercury's good windows, the Moon passing close to a planet, and two planets side by side. Each one says where to look and when.
- **Your year of light**: every day of the year as a column. Tap one to visit it.

## Privacy

Everything is computed on the device from the date and a location. The location is a UK city you pick, or your own, rounded to about 1 km and kept in `localStorage`.

The weather is **off until you switch it on**. It's the only thing that makes the app use the network: it asks Open-Meteo for the forecast (current, hourly and 7-day), sending the location rounded to about 10 km, with no cookies or referrer. The last forecast is kept in `localStorage` so it still shows offline; the service worker never caches those requests.

## Files

| File | What it does |
| --- | --- |
| `sky.js` | All the sky maths: day info, milestones, Moon, planets, showers, eclipses, scoring. No DOM. |
| `weather.js` | Forecast request, parsing, icons, and the "what to wear" and rain-timing lines. No DOM. |
| `calendar-worker.js` | Runs the sky calendar off the main thread. Cached for the day. |
| `app.js` | The page: dial, sky background, weather, cards, calendar, year chart, settings. |
| `astronomy.min.js` | [Astronomy Engine](https://github.com/cosinekitty/astronomy) 2.1.19, MIT licence, vendored so it works offline. |
| `sw.js` | Offline cache, scoped to `daylight-` caches only. |
| `test/run.js` | `node daylight/test/run.js`. Checks sunrise, sunset, milestones, Moon, planets, eclipses and the sky calendar against published London values, plus the weather parsing and advice. |
