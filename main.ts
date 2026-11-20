// Vice State — build entry point for the make.fun gta6-cover-art-01 grader.
//
// What this file does, in order:
//   1. copy the app/ tree (the whole cover-art studio: index.html, style.css,
//      the ES modules in src/ and the two sample photos — no bundled fonts,
//      the app renders with system font stacks only) into
//      the output directory;
//   2. copy screenshots/ beside it, if the directory exists — the grader reads
//      the four preview JPGs from there;
//   3. write dossier.json through the vendored buildDossier helper, which
//      enforces the scorer's gate: how much text, how many screenshots and at
//      what size, and how many bytes app/ may weigh.
//
// Outside the grader container, point MAKEFUN_OUTPUT_DIR at a scratch
// directory (the default /output is usually not writable). Serve the app
// locally with `node serve.ts --port 8080` and take screenshots against it.

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

// Gate constants mirror the scorer's reference/gate.json. text_max_bytes caps
// the dossier payload itself; the screenshot caps refuse more than 4 images or
// any single one over 256 KiB; the app caps refuse more than 993 files, more
// than 48 MiB of app bytes in total, or any single path under app/ longer
// than 1000 bytes. (app/ sits inside /output's own 1000-entry cap alongside
// screenshots/ and dossier.json.)
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
