// Vice State editor wiring.
//
// Owns one plain `state` object and hands it to the renderer in cover.js.
// Every control mutates state and calls schedule(), which re-renders on the
// next animation frame and autosaves. Photo bitmaps live in memory only —
// localStorage keeps captions, look and crops, and panels fall back to their
// procedural sky art after a reload until a photo is re-picked.

import { renderCover, exportPNG, TEMPLATES, PALETTE_NAMES } from "./cover.js";

const STORE_KEY = "vice-state-poster-v4";

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
  photos: [], // per panel: {img|null, src, zoom, ox, oy, label, time, seed}
};

const canvas = document.getElementById("preview");
const fileInput = document.getElementById("file-input");
const toastEl = document.getElementById("toast");
const panelStrip = document.getElementById("panel-strip");

let activePanel = 0;
let toastTimer = null;

// ---------- persistence ----------

function saveState() {
  try {
    const plain = {
      ...state,
      photos: state.photos.map((ph) => ({
        zoom: ph.zoom, ox: ph.ox, oy: ph.oy,
        label: ph.label || "", time: ph.time || "", src: null,
      })),
    };
    localStorage.setItem(STORE_KEY, JSON.stringify(plain));
  } catch { /* private mode / quota — persistence is best-effort */ }
}

function restoreState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORE_KEY) || "null");
    if (!saved || typeof saved !== "object") return false;
    for (const key of ["title", "subtitle", "tagline", "quote", "palette", "template", "size"]) {
      if (typeof saved[key] === "string") state[key] = saved[key];
    }
    if (Number.isFinite(saved.stars)) state.stars = Math.min(5, Math.max(0, saved.stars));
    if (Number.isFinite(saved.seed)) state.seed = saved.seed >>> 0;
    if (Array.isArray(saved.photos)) {
      state.photos = saved.photos.map((ph, i) => ({
        img: null, src: null, seed: i + 3,
        zoom: Number.isFinite(ph.zoom) ? ph.zoom : 1,
        ox: Number.isFinite(ph.ox) ? ph.ox : 0,
        oy: Number.isFinite(ph.oy) ? ph.oy : 0,
        label: ph.label || "", time: ph.time || "",
      }));
    }
    return true;
  } catch { return false; }
}

function reflectStateToControls() {
  for (const id of ["title", "subtitle", "tagline", "quote", "stars", "palette", "template", "size"]) {
    const el = document.getElementById(id);
    if (el) el.value = state[id];
  }
}

// ---------- helpers ----------

function ensurePhotos(n) {
  while (state.photos.length < n) {
    state.photos.push({
      img: null, src: null, zoom: 1, ox: 0, oy: 0,
      label: "", time: "", seed: state.photos.length + 3,
    });
  }
}

function panelCount() {
  return TEMPLATES[state.template].panels.length;
}

function showToast(msg) {
  if (!toastEl) return;
  toastEl.textContent = msg;
  toastEl.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove("show"), 2200);
}

function schedule() {
  requestAnimationFrame(() => renderCover(canvas, state).then(saveState));
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

// ---------- panel strip ----------

function buildPanelStrip() {
  ensurePhotos(panelCount());
  panelStrip.innerHTML = "";
  state.photos.slice(0, panelCount()).forEach((ph, i) => {
    const card = document.createElement("div");
    card.className = "panel-card" + (i === activePanel ? " active" : "");

    const thumb = document.createElement("div");
    thumb.className = "panel-thumb";
    if (ph.src) thumb.style.backgroundImage = `url(${ph.src})`;
    else thumb.textContent = "sky art";
    thumb.addEventListener("click", (e) => { e.stopPropagation(); pickFile(i); });

    const meta = document.createElement("div");
    meta.className = "panel-meta";
    const labelIn = document.createElement("input");
    labelIn.className = "label-in";
    labelIn.placeholder = "Panel label";
    labelIn.value = ph.label || "";
    labelIn.addEventListener("input", (e) => { ph.label = e.target.value; schedule(); });
    const timeIn = document.createElement("input");
    timeIn.className = "time-in";
    timeIn.placeholder = "Time note";
    timeIn.value = ph.time || "";
    timeIn.addEventListener("input", (e) => { ph.time = e.target.value; schedule(); });
    meta.append(labelIn, timeIn);

    const zoomRow = document.createElement("div");
    zoomRow.className = "panel-zoom";
    const zoomLabel = document.createElement("span");
    zoomLabel.textContent = "Zoom";
    const zoomIn = document.createElement("input");
    zoomIn.type = "range";
    zoomIn.min = "1"; zoomIn.max = "3"; zoomIn.step = "0.01";
    zoomIn.value = String(ph.zoom);
    zoomIn.addEventListener("input", (e) => { ph.zoom = parseFloat(e.target.value); schedule(); });
    const resetBtn = document.createElement("button");
    resetBtn.className = "btn mini reset-btn";
    resetBtn.type = "button";
    resetBtn.textContent = "⟲ Reset";
    resetBtn.addEventListener("click", (e) => { e.stopPropagation(); resetPanelCrop(i); });
    zoomRow.append(zoomLabel, zoomIn, resetBtn);

    card.addEventListener("click", () => { activePanel = i; buildPanelStrip(); });
    card.append(thumb, meta, zoomRow);
    panelStrip.appendChild(card);
  });
}

function syncZoomSlider(i) {
  const slider = panelStrip.querySelectorAll(".panel-zoom input[type=range]")[i];
  if (slider) slider.value = String(state.photos[i]?.zoom ?? 1);
}

// Reset a panel's crop — double-click on the canvas or the ⟲ button.
function resetPanelCrop(i) {
  const ph = state.photos[i];
  if (!ph) return;
  ph.zoom = 1; ph.ox = 0; ph.oy = 0;
  syncZoomSlider(i);
  schedule();
  showToast(`Panel ${i + 1} crop reset`);
}

// ---------- photo loading ----------

function pickFile(i) {
  activePanel = i;
  buildPanelStrip();
  fileInput.onchange = () => {
    const f = fileInput.files[0];
    if (f) loadPhotoFile(f, i);
    fileInput.value = "";
  };
  fileInput.click();
}

function loadPhotoFile(file, i) {
  const url = URL.createObjectURL(file);
  loadImage(url).then((img) => {
    ensurePhotos(i + 1);
    state.photos[i] = {
      img, src: url, zoom: 1, ox: 0, oy: 0, seed: i + 3,
      label: state.photos[i]?.label || file.name.replace(/\.[^.]+$/, ""),
      time: state.photos[i]?.time || "",
    };
    buildPanelStrip();
    schedule();
    showToast(`Photo loaded into panel ${i + 1}`);
  });
}

async function loadSamples() {
  ensurePhotos(panelCount());
  for (let i = 0; i < panelCount(); i++) {
    if (state.photos[i].img) continue;
    const url = `samples/${i % 2 === 0 ? "boulevard.jpg" : "pier.jpg"}`;
    const img = await loadImage(url);
    state.photos[i] = {
      img, src: url, zoom: 1 + (i % 3) * 0.15, ox: 0, oy: 0, seed: i + 3,
      label: state.photos[i].label || (i === 0 ? "Ocean Drive" : "Vice Pier"),
      time: state.photos[i].time || (i === 0 ? "GOLDEN HOUR" : "BLUE HOUR"),
    };
  }
  buildPanelStrip();
  schedule();
  showToast("Sample photos loaded");
}

// ---------- canvas interaction: drag to pan, wheel to zoom, dblclick resets ----------

let drag = null;

canvas.addEventListener("pointerdown", (e) => {
  const ph = state.photos[activePanel] || {};
  drag = { x: e.clientX, y: e.clientY, ox: ph.ox || 0, oy: ph.oy || 0 };
});

window.addEventListener("pointermove", (e) => {
  if (!drag) return;
  const ph = state.photos[activePanel];
  if (!ph) return;
  const rect = canvas.getBoundingClientRect();
  ph.ox = drag.ox + (e.clientX - drag.x) / rect.width;
  ph.oy = drag.oy + (e.clientY - drag.y) / rect.height;
  schedule();
});

window.addEventListener("pointerup", () => { drag = null; });
canvas.addEventListener("dblclick", () => resetPanelCrop(activePanel));

canvas.addEventListener("wheel", (e) => {
  const ph = state.photos[activePanel];
  if (!ph || !ph.img) return;
  e.preventDefault();
  ph.zoom = Math.min(3, Math.max(1, ph.zoom + (e.deltaY < 0 ? 0.06 : -0.06)));
  syncZoomSlider(activePanel);
  schedule();
}, { passive: false });

// ---------- controls ----------

function bindText(id, key) {
  document.getElementById(id).addEventListener("input", (e) => {
    state[key] = e.target.value;
    schedule();
  });
}
bindText("title", "title");
bindText("subtitle", "subtitle");
bindText("tagline", "tagline");
bindText("quote", "quote");

document.getElementById("stars").addEventListener("input", (e) => {
  state.stars = parseInt(e.target.value, 10);
  schedule();
});
document.getElementById("palette").addEventListener("change", (e) => {
  state.palette = e.target.value;
  schedule();
});
document.getElementById("template").addEventListener("change", (e) => {
  state.template = e.target.value;
  buildPanelStrip();
  schedule();
});
document.getElementById("size").addEventListener("change", (e) => {
  state.size = e.target.value;
  schedule();
});
document.getElementById("reshuffle").addEventListener("click", reshuffleSky);
document.getElementById("load-samples").addEventListener("click", loadSamples);
document.getElementById("add-photo").addEventListener("click", () => pickFile(activePanel));

function reshuffleSky() {
  state.seed = Math.floor(Math.random() * 1e9);
  schedule();
}

// ---------- random poster ----------

const RANDOM_TITLES = ["VICE STATE", "NEON TIDE", "PALM FEVER", "GOLD COAST", "LAST EXIT", "MIDNIGHT RUN", "PINK HORIZON"];
const RANDOM_SUBTITLES = ["Neon Tide", "Static Bloom", "Coral Static", "Afterglow", "Velvet Hours"];

// One code path shared by both Random poster buttons and the N key: shuffle
// palette, template, seed, title and subtitle, never repeating the current
// combination when there is an alternative.
function randomize() {
  const pick = (arr, not) => {
    let v;
    do { v = arr[Math.floor(Math.random() * arr.length)]; }
    while (arr.length > 1 && v === not);
    return v;
  };
  state.palette = pick(PALETTE_NAMES, state.palette);
  state.template = pick(Object.keys(TEMPLATES), state.template);
  state.seed = Math.floor(Math.random() * 1e9);
  state.title = pick(RANDOM_TITLES, state.title);
  state.subtitle = pick(RANDOM_SUBTITLES, state.subtitle);
  ensurePhotos(panelCount());
  reflectStateToControls();
  buildPanelStrip();
  schedule();
  showToast(`Random poster · ${state.palette} · ${TEMPLATES[state.template].name}`);
}

for (const id of ["randomize", "randomize-2"]) {
  document.getElementById(id)?.addEventListener("click", randomize);
}

// ---------- export ----------

function exportPoster() {
  renderCover(canvas, state).then(() => {
    const a = document.createElement("a");
    a.href = exportPNG(canvas);
    a.download = `${(state.title || "cover").toLowerCase().replace(/\s+/g, "-")}-${state.size.replace(/\s+/g, "")}.png`;
    a.click();
    showToast(`Exported PNG · ${state.size}`);
  });
}

document.getElementById("export").addEventListener("click", exportPoster);

// ---------- keyboard ----------

window.addEventListener("keydown", (e) => {
  if (e.target.tagName === "INPUT" || e.target.tagName === "SELECT") return;
  const n = panelCount();
  if (e.key === "[") {
    activePanel = (activePanel + n - 1) % n;
    buildPanelStrip();
  } else if (e.key === "]") {
    activePanel = (activePanel + 1) % n;
    buildPanelStrip();
  } else if (e.key.toLowerCase() === "r") {
    reshuffleSky();
  } else if (e.key.toLowerCase() === "n") {
    randomize();
  } else if (e.key.toLowerCase() === "e") {
    exportPoster();
  }
});

// ---------- boot ----------

if (restoreState()) reflectStateToControls();
buildPanelStrip();
schedule();

// Exposed for screenshots / testing: load a URL into panel i, force a render,
// inspect state.
window.__vs = {
  state,
  canvas,
  async loadURL(i, url) {
    const img = await loadImage(url);
    ensurePhotos(i + 1);
    state.photos[i] = {
      img, src: url, zoom: 1, ox: 0, oy: 0, seed: i + 3,
      label: state.photos[i]?.label || "",
      time: state.photos[i]?.time || "",
    };
    buildPanelStrip();
    await renderCover(canvas, state);
    saveState();
  },
  async render() {
    await renderCover(canvas, state);
    saveState();
  },
  randomize,
  resetPanelCrop,
};
