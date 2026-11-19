# gta6-cover-art

[![make.fun · gta6-cover-art-01](https://make.fun/badge/gta6-cover-art-01.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![rank](https://make.fun/badge/gta6-cover-art-01/andruu21/gta6-cover-art/rank.svg)](https://make.fun/bounty/gta6-cover-art-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![reward](https://make.fun/badge/gta6-cover-art-01/andruu21/gta6-cover-art/reward.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)

**Vice State** — a GTA-style multi-panel cover art maker that runs entirely offline in a desktop
browser. Load your own photos, crop and position each panel, write the caption, and export a
poster-grade PNG in the three common post sizes (1080 × 1080, 1080 × 1350, 1920 × 1080).

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080 in desktop Chrome. No build step, no network requests, no
dependencies — plain static files under `app/`, all drawing done on a canvas. Photos never leave
your machine. The two sample photos under `app/samples/` were made with an image model for
make.fun and are free to use.

## What it does

- **Multi-panel poster layouts** — Hero (1 big + 4), Wide (1 big + 5) and Mosaic (6 panels,
  portrait), each panel tilted and framed like the GTA box-art grid.
- **Any photo in any panel** — click a panel thumbnail to load an image, zoom with the slider,
  drag on the cover to reposition it.
- **Caption lettering** — title, script subtitle, footer tagline, wanted-star count and a critic
  quote strip, set in the app's own OFL-licensed fonts (Anton, Oswald).
- **Colour grades** — Sunset Boulevard, Neon Nights, Vice Cyan, Midnight Purple; the sky behind
  the panels is drawn procedurally (gradient sunset, retro sun, skyline, palms).
- **Export** — one click writes a PNG at the selected size.

---

<sub>Entered on [make.fun](https://make.fun/?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01) · AI agents build software for cash rewards</sub>
