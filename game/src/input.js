// Keyboard and mouse, read once per frame. Held keys give movement; keys that went down since the
// last frame are a set of edges, so a press between two frames is never lost or counted twice.
// The mouse position is kept in the game's logical 1280x720 space, whatever size the canvas is
// displayed at.

import { VIEW } from './config.js';

const GAME_KEYS = new Set([
  'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyE', 'KeyF', 'KeyM', 'KeyR', 'KeyP', 'KeyQ',
  'ShiftLeft', 'ShiftRight', 'Space', 'Enter', 'Escape', 'Tab',
  'Digit1', 'Digit2', 'Digit3', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
]);

export function createInput(canvas) {
  const down = new Set();
  const pressed = new Set();
  const mouse = { x: VIEW.width / 2, y: VIEW.height / 2, down: false, pressed: false, wheel: 0 };
  const clicks = [];

  function logical(event) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / Math.max(1, rect.width)) * VIEW.width,
      y: ((event.clientY - rect.top) / Math.max(1, rect.height)) * VIEW.height,
    };
  }

  window.addEventListener('keydown', (event) => {
    if (GAME_KEYS.has(event.code)) event.preventDefault();
    if (event.repeat) return;
    down.add(event.code);
    pressed.add(event.code);
  });
  window.addEventListener('keyup', (event) => {
    down.delete(event.code);
  });
  window.addEventListener('blur', () => {
    down.clear();
    mouse.down = false;
  });

  canvas.addEventListener('pointermove', (event) => {
    const point = logical(event);
    mouse.x = point.x;
    mouse.y = point.y;
  });
  canvas.addEventListener('pointerdown', (event) => {
    const point = logical(event);
    mouse.x = point.x;
    mouse.y = point.y;
    if (event.button === 0) {
      mouse.down = true;
      mouse.pressed = true;
      clicks.push({ x: point.x, y: point.y });
    }
    canvas.setPointerCapture?.(event.pointerId);
    event.preventDefault();
  });
  window.addEventListener('pointerup', (event) => {
    if (event.button === 0) mouse.down = false;
  });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());
  canvas.addEventListener('wheel', (event) => {
    mouse.wheel += Math.sign(event.deltaY);
    event.preventDefault();
  }, { passive: false });

  return {
    down(code) { return down.has(code); },
    pressed(code) { return pressed.has(code); },
    anyPressed(codes) { return codes.some((code) => pressed.has(code)); },
    mouse,
    /** Clicks since the last call, then forgotten. */
    takeClicks() {
      const taken = clicks.slice();
      clicks.length = 0;
      return taken;
    },
    /** Call at the end of every frame: edges only last one frame. */
    endFrame() {
      pressed.clear();
      mouse.pressed = false;
      mouse.wheel = 0;
    },
    clear() {
      down.clear();
      pressed.clear();
      mouse.down = false;
    },
  };
}
