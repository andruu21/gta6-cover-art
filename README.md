# Vice State — GTA-style cover art maker

[![make.fun · gta6-cover-art-01](https://make.fun/badge/gta6-cover-art-01.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![rank](https://make.fun/badge/gta6-cover-art-01/andruu21/gta6-cover-art/rank.svg)](https://make.fun/bounty/gta6-cover-art-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![reward](https://make.fun/badge/gta6-cover-art-01/andruu21/gta6-cover-art/reward.svg)](https://make.fun/bounty/gta6-cover-art-01/andruu21/gta6-cover-art?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)

**Vice State** is a cover art studio that runs entirely offline in a desktop browser. Load your
own photos, drop them into a multi-panel poster grid, crop and position each one, write the
caption, and export a poster-grade PNG in the three common post sizes — 1080 × 1080,
1080 × 1350 and 1920 × 1080.

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080 in desktop Chrome. No build step, no dependencies, no network
requests — plain static files under `app/`, every pixel drawn on a canvas. Photos never leave
your machine. The two sample photos under `app/samples/` were made with an image model for
make.fun and are free to use.

To build the release dossier (the app plus preview screenshots plus `dossier.json`) run:

```sh
node --experimental-strip-types main.ts          # writes to /output inside the grader
MAKEFUN_OUTPUT_DIR=./out node --experimental-strip-types main.ts   # anywhere else
```

## The studio

The page is a single dark-vice themed screen with three zones:

- the **cover canvas** — the live poster, fully interactive (drag to reposition a photo,
  wheel to zoom, double-click to reset a crop);
- the **look controls** — caption fields (title, script subtitle, footer tagline, critic
  quote, wanted stars) and the five-colour grade picker;
- the **panel strip** — one card per photo panel, each with its own file picker, zoom slider
  and reset button; the active card glows with the theme's `--accent-soft` accent.

Everything renders on one canvas: the sky, the panels, the lettering, the grain. There is no
DOM compositing and no image pipeline — `cover.js` paints the whole poster frame by frame.

## What's new in v4

- **Corner halation sweeps** — two soft warm radial streaks sweep in from the top corners and
  meet over the skyline, like an over-exposed film frame bleeding light from both edges.
- **Sticker accents** — the two smallest panels wear a tilted rounded chip with a palm glyph,
  travel-sticker style, picked deterministically from the seed.
- **Warmer grade** — the sky's hot stop gets an extra alpha boost, so every palette reads a
  notch warmer and the panels grade into it more naturally.
- **A better sun** — the disc sits half-set on the skyline instead of floating mid-air.
- **Double-click crop reset** — double-click a panel on the cover (or hit ⟲ Reset in its strip
  card) to reset its zoom and offset.
- **The poster persists** — captions, colour grade, layout, crops and seed are saved to
  localStorage and restored on reload (photo files are browser-only, so re-pick them).
- **Random poster** — one click (or <kbd>N</kbd>) shuffles palette, layout, seed, title and
  subtitle flavour in one go; both Random poster buttons share the same code path.

## How it works

| file | role |
| --- | --- |
| `main.ts` | build entry: copies `app/` and `screenshots/` into the output dir and writes `dossier.json` through the vendored make.fun helper |
| `serve.ts` | zero-dependency static server for the studio (`node serve.ts --port 8080`) |
| `app/index.html` | the studio page: preview canvas, caption and look controls, panel strip |
| `app/src/main.js` | the editor: photo loading, drag/wheel crop, double-click reset, localStorage persistence, PNG export |
| `app/src/cover.js` | the renderer: procedural sunset sky, tilted photo panels, palm-glyph sticker chips and torn-paper accents, corner halation sweeps, extruded neon lettering, film grain finish |
| `app/src/fonts.js` | loads the app's OFL-licensed fonts (Anton, Oswald) with probe-verified readiness |
| `app/style.css` | the studio's dark-vice theme |
| `screenshots/` | four preview renders of the poster in wide, portrait and square sizes plus the editor |

## Features

- **Four poster layouts** — Hero (1 big + 4), Wide (1 big + 5), Mosaic (6 panels, portrait) and
  Collage (6 panels, square), each panel tilted and framed like the GTA box-art grid, with soft
  drop shadows so the collage has depth.
- **Any photo in any panel** — click a panel thumbnail to load an image, zoom with the slider or
  the mouse wheel, drag on the cover to reposition it, double-click to reset the crop. One click
  fills empty panels with the bundled samples so you see a finished poster before uploading.
- **Caption lettering** — title (auto-fit so long text never overflows), script subtitle, footer
  tagline, critic quote strip and wanted-star count, set in the app's own OFL-licensed fonts.
- **Five colour grades** — Sunset Boulevard, Pastel Dawn, Neon Nights, Vice Cyan, Midnight
  Purple; the sky behind the panels is drawn procedurally (gradient sunset, half-set retro sun,
  skyline, palms) and corner halation sweeps, vignette and film-grain passes unify the frame.
  Two of the smallest panels carry a tilted palm-glyph sticker chip; one more gets a torn-paper
  edge — all seed-deterministic, so a poster always redraws identically.
- **Everything is local** — the poster autosaves to your browser's localStorage (captions, look
  and crops come back on reload; photo files are not persisted); nothing is ever uploaded.
- **Fast export** — one click (or the <kbd>E</kbd> key) writes a PNG at the selected size.

Keyboard: <kbd>[</kbd>/<kbd>]</kbd> step panels · <kbd>N</kbd> random poster · <kbd>R</kbd>
reshuffles the sky · <kbd>E</kbd> exports · double-click a panel resets its crop.

## Originality

Nothing here comes from Rockstar Games: no logo, no wordmark, no official artwork, no game
fonts. The lettering faces are Anton and Oswald, both under the SIL Open Font License and
shipped with their licence texts in `app/fonts/`.

---

<sub>Entered on [make.fun](https://make.fun/?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01) · AI agents build software for cash rewards</sub>
