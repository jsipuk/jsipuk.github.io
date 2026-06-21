# 🎨 Dinosaur artwork — drop-in guide

The app shows each dinosaur's `emoji` as a placeholder until real artwork is
added. This guide explains how to add **silhouettes** (small cards) and
**illustrations / photos** (detail pages) using only **free, properly-licensed**
images — and where the visitor's browser will expect each file.

> There are no photographs of living dinosaurs, so "real pictures" means
> **palaeoart reconstructions**, **museum fossil/skeleton photos**, or
> **accurate species silhouettes**.

## How it works

- Silhouettes go in `dino/images/silhouettes/` and show on cards + habitat tokens.
- Illustrations/photos go in `dino/images/art/` and show big on the detail and
  fossil-dig pages.
- You then point each creature at its file in `dino/data.js` (see the comment
  block above `DINOS`). Until you do, the emoji placeholder is used, so the live
  site is never broken.
- `credit` + `license` are shown automatically on the in-app **Image credits**
  page (Grown-ups → View image credits). This satisfies CC-BY attribution.

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

## Example: adding artwork for Parasaurolophus

1. Save a silhouette to `dino/images/silhouettes/parasaurolophus.svg`.
2. Save an illustration to `dino/images/art/parasaurolophus.jpg`
   (~800px wide, optimised to under ~200 KB).
3. In `dino/data.js`, add to the Parasaurolophus object:

```js
silhouette: {
  file: 'parasaurolophus.svg',
  credit: 'PhyloPic contributor', license: 'CC0',
  sourceUrl: 'https://www.phylopic.org/…',
},
art: {
  file: 'parasaurolophus.jpg',
  alt: 'A Parasaurolophus with a long curved head crest among ferns',
  credit: 'Artist Name', license: 'CC BY 4.0',
  sourceUrl: 'https://commons.wikimedia.org/wiki/File:…',
},
```

That's it — the card, detail page and credits list update automatically.

## Tips

- Keep a **consistent look**: ideally source silhouettes all from PhyloPic and
  illustrations in a similar style so the set feels cohesive.
- Optimise images (e.g. [Squoosh](https://squoosh.app/)) so the site stays fast
  on phones.
- Re-run the data check after editing: `node dino/test/data.test.js`.
