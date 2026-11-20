// Vice State — poster renderer.
//
// Everything on the poster is drawn here with the 2D canvas API: a procedural
// sunset sky, tilted photo panels with drop shadows, per-panel accents, the
// extruded title lettering, a seal badge, a palm-dotted banner band and a
// finishing grade (halation, grain, vignette). No image assets, no logo, no
// fonts beyond the system stacks in fonts.js — a given seed always redraws
// exactly the same poster.

import { FONT_DISPLAY, FONT_BODY, WEIGHT, defaultFontStack } from "./fonts.js";
export { defaultFontStack };

// ---------------------------------------------------------------- palettes

const PALETTES = {
  sunset: {
    top: "#2b0a3d", mid: "#a02d6f", hot: "#ff8a3d", glow: "#ffd54a",
    neon: "#ff2fb3", deep: "#3a0e2e", name: "Sunset Boulevard",
  },
  neon: {
    top: "#12002e", mid: "#5b1690", hot: "#e33fff", glow: "#f8d9ff",
    neon: "#00e5ff", deep: "#0b001f", name: "Neon Nights",
  },
  vice: {
    top: "#24064a", mid: "#b0267e", hot: "#ff6a3d", glow: "#ffd166",
    neon: "#28f0d8", deep: "#2d0b3c", name: "Vice Cyan",
  },
  midnight: {
    top: "#05010f", mid: "#301b5c", hot: "#7a4bff", glow: "#c7b9ff",
    neon: "#ff4fd8", deep: "#0a0320", name: "Midnight Purple",
  },
  dawn: {
    top: "#1c1035", mid: "#c9556e", hot: "#ffb56b", glow: "#ffe9b0",
    neon: "#ff8ad8", deep: "#33102e", name: "Pastel Dawn",
  },
};

export const PALETTE_NAMES = Object.keys(PALETTES);
export function palette(name) {
  return PALETTES[name] || PALETTES.sunset;
}

// ------------------------------------------------------------- templates
// Panel rects are unit coordinates on the finished canvas. The first panel of
// each template is the dominant one (star: true) and carries the wanted stars.

export const TEMPLATES = {
  hero: {
    name: "Hero",
    sizes: [1920, 1080],
    panels: [
      { x: .030, y: .055, w: .520, h: .660, tilt: -1.2, star: true },
      { x: .575, y: .055, w: .205, h: .420, tilt: 1.0 },
      { x: .795, y: .055, w: .175, h: .420, tilt: -1.0 },
      { x: .575, y: .500, w: .205, h: .360, tilt: -1.0 },
      { x: .795, y: .500, w: .175, h: .360, tilt: 1.0 },
    ],
  },
  grid5: {
    name: "Mosaic",
    sizes: [1080, 1350],
    panels: [
      { x: .045, y: .040, w: .430, h: .560, tilt: -1.0, star: true },
      { x: .500, y: .040, w: .455, h: .260, tilt: 1.0 },
      { x: .045, y: .625, w: .430, h: .220, tilt: 1.0 },
      { x: .500, y: .325, w: .215, h: .275, tilt: -1.5 },
      { x: .740, y: .325, w: .215, h: .275, tilt: 1.5 },
      { x: .500, y: .625, w: .455, h: .220, tilt: -1.0 },
    ],
  },
  widescreen: {
    name: "Wide",
    vignette: true,
    sizes: [1920, 1080],
    panels: [
      { x: .035, y: .070, w: .410, h: .610, tilt: -1.2, star: true },
      { x: .470, y: .070, w: .300, h: .330, tilt: 1.0 },
      { x: .790, y: .070, w: .175, h: .330, tilt: -1.0 },
      { x: .470, y: .425, w: .175, h: .235, tilt: -1.5 },
      { x: .665, y: .425, w: .105, h: .235, tilt: 0 },
      { x: .790, y: .425, w: .175, h: .235, tilt: 1.5 },
    ],
  },
  collage: {
    name: "Collage",
    sizes: [1080, 1080],
    panels: [
      { x: .045, y: .045, w: .430, h: .430, tilt: -1.2, star: true },
      { x: .520, y: .045, w: .435, h: .270, tilt: 1.0 },
      { x: .045, y: .510, w: .270, h: .270, tilt: 1.5 },
      { x: .350, y: .510, w: .270, h: .270, tilt: -1.5 },
      { x: .655, y: .350, w: .300, h: .200, tilt: 1.0 },
      { x: .520, y: .565, w: .435, h: .245, tilt: 1.0 },
    ],
  },
};

export const SIZES = {
  "1080 x 1080": [1080, 1080],
  "1080 x 1350": [1080, 1350],
  "1920 x 1080": [1920, 1080],
};

// --------------------------------------------------------------- helpers

function roundRect(ctx, x, y, w, h, r) {
  const rad = Math.max(0, Math.min(r, Math.min(w, h) / 2));
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

// Parse a colour into [r,g,b]. Accepts "#abc", "#aabbcc" and the "rgb(r,g,b)"
// strings blend() hands back, so derived colours can be alpha-blended again.
function toRgb(color) {
  const text = String(color).trim();
  if (text.startsWith("rgb")) {
    const parts = text.slice(text.indexOf("(") + 1, text.indexOf(")"))
      .split(",")
      .map((n) => parseFloat(n));
    return [parts[0] || 0, parts[1] || 0, parts[2] || 0];
  }
  let h = text.replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  return [
    parseInt(h.slice(0, 2), 16) || 0,
    parseInt(h.slice(2, 4), 16) || 0,
    parseInt(h.slice(4, 6), 16) || 0,
  ];
}

function rgba(color, a) {
  const [r, g, b] = toRgb(color);
  return `rgba(${Math.round(r)},${Math.round(g)},${Math.round(b)},${a})`;
}

// Linear blend between two hex colours, returned as a css rgb() string.
function blend(a, b, t) {
  const A = toRgb(a), B = toRgb(b);
  const ch = (i) => Math.round(A[i] + (B[i] - A[i]) * t);
  return `rgb(${ch(0)},${ch(1)},${ch(2)})`;
}

// Deterministic PRNG (mulberry32) so a seed always produces the same art.
function seedRandom(seed) {
  let s = seed >>> 0;
  return function next() {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ------------------------------------------------------------ background

function paintSky(ctx, W, H, pal, rand) {
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, pal.top);
  sky.addColorStop(.35, pal.mid);
  sky.addColorStop(.62, pal.hot);
  sky.addColorStop(.85, pal.glow);
  sky.addColorStop(1, pal.deep);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  // Extra hot wash across the horizon band: pushes every palette a notch
  // warmer so pictures and backdrop grade into each other.
  const wash = ctx.createLinearGradient(0, H * .38, 0, H * .84);
  wash.addColorStop(0, rgba(pal.hot, 0));
  wash.addColorStop(.45, rgba(pal.hot, .26));
  wash.addColorStop(1, rgba(pal.hot, 0));
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, W, H);

  // Half-set sun sitting on the skyline, left of centre.
  const sunX = W * (.22 + rand() * .10);
  const sunY = H * (.745 + rand() * .015);
  const sunR = W * (.075 + rand() * .015);
  const halo = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, W * .36);
  halo.addColorStop(0, rgba(pal.glow, .95));
  halo.addColorStop(.25, rgba(pal.hot, .55));
  halo.addColorStop(1, rgba(pal.hot, 0));
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = rgba(pal.glow, .9);
  ctx.beginPath();
  ctx.arc(sunX, sunY, sunR, 0, Math.PI * 2);
  ctx.fill();

  // Retro stripes cut out of the disc's lower half.
  ctx.save();
  ctx.globalCompositeOperation = "destination-out";
  const stripe = H * .012;
  for (let i = 1; i < 6; i++) {
    ctx.fillRect(sunX - sunR * 1.1, sunY - sunR + i * stripe * 1.9,
      sunR * 2.2, stripe * (i * .35 + .6));
  }
  ctx.restore();
}

function cloudBand(ctx, W, H, pal, rand, yBase, count, alpha) {
  for (let i = 0; i < count; i++) {
    const cx = rand() * W;
    const cy = yBase + (rand() - .5) * H * .1;
    const cw = W * (.08 + rand() * .18);
    const ch = H * (.012 + rand() * .02);

    ctx.fillStyle = rgba(pal.glow, alpha * (.4 + rand() * .6));
    ctx.beginPath();
    ctx.ellipse(cx, cy, cw / 2, ch / 2, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = rgba(pal.neon, alpha * .35 * rand());
    ctx.beginPath();
    ctx.ellipse(cx + cw * .18, cy + ch * .5, cw / 2.4, ch / 2.2, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

// One palm: a slightly bent trunk plus eight drooping fronds. Drawn in local
// space with the base at the origin, growing upward (negative y).
function palmSilhouette(ctx, x, baseY, h, lean, color) {
  ctx.save();
  ctx.translate(x, baseY);
  ctx.rotate(lean);
  ctx.fillStyle = color;

  ctx.beginPath();
  ctx.moveTo(-h * .06, 0);
  ctx.quadraticCurveTo(h * .05, -h * .5, h * .02, -h * .88);
  ctx.lineTo(h * .07, -h * .88);
  ctx.quadraticCurveTo(h * .11, -h * .5, h * .06, 0);
  ctx.closePath();
  ctx.fill();

  const crownX = h * .045;
  const crownY = -h * .88;
  for (let f = 0; f < 8; f++) {
    ctx.save();
    ctx.translate(crownX, crownY);
    ctx.rotate(-Math.PI * .95 + f * (Math.PI * .9 / 7));
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(h * .22, -h * .16, h * .46, -h * .06);
    ctx.quadraticCurveTo(h * .24, h * .02, 0, h * .05);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  ctx.beginPath();
  ctx.arc(crownX, crownY, h * .045, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function skylineBand(ctx, W, H, pal, rand, yBase, hMax, color, alpha) {
  ctx.save();
  ctx.fillStyle = rgba(color, alpha);
  let x = -W * .02;
  while (x < W * 1.02) {
    const bw = W * (.02 + rand() * .045);
    const bh = hMax * (.3 + rand() * .7);
    ctx.fillRect(x, yBase - bh, bw, bh);

    if (rand() > .4) {
      ctx.fillStyle = rgba(pal.glow, alpha * .5);
      const rows = Math.floor(bh / (H * .02));
      for (let r = 0; r < rows; r++) {
        const wy = yBase - bh + r * H * .02 + H * .008;
        if (rand() > .5) ctx.fillRect(x + bw * .2, wy, bw * .2, H * .006);
        if (rand() > .5) ctx.fillRect(x + bw * .55, wy, bw * .2, H * .006);
      }
      ctx.fillStyle = rgba(color, alpha);
    }
    x += bw * (1.05 + rand() * .3);
  }
  ctx.restore();
}

// ----------------------------------------------------------- photo panels

// Draw one photo (or its procedural stand-in) inside a tilted rounded rect.
// `photo` carries zoom plus ox/oy offsets in fractions of the panel box.
function drawPanelPhoto(ctx, img, rect, photo, grad, pal) {
  const { w, h } = rect;
  ctx.save();
  ctx.translate(rect.cx, rect.cy);
  ctx.rotate(rect.tilt * Math.PI / 180);
  roundRect(ctx, -w / 2, -h / 2, w, h, w * .018);
  ctx.save();
  ctx.clip();

  if (img) {
    const scale = Math.max(w / img.width, h / img.height) * (photo.zoom || 1);
    const dw = img.width * scale;
    const dh = img.height * scale;
    // Clamp the pan offsets to the cover-fit slack so a hard drag can never
    // pull an edge of the photo inside the frame and expose the backdrop.
    const slackX = Math.max(0, (dw - w) / 2) / w;
    const slackY = Math.max(0, (dh - h) / 2) / h;
    const ox = Math.min(slackX, Math.max(-slackX, photo.ox || 0));
    const oy = Math.min(slackY, Math.max(-slackY, photo.oy || 0));
    ctx.drawImage(img, -dw / 2 + ox * w, -dh / 2 + oy * h, dw, dh);

    // Warm light from the lower left, matching the sun behind the collage.
    const rim = ctx.createRadialGradient(-w * .32, h * .42, w * .05, -w * .32, h * .42, w * .95);
    rim.addColorStop(0, rgba(pal.glow, .30));
    rim.addColorStop(.5, rgba(pal.hot, .10));
    rim.addColorStop(1, "rgba(0,0,0,0)");
    ctx.globalCompositeOperation = "soft-light";
    ctx.fillStyle = rim;
    ctx.fillRect(-w / 2, -h / 2, w, h);
    ctx.globalCompositeOperation = "source-over";
  } else {
    const g = ctx.createLinearGradient(0, -h / 2, 0, h / 2);
    g.addColorStop(0, grad[0]);
    g.addColorStop(1, grad[1]);
    ctx.fillStyle = g;
    ctx.fillRect(-w / 2, -h / 2, w, h);

    const rnd = seedRandom(((photo.seed || 7) * 2654435761) >>> 0);
    ctx.fillStyle = "rgba(255,255,255,.14)";
    for (let i = 0; i < 14; i++) {
      const cx = -w / 2 + rnd() * w;
      const cy = -h / 2 + rnd() * h;
      const cw = w * (.1 + rnd() * .3);
      ctx.beginPath();
      ctx.ellipse(cx, cy, cw / 2, cw / 8, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Diagonal grade: warm from the lower left, magenta into the upper right.
  const grade = ctx.createLinearGradient(-w / 2, h / 2, w / 2, -h / 2);
  grade.addColorStop(0, rgba(grad[0], .38));
  grade.addColorStop(.55, "rgba(0,0,0,0)");
  grade.addColorStop(1, rgba(grad[1], .30));
  ctx.fillStyle = grade;
  ctx.fillRect(-w / 2, -h / 2, w, h);

  // Faint scanlines.
  ctx.globalAlpha = .05;
  ctx.fillStyle = "#000";
  const lineH = Math.max(3, h * .012);
  for (let y = -h / 2; y < h / 2; y += lineH) {
    ctx.fillRect(-w / 2, y, w, Math.max(1, h * .004));
  }
  ctx.globalAlpha = 1;

  ctx.restore();
  ctx.restore();
}

// Shadow pass, drawn for every panel before any photo so panels overlap
// correctly and the whole grid floats above the sky.
function panelShadow(ctx, rect, pal) {
  ctx.save();
  ctx.translate(rect.cx, rect.cy);
  ctx.rotate(rect.tilt * Math.PI / 180);
  ctx.shadowColor = rgba(pal.deep, .55);
  ctx.shadowBlur = rect.w * .07;
  ctx.shadowOffsetX = rect.w * .012;
  ctx.shadowOffsetY = rect.w * .016;
  ctx.fillStyle = "#000";
  roundRect(ctx, -rect.w / 2, -rect.h / 2, rect.w, rect.h, rect.w * .018);
  ctx.fill();
  ctx.restore();
}

// ------------------------------------------------------------- lettering

// Shrink a font size until the string fits maxW, so long captions never spill
// past the poster edge or run into the seal badge.
function fitDisplay(ctx, text, size, maxW, weight = WEIGHT.TITLE) {
  const set = (s) => {
    ctx.font = `${weight ? `${weight} ` : ""}${Math.round(s)}px ${FONT_DISPLAY}`;
  };
  set(size);
  while (size > 10 && ctx.measureText(text).width > maxW) {
    size *= 0.94;
    set(size);
  }
  return size;
}

// Canvas has no portable letterSpacing, so tracked text is drawn glyph by
// glyph and centred on cx by hand.
function trackedText(ctx, text, cx, y, tracking) {
  const chars = [...text];
  const widths = chars.map((c) => ctx.measureText(c).width);
  const total = widths.reduce((a, b) => a + b, 0) + tracking * (chars.length - 1);
  let x = cx - total / 2;
  const prevAlign = ctx.textAlign;
  ctx.textAlign = "left";
  chars.forEach((c, i) => {
    ctx.fillText(c, x, y);
    x += widths[i] + tracking;
  });
  ctx.textAlign = prevAlign;
}

// Extruded chrome title: stacked dark offset layers, a deep rim, a vertical
// gradient fill, then a specular re-stroke clipped to the top half.
function drawTitle(ctx, text, cx, y, size, pal, extrude, maxW) {
  ctx.save();
  size = fitDisplay(ctx, text, size, maxW);
  ctx.font = `${WEIGHT.TITLE} ${Math.round(size)}px ${FONT_DISPLAY}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";

  for (let i = extrude; i >= 1; i--) {
    ctx.fillStyle = blend(pal.deep, "#000000", (i / extrude) * .7);
    ctx.fillText(text, cx + i * size * .012, y + i * size * .012);
  }

  ctx.lineWidth = size * .075;
  ctx.strokeStyle = pal.deep;
  ctx.strokeText(text, cx, y);

  const fill = ctx.createLinearGradient(0, y - size * .9, 0, y + size * .05);
  fill.addColorStop(0, "#fff7d6");
  fill.addColorStop(.45, pal.glow);
  fill.addColorStop(.8, pal.hot);
  fill.addColorStop(1, pal.mid);
  ctx.fillStyle = fill;
  ctx.fillText(text, cx, y);

  ctx.globalCompositeOperation = "lighter";
  ctx.lineWidth = size * .02;
  ctx.strokeStyle = "rgba(255,255,255,.5)";
  ctx.save();
  ctx.beginPath();
  ctx.rect(cx - maxW, y - size * 1.05, maxW * 2, size * .72);
  ctx.clip();
  ctx.strokeText(text, cx, y);
  ctx.restore();
  ctx.globalCompositeOperation = "source-over";

  ctx.restore();
  return size;
}

// Subtitle: neon-outlined, letter-spaced line under the title.
function drawSubtitle(ctx, text, cx, y, size, pal, tracking = size * .05) {
  ctx.save();
  ctx.font = `${WEIGHT.SUBTITLE} ${size}px ${FONT_BODY}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";

  ctx.lineWidth = size * .22;
  ctx.strokeStyle = pal.deep;
  trackedText(ctx, text, cx, y, tracking);

  ctx.lineWidth = size * .1;
  ctx.strokeStyle = pal.neon;
  trackedText(ctx, text, cx, y, tracking);

  ctx.fillStyle = "#ffe9f7";
  trackedText(ctx, text, cx, y, tracking);
  ctx.restore();
}

// Five-point star polygon — the fonts carry no ★ glyph, so it is drawn.
function starPath(ctx, cx, cy, r) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 ? r * .45 : r;
    const a = -Math.PI / 2 + i * Math.PI / 5;
    const px = cx + Math.cos(a) * rad;
    const py = cy + Math.sin(a) * rad;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

function drawStars(ctx, x, y, filled, total, size, colorOn, colorOff) {
  for (let i = 0; i < total; i++) {
    starPath(ctx, x + size * .6 + i * size * 1.25, y, size * .52);
    ctx.fillStyle = i < filled ? colorOn : colorOff;
    ctx.fill();
  }
}

// ------------------------------------------------------------ banner band

// Palm-dotted strip along the bottom. Returns its geometry so the caller can
// place the tagline and the seal relative to it.
function drawBanner(ctx, W, H, pal) {
  const bh = H * .13;
  const y0 = H - bh;

  const g = ctx.createLinearGradient(0, y0, 0, H);
  g.addColorStop(0, pal.deep);
  g.addColorStop(1, blend(pal.top, "#000000", .25));
  ctx.fillStyle = g;
  ctx.fillRect(0, y0, W, bh);

  ctx.fillStyle = rgba(pal.neon, .6);
  ctx.fillRect(0, y0, W, H * .004);

  const palmColor = rgba(blend(pal.neon, "#ffffff", .25), .9);
  for (let i = 0; i < 11; i++) {
    palmSilhouette(ctx, W * (.055 + i * .088), H - bh * .34, bh * .78, 0, palmColor);
  }

  // Half-sun icon, centred.
  const sx = W * .5;
  const sy = y0 + bh * .30;
  ctx.fillStyle = pal.glow;
  ctx.beginPath();
  ctx.arc(sx, sy, bh * .16, Math.PI, 0);
  ctx.fill();
  ctx.fillStyle = pal.deep;
  for (let i = 0; i < 3; i++) {
    ctx.fillRect(sx - bh * .18, sy - bh * .05 * i, bh * .36, bh * .022 * (i + 1));
  }

  return { y0, bh };
}

// ------------------------------------------------------------- seal badge

// Court-of-arms style rosette: a 16-point star filled with the neon colour,
// a dark disc, and three short lines of small print. Drawn last so the banner
// palms can never clip its lower half.
function drawSeal(ctx, seal, pal) {
  const { sx, sy, sealR } = seal;
  const spikes = 16;
  ctx.save();
  ctx.translate(sx, sy);

  ctx.shadowColor = rgba(pal.deep, .6);
  ctx.shadowBlur = sealR * .4;
  ctx.beginPath();
  for (let i = 0; i < spikes * 2; i++) {
    const r = i % 2 ? sealR * .82 : sealR;
    const a = (i / (spikes * 2)) * Math.PI * 2 - Math.PI / 2;
    const px = Math.cos(a) * r;
    const py = Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = pal.neon;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.lineWidth = sealR * .1;
  ctx.strokeStyle = pal.deep;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(0, 0, sealR * .68, 0, Math.PI * 2);
  ctx.fillStyle = blend(pal.deep, "#000000", .2);
  ctx.fill();

  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `700 ${sealR * .2}px ${FONT_BODY}`;
  ctx.fillText("ORIGINAL", 0, -sealR * .18);
  ctx.font = `400 ${sealR * .15}px ${FONT_BODY}`;
  ctx.fillText("COVER ART", 0, sealR * .08);
  ctx.fillText("EST. 2026", 0, sealR * .32);
  ctx.restore();
}

// --------------------------------------------------------- panel accents

// Tilted travel-sticker chip with a mirrored palm glyph, pinned to the top
// right of a small panel.
function drawChip(ctx, rect, pal) {
  ctx.save();
  ctx.translate(rect.cx, rect.cy);
  ctx.rotate(rect.tilt * Math.PI / 180);

  const w = rect.w, h = rect.h;
  const cw = Math.min(w, h) * .26;
  const ch = cw * .68;
  const px = w / 2 - cw - w * .035;
  const py = -h / 2 + h * .035;

  ctx.translate(px + cw / 2, py + ch / 2);
  ctx.rotate(-8 * Math.PI / 180);

  ctx.shadowColor = rgba(pal.deep, .55);
  ctx.shadowBlur = cw * .25;
  roundRect(ctx, -cw / 2, -ch / 2, cw, ch, ch * .28);
  ctx.fillStyle = rgba(pal.glow, .92);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.lineWidth = ch * .09;
  ctx.strokeStyle = rgba(pal.neon, .9);
  ctx.stroke();

  ctx.save();
  ctx.translate(0, ch * .18);
  ctx.scale(-1, 1);
  palmSilhouette(ctx, 0, 0, ch * .62, 0, rgba(pal.deep, .95));
  ctx.restore();

  ctx.restore();
}

// Deckled paper edge torn down the right side of a panel, or a neon tape
// strip across its top-left corner.
function drawEdgeAccent(ctx, rect, pal, rand, kind) {
  ctx.save();
  ctx.translate(rect.cx, rect.cy);
  ctx.rotate(rect.tilt * Math.PI / 180);
  const w = rect.w, h = rect.h;

  if (kind === "torn") {
    ctx.beginPath();
    ctx.moveTo(w / 2, -h / 2);
    const steps = 14;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = w / 2 + (rand() - .5) * w * .022 + Math.sin(t * 21) * w * .006;
      ctx.lineTo(x, -h / 2 + t * h);
    }
    ctx.lineTo(w / 2 + w * .03, h / 2 + h * .015);
    ctx.lineTo(w / 2 - w * .012, h / 2 + h * .015);
    ctx.closePath();
    ctx.fillStyle = "rgba(255,246,225,.85)";
    ctx.fill();
    ctx.strokeStyle = rgba(pal.deep, .5);
    ctx.lineWidth = w * .004;
    ctx.stroke();
  } else {
    const len = Math.hypot(w, h) * .34;
    ctx.save();
    ctx.translate(-w / 2 + w * .07, -h / 2 + h * .03);
    ctx.rotate(-Math.PI / 7);
    ctx.shadowColor = rgba(pal.deep, .5);
    ctx.shadowBlur = w * .03;
    ctx.fillStyle = rgba(pal.neon, .9);
    ctx.fillRect(-len * .08, -w * .018, len, w * .036);
    ctx.shadowBlur = 0;
    ctx.fillStyle = "rgba(255,255,255,.55)";
    ctx.fillRect(-len * .08, -w * .018, len, w * .008);
    ctx.restore();
  }

  ctx.restore();
}

// ----------------------------------------------------------------- grade

// Warm halation from both top corners plus two diagonal light seams, laid on
// with screen so only the highlights lift.
function halationPass(ctx, W, H, pal, rand) {
  ctx.save();
  ctx.globalCompositeOperation = "screen";

  const corners = [
    { x: 0, y: 0, dx: W * .30, dy: H * .55, bias: .10 },
    { x: W, y: 0, dx: -W * .26, dy: H * .60, bias: .07 },
  ];
  for (const c of corners) {
    const cx = c.x + c.dx * (.85 + rand() * .2);
    const cy = c.y + c.dy * (.8 + rand() * .25);
    const R = Math.hypot(c.dx, c.dy) * (1.1 + rand() * .2);
    const halo = ctx.createRadialGradient(c.x, c.y, 0, cx, cy, R);
    halo.addColorStop(0, rgba(pal.glow, .26 + c.bias));
    halo.addColorStop(.35, rgba(pal.hot, .14 + c.bias));
    halo.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = halo;
    ctx.fillRect(0, 0, W, H);
  }

  for (let i = 0; i < 2; i++) {
    const x = W * (.08 + rand() * .5);
    const sw = W * (.03 + rand() * .07);
    const lean = H * (.25 + rand() * .5);
    const seam = ctx.createLinearGradient(x - sw, 0, x + sw * 1.6, lean);
    seam.addColorStop(0, rgba(pal.glow, 0));
    seam.addColorStop(.42, rgba(pal.glow, .16 + rand() * .10));
    seam.addColorStop(.58, rgba(pal.hot, .12 + rand() * .08));
    seam.addColorStop(1, rgba(pal.hot, 0));
    ctx.fillStyle = seam;
    ctx.save();
    ctx.translate(x, 0);
    ctx.rotate(.18 + rand() * .12);
    ctx.fillRect(-sw * 2, -H * .2, sw * 4, H * 1.6);
    ctx.restore();
  }
  ctx.restore();
}

// Corner falloff, a warm/cool bloom and film grain — three cheap passes that
// make the layered collage read as one photographed frame.
function finishGrade(ctx, W, H, pal, rand) {
  const vg = ctx.createRadialGradient(
    W / 2, H / 2, Math.min(W, H) * .35,
    W / 2, H / 2, Math.max(W, H) * .78,
  );
  vg.addColorStop(0, "rgba(0,0,0,0)");
  vg.addColorStop(1, rgba(pal.deep, .38));
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, W, H);

  const bloom = ctx.createLinearGradient(0, 0, 0, H);
  bloom.addColorStop(0, rgba(pal.neon, .10));
  bloom.addColorStop(.6, "rgba(0,0,0,0)");
  bloom.addColorStop(1, rgba(pal.glow, .12));
  ctx.fillStyle = bloom;
  ctx.fillRect(0, 0, W, H);

  const specks = Math.floor(W * H / 5200);
  for (let i = 0; i < specks; i++) {
    const a = rand() * .06;
    ctx.fillStyle = rand() > .5 ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`;
    ctx.fillRect(rand() * W, rand() * H, 2, 2);
  }
}

// Softer, rounder vignette than the base grade's corner falloff, tinted with
// the palette's deep colour. Source-over only — some canvas backends silently
// drop multiply. Off unless a template opts in or state.vignette asks for it.
function vignetteOverlay(ctx, W, H, pal, strength = .22) {
  const s = Math.min(1, Math.max(0, strength));
  if (s <= 0) return;
  const vg = ctx.createRadialGradient(
    W / 2, H / 2, Math.min(W, H) * .42,
    W / 2, H / 2, Math.hypot(W, H) * .58,
  );
  vg.addColorStop(0, rgba(pal.deep, 0));
  vg.addColorStop(.62, rgba(pal.deep, s * .45));
  vg.addColorStop(1, rgba(pal.deep, s));
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, W, H);
}

// Placeholder fills for photo-less panels, derived from the palette so empty
// panels always sit inside the poster's grade instead of fighting it.
function panelFills(pal) {
  return [
    [blend(pal.top, pal.mid, .5), pal.hot],
    [blend(pal.top, "#001a26", .5), pal.neon],
    [blend(pal.deep, "#000000", .4), pal.glow],
    [blend(pal.top, "#0e321e", .5), pal.hot],
    [blend(pal.top, pal.deep, .5), pal.neon],
    [blend(pal.deep, "#3d1200", .5), pal.glow],
  ];
}

// ---------------------------------------------------------------- render

// state: { title, subtitle, tagline, quote, stars, palette, seed, size,
//          template, photos: [{ img, zoom, ox, oy, label, time }] }
export async function renderCover(canvas, state) {
  const [W, H] = SIZES[state.size] || SIZES["1920 x 1080"];
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  const pal = palette(state.palette);
  const rand = seedRandom(state.seed || 42);

  // Backdrop.
  paintSky(ctx, W, H, pal, rand);
  cloudBand(ctx, W, H, pal, rand, H * .30, 7, .35);
  cloudBand(ctx, W, H, pal, rand, H * .16, 4, .22);
  skylineBand(ctx, W, H, pal, rand, H * .78, H * .22, blend(pal.top, "#000000", .2), .8);

  // Templates.
  const tpl = TEMPLATES[state.template] || TEMPLATES.hero;
  const fills = panelFills(pal);

  const rects = tpl.panels.map((p) => {
    const w = p.w * W;
    const h = p.h * H;
    return { w, h, cx: p.x * W + w / 2, cy: p.y * H + h / 2, tilt: p.tilt, star: !!p.star };
  });

  rects.forEach((r) => panelShadow(ctx, r, pal));

  // Accent plan: the two smallest non-star panels get a palm sticker chip, and
  // if the layout is big enough one more gets a torn edge. Seeded, so a poster
  // is stable but two different seeds rarely match.
  const accents = new Map();
  {
    const eligible = rects.map((r, i) => ({ r, i })).filter((x) => !x.r.star);
    const smallest = [...eligible]
      .sort((a, b) => a.r.w * a.r.h - b.r.w * b.r.h)
      .slice(0, 2);
    smallest.forEach((x) => accents.set(x.i, "chip"));
    if (eligible.length > 3) {
      const rest = eligible.filter((x) => !accents.has(x.i));
      const pick = rest.splice(Math.floor(rand() * rest.length), 1)[0];
      if (pick) accents.set(pick.i, "torn");
    }
  }

  rects.forEach((r, i) => {
    const photo = (state.photos && state.photos[i]) || {};
    drawPanelPhoto(ctx, photo.img || null, r, photo, fills[i % fills.length], pal);

    // Frame: dark outline plus an inner white hairline.
    ctx.save();
    ctx.translate(r.cx, r.cy);
    ctx.rotate(r.tilt * Math.PI / 180);
    roundRect(ctx, -r.w / 2, -r.h / 2, r.w, r.h, r.w * .018);
    ctx.lineWidth = r.w * .028;
    ctx.strokeStyle = rgba(pal.deep, .95);
    ctx.stroke();
    roundRect(ctx, -r.w / 2 + r.w * .016, -r.h / 2 + r.w * .016,
      r.w - r.w * .032, r.h - r.w * .032, r.w * .012);
    ctx.lineWidth = r.w * .006;
    ctx.strokeStyle = "rgba(255,255,255,.55)";
    ctx.stroke();
    ctx.restore();

    const accent = accents.get(i);
    if (accent === "chip") drawChip(ctx, r, pal);
    else if (accent) drawEdgeAccent(ctx, r, pal, rand, accent);

    // Location label chip, top left.
    if (photo.label) {
      ctx.save();
      ctx.translate(r.cx, r.cy);
      ctx.rotate(r.tilt * Math.PI / 180);
      const fs = r.h * .075;
      const label = photo.label.toUpperCase();
      ctx.font = `${WEIGHT.LABEL} ${fs}px ${FONT_BODY}`;
      const bw = ctx.measureText(label).width + fs * 1.1;
      const bx = -r.w / 2 + r.w * .02;
      const by = -r.h / 2 + r.h * .025;

      ctx.fillStyle = rgba(pal.deep, .88);
      ctx.fillRect(bx, by, bw, fs * 1.7);
      ctx.fillStyle = pal.glow;
      ctx.fillRect(bx, by, fs * .12, fs * 1.7);

      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#ffffff";
      ctx.fillText(label, bx + fs * .5, by + fs * .6);
      if (photo.time) {
        ctx.fillStyle = rgba(pal.glow, .9);
        ctx.font = `${WEIGHT.BODY} ${fs * .72}px ${FONT_BODY}`;
        ctx.fillText(photo.time.toUpperCase(), bx + fs * .5, by + fs * 1.25);
      }
      ctx.restore();
    }

    // Wanted stars: a vertical column in the star panel's top right corner.
    if (r.star && state.stars > 0) {
      ctx.save();
      ctx.translate(r.cx, r.cy);
      ctx.rotate(r.tilt * Math.PI / 180);
      const fs = r.h * .052;
      const bw = fs * 1.5;
      const bh = state.stars * fs * 1.25 + fs;
      const bx = r.w / 2 - bw - r.w * .035;
      const by = -r.h / 2 + r.h * .035;

      roundRect(ctx, bx, by, bw, bh, fs * .4);
      ctx.fillStyle = rgba(pal.deep, .85);
      ctx.fill();
      ctx.strokeStyle = rgba(pal.glow, .8);
      ctx.lineWidth = fs * .08;
      ctx.stroke();

      for (let s = 0; s < state.stars; s++) {
        drawStars(ctx, bx + fs * .12, by + fs * .55 + s * fs * 1.25, 1, 1, fs, pal.glow, "#ffffff");
      }
      ctx.restore();
    }
  });

  // --- lettering block ---
  const tall = state.template === "grid5";
  const titleSize = H * (tall ? .105 : .155);
  const titleY = H * (tall ? .80 : .72);
  const titleCx = W * (tall ? .5 : .30);
  const titleMax = W * (tall ? .92 : .60);

  // Critic strip above the title on the wide layouts.
  if (!tall) {
    const qs = H * .022;
    const stripY = titleY - titleSize * 1.12;
    const starSize = qs * 1.3;
    const quote = (state.quote || "A fever dream in neon").toUpperCase();
    const line = `— THE COAST HERALD  ·  ${quote}`;

    ctx.save();
    ctx.font = `600 ${qs}px ${FONT_BODY}`;
    const lineW = ctx.measureText(line).width;
    const starsW = state.stars * starSize * 1.25;
    const sx0 = titleCx - (starsW + lineW + qs) / 2;

    drawStars(ctx, sx0, stripY, state.stars, state.stars, starSize, pal.glow, "rgba(255,255,255,.35)");

    ctx.font = `600 ${qs}px ${FONT_BODY}`;
    ctx.fillStyle = "rgba(255,255,255,.92)";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(line, sx0 + starsW + qs * .6, stripY);
    ctx.restore();
  } else {
    // Mosaic: a translucent band so the type never fights the photos.
    const bandH = titleSize * 1.75;
    const bg = ctx.createLinearGradient(0, titleY - titleSize * 1.3, 0, titleY + titleSize * .5);
    bg.addColorStop(0, rgba(pal.deep, 0));
    bg.addColorStop(.5, rgba(pal.deep, .82));
    bg.addColorStop(1, rgba(pal.deep, 0));
    ctx.fillStyle = bg;
    ctx.fillRect(0, titleY - titleSize * 1.3, W, bandH);
  }

  drawTitle(ctx, (state.title || "VICE STATE").toUpperCase(),
    titleCx, titleY, titleSize, pal, Math.round(titleSize * .045), titleMax);

  if (state.subtitle) {
    drawSubtitle(ctx, state.subtitle, titleCx + titleSize * .3,
      titleY + titleSize * .36, titleSize * .34, pal, titleSize * .05);
  }

  // --- seal + banner ---
  const seal = {
    sx: W * (tall ? .155 : .865),
    sy: H * (tall ? .90 : .862),
    sealR: H * .075,
  };
  drawSeal(ctx, seal, pal);
  const band = drawBanner(ctx, W, H, pal);

  // Tagline, shrunk until it fits between the seal and the sun icon.
  const tagline = (state.tagline || "ONE COAST · NO RULES · COMING SOON").toUpperCase();
  const tagMaxW = (tall ? W * .9 : W * .62) - band.bh * 1.4;
  let tagFs = band.bh * .3;
  ctx.font = `600 ${tagFs}px ${FONT_BODY}`;
  while (tagFs > 8 && ctx.measureText(tagline).width > tagMaxW) {
    tagFs *= 0.94;
    ctx.font = `600 ${tagFs}px ${FONT_BODY}`;
  }

  const tagX = tall ? W / 2 : W * .68;
  const tagW = ctx.measureText(tagline).width;
  const sunX = tagX - tagW / 2 - band.bh * .5;
  const sunY = band.y0 + band.bh * .5;

  ctx.save();
  ctx.fillStyle = pal.glow;
  ctx.beginPath();
  ctx.arc(sunX, sunY, band.bh * .16, Math.PI, 0);
  ctx.fill();
  ctx.fillStyle = pal.deep;
  for (let i = 0; i < 3; i++) {
    ctx.fillRect(sunX - band.bh * .18, sunY - band.bh * .045 * i, band.bh * .36, band.bh * .02 * (i + 1));
  }
  ctx.restore();

  ctx.fillStyle = "#ffe9f7";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(tagline, tagX, band.y0 + band.bh * .58);

  // Small print along the very bottom edge.
  ctx.fillStyle = "rgba(255,255,255,.55)";
  ctx.font = `400 ${H * .011}px ${FONT_BODY}`;
  ctx.textAlign = "left";
  ctx.fillText(
    `${(state.title || "VICE STATE").toUpperCase()} · MADE WITH YOUR OWN PHOTOS · GRADED IN YOUR BROWSER`,
    W * .02, H - H * .008,
  );

  // Outer border, drawn before the finishing passes so it sits under the grade.
  const border = H * .012;
  ctx.strokeStyle = rgba(pal.deep, .95);
  ctx.lineWidth = border;
  ctx.strokeRect(border / 2, border / 2, W - border, H - border);

  // --- unify ---
  halationPass(ctx, W, H, pal, rand);
  finishGrade(ctx, W, H, pal, rand);

  let vig = tpl.vignette ? .22 : 0;
  if (state.vignette === false) vig = 0;
  else if (typeof state.vignette === "number") vig = state.vignette;
  else if (state.vignette === true) vig = .22;
  if (vig > 0) vignetteOverlay(ctx, W, H, pal, vig);
}

export function exportPNG(canvas) {
  return canvas.toDataURL("image/png");
}
