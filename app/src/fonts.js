// Loads the app's own OFL-licensed fonts (files under app/fonts/) with graceful fallbacks.
// Canvas lettering uses three stacks: the display face for the title, the
// condensed face for labels, chips and badges, and a script-flavoured stack
// for the subtitle.

export const FONT_TITLE = '"Anton", Impact, "Arial Black", sans-serif';
export const FONT_BODY = '"Oswald", "Arial Narrow", Arial, sans-serif';
export const FONT_SCRIPT = '"Oswald", "Brush Script MT", cursive';

const FONTS = [
  { family: "Anton", url: "../fonts/Anton-Regular.ttf", weight: "400" },
  { family: "Oswald", url: "../fonts/Oswald-Variable.ttf", weight: "200 700" },
];

let loaded = null;

export async function loadFonts() {
  if (loaded) return loaded;
  const jobs = FONTS.map(f => {
    const face = new FontFace(f.family, `url(${f.url})`, { weight: f.weight, display: "swap" });
    return face.load().then(lf => document.fonts.add(lf)).catch(() => {});
  });
  loaded = Promise.all(jobs).then(() => document.fonts.ready).catch(() => {});
  await loaded;
  return loaded;
}

// wait until the given family is actually registered (used by the screenshot
// harness so a capture never races the font swap)
export async function whenFontsReady() {
  await loadFonts();
  try { await document.fonts.load(`400 40px ${FONT_TITLE}`); } catch {}
  try { await document.fonts.load(`600 40px ${FONT_BODY}`); } catch {}
}

export function defaultFontStack() {
  return FONT_BODY;
}
