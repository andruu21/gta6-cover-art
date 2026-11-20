// Regenerates the preview screenshots with headless Chromium (playwright),
// matching shots.json: query params per shot, exact requested dimensions
// (cover shots pass ?size=&template= so the poster is rendered at the target
// shape), long side <= 1280, short side >= 480, JPEG <= 256 KiB.
// Usage: node shots.mjs [baseURL]
import { chromium } from "playwright";
import { readFileSync, writeFileSync, mkdirSync, readdirSync, unlinkSync } from "node:fs";
import { join } from "node:path";

const base = process.argv[2] || "http://localhost:8123";
const shots = JSON.parse(readFileSync("shots.json", "utf8"));
mkdirSync("screenshots", { recursive: true });

// The four deliverables: the three shots.json covers plus the editor UI.
// Every cover shot carries ?size=WxH so the canvas itself is rendered at the
// target aspect — we then downscale, never crop, so nothing is cut off.
const all = [
  { name: "1-cover-wide.jpg", query: shots[0].query, w: 1280, h: 720 },
  { name: "2-editor.jpg", query: shots[1].query, w: 1280, h: 720, editor: true },
  { name: "3-cover-portrait.jpg", query: shots[2].query + "&size=1080x1350", w: 1024, h: 1280 },
  { name: "4-cover-square.jpg", query: shots[0].query + "&size=1080x1080", w: 1080, h: 1080 },
];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });

for (const s of all) {
  await page.goto(base + "/" + s.query, { waitUntil: "networkidle" });
  await page.waitForFunction(() => document.title === "ready", null, { timeout: 20000 });
  await page.waitForTimeout(400);

  let buf;
  if (s.editor) {
    buf = await page.screenshot({ type: "jpeg", quality: 80, clip: { x: 0, y: 0, width: s.w, height: s.h } });
  } else {
    // Contain-fit the poster canvas into the target size: scales the whole
    // render down, preserving every pixel of lettering and ribbons.
    const dataUrl = await page.evaluate(([w, h]) => {
      const src = document.getElementById("preview");
      const scale = Math.min(w / src.width, h / src.height);
      const dw = Math.round(src.width * scale);
      const dh = Math.round(src.height * scale);
      const c = document.createElement("canvas");
      c.width = w; c.height = h;
      const ctx = c.getContext("2d");
      ctx.fillStyle = "#12002e"; // pillarbox matte if aspects differ
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(src, Math.round((w - dw) / 2), Math.round((h - dh) / 2), dw, dh);
      return c.toDataURL("image/jpeg", 0.86);
    }, [s.w, s.h]);
    buf = Buffer.from(dataUrl.split(",")[1], "base64");
  }
  writeFileSync(join("screenshots", s.name), buf);
  const kb = (buf.length / 1024).toFixed(0);
  console.log(s.name, `${s.w}x${s.h}`, `${kb} KiB`);
  if (buf.length > 256 * 1024) throw new Error(`${s.name} over 256 KiB`);
}

// Remove stale screenshots so the directory holds exactly the deliverables.
const keep = new Set(all.map((s) => s.name));
for (const f of readdirSync("screenshots")) {
  if (!keep.has(f)) {
    unlinkSync(join("screenshots", f));
    console.log("removed stale", f);
  }
}
await browser.close();
