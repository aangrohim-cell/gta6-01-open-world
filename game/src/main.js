// VICE HARBOR boot: fixed-resolution canvas, input, simulation and rendering.
import { VIEW_W, VIEW_H } from './config.js';
import { Game } from './world.js';
import { Input } from './input.js';
import { render } from './render.js';
import { setupShot } from './shots.js';

const canvas = document.getElementById('game');
canvas.width = VIEW_W;
canvas.height = VIEW_H;

function fit() {
  const scale = Math.min(window.innerWidth / VIEW_W, window.innerHeight / VIEW_H);
  canvas.style.width = `${Math.floor(VIEW_W * scale)}px`;
  canvas.style.height = `${Math.floor(VIEW_H * scale)}px`;
}
window.addEventListener('resize', fit);
fit();

const ctx = canvas.getContext('2d', { alpha: false });
const input = new Input(canvas);
const game = new Game(3141);
const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
const shotSeed = Number(params.get('seed')) || 1;

if (shotName) {
  setupShot(shotName, shotSeed, game, input);
  game.shotMode = true;
}

// Expose state for local play-testing only; it never leaves the page.
window.__VICE_GAME__ = game;
window.__VICE_READY__ = true;

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, Math.max(0.001, (now - last) / 1000));
  last = now;
  if (game.shotMode) {
    input.endFrame();
  } else {
    game.update(dt, input);
  }
  render(game, ctx);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
