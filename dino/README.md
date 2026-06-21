# 🦕 Dino Expedition

A fun, fact-based dinosaur **learning game for children aged 5–10**. Children
explore real dinosaurs, dig up fossils, take a friendly quiz, and match
dinosaurs to the habitats where they belong — earning discovery badges as they go.

It is a **static, no-build web app** (plain HTML + CSS + vanilla JavaScript), so
it drops straight into this GitHub Pages site with zero tooling.

## Features

- **Camp (home)** – playful hub with a guided welcome the first time you visit.
- **Dino Explorer** – a field guide you can sort by time period, diet and habitat.
- **Field guide cards** – each creature has name, pronunciation, period, diet,
  size, habitat, a discovery fact, a *“What scientists think”* note, and a fun fact.
- **Fossil Dig** – a tap-to-uncover mini-game that reveals a hidden dinosaur.
- **Dino Detective** – an age-appropriate quiz with encouraging feedback.
- **Build a Habitat** – pick a dinosaur and send it to the right home.
- **Badges & progress** – discoveries and achievements saved in the browser.
- **For grown-ups** – learning goals, our factual approach, privacy notes and sources.

## Educational approach

- People and non-bird dinosaurs **never** lived at the same time.
- **Birds are living dinosaurs** (mainstream science).
- Uncertain ideas are flagged with *“Scientists think…”* / *“Evidence suggests…”*.
- Common mix-ups are gently corrected (e.g. Pteranodon is a flying reptile, not a dinosaur).
- Facts were checked against the Natural History Museum (London), the American
  Museum of Natural History, the Smithsonian, UC Museum of Paleontology and
  Encyclopaedia Britannica. See the in-app **For grown-ups** screen for links.

## Privacy

No accounts, no ads, no tracking, no analytics, no network calls. A child's name
and progress live only in this browser via `localStorage`, and can be cleared any
time from the **Badges** screen.

## Run locally

It's just static files — open `index.html` directly, or serve the folder:

```bash
# from the repo root
python3 -m http.server 8000
# then visit http://localhost:8000/dino/
```

## Deploy (GitHub Pages)

This folder is part of the `jsipuk.github.io` Pages site. Once committed and
pushed, it is live at:

- `https://jsip.uk/dino/` (custom domain), or
- `https://jsipuk.github.io/dino/`

No build step or workflow is required — GitHub Pages serves the files as-is.

## Files

| File         | Purpose                                            |
|--------------|----------------------------------------------------|
| `index.html` | App shell, top bar and bottom tab navigation.      |
| `style.css`  | Warm “field expedition” theme, responsive layout.  |
| `data.js`    | Dinosaur dataset, habitats, periods and sources.   |
| `app.js`     | Routing, screens, games, quiz and progress saving. |

## Adding a dinosaur

Add an object to the `DINOS` array in `data.js` (copy an existing one and edit
the fields). Include a `source` and use cautious wording in `scientistsThink`
for anything uncertain. It automatically appears in the explorer, quiz, dig and
habitat games.

## Adding artwork

Each dinosaur shows its `emoji` as a placeholder until artwork is added. To use
real pictures, drop properly-licensed images into `images/silhouettes/` (small
cards) and `images/art/` (detail pages) and point each creature at its file in
`data.js`. Credits appear automatically on the in-app **Image credits** page.
See **[`images/SOURCES.md`](images/SOURCES.md)** for a full drop-in guide with
recommended CC0/CC-BY sources per species.
