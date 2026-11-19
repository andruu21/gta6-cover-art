// Loads the app's own OFL-licensed fonts (files under app/fonts/) with graceful fallbacks.

export const FONT_TITLE = '"Anton", Impact, "Arial Black", sans-serif';
export const FONT_BODY = '"Oswald", "Arial Narrow", Arial, sans-serif';
export const FONT_SCRIPT = '"Oswald", cursive';

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

export function defaultFontStack() {
  return `${FONT_BODY}`;
}
