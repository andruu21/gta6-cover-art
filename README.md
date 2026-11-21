# Vice State — GTA-style cover art maker

**Vice State** is a cover art studio that runs entirely offline in a desktop browser. Load your
own photos, drop them into a multi-panel poster grid, crop and position each one, write the
caption, and export a poster-grade PNG in five common sizes — 1920 × 1080, 1080 × 1350,
1080 × 1080, 1080 × 1920 and 1200 × 628.

## Run it

```sh
npm test        # same as: node --experimental-strip-types main.ts
```

The harness serves `app/` on a loopback port, renders it with headless Chromium
(Playwright), and writes four preview screenshots plus `dossier.json` into `screenshots/`
(or `$MAKEFUN_OUTPUT_DIR` if set). Exit code 0 means every render landed inside the size
and byte budgets.

No build step, no runtime dependencies, no network requests — plain static files under
`app/`, every pixel drawn on a canvas. Photos never leave your machine. The two sample
photos under `app/samples/` are free to use.

## The studio

The page is a single dark-vice themed screen with three zones:

- the **cover canvas** — the live poster, fully interactive (drag to reposition a photo,
  wheel to zoom, double-click to reset a crop);
- the **look controls** — caption fields (title, italic subtitle, footer tagline, critic
  quote, wanted stars) and the eight-colour grade picker;
- the **panel strip** — one card per photo panel, each with its own file picker, label /
  time / role fields, zoom slider and reset button; the active card glows with the theme
  accent.

Everything renders on one canvas: the sky, the panels, the lettering, the grain. There is no
DOM compositing — `cover.js` paints the whole poster in one pass.

## How it works

| file | role |
| --- | --- |
| `main.ts` | grader harness: static server + headless-Chromium screenshot capture |
| `app/index.html` | the studio page: preview canvas, caption and look controls, panel strip |
| `app/src/main.js` | the editor: photo loading, drag/wheel crop, reset, localStorage persistence, PNG export |
| `app/src/cover.js` | the renderer: procedural sky/skyline/clouds, framed photo panels with sticker chips and torn-paper mats, outlined title lettering, critic review strip, palm-and-sun banner band, wax seal badge, light-leak / grain / vignette finish |
| `app/src/fonts.js` | system font stacks, weight and tracking tokens shared by canvas and CSS |
| `app/style.css` | the studio's dark-vice theme |
| `screenshots/` | four preview renders of the poster in wide, portrait and square sizes plus the editor |

## Features

- **Five poster layouts** — Hero (one wide frame), Double Feature, Triptych, Collage (square)
  and Tower (story-shaped), each panel framed on a torn paper mat with a neon stroke and
  seeded accents.
- **Any photo in any panel** — click a panel thumbnail to load an image, zoom with the slider
  or the mouse wheel, drag on the cover to reposition it, double-click to reset the crop.
  Empty panels fall back to their own slice of seeded sky art, never a blank hole.
- **Caption lettering** — outlined display title (auto-fit so long text never overflows),
  italic subtitle, tracked footer tagline, critic quote and five-star review strip.
- **Eight colour grades** with seeded weather variants (dusk, night drive, high noon); the
  sky behind the panels is drawn procedurally — gradient sunset, striped retro sun, skyline,
  shimmering water — and light-leak, film-grain and vignette passes unify the frame.
- **Panel accents** — sticker chips for each panel's label and time note, tape tabs, cast-role
  tags, all seed-deterministic, so a poster always redraws identically.
- **Everything is local** — the poster autosaves to your browser's localStorage (captions,
  look and crops come back on reload; photo files are not persisted); nothing is ever
  uploaded.
- **Fast export** — one click (or the <kbd>E</kbd> key) writes a PNG at the selected size.

Keyboard: <kbd>[</kbd>/<kbd>]</kbd> step panels · <kbd>N</kbd> random poster · <kbd>R</kbd>
reshuffles the sky · <kbd>E</kbd> exports · double-click a panel resets its crop.

## Originality

Nothing here comes from Rockstar Games: no logo, no wordmark, no official artwork, no game
fonts. All lettering uses system font stacks — nothing bundled, nothing fetched. Licensed
under the MIT license; see `LICENSE`.
