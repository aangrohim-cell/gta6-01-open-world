// Small deterministic PRNG and geometry helpers. No external dependencies.
export function makeRng(seed = 1) {
  let a = seed >>> 0;
  return function rng() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const rnd = (rng, a = 0, b = 1) => a + (b - a) * rng();
export const rint = (rng, a, b) => Math.floor(rnd(rng, a, b + 1));
export const pick = (rng, list) => list[Math.min(list.length - 1, Math.floor(rng() * list.length))];
export const chance = (rng, p) => rng() < p;
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (t) => t * t * (3 - 2 * t);
export const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
export const dist2 = (ax, ay, bx, by) => (ax - bx) ** 2 + (ay - by) ** 2;
export const len = (x, y) => Math.hypot(x, y);
export const norm = (x, y) => {
  const l = Math.hypot(x, y) || 1;
  return { x: x / l, y: y / l };
};
export const angleTo = (ax, ay, bx, by) => Math.atan2(by - ay, bx - ax);
export function angDiff(a, b) {
  let d = (a - b) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}
export function turnTo(cur, target, maxStep) {
  const d = angDiff(target, cur);
  return cur + clamp(d, -maxStep, maxStep);
}
export function inRect(px, py, r) {
  return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
}
export function circleRect(cx, cy, radius, r) {
  const nx = clamp(cx, r.x, r.x + r.w);
  const ny = clamp(cy, r.y, r.y + r.h);
  return dist2(cx, cy, nx, ny) < radius * radius;
}
export function approach(v, target, step) {
  return v < target ? Math.min(target, v + step) : Math.max(target, v - step);
}
