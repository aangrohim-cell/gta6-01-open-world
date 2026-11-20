// VICE HARBOR — a complete open-world crime game for make.fun's "Make GTA 6" bounty (gta6-01).
//
// The game is this directory's game/ folder: plain static files a desktop browser loads offline
// (game/index.html and its ES modules, no library and no network request). It is a top-down canvas
// city at sunset: drive and walk sixteen blocks of Vice Harbor, steal traffic, outrun a five-star
// wanted level, fight with fists, a pistol and an SMG, and play Dex's six-job story from the garage
// on Calle Ocho to the Mendez mansion on Palm Row. Saves live in localStorage.
//
// main.ts is only the hand-in: it copies game/ and screenshots/ from beside this file to /output and
// writes /output/dossier.json, the summary the judge reads, with the vendored make.fun library.
// Screenshots are real 1280x720 browser renders from the game's own staged shot mode; the first by
// name is the cover.
//
// Serve it locally with `node serve.ts`, then open http://localhost:8080.
// The shot mode is ?shot=cover|street|mission|title, and ?seed=N fixes the city.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// The scorer's own caps (reference/gate.json). Validate locally so a broken hand-in fails here
// instead of in the grader: only text_max_bytes shapes the dossier text; the others refuse an entry
// the scorer would refuse (more than 4 screenshots or one over 256 KiB; more than 993 files in game/
// or 48 MiB of game files, in all, or a path under game/ over 1000 bytes).
const CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

const REQUIRED_SHOTS = ['1-cover.jpg', '2-marina.jpg', '3-pier.jpg', '4-title.jpg'];
const TEXT_FILE = /\.(html|js|ts|css|json|txt|svg|map)$/i;
const NETWORK_PATTERN = /(?:https?:\/\/|\b(?:fetch|XMLHttpRequest|WebSocket|EventSource)\s*\(|navigator\.sendBeacon\s*\()/i;

function fail(message) {
  throw new Error(`hand-in: ${message}`);
}

function walk(dir, root = dir) {
  const found = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isSymbolicLink()) fail(`game/${relative(root, path)} is a symlink`);
    if (entry.isDirectory()) found.push(...walk(path, root));
    else if (entry.isFile()) found.push(relative(root, path));
  }
  return found;
}

/** Read the SOF marker so a mislabelled or cropped image cannot be handed in as a screenshot. */
function jpegSize(path) {
  const bytes = readFileSync(path);
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  let offset = 2;
  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 0xff) { offset += 1; continue; }
    while (bytes[offset] === 0xff) offset += 1;
    const marker = bytes[offset++];
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (marker === 0xd9) break;
    const length = bytes.readUInt16BE(offset);
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return { width: bytes.readUInt16BE(offset + 5), height: bytes.readUInt16BE(offset + 3) };
    }
    offset += length;
  }
  return null;
}

function validate() {
  const gameDir = join(here, 'game');
  const shotsDir = join(here, 'screenshots');
  if (!existsSync(gameDir) || !statSync(gameDir).isDirectory()) fail('game/ is missing');
  if (!existsSync(join(gameDir, 'index.html'))) fail('game/index.html is missing');
  if (!existsSync(shotsDir) || !statSync(shotsDir).isDirectory()) fail('screenshots/ is missing');

  const games = walk(gameDir);
  let gameBytes = 0;
  for (const file of games) {
    const path = join(gameDir, file);
    const stats = lstatSync(path);
    gameBytes += stats.size;
    if (file.length > CAPS.game_path_max_bytes) fail(`game/${file} path is too long`);
    if (file === 'index.html' && stats.size > 1024 * 1024) fail('game/index.html is over 1 MiB');
    if (TEXT_FILE.test(file)) {
      const source = readFileSync(path, 'utf8');
      const hit = source.match(NETWORK_PATTERN);
      if (hit) fail(`game/${file} references the network (${hit[0]})`);
    }
  }
  if (games.length > CAPS.game_max_files) fail(`game/ holds ${games.length} files, over ${CAPS.game_max_files}`);
  if (gameBytes > CAPS.game_max_bytes) fail(`game/ is ${gameBytes} bytes, over ${CAPS.game_max_bytes}`);

  const shots = readdirSync(shotsDir)
    .filter((name) => !name.startsWith('.') && /\.(png|jpe?g)$/i.test(name))
    .sort();
  if (shots.length !== REQUIRED_SHOTS.length) fail(`screenshots/ holds ${shots.length} images; the entry needs exactly ${REQUIRED_SHOTS.length}`);
  for (const required of REQUIRED_SHOTS) {
    if (!shots.includes(required)) fail(`screenshots/${required} is missing`);
  }
  const sizes = [];
  for (const name of shots) {
    const path = join(shotsDir, name);
    const size = lstatSync(path).size;
    if (size === 0) fail(`screenshots/${name} is empty`);
    if (size > CAPS.screenshots.max_bytes) fail(`screenshots/${name} is ${size} bytes, over ${CAPS.screenshots.max_bytes}`);
    const dimensions = jpegSize(path);
    if (!dimensions || dimensions.width !== 1280 || dimensions.height !== 720) {
      fail(`screenshots/${name} is not a 1280x720 JPEG`);
    }
    sizes.push(`${name} ${(size / 1024).toFixed(0)} KiB`);
  }
  console.log(`Validated: ${games.length} game files (${(gameBytes / 1024 / 1024).toFixed(2)} MiB), ${shots.length} renders — ${sizes.join(', ')}`);
  return { games, shots };
}

try {
  validate();
  mkdirSync(out, { recursive: true });
  cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
  mkdirSync(join(out, 'screenshots'), { recursive: true });
  cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });

  const dossier = buildDossier(out, CAPS);
  writeFileSync(join(out, 'dossier.json'), dossier);
  console.log(`Hand-in ready: ${join(out, 'dossier.json')} (${dossier.byteLength.toLocaleString('en-US')} bytes).`);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
