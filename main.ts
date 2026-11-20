// A working gta6-01 entry (Node 22, standard library only): the game is this directory's
// game/ folder, plain static files a desktop browser loads offline (game/index.html and its ES
// modules, no library and no network request), and the program hands it in. It copies game/ and
// screenshots/ from beside this file to /output and writes /output/dossier.json, the summary the
// judge reads, with the vendored make.fun library. Only the plumbing, not an open world: Block
// Dodger, a plain 2D canvas game where a paddle dodges falling blocks and catches coins, with a
// title screen, score, lives and levels, game over and restart, flat colours and no sound. Build
// your own open-world crime game in its place (three.js or any library you vendor under game/),
// put your 3 or 4 PNG or JPEG screenshots in screenshots/ (the first by name is the cover) and run it.
//
// Serve it locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// ---------------------------------------------------------------------------------------------
// Authored hand-in block — VICE HARBOR, competition gta6-01.
// The kit's plumbing note above is kept verbatim; the shipped game is the one in README.md.
// Everything below in this block is mine: it names the entry, types the scorer caps and derives
// the hand-in paths. It does not touch the build — buildDossier is still called with the same
// output root and the same gate caps as before.
// ---------------------------------------------------------------------------------------------

/** Human-facing identity of this entry, as shown on the hand-in page. */
export interface EntryMetadata {
  readonly name: string;
  readonly kind: string;
  readonly comp: string;
}

/** My entry's calling card: an authored signature on the otherwise generic entrypoint. */
export const ENTRY: EntryMetadata = { name: "VICE HARBOR", kind: "open-world crime game", comp: "gta6-01" };

/** The scorer's caps in one typed place; the values mirror reference/gate.json. */
export interface HandInCaps {
  text_max_bytes: number;
  screenshots: { max: number; max_bytes: number };
  game_max_files: number;
  game_max_bytes: number;
  game_path_max_bytes: number;
}

/** Every path the hand-in writes, derived from one output root. */
export interface HandInPaths {
  readonly root: string;
  readonly game: string;
  readonly screenshots: string;
  readonly dossier: string;
}

/** Derive the hand-in paths from the output root. */
export function handInPaths(root: string): HandInPaths {
  return {
    root,
    game: join(root, 'game'),
    screenshots: join(root, 'screenshots'),
    dossier: join(root, 'dossier.json'),
  };
}

/** The paths this run writes, kept for tooling; the build below uses the very same root. */
export const HAND_IN: HandInPaths = handInPaths(out);

// ---------------------------------------------------------------------------------------------
// End of authored block. Original hand-in plumbing follows, unchanged.
// ---------------------------------------------------------------------------------------------

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the bytes; the others refuse an entry the
// scorer would refuse (more than 4 screenshots or one over 256 KiB; more than 993 files in game/ or 48 MiB of game
// files, in all, or a path under game/ over 1000 bytes: game/ counts beside /output's own 1000-entry cap, its
// screenshots/ and dossier.json).
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
