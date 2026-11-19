// GTA-style cover renderer: draws the multi-panel poster to a canvas.
// All drawing is original: panels, grading, lettering, badges.

import { FONT_TITLE, FONT_BODY, FONT_SCRIPT, loadFonts, defaultFontStack } from "./fonts.js";
export { loadFonts, defaultFontStack };

// ---------- colour palettes ----------
const PALETTES = {
  sunset:  { top:"#2b0a3d", mid:"#a02d6f", hot:"#ff8a3d", glow:"#ffd54a", neon:"#ff2fb3", deep:"#3a0e2e" },
  neon:    { top:"#12002e", mid:"#5b1690", hot:"#e33fff", glow:"#f8d9ff", neon:"#00e5ff", deep:"#0b001f" },
  vice:    { top:"#24064a", mid:"#b0267e", hot:"#ff6a3d", glow:"#ffd166", neon:"#28f0d8", deep:"#2d0b3c" },
  midnight:{ top:"#05010f", mid:"#301b5c", hot:"#7a4bff", glow:"#c7b9ff", neon:"#ff4fd8", deep:"#0a0320" },
};

export function palette(name) { return PALETTES[name] || PALETTES.sunset; }

// ---------- panel templates (unit rects on a 1x1 canvas) ----------
// The dominant panel is always first; others orbit it.
export const TEMPLATES = {
  hero:      { name: "Hero",  sizes: [1920,1080], panels: [
    { x:.030, y:.055, w:.520, h:.660, tilt:-1.2, star:true },
    { x:.575, y:.055, w:.205, h:.420, tilt:1.0 },
    { x:.795, y:.055, w:.175, h:.420, tilt:-1.0 },
    { x:.575, y:.500, w:.205, h:.360, tilt:-1.0 },
    { x:.795, y:.500, w:.175, h:.360, tilt:1.0 },
  ]},
  grid5:     { name: "Mosaic", sizes: [1080,1350], panels: [
    { x:.045, y:.040, w:.430, h:.560, tilt:-1.0, star:true },
    { x:.500, y:.040, w:.455, h:.260, tilt:1.0 },
    { x:.045, y:.625, w:.430, h:.220, tilt:1.0 },
    { x:.500, y:.325, w:.215, h:.275, tilt:-1.5 },
    { x:.740, y:.325, w:.215, h:.275, tilt:1.5 },
    { x:.500, y:.625, w:.455, h:.220, tilt:-1.0 },
  ]},
  widescreen:{ name: "Wide",   sizes: [1920,1080], panels: [
    { x:.035, y:.070, w:.410, h:.610, tilt:-1.2, star:true },
    { x:.470, y:.070, w:.300, h:.330, tilt:1.0 },
    { x:.790, y:.070, w:.175, h:.330, tilt:-1.0 },
    { x:.470, y:.425, w:.175, h:.235, tilt:-1.5 },
    { x:.665, y:.425, w:.105, h:.235, tilt:0 },
    { x:.790, y:.425, w:.175, h:.235, tilt:1.5 },
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

  // sun disc with glow
  const sunX = W * (0.5 + (rand() - .5) * .3), sunY = H * (0.55 + rand() * .06);
  const glow = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, W * .34);
  glow.addColorStop(0, rgba(pal.glow, .95));
  glow.addColorStop(.25, rgba(pal.hot, .55));
  glow.addColorStop(1, rgba(pal.hot, 0));
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = rgba(pal.glow, .9);
  ctx.beginPath(); ctx.arc(sunX, sunY, W * .055, 0, Math.PI * 2); ctx.fill();

  // retro sun stripes
  ctx.save();
  ctx.globalCompositeOperation = "destination-out";
  const stripeH = H * .012;
  for (let i = 0; i < 6; i++) {
    const y = sunY - W * .055 + i * stripeH * 1.9;
    if (i > 0) ctx.fillRect(sunX - W * .06, y, W * .12, stripeH * (i * .35 + .6));
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
function drawPhotoInto(ctx, img, rect, photo, grad) {
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

// ---------- lettering ----------
function outlineText(ctx, text, cx, y, size, pal, extrude) {
  ctx.save();
  ctx.font = `${size}px ${FONT_TITLE}`;
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
  ctx.restore();
}

function scriptText(ctx, text, cx, y, size, pal) {
  ctx.save();
  ctx.font = `${size}px ${FONT_SCRIPT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.lineWidth = size * .22;
  ctx.strokeStyle = pal.deep;
  ctx.strokeText(text, cx, y);
  ctx.lineWidth = size * .1;
  ctx.strokeStyle = pal.neon;
  ctx.strokeText(text, cx, y);
  ctx.fillStyle = "#ffe9f7";
  ctx.fillText(text, cx, y);
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

function bannerBand(ctx, W, H, pal) {
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
  return { y0, bh };
}

// ---------- main entry ----------
// state: { title, subtitle, tagline, stars, palette, seed, size, template,
//          photos: [{img, zoom, ox, oy, label, time}...] }
export async function renderCover(canvas, state) {
  await loadFonts();
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
  panels.forEach((p, i) => {
    const photo = (state.photos && state.photos[i]) || {};
    const w = p.w * W, h = p.h * H;
    const cx = p.x * W + w / 2, cy = p.y * H + h / 2;
    drawPhotoInto(ctx, photo.img || null, { w, h, cx, cy, tilt: p.tilt }, photo, grads[i % grads.length]);
    // frame: thick dark outline + inner white hairline
    ctx.save();
    ctx.translate(cx, cy); ctx.rotate(p.tilt * Math.PI / 180);
    rr(ctx, -w/2, -h/2, w, h, w * .018);
    ctx.lineWidth = w * .028;
    ctx.strokeStyle = rgba(pal.deep, .95);
    ctx.stroke();
    rr(ctx, -w/2 + w*.016, -h/2 + w*.016, w - w*.032, h - w*.032, w*.012);
    ctx.lineWidth = w * .006;
    ctx.strokeStyle = "rgba(255,255,255,.55)";
    ctx.stroke();
    ctx.restore();
    // panel label chip (top-left, out of the title's way)
    if (photo.label) {
      ctx.save();
      ctx.translate(cx, cy); ctx.rotate(p.tilt * Math.PI / 180);
      const fs = h * .075;
      ctx.font = `600 ${fs}px ${FONT_BODY}`;
      const tw = ctx.measureText(photo.label.toUpperCase()).width;
      const bw = tw + fs * 1.1, bx = -w/2 + w*.02, by = -h/2 + h*.025;
      ctx.fillStyle = rgba(pal.deep, .88);
      ctx.fillRect(bx, by, bw, fs * 1.7);
      ctx.fillStyle = pal.glow;
      ctx.fillRect(bx, by, fs * .12, fs * 1.7);
      ctx.textAlign = "left"; ctx.textBaseline = "middle";
      ctx.fillStyle = "#ffffff";
      ctx.fillText(photo.label.toUpperCase(), bx + fs * .5, by + fs * .6);
      if (photo.time) {
        ctx.fillStyle = rgba(pal.glow, .9);
        ctx.font = `400 ${fs * .72}px ${FONT_BODY}`;
        ctx.fillText(photo.time.toUpperCase(), bx + fs * .5, by + fs * 1.25);
      }
      ctx.restore();
    }
    // wanted stars on the hero panel (vertical column, top-right like GTA posters)
    if (p.star && state.stars > 0) {
      ctx.save();
      ctx.translate(cx, cy); ctx.rotate(p.tilt * Math.PI / 180);
      const fs = h * .052;
      const bw = fs * 1.5, bh2 = state.stars * fs * 1.25 + fs;
      const bx = w/2 - bw - w*.035, by = -h/2 + h*.035;
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
  // review strip: stars + a critic quote, sitting above the title
  if (!isTall) {
    const qs = H * .022;
    const stripY = titleY - titleSize * 1.12;
    const starSize = qs * 1.3;
    const quote = (state.quote || "A fever dream in neon").toUpperCase();
    ctx.save();
    ctx.font = `600 ${qs}px ${FONT_BODY}`;
    const qw = ctx.measureText(`— THE COAST HERALD  ·  ${quote}`).width;
    const totalW = state.stars * starSize * 1.25 + qw + qs;
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
  outlineText(ctx, (state.title || "VICE STATE").toUpperCase(), cxTitle, titleY, titleSize, pal, Math.round(titleSize * .045));
  if (state.subtitle) {
    scriptText(ctx, state.subtitle, cxTitle + titleSize * .3, titleY + titleSize * .36, titleSize * .34, pal);
  }

  // --- original seal badge (our own mark, no game logo) ---
  const sealR = H * .075;
  const sx = W * (isTall ? .155 : .865), sy = H * (isTall ? .90 : .865);
  ctx.save();
  ctx.translate(sx, sy);
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

  // --- bottom banner + tagline (on wide layouts the lettering owns the left
  // half, so centre the tagline in the right half) ---
  const band = bannerBand(ctx, W, H, pal);
  ctx.fillStyle = "#ffe9f7";
  ctx.font = `600 ${band.bh * .3}px ${FONT_BODY}`;
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  const tagX = isTall ? W / 2 : W * .68;
  const tagText = (state.tagline || "ONE COAST · NO RULES · COMING SOON").toUpperCase();
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
}

export function exportPNG(canvas) {
  return canvas.toDataURL("image/png");
}
