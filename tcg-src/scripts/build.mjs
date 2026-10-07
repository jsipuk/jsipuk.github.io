import { build } from "esbuild";
import { readFile, writeFile, mkdir, rm, cp } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const output = path.resolve(root, "../tcg");
if (path.basename(root) !== "tcg-src" || path.basename(output) !== "tcg")
  throw Error("Unexpected build location");
const stage = path.join(root, ".build");
try {
  await rm(stage, { recursive: true, force: true });
  await mkdir(stage, { recursive: true });
  const result = await build({
    absWorkingDir: root,
    entryPoints: ["src/app.js"],
    bundle: true,
    format: "esm",
    target: ["es2022"],
    outdir: stage,
    entryNames: "app-[hash]",
    external: ["./assets/*"],
    minify: true,
    metafile: true,
  });
  const outputs = Object.keys(result.metafile.outputs);
  const js = path.basename(outputs.find((p) => p.endsWith(".js"))),
    css = path.basename(outputs.find((p) => p.endsWith(".css")));
  const html = (await readFile(path.join(root, "index.html"), "utf8"))
    .replace("__APP_JS__", `./${js}`)
    .replace("__APP_CSS__", `./${css}`);
  await writeFile(path.join(stage, "index.html"), html);
  await cp(path.join(root, "public"), stage, { recursive: true });
  await rm(output, { recursive: true, force: true });
  await cp(stage, output, { recursive: true });
  console.log(`Built ${output} for GitHub Pages /tcg/`);
} finally {
  await rm(stage, { recursive: true, force: true });
}
