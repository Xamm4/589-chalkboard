// WebAudio sound: everything is synthesized (no files needed). Optional mp3 overrides listed in
// CONFIG.audio.files are loaded from assets/sfx/ and preferred when present.

export class Sound {
  constructor(cfg) {
    this.cfg = cfg;
    this.ctx = null;
    this.muted = false;
    this.buffers = {};
    this.musicOn = false;
    this.musicWanted = false;
    this.intensity = 0;
    this.step = 0;
    this.nextNoteTime = 0;
    this.ducked = false;
    this.lastLetter = 0;
  }

  get ready() {
    return !!this.ctx;
  }

  // Must be called from a user gesture (iOS).
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      this.ctx = new AC();
    } catch {
      return;
    }
    const c = this.ctx;
    this.comp = c.createDynamicsCompressor();
    this.comp.threshold.value = -14;
    this.comp.ratio.value = 4;
    this.master = c.createGain();
    this.master.gain.value = this.muted ? 0 : this.cfg.audio.master;
    this.sfx = c.createGain();
    this.music = c.createGain();
    this.music.gain.value = this.cfg.audio.music;
    this.sfx.connect(this.comp);
    this.music.connect(this.comp);
    this.comp.connect(this.master);
    this.master.connect(c.destination);
    // shared noise
    const len = c.sampleRate * 2;
    this.noiseBuf = c.createBuffer(1, len, c.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    // silent blip to fully unlock iOS
    const s = c.createBufferSource();
    s.buffer = c.createBuffer(1, 1, 22050);
    s.connect(c.destination);
    s.start(0);
    this.loadFiles();
    this.timer = setInterval(() => this.schedule(), 25);
    if (this.musicWanted) this.startMusic(this.intensity);
  }

  async loadFiles() {
    const files = this.cfg.audio.files || {};
    for (const [name, file] of Object.entries(files)) {
      try {
        const res = await fetch(`assets/sfx/${file}`);
        if (!res.ok) continue;
        const arr = await res.arrayBuffer();
        this.buffers[name] = await new Promise((ok, bad) => this.ctx.decodeAudioData(arr, ok, bad));
      } catch {
        /* fall back to synth */
      }
    }
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.setTargetAtTime(m ? 0 : this.cfg.audio.master, this.ctx.currentTime, 0.02);
  }

  suspend() {
    if (this.ctx && this.ctx.state === 'running') this.ctx.suspend().catch(() => {});
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
  }

  // ---------------------------------------------------------------- primitives
  get now() {
    return this.ctx.currentTime;
  }

  env(g, t, attack, peak, decay) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  }

  noise({ t = this.now, dur = 0.1, type = 'bandpass', freq = 1000, freqEnd, q = 1, gain = 0.2, attack = 0.005, out = this.sfx }) {
    const c = this.ctx;
    const src = c.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = c.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, t);
    if (freqEnd) f.frequency.exponentialRampToValueAtTime(freqEnd, t + dur);
    f.Q.value = q;
    const g = c.createGain();
    this.env(g, t, attack, gain, dur);
    src.connect(f);
    f.connect(g);
    g.connect(out);
    src.start(t, Math.random() * 1.5);
    src.stop(t + attack + dur + 0.05);
  }

  tone({ t = this.now, dur = 0.2, type = 'sine', freq = 440, freqEnd, gain = 0.2, attack = 0.005, filter, q = 1, out = this.sfx, vibrato = 0 }) {
    const c = this.ctx;
    const o = c.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (freqEnd) o.frequency.exponentialRampToValueAtTime(freqEnd, t + attack + dur);
    let node = o;
    if (vibrato) {
      const l = c.createOscillator();
      const lg = c.createGain();
      l.frequency.value = 6;
      lg.gain.value = vibrato;
      l.connect(lg);
      lg.connect(o.frequency);
      l.start(t);
      l.stop(t + attack + dur + 0.05);
    }
    if (filter) {
      const f = c.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = filter;
      f.Q.value = q;
      o.connect(f);
      node = f;
    }
    const g = c.createGain();
    this.env(g, t, attack, gain, dur);
    node.connect(g);
    g.connect(out);
    o.start(t);
    o.stop(t + attack + dur + 0.05);
  }

  sample(name, gain = 1) {
    const b = this.buffers[name];
    if (!b) return false;
    const s = this.ctx.createBufferSource();
    s.buffer = b;
    const g = this.ctx.createGain();
    g.gain.value = gain;
    s.connect(g);
    g.connect(this.sfx);
    s.start();
    return true;
  }

  play(name, opts = {}) {
    if (!this.ctx || this.ctx.state !== 'running') return;
    if (this.sample(name)) return;
    const fn = SOUNDS[name];
    if (fn) fn(this, this.now, opts);
  }

  // ---------------------------------------------------------------- music
  startMusic(intensity = 0) {
    this.musicWanted = true;
    this.intensity = intensity;
    if (!this.ctx || this.musicOn) return;
    this.musicOn = true;
    this.nextNoteTime = this.now + 0.1;
    this.step = 0;
  }

  stopMusic() {
    this.musicWanted = false;
    this.musicOn = false;
  }

  duck(on) {
    if (!this.ctx || on === this.ducked) return;
    this.ducked = on;
    const target = this.cfg.audio.music * (on ? 0.25 : 1);
    this.music.gain.setTargetAtTime(target, this.now, on ? 0.04 : 0.25);
  }

  schedule() {
    if (!this.ctx || !this.musicOn || this.ctx.state !== 'running') return;
    const bpm = this.intensity > 0 ? 100 : 86;
    const sixteenth = 60 / bpm / 4;
    while (this.nextNoteTime < this.now + 0.12) {
      this.musicStep(this.step, this.nextNoteTime, sixteenth);
      this.nextNoteTime += sixteenth;
      this.step = (this.step + 1) % 64;
    }
  }

  musicStep(step, t, sx) {
    const out = this.music;
    const beat = step % 4 === 0;
    const bar = Math.floor(step / 16);
    const inBar = step % 16;
    // clock tick-tock on every beat
    if (beat) this.noise({ t, dur: 0.018, type: 'bandpass', freq: inBar % 8 === 0 ? 2600 : 2100, q: 6, gain: 0.07, out });
    // kick on 1 & 3, rim on 2 & 4
    if (inBar === 0 || inBar === 8) this.tone({ t, dur: 0.16, freq: 110, freqEnd: 42, gain: 0.32, out });
    if (inBar === 4 || inBar === 12) this.noise({ t, dur: 0.05, type: 'bandpass', freq: 1700, q: 2, gain: 0.07, out });
    // hats
    if (step % 2 === 0 || this.intensity > 0) this.noise({ t, dur: 0.02, type: 'highpass', freq: 7000, gain: this.intensity > 0 && step % 2 ? 0.015 : 0.025, out });
    // walking bass: Am7 – Fmaj7 – Dm7 – E7
    const roots = [55, 43.65, 36.71, 41.2];
    const pattern = [0, null, 0, 7, null, 10, 12, null, 0, null, 3, null, 7, null, 5, null];
    const n = pattern[inBar];
    if (n !== null && n !== undefined) {
      const f = roots[bar] * Math.pow(2, n / 12) * 2;
      this.tone({ t, dur: sx * 1.6, type: 'triangle', freq: f, gain: 0.16, filter: 420, attack: 0.01, out });
    }
    // dusty chord stab every bar
    if (inBar === 0 || inBar === 10) {
      const chords = [[220, 261.6, 329.6, 392], [174.6, 220, 261.6, 329.6], [146.8, 174.6, 220, 261.6], [164.8, 207.7, 246.9, 293.7]];
      for (const f of chords[bar]) this.tone({ t: t + Math.random() * 0.01, dur: inBar === 0 ? 0.9 : 0.3, type: 'sine', freq: f, gain: 0.025, attack: 0.02, out });
    }
  }

  // ---------------------------------------------------------------- game wiring
  onGameEvent(type, d, game) {
    if (!this.ctx) return;
    switch (type) {
      case 'letter': {
        const now = this.now;
        if (d.kind === 'rebel') this.play(d.smudged ? 'chalkSmudge' : 'chalkRebel', { golden: d.golden });
        else if (now - this.lastLetter > 0.08) this.play('chalkPunish');
        this.lastLetter = now;
        break;
      }
      case 'lineComplete':
        this.play(d.golden ? 'golden' : 'line', { streak: d.streak });
        break;
      case 'golden':
        this.play('shimmer');
        break;
      case 'cue':
        this.play(d.type);
        this.duck(true);
        break;
      case 'teacherState':
        if (d.to === 'READING') this.duck(false);
        if (d.to === 'LOOKING') this.duck(true);
        break;
      case 'fakeOut':
        this.play('pageFlip');
        break;
      case 'closeCall':
        this.play('closeCall');
        break;
      case 'caught':
        this.play('caught');
        setTimeout(() => this.play('slam'), 250);
        setTimeout(() => this.play('footsteps', { fast: true }), 450);
        setTimeout(() => this.play('eraser'), 860);
        setTimeout(() => this.play('strike'), 1420);
        break;
      case 'snitch':
        this.play('snitch');
        break;
      case 'chalkBreak':
        this.play('snap');
        break;
      case 'chalkRegrab':
        this.play('grab');
        break;
      case 'event':
        if (d.type === 'bear' && d.phase === 'start') this.play('bear');
        if (d.type === 'blackout' && d.phase === 'dark') this.play('powerDown');
        if (d.type === 'blackout' && d.phase === 'end') this.play('powerUp');
        if (d.type === 'principal' && d.phase === 'start') this.play('principal');
        if (d.type === 'fly' && d.phase === 'start') this.play('buzz');
        break;
      case 'airplaneSpawn':
        this.play('paper');
        break;
      case 'airplaneThrow':
        this.play('whoosh');
        break;
      case 'boardFull':
        this.play('fanfare');
        setTimeout(() => this.play('eraser', { long: true }), 600);
        break;
      case 'bell':
        this.play('bell');
        if (d.missed) setTimeout(() => this.play('strike'), 600);
        break;
      case 'punishComplete':
        this.play('tally');
        break;
      case 'dayCard':
        this.play('tear');
        this.startMusic(game.day.mode === 'walk' || game.day.overtime ? 1 : 0);
        this.duck(false);
        break;
      case 'gameOver':
        this.stopMusic();
        this.play('sadTrombone');
        break;
      case 'eoyWin':
        this.stopMusic();
        this.play('tada');
        break;
      case 'tick':
        this.play('tick');
        break;
    }
  }
}

// ---------------------------------------------------------------- the sound library
const SOUNDS = {
  chalkRebel(s, t, o) {
    s.noise({ t, dur: 0.05 + Math.random() * 0.03, freq: 2400 + Math.random() * 1600, q: 1.6, gain: 0.2 });
    s.noise({ t, dur: 0.012, type: 'highpass', freq: 5000, gain: 0.07 });
    if (o.golden) s.tone({ t, dur: 0.08, freq: 1800 + Math.random() * 600, gain: 0.025 });
  },
  chalkSmudge(s, t) {
    s.noise({ t, dur: 0.08, freq: 900, q: 0.8, gain: 0.14 });
  },
  chalkPunish(s, t) {
    s.noise({ t, dur: 0.07, freq: 1500 + Math.random() * 500, q: 1, gain: 0.06 });
  },
  line(s, t, o) {
    const base = 660 * Math.pow(2, Math.min(o.streak || 1, 6) / 12);
    s.noise({ t, dur: 0.03, type: 'highpass', freq: 3000, gain: 0.15 });
    s.noise({ t: t + 0.07, dur: 0.03, type: 'highpass', freq: 3000, gain: 0.15 });
    s.tone({ t: t + 0.02, dur: 0.12, type: 'triangle', freq: base, gain: 0.12 });
    s.tone({ t: t + 0.1, dur: 0.22, type: 'triangle', freq: base * 1.5, gain: 0.12 });
  },
  golden(s, t) {
    [784, 988, 1175, 1568].forEach((f, i) => s.tone({ t: t + i * 0.06, dur: 0.3, type: 'triangle', freq: f, gain: 0.1 }));
    SOUNDS.shimmer(s, t + 0.2);
  },
  shimmer(s, t) {
    [1568, 2093, 2637, 3136].forEach((f, i) => s.tone({ t: t + i * 0.04, dur: 0.5, freq: f, gain: 0.03 }));
  },
  rustle(s, t) {
    for (let i = 0; i < 7; i++) s.noise({ t: t + i * 0.05 + Math.random() * 0.03, dur: 0.06, type: 'highpass', freq: 2200 + Math.random() * 1500, q: 0.7, gain: 0.16 });
  },
  ahem(s, t) {
    s.tone({ t, dur: 0.16, type: 'sawtooth', freq: 155, freqEnd: 120, gain: 0.18, filter: 900, q: 3 });
    s.noise({ t, dur: 0.1, freq: 700, q: 2, gain: 0.08 });
    s.tone({ t: t + 0.2, dur: 0.24, type: 'sawtooth', freq: 128, freqEnd: 112, gain: 0.2, filter: 800, q: 3 });
  },
  cough(s, t) {
    for (const dt of [0, 0.2]) {
      s.noise({ t: t + dt, dur: 0.13, freq: 520, q: 1.3, gain: 0.38 });
      s.tone({ t: t + dt, dur: 0.08, type: 'sawtooth', freq: 190, freqEnd: 120, gain: 0.08, filter: 700 });
    }
  },
  hm(s, t) {
    s.tone({ t, dur: 0.24, type: 'sawtooth', freq: 130, freqEnd: 210, gain: 0.18, filter: 700, q: 4 });
  },
  hmm(s, t) {
    s.tone({ t, dur: 0.42, type: 'sawtooth', freq: 160, freqEnd: 132, gain: 0.16, filter: 650, q: 4, vibrato: 4 });
  },
  creak(s, t) {
    s.tone({ t, dur: 0.38, type: 'sawtooth', freq: 62, freqEnd: 84, gain: 0.12, filter: 1300, q: 9, vibrato: 18 });
  },
  footsteps(s, t, o) {
    const n = o.fast ? 4 : 2;
    const gap = o.fast ? 0.1 : 0.3;
    for (let i = 0; i < n; i++) {
      s.tone({ t: t + i * gap, dur: 0.1, freq: 95, freqEnd: 48, gain: o.fast ? 0.35 : 0.22 });
      s.noise({ t: t + i * gap, dur: 0.05, type: 'lowpass', freq: 500, gain: 0.12 });
    }
  },
  stopWalk(s, t) {
    s.tone({ t, dur: 0.1, freq: 90, freqEnd: 45, gain: 0.3 });
    s.noise({ t: t + 0.12, dur: 0.06, type: 'highpass', freq: 3000, gain: 0.08 });
  },
  lower(s, t) {
    s.noise({ t, dur: 0.2, type: 'highpass', freq: 1800, freqEnd: 900, q: 0.6, gain: 0.08 });
  },
  pageFlip(s, t) {
    s.noise({ t, dur: 0.18, type: 'bandpass', freq: 3000, freqEnd: 1200, q: 0.8, gain: 0.16 });
  },
  slam(s, t) {
    s.tone({ t, dur: 0.4, freq: 78, freqEnd: 34, gain: 0.7 });
    s.noise({ t, dur: 0.22, type: 'lowpass', freq: 1000, gain: 0.5 });
    s.noise({ t, dur: 0.08, freq: 260, q: 4, gain: 0.4 });
  },
  caught(s, t) {
    s.tone({ t, dur: 0.55, type: 'sawtooth', freq: 233, freqEnd: 220, gain: 0.12, filter: 1800 });
    s.tone({ t, dur: 0.55, type: 'sawtooth', freq: 247, freqEnd: 233, gain: 0.12, filter: 1800 });
    s.tone({ t, dur: 0.5, type: 'square', freq: 117, gain: 0.08, filter: 600 });
  },
  eraser(s, t, o) {
    const n = o.long ? 7 : 4;
    for (let i = 0; i < n; i++) s.noise({ t: t + i * 0.12, dur: 0.14, freq: 900 - i * 60, freqEnd: 380, q: 0.8, gain: 0.26 });
  },
  strike(s, t) {
    s.tone({ t, dur: 0.32, type: 'square', freq: 104, gain: 0.12, filter: 700 });
    s.noise({ t, dur: 0.12, freq: 2600, q: 1.4, gain: 0.18 });
    s.noise({ t: t + 0.12, dur: 0.12, freq: 2600, q: 1.4, gain: 0.18 });
  },
  closeCall(s, t) {
    SOUNDS.heartbeat(s, t);
    s.noise({ t, dur: 0.3, freq: 400, freqEnd: 2400, q: 1, gain: 0.2 });
    s.tone({ t: t + 0.05, dur: 0.45, freq: 1318.5, gain: 0.1 });
    s.tone({ t: t + 0.12, dur: 0.5, freq: 1760, gain: 0.09 });
  },
  heartbeat(s, t) {
    s.tone({ t, dur: 0.14, freq: 62, freqEnd: 40, gain: 0.75 });
    s.tone({ t: t + 0.2, dur: 0.16, freq: 55, freqEnd: 36, gain: 0.6 });
  },
  snap(s, t) {
    s.noise({ t, dur: 0.03, type: 'highpass', freq: 3200, gain: 0.5 });
    s.tone({ t, dur: 0.02, type: 'square', freq: 2400, gain: 0.1 });
    s.noise({ t: t + 0.05, dur: 0.04, type: 'highpass', freq: 2600, gain: 0.35 });
  },
  grab(s, t) {
    s.noise({ t, dur: 0.04, type: 'highpass', freq: 2000, gain: 0.12 });
  },
  bell(s, t) {
    const c = s.ctx;
    const g = c.createGain();
    const am = c.createOscillator();
    const amg = c.createGain();
    am.frequency.value = 26;
    amg.gain.value = 0.5;
    am.connect(amg);
    amg.connect(g.gain);
    g.gain.setValueAtTime(0.5, t);
    g.gain.setTargetAtTime(0, t + 1.1, 0.15);
    g.connect(s.sfx);
    for (const f of [1250, 2650, 3900]) {
      const o = c.createOscillator();
      o.frequency.value = f;
      const og = c.createGain();
      og.gain.value = f === 1250 ? 0.14 : 0.06;
      o.connect(og);
      og.connect(g);
      o.start(t);
      o.stop(t + 1.6);
    }
    am.start(t);
    am.stop(t + 1.6);
  },
  tally(s, t) {
    s.noise({ t, dur: 0.05, freq: 2000, q: 1.5, gain: 0.12 });
    s.tone({ t: t + 0.02, dur: 0.1, type: 'triangle', freq: 523, gain: 0.06 });
  },
  tick(s, t) {
    s.noise({ t, dur: 0.02, freq: 2800, q: 8, gain: 0.25 });
  },
  tada(s, t) {
    [523.3, 659.3, 784, 1046.5].forEach((f, i) => s.tone({ t: t + i * 0.12, dur: i === 3 ? 0.9 : 0.2, type: 'triangle', freq: f, gain: 0.18 }));
    [1046.5, 1318.5, 1568].forEach((f) => s.tone({ t: t + 0.36, dur: 1.0, freq: f, gain: 0.06 }));
  },
  fanfare(s, t) {
    [392, 523.3, 659.3, 784].forEach((f, i) => s.tone({ t: t + i * 0.08, dur: 0.25, type: 'triangle', freq: f, gain: 0.14 }));
  },
  unlock(s, t) {
    SOUNDS.tada(s, t);
    SOUNDS.shimmer(s, t + 0.5);
  },
  sadTrombone(s, t) {
    [[311, 293], [293, 277], [277, 262], [262, 233]].forEach(([a, b], i) =>
      s.tone({ t: t + i * 0.42, dur: i === 3 ? 0.9 : 0.36, type: 'sawtooth', freq: a, freqEnd: b, gain: 0.13, filter: 1100, vibrato: i === 3 ? 7 : 0 }),
    );
  },
  bear(s, t) {
    s.tone({ t, dur: 0.08, type: 'square', freq: 760, freqEnd: 1040, gain: 0.07, filter: 2500 });
    s.tone({ t: t + 0.14, dur: 0.1, type: 'square', freq: 820, freqEnd: 1100, gain: 0.07, filter: 2500 });
  },
  snitch(s, t) {
    s.tone({ t, dur: 0.12, type: 'square', freq: 980, freqEnd: 760, gain: 0.1, filter: 2400 });
    s.tone({ t: t + 0.15, dur: 0.22, type: 'square', freq: 1040, freqEnd: 700, gain: 0.1, filter: 2400 });
  },
  powerDown(s, t) {
    s.noise({ t, dur: 0.02, type: 'highpass', freq: 3000, gain: 0.3 });
    s.tone({ t, dur: 0.6, type: 'sawtooth', freq: 120, freqEnd: 30, gain: 0.12, filter: 400 });
  },
  powerUp(s, t) {
    s.noise({ t, dur: 0.02, type: 'highpass', freq: 3000, gain: 0.3 });
    s.tone({ t, dur: 0.35, type: 'sawtooth', freq: 40, freqEnd: 120, gain: 0.08, filter: 400 });
  },
  principal(s, t) {
    for (let i = 0; i < 7; i++) {
      s.tone({ t: t + i * 0.7, dur: 0.16, freq: 70, freqEnd: 38, gain: 0.3 });
      s.noise({ t: t + i * 0.7, dur: 0.06, type: 'lowpass', freq: 400, gain: 0.15 });
    }
  },
  buzz(s, t) {
    s.tone({ t, dur: 1.2, type: 'sawtooth', freq: 210, freqEnd: 240, gain: 0.04, filter: 800, q: 3, vibrato: 25 });
  },
  paper(s, t) {
    s.noise({ t, dur: 0.12, type: 'bandpass', freq: 2500, q: 1, gain: 0.12 });
    s.tone({ t: t + 0.05, dur: 0.15, type: 'triangle', freq: 880, freqEnd: 1320, gain: 0.06 });
  },
  whoosh(s, t) {
    s.noise({ t, dur: 0.8, freq: 500, freqEnd: 1800, q: 1.2, gain: 0.22 });
  },
  tear(s, t) {
    for (let i = 0; i < 6; i++) s.noise({ t: t + i * 0.035, dur: 0.05, type: 'highpass', freq: 1400 + Math.random() * 1500, gain: 0.14 });
  },
  click(s, t) {
    s.tone({ t, dur: 0.05, type: 'triangle', freq: 880, gain: 0.1 });
    s.tone({ t: t + 0.03, dur: 0.06, type: 'triangle', freq: 1320, gain: 0.07 });
  },
};
