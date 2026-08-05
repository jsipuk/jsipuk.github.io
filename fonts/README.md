# Fonts

Self-hosted copies of every font the site uses, so no page makes a request to
Google (or anyone else) at runtime.

Before this existed, eight pages pulled stylesheets from
`fonts.googleapis.com` and font files from `fonts.gstatic.com`. That handed
Google the IP address of every visitor to those pages, broke offline use, and
made the claim on the home page — *"No analytics, no advertising, no
third-party scripts. This page loads nothing from anywhere else, and neither
do the apps"* — untrue.

## What is here

`fonts.css` declares every face. Pages link it with:

```html
<link rel="stylesheet" href="/fonts/fonts.css">
```

Declaring all of them in one shared stylesheet is deliberate and costs
nothing: a browser only downloads a face a page actually uses, so one file
cached across the whole site beats a stylesheet per app.

The `.woff2` files are Google's own latin subsets, taken from the
[Fontsource](https://fontsource.org) packages on npm rather than from Google
directly, because npm ships the files as static assets. Around 900KB in total
for 47 faces.

| Family | Used by |
| --- | --- |
| DM Sans, DM Mono | Netskope Product Explorer |
| DM Serif Display, Figtree, JetBrains Mono | The Future SE Stack |
| Baloo 2, Nunito | Dino Expedition |
| Cinzel, EB Garamond, Inter, Atkinson Hyperlegible | The Ruler of Three Faces |
| Fraunces, Karla | Encore |
| Patrick Hand, Permanent Marker, Nunito | NostalgiAI |
| Orbitron, Share Tech Mono | VOID |

## Adding a family

Add it to `FAMILIES` in [`build.js`](./build.js), install the matching
`@fontsource/<family>` package, and re-run:

```bash
npm install @fontsource/<family>
node fonts/build.js
```

It copies the woff2 files and regenerates `fonts.css`. Do not hand-edit
`fonts.css`. This is a generator run by hand with its output committed, not a
build step: nothing runs at page load, and the site still serves as static
files.

Every family here is under the SIL Open Font Licence 1.1, apart from
Permanent Marker, which is Apache 2.0. Both licences permit redistribution
like this.
