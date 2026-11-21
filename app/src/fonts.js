// Font stacks for the studio — web-safe system faces only, nothing bundled
// and nothing fetched over the network.
//
// The display face leans on wide, heavy grotesques that survive outline+shadow
// lettering at any canvas scale; the body face stays neutral and legible
// inside the UI chrome and the small caption text baked into the poster.

// Display: heaviest first so the title lettering reads as broadcast
// art-deco even on machines without any of the preferred faces.
export const FONT_DISPLAY =
  '"Arial Black", "Franklin Gothic Heavy", Impact, "Segoe UI Black", "Helvetica Neue", sans-serif';

// Body: plain neutral sans for labels, captions and small print.
export const FONT_BODY = '"Helvetica Neue", Helvetica, Arial, sans-serif';

// Weight constants shared by canvas font strings and CSS so the poster and
// the UI can never drift apart.
export const WEIGHT = {
  TITLE: 900,
  SUBTITLE: 400,
  LABEL: 700,
  BODY: 400,
  MICRO: 600,
};

// Letter-spacing presets, expressed as a fraction of font size. cover.js
// multiplies these out when it measures tracked text.
export const TRACKING = {
  display: 0.02,
  label: 0.14,
  micro: 0.22,
};

export function displayFontStack() {
  return FONT_DISPLAY;
}

export function bodyFontStack() {
  return FONT_BODY;
}

export function fontString(sizePx, family = FONT_DISPLAY, weight = WEIGHT.TITLE, italic = false) {
  return `${italic ? "italic " : ""}${weight} ${sizePx}px ${family}`;
}

export function defaultFontStack() {
  return `${FONT_DISPLAY}, ${FONT_BODY}`;
}

// Spaced-letter helper for eyebrow labels, review sources and the seal.
// Joins glyphs with U+2009 thin spaces so canvas measureText() accounts for
// the tracking when centring the string.
export function spaced(text, gap = 0.16) {
  const n = Math.max(0, Math.round(gap * 6));
  return String(text).split("").join("\u2009".repeat(n));
}
