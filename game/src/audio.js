// All sound is synthesised at runtime with Web Audio. There are no audio files or network requests.
export class Sound {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.engine = null;
    this.engineGain = null;
    this.siren = null;
    this.sirenGain = null;
    this.musicOn = false;
    this.beat = 0;
    this.musicClock = 0;
    this.sirenClock = 0;
    this.stepClock = 0;
  }

  init() {
    if (this.ctx) { this.resume(); return; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.55;
      this.master.connect(this.ctx.destination);
    } catch { this.ctx = null; }
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.55;
    return this.muted;
  }

  tone(freq, dur, type = 'sine', vol = 0.1, slide = 0, delay = 0) {
    if (!this.ctx || this.muted) return;
    try {
      const t = this.ctx.currentTime + delay;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(Math.max(20, freq), t);
      if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t + dur);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(gain).connect(this.master);
      osc.start(t);
      osc.stop(t + dur + 0.02);
    } catch { /* ignore audio device problems */ }
  }

  noise(dur = 0.12, vol = 0.2, cutoff = 1800, delay = 0) {
    if (!this.ctx || this.muted) return;
    try {
      const t = this.ctx.currentTime + delay;
      const n = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
      const buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < n; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / n);
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = cutoff;
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(vol, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      src.connect(filter).connect(gain).connect(this.master);
      src.start(t);
    } catch { /* ignore */ }
  }

  ui() { this.tone(660, 0.07, 'square', 0.06, 180); }
  confirm() { this.tone(520, 0.1, 'triangle', 0.1, 220); this.tone(780, 0.16, 'triangle', 0.08, 200, 0.08); }
  cash() { this.tone(880, 0.08, 'square', 0.07); this.tone(1180, 0.1, 'square', 0.06, 0, 0.07); }
  hit() { this.noise(0.12, 0.22, 700); this.tone(130, 0.12, 'sawtooth', 0.08, -60); }
  crack() { this.noise(0.28, 0.3, 2600); this.tone(80, 0.25, 'sawtooth', 0.11, -40); }
  pickup() { this.tone(720, 0.09, 'sine', 0.09, 260); this.tone(1080, 0.12, 'sine', 0.06, 160, 0.06); }

  shoot(kind) {
    if (kind === 'fists') { this.noise(0.06, 0.09, 900); return; }
    if (kind === 'smg') { this.noise(0.055, 0.14, 4200); this.tone(190, 0.045, 'square', 0.045, -80); }
    else { this.noise(0.1, 0.2, 3400); this.tone(240, 0.08, 'square', 0.07, -130); }
  }

  footstep() { this.noise(0.045, 0.035, 520); }

  ensureEngine() {
    if (!this.ctx || this.engine) return;
    try {
      this.engine = this.ctx.createOscillator();
      this.engineGain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 620;
      this.engine.type = 'sawtooth';
      this.engine.frequency.value = 55;
      this.engineGain.gain.value = 0;
      this.engine.connect(filter).connect(this.engineGain).connect(this.master);
      this.engine.start();
    } catch { this.engine = null; }
  }

  ensureSiren() {
    if (!this.ctx || this.siren) return;
    try {
      this.siren = this.ctx.createOscillator();
      this.sirenGain = this.ctx.createGain();
      this.siren.type = 'square';
      this.siren.frequency.value = 720;
      this.sirenGain.gain.value = 0;
      this.siren.connect(this.sirenGain).connect(this.master);
      this.siren.start();
    } catch { this.siren = null; }
  }

  tick(dt, speed, driving, stars, moving) {
    if (!this.ctx) return;
    this.ensureEngine();
    this.ensureSiren();
    if (this.engine && this.engineGain) {
      const target = driving ? 0.048 : 0;
      this.engineGain.gain.value += (target - this.engineGain.gain.value) * Math.min(1, dt * 6);
      this.engine.frequency.value += (52 + Math.abs(speed) * 0.62 - this.engine.frequency.value) * Math.min(1, dt * 5);
    }
    this.sirenClock += dt;
    if (this.siren && this.sirenGain) {
      const want = stars > 0 && !this.muted ? 0.026 : 0;
      this.sirenGain.gain.value += (want - this.sirenGain.gain.value) * Math.min(1, dt * 3);
      if (want > 0 && this.sirenClock > 0.42) {
        this.sirenClock = 0;
        this.siren.frequency.value = this.siren.frequency.value > 700 ? 540 : 780;
      }
    }
    this.stepClock += dt;
    if (moving && !driving && this.stepClock > (this.sprint ? 0.22 : 0.34)) {
      this.stepClock = 0;
      this.footstep();
    }
    if (this.musicOn) this.musicTick(dt);
  }

  startMusic() { this.musicOn = true; this.beat = 0; this.musicClock = 0; }
  stopMusic() { this.musicOn = false; }

  musicTick(dt) {
    this.musicClock += dt;
    const step = 0.26;
    while (this.musicClock >= step) {
      this.musicClock -= step;
      const b = this.beat++;
      const bass = [110, 110, 146.83, 130.81, 98, 98, 130.81, 123.47][Math.floor(b / 2) % 8];
      if (b % 2 === 0) this.tone(bass, 0.34, 'triangle', 0.036, 0);
      if (b % 8 === 0) {
        this.tone(bass * 2, 1.6, 'sine', 0.018);
        this.tone(bass * 2.5, 1.6, 'sine', 0.014);
        this.tone(bass * 3, 1.6, 'sine', 0.011);
      }
      if (b % 2 === 1) this.tone([440, 523, 659, 587, 440, 392, 494, 523][b % 8], 0.16, 'square', 0.012, 0);
      if (b % 16 === 14) this.noise(0.06, 0.02, 6000);
    }
  }
}
