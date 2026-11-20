// Small timing helpers shared by the canvas painters. Kept dependency-free so both the renderer
// and the HUD can pulse lights, markers and siren washes from the same clock.

export function pulse(time, speed = 1, phase = 0) {
  return 0.5 + 0.5 * Math.sin(time * speed + phase);
}

export function breathe(time, speed = 1, phase = 0, amount = 1) {
  return 1 + (pulse(time, speed, phase) * 2 - 1) * amount;
}

export function fade(t, max) {
  if (max <= 0) return 0;
  return Math.max(0, Math.min(1, t / max));
}

/** A smooth 0→1→0 triangle wave; slower and softer than a sine for rotating highlights. */
export function sweep(time, speed = 1, phase = 0) {
  const step = (((time * speed + phase) / Math.PI) % 2 + 2) % 2;
  return step <= 1 ? step : 2 - step;
}
