import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import "./build.mjs";
const output = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../tcg",
);
const types = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".webp": "image/webp",
  ".txt": "text/plain",
};
const server = createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(
      new URL(req.url, "http://localhost").pathname,
    );
    if (pathname === "/" || pathname === "/tcg") {
      res.writeHead(302, { Location: "/tcg/" });
      return res.end();
    }
    if (!pathname.startsWith("/tcg/")) throw Error("Not found");
    const relative = pathname.slice(5) || "index.html",
      file = path.resolve(output, relative);
    if (!file.startsWith(output + path.sep) || !(await stat(file)).isFile())
      throw Error("Not found");
    res.writeHead(200, {
      "Content-Type": types[path.extname(file)] || "application/octet-stream",
      "Cache-Control": "no-store",
    });
    res.end(await readFile(file));
  } catch {
    res.writeHead(404);
    res.end("Not found");
  }
});
server.listen(Number(process.env.PORT || 4174), "127.0.0.1", () =>
  console.log(
    `Card Ledger: http://127.0.0.1:${server.address().port}/tcg/ (rerun after source changes)`,
  ),
);
