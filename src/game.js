// Game simulation. DOM-free: the browser build and the headless balance sim both drive it
// with update(dt, { holding }). Everything visible or audible is announced via emit().

import { CONFIG } from './config.js';
import { RNG } from './rng.js';
import { Teacher, T } from './teacher.js';
import { Board } from './writing.js';
import { Events } from './events.js';

export const PHASE = {
  IDLE: 'idle', // title screen ambience
  CARD: 'card', // "next day" calendar card
  PLAY: 'play',
  CAUGHT: 'caught',
  DAY_END: 'dayEnd',
  OVER: 'over',
  WIN: 'win',
  RESULTS: 'results',
};

export function dayParams(cfg, index) {
  const days = cfg.days;
  if (index < days.length) return { ...days[index], index, overtime: 0 };
  const k = index - days.length + 1;
  const f = days[days.length - 2]; // Friday is the template
  const o = cfg.overtime;
  const rs = Math.pow(o.readScale, k);
  return {
    ...f,
    id: `ot${k}`,
    name: `OVERTIME ${k}`,
    mood: 'Unhinged',
    blurb: 'No bell can save you now. Endless detention.',
    duration: o.duration,
    quota: o.quota,
    read: [Math.max(o.minRead[0], f.read[0] * rs), Math.max(o.minRead[1], f.read[1] * rs)],
    tell: Math.max(o.minTell, f.tell * Math.pow(o.tellScale, k)),
    fake: Math.min(o.maxFake, f.fake + o.fakeAdd * k),
    events: 4,
    eventPool: ['bear', 'chalk', 'blackout', 'fly', 'principal'],
    airplane: true,
    mode: k % 2 ? 'walk' : 'desk',
    tellStyle: k % 2 ? 'walk' : 'obvious',
    index,
    overtime: k,
  };
}

export function dayLabel(cfg, index) {
  if (index < cfg.days.length) {
    const d = cfg.days[index];
    return d.id === 'eoy' ? 'EOY' : d.name[0] + d.name.slice(1).toLowerCase();
  }
  return `Overtime ${index - cfg.days.length + 1}`;
}

export class Game {
  constructor(opts = {}) {
    this.cfg = opts.config || CONFIG;
    this.listeners = [];
    this.invincible = false;
    this.time = 0;
    this.wasHolding = false;
    this.holding = false;
    this.paused = false;
    this.setupIdle(opts.seed ?? 589);
  }

  on(fn) {
    this.listeners.push(fn);
    return () => (this.listeners = this.listeners.filter((f) => f !== fn));
  }

  emit(type, data = {}) {
    for (const fn of this.listeners) fn(type, data, this);
  }

  // Title-screen ambience: a few lines already on the board, the Regulator reading.
  setupIdle(seed) {
    this.makeWorld(seed);
    this.phase = PHASE.IDLE;
    this.board.seed(3);
    this.day = dayParams(this.cfg, 0);
    this.teacher.setDay(this.day);
  }

  makeWorld(seed) {
    this.seed = seed >>> 0;
    this.rng = new RNG(this.seed);
    const emit = (t, d) => this.emit(t, d);
    this.teacher = new Teacher(this.rng.fork('teacher'), (t, d) => this.onTeacher(t, d));
    this.board = new Board(this.cfg, this.rng.fork('board'));
    this.events = new Events(this.cfg, this.rng.fork('events'), emit, this);
    this.score = 0;
    this.lines = 0;
    this.streak = 0;
    this.bestStreak = 0;
    this.closeCalls = 0;
    this.strikes = 0;
    this.goldenLines = 0;
    this.letters = 0;
    this.punishLines = 0;
    this.boardsFilled = 0;
    this.dayIndex = 0;
    this.dayTime = 0;
    this.punishToday = 0;
    this.phaseT = 0;
    this.chalk = 'ok'; // ok | broken | regrabPending | regrab
    this.regrabT = 0;
    this.airplaneHeld = false;
    this.overtime = false;
    this.won = false;
    this.erasing = null; // line being erased during CAUGHT (renderer animates it)
    this.caughtReason = null;
    this.holdStart = -1;
    this.lastRebelRelease = -10;
    this.lastRebelHold = 0;
    this.closeCallLook = -1;
    this.caughtLook = -1;
  }

  start({ seed = (Math.random() * 2 ** 32) >>> 0, day = 0 } = {}) {
    this.makeWorld(seed);
    this.dayIndex = day;
    this.emit('runStart', { seed: this.seed });
    this.beginCard();
  }

  startOvertime() {
    this.overtime = true;
    this.strikes = 0;
    this.dayIndex = this.cfg.days.length;
    this.emit('overtimeStart', {});
    this.beginCard();
  }

  beginCard() {
    this.phase = PHASE.CARD;
    this.phaseT = 0;
    this.day = dayParams(this.cfg, this.dayIndex);
    this.punishToday = 0;
    this.dayTime = 0;
    this.chalk = 'ok';
    this.teacher.setDay(this.day);
    this.emit('dayCard', { day: this.day });
  }

  beginPlay() {
    this.phase = PHASE.PLAY;
    this.phaseT = 0;
    this.teacher.setDay(this.day);
    this.events.setDay(this.day);
    this.emit('dayStart', { day: this.day });
  }

  get isHoldingRebel() {
    return this.holding && this.chalk !== 'broken' && this.chalk !== 'regrabPending';
  }

  get isWritingRebel() {
    return this.holding && this.chalk === 'ok';
  }

  get blind() {
    return this.events.blind || this.teacher.state === T.DISTRACTED;
  }

  get quota() {
    return this.day ? this.day.quota : 0;
  }

  get dayLeft() {
    return this.day ? Math.max(0, this.day.duration - this.dayTime) : 0;
  }

  onTeacher(type, data) {
    if (type === 'seeing' && this.phase === PHASE.PLAY) {
      // Released just before he finished turning → close call.
      const since = this.time - this.lastRebelRelease;
      if (!this.holding && since <= this.cfg.timing.closeCall && this.lastRebelHold >= this.cfg.timing.minHoldForCloseCall && !this.blind) {
        this.closeCall();
      }
    }
    this.emit(type, data);
  }

  onPress() {
    this.holdStart = this.time;
    if (this.chalk === 'regrabPending') {
      this.chalk = 'regrab';
      this.regrabT = this.cfg.write.chalkRegrab;
      this.emit('chalkRegrab', {});
    }
    this.emit('press', {});
  }

  onRelease() {
    const wasRebel = this.chalk === 'ok' || this.chalk === 'regrab';
    if (wasRebel && this.phase === PHASE.PLAY) {
      this.lastRebelRelease = this.time;
      this.lastRebelHold = this.time - this.holdStart;
      // Released inside the grace window: he saw a blur, not a crime.
      const tch = this.teacher;
      if (tch.seeing && tch.sinceSeeing < this.cfg.timing.grace && this.lastRebelHold >= this.cfg.timing.minHoldForCloseCall && !this.blind) {
        this.closeCall();
      }
    }
    if (this.chalk === 'broken') this.chalk = 'regrabPending';
    if (this.chalk === 'regrab') this.chalk = 'ok';
    this.emit('release', {});
  }

  closeCall() {
    if (this.closeCallLook === this.teacher.lookCount) return;
    this.closeCallLook = this.teacher.lookCount;
    this.closeCalls++;
    this.score += this.cfg.score.closeCall;
    this.emit('closeCall', { points: this.cfg.score.closeCall });
  }

  breakChalk() {
    this.chalk = 'broken';
    this.emit('chalkBreak', {});
  }

  throwAirplane() {
    if (this.phase !== PHASE.PLAY) return false;
    return this.events.throwAirplane();
  }

  update(dt, input = {}) {
    if (this.paused) return;
    this.time += dt;
    this.holding = !!input.holding;
    if (this.holding && !this.wasHolding) this.onPress();
    if (!this.holding && this.wasHolding) this.onRelease();
    this.wasHolding = this.holding;
    this.phaseT += dt;

    switch (this.phase) {
      case PHASE.IDLE:
        this.teacher.update(dt);
        break;
      case PHASE.CARD:
        if (this.phaseT >= this.cfg.timing.dayCard) this.beginPlay();
        break;
      case PHASE.PLAY:
        this.updatePlay(dt);
        break;
      case PHASE.CAUGHT:
        this.updateCaught(dt);
        break;
      case PHASE.DAY_END:
        if (this.phaseT >= this.cfg.timing.dayEnd) {
          if (this.strikes >= this.cfg.strikes) this.gameOver();
          else if (!this.overtime && this.dayIndex === this.cfg.days.length - 1) this.win();
          else {
            this.dayIndex++;
            this.beginCard();
          }
        }
        break;
      case PHASE.OVER:
        if (this.phaseT >= this.cfg.timing.gameOver) this.toResults();
        break;
      case PHASE.WIN:
        if (this.phaseT >= this.cfg.timing.eoyWin) this.toResults();
        break;
    }
  }

  updatePlay(dt) {
    this.dayTime += dt;
    this.teacher.update(dt);
    this.events.update(dt);

    if (this.holding) {
      if (this.chalk === 'regrab') {
        this.regrabT -= dt;
        if (this.regrabT <= 0) this.chalk = 'ok';
      }
      if (this.chalk === 'ok') this.writeRebel(dt);
    } else {
      this.writePunish(dt);
    }

    const tch = this.teacher;
    if (this.isHoldingRebel && tch.seeing && tch.sinceSeeing >= this.cfg.timing.grace && !this.blind && !this.invincible) {
      this.caught(tch.forced ? 'snitch' : 'look');
      return;
    }

    if (this.dayTime >= this.day.duration) this.endDay();
  }

  ensureLine() {
    if (this.board.current) return;
    let r = this.board.ensureCurrent();
    if (r === 'wipe') {
      this.boardsFilled++;
      const bonus = 500;
      this.score += bonus;
      this.emit('boardFull', { bonus, lines: this.board.lines.slice() });
      this.board.wipe();
      r = this.board.ensureCurrent();
    }
    if (r === 'golden') this.emit('golden', { line: this.board.current });
  }

  writeRebel(dt) {
    this.ensureLine();
    const line = this.board.current;
    const smudging = this.events.flyOnLine(line);
    const res = this.board.writeRebel(dt, smudging);
    const mult = line.golden ? this.cfg.score.goldenMult : 1;
    for (const l of res.letters) {
      if (!l.smudged) this.score += this.cfg.score.letter * mult;
      this.letters++;
      this.emit('letter', { kind: 'rebel', line, index: l.index, smudged: l.smudged, golden: line.golden });
    }
    if (res.completed) this.completeLine(res.completed);
  }

  completeLine(line) {
    this.streak++;
    this.bestStreak = Math.max(this.bestStreak, this.streak);
    const sm = this.cfg.score.streakMults;
    const mult = sm[Math.min(this.streak - 1, sm.length - 1)];
    const pts = Math.round(this.cfg.score.line * mult * (line.golden ? this.cfg.score.goldenMult : 1));
    this.score += pts;
    this.lines++;
    if (line.golden) this.goldenLines++;
    this.emit('lineComplete', { line, points: pts, mult, golden: line.golden, streak: this.streak });
    // Prepare the next line right away so a golden one can be announced before you commit.
    this.ensureLine();
  }

  writePunish(dt) {
    const res = this.board.writePunish(dt);
    if (res.letters) this.emit('letter', { kind: 'punish', count: res.letters });
    if (res.completed) {
      this.punishToday++;
      this.punishLines++;
      this.score += this.cfg.score.punishLine;
      this.emit('punishComplete', { count: this.punishToday, quota: this.quota });
    }
  }

  caught(reason) {
    this.phase = PHASE.CAUGHT;
    this.phaseT = 0;
    this.caughtReason = reason;
    this.caughtLook = this.teacher.lookCount;
    this.strikes++;
    this.streak = 0;
    this.erasing = this.board.eraseCurrent();
    this.emit('caught', { reason, line: this.erasing, strikes: this.strikes });
  }

  updateCaught() {
    if (this.phaseT >= this.cfg.timing.caughtDuration) {
      this.erasing = null;
      if (this.strikes >= this.cfg.strikes) {
        this.gameOver();
        return;
      }
      this.phase = PHASE.PLAY;
      this.phaseT = 0;
      this.teacher.enter(T.READING, this.teacher.nextRead() + this.cfg.timing.recoveryRead);
      this.emit('caughtEnd', {});
    }
  }

  endDay() {
    this.phase = PHASE.DAY_END;
    this.phaseT = 0;
    this.events.endDay();
    this.chalk = 'ok';
    const missed = this.quota > 0 && this.punishToday < this.quota;
    this.emit('bell', { day: this.day, missed });
    if (missed) {
      this.strikes++;
      this.streak = 0;
      this.emit('quotaMiss', { done: this.punishToday, quota: this.quota, strikes: this.strikes });
    } else {
      this.emit('quotaMet', { done: this.punishToday, quota: this.quota });
    }
  }

  gameOver() {
    this.phase = PHASE.OVER;
    this.phaseT = 0;
    this.emit('gameOver', {});
  }

  win() {
    this.won = true;
    this.phase = PHASE.WIN;
    this.phaseT = 0;
    this.emit('eoyWin', {});
  }

  toResults() {
    this.phase = PHASE.RESULTS;
    this.phaseT = 0;
    this.emit('results', this.summary());
  }

  summary() {
    return {
      win: this.won,
      overtime: this.overtime,
      score: Math.round(this.score),
      lines: this.lines,
      bestStreak: this.bestStreak,
      closeCalls: this.closeCalls,
      goldenLines: this.goldenLines,
      dayIndex: this.dayIndex,
      dayLabel: this.won && !this.overtime ? 'EOY' : dayLabel(this.cfg, this.dayIndex),
      boardsFilled: this.boardsFilled,
      strikes: this.strikes,
      seed: this.seed,
    };
  }
}

// Title earned on the results screen.
export function earnedTitle(s, cfg = CONFIG) {
  const n = cfg.days.length;
  if (s.overtime && s.dayIndex >= n + 2) return 'Detention Legend';
  if (s.win || s.overtime) return 'EOY Prophet';
  if (s.lines === 0) return "Teacher's Pet";
  if (s.closeCalls >= 8) return 'Close Call Connoisseur';
  if (s.dayIndex >= 4) return 'Diamond-Handed Delinquent';
  if (s.dayIndex >= 2) return "Hall Monitor's Nightmare";
  if (s.lines >= 10) return 'Chalk Outlaw';
  return 'Professional Shiller';
}
