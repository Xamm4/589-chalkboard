// Draws a frame: classroom layers, board, characters, juice, overlays. Also turns game events
// into visual feedback (particles, stamps, camera moves).

import { W, H, INNER, ROWS, HAND, TEACHER, MASCOT, DOOR, rowBaseline, PUNISH } from './layout.js';
import { makeLayer, drawBackground, drawForeground, drawLight, drawDoorGlare, roundRect, INK } from './scene.js';
import { BoardRenderer } from './board.js';
import { HudView, drawClockHands } from './hud.js';
import { FX } from './fx.js';
import { drawDayCard } from './cards.js';
import { FONTS } from './assets.js';
import {
  MascotView, TeacherView, drawBear, drawPlane, planePos, drawFly, flyPos, drawDoorWindow,
  drawWallShadow, standingHand, drawPointerEraser, bubble, smooth, clamp01, approach,
} from './characters.js';
import { PHASE, dayParams } from '../game.js';
import { T } from '../teacher.js';

const DESK_FOOT_Y = 800;
// What the Regulator has to say about all this.
const LINES = {
  caught: ['I SAW THAT!', 'SHILLING?! IN MY CLASS?!', 'NOT FINANCIAL ADVICE, HUH?', '$589?! DREAM ON!', 'EOY? MORE LIKE DETENTION!', 'CAUGHT YOU, REBEL!'],
  snitch: ['THANK YOU, BEAR.', 'GOOD BEAR.'],
  quota: ["WHERE'S MY PUNISHMENT?!"],
  over: ["PRINCIPAL'S OFFICE. NOW."],
  win: ['THE CHART... IT WAS RIGHT...'],
  close: ['HM?! I COULD HAVE SWORN...', 'WAS HE... NO.', 'HMMM...?'],
  plane: ['OOH! A PLANE!', 'WHO THREW THAT?!'],
  day: {
    mon: '100 LINES. NO SHILLING.',
    tue: "I'M WATCHING YOU...",
    wed: '*SLURP* MORE COFFEE.',
    thu: 'THE WALLS HAVE EYES.',
    fri: 'ALMOST WEEKEND. ALMOST.',
    eoy: 'FINAL EXAM. NO MERCY.',
    ot: 'STILL HERE?!',
  },
};
const pickLine = (arr) => arr[Math.floor(Math.random() * arr.length)];
const STREAK_WORDS = { 1.5: 'NICE', 2: 'BULLISH', 3: 'MOON MODE', 5: 'TO THE MOON' };

// Visual captions for every audio tell: readable with the sound off.
const CAPTIONS = {
  rustle: '*rustle*',
  ahem: 'AHEM!',
  cough: '*COUGH*',
  hm: 'HM?!',
  hmm: 'HMMM...',
  creak: '*creak*',
  footsteps: '*step*',
  stopWalk: '...',
};
const WALK_FOOT_Y = 932;

export class Renderer {
  constructor(canvas, assets, cfg) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.assets = assets;
    this.cfg = cfg;
    this.board = new BoardRenderer(cfg);
    this.hud = new HudView();
    this.fx = new FX();
    this.mascot = new MascotView();
    this.teacher = new TeacherView();
    this.scale = 1;
    this.rs = 1;
    this.tutorial = false;
    this.tutorialHeld = 0;
    this.idleNoHold = 0;
    this.reflect = 0;
    this.moteT = 0;
    this.cloudT = 0;
    this.clockRing = 0;
    this.prevDay = null;
    this.ko = 0;
    this.danger = 0;
    this.speech = null;
    this.mascotShout = null;
  }

  say(text, dur = 1.6, delay = 0) {
    this.speech = { text, t0: (this.time || 0) + delay, dur };
  }

  setReducedMotion(on) {
    this.fx.reduced = on;
  }

  resize(cssW, cssH, dpr) {
    this.scale = Math.min(cssW / W, cssH / H);
    const s = this.scale;
    const d = Math.min(this.cfg.view.maxDpr, dpr || 1);
    this.rs = s * d;
    this.canvas.style.width = `${Math.round(W * s)}px`;
    this.canvas.style.height = `${Math.round(H * s)}px`;
    this.canvas.width = Math.round(W * this.rs);
    this.canvas.height = Math.round(H * this.rs);
    this.bg = makeLayer(this.rs);
    drawBackground(this.bg.ctx, this.assets);
    this.fg = makeLayer(this.rs);
    drawForeground(this.fg.ctx);
    drawDeskProps(this.fg.ctx);
    this.light = makeLayer(this.rs);
    drawLight(this.light.ctx);
    this.vignette = makeLayer(this.rs);
    const vg = this.vignette.ctx.createRadialGradient(W / 2, H / 2, H * 0.28, W / 2, H / 2, H * 0.62);
    vg.addColorStop(0, 'rgba(255,40,30,0)');
    vg.addColorStop(1, 'rgba(255,40,30,0.9)');
    this.vignette.ctx.fillStyle = vg;
    this.vignette.ctx.fillRect(0, 0, W, H);
    this.board.resize(this.rs);
    this.teacher.newspaperKey = '';
    return this.scale;
  }

  // ------------------------------------------------------------ events → juice
  onGameEvent(type, d, game) {
    const fx = this.fx;
    const br = this.board;
    switch (type) {
      case 'letter':
        if (d.kind === 'rebel') {
          const p = br.glyphPos(d.line, d.index);
          fx.dust(p.x, p.y + 4, d.golden ? 3 : 2, { size: 3, alpha: 0.4 });
          if (d.golden) fx.sparkle(p.x, p.y, 2);
          if (d.smudged) fx.dust(p.x, p.y, 2, { color: '120,140,120', alpha: 0.6 });
        } else if (Math.random() < 0.35) {
          const p = br.punishCursor(game);
          fx.dust(p.x, p.y + 4, 1, { size: 2, alpha: 0.3 });
        }
        break;
      case 'lineComplete': {
        const end = br.glyphPos(d.line, d.line.text.length - 1);
        const label = d.mult > 1 ? `+${d.points}  ×${d.mult}` : `+${d.points}`;
        fx.text(label, Math.min(end.x - 20, W - 110), end.y - 16, { size: d.golden ? 34 : 28, color: d.golden ? '#ffd23f' : '#fff6dc' });
        if (STREAK_WORDS[d.mult]) fx.text(STREAK_WORDS[d.mult], Math.min(end.x - 20, W - 110), end.y + 18, { size: 20, color: d.mult >= 3 ? '#ffd23f' : '#bfe8ff', vy: -20, max: 1.2, font: 'display' });
        fx.sparkle(end.x, end.y, d.golden ? 18 : 8, d.golden ? '255,214,92' : '255,255,240');
        if (d.golden) {
          fx.banner('GOLDEN LINE!', 'gold', { y: H * 0.36, sub: `+${d.points}` });
          fx.shake(0.25);
        } else if (d.streak === 3 || d.streak === 5) {
          fx.banner(d.streak === 5 ? 'ON FIRE! ×5' : 'STREAK ×3!', 'gold', { y: H * 0.36, max: 1.1 });
        }
        break;
      }
      case 'cue': {
        const text = CAPTIONS[d.type];
        if (text) this.caption = { text, t0: this.time || 0, quiet: game.day && game.day.tellStyle === 'sneaky' };
        break;
      }
      case 'teacherState':
        if (d.to === 'LOOKING' || d.to === 'READING' || d.to === 'DISTRACTED') this.caption = null;
        break;
      case 'golden':
        fx.text('GOLDEN LINE ×3', 230, rowBaseline(d.line.row) - 6, { color: '#ffd23f', size: 24, max: 1.6, vy: -20 });
        break;
      case 'closeCall': {
        fx.banner('SO CLOSE!', 'close', { y: H * 0.4, sub: `+${d.points}`, max: 1.2 });
        fx.shake(0.45);
        fx.zoomTo(1.05, W / 2, H * 0.5);
        setTimeout(() => this.fx.zoomTo(1), 260);
        fx.sweat(MASCOT.x + 80, MASCOT.y + 30);
        fx.flashScreen(0.35, '255,215,80');
        fx.slowmo = 0.32;
        this.teacher.onCloseCall();
        this.say(pickLine(LINES.close), 1.2, 0.15);
        buzz(30);
        break;
      }
      case 'caught': {
        const cur = d.line ? br.glyphPos(d.line, Math.max(0, Math.floor(d.line.progress) - 1)) : { x: 200, y: 300 };
        fx.zoomTo(1.16, (cur.x + TEACHER.x) / 2, (cur.y + TEACHER.headY + 60) / 2);
        fx.flashScreen(0.5, '255,80,60');
        this.caughtFx = { slam: false, stamp: false, strike: false };
        this.say(d.reason === 'snitch' ? pickLine(LINES.snitch) : pickLine(LINES.caught), 1.5, 0.3);
        this.mascotShout = { text: '!!', t0: this.time || 0 };
        buzz([60, 40, 90]);
        break;
      }
      case 'snitch':
        fx.text('SNITCHED!', 160, 640, { color: '#ffb4a8', size: 26 });
        break;
      case 'chalkBreak': {
        const cur = br.cursorPos(game.board.current) || HAND;
        fx.chunks(cur.x, cur.y, 10);
        fx.text('SNAP!', cur.x, cur.y - 26, { size: 30, color: '#fff' });
        fx.shake(0.2);
        break;
      }
      case 'event':
        this.onClassroomEvent(d, game);
        break;
      case 'airplaneSpawn':
        fx.text('PAPER AIRPLANE!', 330, 500, { size: 22, color: '#bfe8ff', max: 1.8, vy: -16 });
        break;
      case 'airplaneThrow':
        fx.banner('DISTRACTION!', 'info', { y: H * 0.38, max: 1.0 });
        this.say(pickLine(LINES.plane), 1.4, 0.2);
        fx.dust(352, 530, 6);
        break;
      case 'boardFull':
        br.startWipe(game, this.time || 0);
        fx.banner('FULL BOARD!', 'gold', { y: H * 0.3, sub: `+${d.bonus}`, max: 1.6 });
        fx.zoomTo(1.04, W / 2, H * 0.3);
        setTimeout(() => this.fx.zoomTo(1), 600);
        break;
      case 'bell':
        this.clockRing = 1.4;
        fx.banner(d.missed ? 'BELL! QUOTA MISSED!' : 'BELL! DAY SURVIVED!', d.missed ? 'bad' : 'info', { y: H * 0.38, max: 1.6, sub: d.missed ? '+1 STRIKE' : '' });
        if (d.missed) {
          this.say(LINES.quota[0], 1.6, 0.2);
          buzz([60, 40, 90]);
        }
        break;
      case 'quotaMet':
        break;
      case 'punishComplete': {
        fx.dust(PUNISH.tallyX + 10, PUNISH.baseline - 10, 5);
        if (this.tutorial && d.count === 1) fx.text('QUOTA +1', PUNISH.tallyX, PUNISH.top - 8, { size: 20, max: 1.6, vy: -14 });
        break;
      }
      case 'dayStart': {
        const id = d.day.overtime ? 'ot' : d.day.id;
        if (LINES.day[id]) this.say(LINES.day[id], 1.7, 0.25);
        break;
      }
      case 'fakeOut':
        this.caption = { text: '*page flip*', t0: this.time || 0, quiet: true };
        break;
      case 'dayCard':
        this.speech = null;
        this.prevDay = game.dayIndex > 0 && !(game.overtime && game.dayIndex === this.cfg.days.length) ? dayParams(this.cfg, game.dayIndex - 1) : null;
        fx.zoomTo(1);
        break;
      case 'gameOver':
        fx.banner('SENT TO THE PRINCIPAL!', 'caught', { y: H * 0.42, max: 2.3, size: 40 });
        fx.shake(0.5);
        this.say(LINES.over[0], 2.2, 0.5);
        break;
      case 'eoyWin':
        fx.confetti(160);
        fx.banner('EOY REACHED!', 'win', { y: H * 0.38, max: 3.0, sub: 'THE REGULATOR IS DEFEATED' });
        fx.flashScreen(0.6, '255,230,150');
        this.say(LINES.win[0], 2.6, 0.6);
        break;
      case 'runStart':
        this.board.version = -1;
        this.hud.score = 0;
        fx.parts = [];
        fx.texts = [];
        fx.banners = [];
        break;
    }
  }

  onClassroomEvent(d, game) {
    const fx = this.fx;
    const key = `${d.type}:${d.phase}`;
    switch (key) {
      case 'bear:start':
        fx.text('SNITCH BEAR! LET GO!', 290, 620, { size: 22, color: '#ffd23f', max: 1.8, vy: -14 });
        break;
      case 'blackout:dark':
        fx.banner('LIGHTS OUT! WRITE!', 'gold', { y: H * 0.36, max: 1.4 });
        break;
      case 'blackout:warn':
        fx.text('LIGHTS COMING BACK!', W / 2, H * 0.47, { size: 24, color: '#ffd23f', max: 0.9, vy: -10 });
        break;
      case 'principal:start':
        fx.text('PRINCIPAL NEARBY! HE\'S ALERT', 270, DOOR.y - 14, { size: 19, color: '#ffd23f', max: 2.2, vy: -10 });
        break;
      case 'fly:landed':
        fx.text('FUD FLY! SMUDGES YOUR LINE', 220, rowBaseline(game.events.fly ? game.events.fly.row : 3) + 36, { size: 18, color: '#ffd23f', max: 2, vy: -8 });
        break;
      case 'chalk:start':
        if (d.first) fx.text('LET GO, THEN GRAB NEW CHALK', W / 2, 600, { size: 18, max: 2, vy: -8 });
        break;
    }
  }

  // ------------------------------------------------------------ frame
  frame(game, dt, t) {
    this.time = t;
    const ctx = this.ctx;
    const fx = this.fx;
    const tch = game.teacher;
    const tv = this.teacher;
    const plane = planePos(game.events && game.events.airplane);

    // view updates
    fx.update(dt);
    this.hud.update(dt, game);
    this.mascot.update(dt, game, t);
    tv.update(dt, game, t, plane);
    tv.ensureNewspaper(this.rs, game.phase === PHASE.IDLE ? 'idle' : game.day && game.day.id);
    this.clockRing = Math.max(0, this.clockRing - dt);
    const sneaky = game.day && game.day.tellStyle === 'sneaky' && game.phase === PHASE.PLAY;
    let reflectTarget = 0;
    if (sneaky && !tch.snap) {
      if (tch.state === T.TELL || tch.state === T.FAKE_TELL) reflectTarget = smooth(tch.tellProgress * 1.4);
      else if (tch.state === T.LOOKING) reflectTarget = 1;
    }
    this.reflect = approach(this.reflect, reflectTarget, 14, dt);
    if (!fx.reduced) {
      this.moteT -= dt;
      if (this.moteT <= 0) {
        fx.motes(1);
        this.moteT = 0.5;
      }
    }
    this.updateCaughtFx(game);
    this.updateTutorial(dt, game);
    // Greed tension: the screen edges throb red while you hold through a tell.
    let danger = 0;
    if (game.phase === PHASE.PLAY && game.isHoldingRebel && !game.blind) {
      if ((tch.state === T.TELL || tch.state === T.FAKE_TELL) && !tch.snap) danger = tch.tellProgress * (sneaky ? 0.5 : 1);
      else if (tch.state === T.LOOKING) danger = 1;
      const b = game.events.bear;
      if (b && (b.phase === 'up' || b.phase === 'raise')) danger = Math.max(danger, 0.7);
    }
    this.danger = approach(this.danger, danger, danger > this.danger ? 14 : 6, dt);

    // ---- world
    ctx.setTransform(this.rs, 0, 0, this.rs, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    fx.applyCamera(ctx, t);
    ctx.drawImage(this.bg.c, 0, 0, W, H);

    const eraserX = this.eraserX(game);
    this.board.draw(ctx, game, t, { eraserX });
    this.drawCursor(ctx, game, t);
    this.hud.draw(ctx, game, t);
    drawClockHands(ctx, game, t, this.clockRing);

    drawDoorWindow(ctx, game, this.assets, t, this.reflect);
    if (game.phase === PHASE.OVER || (game.phase === PHASE.RESULTS && !game.won)) this.drawPrincipalAtDoor(ctx, game);
    drawDoorGlare(ctx);
    if (sneaky) drawWallShadow(ctx, this.reflect);

    drawBear(ctx, game, t);
    this.mascot.draw(ctx, this.assets.mascot, t);

    const mode = tv.mode;
    const storm = tv.storm;
    let pointer = null;
    const drawStand = () => {
      if (storm && storm.standing) {
        const footY = mode === 'walk' ? WALK_FOOT_Y : DESK_FOOT_Y;
        tv.drawStanding(ctx, this.assets, storm.x, footY, { scaleX: storm.facing, walking: storm.moving ? 1 : 0, arm: storm.arm });
        if (storm.arm > 0.5 && game.erasing) {
          const hnd = standingHand(storm.x, footY, storm.facing);
          const row = game.erasing.row + (game.erasing.span > 1 ? 0.5 : 0);
          pointer = { hx: hnd.x, hy: hnd.y, ex: Math.max(INNER.x + 30, Math.min(INNER.x + INNER.w - 30, eraserX === -Infinity ? ROWS.left + 10 : eraserX)), ey: rowBaseline(row) - 12 };
        }
      } else if (mode === 'walk') {
        tv.drawStanding(ctx, this.assets, tv.standX, WALK_FOOT_Y);
      } else {
        tv.drawSeated(ctx, this.assets, t);
      }
    };
    if (mode === 'desk') drawStand();
    ctx.drawImage(this.fg.c, 0, 0, W, H);
    this.drawSteam(ctx, t);
    if (mode === 'walk') drawStand();
    if (pointer) drawPointerEraser(ctx, pointer.hx, pointer.hy, pointer.ex, pointer.ey);
    this.drawCaption(ctx, game, t);
    this.drawSpeech(ctx, game, t);
    this.drawMascotShout(ctx, t);
    this.drawCountdown(ctx, game, t);
    if (game.phase === PHASE.WIN || (game.phase === PHASE.RESULTS && game.won)) this.drawKoStars(ctx, game, t);

    drawPlane(ctx, plane, t);
    drawFly(ctx, flyPos(game, t), t);
    fx.drawWorld(ctx);
    this.drawTutorialWorld(ctx, game, t);

    ctx.drawImage(this.light.c, 0, 0, W, H);
    if (this.danger > 0.02) {
      ctx.globalAlpha = Math.min(1, this.danger * (0.32 + 0.12 * Math.sin(t * 16)));
      ctx.drawImage(this.vignette.c, 0, 0, W, H);
      ctx.globalAlpha = 1;
    }
    this.drawBlackout(ctx, game, t);
    ctx.restore();

    // ---- screen space
    fx.drawScreen(ctx);
    if (game.phase === PHASE.CARD) drawDayCard(ctx, game.day, this.prevDay, game.phaseT, this.cfg.timing.dayCard, this.assets);
    if (game.phase === PHASE.OVER) {
      ctx.fillStyle = `rgba(10,5,20,${Math.min(0.45, game.phaseT * 0.3)})`;
      ctx.fillRect(0, 0, W, H);
      fx.drawScreen(ctx);
    }
  }

  eraserX(game) {
    if (game.phase !== PHASE.CAUGHT || !game.erasing) return undefined;
    const ct = game.phaseT;
    const L = this.board.layoutFor(game.erasing);
    const len = L.width + 40;
    if (ct < 0.86) return -Infinity;
    if (ct > 1.4) return Infinity;
    return ROWS.left - 20 + smooth((ct - 0.86) / 0.54) * len;
  }

  updateCaughtFx(game) {
    if (game.phase !== PHASE.CAUGHT || !this.caughtFx) return;
    const ct = game.phaseT;
    const cf = this.caughtFx;
    const fx = this.fx;
    if (!cf.slam && ct >= this.cfg.timing.caughtFreeze) {
      cf.slam = true;
      fx.banner(game.caughtReason === 'snitch' ? 'SNITCHED!' : 'CAUGHT!', 'caught', { y: H * 0.3, max: 1.1 });
      fx.shake(0.75);
      fx.dust(TEACHER.x, 790, 10, { size: 8 });
    }
    if (ct > 0.55 && ct < 0.7) fx.zoomTo(1);
    const ex = this.eraserX(game);
    if (ex !== undefined && ex !== -Infinity && ex !== Infinity && game.erasing) {
      this.cloudT -= 1 / 60;
      if (this.cloudT <= 0) {
        this.cloudT = 0.035;
        for (let r = 0; r < game.erasing.span; r++) fx.cloud(ex, rowBaseline(game.erasing.row + r) - 10, 2, 24);
      }
    }
    if (!cf.strike && ct >= 1.42) {
      cf.strike = true;
      fx.text('STRIKE!', INNER.x + INNER.w - 60, 130, { size: 30, color: '#ffb4a8' });
      fx.shake(0.3);
    }
  }

  updateTutorial(dt, game) {
    if (!this.tutorial || game.phase !== PHASE.PLAY) return;
    if (game.holding) this.tutorialHeld += dt;
    this.idleNoHold = game.holding ? 0 : this.idleNoHold + dt;
  }

  drawTutorialWorld(ctx, game, t) {
    if (!this.tutorial || game.phase !== PHASE.PLAY) return;
    const tch = game.teacher;
    const reading = tch.state === T.READING;
    const needHold = reading && !game.holding && (this.tutorialHeld < 1.2 || this.idleNoHold > 2.5);
    if (needHold) {
      const x = INNER.x + INNER.w / 2;
      const y = 330;
      const p = (t * 1.6) % 1;
      ctx.save();
      ctx.strokeStyle = `rgba(255,255,255,${0.8 * (1 - p)})`;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(x, y, 26 + p * 30, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.beginPath();
      ctx.arc(x, y, 20 + Math.sin(t * 8) * 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = INK;
      ctx.stroke();
      ctx.restore();
      bubble(ctx, x, y - 64, 'HOLD ANYWHERE TO WRITE', 22, '#ffd23f');
    }
    const danger = tch.state === T.TELL || tch.state === T.FAKE_TELL || (tch.state === T.LOOKING && !tch.seeing);
    if (danger && game.holding) {
      const blink = Math.sin(t * 22) > -0.2;
      if (blink) bubble(ctx, 330, 560, 'LET GO!', 34, '#ff6b5b');
    }
    if (tch.state === T.LOOKING && !game.holding && tch.seeing) {
      bubble(ctx, 300, 560, 'SAFE! KEEP BEHAVING', 18, '#bdf5c4');
    }
  }

  drawCaption(ctx, game, t) {
    const c = this.caption;
    if (!c || game.phase !== PHASE.PLAY) return;
    const age = t - c.t0;
    if (age > 0.9) {
      this.caption = null;
      return;
    }
    const tv = this.teacher;
    const x = tv.mode === 'walk' ? tv.standX - 70 : TEACHER.x - 92;
    const y = tv.mode === 'walk' ? WALK_FOOT_Y - 360 : TEACHER.headY - 2;
    const pop = age < 0.12 ? 0.6 + (age / 0.12) * 0.5 : 1.1 - Math.min(0.1, (age - 0.12));
    ctx.save();
    ctx.globalAlpha = (c.quiet ? 0.75 : 1) * (age > 0.7 ? 1 - (age - 0.7) / 0.2 : 1);
    ctx.translate(x, y);
    ctx.scale(pop, pop);
    ctx.rotate(-0.08);
    bubble(ctx, 0, 0, c.text, c.quiet ? 15 : 20, '#fff8e8');
    ctx.restore();
  }

  teacherHeadPos(game) {
    const tv = this.teacher;
    if (tv.storm && tv.storm.standing) {
      const footY = tv.mode === 'walk' ? WALK_FOOT_Y : DESK_FOOT_Y;
      return { x: tv.storm.x, y: footY - 360 };
    }
    if (tv.mode === 'walk') return { x: tv.standX, y: WALK_FOOT_Y - 360 };
    return { x: TEACHER.x, y: TEACHER.headY - 14 };
  }

  drawSpeech(ctx, game, t) {
    const sp = this.speech;
    if (!sp) return;
    const age = t - sp.t0;
    if (age < 0) return;
    if (age > sp.dur) {
      this.speech = null;
      return;
    }
    const head = this.teacherHeadPos(game);
    const pop = age < 0.14 ? 0.5 + (age / 0.14) * 0.6 : age < 0.24 ? 1.1 - ((age - 0.14) / 0.1) * 0.1 : 1;
    ctx.save();
    ctx.globalAlpha = age > sp.dur - 0.2 ? (sp.dur - age) / 0.2 : 1;
    ctx.font = `17px ${FONTS.display}`;
    const w = ctx.measureText(sp.text).width + 30;
    const x = Math.max(w / 2 + 8, Math.min(W - w / 2 - 8, head.x - 40));
    ctx.translate(x, head.y);
    ctx.scale(pop, pop);
    bubble(ctx, 0, 0, sp.text, 17, '#ffffff');
    ctx.restore();
  }

  drawMascotShout(ctx, t) {
    const m = this.mascotShout;
    if (!m) return;
    const age = t - m.t0;
    if (age > 1.2) {
      this.mascotShout = null;
      return;
    }
    const y = MASCOT.y - 28 - Math.min(1, age * 8) * 14;
    ctx.save();
    ctx.globalAlpha = age > 1 ? (1.2 - age) / 0.2 : 1;
    ctx.font = `38px ${FONTS.display}`;
    ctx.textAlign = 'center';
    ctx.lineWidth = 7;
    ctx.strokeStyle = INK;
    ctx.lineJoin = 'round';
    ctx.strokeText(m.text, MASCOT.x + 70, y);
    ctx.fillStyle = '#ff5a4a';
    ctx.fillText(m.text, MASCOT.x + 70, y);
    ctx.restore();
  }

  drawCountdown(ctx, game, t) {
    if (game.phase !== PHASE.PLAY) return;
    const left = game.dayLeft;
    if (left > 5 || left <= 0) return;
    const n = Math.ceil(left);
    const k = n - left; // 0 → 1 within each second
    const s = 1.5 - Math.min(1, k * 4) * 0.5;
    ctx.save();
    ctx.translate(484, 186);
    ctx.scale(s, s);
    ctx.globalAlpha = 1 - k * 0.6;
    ctx.font = `46px ${FONTS.display}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 8;
    ctx.lineJoin = 'round';
    ctx.strokeStyle = INK;
    ctx.strokeText(String(n), 0, 0);
    ctx.fillStyle = game.quota && game.punishToday < game.quota ? '#ff6b5b' : '#ffd23f';
    ctx.fillText(String(n), 0, 0);
    ctx.restore();
  }

  drawCursor(ctx, game, t) {
    if (game.phase !== PHASE.PLAY) return;
    let p = null;
    if (game.isWritingRebel && game.board.current) p = this.board.cursorPos(game.board.current);
    else if (!game.holding) p = this.board.punishCursor(game);
    if (!p) return;
    const big = game.isWritingRebel;
    const a = 0.5 + 0.5 * Math.sin(t * 30);
    if (big && game.streak >= 4 && Math.random() < 0.5) {
      this.fx.sparkle(p.x, p.y, 1, Math.random() < 0.5 ? '255,150,40' : '255,214,92');
    }
    ctx.save();
    ctx.globalAlpha = big ? 0.55 + a * 0.45 : 0.35;
    const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, big ? 14 : 8);
    g.addColorStop(0, game.board.current && game.board.current.golden && big ? 'rgba(255,220,120,0.95)' : 'rgba(255,255,255,0.95)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(p.x, p.y, big ? 14 : 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  drawSteam(ctx, t) {
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    for (let i = 0; i < 2; i++) {
      ctx.beginPath();
      const x0 = 336 + i * 9;
      for (let k = 0; k <= 10; k++) {
        const y = 762 - k * 3.4;
        const x = x0 + Math.sin(t * 2.5 + k * 0.7 + i * 2) * 3;
        if (k === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.globalAlpha = 0.5 + 0.3 * Math.sin(t * 1.5 + i);
      ctx.stroke();
    }
    ctx.restore();
  }

  drawKoStars(ctx, game, t) {
    const tv = this.teacher;
    const x = tv.mode === 'walk' ? tv.standX - 6 : TEACHER.x;
    const y = tv.mode === 'walk' ? WALK_FOOT_Y - 340 : TEACHER.headY - 8;
    for (let i = 0; i < 4; i++) {
      const a = t * 4 + (i * Math.PI) / 2;
      const sx = x + Math.cos(a) * 58;
      const sy = y + Math.sin(a) * 14;
      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(a);
      ctx.fillStyle = '#ffd23f';
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let k = 0; k < 10; k++) {
        const r = k % 2 ? 4 : 10;
        const aa = (k / 10) * Math.PI * 2;
        ctx.lineTo(Math.cos(aa) * r, Math.sin(aa) * r);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  }

  drawPrincipalAtDoor(ctx, game) {
    const { win } = DOOR;
    const k = clamp01((game.phase === PHASE.OVER ? game.phaseT : 3) / 0.8);
    ctx.save();
    ctx.beginPath();
    ctx.rect(win.x, win.y, win.w, win.h);
    ctx.clip();
    ctx.globalAlpha = k;
    const cx = win.x + win.w / 2;
    ctx.fillStyle = 'rgba(16,14,26,0.95)';
    ctx.beginPath();
    ctx.ellipse(cx, win.y + 96, 40, 34, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx, win.y + 40, 19, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(cx - 10, win.y + 38, 7, 2.5);
    ctx.fillRect(cx + 3, win.y + 38, 7, 2.5);
    ctx.restore();
  }

  drawBlackout(ctx, game, t) {
    const b = game.events && game.phase === PHASE.PLAY ? game.events.blackout : null;
    if (!b) return;
    let a = 0.86;
    if (b.phase === 'flicker') a = Math.sin(t * 47) > 0.1 ? 0.75 : 0.1;
    if (b.phase === 'warn') a = Math.sin(t * 40) > -0.3 ? 0.86 : 0.25;
    ctx.save();
    ctx.fillStyle = `rgba(4,6,18,${a})`;
    ctx.fillRect(0, 0, W, H);
    if (a > 0.5) {
      // the board keeps a faint glow in the dark; your line in progress stays readable
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.2;
      ctx.drawImage(this.board.layer.c, INNER.x, INNER.y, INNER.w, INNER.h);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      if (game.board.current) this.board.drawLine(ctx, game.board.current, game.board.current.progress);
      // his glasses glint in the dark
      const gx = TEACHER.x - 6;
      const gy = TEACHER.headY + 80;
      ctx.fillStyle = `rgba(255,255,255,${0.4 + 0.3 * Math.sin(t * 3)})`;
      ctx.beginPath();
      ctx.arc(gx, gy, 3, 0, Math.PI * 2);
      ctx.arc(gx + 34, gy, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

function buzz(pattern) {
  try {
    if (navigator.vibrate) navigator.vibrate(pattern);
  } catch {
    /* not supported */
  }
}

function drawDeskProps(ctx) {
  // coffee mug
  ctx.save();
  ctx.translate(340, 768);
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = INK;
  ctx.beginPath();
  ctx.arc(15, 10, 8, -Math.PI / 2, Math.PI / 2);
  ctx.stroke();
  roundRect(ctx, -13, -4, 28, 30, 4);
  ctx.fillStyle = '#fbfaf4';
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#d8342a';
  ctx.font = `10px ${FONTS.display}`;
  ctx.textAlign = 'center';
  ctx.fillText('SEC', 1, 15);
  ctx.beginPath();
  ctx.ellipse(1, -4, 14, 3.5, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#4a2c17';
  ctx.fill();
  ctx.stroke();
  ctx.restore();
  // apple
  ctx.save();
  ctx.translate(512, 778);
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = INK;
  ctx.beginPath();
  ctx.arc(-6, 0, 11, 0, Math.PI * 2);
  ctx.arc(6, 0, 11, 0, Math.PI * 2);
  ctx.fillStyle = '#d8342a';
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.beginPath();
  ctx.ellipse(-7, -4, 3, 5, -0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(0, -10);
  ctx.lineTo(2, -18);
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(8, -16, 7, 3.5, -0.4, 0, Math.PI * 2);
  ctx.fillStyle = '#4caf50';
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}
