/*
 * Builds and renders the welcome video.
 *
 *   npm run demo                 # data + build + render -> public/demo/welcome.mp4
 *   node demo/render.mjs --build # just build demo/dist, then open demo/dist/index.html to preview
 *
 * Needs a prior `npm run build` (for the font files) and ffmpeg on the PATH.
 * Set DEMO_URL to change the address on the end card, PW_CHROMIUM to point at a Chromium.
 */
import { spawn } from "node:child_process"
import { copyFileSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { createServer } from "node:http"
import { dirname, extname, join } from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")
const DEMO = join(ROOT, "demo")
const DIST = join(DEMO, "dist")
const OUT_DIR = join(ROOT, "public", "demo")
const FPS = 30
const URL_TEXT = process.env.DEMO_URL ?? "jsip.uk/not-feeling-you"

/** The latin font files from the site's own build, so the video uses the real type. */
function findFonts() {
  const chunks = join(ROOT, "out", "_next", "static", "chunks")
  let css
  try {
    css = readdirSync(chunks).filter((f) => f.endsWith(".css")).map((f) => readFileSync(join(chunks, f), "utf8")).join("\n")
  } catch {
    throw new Error("No site build found. Run `npm run build` first.")
  }
  const faces = [...css.matchAll(/@font-face\{([^}]*)\}/g)].map((m) => m[1])
  const pick = (family, style) => {
    const face = faces.find((f) => f.includes(`font-family:${family};`) && f.includes(`font-style:${style}`) && f.includes("unicode-range:U+??"))
    if (!face) throw new Error(`Font not found in build: ${family} ${style}`)
    return join(ROOT, "out", "_next", "static", face.match(/url\(\.\.\/([^)]+)\)/)[1])
  }
  return {
    serif: pick("Fraunces", "normal"),
    serifItalic: pick("Fraunces", "italic"),
    sans: pick("IBM Plex Sans", "normal"),
  }
}

function build() {
  rmSync(DIST, { recursive: true, force: true })
  mkdirSync(join(DIST, "fonts"), { recursive: true })
  const fonts = findFonts()
  copyFileSync(fonts.serif, join(DIST, "fonts", "fraunces.woff2"))
  copyFileSync(fonts.serifItalic, join(DIST, "fonts", "fraunces-italic.woff2"))
  copyFileSync(fonts.sans, join(DIST, "fonts", "plex.woff2"))
  const faces = `
@font-face { font-family: "Fraunces"; font-style: normal; font-weight: 100 900; src: url(fonts/fraunces.woff2) format("woff2"); }
@font-face { font-family: "Fraunces"; font-style: italic; font-weight: 100 900; src: url(fonts/fraunces-italic.woff2) format("woff2"); }
@font-face { font-family: "IBM Plex Sans"; font-style: normal; font-weight: 400 600; src: url(fonts/plex.woff2) format("woff2"); }`

  // The phone screen: the site's real stylesheet at a real phone width.
  const globals = readFileSync(join(ROOT, "app", "globals.css"), "utf8")
  writeFileSync(
    join(DIST, "screen.html"),
    `<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><style>${faces}
:root { --font-serif: "Fraunces"; --font-sans: "IBM Plex Sans"; }
${globals}
/* Demo: motion is driven frame by frame from the stage, so switch the site's own off. */
*, *::before, *::after { animation: none !important; transition: none !important; }
html, body { overflow: hidden; height: 100%; }
#page { will-change: transform; }
</style></head><body><div id="page"></div></body></html>`,
  )

  const data = readFileSync(join(DEMO, "data.json"), "utf8")
  const stage = readFileSync(join(DEMO, "stage.html"), "utf8")
    .replace("/* FONTS */", faces)
    .replace('<script src="stage.js"></script>', `<script>window.DEMO_DATA = ${data}; window.DEMO_URL = ${JSON.stringify(URL_TEXT)};</script>\n<script src="stage.js"></script>`)
  writeFileSync(join(DIST, "index.html"), stage)
  copyFileSync(join(DEMO, "stage.js"), join(DIST, "stage.js"))
  console.log(`built ${DIST}`)
}

function serve() {
  const types = { ".html": "text/html", ".js": "text/javascript", ".woff2": "font/woff2" }
  const server = createServer((req, res) => {
    const path = join(DIST, decodeURIComponent(new URL(req.url, "http://x").pathname).replace(/\/$/, "/index.html"))
    try {
      res.writeHead(200, { "content-type": types[extname(path)] ?? "application/octet-stream" })
      res.end(readFileSync(path))
    } catch {
      res.writeHead(404).end()
    }
  })
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(server)))
}

function ffmpeg(args) {
  const proc = spawn(process.env.FFMPEG ?? "ffmpeg", ["-y", "-loglevel", "error", ...args], { stdio: ["pipe", "inherit", "inherit"] })
  const done = new Promise((resolve, reject) => proc.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}`)))))
  return { stdin: proc.stdin, done }
}

async function render() {
  const { chromium } = await import("@playwright/test")
  const server = await serve()
  const base = `http://127.0.0.1:${server.address().port}/`
  const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {})
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 })
  await page.goto(`${base}index.html?export`)
  await page.evaluate(() => window.__ready)
  const duration = await page.evaluate(() => window.__duration)
  const frames = Math.round(duration * FPS)
  const stage = page.locator("#stage")

  mkdirSync(OUT_DIR, { recursive: true })
  const mp4 = join(OUT_DIR, "welcome.mp4")
  const enc = ffmpeg([
    "-f", "image2pipe", "-framerate", String(FPS), "-i", "-",
    "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "20", "-preset", "slow",
    "-movflags", "+faststart", mp4,
  ])
  for (let f = 0; f < frames; f++) {
    await page.evaluate((t) => window.__render(t), f / FPS)
    enc.stdin.write(await stage.screenshot({ type: "png" }))
    if (f % 90 === 0) process.stdout.write(`frame ${f}/${frames}\n`)
  }
  enc.stdin.end()
  await enc.done

  // A poster frame for <video poster=...>, from the results section.
  await page.evaluate((t) => window.__render(t), 14.6)
  await stage.screenshot({ path: join(OUT_DIR, "welcome-poster.jpg"), type: "jpeg", quality: 88 })

  await browser.close()
  server.close()
  console.log(`wrote ${mp4} (${frames} frames at ${FPS}fps)`)
}

build()
if (!process.argv.includes("--build")) await render()
