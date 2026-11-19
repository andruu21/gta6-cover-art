// Vice State entry point (gta6-cover-art-01). This file packages the entry for the
// make.fun grader: it copies the app/ directory (the self-contained cover-art maker,
// plain ES modules and sample photos, no dependencies) and the screenshots/ directory
// from beside this file into /output, then writes /output/dossier.json via the vendored
// buildDossier helper from vendor/makefun-app.ts, enforcing the scorer's size caps
// (4 screenshots at 256 KiB each, 993 files / 48 MiB in app/, 1000-byte paths, and a
// 160 KiB dossier text budget). Serve locally with `node serve.ts`; outside the
// grader container set MAKEFUN_OUTPUT_DIR to a real directory.

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-app.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(out, { recursive: true });
cpSync(join(here, 'app'), join(out, 'app'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the bytes; the others refuse an entry the
// scorer would refuse (more than 4 screenshots or one over 256 KiB; more than 993 files in app/ or 48 MiB of app
// files, in all, or a path under app/ over 1000 bytes: app/ counts beside /output's own 1000-entry cap, its
// screenshots/ and dossier.json).
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    app_max_files: 993,
    app_max_bytes: 50331648,
    app_path_max_bytes: 1000,
  }),
);
