# 🎨 Dinosaur artwork — drop-in guide

The app shows each dinosaur's `emoji` as a placeholder until real artwork is
added. This guide explains how to add **silhouettes** (small cards) and
**illustrations / photos** (detail pages) using only **free, properly-licensed**
images — and where the visitor's browser will expect each file.

> There are no photographs of living dinosaurs, so "real pictures" means
> **palaeoart reconstructions**, **museum fossil/skeleton photos**, or
> **accurate species silhouettes**.

## How it works

Every creature in `dino/data.js` is **already pre-filled** with `silhouette`
and `art` blocks — the target filename, written alt text, and a `find` search
link are done for you. They are switched off with `ready: false`, so the emoji
placeholder shows and the live site is never broken.

**To turn a real picture on, edit that creature in `data.js`:**

1. Open its `find` link and pick a CC0 / CC-BY / public-domain image.
2. Save the file into `images/silhouettes/` or `images/art/` using the `file`
   name already listed.
3. Change `ready: false` → `ready: true`.
4. Fill in `credit`, `license` and `sourceUrl` from the image's own page.

`credit` + `license` then appear automatically on the in-app **Image credits**
page (Grown-ups → View image credits), satisfying CC-BY attribution.

## Licences to use (free, no accounts, child-safe)

| Source | Best for | Licence | Attribution |
|--------|----------|---------|-------------|
| [PhyloPic](https://www.phylopic.org/) | accurate silhouettes | CC0 / CC-BY | sometimes |
| [Wikimedia Commons](https://commons.wikimedia.org/) | palaeoart + skeletons | CC0 / CC-BY / PD | usually |
| [Smithsonian Open Access](https://www.si.edu/openaccess) | fossil/skeleton photos | CC0 | no |
| [PhyloPic + Wikipedia "Restoration" sections] | life reconstructions | varies — check each | check |

Always confirm the licence on the file's own page. Avoid "all rights reserved"
images and anything from a general image search.

## Recommended files

For each creature: drop a silhouette and (optionally) an illustration with the
filename shown, then paste the matching snippet into `data.js`.

| id | silhouette file | art file | suggested search |
|----|-----------------|----------|------------------|
| tyrannosaurus | `tyrannosaurus.svg` | `tyrannosaurus.jpg` | "Tyrannosaurus restoration" |
| triceratops | `triceratops.svg` | `triceratops.jpg` | "Triceratops life reconstruction" |
| stegosaurus | `stegosaurus.svg` | `stegosaurus.jpg` | "Stegosaurus restoration" |
| velociraptor | `velociraptor.svg` | `velociraptor.jpg` | "Velociraptor feathered restoration" |
| brachiosaurus | `brachiosaurus.svg` | `brachiosaurus.jpg` | "Brachiosaurus restoration" |
| diplodocus | `diplodocus.svg` | `diplodocus.jpg` | "Diplodocus restoration" |
| spinosaurus | `spinosaurus.svg` | `spinosaurus.jpg` | "Spinosaurus 2020 reconstruction" |
| ankylosaurus | `ankylosaurus.svg` | `ankylosaurus.jpg` | "Ankylosaurus restoration" |
| parasaurolophus | `parasaurolophus.svg` | `parasaurolophus.jpg` | "Parasaurolophus restoration" |
| allosaurus | `allosaurus.svg` | `allosaurus.jpg` | "Allosaurus restoration" |
| iguanodon | `iguanodon.svg` | `iguanodon.jpg` | "Iguanodon restoration" |
| compsognathus | `compsognathus.svg` | `compsognathus.jpg` | "Compsognathus restoration" |
| pteranodon | `pteranodon.svg` | `pteranodon.jpg` | "Pteranodon restoration" |

> Prefer modern, scientifically-current reconstructions: feathered Velociraptor,
> a semi-aquatic Spinosaurus, and feathers/quills where evidence supports them.

## Example: turning on Parasaurolophus

The Parasaurolophus entry in `data.js` already looks like this:

```js
silhouette: { ready: false, file: 'parasaurolophus.svg',
  find: 'https://commons.wikimedia.org/wiki/Special:MediaSearch?...',
  credit: '', license: '', sourceUrl: '' },
art: { ready: false, file: 'parasaurolophus.jpg',
  alt: 'A Parasaurolophus with a long, curved tube-shaped crest on its head, among ferns',
  find: 'https://commons.wikimedia.org/wiki/Special:MediaSearch?...',
  credit: '', license: '', sourceUrl: '' },
```

Save your chosen image to `images/art/parasaurolophus.jpg` (~800px wide, under
~200 KB), then change the `art` block to:

```js
art: { ready: true, file: 'parasaurolophus.jpg',
  alt: 'A Parasaurolophus with a long, curved tube-shaped crest on its head, among ferns',
  credit: 'Artist Name', license: 'CC BY 4.0',
  sourceUrl: 'https://commons.wikimedia.org/wiki/File:…' },
```

That's it — the card, detail page and credits list update automatically. (For a
silhouette, [PhyloPic](https://www.phylopic.org/) usually gives the cleanest
CC0 shapes; swap the `find` link's results for one of those.)

## Tips

- Keep a **consistent look**: ideally source silhouettes all from PhyloPic and
  illustrations in a similar style so the set feels cohesive.
- Optimise images (e.g. [Squoosh](https://squoosh.app/)) so the site stays fast
  on phones.
- Re-run the data check after editing: `node dino/test/data.test.js`.
