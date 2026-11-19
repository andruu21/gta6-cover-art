// The editor: photo loading per panel, crop/position, caption, sizes, live preview, PNG export.

import { renderCover, exportPNG, SIZES, TEMPLATES } from "./cover.js";

const state = {
  title: "VICE STATE",
  subtitle: "Neon Tide",
  tagline: "One coast · No rules · Coming soon",
  stars: 5,
  palette: "sunset",
  template: "hero",
  size: "1920 x 1080",
  seed: 7,
  photos: [], // {img|null, zoom, ox, oy, label, time, seed}
};

const canvas = document.getElementById("preview");
const fileInput = document.getElementById("file-input");
let activePanel = 0;

function ensurePhotos(n) {
  while (state.photos.length < n) {
    state.photos.push({ img: null, zoom: 1, ox: 0, oy: 0, label: "", time: "", seed: state.photos.length + 3 });
  }
}

function schedule() {
  requestAnimationFrame(() => renderCover(canvas, state));
}

// ---------- panel strip ----------
const panelStrip = document.getElementById("panel-strip");
function buildPanelStrip() {
  ensurePhotos(TEMPLATES[state.template].panels.length);
  panelStrip.innerHTML = "";
  state.photos.slice(0, TEMPLATES[state.template].panels.length).forEach((ph, i) => {
    const card = document.createElement("div");
    card.className = "panel-card" + (i === activePanel ? " active" : "");
    const thumb = document.createElement("div");
    thumb.className = "panel-thumb";
    if (ph.img) thumb.style.backgroundImage = `url(${ph.src})`;
    else thumb.textContent = "sky art";
    const meta = document.createElement("div");
    meta.className = "panel-meta";
    meta.innerHTML = `<input class="label-in" placeholder="Panel label" value="${ph.label || ""}">
      <input class="time-in" placeholder="Time note" value="${ph.time || ""}">`;
    const zoom = document.createElement("div");
    zoom.className = "panel-zoom";
    zoom.innerHTML = `<span>Zoom</span><input type="range" min="1" max="3" step="0.01" value="${ph.zoom}">`;
    card.appendChild(thumb);
    card.appendChild(meta);
    card.appendChild(zoom);
    card.addEventListener("click", () => { activePanel = i; buildPanelStrip(); });
    thumb.addEventListener("click", (e) => { e.stopPropagation(); pickFile(i); });
    card.querySelector(".label-in").addEventListener("input", (e) => { ph.label = e.target.value; schedule(); });
    card.querySelector(".time-in").addEventListener("input", (e) => { ph.time = e.target.value; schedule(); });
    card.querySelector("input[type=range]").addEventListener("input", (e) => { ph.zoom = parseFloat(e.target.value); schedule(); });
    panelStrip.appendChild(card);
  });
}

function pickFile(i) {
  activePanel = i;
  fileInput.onchange = () => {
    const f = fileInput.files[0];
    if (!f) return;
    loadPhotoFile(f, i);
    fileInput.value = "";
  };
  fileInput.click();
}

function loadPhotoFile(f, i) {
  const url = URL.createObjectURL(f);
  const img = new Image();
  img.onload = () => {
    ensurePhotos(i + 1);
    state.photos[i] = { img, src: url, zoom: 1, ox: 0, oy: 0, label: state.photos[i]?.label || f.name.replace(/\.[^.]+$/, ""), time: state.photos[i]?.time || "", seed: i + 3 };
    buildPanelStrip();
    schedule();
  };
  img.src = url;
}

// drag on canvas moves the active panel's photo offset
let dragging = null;
canvas.addEventListener("pointerdown", (e) => {
  dragging = { x: e.clientX, y: e.clientY, ox: state.photos[activePanel]?.ox || 0, oy: state.photos[activePanel]?.oy || 0 };
});
window.addEventListener("pointermove", (e) => {
  if (!dragging) return;
  const ph = state.photos[activePanel];
  if (!ph) return;
  const rect = canvas.getBoundingClientRect();
  ph.ox = dragging.ox + (e.clientX - dragging.x) / rect.width;
  ph.oy = dragging.oy + (e.clientY - dragging.y) / rect.height;
  schedule();
});
window.addEventListener("pointerup", () => { dragging = null; });

// ---------- controls ----------
document.getElementById("title").addEventListener("input", (e) => { state.title = e.target.value; schedule(); });
document.getElementById("subtitle").addEventListener("input", (e) => { state.subtitle = e.target.value; schedule(); });
document.getElementById("tagline").addEventListener("input", (e) => { state.tagline = e.target.value; schedule(); });
document.getElementById("stars").addEventListener("input", (e) => { state.stars = parseInt(e.target.value); schedule(); });
document.getElementById("palette").addEventListener("change", (e) => { state.palette = e.target.value; schedule(); });
document.getElementById("template").addEventListener("change", (e) => { state.template = e.target.value; buildPanelStrip(); schedule(); });
document.getElementById("size").addEventListener("change", (e) => { state.size = e.target.value; schedule(); });
document.getElementById("reshuffle").addEventListener("click", () => { state.seed = Math.floor(Math.random() * 1e9); schedule(); });

document.getElementById("add-photo").addEventListener("click", () => pickFile(activePanel));

document.getElementById("export").addEventListener("click", () => {
  renderCover(canvas, state).then(() => {
    const a = document.createElement("a");
    a.href = exportPNG(canvas);
    a.download = `${(state.title || "cover").toLowerCase().replace(/\s+/g, "-")}-${state.size.replace(/\s+/g, "").replace("x", "x")}.png`;
    a.click();
  });
});

// ---------- boot ----------
buildPanelStrip();
schedule();

// exposed for testing / screenshots: load a URL into panel i
window.__vs = {
  state,
  async loadURL(i, url) {
    const img = await new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = url; });
    ensurePhotos(i + 1);
    state.photos[i] = { img, src: url, zoom: 1, ox: 0, oy: 0, label: state.photos[i]?.label || "", time: state.photos[i]?.time || "", seed: i + 3 };
    buildPanelStrip();
    await renderCover(canvas, state);
  },
};
