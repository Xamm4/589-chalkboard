// The Regulator: pure state machine (no rendering), shared by the game and the balance sim.
//
//   READING → TELL → LOOKING → RETURNING → READING
//   READING → FAKE_TELL → READING
//   any → DISTRACTED (paper airplane) → RETURNING
//
// LOOKING starts with a head turn (`turn` seconds). He can only see once the turn is done;
// the game then applies the grace window before a hold counts as caught.

export const T = {
  READING: 'READING',
  TELL: 'TELL',
  FAKE_TELL: 'FAKE_TELL',
  LOOKING: 'LOOKING',
  RETURNING: 'RETURNING',
  DISTRACTED: 'DISTRACTED',
};

export class Teacher {
  constructor(rng, emit = () => {}) {
    this.rng = rng;
    this.emit = emit;
    this.p = null;
    this.alert = false; // principal nearby → shorter reads
    this.state = T.READING;
    this.t = 0;
    this.dur = 1;
    this.turn = 0;
    this.snap = false;
    this.forced = false; // look forced by the snitch bear
    this.cuesFired = 0;
    this.seeingFired = false;
    this.lookCount = 0;
  }

  setDay(params, extraRead = 0) {
    this.p = params;
    this.alert = false;
    this.enter(T.READING, this.rng.range(params.read) + params.firstRead + extraRead);
  }

  enter(state, dur) {
    const from = this.state;
    this.state = state;
    this.t = 0;
    this.dur = Math.max(0.01, dur);
    this.cuesFired = 0;
    this.seeingFired = false;
    if (state !== T.LOOKING) this.forced = false;
    if (state !== T.TELL && state !== T.LOOKING) this.snap = false;
    if (state === T.TELL || state === T.FAKE_TELL) this.throatCue = this.rng.chance(0.5) ? 'ahem' : 'cough';
    this.emit('teacherState', { from, to: state, snap: this.snap, forced: this.forced });
  }

  nextRead(multi = false) {
    const p = this.p;
    let d = multi ? this.rng.range(p.multiPeekRead) : this.rng.range(p.read);
    if (this.alert) d *= this.alertScale || 0.55;
    return d;
  }

  // Seconds of tell left before he can see (used by bots and the HUD).
  get timeToSeeing() {
    if (this.state === T.TELL) return this.dur - this.t + this.turnFor();
    if (this.state === T.LOOKING) return Math.max(0, this.turn - this.t);
    return Infinity;
  }

  turnFor() {
    return this.p ? this.p.turn : 0.3;
  }

  get seeing() {
    return this.state === T.LOOKING && this.t >= this.turn;
  }

  get sinceSeeing() {
    return this.seeing ? this.t - this.turn : -1;
  }

  // 0..1 progress of the visible tell (for HUD eye + newspaper animation).
  get tellProgress() {
    if (this.state === T.TELL || this.state === T.FAKE_TELL) return Math.min(1, this.t / this.dur);
    return 0;
  }

  get isTelling() {
    return this.state === T.TELL || this.state === T.FAKE_TELL;
  }

  // Snitch bear: he whips around almost instantly.
  forceLook(turn) {
    if (this.state === T.LOOKING || this.state === T.DISTRACTED) return false;
    this.forced = true;
    this.snap = false;
    this.turn = turn;
    this.enter(T.LOOKING, turn + this.rng.range(this.p.look));
    this.forced = true;
    this.lookCount++;
    this.emit('lookStart', { forced: true });
    return true;
  }

  distract(dur) {
    this.enter(T.DISTRACTED, dur);
  }

  setAlert(on, scale) {
    this.alert = on;
    this.alertScale = scale;
    if (on && this.state === T.READING) {
      const left = this.dur - this.t;
      const cap = this.rng.range(this.p.read) * scale;
      if (left > cap) this.dur = this.t + cap;
    }
  }

  update(dt) {
    const p = this.p;
    if (!p) return;
    this.t += dt;

    if (this.state === T.TELL || this.state === T.FAKE_TELL) this.fireCues();

    if (this.state === T.LOOKING && !this.seeingFired && this.t >= this.turn) {
      this.seeingFired = true;
      this.emit('seeing', { forced: this.forced, snap: this.snap });
    }

    if (this.t < this.dur) return;

    switch (this.state) {
      case T.READING: {
        if (this.rng.chance(p.snap)) {
          this.snap = true;
          this.enter(T.TELL, p.snapTell);
        } else if (this.rng.chance(p.fake)) {
          this.enter(T.FAKE_TELL, p.tell);
        } else {
          this.enter(T.TELL, p.tell);
        }
        break;
      }
      case T.TELL: {
        const snap = this.snap;
        this.turn = snap ? Math.min(p.turn, 0.16) : p.turn;
        this.enter(T.LOOKING, this.turn + this.rng.range(p.look));
        this.snap = snap;
        this.lookCount++;
        this.emit('lookStart', { forced: false, snap });
        break;
      }
      case T.FAKE_TELL:
        this.emit('fakeOut', {});
        this.enter(T.READING, this.nextRead());
        break;
      case T.LOOKING:
        this.emit('lookEnd', {});
        this.enter(T.RETURNING, p.ret);
        break;
      case T.DISTRACTED:
        this.enter(T.RETURNING, p.ret);
        break;
      case T.RETURNING:
        this.enter(T.READING, this.nextRead(this.rng.chance(p.multiPeek)));
        break;
    }
  }

  fireCues() {
    const p = this.p;
    const f = this.t / this.dur;
    let cues;
    if (this.snap) cues = [[0, 'hm']];
    else if (p.tellStyle === 'walk') cues = [[0, 'stopWalk'], [0.3, 'hmm'], [0.55, 'lower']];
    else if (p.tellStyle === 'sneaky') cues = [[0, 'creak'], [0.25, 'footsteps'], [0.55, 'lower']];
    else cues = [[0, 'rustle'], [0.3, this.throatCue], [0.5, 'lower']];
    while (this.cuesFired < cues.length && f >= cues[this.cuesFired][0]) {
      this.emit('cue', { type: cues[this.cuesFired][1], fake: this.state === T.FAKE_TELL });
      this.cuesFired++;
    }
  }
}
