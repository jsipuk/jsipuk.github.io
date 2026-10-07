import { build } from "esbuild";
import {
  readdir,
  readFile,
  writeFile,
  copyFile,
  mkdtemp,
  rm,
} from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { releaseRegistry } from "./legacy/releases.js";
import { adaptTCGdexSet, PINNED_REVISION } from "./legacy/tcgdex.js";
import { createCollection } from "../src/domain/collection.js";
const root = path.resolve(process.argv[2] || "/tmp/tcgdex-database");
const revision = execFileSync("git", ["-C", root, "rev-parse", "HEAD"], {
  encoding: "utf8",
}).trim();
if (revision !== PINNED_REVISION)
  throw Error(
    `Expected pinned TCGdex revision ${PINNED_REVISION}; review provider changes before updating.`,
  );
const tmp = await mkdtemp(path.join(os.tmpdir(), "ledger-reference-"));
try {
  const groups = [],
    lines = [];
  for (const [i, r] of releaseRegistry.entries()) {
    const source = path.join(root, "data", r.sourcePath);
    lines.push(`import s${i} from ${JSON.stringify(source + ".ts")};`);
    const files = (await readdir(source))
      .filter((f) => f.endsWith(".ts"))
      .sort((a, b) => a.localeCompare(b, "en", { numeric: true }));
    const entries = [];
    for (const [j, file] of files.entries()) {
      lines.push(
        `import c${i}_${j} from ${JSON.stringify(path.join(source, file))};`,
      );
      entries.push(
        `{localId:${JSON.stringify(file.slice(0, -3))},card:c${i}_${j}}`,
      );
    }
    groups.push(`{source:s${i},cards:[${entries.join(",")}]}`);
  }
  lines.push(`export default [${groups.join(",")}];`);
  const bundle = path.join(tmp, "source.mjs");
  await build({
    stdin: { contents: lines.join("\n"), resolveDir: root, loader: "ts" },
    bundle: true,
    platform: "node",
    format: "esm",
    outfile: bundle,
  });
  const sources = (await import(pathToFileURL(bundle).href)).default;
  const reference = {
    version: 1,
    source: {
      name: "TCGdex English snapshot",
      url: "https://github.com/tcgdex/cards-database",
      revision,
      verifiedAt: "2026-10-07",
      license: "MIT",
      scope:
        "Nine English international releases; variant/checklist coverage is not certified complete",
      imagesVerified: false,
    },
    releases: [],
    cards: [],
  };
  for (const [i, group] of sources.entries()) {
    const { release, cards } = adaptTCGdexSet(
      group.source,
      releaseRegistry[i],
      group.cards,
    );
    reference.releases.push(release);
    reference.cards.push(...cards);
  }
  createCollection(reference);
  await writeFile(
    "tests/fixtures/legacy-reference.json",
    JSON.stringify(reference, null, 2) + "\n",
  );
  await copyFile(path.join(root, "LICENSE"), "public/data/TCGDEX-LICENSE.txt");
  console.log(
    reference.releases
      .map((r) => `${r.name}: ${r.checklist.sourceEntries} cards`)
      .join("\n"),
  );
  console.log(
    `Verified source snapshot: ${reference.cards.length} English cards; images/checklist completeness remain unverified.`,
  );
} finally {
  await rm(tmp, { recursive: true, force: true });
}
