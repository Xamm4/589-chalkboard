// Classroom events (Wednesday+): snitch bear, chalk breaks, blackouts, principal walk-by,
// FUD fly, and the paper airplane power-up. Pure logic; the renderer reads the state.

import { T } from './teacher.js';

export class Events {
  constructor(cfg, rng, emit, game) {
    this.cfg = cfg;
    this.ec = cfg.events;
    this.rng = rng;
    this.emit = emit;
    this.game = game;
    this.airplane = { state: 'none', t: 0 };
    this.seen = new Set(); // event types already introduced this run
    this.reset();
  }

  reset() {
    this.t = 0;
    this.queue = [];
    this.bear = null;
    this.blackout = null;
    this.lightsGraceT = 0;
    this.principal = null;
    this.fly = null;
    this.chalkPending = false;
    this.airplaneSpawnAt = -1;
  }

  setDay(day) {
    this.reset();
    this.day = day;
    const [m0, m1] = this.ec.margin;
    const span = day.duration - m0 - m1;
    const n = day.events;
    if (n > 0 && day.eventPool.length) {
      const pool = [...day.eventPool];
      // Fisher-Yates so every event shows up before any repeats.
      for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(this.rng.next() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
      }
      const picks = [];
      for (let i = 0; i < n; i++) {
        let type = pool[i % pool.length];
        if (type === 'blackout' && picks.includes('blackout')) type = 'bear';
        picks.push(type);
      }
      const seg = span / n;
      for (let i = 0; i < n; i++) {
        const lo = m0 + seg * i + (i ? this.ec.spacing * 0.3 : 0);
        const hi = m0 + seg * (i + 1) - this.ec.spacing * 0.3;
        this.queue.push({ time: this.rng.range(lo, Math.max(lo + 0.1, hi)), type: picks[i] });
      }
    }
    if (day.airplane && this.airplane.state === 'none') {
      this.airplaneSpawnAt = day.duration * this.rng.range(this.ec.airplane.spawnWindow);
    }
  }

  get lightsOut() {
    return !!this.blackout && this.blackout.phase !== 'flicker';
  }

  // Can the teacher currently see the board at all?
  get blind() {
    return this.lightsOut || this.lightsGraceT > 0;
  }

  flyOnLine(line) {
    return !!(this.fly && line && this.fly.row === line.row && this.fly.phase === 'landed');
  }

  intro(type) {
    const first = !this.seen.has(type);
    this.seen.add(type);
    return first;
  }

  start(type) {
    const g = this.game;
    switch (type) {
      case 'bear':
        if (this.bear) return false;
        this.bear = { phase: 'raise', t: 0 };
        break;
      case 'blackout':
        if (this.blackout) return false;
        this.blackout = { phase: 'flicker', t: 0 };
        break;
      case 'principal':
        if (this.principal) return false;
        this.principal = { t: 0, dur: this.ec.principal.dur };
        g.teacher.setAlert(true, this.ec.principal.readScale);
        break;
      case 'fly': {
        if (this.fly) return false;
        const row = g.board.currentRow;
        if (row >= g.board.rows) return false;
        this.fly = { phase: 'incoming', t: 0, row, x: this.rng.range(0.25, 0.85) };
        break;
      }
      case 'chalk':
        this.chalkPending = true;
        return true; // announced when it actually snaps
    }
    this.emit('event', { type, phase: 'start', first: this.intro(type) });
    return true;
  }

  update(dt) {
    const g = this.game;
    this.t += dt;

    // Scheduled events (retry a little later if the slot is busy).
    for (const ev of this.queue) {
      if (!ev.done && this.t >= ev.time) {
        ev.done = this.start(ev.type);
        if (!ev.done) ev.time += 1.5;
      }
    }

    if (this.airplaneSpawnAt >= 0 && this.t >= this.airplaneSpawnAt && this.airplane.state === 'none') {
      this.airplaneSpawnAt = -1;
      this.airplane = { state: 'ready', t: 0 };
      g.airplaneHeld = true;
      this.emit('airplaneSpawn', { first: this.intro('airplane') });
    }
    if (this.airplane.state !== 'none') {
      this.airplane.t += dt;
      if (this.airplane.state === 'flying' && this.airplane.t > 1.8) this.airplane = { state: 'none', t: 0 };
    }

    if (this.lightsGraceT > 0) this.lightsGraceT -= dt;

    if (this.bear) this.updateBear(dt);
    if (this.blackout) this.updateBlackout(dt);
    if (this.principal) {
      this.principal.t += dt;
      if (this.principal.t >= this.principal.dur) {
        this.principal = null;
        g.teacher.setAlert(false);
        this.emit('event', { type: 'principal', phase: 'end' });
      }
    }
    if (this.fly) this.updateFly(dt);

    if (this.chalkPending && g.isWritingRebel) {
      this.chalkPending = false;
      g.breakChalk();
      this.emit('event', { type: 'chalk', phase: 'start', first: this.intro('chalk') });
    }
  }

  updateBear(dt) {
    const b = this.bear;
    const c = this.ec.bear;
    const g = this.game;
    b.t += dt;
    if (b.phase === 'raise' && b.t >= c.raise) {
      b.phase = 'up';
      b.t = 0;
      this.emit('event', { type: 'bear', phase: 'up' });
    } else if (b.phase === 'up') {
      const tch = g.teacher;
      const canSnitch = tch.state !== T.LOOKING && tch.state !== T.DISTRACTED && !this.lightsOut;
      if (b.t >= c.reactGrace && g.isHoldingRebel && canSnitch) {
        b.phase = 'snitch';
        b.t = 0;
        this.emit('snitch', {});
        tch.forceLook(c.snitchTurn);
      } else if (b.t >= c.up) {
        b.phase = 'down';
        b.t = 0;
      }
    } else if (b.phase === 'snitch' && b.t >= 1.0) {
      b.phase = 'down';
      b.t = 0;
    } else if (b.phase === 'down' && b.t >= c.down) {
      this.bear = null;
    }
  }

  updateBlackout(dt) {
    const b = this.blackout;
    const c = this.ec.blackout;
    b.t += dt;
    if (b.phase === 'flicker' && b.t >= c.flicker) {
      b.phase = 'dark';
      b.t = 0;
      this.emit('event', { type: 'blackout', phase: 'dark' });
    } else if (b.phase === 'dark' && b.t >= c.dur - c.warn) {
      b.phase = 'warn';
      b.t = 0;
      this.emit('event', { type: 'blackout', phase: 'warn' });
    } else if (b.phase === 'warn' && b.t >= c.warn) {
      this.blackout = null;
      this.lightsGraceT = this.cfg.timing.lightsGrace;
      this.emit('event', { type: 'blackout', phase: 'end' });
    }
  }

  updateFly(dt) {
    const f = this.fly;
    f.t += dt;
    if (f.phase === 'incoming' && f.t >= 0.6) {
      f.phase = 'landed';
      f.t = 0;
      this.emit('event', { type: 'fly', phase: 'landed' });
    } else if (f.phase === 'landed' && f.t >= this.ec.fly.dur) {
      f.phase = 'leaving';
      f.t = 0;
    } else if (f.phase === 'leaving' && f.t >= 0.6) {
      this.fly = null;
    }
  }

  throwAirplane() {
    const g = this.game;
    if (this.airplane.state !== 'ready') return false;
    this.airplane = { state: 'flying', t: 0 };
    g.airplaneHeld = false;
    g.teacher.distract(this.ec.airplane.distract);
    if (this.bear && this.bear.phase !== 'down') this.bear = { phase: 'down', t: 0 };
    this.emit('airplaneThrow', {});
    return true;
  }

  endDay() {
    if (this.principal) this.game.teacher.setAlert(false);
    this.bear = null;
    this.blackout = null;
    this.principal = null;
    this.fly = null;
    this.chalkPending = false;
    this.lightsGraceT = 0;
    this.queue = [];
    this.airplaneSpawnAt = -1;
    if (this.airplane.state === 'flying') this.airplane = { state: 'none', t: 0 };
  }
}
