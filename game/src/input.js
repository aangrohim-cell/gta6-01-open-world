// Keyboard and mouse state, with edge-triggered taps. Coordinates are in the game's 1280x720 view.
export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.taps = new Set();
    this.mouse = { x: 640, y: 360, down: false, clicked: false };
    this.onKey = null;

    window.addEventListener('keydown', (e) => {
      if (!this.keys.has(e.code)) this.taps.add(e.code);
      this.keys.add(e.code);
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Tab'].includes(e.code)) e.preventDefault();
      if (this.onKey) this.onKey(e.code);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => {
      this.keys.clear();
      this.mouse.down = false;
    });
    canvas.addEventListener('mousemove', (e) => this.setMouse(e));
    canvas.addEventListener('mousedown', (e) => {
      this.setMouse(e);
      if (e.button === 0) {
        this.mouse.down = true;
        this.mouse.clicked = true;
      }
      e.preventDefault();
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.mouse.down = false;
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  setMouse(e) {
    const r = this.canvas.getBoundingClientRect();
    this.mouse.x = ((e.clientX - r.left) / r.width) * 1280;
    this.mouse.y = ((e.clientY - r.top) / r.height) * 720;
  }

  down(code) { return this.keys.has(code); }
  tapped(code) { return this.taps.has(code); }
  anyDown(...codes) { return codes.some((c) => this.keys.has(c)); }

  endFrame() {
    this.taps.clear();
    this.mouse.clicked = false;
  }
}
