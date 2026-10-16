// A human-ish bot for the balance simulation (tests/balance.mjs).
//
// Humans don't lose this game on raw reaction time; they lose it on attention (eyes on the
// chalk, not on the teacher) and greed (milking the tell for one more letter). So the bot has:
//   rt         reaction time once a signal is noticed
//   attention  chance to notice a tell the moment it starts (otherwise: noticed late)
//   greed      chance to deliberately hold through a tell and release "just in time"
//   margin     how early a greedy release is planned before he can see
//   timing     relative error when estimating how long the tell has left

import { RNG } from '../src/rng.js';
import { T } from '../src/teacher.js';
import { PHASE } from '../src/game.js';

export class Bot {
  static seq = 0;

  constructor(game, opts = {}) {
    this.g = game;
    this.rt = opts.rt ?? 0.25;
    this.attention = opts.attention ?? 0.85;
    this.greed = opts.greed ?? 0.4;
    this.margin = opts.margin ?? 0.2;
    this.timing = opts.timing ?? 0.14;
    this.rng = new RNG(opts.seed ?? 1);
    this.holding = false;
    this.t = 0;
    this.threat = null; // { key, releaseAt }
    this.pressAt = -1;
  }

  gauss() {
    const u = Math.max(1e-6, this.rng.next());
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * this.rng.next());
  }

  react(mult = 1) {
    return Math.max(0.09, this.rt * mult * (1 + 0.25 * this.gauss()));
  }

  // Current danger, if any: a key identifying it, how salient it is, and when he'll see.
  danger() {
    const g = this.g;
    const tch = g.teacher;
    const ev = g.events;
    if (ev.lightsOut || tch.state === T.DISTRACTED) return null;
    if (ev.bear && (ev.bear.phase === 'raise' || ev.bear.phase === 'up' || ev.bear.phase === 'snitch')) {
      ev.bear.botId ??= ++Bot.seq;
      return { key: `bear${ev.bear.botId}`, notice: this.attention * 0.9, lateSpan: 1.4, eta: Infinity, greedy: false };
    }
    if (tch.state === T.TELL || tch.state === T.FAKE_TELL) {
      const sneaky = g.day.tellStyle === 'sneaky' && !tch.snap;
      return {
        key: `look${tch.lookCount}:${tch.state === T.FAKE_TELL ? 'f' : 't'}${Math.round(g.time - tch.t)}`,
        notice: this.attention * (tch.snap ? 0.85 : sneaky ? 0.8 : 1),
        lateSpan: (tch.dur + tch.turnFor()) * 1.15,
        eta: tch.dur - tch.t + (tch.snap ? Math.min(tch.turnFor(), 0.16) : tch.turnFor()),
        greedy: !tch.snap,
      };
    }
    if (tch.state === T.LOOKING) {
      // The head turn is big and obvious, but you're staring at your chalk: peripheral vision only.
      return { key: `look${tch.lookCount}:l`, notice: 0.75, lateSpan: tch.turn + 0.6, eta: Math.max(0, tch.turn - tch.t), greedy: false, mult: 1.25 };
    }
    return null;
  }

  wantsToWrite() {
    const g = this.g;
    if (g.phase !== PHASE.PLAY) return false;
    if (g.chalk === 'broken') return false;
    if (g.events.lightsOut || g.teacher.state === T.DISTRACTED) return true;
    if (g.teacher.state !== T.READING) return false;
    const punishLeft = Math.max(0, g.quota - g.punishToday);
    if (punishLeft > 0) {
      const lineTime = g.cfg.text.punish.length / g.cfg.write.punishLps;
      const need = punishLeft * lineTime - g.board.punish.progress / g.cfg.write.punishLps;
      if (need > g.dayLeft * 0.45) return false;
    }
    return true;
  }

  step(dt) {
    const g = this.g;
    this.t += dt;
    const d = this.danger();

    if (d && (!this.threat || this.threat.key !== d.key)) {
      // A new threat: when do we notice it, and when do we let go?
      // Busy classroom (bear, fly, principal, blackout flicker...) → easier to miss things.
      const busy = g.events.bear || g.events.fly || g.events.principal || g.events.blackout;
      const notice = d.notice * (busy ? 0.85 : 1);
      const noticed = this.rng.chance(notice) ? 0 : this.rng.range(0.25, 1) * d.lateSpan;
      let releaseAt = this.t + noticed + this.react(d.mult || 1);
      if (d.greedy && noticed === 0 && this.rng.chance(this.greed) && Number.isFinite(d.eta)) {
        const est = d.eta * (1 + this.timing * this.gauss());
        releaseAt = Math.max(releaseAt, this.t + est - this.margin);
      }
      const line = g.board.current;
      const useAirplane = g.events.airplane.state === 'ready' && line && line.progress / line.text.length > 0.45 && d.eta > this.rt + 0.1;
      // A threat that escalates (tell → look) never pushes an earlier plan later.
      if (this.threat) releaseAt = Math.min(releaseAt, this.threat.releaseAt);
      this.threat = { key: d.key, releaseAt, airplane: useAirplane ? this.t + noticed + this.react() : -1 };
    }
    if (!d) this.threat = null;

    if (this.threat && this.holding) {
      if (this.threat.airplane >= 0 && this.t >= this.threat.airplane) {
        g.throwAirplane();
        this.threat = null;
      } else if (this.t >= this.threat.releaseAt) {
        this.holding = false;
        this.pressAt = -1;
      }
    }

    if (!this.threat) {
      const want = this.wantsToWrite();
      if (want && !this.holding) {
        if (this.pressAt < 0) this.pressAt = this.t + this.react(1.1);
        if (this.t >= this.pressAt) {
          this.holding = true;
          this.pressAt = -1;
        }
      } else if (!want && this.holding) {
        this.holding = false; // chalk snapped, quota panic, day over
      } else if (!want) {
        this.pressAt = -1;
      }
    }
    return this.holding;
  }
}
