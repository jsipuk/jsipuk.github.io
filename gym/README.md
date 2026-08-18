# Gym by John

A private, offline gym workout app for iPhone. Plan a workout once, then walk
into the gym and train without having to remember the routine, the weight, the
reps, or how the app works.

It is a Progressive Web App: plain HTML, CSS and JavaScript, no build step, no
framework, no server, no account. Everything you record stays in IndexedDB on
your device.

---

## Running it locally

Any static web server will do. From this folder:

```bash
npx http-server . -p 8000 -c-1
# or
python3 -m http.server 8000
```

Then open <http://localhost:8000>.

Opening `index.html` straight from the file system will **not** work: ES modules
and service workers both need `http://` or `https://`.

For the installed-app behaviour (Add to Home Screen, offline, standalone
window) the page must be served over HTTPS, or from `localhost`.

---

## Installing on iPhone

1. Open the app in **Safari** (not Chrome — only Safari can install a web app on iOS).
2. Tap the **Share** button.
3. Choose **Add to Home Screen**.
4. Name it and tap **Add**.

It then launches full screen with no browser chrome, works with no signal, and
keeps its own storage. The first launch needs a connection so the service
worker can cache the app; after that it is fully offline.

---

## How the PWA works

| Piece | File | What it does |
| --- | --- | --- |
| Manifest | `manifest.webmanifest` | Name, icons, `display: standalone`, portrait, theme colours |
| Service worker | `service-worker.js` | Precaches the whole app shell on install |
| Icons | `assets/icons/` | 192/512 PNG, a maskable 512, and a 180px Apple touch icon |

The service worker uses two strategies:

- **Navigations** — network first, falling back to the cached shell. A new
  deploy is picked up as soon as you are online, and the app still opens when
  you are not.
- **Everything else** — cache first, refreshed in the background.

`CACHE` in `service-worker.js` is versioned (`gym-by-john-v1.0.0`). Bump it
whenever files change so old copies are cleared out; the app shows a "new
version is ready" toast with a Reload action when an update installs.

---

## Project structure

```
gym/
├── index.html               app shell, splash, mount points
├── manifest.webmanifest
├── service-worker.js
│
├── css/
│   ├── reset.css            small reset, [hidden] fix, reduced-motion
│   ├── variables.css        design tokens, light/dark/system palettes
│   ├── components.css       buttons, rows, sheets, steppers, toasts, keypad
│   └── app.css              shell layout and per-screen styles
│
├── js/
│   ├── app.js               boot, theme, routing, tab bar, wake lock, SW
│   ├── app-info.js          version string
│   ├── router.js            hash routing
│   ├── db.js                IndexedDB wrapper (+ in-memory fallback)
│   ├── models.js            data shapes, item status rules, defaults
│   ├── state.js             the single store: settings, workouts, sessions
│   ├── session.js           everything that happens during a workout
│   ├── timer.js             timestamp-based rest timer, chime, vibration
│   ├── storage.js           backup export, validation and import
│   ├── utils.js             DOM helper, icon set, formatting
│   └── screens/             one module per screen
│
├── components/
│   ├── header.js            the top bar
│   ├── controls.js          sheets, toasts, keypad, steppers, switches
│   ├── exercise-screen.js   the active exercise screen
│   ├── workout-menu.js      the item list and the one-tap quick menu
│   ├── rest-timer.js        inline rest panel and the floating rest bar
│   └── image.js             image references and the placeholder fallback
│
├── assets/
│   ├── icons/               app icons and UI placeholders
│   └── exercises/           your artwork, the placeholders, and manifest.json
│
└── tools/
    └── sync-assets.mjs      regenerates the artwork manifest and precache list
```

Screens are plain modules that export `render(params)` and return
`{ el, destroy? }`. `app.js` mounts one at a time. There is no virtual DOM and
no reactive framework: screens subscribe to the store and rebuild themselves,
except the editors, which repaint only the controls that changed so that typing
is never interrupted.

---

## IndexedDB structure

Database `gym-by-john`, version 1:

| Store | Key | Contents |
| --- | --- | --- |
| `workouts` | `id` | Workout plans, with their exercises embedded |
| `sessions` | `id` | Finished workouts (History) |
| `activeSession` | `"current"` | The one workout in progress, if any |
| `settings` | `key` | One row per setting |
| `images` | `id` | Exercise images, stored as blobs |

### Workout

```js
{
  id, name, description,
  warmup:  { name, durationSeconds, instructions, notes, image },
  exercises: [{
    id, name, image,
    sets, targetReps, repRange,        // repRange is { min, max } or null
    defaultWeight, weightIncrement, restSeconds,
    instructions, notes, sortOrder
  }],
  cooldown: { name, durationSeconds, instructions, notes, image },
  archived, sortOrder, createdAt, updatedAt
}
```

### Session

```js
{
  id, workoutId, workoutName,
  startedAt, finishedAt, status: "active" | "complete",
  unit, currentItemId,
  items: [{
    id, type: "warmup" | "exercise" | "cooldown", name, image,
    // exercises
    targetSets, targetReps, repRange, weightIncrement, restSeconds,
    sets: [{ setNumber, weight, reps, unit, completedAt }],
    draft: { weight, reps },           // the set in progress
    touched, sessionNote,
    // warm-up and cool-down
    durationSeconds, completedAt
  }],
  rest: { itemId, durationSeconds, startedAt, endsAt } | null,
  difficulty, workoutNote, summary
}
```

The warm-up and cool-down live in the same `items` array as the exercises, so
Previous/Next is simple index arithmetic and the quick menu is one list.

Targets are **copied into the session** when it starts. "Change target today"
and "Add a set" therefore change today only and can never leak back into the
saved plan.

---

## How workout persistence works

- The active session is written to `activeSession` after **every** meaningful
  interaction: a set completed, a weight nudged, a note typed, an item opened.
  Writes are queued so two quick taps cannot interleave transactions, and the
  queue is flushed when the page is hidden or closed.
- Reopening the app finds that record and offers **Resume workout** on Today,
  restoring the current exercise, the current set, every set already recorded,
  weights, reps, notes, and the running rest timer.
- The rest timer is stored as a **timestamp** (`endsAt`), not a countdown. Lock
  the phone, switch apps, or reload the page and the remaining time is still
  correct. The on-screen ticking is only repainting.
- An exercise is complete only when every required set is recorded. Anything
  started but unfinished shows as *in progress* and never gets a tick.
- Finishing moves the session into `sessions` and clears `activeSession` in the
  same pass.

---

## Adding exercise artwork

Name the file after the exercise, drop it in `assets/exercises/`, and the app
uses it. Nothing in the workout data changes.

| Exercise name | File |
| --- | --- |
| Bench Press | `bench-press.png` |
| Incline Dumbbell Press | `incline-dumbbell-press.png` |
| Cable Fly | `cable-fly.png` |
| Warm Up | `warm-up.png` |

Lower case, spaces become hyphens, punctuation and accents are ignored, `&`
becomes "and". `.png`, `.jpg`, `.webp`, `.svg` and `.gif` all work. Landscape at
roughly 16:10 suits the exercise screen best; images are shown with
`object-fit: contain`, so nothing is ever cropped. The exercise editor prints
the exact filename it is looking for, so you never have to guess.

After adding, renaming or deleting files:

```bash
node tools/sync-assets.mjs
```

That regenerates `assets/exercises/manifest.json` (the name-to-file map the app
reads at launch) and the `PRECACHE` list in `service-worker.js` (so the artwork
works offline). Then bump `CACHE` in `service-worker.js` so installed copies
pick the change up. `--check` verifies without writing, for CI.

### Which picture wins

1. An image attached in the app through the exercise editor — stored as a blob
   in IndexedDB on that device, and included in a backup export.
2. Artwork in `assets/exercises/` whose filename matches the exercise name.
3. The placeholder.

Removing an attached image falls back to the folder, then to the placeholder.
`assets/exercises/README.md` keeps a copy of these rules beside the files.

## Export and import

**Settings → Backup and restore.**

*Export* writes one JSON file containing every workout, every session, your
settings, and every stored image inlined as a data URL. On iPhone this opens
the Share sheet (so you can drop it into Files or iCloud Drive); elsewhere it
downloads.

*Import* reads the file, then checks it before touching anything: the schema
version, the shape of each list, and every workout, session, setting and image
in it. If any check fails you get a plain list of what is wrong and **your
current data is left exactly as it was**. Only a fully valid backup gets as far
as the confirmation sheet, which shows what it contains before replacing what
is on the device.

---

## Known iOS and PWA limitations

- **Safari only.** Add to Home Screen exists only in Safari on iOS.
- **No background timers.** iOS suspends a backgrounded web app, so the rest
  timer cannot chime while you are in another app. It is timestamp-based, so
  the time is always right when you come back — but a rest that finished while
  you were away simply clears, rather than buzzing late.
- **No vibration.** `navigator.vibrate` is not implemented in Safari. The
  setting is there for browsers that do support it (and, honestly, for the day
  Safari does).
- **Screen wake lock** needs iOS 16.4 or later. Where it is unavailable the
  setting has no effect and says so.
- **Storage can be evicted.** iOS may clear a web app's storage after long
  periods of disuse. The app asks for persistent storage on launch, which
  usually prevents this once the app is installed to the Home Screen — export a
  backup now and then anyway.
- **Private browsing** can block IndexedDB entirely. The app still runs, using
  memory only, and warns you that nothing will be saved.
- **Reinstalling** the Home Screen app can start it with fresh storage. Export
  first if you care about the history.

---

## Notes on a few decisions

- **kg and lb are labels, not conversions.** Changing the unit changes what new
  entries are labelled; it does not silently rewrite numbers you have already
  recorded. Each recorded set keeps the unit it was logged with.
- **Numbers are typed on a built-in keypad**, not the system keyboard: bigger
  targets, no layout shift, and nothing covering the screen mid-set.
- **Routine actions have no confirmation dialogue.** Deleting an exercise or a
  set gives you an Undo toast instead. Only genuinely destructive, unrecoverable
  actions (discard this workout, reset the app) ask first.
- **The effort rating is five stars**, filled up to the score and outlined
  beyond it, so 3 out of 5 reads as three filled stars and two empty ones. The
  shape carries the meaning rather than the colour, and the word ("Moderate")
  sits underneath. The star is drawn in `utils.js`, so swapping it for
  something else is a one-place change.

---

## Acceptance checks

The six scenarios in the specification were driven through a real browser
(Chromium at iPhone 13 size) and all pass:

| Scenario | Result |
| --- | --- |
| A — normal workout, start to saved history | Warm-up, 7 exercises, cool-down, rating, note, all present in History |
| B — machine occupied | Part-finished exercise stays *in progress*, jumping away and back restores the exact set, weight and reps |
| C — multiple sets | Set 1 starts the timer, set 2 inherits weight and reps, the exercise completes only after set 3 |
| D — application closes | Relaunching offers Resume workout and restores the session byte for byte |
| E — offline | Loads and logs a full workout with the network disabled |
| F — dark mode | Every screen readable, preference survives a restart |

### Screen sizes

The exercise screen was measured on every iPhone size still in wide use, with
the Dynamic Island and home-indicator insets applied. On all of them the name,
picture, target, current set, weight, reps and Complete Set fit without
scrolling, and no control sits under either inset:

| Device | CSS points | Result |
| --- | --- | --- |
| iPhone SE (2nd/3rd gen) | 375 × 667 | fits, no scroll |
| iPhone 13 mini | 375 × 812 | fits, no scroll |
| iPhone 13 / 14 / 15 | 390 × 844 | fits, no scroll |
| iPhone 16 | 393 × 852 | fits, no scroll |
| **iPhone 16 Pro** | **402 × 874** (2622 × 1206 at 3×) | fits, no scroll |
| iPhone 16 Pro Max | 440 × 956 | fits, no scroll |

On a short screen the picture gives up height first, down to a floor, so the
weight and reps controls are never the thing that gets pushed off.

Accessibility was checked in the same pass: every control has an accessible
name, every field has a label, nothing has a tap target under 44px, Tab and
Enter and Escape work throughout, and nothing overflows horizontally with text
scaled to 130%.

---

Version 1.0.1.
