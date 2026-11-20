// Sound, all synthesised with the Web Audio API: no files, no network. The context is created on
// the first key press or click, as browsers require. Everything is quiet by design and every
// effect is short; the engine and siren hums follow the player's car and the nearest cruiser.

export function createAudio() {
  let context = null;
  let master = null;
  let engine = null;
  let siren = null;
  let muted = false;
  let started = false;

  function ensure() {
    if (started) return context;
    started = true;
    try {
      const Ctor = window.AudioContext ?? window.webkitAudioContext;
      if (!Ctor) return null;
      context = new Ctor();
      master = context.createGain();
      master.gain.value = muted ? 0 : 0.55;
      master.connect(context.destination);
    } catch {
      context = null;
    }
    return context;
  }

  function resume() {
    ensure();
    if (context && context.state === 'suspended') context.resume();
  }

  function now() { return context ? context.currentTime : 0; }

  function tone(freq, duration, type = 'sine', gain = 0.2, slide = 0, delay = 0) {
    if (!context || muted) return;
    const t = now() + delay;
    const osc = context.createOscillator();
    const amp = context.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slide !== 0) osc.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t + duration);
    amp.gain.setValueAtTime(0.0001, t);
    amp.gain.exponentialRampToValueAtTime(gain, t + 0.008);
    amp.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    osc.connect(amp);
    amp.connect(master);
    osc.start(t);
    osc.stop(t + duration + 0.02);
  }

  function noise(duration, gain = 0.3, lowpass = 1800, highpass = 0, delay = 0) {
    if (!context || muted) return;
    const t = now() + delay;
    const length = Math.max(1, Math.floor(context.sampleRate * duration));
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = context.createBufferSource();
    source.buffer = buffer;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = lowpass;
    const amp = context.createGain();
    amp.gain.setValueAtTime(gain, t);
    amp.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    source.connect(filter);
    if (highpass > 0) {
      const high = context.createBiquadFilter();
      high.type = 'highpass';
      high.frequency.value = highpass;
      filter.connect(high);
      high.connect(amp);
    } else {
      filter.connect(amp);
    }
    amp.connect(master);
    source.start(t);
  }

  function startLoops() {
    if (!context || engine) return;
    // Engine: a saw pair whose pitch follows the car's speed.
    engine = { osc: [], gain: null, filter: null };
    for (const detune of [0, 7]) {
      const osc = context.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = 42;
      osc.detune.value = detune;
      engine.osc.push(osc);
    }
    engine.filter = context.createBiquadFilter();
    engine.filter.type = 'lowpass';
    engine.filter.frequency.value = 240;
    engine.gain = context.createGain();
    engine.gain.gain.value = 0.0001;
    for (const osc of engine.osc) osc.connect(engine.filter);
    engine.filter.connect(engine.gain);
    engine.gain.connect(master);
    for (const osc of engine.osc) osc.start();

    // Siren: a square wave wobbling between two tones.
    siren = { osc: context.createOscillator(), gain: context.createGain(), lfo: context.createOscillator() };
    siren.osc.type = 'square';
    siren.osc.frequency.value = 620;
    siren.lfo.type = 'sine';
    siren.lfo.frequency.value = 1.5;
    const lfoGain = context.createGain();
    lfoGain.gain.value = 180;
    siren.lfo.connect(lfoGain);
    lfoGain.connect(siren.osc.frequency);
    siren.gain.gain.value = 0.0001;
    siren.osc.connect(siren.gain);
    siren.gain.connect(master);
    siren.osc.start();
    siren.lfo.start();
  }

  return {
    resume,
    get muted() { return muted; },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.55;
      return muted;
    },
    start() {
      resume();
      startLoops();
    },
    /** gain and pitch are 0..1; pass null to silence. */
    setEngine(speed, active) {
      if (!context || !engine) return;
      const t = now();
      const amount = active ? Math.min(1, 0.35 + speed) : 0;
      engine.gain.gain.setTargetAtTime(amount * 0.075, t, 0.08);
      const freq = 38 + speed * 92;
      for (const osc of engine.osc) osc.frequency.setTargetAtTime(freq, t, 0.09);
      engine.filter.frequency.setTargetAtTime(220 + speed * 900, t, 0.1);
    },
    setSiren(strength) {
      if (!context || !siren) return;
      siren.gain.gain.setTargetAtTime(Math.min(0.09, strength * 0.09), now(), 0.15);
    },
    gunshot(kind = 'pistol') {
      resume();
      if (kind === 'smg') {
        noise(0.08, 0.28, 2800, 400);
        tone(190, 0.05, 'square', 0.06, -120);
      } else {
        noise(0.15, 0.45, 2400, 200);
        tone(120, 0.12, 'square', 0.12, -70);
      }
    },
    explosion() {
      resume();
      noise(0.7, 0.75, 900, 30);
      tone(70, 0.5, 'sine', 0.3, -45);
    },
    impact() {
      resume();
      noise(0.06, 0.14, 1400, 500);
    },
    /** Tyre scrub on a hard handbrake turn. Short and filtered so it never drowns the engine. */
    skid() {
      resume();
      noise(0.13, 0.1, 2200, 900);
    },
    hit() {
      resume();
      noise(0.09, 0.25, 700, 80);
    },
    punch() {
      resume();
      noise(0.07, 0.2, 500, 90);
      tone(90, 0.06, 'sine', 0.15, -40);
    },
    cash() {
      resume();
      tone(880, 0.08, 'triangle', 0.12);
      tone(1320, 0.14, 'triangle', 0.1, 0, 0.07);
    },
    pickup() {
      resume();
      tone(520, 0.07, 'square', 0.07);
      tone(780, 0.1, 'square', 0.06, 0, 0.06);
    },
    /** A bright four-note flourish when a hidden mixtape is found. */
    tape() {
      resume();
      [659, 880, 1175, 1568].forEach((freq, index) => tone(freq, 0.13, 'triangle', 0.09, 0, index * 0.06));
    },
    /** A very short, quiet footfall; the world only calls it while sprinting. */
    step() {
      resume();
      noise(0.045, 0.045, 780, 180);
    },
    horn() {
      resume();
      tone(300, 0.24, 'square', 0.08);
      tone(380, 0.24, 'square', 0.07);
    },
    ui() {
      resume();
      tone(640, 0.05, 'triangle', 0.07);
    },
    uiBack() {
      resume();
      tone(320, 0.07, 'triangle', 0.07);
    },
    sirenBlip() {
      resume();
      tone(740, 0.09, 'square', 0.035, 240);
    },
    mission() {
      resume();
      [523, 659, 784, 1046].forEach((freq, i) => tone(freq, 0.22, 'triangle', 0.11, 0, i * 0.11));
    },
    fail() {
      resume();
      [392, 330, 262].forEach((freq, i) => tone(freq, 0.3, 'sawtooth', 0.07, 0, i * 0.16));
    },
    wasted() {
      resume();
      tone(180, 0.9, 'sawtooth', 0.12, -120);
      noise(0.8, 0.25, 400, 20);
    },
    reload() {
      resume();
      noise(0.04, 0.1, 2500, 800);
      noise(0.05, 0.1, 2000, 700, 0.13);
    },
  };
}
