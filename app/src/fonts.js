// System/web-safe font stacks — no bundled font files, nothing to fetch.
// Display face for the title, plain sans for body text and labels.

// Display chain: try condensed gothic web-safe faces first (Franklin Gothic
// Medium ships with Windows, Anton is a common system install), then the
// classic narrow/impactful fallbacks, and finally generic sans.
export const FONT_DISPLAY = '"Franklin Gothic Medium", Anton, Impact, Haettenschweiler, "Arial Narrow Bold", "Arial Narrow", sans-serif';
export const FONT_BODY = '"Helvetica Neue", Helvetica, Arial, sans-serif';

// Weight constants — canvas font strings and CSS both pull from here so the
// poster and the UI never drift apart.
export const WEIGHT = {
  TITLE: 700,
  SUBTITLE: 400,
  LABEL: 600,
  BODY: 400,
};

export function displayFontStack() {
  return FONT_DISPLAY;
}

export function bodyFontStack() {
  return FONT_BODY;
}

export function defaultFontStack() {
  return FONT_BODY;
}
