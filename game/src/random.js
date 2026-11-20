// A small seeded random generator (mulberry32), so a seed always builds the same city and the
// same traffic, and the screenshot scenes can be repeated exactly.

export function createRandom(seed) {
  let a = seed | 0;
  return function random() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pick(random, list) {
  return list[Math.min(list.length - 1, Math.floor(random() * list.length))];
}

export function range(random, min, max) {
  return min + random() * (max - min);
}

export function intRange(random, min, max) {
  return min + Math.floor(random() * (max - min + 1));
}

/** A cheap 2D value noise for district shapes, in 0..1. */
export function valueNoise(x, y) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

export function smoothstep(edge0, edge1, value) {
  const t = Math.max(0, Math.min(1, (value - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

export function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function distance(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}

/** Readable coin flip for loot tables and ambient events. */
export function chance(random, probability) {
  return random() < probability;
}

/** The smallest signed difference between two angles, in -PI..PI. */
export function angleDelta(from, to) {
  let delta = (to - from) % (Math.PI * 2);
  if (delta > Math.PI) delta -= Math.PI * 2;
  if (delta < -Math.PI) delta += Math.PI * 2;
  return delta;
}

export function shade(hex, amount) {
  const value = hex.replace('#', '');
  const num = Number.parseInt(value.length === 3 ? value.split('').map((c) => c + c).join('') : value, 16);
  const r = Math.max(0, Math.min(255, ((num >> 16) & 255) + amount));
  const g = Math.max(0, Math.min(255, ((num >> 8) & 255) + amount));
  const b = Math.max(0, Math.min(255, (num & 255) + amount));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

export function withAlpha(hex, alpha) {
  const value = hex.replace('#', '');
  const num = Number.parseInt(value.length === 3 ? value.split('').map((c) => c + c).join('') : value, 16);
  return `rgba(${(num >> 16) & 255}, ${(num >> 8) & 255}, ${num & 255}, ${alpha})`;
}
