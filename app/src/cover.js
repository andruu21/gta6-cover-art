// Vice State poster renderer.
//
// Pure canvas 2D: one async renderCover(canvas, state) turn paints the whole
// poster — procedural sky, skyline and clouds, multi-panel photo frames with
// sticker chips and torn-edge paper accents, outlined display lettering, a
// critic review strip, a palm-and-sun banner band, a wax-seal badge, and a
// finishing pass of light leak, film grain and vignette.
//
// Everything is deterministic in `state.seed`: same seed, same poster.
// Photo bitmaps come from the editor (main.js); when a panel has no photo it
// falls back to its own slice of seeded sky art so the poster never ships
// with an empty hole.

import { FONT_DISPLAY, FONT_BODY, WEIGHT, TRACKING, defaultFontStack } from "./fonts.js";

export { defaultFontStack };

// ---------------------------------------------------------------------------
// palettes
// ---------------------------------------------------------------------------

// Each palette is a full poster weather system: sky gradient stops (top to
// horizon), a sun colour, two accents used by lettering/chips, an ink colour
// for dark silhouettes and paper, and a backdrop tint for page margins.
const PALETTES = {
  sunset: {
    name: "Sunset Boulevard",
    sky: ["#1b0a3c", "#5a1a6e", "#b4356f", "#ff7b54", "#ffc76b"],
    sun: "#ffdf8e",
    accent: "#ff5f9e",
    accent2: "#ffd166",
    ink: "#1a0533",
    paper: "#170430",
  },
  neon: {
    name: "Neon Tide",
    sky: ["#05021f", "#14104d", "#2a2a8f", "#7d3fc0", "#e050b8"],
    sun: "#ff9de2",
    accent: "#00f0ff",
    accent2: "#ff2bd6",
    ink: "#030116",
    paper: "#070224",
  },
  lagoon: {
    name: "Lagoon Drag",
    sky: ["#032530", "#075a68", "#0e8f8f", "#5fd6b0", "#e8ffd8"],
    sun: "#fdf3b0",
    accent: "#ff7ab8",
    accent2: "#25f4c7",
    ink: "#021a1c",
    paper: "#04262b",
  },
  chrome: {
    name: "Chrome outlaw",
    sky: ["#101018", "#2e2e42", "#5a5f7d", "#9aa4c4", "#e6ecff"],
    sun: "#ffe9c4",
    accent: "#ff3b3b",
    accent2: "#9adcff",
    ink: "#0a0a10",
    paper: "#101018",
  },
  orchid: {
    name: "Orchid Fever",
    sky: ["#2b0a3f", "#5c1a7a", "#a13c9e", "#f062b8", "#ffc2e2"],
    sun: "#fff1a8",
    accent: "#ffe14d",
    accent2: "#8a2be2",
    ink: "#1d0530",
    paper: "#210633",
  },
  ember: {
    name: "Ember Coast",
    sky: ["#1f0505", "#5e130a", "#a82c10", "#f07a1d", "#ffce7a"],
    sun: "#fff0b8",
    accent: "#ff4d3d",
    accent2: "#ffb347",
    ink: "#160301",
    paper: "#1c0505",
  },
  noir: {
    name: "Midnight Noir",
    sky: ["#020208", "#0b0b23", "#1d1d4a", "#3d3d7a", "#7f7fc0"],
    sun: "#e8e6ff",
    accent: "#ff2bd6",
    accent2: "#00f0ff",
    ink: "#010105",
    paper: "#040410",
  },
  coral: {
    name: "Coral Static",
    sky: ["#23103f", "#4a2a6e", "#8a5fa8", "#e58ab0", "#ffd0c2"],
    sun: "#ffe9a0",
    accent: "#ff5470",
    accent2: "#3ee6c0",
    ink: "#1a0c2e",
    paper: "#1e1040",
  },
};

export const PALETTE_NAMES = Object.keys(PALETTES);

// Named weather variants applied on top of a base palette: they pull the sky
// darker or lighter and retint the sun, so one palette can dress a whole
// day/night cycle without a second table.
const VARIANTS = {
  raw: { shift: 0, sunMix: 0, label: "as shot" },
  dusk: { shift: 0.16, sunMix: 0.25, label: "dusk" },
  night: { shift: 0.34, sunMix: 0.55, label: "night drive" },
  blaze: { shift: -0.12, sunMix: -0.2, label: "high noon" },
};

export function palette(name) {
  const p = PALETTES[name] || PALETTES.sunset;
  return JSON.parse(JSON.stringify(p));
}

export function paletteVariant(name, variant = "raw") {
  const base = palette(name);
  const v = VARIANTS[variant] || VARIANTS.raw;
  const out = { ...base, variant: v.label };
  out.sky = base.sky.map((hex) => shiftColor(hex, v.shift));
  out.sun = mixColor(base.sun, v.sunMix > 0 ? base.ink : "#ffffff", Math.abs(v.sunMix) * 0.6);
  out.accent = shiftColor(base.accent, v.shift * 0.4);
  return out;
}

// ---------------------------------------------------------------------------
// colour + math helpers
// ---------------------------------------------------------------------------

function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }
function lerp(a, b, t) { return a + (b - a) * t; }

function hexToRgb(hex) {
  const text = String(hex).trim();
  if (text.startsWith("rgb")) {
    const parts = text.slice(text.indexOf("(") + 1, text.indexOf(")")).split(",").map((s) => parseFloat(s));
    return [parts[0] || 0, parts[1] || 0, parts[2] || 0];
  }
  const h = text.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToCss(r, g, b, a = 1) {
  return `rgba(${Math.round(r)},${Math.round(g)},${Math.round(b)},${a})`;
}

// amt > 0 pushes toward black (night), amt < 0 pulls toward white (day).
function shiftColor(hex, amt) {
  const [r, g, b] = hexToRgb(hex);
  if (amt >= 0) return rgbToCss(r * (1 - amt), g * (1 - amt), b * (1 - amt));
  const t = -amt;
  return rgbToCss(lerp(r, 255, t), lerp(g, 255, t), lerp(b, 255, t));
}

function mixColor(hexA, hexB, t) {
  const a = hexToRgb(hexA);
  const b = typeof hexB === "string" && hexB.startsWith("#") ? hexToRgb(hexB) : [255, 255, 255];
  return rgbToCss(lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t));
}

function withAlpha(css, a) {
  // Accepts "#hex" or "rgba(...)" strings and returns an rgba() with alpha a.
  if (typeof css === "string" && css.startsWith("#")) {
    const [r, g, b] = hexToRgb(css);
    return rgbToCss(r, g, b, a);
  }
  const m = css.match(/rgba?\(([^)]+)\)/);
  if (!m) return css;
  const parts = m[1].split(",").map((s) => parseFloat(s));
  return rgbToCss(parts[0], parts[1], parts[2], a);
}

// ---------------------------------------------------------------------------
// seeded RNG (mulberry32) — every procedural layer pulls from this stream so
// the whole poster replays identically from one integer seed.
// ---------------------------------------------------------------------------

export function makeRng(seed) {
  let a = (seed >>> 0) || 1;
  return function rng() {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function rngRange(rng, lo, hi) { return lo + rng() * (hi - lo); }
function rngPick(rng, arr) { return arr[Math.floor(rng() * arr.length) % arr.length]; }

// ---------------------------------------------------------------------------
// sizes + templates
// ---------------------------------------------------------------------------

// Export sizes: canvas pixel dimensions, keyed exactly as the editor's size
// dropdown stores them (spaces around the x included).
export const SIZES = {
  "1920 x 1080": [1920, 1080],
  "1080 x 1080": [1080, 1080],
  "1080 x 1350": [1080, 1350],
  "1080 x 1920": [1080, 1920],
  "1200 x 628": [1200, 628],
};

// resolveSize maps any user-ish size string ("1920x1080", "1080 x 1350",
// numeric pairs, or a known key) to [w, h], falling back to 1920x1080.
export function resolveSize(size) {
  if (Array.isArray(size) && size.length === 2) return [Math.round(size[0]), Math.round(size[1])];
  if (typeof size === "string") {
    const key = Object.keys(SIZES).find(
      (kk) => kk.toLowerCase().replace(/\s/g, "") === size.toLowerCase().replace(/\s/g, "")
    );
    if (key) return SIZES[key].slice();
    const m = size.match(/(\d+)\s*[x×,]\s*(\d+)/i);
    if (m) return [parseInt(m[1], 10), parseInt(m[2], 10)];
  }
  return [1920, 1080];
}

// Panel layouts in unit coordinates of the full poster. Panels sit above the
// banner band; the band is painted first so frames ride on top of it.
export const TEMPLATES = {
  hero: {
    name: "Hero",
    aspect: 16 / 9,
    panels: [{ x: 0.05, y: 0.07, w: 0.9, h: 0.44 }],
  },
  duo: {
    name: "Double Feature",
    aspect: 16 / 9,
    panels: [
      { x: 0.05, y: 0.07, w: 0.44, h: 0.44 },
      { x: 0.51, y: 0.07, w: 0.44, h: 0.44 },
    ],
  },
  triptych: {
    name: "Triptych",
    aspect: 4 / 5,
    panels: [
      { x: 0.05, y: 0.06, w: 0.27, h: 0.42 },
      { x: 0.36, y: 0.06, w: 0.27, h: 0.42 },
      { x: 0.67, y: 0.06, w: 0.27, h: 0.42 },
    ],
  },
  collage: {
    name: "Collage",
    aspect: 1,
    panels: [
      { x: 0.06, y: 0.06, w: 0.52, h: 0.36 },
      { x: 0.62, y: 0.06, w: 0.32, h: 0.36 },
      { x: 0.06, y: 0.46, w: 0.36, h: 0.28 },
      { x: 0.46, y: 0.46, w: 0.48, h: 0.28 },
    ],
  },
  tower: {
    name: "Tower",
    aspect: 9 / 16,
    panels: [
      { x: 0.08, y: 0.05, w: 0.84, h: 0.24 },
      { x: 0.08, y: 0.32, w: 0.84, h: 0.24 },
    ],
  },
};

// ---------------------------------------------------------------------------
// text helpers
// ---------------------------------------------------------------------------

function setFont(ctx, sizePx, family = FONT_DISPLAY, weight = WEIGHT.TITLE, italic = false) {
  ctx.font = `${italic ? "italic " : ""}${weight} ${Math.max(1, Math.round(sizePx))}px ${family}`;
}

// Draw one line of text with per-character tracking. anchor: "center"|"left".
function drawTracked(ctx, text, x, y, track, anchor = "center") {
  const chars = Array.from(String(text));
  const widths = chars.map((c) => ctx.measureText(c).width);
  const total = widths.reduce((s, w2) => s + w2, 0) + track * Math.max(0, chars.length - 1);
  let cx = anchor === "center" ? x - total / 2 : x;
  for (let i = 0; i < chars.length; i++) {
    ctx.fillText(chars[i], cx, y);
    cx += widths[i] + track;
  }
  return total;
}

function strokeTracked(ctx, text, x, y, track, anchor = "center") {
  const chars = Array.from(String(text));
  const widths = chars.map((c) => ctx.measureText(c).width);
  const total = widths.reduce((s, w2) => s + w2, 0) + track * Math.max(0, chars.length - 1);
  let cx = anchor === "center" ? x - total / 2 : x;
  for (let i = 0; i < chars.length; i++) {
    ctx.strokeText(chars[i], cx, y);
    cx += widths[i] + track;
  }
  return total;
}

function roundRectPath(ctx, x, y, w2, h2, r) {
  const rr = Math.min(r, w2 / 2, h2 / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w2, y, x + w2, y + h2, rr);
  ctx.arcTo(x + w2, y + h2, x, y + h2, rr);
  ctx.arcTo(x, y + h2, x, y, rr);
  ctx.arcTo(x, y, x + w2, y, rr);
  ctx.closePath();
}

// Torn paper edge: a jagged polyline across the top or bottom of a rect.
function tornEdgePath(ctx, x, y, w2, h2, rng, side = "bottom", teeth = null) {
  const n = teeth || Math.max(6, Math.round(w2 / 34));
  const jag = h2 * 0.16;
  ctx.beginPath();
  ctx.moveTo(x, y);
  if (side === "top") {
    for (let i = 0; i <= n; i++) {
      const px = x + (w2 * i) / n;
      const py = y + (i === 0 || i === n ? 0 : rngRange(rng, 0, jag));
      ctx.lineTo(px, py);
    }
    ctx.lineTo(x + w2, y + h2);
    ctx.lineTo(x, y + h2);
  } else {
    ctx.lineTo(x + w2, y);
    ctx.lineTo(x + w2, y + h2);
    for (let i = n; i >= 0; i--) {
      const px = x + (w2 * i) / n;
      const py = y + h2 - (i === 0 || i === n ? 0 : rngRange(rng, 0, jag));
      ctx.lineTo(px, py);
    }
  }
  ctx.closePath();
}

// ---------------------------------------------------------------------------
// procedural art layers
// ---------------------------------------------------------------------------

// Sky: vertical gradient through the palette stops, terminator glow near the
// horizon, plus a faint horizontal scanline haze for the CRT-broadcast feel.
function drawSky(ctx, x, y, w2, h2, pal, rng) {
  const g = ctx.createLinearGradient(0, y, 0, y + h2);
  const stops = pal.sky;
  stops.forEach((c, i) => g.addColorStop(stops.length === 1 ? 0 : i / (stops.length - 1), c));
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w2, h2);

  // horizon glow
  const glow = ctx.createRadialGradient(x + w2 / 2, y + h2 * 0.92, 0, x + w2 / 2, y + h2 * 0.92, w2 * 0.55);
  glow.addColorStop(0, withAlpha(pal.sun, 0.32));
  glow.addColorStop(1, withAlpha(pal.sun, 0));
  ctx.fillStyle = glow;
  ctx.fillRect(x, y, w2, h2);

  // scan haze
  ctx.save();
  ctx.globalAlpha = 0.05;
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = Math.max(1, h2 / 400);
  const step = Math.max(6, h2 / 46);
  for (let sy = y + step; sy < y + h2; sy += step) {
    ctx.beginPath();
    ctx.moveTo(x, sy + rngRange(rng, -1, 1));
    ctx.lineTo(x + w2, sy + rngRange(rng, -1, 1));
    ctx.stroke();
  }
  ctx.restore();
}

// Retro sun: striped disc with slats cut out toward the bottom.
function drawSun(ctx, cx, cy, r, pal, slats = 6) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();
  const g = ctx.createLinearGradient(0, cy - r, 0, cy + r);
  g.addColorStop(0, pal.sun);
  g.addColorStop(1, mixColor(pal.sun, "#ff5f9e", 0.55));
  ctx.fillStyle = g;
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  // horizontal slats, thicker toward the bottom
  ctx.fillStyle = withAlpha(pal.paper, 0.85);
  for (let i = 0; i < slats; i++) {
    const t = i / slats;
    const sy = cy + r * (0.05 + t * 0.85);
    ctx.fillRect(cx - r, sy, r * 2, Math.max(1.5, r * (0.03 + t * 0.05)));
  }
  ctx.restore();
  // halo
  const halo = ctx.createRadialGradient(cx, cy, r * 0.9, cx, cy, r * 2.4);
  halo.addColorStop(0, withAlpha(pal.sun, 0.35));
  halo.addColorStop(1, withAlpha(pal.sun, 0));
  ctx.fillStyle = halo;
  ctx.fillRect(cx - r * 2.4, cy - r * 2.4, r * 4.8, r * 4.8);
}

// Clouds: soft blobs stacked from seeded ellipses.
function drawClouds(ctx, x, y, w2, h2, pal, rng, count = 4) {
  ctx.save();
  for (let i = 0; i < count; i++) {
    const cw = rngRange(rng, w2 * 0.14, w2 * 0.3);
    const cx = rngRange(rng, x + cw / 2, x + w2 - cw / 2);
    const cy = rngRange(rng, y + h2 * 0.12, y + h2 * 0.55);
    const puffs = Math.round(rngRange(rng, 4, 7));
    ctx.globalAlpha = rngRange(rng, 0.1, 0.22);
    ctx.fillStyle = mixColor(pal.sun, "#ffffff", 0.5);
    for (let p = 0; p < puffs; p++) {
      const px = cx + rngRange(rng, -cw * 0.42, cw * 0.42);
      const py = cy + rngRange(rng, -cw * 0.08, cw * 0.14);
      const pr = rngRange(rng, cw * 0.14, cw * 0.26);
      ctx.beginPath();
      ctx.ellipse(px, py, pr, pr * 0.62, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

// One skyline block run along a baseline.
function drawSkyline(ctx, x, baseline, w2, h2, pal, rng, density = 1) {
  const colors = [pal.ink, shiftColor(pal.ink, 0.18)];
  let cx = x;
  const win = Math.max(2, h2 / 90);
  while (cx < x + w2) {
    const bw = rngRange(rng, w2 * 0.03, w2 * 0.09) * density;
    const bh = rngRange(rng, h2 * 0.25, h2 * 0.95);
    ctx.fillStyle = rngPick(rng, colors);
    ctx.fillRect(cx, baseline - bh, bw, bh);
    // antenna
    if (rng() < 0.3) {
      ctx.fillRect(cx + bw / 2 - win, baseline - bh - h2 * 0.12, win, h2 * 0.12);
    }
    // lit windows
    ctx.fillStyle = withAlpha(pal.accent2, 0.5);
    const cols = Math.max(1, Math.floor(bw / (win * 5)));
    const rows = Math.max(2, Math.floor(bh / (win * 6)));
    for (let c = 0; c < cols; c++) {
      for (let r0 = 0; r0 < rows; r0++) {
        if (rng() < 0.28) {
          ctx.fillRect(
            cx + win * 2 + c * win * 5,
            baseline - bh + win * 3 + r0 * win * 6,
            win, win * 1.6
          );
        }
      }
    }
    cx += bw + rngRange(rng, 2, w2 * 0.012);
  }
}

// Water strip with reflection shimmer under the skyline baseline.
function drawWater(ctx, x, y, w2, h2, pal, rng) {
  const g = ctx.createLinearGradient(0, y, 0, y + h2);
  g.addColorStop(0, shiftColor(pal.ink, -0.25));
  g.addColorStop(1, pal.ink);
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w2, h2);
  ctx.save();
  ctx.globalAlpha = 0.35;
  ctx.strokeStyle = withAlpha(pal.sun, 0.8);
  const lines = Math.round(h2 / 5);
  for (let i = 0; i < lines; i++) {
    const ly = y + (h2 * i) / lines;
    const lw = rngRange(rng, w2 * 0.05, w2 * 0.3);
    const lx = x + rngRange(rng, 0, w2 - lw);
    ctx.lineWidth = Math.max(1, h2 / 60);
    ctx.beginPath();
    ctx.moveTo(lx, ly);
    ctx.lineTo(lx + lw, ly);
    ctx.stroke();
  }
  ctx.restore();
}

// Palm silhouette: trunk curve + radial fronds.
function drawPalm(ctx, bx, by, height, color, rng, lean = 0) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = Math.max(2, height * 0.055);
  ctx.lineCap = "round";
  const tipX = bx + lean * height;
  const tipY = by - height;
  ctx.beginPath();
  ctx.moveTo(bx, by);
  ctx.quadraticCurveTo(bx + lean * height * 0.3, by - height * 0.6, tipX, tipY);
  ctx.stroke();
  const fronds = 7;
  for (let i = 0; i < fronds; i++) {
    const ang = -Math.PI + (Math.PI * (i + 0.5)) / fronds + rngRange(rng, -0.12, 0.12);
    const len = height * rngRange(rng, 0.28, 0.42);
    const fx = tipX + Math.cos(ang) * len;
    const fy = tipY + Math.sin(ang) * len * 0.72 + len * 0.18;
    ctx.lineWidth = Math.max(1.5, height * 0.028);
    ctx.beginPath();
    ctx.moveTo(tipX, tipY);
    ctx.quadraticCurveTo(
      tipX + Math.cos(ang) * len * 0.55,
      tipY + Math.sin(ang) * len * 0.3 - len * 0.12,
      fx, fy
    );
    ctx.stroke();
  }
  ctx.restore();
}

// Full-bleed procedural scene used behind the panels and for empty panels.
function drawScene(ctx, x, y, w2, h2, pal, rng, seedTag = 0) {
  drawSky(ctx, x, y, w2, h2, pal, rng);
  drawClouds(ctx, x, y, w2, h2 * 0.7, pal, rng, 3 + (seedTag % 2));
  drawSun(ctx, x + w2 * rngRange(rng, 0.32, 0.68), y + h2 * rngRange(rng, 0.3, 0.46),
    Math.min(w2, h2) * rngRange(rng, 0.09, 0.15), pal);
  const baseline = y + h2 * rngRange(rng, 0.66, 0.74);
  drawSkyline(ctx, x, baseline, w2, h2 * 0.3, pal, rng);
  drawWater(ctx, x, baseline, w2, y + h2 - baseline, pal, rng);
}

// ---------------------------------------------------------------------------
// photo frames
// ---------------------------------------------------------------------------

// Cover-fit a bitmap into a frame honouring the editor's zoom/pan state.
function drawPhoto(ctx, img, fx, fy, fw, fh, zoom, ox, oy) {
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  if (!iw || !ih) return;
  const base = Math.max(fw / iw, fh / ih);
  const s = base * clamp(zoom || 1, 1, 3);
  const dw = iw * s;
  const dh = ih * s;
  const dx = fx + (fw - dw) / 2 + (ox || 0) * fw;
  const dy = fy + (fh - dh) / 2 + (oy || 0) * fh;
  ctx.drawImage(img, dx, dy, dw, dh);
}

// Warm/cool grade a photo panel: an overlay wash that ties each photo into
// the palette without flattening it, plus a per-panel corner light bite.
function gradePanel(ctx, fx, fy, fw, fh, pal, rng, i) {
  ctx.save();
  ctx.globalCompositeOperation = "overlay";
  ctx.globalAlpha = 0.18;
  const g = ctx.createLinearGradient(fx, fy, fx, fy + fh);
  g.addColorStop(0, withAlpha(pal.accent2, 0.8));
  g.addColorStop(1, withAlpha(pal.accent, 0.8));
  ctx.fillStyle = g;
  ctx.fillRect(fx, fy, fw, fh);
  ctx.restore();

  ctx.save();
  ctx.globalCompositeOperation = "screen";
  ctx.globalAlpha = 0.16;
  const lx = fx + (i % 2 ? fw : 0);
  const ly = fy + (i % 3 ? 0 : fh);
  const lg = ctx.createRadialGradient(lx, ly, 0, lx, ly, Math.max(fw, fh) * 0.6);
  lg.addColorStop(0, withAlpha(pal.sun, 0.9));
  lg.addColorStop(1, withAlpha(pal.sun, 0));
  ctx.fillStyle = lg;
  ctx.fillRect(fx, fy, fw, fh);
  ctx.restore();
  void rng;
}

// Sticker chip: small rotated rounded label, like tape or a tour sticker.
function drawStickerChip(ctx, x, y, text, color, ink, rng, angle = null, scale = 1) {
  ctx.save();
  setFont(ctx, 15 * scale, FONT_BODY, WEIGHT.MICRO);
  const padX = 10 * scale;
  const padY = 6 * scale;
  const tw = ctx.measureText(String(text).toUpperCase()).width;
  const w2 = tw + padX * 2;
  const h2 = (15 + padY * 2) * scale;
  const a = angle === null ? rngRange(rng, -0.09, 0.09) : angle;
  ctx.translate(x, y);
  ctx.rotate(a);
  ctx.shadowColor = "rgba(0,0,0,0.4)";
  ctx.shadowBlur = 8 * scale;
  ctx.shadowOffsetY = 3 * scale;
  roundRectPath(ctx, -w2 / 2, -h2 / 2, w2, h2, 4 * scale);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.shadowColor = "transparent";
  ctx.fillStyle = ink;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(String(text).toUpperCase(), 0, 1 * scale);
  ctx.restore();
}

// Panel accent kit: torn paper mat, neon frame stroke, sticker chips, tape
// tabs and a cast-role tag.
function drawFrameAccents(ctx, fx, fy, fw, fh, pal, rng, panel, i, k) {
  // (the torn paper mat is painted in the panel mat pass, before photos)

  ctx.save();
  ctx.translate(fx + fw / 2, fy + fh / 2);
  ctx.rotate(-0.012 + (i % 2) * 0.02);
  ctx.translate(-fx - fw / 2, -fy - fh / 2);

  // sticker chips seeded per panel
  if (panel.time) {
    drawStickerChip(ctx, fx + fw * 0.18, fy + fh + 2 * k, panel.time, pal.accent, pal.ink, rng, null, k);
  }
  if (panel.label) {
    drawStickerChip(ctx, fx + fw * 0.72, fy - 8 * k, panel.label, pal.accent2, pal.ink, rng, rngRange(rng, -0.12, 0.06), k);
  } else if (i === 0) {
    drawStickerChip(ctx, fx + fw * 0.7, fy - 8 * k, "35mm", pal.accent2, pal.ink, rng, -0.07, k);
  }

  // tape tabs on the top corners
  ctx.save();
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = mixColor(pal.sun, "#ffffff", 0.4);
  const tapeW = 26 * k;
  const tapeH = 9 * k;
  ctx.save();
  ctx.translate(fx + 6 * k, fy + 2 * k);
  ctx.rotate(-0.5);
  ctx.fillRect(-tapeW / 2, -tapeH / 2, tapeW, tapeH);
  ctx.restore();
  ctx.save();
  ctx.translate(fx - 6 * k + fw, fy + 2 * k);
  ctx.rotate(0.5);
  ctx.fillRect(-tapeW / 2, -tapeH / 2, tapeW, tapeH);
  ctx.restore();
  ctx.restore();

  // cast role tag bottom-right
  if (panel.role) {
    ctx.save();
    setFont(ctx, 13 * k, FONT_BODY, WEIGHT.MICRO);
    ctx.fillStyle = withAlpha(pal.paper, 0.85);
    roundRectPath(ctx, fx + fw - 130 * k, fy + fh - 24 * k, 122 * k, 18 * k, 9 * k);
    ctx.fill();
    ctx.fillStyle = mixColor(pal.paper, "#ffffff", 0.85);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(panel.role.toUpperCase(), fx + fw - 69 * k, fy + fh - 15 * k);
    ctx.restore();
  }
  ctx.restore();

  // neon frame stroke, on top so it stays crisp after the tilt
  ctx.save();
  ctx.strokeStyle = withAlpha(pal.accent2, 0.85);
  ctx.lineWidth = Math.max(1.5, 2.4 * k);
  ctx.shadowColor = withAlpha(pal.accent2, 0.9);
  ctx.shadowBlur = 10 * k;
  roundRectPath(ctx, fx, fy, fw, fh, 3 * k);
  ctx.stroke();
  ctx.restore();
}

// ---------------------------------------------------------------------------
// title lettering + review strip + banner band + seal
// ---------------------------------------------------------------------------

// Fit the display title to the banner width: shrink until it fits on one
// line, then paint with a thick outline, drop shadow and hot top-gradient.
function drawTitle(ctx, cx, by, maxW, title, pal, k) {
  const text = (title || "VICE STATE").toUpperCase();
  let size = maxW * 0.17;
  setFont(ctx, size, FONT_DISPLAY, WEIGHT.TITLE);
  const w0 = ctx.measureText(text).width;
  if (w0 > maxW) {
    size *= (maxW / w0) * 0.96;
    setFont(ctx, size, FONT_DISPLAY, WEIGHT.TITLE);
  }
  const wText = ctx.measureText(text).width;
  const x0 = cx - wText / 2;

  ctx.save();
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";

  // soft ground shadow
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.55)";
  ctx.shadowBlur = 22 * k;
  ctx.shadowOffsetY = 8 * k;
  ctx.fillStyle = withAlpha(pal.paper, 0.9);
  ctx.fillText(text, x0, by);
  ctx.restore();

  // heavy outline
  ctx.lineWidth = Math.max(3, size * 0.055);
  ctx.lineJoin = "round";
  ctx.strokeStyle = pal.paper;
  ctx.strokeText(text, x0, by);

  // chrome gradient fill
  const g = ctx.createLinearGradient(0, by - size, 0, by + size * 0.1);
  g.addColorStop(0, "#ffffff");
  g.addColorStop(0.42, pal.accent2);
  g.addColorStop(0.55, pal.accent);
  g.addColorStop(1, shiftColor(pal.accent, 0.35));
  ctx.fillStyle = g;
  ctx.fillText(text, x0, by);
  ctx.restore();
  return size;
}

// Review strip: quote, five star pips, critic line. Returns the bottom y.
function drawReviewStrip(ctx, cx, y, maxW, quote, stars, pal, k) {
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  let cy = y;
  if (quote) {
    setFont(ctx, 17 * k, FONT_BODY, WEIGHT.LABEL, true);
    ctx.fillStyle = mixColor(pal.paper, "#ffffff", 0.92);
    ctx.shadowColor = "rgba(0,0,0,0.45)";
    ctx.shadowBlur = 6 * k;
    ctx.fillText(`\u201C${quote}\u201D`, cx, cy);
    ctx.shadowColor = "transparent";
    cy += 24 * k;
  }
  const pip = 9 * k;
  const gap = pip * 2.4;
  const total = gap * 5;
  for (let i = 0; i < 5; i++) {
    const sx = cx - total / 2 + gap * i + gap / 2;
    drawStar(ctx, sx, cy, pip, i < stars ? pal.accent : withAlpha(pal.paper, 0.55));
  }
  cy += 20 * k;
  ctx.restore();
  void maxW;
  return cy;
}

function drawStar(ctx, cx, cy, r, color) {
  ctx.save();
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 === 0 ? r : r * 0.45;
    const a = -Math.PI / 2 + (Math.PI * i) / 5;
    const px = cx + Math.cos(a) * rad;
    const py = cy + Math.sin(a) * rad;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
}

// Banner band: horizon strip at the foot of the poster with a striped sun,
// palm pair, and a ground rail.
function drawBannerBand(ctx, x, y, w2, h2, pal, rng) {
  const g = ctx.createLinearGradient(0, y, 0, y + h2);
  g.addColorStop(0, shiftColor(pal.paper, -0.1));
  g.addColorStop(1, pal.ink);
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w2, h2);

  // striped half-sun rising out of the band top
  const r = Math.min(w2, h2) * 0.16;
  const sunX = x + w2 * 0.82;
  const sunY = y + h2 * 0.12;
  ctx.save();
  ctx.beginPath();
  ctx.arc(sunX, sunY, r, Math.PI, 0);
  ctx.closePath();
  ctx.clip();
  const sg = ctx.createLinearGradient(0, sunY - r, 0, sunY);
  sg.addColorStop(0, pal.sun);
  sg.addColorStop(1, pal.accent);
  ctx.fillStyle = sg;
  ctx.fillRect(sunX - r, sunY - r, r * 2, r);
  ctx.fillStyle = withAlpha(pal.ink, 0.9);
  for (let i = 0; i < 4; i++) {
    const sy = sunY - r * (0.15 + i * 0.22);
    ctx.fillRect(sunX - r, sy, r * 2, Math.max(1.5, r * (0.04 + i * 0.02)));
  }
  ctx.restore();

  // palm pair flanking the band
  drawPalm(ctx, x + w2 * 0.1, y + h2 * 0.96, h2 * 1.15, pal.ink, rng, 0.12);
  drawPalm(ctx, x + w2 * 0.9, y + h2 * 0.96, h2 * 0.95, pal.ink, rng, -0.16);

  // ground rail line
  ctx.strokeStyle = withAlpha(pal.accent2, 0.7);
  ctx.lineWidth = Math.max(1, h2 * 0.012);
  ctx.beginPath();
  ctx.moveTo(x + w2 * 0.05, y + h2 * 0.97);
  ctx.lineTo(x + w2 * 0.95, y + h2 * 0.97);
  ctx.stroke();
}

// Seal badge: wax disc, rim, label set around an arc, and a star core.
function drawSeal(ctx, cx, cy, r, pal, label = "VICE APPROVED") {
  ctx.save();
  const g = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.2, cx, cy, r);
  g.addColorStop(0, mixColor(pal.accent, "#ffffff", 0.25));
  g.addColorStop(1, shiftColor(pal.accent, 0.4));
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = g;
  ctx.shadowColor = "rgba(0,0,0,0.5)";
  ctx.shadowBlur = 14;
  ctx.shadowOffsetY = 4;
  ctx.fill();
  ctx.shadowColor = "transparent";

  // rim
  ctx.strokeStyle = withAlpha(pal.paper, 0.9);
  ctx.lineWidth = Math.max(1.5, r * 0.06);
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.8, 0, Math.PI * 2);
  ctx.stroke();

  // label wrapped around the upper arc
  setFont(ctx, Math.max(6, r * 0.17), FONT_BODY, WEIGHT.MICRO);
  ctx.fillStyle = withAlpha(pal.paper, 0.95);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const chars = Array.from(label.toUpperCase());
  const arc = Math.PI * 1.5;
  chars.forEach((ch, i) => {
    const a = -Math.PI * 0.75 + (arc * i) / Math.max(1, chars.length - 1);
    ctx.save();
    ctx.translate(cx + Math.cos(a) * r * 0.66, cy + Math.sin(a) * r * 0.66);
    ctx.rotate(a + Math.PI / 2);
    ctx.fillText(ch, 0, 0);
    ctx.restore();
  });

  drawStar(ctx, cx, cy, r * 0.34, withAlpha(pal.paper, 0.95));
  ctx.restore();
}

// ---------------------------------------------------------------------------
// finishing pass
// ---------------------------------------------------------------------------

function drawLightLeak(ctx, w2, h2, pal, rng) {
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  for (let i = 0; i < 2; i++) {
    const lx = rng() < 0.5 ? rngRange(rng, 0, w2 * 0.2) : rngRange(rng, w2 * 0.8, w2);
    const ly = rngRange(rng, 0, h2 * 0.35);
    const lr = Math.max(w2, h2) * rngRange(rng, 0.28, 0.5);
    const g = ctx.createRadialGradient(lx, ly, 0, lx, ly, lr);
    const col = i % 2 ? pal.accent2 : pal.sun;
    g.addColorStop(0, withAlpha(col, 0.22));
    g.addColorStop(0.6, withAlpha(col, 0.08));
    g.addColorStop(1, withAlpha(col, 0));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w2, h2);
  }
  ctx.restore();
}

function drawGrain(ctx, w2, h2, rng, strength = 0.055) {
  const gw = 160;
  const gh = Math.max(1, Math.round((gw * h2) / w2));
  const off = document.createElement("canvas");
  off.width = gw;
  off.height = gh;
  const octx = off.getContext("2d");
  const imgData = octx.createImageData(gw, gh);
  for (let i = 0; i < imgData.data.length; i += 4) {
    const v = 128 + (rng() - 0.5) * 255;
    imgData.data[i] = v;
    imgData.data[i + 1] = v;
    imgData.data[i + 2] = v;
    imgData.data[i + 3] = 255;
  }
  octx.putImageData(imgData, 0, 0);
  ctx.save();
  ctx.globalAlpha = strength;
  ctx.globalCompositeOperation = "overlay";
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(off, 0, 0, w2, h2);
  ctx.restore();
}

function drawVignette(ctx, w2, h2, strength = 0.4) {
  const g = ctx.createRadialGradient(
    w2 / 2, h2 / 2, Math.min(w2, h2) * 0.35,
    w2 / 2, h2 / 2, Math.max(w2, h2) * 0.75
  );
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(1, `rgba(0,0,0,${strength})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w2, h2);
}

// ---------------------------------------------------------------------------
// main entry
// ---------------------------------------------------------------------------

// Render the full poster for `state` onto `canvas`. Resolves when done.
export async function renderCover(canvas, state) {
  const [w, h] = resolveSize(state.size);
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  const rng = makeRng((state.seed >>> 0) + 11);
  const pal = paletteVariant(state.palette, state.variant || "raw");
  const tpl = TEMPLATES[state.template] || TEMPLATES.hero;
  const k = Math.min(w, h) / 1080; // layout scale: identical proportions at any size

  // 1. paper backdrop
  ctx.fillStyle = pal.paper;
  ctx.fillRect(0, 0, w, h);

  // 2. ambient scene fills the margins behind everything
  drawScene(ctx, 0, 0, w, h, pal, rng, state.seed >>> 0);

  // 3. banner band across the foot
  const bandH = h * 0.34;
  const bandY = h - bandH;
  drawBannerBand(ctx, 0, bandY, w, bandH, pal, rng);

  // 4. photo panels — mats first, then photos, then accents, so torn paper
  // never covers a loaded bitmap
  const panels = tpl.panels;
  const photos = Array.isArray(state.photos) ? state.photos : [];

  const panelRect = (p) => [p.x * w, p.y * h, p.w * w, p.h * h];

  // mats (paper + torn edge) behind everything
  panels.forEach((p, i) => {
    const [fx, fy, fw, fh] = panelRect(p);
    const mat = 10 * k;
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.45)";
    ctx.shadowBlur = 18 * k;
    ctx.shadowOffsetY = 6 * k;
    tornEdgePath(ctx, fx - mat, fy - mat, fw + mat * 2, fh + mat * 2, rng, "bottom");
    ctx.fillStyle = mixColor(pal.paper, "#ffffff", 0.82);
    ctx.fill();
    ctx.restore();
  });

  // photos / procedural fills
  panels.forEach((p, i) => {
    const [fx, fy, fw, fh] = panelRect(p);
    const ph = photos[i] || {};
    ctx.save();
    roundRectPath(ctx, fx, fy, fw, fh, 4 * k);
    ctx.clip();
    if (ph.img) {
      drawPhoto(ctx, ph.img, fx, fy, fw, fh, ph.zoom, ph.ox, ph.oy);
      gradePanel(ctx, fx, fy, fw, fh, pal, rng, i);
    } else {
      // procedural fallback scene per panel, reseeded so panels differ
      const prng = makeRng(((state.seed >>> 0) + i * 977) >>> 0);
      drawScene(ctx, fx, fy, fw, fh, pal, prng, i);
    }
    ctx.restore();
  });

  // accents: tilt, sticker chips, tape tabs, role tags, neon frame
  panels.forEach((p, i) => {
    const [fx, fy, fw, fh] = panelRect(p);
    const ph = photos[i] || {};
    drawFrameAccents(ctx, fx, fy, fw, fh, pal, rng, ph, i, k);
  });

  // panel zoom defaults: wide hero fills more of the frame
  panels.forEach((p, i) => {
    const ph = photos[i];
    if (ph && !ph.zoom) ph.zoom = 1.35;
  });
  const titleSize = drawTitle(ctx, w / 2, bandY + bandH * 0.4, w * 0.86, state.title, pal, k);
  const titleBaseline = bandY + bandH * 0.4;

  // subtitle — italic echo under the title
  if (state.subtitle) {
    ctx.save();
    ctx.textAlign = "center";
    setFont(ctx, titleSize * 0.3, FONT_BODY, WEIGHT.SUBTITLE, true);
    ctx.fillStyle = mixColor(pal.paper, "#ffffff", 0.9);
    ctx.shadowColor = "rgba(0,0,0,0.5)";
    ctx.shadowBlur = 8 * k;
    ctx.fillText(state.subtitle, w / 2, titleBaseline + titleSize * 0.45);
    ctx.restore();
  }

  // 6. review strip (quote + stars) — floats over the sky just above the band
  const quoteAbove = state.subtitle ? bandY - 26 * k : bandY - 12 * k;
  drawReviewStrip(ctx, w / 2, quoteAbove, w * 0.8, state.quote, clamp(state.stars ?? 5, 0, 5), pal, k);

  // 7. tagline rail at the very bottom
  if (state.tagline) {
    ctx.save();
    setFont(ctx, 15 * k, FONT_BODY, WEIGHT.MICRO);
    ctx.fillStyle = withAlpha(pal.accent2, 0.95);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    drawTracked(ctx, state.tagline.toUpperCase(), w / 2, h - 14 * k, 15 * k * TRACKING.micro, "center");
    ctx.restore();
  }

  // 8. seal badge, upper-right over the ambient scene
  drawSeal(ctx, w - 78 * k, 78 * k, 44 * k, pal);

  // 9. finishing pass: light leak, grain, vignette
  drawLightLeak(ctx, w, h, pal, rng);
  drawGrain(ctx, w, h, rng);
  drawVignette(ctx, w, h, 0.38);

  // 10. neon outer border
  ctx.save();
  const bw = Math.max(2, 4 * k);
  ctx.strokeStyle = withAlpha(pal.accent2, 0.8);
  ctx.lineWidth = bw;
  ctx.strokeRect(bw / 2, bw / 2, w - bw, h - bw);
  ctx.restore();
}

// exportPNG(canvas) -> data URL for the download link in main.js.
export function exportPNG(canvas) {
  return canvas.toDataURL("image/png");
}
