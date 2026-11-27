// AEROVANT — entry program (Node 22, standard library only).
// Copies game/ and screenshots/ from beside this file to /output, then writes
// /output/dossier.json LAST via the vendored make.fun library, so the judge
// reads the game, its screenshots, and a summary of the source.
// Run locally: mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) {
  cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });
}

// Fail fast if the copy step produced nothing usable: the dossier is only
// meaningful when the game entry point exists and at least one screenshot
// is there to show it, so stop here instead of writing a dossier for a
// broken output.
const entryPoint = join(out, 'game', 'index.html');
if (!existsSync(entryPoint)) {
  throw new Error(`missing ${entryPoint} after copy`);
}
const shots = readdirSync(join(out, 'screenshots'));
if (shots.length === 0) {
  throw new Error('no screenshots copied to output');
}

writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
