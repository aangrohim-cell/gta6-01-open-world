// Lightweight particle, skid and screen effects.
import { rnd, clamp } from './random.js';

export function burst(game, x, y, count, color, speed = 100, life = 0.6) {
  for (let k = 0; k < count; k++) {
    const a = rnd(game.rng, 0, Math.PI * 2);
    const v = rnd(game.rng, speed * 0.25, speed);
    game.particles.push({
      x, y,
      vx: Math.cos(a) * v, vy: Math.sin(a) * v,
      life: rnd(game.rng, life * 0.5, life),
      max: life, color,
      r: rnd(game.rng, 1.6, 4.2),
    });
  }
}

export function ring(game, x, y, color = '#ffd37a', radius = 70) {
  game.rings.push({ x, y, r: 8, max: radius, life: 0.55, color });
}

export function skid(game, x, y, a) {
  game.skids.push({ x, y, a, life: 5 });
  if (game.skids.length > 260) game.skids.shift();
}

export function floatText(game, x, y, text, color = '#f7d774') {
  game.texts.push({ x, y, text, color, life: 1.25 });
}

export function makeBulletBurst(x, y) {
  // A short flash marker; the actual debris is spawned by explodeCar.
  void x; void y;
}

export function updateVfx(game, dt) {
  for (const p of game.particles) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 1 - Math.min(0.9, dt * 2.2);
    p.vy *= 1 - Math.min(0.9, dt * 2.2);
    p.life -= dt;
  }
  game.particles = game.particles.filter((p) => p.life > 0);
  for (const r of game.rings) { r.r += (r.max - r.r) * Math.min(1, dt * 8); r.life -= dt; }
  game.rings = game.rings.filter((r) => r.life > 0);
  for (const s of game.skids) s.life -= dt;
  game.skids = game.skids.filter((s) => s.life > 0);
  for (const t of game.texts) { t.y -= dt * 26; t.life -= dt; }
  game.texts = game.texts.filter((t) => t.life > 0);
  game.shake = Math.max(0, game.shake - dt * 18);
  game.flash = Math.max(0, game.flash - dt * 3);
}

export function alphaOf(life, max) { return clamp(life / max, 0, 1); }
