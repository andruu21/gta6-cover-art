// System/web-safe font stacks — no bundled font files, nothing to fetch.
// Display face for the title, plain sans for body text and labels.

export const FONT_DISPLAY = 'Impact, Haettenschweiler, "Arial Narrow Bold", sans-serif';
export const FONT_BODY = 'Helvetica Neue, Arial, sans-serif';

export function displayFontStack() {
  return FONT_DISPLAY;
}

export function bodyFontStack() {
  return FONT_BODY;
}

export function defaultFontStack() {
  return FONT_BODY;
}
