#!/usr/bin/env node
// Keeps two generated things in step with what is actually on disk:
//
//   1. assets/exercises/manifest.json — the artwork the app can match to an
//      exercise by name, so dropping a file into the folder is all it takes.
//   2. the PRECACHE list in service-worker.js — so every file, artwork
//      included, is available offline.
//
// Run it after adding, renaming or deleting anything under gym/:
//
//   node tools/sync-assets.mjs
//
// Add --check to verify without writing (useful in CI).

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const checkOnly = process.argv.includes("--check");

const ARTWORK_DIR = "assets/exercises";
const IMAGE_TYPES = new Set([".png", ".jpg", ".jpeg", ".webp", ".svg", ".gif"]);
const PRECACHE_TYPES = new Set([".js", ".css", ".svg", ".png", ".jpg", ".jpeg", ".webp", ".gif", ".webmanifest", ".html", ".json"]);
const SKIP_DIRS = new Set(["tools", ".git"]);
const SKIP_FILES = new Set(["service-worker.js"]);

/** "Incline Dumbbell Press" -> "incline-dumbbell-press" */
export function slugify(name) {
  return String(name)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(path.join(root, dir === "." ? "" : dir), { withFileTypes: true })) {
    const relative = dir === "." ? entry.name : `${dir}/${entry.name}`;
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) walk(relative, files);
    } else if (!SKIP_FILES.has(entry.name)) {
      files.push(relative);
    }
  }
  return files;
}

const allFiles = walk(".").sort();

/* --- 1. artwork manifest ------------------------------------------------- */
const artwork = allFiles.filter(
  (file) =>
    file.startsWith(`${ARTWORK_DIR}/`) &&
    IMAGE_TYPES.has(path.extname(file).toLowerCase()) &&
    // The shipped placeholders are fallbacks, not artwork to match by name.
    !path.basename(file).toLowerCase().includes("placeholder")
);

const images = {};
const clashes = [];
for (const file of artwork) {
  const slug = slugify(path.basename(file, path.extname(file)));
  if (images[slug]) clashes.push(`${images[slug]} and ${file} both map to "${slug}"`);
  else images[slug] = file;
}

const manifestPath = path.join(root, ARTWORK_DIR, "manifest.json");
const manifest = `${JSON.stringify({ images }, null, 2)}\n`;
const manifestChanged = !fs.existsSync(manifestPath) || fs.readFileSync(manifestPath, "utf8") !== manifest;

/* --- 2. service worker precache ------------------------------------------ */
const swPath = path.join(root, "service-worker.js");
const sw = fs.readFileSync(swPath, "utf8");
const precache = [
  ...new Set([
    ...allFiles.filter((file) => PRECACHE_TYPES.has(path.extname(file).toLowerCase())),
    // Written by this script, so it may not exist yet on a first run.
    `${ARTWORK_DIR}/manifest.json`,
  ]),
]
  .filter((file) => !file.endsWith("README.md"))
  .sort();
const list = ['  "./",', ...precache.map((file) => `  ${JSON.stringify(file)},`)].join("\n");
const nextSw = sw.replace(/const PRECACHE = \[[\s\S]*?\];/, `const PRECACHE = [\n${list}\n];`);
const swChanged = nextSw !== sw;

/* --- report and write ---------------------------------------------------- */
if (clashes.length) {
  console.error("Two files claim the same name:\n  " + clashes.join("\n  "));
  process.exit(1);
}

console.log(`artwork files : ${artwork.length}`);
console.log(`precache files: ${precache.length + 1}`);
for (const [slug, file] of Object.entries(images)) console.log(`  ${slug.padEnd(28)} -> ${file}`);

if (checkOnly) {
  if (manifestChanged || swChanged) {
    console.error("\nOut of date. Run: node tools/sync-assets.mjs");
    process.exit(1);
  }
  console.log("\nUp to date.");
} else {
  if (manifestChanged) fs.writeFileSync(manifestPath, manifest);
  if (swChanged) fs.writeFileSync(swPath, nextSw);
  console.log(
    `\n${manifestChanged ? "updated" : "unchanged"}: ${ARTWORK_DIR}/manifest.json` +
      `\n${swChanged ? "updated" : "unchanged"}: service-worker.js` +
      (swChanged ? "\n\nBump CACHE in service-worker.js so installed copies pick the change up." : "")
  );
}
