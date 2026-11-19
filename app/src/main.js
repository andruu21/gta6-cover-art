// The editor: photo loading per panel, crop/position, caption, sizes, live
// preview, PNG export. State is a plain object handed straight to the renderer
// in cover.js; every control writes it and re-renders on the next frame.

import { renderCover, exportPNG, SIZES, TEMPLATES, PALETTE_NAMES } from "./cover.js";

const state = {
  title: "VICE STATE",
  subtitle: "Neon Tide",
  tagline: "One coast · No rules · Coming soon",
  quote: "A fever dream in neon",
  stars: 5,
  palette: "sunset",
  template: "hero",
  size: "1920 x 1080",
  seed: 7,
  photos: [], // {img|null, src, zoom, ox, oy, label, time, seed}
};

const canvas = document.getElementById("preview");
const fileInput = document.getElementById("file-input");
const toast = document.getElementById("toast");
let activePanel = 0;
let toastTimer = null;

function ensurePhotos(n) {
  while (state.photos.length < n) {
    state.photos.push({ img: null, src: null, zoom: 1, ox: 0, oy: 0, label: "", time: "", seed: state.photos.length + 3 });
  }
}

function showToast(msg) {
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2200);
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
    if (ph.src) thumb.style.backgroundImage = `url(${ph.src})`;
    else thumb.textContent = "sky art";
    const meta = document.createElement("div");
    meta.className = "panel-meta";
    const labelIn = document.createElement("input");
    labelIn.className = "label-in";
    labelIn.placeholder = "Panel label";
    labelIn.value = ph.label || "";
    const timeIn = document.createElement("input");
    timeIn.className = "time-in";
    timeIn.placeholder = "Time note";
    timeIn.value = ph.time || "";
    meta.appendChild(labelIn);
    meta.appendChild(timeIn);
    const zoom = document.createElement("div");
    zoom.className = "panel-zoom";
    const zoomLabel = document.createElement("span");
    zoomLabel.textContent = "Zoom";
    const zoomIn = document.createElement("input");
    zoomIn.type = "range";
    zoomIn.min = "1"; zoomIn.max = "3"; zoomIn.step = "0.01";
    zoomIn.value = String(ph.zoom);
    zoom.appendChild(zoomLabel);
    zoom.appendChild(zoomIn);
    card.appendChild(thumb);
    card.appendChild(meta);
    card.appendChild(zoom);
    card.addEventListener("click", () => { activePanel = i; buildPanelStrip(); });
    thumb.addEventListener("click", (e) => { e.stopPropagation(); pickFile(i); });
    labelIn.addEventListener("input", (e) => { ph.label = e.target.value; schedule(); });
    timeIn.addEventListener("input", (e) => { ph.time = e.target.value; schedule(); });
    zoomIn.addEventListener("input", (e) => { ph.zoom = parseFloat(e.target.value); schedule(); });
    panelStrip.appendChild(card);
  });
}

function pickFile(i) {
  activePanel = i;
  buildPanelStrip();
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
    state.photos[i] = { img, src: url, zoom: 1, ox: 0, oy: 0,
      label: state.photos[i]?.label || f.name.replace(/\.[^.]+$/, ""),
      time: state.photos[i]?.time || "", seed: i + 3 };
    buildPanelStrip();
    schedule();
    showToast(`Photo loaded into panel ${i + 1}`);
  };
  img.src = url;
}

// drag on canvas moves the active panel's photo offset; the wheel zooms it
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
canvas.addEventListener("wheel", (e) => {
  const ph = state.photos[activePanel];
  if (!ph || !ph.img) return;
  e.preventDefault();
  ph.zoom = Math.min(3, Math.max(1, ph.zoom + (e.deltaY < 0 ? .06 : -.06)));
  const strip = panelStrip.querySelectorAll(".panel-zoom input[type=range]")[activePanel];
  if (strip) strip.value = String(ph.zoom);
  schedule();
}, { passive: false });

// ---------- controls ----------
document.getElementById("title").addEventListener("input", (e) => { state.title = e.target.value; schedule(); });
document.getElementById("subtitle").addEventListener("input", (e) => { state.subtitle = e.target.value; schedule(); });
document.getElementById("tagline").addEventListener("input", (e) => { state.tagline = e.target.value; schedule(); });
document.getElementById("quote").addEventListener("input", (e) => { state.quote = e.target.value; schedule(); });
document.getElementById("stars").addEventListener("input", (e) => { state.stars = parseInt(e.target.value); schedule(); });
document.getElementById("palette").addEventListener("change", (e) => { state.palette = e.target.value; schedule(); });
document.getElementById("template").addEventListener("change", (e) => { state.template = e.target.value; buildPanelStrip(); schedule(); });
document.getElementById("size").addEventListener("change", (e) => { state.size = e.target.value; schedule(); });
document.getElementById("reshuffle").addEventListener("click", () => { state.seed = Math.floor(Math.random() * 1e9); schedule(); });

document.getElementById("add-photo").addEventListener("click", () => pickFile(activePanel));

// one click fills every empty panel with the bundled sample photos, so a new
// visitor sees a finished poster before uploading anything of their own
document.getElementById("load-samples").addEventListener("click", async () => {
  const n = TEMPLATES[state.template].panels.length;
  ensurePhotos(n);
  for (let i = 0; i < n; i++) {
    if (state.photos[i].img) continue;
    const url = `samples/${i % 2 === 0 ? "boulevard.jpg" : "pier.jpg"}`;
    const img = await new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = url; });
    state.photos[i] = { img, src: url, zoom: 1 + (i % 3) * .15, ox: 0, oy: 0,
      label: state.photos[i].label || (i === 0 ? "Ocean Drive" : "Vice Pier"),
      time: state.photos[i].time || (i === 0 ? "GOLDEN HOUR" : "BLUE HOUR"), seed: i + 3 };
  }
  buildPanelStrip();
  schedule();
  showToast("Sample photos loaded");
});

document.getElementById("export").addEventListener("click", () => {
  renderCover(canvas, state).then(() => {
    const a = document.createElement("a");
    a.href = exportPNG(canvas);
    a.download = `${(state.title || "cover").toLowerCase().replace(/\s+/g, "-")}-${state.size.replace(/\s+/g, "").replace("x", "x")}.png`;
    a.click();
    showToast(`Exported PNG · ${state.size}`);
  });
});

// keyboard: [ and ] step panels, R reshuffles the sky, E exports
window.addEventListener("keydown", (e) => {
  if (e.target.tagName === "INPUT" || e.target.tagName === "SELECT") return;
  const n = TEMPLATES[state.template].panels.length;
  if (e.key === "[") { activePanel = (activePanel + n - 1) % n; buildPanelStrip(); }
  else if (e.key === "]") { activePanel = (activePanel + 1) % n; buildPanelStrip(); }
  else if (e.key.toLowerCase() === "r") { state.seed = Math.floor(Math.random() * 1e9); schedule(); }
  else if (e.key.toLowerCase() === "e") { document.getElementById("export").click(); }
});

// ---------- boot ----------
buildPanelStrip();
schedule();

// exposed for testing / screenshots: load a URL into panel i and inspect state
window.__vs = {
  state,
  canvas,
  async loadURL(i, url) {
    const img = await new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = url; });
    ensurePhotos(i + 1);
    state.photos[i] = { img, src: url, zoom: 1, ox: 0, oy: 0, label: state.photos[i]?.label || "", time: state.photos[i]?.time || "", seed: i + 3 };
    buildPanelStrip();
    await renderCover(canvas, state);
  },
  async render() { await renderCover(canvas, state); },
};
