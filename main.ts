/**
 * main.ts - AEROVANT entry program (Node 22, standard library only).
 * Copies game/ and screenshots/ into the output directory and writes
 * dossier.json with buildDossier from the kit's vendor library.
 * Run: mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
 * AEROVANT revision v3
 */
import { cpSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = dirname(fileURLToPath(import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR || '/output';

mkdirSync(outDir, { recursive: true });
mkdirSync(join(outDir, 'game'), { recursive: true });
mkdirSync(join(outDir, 'screenshots'), { recursive: true });

cpSync(join(repoRoot, 'game'), join(outDir, 'game'), { recursive: true });
cpSync(join(repoRoot, 'screenshots'), join(outDir, 'screenshots'), { recursive: true });

const dossier = buildDossier(outDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 1024 * 1024 },
  game_max_files: 993,
  game_max_bytes: 48 * 1024 * 1024,
  game_path_max_bytes: 1000,
});

writeFileSync(join(outDir, 'dossier.json'), dossier);
const shots = readdirSync(join(outDir, 'screenshots')).length;
console.log('AEROVANT: wrote ' + join(outDir, 'dossier.json') + ' (' + dossier.length + ' bytes, ' + shots + ' screenshots)');
