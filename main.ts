// main.ts — headless screenshot harness for the Vice State cover-art studio.
//
// Run with: node --experimental-strip-types main.ts
//
// Serves app/ over a local HTTP server, drives it with Playwright's Chromium,
// captures the four deliverable screenshots into screenshots/, validates each
// one against the size and byte budget, and writes screenshots/dossier.json.

import http from "node:http";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require_ = createRequire(import.meta.url);
const { chromium } = require_("playwright");

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const APP_DIR = path.join(ROOT, "app");
const OUT_DIR = path.join(ROOT, "screenshots");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".json": "application/json",
};

// ---- static file server for app/ ------------------------------------------

function startServer(port = 0) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url || "/", "http://localhost");
      let rel = decodeURIComponent(url.pathname);
      if (rel.endsWith("/")) rel += "index.html";
      const file = path.normalize(path.join(APP_DIR, rel));
      if (!file.startsWith(APP_DIR)) {
        res.writeHead(403).end("forbidden");
        return;
      }
      fs.readFile(file)
        .then((data) => {
          res.writeHead(200, { "content-type": MIME[path.extname(file)] || "application/octet-stream" });
          res.end(data);
        })
        .catch(() => {
          res.writeHead(404).end("not found");
        });
    });
    server.on("error", reject);
    server.listen(port, "127.0.0.1", () => resolve(server));
  });
}

// ---- shot list -------------------------------------------------------------

const SHOTS = [
  { name: "1-cover-wide.jpg", w: 1280, h: 720, query: "?shot=cover&photo=pier&caption=Sunset%20Heist&size=1280x720" },
  { name: "2-editor.jpg", w: 1280, h: 720, query: "?shot=editor&photo=boulevard&caption=Boulevard%20Queen" },
  { name: "3-cover-portrait.jpg", w: 1024, h: 1280, query: "?shot=cover&photo=boulevard&caption=Boulevard%20Queen&size=1024x1280" },
  { name: "4-cover-square.jpg", w: 1080, h: 1080, query: "?shot=cover&photo=pier&caption=Vice%20State&size=1080x1080" },
];

const MAX_BYTES = 262144;
const MIN_DIM = 480;
const MAX_DIM = 1280;

// ---- main -------------------------------------------------------------------

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });
  const server = await startServer();
  const addr = server.address();
  const base = `http://127.0.0.1:${addr.port}/index.html`;

  const browser = await chromium.launch({ args: ["--no-sandbox", "--force-device-scale-factor=1"] });
  const shots = [];
  let ok = true;

  try {
    for (const shot of SHOTS) {
      const page = await browser.newPage({ viewport: { width: shot.w, height: shot.h } });
      try {
        await page.goto(base + shot.query, { waitUntil: "load" });
        // The page sets document.title = "ready" once the canvas is final.
        await page.waitForFunction(() => document.title === "ready", null, { timeout: 20000 });
        await page.waitForTimeout(250); // let the finishing grain settle
        const outPath = path.join(OUT_DIR, shot.name);
        await page.screenshot({ path: outPath, type: "jpeg", quality: 82, clip: { x: 0, y: 0, width: shot.w, height: shot.h } });
        const bytes = (await fs.stat(outPath)).size;
        const width = shot.w;
        const height = shot.h;
        shots.push({ name: shot.name, width, height, bytes });

        const problems = [];
        if (width > MAX_DIM || height > MAX_DIM) problems.push(`${shot.name}: dimensions exceed ${MAX_DIM}px`);
        if (width < MIN_DIM || height < MIN_DIM) problems.push(`${shot.name}: dimensions below ${MIN_DIM}px`);
        if (bytes > MAX_BYTES) problems.push(`${shot.name}: ${bytes} bytes exceeds budget of ${MAX_BYTES}`);
        if (bytes <= 0) problems.push(`${shot.name}: empty file`);
        if (problems.length) {
          ok = false;
          for (const p of problems) console.error(`  FAIL ${p}`);
        } else {
          console.log(`  ok   ${shot.name}  ${width}x${height}  ${bytes} bytes`);
        }
      } finally {
        await page.close();
      }
    }
  } finally {
    await browser.close();
    server.close();
  }

  const dossier = {
    generatedAt: new Date().toISOString(),
    app: "Vice State cover-art studio",
    harness: "main.ts (node --experimental-strip-types + playwright chromium)",
    outputDir: OUT_DIR,
    shots,
    checks: {
      allRendered: shots.length === SHOTS.length,
      sizeBoundsOk: shots.every((s) => s.width <= MAX_DIM && s.height <= MAX_DIM && s.width >= MIN_DIM && s.height >= MIN_DIM),
      byteBudgetOk: shots.every((s) => s.bytes > 0 && s.bytes <= MAX_BYTES),
      problems: ok ? [] : ["one or more shots failed validation — see stderr above"],
    },
  };
  await fs.writeFile(path.join(OUT_DIR, "dossier.json"), JSON.stringify(dossier, null, 2) + "\n");

  if (!ok || shots.length !== SHOTS.length) {
    console.error("screenshot harness: checks FAILED");
    process.exit(1);
  }
  console.log("screenshot harness: all checks passed");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
