// Vice State cover renderer — draws the multi-panel poster onto a canvas.
// Everything here is original canvas drawing: procedural sky, tilted photo
// panels with drop shadows, colour grading, extruded neon lettering, badges.
// No Rockstar assets, no external images — system font stacks only.
//
// v4: a halation pass sweeps two soft warm radial streaks in from the TOP
// CORNERS (not just the top-left), two of the smallest panels get a tilted
// rounded sticker chip carrying a palm glyph, and the whole grade is a touch
// warmer because the sky's hot stop now gets an extra alpha boost.
// v5: a subtle vignette overlay joins the render pipeline as an option —
// controlled per-template (template.vignette) and per-render (state.vignette)
// — and the Wide template opts in to deepen its edges around the panel grid.

import { FONT_DISPLAY, FONT_BODY, WEIGHT, defaultFontStack } from "./fonts.js";
export { defaultFontStack };

// ---------- colour palettes ----------
const PALETTES = {
  sunset:  { top:"#2b0a3d", mid:"#a02d6f", hot:"#ff8a3d", glow:"#ffd54a", neon:"#ff2fb3", deep:"#3a0e2e", name:"Sunset Boulevard" },
  neon:    { top:"#12002e", mid:"#5b1690", hot:"#e33fff", glow:"#f8d9ff", neon:"#00e5ff", deep:"#0b001f", name:"Neon Nights" },
  vice:    { top:"#24064a", mid:"#b0267e", hot:"#ff6a3d", glow:"#ffd166", neon:"#28f0d8", deep:"#2d0b3c", name:"Vice Cyan" },
  midnight:{ top:"#05010f", mid:"#301b5c", hot:"#7a4bff", glow:"#c7b9ff", neon:"#ff4fd8", deep:"#0a0320", name:"Midnight Purple" },
  dawn:    { top:"#1c1035", mid:"#c9556e", hot:"#ffb56b", glow:"#ffe9b0", neon:"#ff8ad8", deep:"#33102e", name:"Pastel Dawn" },
};

export function palette(name) { return PALETTES[name] || PALETTES.sunset; }
export const PALETTE_NAMES = Object.keys(PALETTES);

// ---------- panel templates (unit rects on a 1x1 canvas) ----------
// The dominant panel is always first (flagged star:true); the others orbit it.
export const TEMPLATES = {
  hero: { name: "Hero", sizes: [1920,1080], panels: [
    { x:.030, y:.055, w:.520, h:.660, tilt:-1.2, star:true },
    { x:.575, y:.055, w:.205, h:.420, tilt:1.0 },
    { x:.795, y:.055, w:.175, h:.420, tilt:-1.0 },
    { x:.575, y:.500, w:.205, h:.360, tilt:-1.0 },
    { x:.795, y:.500, w:.175, h:.360, tilt:1.0 },
  ]},
  grid5: { name: "Mosaic", sizes: [1080,1350], panels: [
    { x:.045, y:.040, w:.430, h:.560, tilt:-1.0, star:true },
    { x:.500, y:.040, w:.455, h:.260, tilt:1.0 },
    { x:.045, y:.625, w:.430, h:.220, tilt:1.0 },
    { x:.500, y:.325, w:.215, h:.275, tilt:-1.5 },
    { x:.740, y:.325, w:.215, h:.275, tilt:1.5 },
    { x:.500, y:.625, w:.455, h:.220, tilt:-1.0 },
  ]},
  widescreen: { name: "Wide", vignette: true, sizes: [1920,1080], panels: [
    { x:.035, y:.070, w:.410, h:.610, tilt:-1.2, star:true },
    { x:.470, y:.070, w:.300, h:.330, tilt:1.0 },
    { x:.790, y:.070, w:.175, h:.330, tilt:-1.0 },
    { x:.470, y:.425, w:.175, h:.235, tilt:-1.5 },
    { x:.665, y:.425, w:.105, h:.235, tilt:0 },
    { x:.790, y:.425, w:.175, h:.235, tilt:1.5 },
  ]},
  collage: { name: "Collage", sizes: [1080,1080], panels: [
    { x:.045, y:.045, w:.430, h:.430, tilt:-1.2, star:true },
    { x:.520, y:.045, w:.435, h:.270, tilt:1.0 },
    { x:.045, y:.510, w:.270, h:.270, tilt:1.5 },
    { x:.350, y:.510, w:.270, h:.270, tilt:-1.5 },
    { x:.655, y:.350, w:.300, h:.200, tilt:1.0 },
    { x:.520, y:.565, w:.435, h:.245, tilt:1.0 },
  ]},
};

export const SIZES = { "1080 x 1080": [1080,1080], "1080 x 1350": [1080,1350], "1920 x 1080": [1920,1080] };

// ---------- helpers ----------
function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x+r, y);
  ctx.arcTo(x+w, y, x+w, y+h, r);
  ctx.arcTo(x+w, y+h, x, y+h, r);
  ctx.arcTo(x, y+h, x, y, r);
  ctx.arcTo(x, y, x+w, y, r);
  ctx.closePath();
}

function hexRGB(h) {
  h = h.replace("#","");
  if (h.length === 3) h = h.split("").map(c => c + c).join("");
  return [parseInt(h.slice(0,2),16), parseInt(h.slice(2,4),16), parseInt(h.slice(4,6),16)];
}
function rgba(h, a) { const [r,g,b] = hexRGB(h); return `rgba(${r},${g},${b},${a})`; }
function mix(a, b, t) {
  const A = hexRGB(a), B = hexRGB(b);
  return `rgb(${Math.round(A[0]+(B[0]-A[0])*t)},${Math.round(A[1]+(B[1]-A[1])*t)},${Math.round(A[2]+(B[2]-A[2])*t)})`;
}

// deterministic PRNG so a seed always draws the same art
function mulberry32(seed) {
  let a = seed >>> 0;
  return function() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- sky (procedural gradient sunset, no photo needed) ----------
function drawSky(ctx, W, H, pal, rand) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, pal.top);
  g.addColorStop(.35, pal.mid);
  g.addColorStop(.62, pal.hot);
  g.addColorStop(.85, pal.glow);
  g.addColorStop(1, pal.deep);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

  // v4 warmer grade: a second hot-stop wash over the horizon band boosts the
  // hot colour's alpha well past what the base gradient gives it, so every
  // palette reads a notch warmer and the panels grade into it more naturally
  const hotWash = ctx.createLinearGradient(0, H * .38, 0, H * .84);
  hotWash.addColorStop(0, rgba(pal.hot, 0));
  hotWash.addColorStop(.45, rgba(pal.hot, .26));
  hotWash.addColorStop(1, rgba(pal.hot, 0));
  ctx.fillStyle = hotWash;
  ctx.fillRect(0, 0, W, H);

  // sun disc with glow
  // v4: the sun is pinned to the skyline band — a low, half-set disc just left
  // of centre, so it looks like the last sliver of daylight sinking behind the
  // buildings instead of a floating disc in mid-air. The seed only jitters it.
  const sunX = W * (0.22 + rand() * 0.10), sunY = H * (0.745 + rand() * 0.015);
  const sunR = W * (.075 + rand() * .015);
  const glow = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, W * .36);
  glow.addColorStop(0, rgba(pal.glow, .95));
  glow.addColorStop(.25, rgba(pal.hot, .55));
  glow.addColorStop(1, rgba(pal.hot, 0));
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = rgba(pal.glow, .9);
  ctx.beginPath(); ctx.arc(sunX, sunY, sunR, 0, Math.PI * 2); ctx.fill();

  // retro sun stripes
  ctx.save();
  ctx.globalCompositeOperation = "destination-out";
  const stripeH = H * .012;
  for (let i = 0; i < 6; i++) {
    const y = sunY - sunR + i * stripeH * 1.9;
    if (i > 0) ctx.fillRect(sunX - sunR * 1.1, y, sunR * 2.2, stripeH * (i * .35 + .6));
  }
  ctx.restore();
}

function cloudBand(ctx, W, H, pal, rand, yBase, count, alpha) {
  ctx.save();
  for (let i = 0; i < count; i++) {
    const cx = rand() * W, cy = yBase + (rand() - .5) * H * .1;
    const cw = W * (.08 + rand() * .18), ch = H * (.012 + rand() * .02);
    ctx.fillStyle = rgba(pal.glow, alpha * (.4 + rand() * .6));
    ctx.beginPath(); ctx.ellipse(cx, cy, cw / 2, ch / 2, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = rgba(pal.neon, alpha * .35 * rand());
    ctx.beginPath(); ctx.ellipse(cx + cw * .18, cy + ch * .5, cw / 2.4, ch / 2.2, 0, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

function palmSilhouette(ctx, x, baseY, h, lean, color) {
  ctx.save();
  ctx.translate(x, baseY);
  ctx.rotate(lean);
  ctx.fillStyle = color;
  // trunk: gentle curve, wider at the base
  ctx.beginPath();
  ctx.moveTo(-h * .06, 0);
  ctx.quadraticCurveTo(h * .05, -h * .5, h * .02, -h * .88);
  ctx.lineTo(h * .07, -h * .88);
  ctx.quadraticCurveTo(h * .11, -h * .5, h * .06, 0);
  ctx.closePath(); ctx.fill();
  // fronds: droopy arcs all around the crown
  const top = { x: h * .045, y: -h * .88 };
  for (let i = 0; i < 8; i++) {
    const ang = -Math.PI * .95 + i * (Math.PI * .9 / 7);
    ctx.save();
    ctx.translate(top.x, top.y);
    ctx.rotate(ang);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(h * .22, -h * .16, h * .46, -h * .06);
    ctx.quadraticCurveTo(h * .24, h * .02, 0, h * .05);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  // crown dot
  ctx.beginPath(); ctx.arc(top.x, top.y, h * .045, 0, Math.PI * 2); ctx.fill();
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
    // window lights
    if (rand() > .4) {
      ctx.fillStyle = rgba(pal.glow, alpha * .5);
      const rows = Math.floor(bh / (H * .02));
      for (let r = 0; r < rows; r++) {
        if (rand() > .5) ctx.fillRect(x + bw * .2, yBase - bh + r * H * .02 + H * .008, bw * .2, H * .006);
        if (rand() > .5) ctx.fillRect(x + bw * .55, yBase - bh + r * H * .02 + H * .008, bw * .2, H * .006);
      }
      ctx.fillStyle = rgba(color, alpha);
    }
    x += bw * (1.05 + rand() * .3);
  }
  ctx.restore();
}

// ---------- photo drawing ----------
function drawPhotoInto(ctx, img, rect, photo, grad, pal) {
  // rect: axis-aligned box in canvas px, drawn rotated by rect.tilt degrees;
  // photo: {zoom, ox, oy} in unit coords of the rect box
  const w = rect.w, h = rect.h;
  ctx.save();
  ctx.translate(rect.cx, rect.cy);
  ctx.rotate(rect.tilt * Math.PI / 180);
  rr(ctx, -w / 2, -h / 2, w, h, w * .018);
  ctx.save();
  ctx.clip();

  if (img) {
    // cover-fit with user zoom/offset
    const s = Math.max(w / img.width, h / img.height) * (photo.zoom || 1);
    const dw = img.width * s, dh = img.height * s;
    const dx = -dw / 2 + (photo.ox || 0) * w;
    const dy = -dh / 2 + (photo.oy || 0) * h;
    ctx.drawImage(img, dx, dy, dw, dh);
    // warm rim light: sun comes from the bottom-left of every panel, like the
    // sky behind them, so the photos sit inside the poster instead of on it
    const rim = ctx.createRadialGradient(-w * .32, h * .42, w * .05, -w * .32, h * .42, w * .95);
    rim.addColorStop(0, rgba(pal.glow, .30));
    rim.addColorStop(.5, rgba(pal.hot, .10));
    rim.addColorStop(1, "rgba(0,0,0,0)");
    ctx.globalCompositeOperation = "soft-light";
    ctx.fillStyle = rim;
    ctx.fillRect(-w / 2, -h / 2, w, h);
    ctx.globalCompositeOperation = "source-over";
  } else {
    // placeholder procedural art
    const g = ctx.createLinearGradient(0, -h / 2, 0, h / 2);
    g.addColorStop(0, grad[0]); g.addColorStop(1, grad[1]);
    ctx.fillStyle = g;
    ctx.fillRect(-w / 2, -h / 2, w, h);
    ctx.fillStyle = "rgba(255,255,255,.14)";
    const rnd = mulberry32(((photo.seed || 7) * 2654435761) >>> 0);
    for (let i = 0; i < 14; i++) {
      const cx = -w/2 + rnd() * w, cy = -h/2 + rnd() * h, cw = w * (.1 + rnd() * .3);
      ctx.beginPath(); ctx.ellipse(cx, cy, cw/2, cw/8, 0, 0, Math.PI*2); ctx.fill();
    }
  }

  // sunset grade: warm bottom-left + magenta top-right
  if (grad && grad.length) {
    const gl = ctx.createLinearGradient(-w / 2, h / 2, w / 2, -h / 2);
    gl.addColorStop(0, rgba(grad[0], .38));
    gl.addColorStop(.55, "rgba(0,0,0,0)");
    gl.addColorStop(1, rgba(grad[1], .30));
    ctx.fillStyle = gl;
    ctx.fillRect(-w / 2, -h / 2, w, h);
    // scanline texture (very subtle)
    ctx.globalAlpha = .05;
    ctx.fillStyle = "#000";
    for (let y = -h / 2; y < h / 2; y += Math.max(3, h * .012)) ctx.fillRect(-w / 2, y, w, Math.max(1, h * .004));
    ctx.globalAlpha = 1;
  }
  ctx.restore();
  ctx.restore();
}

// soft drop shadow behind a tilted panel (pulled out so the shadow lands
// before the photo is drawn, giving the collage real depth)
function panelShadow(ctx, rect, pal) {
  ctx.save();
  ctx.translate(rect.cx, rect.cy);
  ctx.rotate(rect.tilt * Math.PI / 180);
  ctx.shadowColor = rgba(pal.deep, .55);
  ctx.shadowBlur = rect.w * .07;
  ctx.shadowOffsetX = rect.w * .012;
  ctx.shadowOffsetY = rect.w * .016;
  ctx.fillStyle = "#000";
  rr(ctx, -rect.w/2, -rect.h/2, rect.w, rect.h, rect.w * .018);
  ctx.fill();
  ctx.restore();
}

// ---------- lettering ----------
// Shrink the font size until the text fits maxW, so a long caption can never
// overflow the poster or collide with the seal badge.
function fitTitleSize(ctx, text, size, maxW, weight = WEIGHT.TITLE) {
  ctx.font = `${weight ? weight + " " : ""}${Math.round(size)}px ${FONT_DISPLAY}`;
  while (size > 10 && ctx.measureText(text).width > maxW) {
    size *= 0.94;
    ctx.font = `${weight ? weight + " " : ""}${Math.round(size)}px ${FONT_DISPLAY}`;
  }
  return size;
}

// letter-spaced drawing: canvas has no portable letterSpacing, so the
// subtitle is drawn one glyph at a time with a fixed tracking gap
function trackedText(ctx, text, cx, y, tracking) {
  const chars = [...text];
  const widths = chars.map(c => ctx.measureText(c).width);
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

function outlineText(ctx, text, cx, y, size, pal, extrude, maxW) {
  ctx.save();
  size = fitTitleSize(ctx, text, size, maxW);
  ctx.font = `${WEIGHT.TITLE} ${Math.round(size)}px ${FONT_DISPLAY}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  // extruded shadow layers (down-right)
  for (let i = extrude; i >= 1; i--) {
    ctx.fillStyle = mix(pal.deep, "#000000", (i / extrude) * .7);
    ctx.fillText(text, cx + i * (size * .012), y + i * (size * .012));
  }
  // neon rim
  ctx.lineWidth = size * .075;
  ctx.strokeStyle = pal.deep;
  ctx.strokeText(text, cx, y);
  // gradient fill
  const g = ctx.createLinearGradient(0, y - size * .9, 0, y + size * .05);
  g.addColorStop(0, "#fff7d6");
  g.addColorStop(.45, pal.glow);
  g.addColorStop(.8, pal.hot);
  g.addColorStop(1, pal.mid);
  ctx.fillStyle = g;
  ctx.fillText(text, cx, y);
  // specular top edge: a thin bright re-stroke on the upper half makes the
  // lettering read as extruded chrome at poster size
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

function scriptText(ctx, text, cx, y, size, pal, tracking = size * .05) {
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

function drawStars(ctx, x, y, n, total, size, colorOn, colorOff) {
  // vector stars: the OFL fonts carry no ★ glyph, so draw the shape
  const star = (cx, cy, r, color) => {
    ctx.save();
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const rad = i % 2 ? r * .45 : r;
      const a = -Math.PI / 2 + i * Math.PI / 5;
      const px = cx + Math.cos(a) * rad, py = cy + Math.sin(a) * rad;
      i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
    }
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    ctx.restore();
  };
  for (let i = 0; i < total; i++) {
    star(x + size * .6 + i * size * 1.25, y, size * .52, i < n ? colorOn : colorOff);
  }
}

function bannerBand(ctx, W, H, pal, seal) {
  // palm-dotted banner strip at the very bottom (drawn from the right: the
  // lettering block covers its left half on wide layouts)
  const bh = H * .13;
  const y0 = H - bh;
  const g = ctx.createLinearGradient(0, y0, 0, H);
  g.addColorStop(0, pal.deep); g.addColorStop(1, mix(pal.top, "#000", .25));
  ctx.fillStyle = g;
  ctx.fillRect(0, y0, W, bh);
  // top hairline
  ctx.fillStyle = rgba(pal.neon, .6);
  ctx.fillRect(0, y0, W, H * .004);
  // little palms, brighter
  for (let i = 0; i < 11; i++) {
    const x = W * (.055 + i * .088);
    palmSilhouette(ctx, x, H - bh * .34, bh * .78, 0, rgba(mix(pal.neon, "#ffffff", .25), .9));
  }
  // sun icon
  ctx.save();
  const sx = W * .5, sy = y0 + bh * .30;
  ctx.fillStyle = pal.glow;
  ctx.beginPath(); ctx.arc(sx, sy, bh * .16, Math.PI, 0); ctx.fill();
  ctx.fillStyle = pal.deep;
  for (let i = 0; i < 3; i++) ctx.fillRect(sx - bh * .18, sy - bh * .05 * i, bh * .36, bh * .022 * (i + 1));
  ctx.restore();
  // the seal sits over the band's top edge: repaint it last so the palms and
  // hairline never clip its lower half
  if (seal) drawSealBadge(ctx, seal, pal);
  return { y0, bh };
}

// the "ORIGINAL COVER ART" rosette badge — drawn late so nothing covers it
function drawSealBadge(ctx, seal, pal) {
  const { sx, sy, sealR } = seal;
  ctx.save();
  ctx.translate(sx, sy);
  ctx.shadowColor = rgba(pal.deep, .6);
  ctx.shadowBlur = sealR * .4;
  ctx.beginPath();
  const spikes = 16;
  for (let i = 0; i < spikes * 2; i++) {
    const r = (i % 2 ? sealR * .82 : sealR);
    const a = (i / (spikes * 2)) * Math.PI * 2 - Math.PI / 2;
    const px = Math.cos(a) * r, py = Math.sin(a) * r;
    i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = pal.neon; ctx.fill();
  ctx.shadowBlur = 0;
  ctx.lineWidth = sealR * .1; ctx.strokeStyle = pal.deep; ctx.stroke();
  ctx.beginPath(); ctx.arc(0, 0, sealR * .68, 0, Math.PI * 2);
  ctx.fillStyle = mix(pal.deep, "#000", .2); ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.font = `700 ${sealR * .2}px ${FONT_BODY}`;
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText("ORIGINAL", 0, -sealR * .18);
  ctx.font = `400 ${sealR * .15}px ${FONT_BODY}`;
  ctx.fillText("COVER ART", 0, sealR * .08);
  ctx.fillText("EST. 2026", 0, sealR * .32);
  ctx.restore();
}

// film grain + vignette pass over the finished poster so the whole frame
// reads as one graded photograph rather than pasted layers
function finishGrade(ctx, W, H, pal, rand) {
  // vignette
  const vg = ctx.createRadialGradient(W/2, H/2, Math.min(W,H) * .35, W/2, H/2, Math.max(W,H) * .78);
  vg.addColorStop(0, "rgba(0,0,0,0)");
  vg.addColorStop(1, rgba(pal.deep, .38));
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, W, H);
  // warm bloom above the horizon for cohesion
  const bl = ctx.createLinearGradient(0, 0, 0, H);
  bl.addColorStop(0, rgba(pal.neon, .10));
  bl.addColorStop(.6, "rgba(0,0,0,0)");
  bl.addColorStop(1, rgba(pal.glow, .12));
  ctx.fillStyle = bl;
  ctx.fillRect(0, 0, W, H);
  // grain: sprinkle translucent specks, cheap and deterministic
  ctx.save();
  const n = Math.floor(W * H / 5200);
  for (let i = 0; i < n; i++) {
    const a = rand() * .06;
    ctx.fillStyle = rand() > .5 ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`;
    ctx.fillRect(rand() * W, rand() * H, 2, 2);
  }
  ctx.restore();
}

// ---------- v5: vignette overlay option ----------
// A second, gentler vignette layered over the finished poster — rounder and
// softer than the base grade's corner falloff. Drawn with source-over dark
// ramps (no exotic blend modes — some canvas backends silently ignore
// multiply) tinted toward the palette deep colour so the darkening never goes
// muddy grey. Off by default; a
// template opts in via its `vignette` flag and a render can override with
// state.vignette (true/false, or a number for a custom strength).
function vignetteOverlay(ctx, W, H, pal, strength = .22) {
  const s = Math.min(1, Math.max(0, strength));
  if (s <= 0) return;
  ctx.save();
  const vg = ctx.createRadialGradient(
    W / 2, H / 2, Math.min(W, H) * .42,
    W / 2, H / 2, Math.hypot(W, H) * .58,
  );
  vg.addColorStop(0, rgba(pal.deep, 0));
  vg.addColorStop(.62, rgba(pal.deep, s * .45));
  vg.addColorStop(1, rgba(pal.deep, s));
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

// ---------- v4: sticker chip accent ----------
// A small tilted rounded chip with a palm glyph, pinned to the top-right
// corner of two of the smaller panels — a trinket like a travel sticker. The
// chip uses the palette's glow fill with a neon rim; the palm is drawn with
// the same silhouette primitives as the banner band, scaled down and mirrored
// so it reads as a glyph rather than a scene.
function stickerChip(ctx, rect, pal) {
  ctx.save();
  ctx.translate(rect.cx, rect.cy);
  ctx.rotate(rect.tilt * Math.PI / 180);
  const w = rect.w, h = rect.h;
  const cw = Math.min(w, h) * .26;          // chip size
  const ch = cw * .68;
  const px = w / 2 - cw - w * .035;         // top-right corner, inside the frame
  const py = -h / 2 + h * .035;
  ctx.translate(px + cw / 2, py + ch / 2);
  ctx.rotate(-8 * Math.PI / 180);           // deliberately a few degrees off
  ctx.shadowColor = rgba(pal.deep, .55);
  ctx.shadowBlur = cw * .25;
  rr(ctx, -cw / 2, -ch / 2, cw, ch, ch * .28);
  ctx.fillStyle = rgba(pal.glow, .92);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.lineWidth = ch * .09;
  ctx.strokeStyle = rgba(pal.neon, .9);
  ctx.stroke();
  // the palm glyph itself: a tiny trunk arc plus five droopy fronds
  ctx.save();
  ctx.translate(0, ch * .18);
  const ph = ch * .62;
  ctx.scale(-1, 1);                          // mirror so it faces the corner
  palmSilhouette(ctx, 0, 0, ph, 0, rgba(pal.deep, .95));
  ctx.restore();
  ctx.restore();
}

// ---------- v4: torn-paper & sticker panel edge accents ----------
// One or two panels per poster get a hand-cut torn-paper edge on one side
// (jagged polygon, drawn as a pale deckled rim) and a "sticker" variant gets a
// bright tape strip across a corner. Deterministic from the seed, so a poster
// always looks the same but two posters rarely match.
function tornEdgeAccent(ctx, rect, pal, rand, kind) {
  ctx.save();
  ctx.translate(rect.cx, rect.cy);
  ctx.rotate(rect.tilt * Math.PI / 180);
  const w = rect.w, h = rect.h;
  if (kind === "torn") {
    // jagged deckle running down the right edge, like ripped photo paper
    ctx.beginPath();
    ctx.moveTo(w / 2, -h / 2);
    const steps = 14;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const y = -h / 2 + t * h;
      const x = w / 2 + (rand() - .5) * w * .022 + Math.sin(t * 21) * w * .006;
      ctx.lineTo(x, y);
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
    // sticker: neon tape strip diagonally over the top-left corner
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

// ---------- v4: light-leak / halation pass ----------
// Two soft warm radial streaks sweep in from the TOP CORNERS — the way an
// over-exposed film frame bleeds light across the emulsion from both edges —
// plus a couple of hard bright seams down the middle. Subtle at preview size,
// unmistakable at 1920px.
function lightLeakPass(ctx, W, H, pal, rand) {
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  // corner sweeps: one radial halo per top corner, angled inward so the two
  // streaks lean toward each other and meet over the skyline
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
  // diagonal seams threading between the two sweeps
  for (let i = 0; i < 2; i++) {
    const x = W * (.08 + rand() * .5);
    const sw = W * (.03 + rand() * .07);
    const lean = H * (.25 + rand() * .5);
    const st = ctx.createLinearGradient(x - sw, 0, x + sw * 1.6, lean);
    st.addColorStop(0, rgba(pal.glow, 0));
    st.addColorStop(.42, rgba(pal.glow, .16 + rand() * .10));
    st.addColorStop(.58, rgba(pal.hot, .12 + rand() * .08));
    st.addColorStop(1, rgba(pal.hot, 0));
    ctx.fillStyle = st;
    ctx.save();
    ctx.translate(x, 0);
    ctx.rotate(.18 + rand() * .12);
    ctx.fillRect(-sw * 2, -H * .2, sw * 4, H * 1.6);
    ctx.restore();
  }
  ctx.restore();
}

// ---------- main entry ----------
// state: { title, subtitle, tagline, quote, stars, palette, seed, size, template,
//          photos: [{img, zoom, ox, oy, label, time}...] }
export async function renderCover(canvas, state) {
  const [W, H] = SIZES[state.size] || SIZES["1920 x 1080"];
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d");
  const pal = palette(state.palette);
  const rand = mulberry32(state.seed || 42);

  // --- background: sky + clouds + skyline ---
  drawSky(ctx, W, H, pal, rand);
  cloudBand(ctx, W, H, pal, rand, H * .30, 7, .35);
  cloudBand(ctx, W, H, pal, rand, H * .16, 4, .22);
  skylineBand(ctx, W, H, pal, rand, H * .78, H * .22, mix(pal.top, "#000", .2), .8);

  // --- panels ---
  const tpl = TEMPLATES[state.template] || TEMPLATES.hero;
  const panels = tpl.panels;
  const grads = [
    ["#3b0d56", "#ff8a3d"], ["#0e2a3a", "#ff2fb3"], ["#4a0b2e", "#ffd166"],
    ["#10321e", "#ff6a3d"], ["#2b0a3d", "#28f0d8"], ["#3d1200", "#ff9d2e"],
  ];
  // shadows first, then photos, so every panel casts onto the sky and its
  // neighbours instead of being flattened by them
  const rects = panels.map(p => {
    const w = p.w * W, h = p.h * H;
    return { w, h, cx: p.x * W + w / 2, cy: p.y * H + h / 2, tilt: p.tilt, star: p.star };
  });
  rects.forEach(r => panelShadow(ctx, r, pal));
  // v4: plan panel accents — the two SMALLEST non-star panels get the tilted
  // palm-glyph sticker chip; one further panel (if the layout is big enough)
  // gets a torn-paper edge. Never the star panel, so the poster's anchor
  // stays clean, and everything stays seed-deterministic.
  const accentPlan = new Map();
  {
    const eligible = rects.map((r, i) => ({ r, i })).filter(e => !e.r.star);
    const smallest = [...eligible].sort((a, b) => (a.r.w * a.r.h) - (b.r.w * b.r.h)).slice(0, 2);
    smallest.forEach(e => accentPlan.set(e.i, "chip"));
    if (eligible.length > 3) {
      const rest = eligible.filter(e => !accentPlan.has(e.i));
      const pick = rest.splice(Math.floor(rand() * rest.length), 1)[0];
      if (pick) accentPlan.set(pick.i, "torn");
    }
  }
  rects.forEach((r, i) => {
    const photo = (state.photos && state.photos[i]) || {};
    drawPhotoInto(ctx, photo.img || null, r, photo, grads[i % grads.length], pal);
    // frame: thick dark outline + inner white hairline
    ctx.save();
    ctx.translate(r.cx, r.cy); ctx.rotate(r.tilt * Math.PI / 180);
    rr(ctx, -r.w/2, -r.h/2, r.w, r.h, r.w * .018);
    ctx.lineWidth = r.w * .028;
    ctx.strokeStyle = rgba(pal.deep, .95);
    ctx.stroke();
    rr(ctx, -r.w/2 + r.w*.016, -r.h/2 + r.w*.016, r.w - r.w*.032, r.h - r.w*.032, r.w*.012);
    ctx.lineWidth = r.w * .006;
    ctx.strokeStyle = "rgba(255,255,255,.55)";
    ctx.stroke();
    ctx.restore();
    // v4: accents — palm sticker chip on the two smallest panels, torn-paper
    // edge on one more; the hero panel stays clean
    const accent = accentPlan.get(i);
    if (accent === "chip") stickerChip(ctx, r, pal);
    else if (accent) tornEdgeAccent(ctx, r, pal, rand, accent);
    // panel label chip (top-left, out of the title's way)
    if (photo.label) {
      ctx.save();
      ctx.translate(r.cx, r.cy); ctx.rotate(r.tilt * Math.PI / 180);
      const fs = r.h * .075;
      ctx.font = `${WEIGHT.LABEL} ${fs}px ${FONT_BODY}`;
      const tw = ctx.measureText(photo.label.toUpperCase()).width;
      const bw = tw + fs * 1.1, bx = -r.w/2 + r.w*.02, by = -r.h/2 + r.h*.025;
      ctx.fillStyle = rgba(pal.deep, .88);
      ctx.fillRect(bx, by, bw, fs * 1.7);
      ctx.fillStyle = pal.glow;
      ctx.fillRect(bx, by, fs * .12, fs * 1.7);
      ctx.textAlign = "left"; ctx.textBaseline = "middle";
      ctx.fillStyle = "#ffffff";
      ctx.fillText(photo.label.toUpperCase(), bx + fs * .5, by + fs * .6);
      if (photo.time) {
        ctx.fillStyle = rgba(pal.glow, .9);
        ctx.font = `${WEIGHT.BODY} ${fs * .72}px ${FONT_BODY}`;
        ctx.fillText(photo.time.toUpperCase(), bx + fs * .5, by + fs * 1.25);
      }
      ctx.restore();
    }
    // wanted stars on the hero panel (vertical column, top-right like GTA posters)
    if (r.star && state.stars > 0) {
      ctx.save();
      ctx.translate(r.cx, r.cy); ctx.rotate(r.tilt * Math.PI / 180);
      const fs = r.h * .052;
      const bw = fs * 1.5, bh2 = state.stars * fs * 1.25 + fs;
      const bx = r.w/2 - bw - r.w*.035, by = -r.h/2 + r.h*.035;
      rr(ctx, bx, by, bw, bh2, fs * .4);
      ctx.fillStyle = rgba(pal.deep, .85); ctx.fill();
      ctx.strokeStyle = rgba(pal.glow, .8); ctx.lineWidth = fs * .08; ctx.stroke();
      for (let i = 0; i < state.stars; i++) {
        drawStars(ctx, bx + fs * .12, by + fs * .55 + i * fs * 1.25, 1, 1, fs, pal.glow, "#ffffff");
      }
      ctx.restore();
    }
  });

  // --- review strip + lettering block ---
  const isTall = state.template === "grid5";
  const titleSize = H * (isTall ? .105 : .155);
  const titleY = H * (isTall ? .80 : .72);
  const cxTitle = W * (isTall ? .5 : .30);
  const titleMax = W * (isTall ? .92 : .60);
  // review strip: stars + a critic quote, sitting above the title
  if (!isTall) {
    const qs = H * .022;
    const stripY = titleY - titleSize * 1.12;
    const starSize = qs * 1.3;
    const quote = (state.quote || "A fever dream in neon").toUpperCase();
    ctx.save();
    ctx.font = `600 ${qs}px ${FONT_BODY}`;
    const quoteWidth = ctx.measureText(`— THE COAST HERALD  ·  ${quote}`).width;
    const totalW = state.stars * starSize * 1.25 + quoteWidth + qs;
    const sx0 = cxTitle - totalW / 2;
    drawStars(ctx, sx0, stripY, state.stars, state.stars, starSize, pal.glow, "rgba(255,255,255,.35)");
    ctx.font = `600 ${qs}px ${FONT_BODY}`;
    ctx.fillStyle = "rgba(255,255,255,.92)";
    ctx.textAlign = "left"; ctx.textBaseline = "middle";
    ctx.fillText(`— THE COAST HERALD  ·  ${quote}`, sx0 + state.stars * starSize * 1.25 + qs * .6, stripY);
    ctx.restore();
  }
  // title band (mosaic): a translucent strip so the type never fights the photos
  if (isTall) {
    ctx.save();
    const bandH = titleSize * 1.75;
    const bg = ctx.createLinearGradient(0, titleY - titleSize * 1.3, 0, titleY + titleSize * .5);
    bg.addColorStop(0, rgba(pal.deep, 0));
    bg.addColorStop(.5, rgba(pal.deep, .82));
    bg.addColorStop(1, rgba(pal.deep, 0));
    ctx.fillStyle = bg;
    ctx.fillRect(0, titleY - titleSize * 1.3, W, bandH);
    ctx.restore();
  }
  outlineText(ctx, (state.title || "VICE STATE").toUpperCase(), cxTitle, titleY, titleSize, pal, Math.round(titleSize * .045), titleMax);
  if (state.subtitle) {
    scriptText(ctx, state.subtitle, cxTitle + titleSize * .3, titleY + titleSize * .36, titleSize * .34, pal, titleSize * .05);
  }

  // --- original seal badge (our own mark, no game logo) ---
  // drawn above the bottom banner: place it just over the band's top edge so
  // the palm strip never covers it
  const sealR = H * .075;
  const sx = W * (isTall ? .155 : .865), sy = H * (isTall ? .90 : .862);
  const seal = { sx, sy, sealR };
  drawSealBadge(ctx, seal, pal);
  const band = bannerBand(ctx, W, H, pal, seal);
  ctx.fillStyle = "#ffe9f7";
  const tagText = (state.tagline || "ONE COAST · NO RULES · COMING SOON").toUpperCase();
  // clamp the tagline to the banner: shrink the font until the text fits the
  // space between the seal and the sun icon instead of overflowing the band
  const tagMaxW = (isTall ? W * .9 : W * .62) - band.bh * 1.4;
  let tagFs = band.bh * .3;
  ctx.font = `600 ${tagFs}px ${FONT_BODY}`;
  while (tagFs > 8 && ctx.measureText(tagText).width > tagMaxW) {
    tagFs *= 0.94;
    ctx.font = `600 ${tagFs}px ${FONT_BODY}`;
  }
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  const tagX = isTall ? W / 2 : W * .68;
  // sun icon sits left of the tagline
  ctx.save();
  const tw2 = ctx.measureText(tagText).width;
  const sunX = tagX - tw2 / 2 - band.bh * .5, sunY = band.y0 + band.bh * .5;
  ctx.fillStyle = pal.glow;
  ctx.beginPath(); ctx.arc(sunX, sunY, band.bh * .16, Math.PI, 0); ctx.fill();
  ctx.fillStyle = pal.deep;
  for (let i = 0; i < 3; i++) ctx.fillRect(sunX - band.bh * .18, sunY - band.bh * .045 * i, band.bh * .36, band.bh * .02 * (i + 1));
  ctx.restore();
  ctx.fillText(tagText, tagX, band.y0 + band.bh * .58);

  // --- corner text (small print) ---
  ctx.fillStyle = "rgba(255,255,255,.55)";
  ctx.font = `400 ${H * .011}px ${FONT_BODY}`;
  ctx.textAlign = "left";
  ctx.fillText(`${(state.title || "VICE STATE").toUpperCase()} · MADE WITH YOUR OWN PHOTOS · GRADED IN YOUR BROWSER`, W * .02, H - H * .008);

  // --- outer border ---
  ctx.strokeStyle = rgba(pal.deep, .95);
  ctx.lineWidth = H * .012;
  ctx.strokeRect(ctx.lineWidth / 2, ctx.lineWidth / 2, W - ctx.lineWidth, H - ctx.lineWidth);

  // --- unify: light-leak halation, vignette, bloom, grain over everything ---
  lightLeakPass(ctx, W, H, pal, rand);
  finishGrade(ctx, W, H, pal, rand);
  // v5: optional subtle vignette overlay — template opt-in (Wide), with a
  // per-render override: state.vignette === false disables, true enables at
  // the default strength, and a number sets the strength directly.
  {
    let vig = tpl.vignette ? .22 : 0;
    if (state.vignette === false) vig = 0;
    else if (typeof state.vignette === "number") vig = state.vignette;
    else if (state.vignette === true) vig = .22;
    if (vig > 0) vignetteOverlay(ctx, W, H, pal, vig);
  }
}

export function exportPNG(canvas) {
  return canvas.toDataURL("image/png");
}
