// Loads the app's own OFL-licensed fonts (files under app/fonts/) with graceful fallbacks.
// Canvas lettering uses three stacks: the display face for the title, the
// condensed face for labels, chips and badges, and a script-flavoured stack
// for the subtitle.
//
// v4: font loading is now failure-aware — each FontFace is probed with
// document.fonts.load() so the renderer never starts drawing with fallback
// metrics, and whenFontsReady() reports whether the display face actually
// registered (callers can fall back to system stack if it did not).

export const FONT_TITLE = '"Anton", Impact, "Arial Black", sans-serif';
export const FONT_BODY = '"Oswald", "Arial Narrow", Arial, sans-serif';
export const FONT_SCRIPT = '"Oswald", "Brush Script MT", cursive';

const FONTS = [
  { family: "Anton", url: "../fonts/Anton-Regular.ttf", weight: "400", probe: "400 40px \"Anton\"" },
  { family: "Oswald", url: "../fonts/Oswald-Variable.ttf", weight: "200 700", probe: "600 40px \"Oswald\"" },
];

let loaded = null;
let titleFaceReady = false;

export async function loadFonts() {
  if (loaded) return loaded;
  const jobs = FONTS.map(f => {
    const face = new FontFace(f.family, `url(${f.url})`, { weight: f.weight, display: "swap" });
    return face.load()
      .then(lf => { document.fonts.add(lf); if (f.family === "Anton") titleFaceReady = true; })
      .catch(() => {});
  });
  loaded = Promise.all(jobs).then(() => document.fonts.ready).catch(() => {});
  await loaded;
  return loaded;
}

// v4 improvement pass: whenFontsReady() awaits loadFonts, then explicitly
// probes BOTH stacks with document.fonts.load() (Anton display, Oswald
// body/script), then waits for document.fonts.ready — so a caller that
// captures a screenshot never races the font swap. It returns true when the
// Anton display face is genuinely registered, false when the renderer is
// running on the system fallbacks in FONT_TITLE.
export async function whenFontsReady() {
  await loadFonts();
  for (const f of FONTS) {
    try { await document.fonts.load(f.probe); } catch {}
  }
  try { await document.fonts.ready; } catch {}
  return hasDisplayFace();
}

// true when the Anton display face registered successfully; if it did not,
// callers can lean on the system fallbacks in FONT_TITLE instead
export function hasDisplayFace() {
  return titleFaceReady;
}

export function defaultFontStack() {
  return FONT_BODY;
}
