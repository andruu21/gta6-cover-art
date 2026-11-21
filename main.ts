// Grader harness for the Vice State cover-art app.
//
// Serves app/ on a loopback port (stdlib only), drives it with headless
// Chromium via Playwright, renders the four deliverable screenshots into
// screenshots/ (long side <= 1280, short side >= 480), and writes
// dossier.json describing what was produced. Exit code 0 means every
// screenshot was rendered inside the size and file-size budgets.
//
// Usage: node --experimental-strip-types main.ts
//   MAKEFUN_OUTPUT_DIR=/tmp/cav8 node --experimental-strip-types main.ts
//     -> screenshots and dossier.json go to /tmp/cav8 instead.

import { createReadStream, statSync, mkdirSync, writeFileSync, readdirSync, unlinkSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const ROOT = resolve(fileURLToPath(new URL("./app", import.meta.url)));
const OUT_DIR = resolve(process.env.MAKEFUN_OUTPUT_DIR || "screenshots");

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".json": "application/json; charset=utf-8",
};

// ---- static server -------------------------------------------------------

function serveApp(port: number): Promise<() => void> {
  return new Promise((resolveServer) => {
    const server = createServer((req, res) => {
      let pathname: string;
      try {
        pathname = decodeURIComponent(new URL(req.url ?? "/", "http://localhost").pathname);
      } catch {
        res.writeHead(400).end();
        return;
      }
      if (pathname.endsWith("/")) pathname += "index.html";
      const file = resolve(join(ROOT, normalize(pathname)));
      if (file !== ROOT && !file.startsWith(ROOT + sep)) {
        res.writeHead(403).end();
        return;
      }
      let size = 0;
      try {
        size = statSync(file).size;
      } catch {
        res.writeHead(404).end();
        return;
      }
      res.writeHead(200, {
        "content-type": MIME[extname(file).toLowerCase()] ?? "application/octet-stream",
        "content-length": size,
        "cache-control": "no-store",
      });
      createReadStream(file).pipe(res);
    });
    server.listen(port, "127.0.0.1", () => resolveServer(() => server.close()));
  });
}

// ---- shot plan -----------------------------------------------------------

// Long side <= 1280, short side >= 480 for every deliverable.
const SHOTS = [
  { name: "1-cover-wide.jpg",     query: "?shot=cover&photo=pier&caption=Sunset%20Heist&size=1920x1080", w: 1280, h: 720 },
  { name: "2-editor.jpg",         query: "?shot=editor&photo=boulevard&caption=Boulevard%20Queen",       w: 1280, h: 720, editor: true },
  { name: "3-cover-portrait.jpg", query: "?shot=cover&photo=boulevard&caption=Boulevard%20Queen&size=1080x1350", w: 1024, h: 1280 },
  { name: "4-cover-square.jpg",   query: "?shot=cover&photo=pier&caption=Sunset%20Heist&size=1080x1080", w: 1080, h: 1080 },
];

const MAX_DIM = 1280;
const MIN_DIM = 480;
const MAX_BYTES = 256 * 1024;

interface ShotResult {
  name: string;
  width: number;
  height: number;
  bytes: number;
}

async function capture(page: any, base: string, s: any): Promise<ShotResult> {
  await page.goto(base + s.query, { waitUntil: "networkidle" });
  // main.js stamps document.title = "ready" once the canvas is final.
  await page.waitForFunction(() => document.title === "ready", null, { timeout: 30000 });
  await page.waitForTimeout(400);

  let buf: Buffer;
  if (s.editor) {
    buf = await page.screenshot({
      type: "jpeg",
      quality: 82,
      clip: { x: 0, y: 0, width: Math.min(s.w, 1280), height: Math.min(s.h, 720) },
    });
  } else {
    // Contain-fit the rendered poster canvas into the target box so nothing
    // is cropped; pillarbox on the app's backdrop colour if aspects differ.
    const dataUrl: string = await page.evaluate(([w, h]: number[]) => {
      const src = document.getElementById("preview") as HTMLCanvasElement;
      const scale = Math.min(w / src.width, h / src.height);
      const dw = Math.round(src.width * scale);
      const dh = Math.round(src.height * scale);
      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      const ctx = c.getContext("2d")!;
      ctx.fillStyle = "#12002e";
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(src, Math.round((w - dw) / 2), Math.round((h - dh) / 2), dw, dh);
      return c.toDataURL("image/jpeg", 0.86);
    }, [s.w, s.h]);
    buf = Buffer.from(dataUrl.split(",")[1]!, "base64");
  }

  const file = join(OUT_DIR, s.name);
  writeFileSync(file, buf);
  return { name: s.name, width: s.w, height: s.h, bytes: buf.length };
}

// ---- main ----------------------------------------------------------------

const port = 8300 + (process.pid % 400);
const stopServer = await serveApp(port);
const base = `http://127.0.0.1:${port}`;

mkdirSync(OUT_DIR, { recursive: true });

// Clear the output dir of stale images so it holds exactly the deliverables.
for (const f of readdirSync(OUT_DIR)) {
  if (f.endsWith(".jpg")) {
    unlinkSync(join(OUT_DIR, f));
  }
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });

const results: ShotResult[] = [];
const problems: string[] = [];

for (const s of SHOTS) {
  try {
    const r = await capture(page, base, s);
    const max = Math.max(r.width, r.height);
    const min = Math.min(r.width, r.height);
    if (max > MAX_DIM || min < MIN_DIM) {
      problems.push(`${s.name}: ${r.width}x${r.height} outside [${MIN_DIM}, ${MAX_DIM}] bounds`);
    }
    if (r.bytes > MAX_BYTES) {
      problems.push(`${s.name}: ${(r.bytes / 1024).toFixed(0)} KiB exceeds 256 KiB budget`);
    }
    results.push(r);
    console.log(`rendered ${s.name} ${r.width}x${r.height} ${(r.bytes / 1024).toFixed(0)} KiB`);
  } catch (err) {
    problems.push(`${s.name}: ${(err as Error).message}`);
  }
}

await browser.close();
stopServer();

const dossier = {
  generatedAt: new Date().toISOString(),
  app: "Vice State cover-art studio",
  harness: "main.ts (node --experimental-strip-types + playwright chromium)",
  outputDir: OUT_DIR,
  shots: results,
  checks: {
    allRendered: results.length === SHOTS.length,
    sizeBoundsOk: problems.every((p) => !p.includes("outside")),
    byteBudgetOk: problems.every((p) => !p.includes("exceeds")),
    problems,
  },
};

writeFileSync(join(OUT_DIR, "dossier.json"), JSON.stringify(dossier, null, 2) + "\n");
console.log(`dossier.json written to ${join(OUT_DIR, "dossier.json")}`);

if (problems.length) {
  for (const p of problems) console.error("FAIL:", p);
  process.exit(1);
}
console.log("all checks passed");
process.exit(0);
