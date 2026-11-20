// Font stacks for the studio — web-safe system faces only, nothing bundled
// and nothing fetched over the network.

// Display: condensed gothics first (Franklin Gothic Medium ships with
// Windows, Anton is a common install), then the classic impactful fallbacks.
export const FONT_DISPLAY =
  '"Franklin Gothic Medium", Anton, Impact, Haettenschweiler, "Arial Narrow Bold", "Arial Narrow", sans-serif';

// Body: plain neutral sans for labels, captions and small print.
export const FONT_BODY = '"Helvetica Neue", Helvetica, Arial, sans-serif';

// Weight constants shared by canvas font strings and CSS so the poster and
// the UI can never drift apart.
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
