// Characters: the mascot (from behind), the Regulator (seated behind his newspaper, or on his
// feet), the snitch bear, plus small actors (paper airplane, FUD fly, principal silhouette).

import { T } from '../teacher.js';
import { PHASE } from '../game.js';
import { MASCOT, TEACHER, BEAR, DOOR, INNER, rowBaseline, ROWS, TRAY } from './layout.js';
import { INK, makeLayer, roundRect } from './scene.js';
import { FONTS } from './assets.js';
import { hash01 } from '../rng.js';

const SKIN = '#f6a548';
const SKIN_DARK = '#d9832c';
const JACKET = '#7b5536';
const JACKET_DARK = '#5e3f26';
const TROUSERS = '#4b4b58';

const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = (t) => Math.max(0, Math.min(1, t));
const smooth = (t) => {
  t = clamp01(t);
  return t * t * (3 - 2 * t);
};
const approach = (v, target, rate, dt) => v + (target - v) * (1 - Math.exp(-rate * dt));

export const HEADLINES = {
  mon: ['SEC SAYS', '"NO."'],
  tue: ['XRP TO', 'ZERO?!'],
  wed: ['COFFEE', 'PRICES SOAR'],
  thu: ['WHO IS', '"589"??'],
  fri: ['BEARS WIN', 'AGAIN'],
  eoy: ['FINAL EXAM', 'TODAY'],
  idle: ['MEMES ARE', 'NOT MONEY'],
  ot: ['STILL', 'HERE?!'],
};

export function makeNewspaper(rs, lines) {
  const w = 196;
  const h = 150;
  const l = makeLayer(rs, w, h);
  const ctx = l.ctx;
  // sheet with a soft fold in the middle
  roundRect(ctx, 2, 2, w - 4, h - 4, 3);
  const g = ctx.createLinearGradient(0, 0, w, 0);
  g.addColorStop(0, '#efe7d2');
  g.addColorStop(0.47, '#f8f2e2');
  g.addColorStop(0.5, '#d8cfb8');
  g.addColorStop(0.53, '#f6f0df');
  g.addColorStop(1, '#e9e0c9');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = INK;
  ctx.stroke();
  ctx.fillStyle = '#2b2620';
  ctx.textAlign = 'center';
  ctx.font = `11px ${FONTS.display}`;
  ctx.fillText('THE DAILY LEDGER', w / 2, 18);
  ctx.fillRect(12, 22, w - 24, 1.5);
  ctx.fillRect(12, 25, w - 24, 0.8);
  ctx.font = `21px ${FONTS.display}`;
  ctx.fillStyle = '#1a1612';
  ctx.fillText(lines[0], w / 2, 48);
  ctx.fillText(lines[1], w / 2, 70);
  // photo: a chart going down, naturally
  ctx.fillStyle = '#d6cdb6';
  ctx.fillRect(14, 80, 74, 52);
  ctx.strokeStyle = '#b8352a';
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(18, 90);
  ctx.lineTo(32, 98);
  ctx.lineTo(42, 94);
  ctx.lineTo(56, 112);
  ctx.lineTo(66, 108);
  ctx.lineTo(84, 127);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(40,35,30,0.55)';
  ctx.lineWidth = 1.4;
  for (let i = 0; i < 8; i++) {
    const y = 84 + i * 6.5;
    ctx.beginPath();
    ctx.moveTo(98, y);
    ctx.lineTo(w - 14 - (i === 7 ? 30 : 0), y);
    ctx.stroke();
  }
  return l.c;
}

function face(assets, name) {
  return assets[name] || assets.smug || null;
}

// Fallback head if a face image is missing: a clean chalk-ish cartoon.
function drawFallbackHead(ctx, x, y, w, h, name) {
  ctx.beginPath();
  ctx.ellipse(x + w / 2, y + h / 2, w / 2.3, h / 2.1, 0, 0, Math.PI * 2);
  ctx.fillStyle = SKIN;
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = INK;
  ctx.stroke();
  ctx.fillStyle = INK;
  ctx.font = `${Math.round(w * 0.2)}px ${FONTS.display}`;
  ctx.textAlign = 'center';
  ctx.fillText(name === 'angry' ? '>:(' : name === 'ko' ? 'x_x' : name === 'shock' ? ':O' : ':)', x + w / 2, y + h * 0.62);
}

function drawHead(ctx, assets, name, x, y, w, pop = 0) {
  const img = face(assets, name);
  const h = img ? (w * img.height) / img.width : w * 1.05;
  const s = 1 + pop * 0.16;
  ctx.save();
  ctx.translate(x + w / 2, y + h);
  ctx.scale(s * (1 - pop * 0.05), s);
  if (img) ctx.drawImage(img, -w / 2, -h, w, h);
  else drawFallbackHead(ctx, -w / 2, -h, w, h, name);
  ctx.restore();
  return h;
}

// ---------------------------------------------------------------- mascot

export class MascotView {
  constructor() {
    this.lift = 0;
    this.squash = 0;
    this.lean = 0;
    this.scribble = 0;
    this.jump = 0;
    this.shake = 0;
  }

  update(dt, game, t) {
    const idle = game.phase === PHASE.IDLE;
    const idleWrite = idle && game.teacher.state === T.READING;
    const writingRebel = (game.phase === PHASE.PLAY && game.isWritingRebel) || idleWrite;
    const writingPunish = (game.phase === PHASE.PLAY && !game.holding) || (idle && !idleWrite);
    const caught = game.phase === PHASE.CAUGHT;
    const over = game.phase === PHASE.OVER || (game.phase === PHASE.RESULTS && !game.won);
    const win = game.phase === PHASE.WIN;
    this.lift = approach(this.lift, writingRebel ? 1 : win ? 0.6 : 0, 14, dt);
    this.squash = approach(this.squash, over ? 1 : writingPunish ? 0.6 : 0, 8, dt);
    this.scribble = approach(this.scribble, writingRebel ? 1 : writingPunish ? 0.35 : 0, 10, dt);
    this.lean = approach(this.lean, writingRebel ? 1 : 0, 10, dt);
    this.shake = caught && game.phaseT < 0.8 ? 1 : approach(this.shake, 0, 6, dt);
    if (win) this.jump = Math.abs(Math.sin(t * 7)) * 26;
    else this.jump = approach(this.jump, 0, 10, dt);
  }

  draw(ctx, img, t) {
    const h = MASCOT.h;
    const w = img ? (h * img.width) / img.height : h * 0.46;
    const fx = MASCOT.x + w * 0.42;
    const fy = MASCOT.y + h;
    const bounce = this.lift * Math.abs(Math.sin(t * 15)) * 3;
    const sx = Math.sin(t * (12 + 18 * this.scribble)) * 1.6 * this.scribble;
    const sy = Math.cos(t * (12 + 18 * this.scribble) * 1.3) * 1.1 * this.scribble;
    const shake = this.shake ? Math.sin(t * 60) * 3 * this.shake : 0;
    // floor shadow
    ctx.fillStyle = 'rgba(30,15,5,0.35)';
    ctx.beginPath();
    ctx.ellipse(fx + 6, fy - 6, w * 0.42 - this.jump * 0.3, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.save();
    ctx.translate(fx + sx + shake, fy - this.lift * 9 - bounce - this.jump + sy);
    ctx.rotate(this.lean * 0.015 - this.squash * 0.02);
    ctx.scale(1 + this.squash * 0.015, 1 + this.lift * 0.012 - this.squash * 0.025);
    if (img) ctx.drawImage(img, -w * 0.42, -h, w, h);
    else drawMascotPlaceholder(ctx, w, h);
    ctx.restore();
  }
}

function drawMascotPlaceholder(ctx, w, h) {
  ctx.lineWidth = 4;
  ctx.strokeStyle = INK;
  ctx.fillStyle = '#d4181c';
  roundRect(ctx, -w * 0.35, -h * 0.8, w * 0.6, h * 0.36, 16);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#5b3a22';
  ctx.beginPath();
  ctx.arc(-w * 0.05, -h * 0.88, w * 0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#1f6fa3';
  roundRect(ctx, -w * 0.3, -h * 0.45, w * 0.5, h * 0.18, 8);
  ctx.fill();
  ctx.stroke();
}

// ---------------------------------------------------------------- teacher

export class TeacherView {
  constructor() {
    this.paper = 0;
    this.faceName = 'smug';
    this.facePop = 0;
    this.shockT = 0;
    this.tremble = 0;
    this.rise = 0;
    this.standX = 400;
    this.facing = -1; // -1 facing right (away from the board), 1 facing left (toward it)
    this.turn = 1; // animated scaleX for the walk-mode turn
    this.walkPhase = 0;
    this.walking = 0;
    this.lastState = null;
    this.paperIdle = 0;
    this.distractFlip = 0;
    this.newspaper = null;
    this.newspaperKey = '';
  }

  setFace(name) {
    if (name !== this.faceName) {
      this.faceName = name;
      this.facePop = 1;
    }
  }

  onCloseCall() {
    this.shockT = 0.9;
  }

  update(dt, game, t, plane) {
    const tch = game.teacher;
    const p = game.day || {};
    const phase = game.phase;
    this.facePop = approach(this.facePop, 0, 12, dt);
    if (this.shockT > 0) this.shockT -= dt;
    this.mode = p.mode === 'walk' && phase !== PHASE.IDLE ? 'walk' : 'desk';

    // ---- face
    let fname = 'smug';
    if (phase === PHASE.CAUGHT) fname = game.phaseT < 1.42 ? 'angry' : 'grin';
    else if (phase === PHASE.DAY_END) fname = game.quota && game.punishToday < game.quota ? (game.phaseT < 0.6 ? 'angry' : 'grin') : 'smug';
    else if (phase === PHASE.WIN) fname = 'ko';
    else if (phase === PHASE.OVER) fname = 'grin';
    else if (phase === PHASE.RESULTS) fname = game.won ? 'ko' : 'grin';
    else if (tch.state === T.DISTRACTED) fname = tch.t < 0.8 ? 'shock' : 'smug';
    else if (this.shockT > 0) fname = 'shock';
    this.setFace(fname);

    // ---- newspaper / pose (desk mode)
    let target = 0;
    let rate = 9;
    let tremble = 0;
    const style = p.tellStyle;
    const vis = style === 'sneaky' ? 0.35 : 1;
    if (phase === PHASE.PLAY || phase === PHASE.IDLE || phase === PHASE.CARD) {
      switch (tch.state) {
        case T.TELL:
        case T.FAKE_TELL: {
          if (tch.snap) break;
          const f = tch.tellProgress;
          tremble = (f < 0.55 ? 1 : 0.4) * vis;
          target = smooth((f - 0.4) / 0.6) * 0.34 * (style === 'sneaky' ? 0.55 : 1);
          rate = 14;
          break;
        }
        case T.LOOKING:
          target = 1;
          rate = 4.2 / Math.max(0.08, tch.turn);
          break;
        case T.RETURNING:
          target = 0;
          rate = 7;
          break;
        case T.DISTRACTED:
          target = 0.62;
          rate = 10;
          break;
        default:
          target = 0;
          rate = 7;
      }
    } else if (phase === PHASE.CAUGHT || phase === PHASE.WIN || phase === PHASE.OVER || phase === PHASE.RESULTS) {
      target = 1;
      rate = 30;
    } else if (phase === PHASE.DAY_END) {
      target = 0.8;
    }
    this.paper = approach(this.paper, target, rate, dt);
    this.tremble = approach(this.tremble, tremble, 20, dt);
    this.rise = approach(this.rise, this.paper > 0.6 ? 1 : 0, 10, dt);
    this.paperIdle = Math.sin(t * 0.9) * 1.5 + (Math.sin(t * 0.23) > 0.96 ? Math.sin(t * 30) * 2 : 0);

    // Distracted: follow the airplane with his eyes.
    let flipTarget = 0;
    if (tch.state === T.DISTRACTED && phase === PHASE.PLAY) flipTarget = plane && plane.x < TEACHER.x - 20 ? 0 : 1;
    this.distractFlip = approach(this.distractFlip, flipTarget, 12, dt);

    // ---- walk mode (EOY): he roams; he can only see you when facing the board.
    if (this.mode === 'walk') this.updateWalk(dt, game, tch);
    else {
      this.standX = TEACHER.x;
      this.facing = 1;
      this.turn = 1;
    }

    // Caught storm: stand up, march to the board, erase, march back.
    this.storm = null;
    if (phase === PHASE.CAUGHT) {
      const ct = game.phaseT;
      const home = this.mode === 'walk' ? this.standX : TEACHER.x;
      const dest = 262;
      let x = home;
      if (ct > 0.42 && ct < 0.8) x = lerp(home, dest, smooth((ct - 0.42) / 0.38));
      else if (ct >= 0.8 && ct < 1.55) x = dest;
      else if (ct >= 1.55) x = lerp(dest, home, smooth((ct - 1.55) / 0.42));
      const moving = (ct > 0.42 && ct < 0.8) || ct > 1.55;
      const arm = ct > 0.72 && ct < 1.5 ? smooth((ct - 0.72) / 0.12) : 0;
      this.storm = { x, standing: ct > 0.36 || this.mode === 'walk', moving, arm, facing: ct > 1.55 ? -1 : 1 };
      if (moving) this.walkPhase += dt * 16;
    }
  }

  updateWalk(dt, game, tch) {
    const phase = game.phase;
    let speed = 0;
    let facing = this.facing;
    if (phase === PHASE.PLAY || phase === PHASE.CARD) {
      switch (tch.state) {
        case T.READING:
        case T.RETURNING:
          facing = -1;
          speed = this.standX < 436 ? 46 : 0;
          break;
        case T.TELL:
        case T.FAKE_TELL:
          facing = -1;
          speed = 0;
          break;
        case T.LOOKING:
          facing = 1;
          speed = tch.seeing && this.standX > 300 ? -30 : 0;
          break;
        case T.DISTRACTED:
          facing = -1;
          speed = 0;
          break;
      }
    } else if (phase === PHASE.WIN || phase === PHASE.OVER || phase === PHASE.RESULTS || phase === PHASE.DAY_END) {
      facing = 1;
    }
    if (tch.state === T.LOOKING && phase === PHASE.PLAY) {
      // the turn takes exactly as long as the head turn in the state machine
      const k = clamp01(tch.t / Math.max(0.05, tch.turn));
      this.turn = lerp(-1, 1, smooth(k));
    } else {
      this.turn = approach(this.turn, facing, 16, dt);
    }
    this.facing = facing;
    this.standX = Math.max(300, Math.min(440, this.standX + speed * dt));
    this.walking = approach(this.walking, speed !== 0 ? 1 : 0, 10, dt);
    this.walkPhase += dt * 9 * this.walking;
  }

  ensureNewspaper(rs, dayId) {
    const key = `${rs}|${dayId}`;
    if (this.newspaperKey === key) return;
    const id = dayId && dayId.startsWith('ot') ? 'ot' : dayId || 'idle';
    this.newspaper = makeNewspaper(rs, HEADLINES[id] || HEADLINES.idle);
    this.newspaperKey = key;
  }

  // Seated behind the desk with the newspaper (desk mode).
  drawSeated(ctx, assets, t) {
    const x = TEACHER.x;
    const fw = TEACHER.faceW;
    const headY = TEACHER.headY - this.rise * 8 + Math.sin(t * 1.4) * 1.2;
    const flip = this.distractFlip > 0.5;
    // shoulders / jacket
    ctx.save();
    ctx.translate(x, 0);
    drawTorsoSeated(ctx, headY);
    ctx.restore();
    // head
    ctx.save();
    if (flip) {
      ctx.translate(x, 0);
      ctx.scale(-1, 1);
      ctx.translate(-x, 0);
    }
    drawHead(ctx, assets, this.faceName, x - fw / 2, headY, fw, this.facePop);
    ctx.restore();
    // newspaper
    const tr = this.tremble;
    const jx = tr ? (hash01(Math.floor(t * 40), 1) - 0.5) * 5 * tr : 0;
    const jy = tr ? (hash01(Math.floor(t * 40), 2) - 0.5) * 3 * tr : 0;
    const rot = tr ? Math.sin(t * 50) * 0.02 * tr : Math.sin(t * 0.7) * 0.006;
    const top = lerp(650, 772, this.paper) + this.paperIdle + jy;
    const pw = 196;
    const ph = 150;
    ctx.save();
    ctx.translate(x + jx, top + ph / 2);
    ctx.rotate(rot);
    if (this.newspaper) ctx.drawImage(this.newspaper, -pw / 2, -ph / 2, pw, ph);
    if (tr > 0.25) drawShakeLines(ctx, pw, ph, t, tr);
    // hands gripping the sides
    for (const sx of [-1, 1]) {
      ctx.save();
      ctx.translate(sx * (pw / 2 - 4), -6);
      ctx.beginPath();
      ctx.ellipse(0, 0, 11, 13, sx * 0.2, 0, Math.PI * 2);
      ctx.fillStyle = SKIN;
      ctx.fill();
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = INK;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-sx * 6, -6);
      ctx.lineTo(-sx * 1, -3);
      ctx.moveTo(-sx * 6, 1);
      ctx.lineTo(-sx * 1, 3);
      ctx.lineWidth = 1.4;
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
  }

  // On his feet: EOY patrol or the CAUGHT storm.
  drawStanding(ctx, assets, x, footY, opts = {}) {
    drawStandingTeacher(ctx, assets, x, footY, {
      scaleX: opts.scaleX ?? this.turn,
      walkPhase: this.walkPhase,
      walking: opts.walking ?? this.walking,
      face: this.faceName,
      pop: this.facePop,
      arm: opts.arm || 0,
      pointer: opts.pointer || null,
      holding: opts.holding || null,
    });
  }
}

// Comic "shake" marks around the newspaper while it rustles.
function drawShakeLines(ctx, pw, ph, t, amount) {
  ctx.save();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  ctx.globalAlpha = Math.min(1, amount * 1.4);
  const wob = Math.sin(t * 40) * 2;
  for (const sx of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      const x0 = sx * (pw / 2 + 8 + i * 7);
      const y0 = -ph / 2 + 6 + i * 13;
      ctx.beginPath();
      ctx.moveTo(x0, y0 + wob);
      ctx.quadraticCurveTo(x0 + sx * 6, y0 + 6 - wob, x0, y0 + 12 + wob);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawTorsoSeated(ctx, headY) {
  const top = headY + 126;
  // jacket
  ctx.beginPath();
  ctx.moveTo(-96, 800);
  ctx.quadraticCurveTo(-98, top + 14, -52, top);
  ctx.lineTo(52, top);
  ctx.quadraticCurveTo(98, top + 14, 96, 800);
  ctx.closePath();
  ctx.fillStyle = JACKET;
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = INK;
  ctx.stroke();
  // shirt + tie
  ctx.beginPath();
  ctx.moveTo(-26, top - 2);
  ctx.lineTo(26, top - 2);
  ctx.lineTo(0, top + 54);
  ctx.closePath();
  ctx.fillStyle = '#f4f1ea';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-6, top + 4);
  ctx.lineTo(6, top + 4);
  ctx.lineTo(9, top + 48);
  ctx.lineTo(0, top + 58);
  ctx.lineTo(-9, top + 48);
  ctx.closePath();
  ctx.fillStyle = '#c0392b';
  ctx.fill();
  ctx.stroke();
  // lapels
  ctx.strokeStyle = JACKET_DARK;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-28, top);
  ctx.lineTo(-8, top + 62);
  ctx.moveTo(28, top);
  ctx.lineTo(8, top + 62);
  ctx.stroke();
  // neck
  ctx.fillStyle = SKIN_DARK;
  ctx.fillRect(-16, top - 22, 32, 22);
}

export function drawStandingTeacher(ctx, assets, x, footY, o) {
  const sc = 0.98;
  const swing = Math.sin(o.walkPhase) * 0.45 * o.walking;
  ctx.save();
  ctx.translate(x, footY);
  // floor shadow (unflipped)
  ctx.fillStyle = 'rgba(30,15,5,0.35)';
  ctx.beginPath();
  ctx.ellipse(0, -2, 52, 11, 0, 0, Math.PI * 2);
  ctx.fill();
  const sx = Math.abs(o.scaleX) < 0.12 ? 0.12 * Math.sign(o.scaleX || 1) : o.scaleX;
  ctx.scale(sx * sc, sc);
  const bob = Math.abs(Math.sin(o.walkPhase)) * 4 * o.walking;
  ctx.translate(0, -bob);

  const limb = (x0, y0, x1, y1, w, color) => {
    ctx.lineCap = 'round';
    ctx.strokeStyle = INK;
    ctx.lineWidth = w + 5;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
    ctx.strokeStyle = color;
    ctx.lineWidth = w;
    ctx.stroke();
  };
  const hand = (hx, hy) => {
    ctx.beginPath();
    ctx.arc(hx, hy, 9, 0, Math.PI * 2);
    ctx.fillStyle = SKIN;
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = INK;
    ctx.stroke();
  };
  // legs
  const lA = Math.sin(swing) * 26;
  limb(-12, -96, -14 + lA, -10, 22, TROUSERS);
  limb(12, -96, 14 - lA, -10, 22, TROUSERS);
  for (const fx of [-14 + lA, 14 - lA]) {
    ctx.beginPath();
    ctx.ellipse(fx - 6, -6, 17, 8, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#3a2414';
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = INK;
    ctx.stroke();
  }
  // back arm
  limb(34, -196, 40 - lA * 0.6, -118, 18, JACKET_DARK);
  hand(40 - lA * 0.6, -112);
  // torso
  ctx.beginPath();
  ctx.moveTo(-46, -200);
  ctx.quadraticCurveTo(-58, -140, -40, -88);
  ctx.lineTo(40, -88);
  ctx.quadraticCurveTo(58, -140, 46, -200);
  ctx.quadraticCurveTo(0, -214, -46, -200);
  ctx.closePath();
  ctx.fillStyle = JACKET;
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = INK;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-18, -206);
  ctx.lineTo(18, -206);
  ctx.lineTo(0, -150);
  ctx.closePath();
  ctx.fillStyle = '#f4f1ea';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-5, -200);
  ctx.lineTo(5, -200);
  ctx.lineTo(8, -156);
  ctx.lineTo(0, -146);
  ctx.lineTo(-8, -156);
  ctx.closePath();
  ctx.fillStyle = '#c0392b';
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = INK;
  for (const by of [-130, -108]) {
    ctx.beginPath();
    ctx.arc(-2, by, 2.6, 0, Math.PI * 2);
    ctx.fill();
  }
  // front arm (raised when he wields the pointer)
  if (o.arm > 0) {
    const hx = lerp(-42, -64, o.arm);
    const hy = lerp(-110, -292, o.arm);
    limb(-36, -194, hx, hy, 18, JACKET);
    hand(hx, hy);
  } else {
    limb(-36, -194, -42 + lA * 0.6, -116, 18, JACKET);
    hand(-42 + lA * 0.6, -110);
  }
  // neck + head
  ctx.fillStyle = SKIN_DARK;
  ctx.fillRect(-12, -222, 24, 22);
  const fw = 128;
  drawHead(ctx, assets, o.face, -fw / 2 - 6, -214 - (assets.smug ? (fw * assets.smug.height) / assets.smug.width : fw) + 10, fw, o.pop);
  ctx.restore();
}

// World position of his raised hand (matches drawStandingTeacher with arm = 1).
export function standingHand(x, footY, scaleX) {
  return { x: x - 64 * 0.98 * scaleX, y: footY - 292 * 0.98 };
}

// The long pointer + felt eraser he uses to wipe your rebel line (world coordinates).
export function drawPointerEraser(ctx, hx, hy, ex, ey) {
  ctx.save();
  ctx.lineCap = 'round';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.moveTo(hx, hy);
  ctx.lineTo(ex, ey + 10);
  ctx.stroke();
  ctx.strokeStyle = '#b8864f';
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.translate(ex, ey);
  ctx.rotate(Math.sin(ex * 0.08) * 0.12);
  roundRect(ctx, -24, -12, 48, 18, 4);
  ctx.fillStyle = '#3d4f7a';
  ctx.fill();
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = INK;
  ctx.stroke();
  roundRect(ctx, -24, 4, 48, 10, 3);
  ctx.fillStyle = '#e8e2d2';
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

// ---------------------------------------------------------------- bear

export function drawBear(ctx, game, t) {
  const { x, y } = BEAR;
  const ev = game.events;
  const b = ev && ev.bear;
  const c = game.cfg.events.bear;
  let arm = 0;
  if (b) {
    if (b.phase === 'raise') arm = smooth(b.t / c.raise);
    else if (b.phase === 'up' || b.phase === 'snitch') arm = 1;
    else if (b.phase === 'down') arm = 1 - smooth(b.t / c.down);
  }
  const wiggle = arm > 0.9 ? Math.sin(t * 18) * 0.12 : 0;
  // body
  ctx.save();
  ctx.translate(x, y);
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = INK;
  // torso with sweater vest
  ctx.beginPath();
  ctx.ellipse(0, 40, 30, 26, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#2e7a7e';
  ctx.fill();
  ctx.stroke();
  // raised arm (behind head when up)
  const shoulderX = 22;
  const shoulderY = 30;
  const ang = lerp(2.95, 4.83, arm) + wiggle;
  const armLen = lerp(30, 60, arm);
  const ax = shoulderX + Math.cos(ang) * armLen;
  const ay = shoulderY + Math.sin(ang) * armLen;
  const drawArm = () => {
    ctx.lineCap = 'round';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 15;
    ctx.beginPath();
    ctx.moveTo(shoulderX, shoulderY);
    ctx.lineTo(ax, ay);
    ctx.stroke();
    ctx.strokeStyle = '#9b6234';
    ctx.lineWidth = 10;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(ax, ay, 7.5, 0, Math.PI * 2);
    ctx.fillStyle = '#9b6234';
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = INK;
    ctx.stroke();
  };
  if (arm > 0.5) drawArm();
  // head
  for (const ex of [-18, 18]) {
    ctx.beginPath();
    ctx.arc(ex, -19, 9.5, 0, Math.PI * 2);
    ctx.fillStyle = '#9b6234';
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = INK;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(ex, -19, 4.5, 0, Math.PI * 2);
    ctx.fillStyle = '#e0a978';
    ctx.fill();
  }
  ctx.beginPath();
  ctx.arc(0, 0, 25, 0, Math.PI * 2);
  ctx.fillStyle = '#a96b3a';
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(0, 9, 12, 9, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#e0b07e';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.ellipse(0, 4.5, 5, 3.5, 0, 0, Math.PI * 2);
  ctx.fill();
  const snitching = b && b.phase === 'snitch';
  const blink = !b && Math.sin(t * 1.7 + 1) > 0.985;
  for (const ex of [-9, 9]) {
    if (blink) {
      ctx.fillRect(ex - 3.5, -5, 7, 1.8);
    } else if (snitching) {
      // smug squint
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(ex - 4, -4);
      ctx.quadraticCurveTo(ex, -8, ex + 4, -4);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.arc(ex, -4, 3.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(ex + 1, -5, 1, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = INK;
    }
  }
  if (arm > 0.5) {
    // mouth "o"
    ctx.beginPath();
    ctx.arc(0, 14, snitching ? 4 : 2.5, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(-3, 13);
    ctx.quadraticCurveTo(0, 15, 3, 13);
    ctx.stroke();
  }
  // bow tie (teacher's pet)
  ctx.fillStyle = '#d33a2f';
  ctx.beginPath();
  ctx.moveTo(0, 25);
  ctx.lineTo(-9, 20);
  ctx.lineTo(-9, 30);
  ctx.closePath();
  ctx.moveTo(0, 25);
  ctx.lineTo(9, 20);
  ctx.lineTo(9, 30);
  ctx.closePath();
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = INK;
  ctx.stroke();
  ctx.restore();

  // student desk in front of him
  ctx.save();
  ctx.translate(x, y);
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = INK;
  ctx.beginPath();
  ctx.rect(-44, 34, 88, 10);
  ctx.fillStyle = '#c99a62';
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.rect(-40, 44, 80, 40);
  ctx.fillStyle = '#a8784a';
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#6d6f78';
  ctx.fillRect(-36, 84, 5, 34);
  ctx.fillRect(31, 84, 5, 34);
  // book (idle) or folded hands
  if (arm < 0.5) {
    ctx.save();
    ctx.translate(-6, 32);
    ctx.rotate(-0.08);
    ctx.beginPath();
    ctx.rect(-16, -10, 32, 12);
    ctx.fillStyle = '#d64545';
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#fff6e0';
    ctx.fillRect(-14, -9, 28, 3);
    ctx.restore();
  }
  ctx.restore();
  if (arm <= 0.5) {
    ctx.save();
    ctx.translate(x, y);
    drawArm();
    ctx.restore();
  }

  // speech bubbles
  if (b && (b.phase === 'up' || b.phase === 'raise')) {
    const pulse = 1 + Math.sin(t * 14) * 0.08;
    bubble(ctx, x + 40, y - 54, '!', 30 * pulse, '#ffd23f');
  } else if (snitching) {
    bubble(ctx, x + 18, y - 62, 'TEACHER!!', 17, '#fff');
  }
}

export function bubble(ctx, x, y, text, size, fill = '#fff') {
  ctx.save();
  ctx.font = `${size}px ${FONTS.display}`;
  const w = Math.max(size * 1.1, ctx.measureText(text).width + size * 0.9);
  const h = size * 1.45;
  roundRect(ctx, x - w / 2, y - h / 2, w, h, h * 0.4);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = INK;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x - w * 0.2, y + h / 2 - 1);
  ctx.lineTo(x - w * 0.32, y + h / 2 + 12);
  ctx.lineTo(x - w * 0.05, y + h / 2 - 1);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = INK;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y + size * 0.08);
  ctx.restore();
}

// ---------------------------------------------------------------- small actors

export function planePos(airplane) {
  if (!airplane || airplane.state === 'none') return null;
  if (airplane.state === 'ready') return { x: 352, y: TRAY.y - 4, rot: -0.15, s: 0.8 };
  const u = clamp01(airplane.t / 1.7);
  const p0 = [352, TRAY.y - 4];
  const p1 = [120, 170];
  const p2 = [430, 120];
  const p3 = [600, 470];
  const b = (a, b2, c, d, s) => (1 - s) ** 3 * a + 3 * (1 - s) ** 2 * s * b2 + 3 * (1 - s) * s * s * c + s ** 3 * d;
  const x = b(p0[0], p1[0], p2[0], p3[0], u);
  const y = b(p0[1], p1[1], p2[1], p3[1], u);
  const x2 = b(p0[0], p1[0], p2[0], p3[0], Math.min(1, u + 0.01));
  const y2 = b(p0[1], p1[1], p2[1], p3[1], Math.min(1, u + 0.01));
  return { x, y, rot: Math.atan2(y2 - y, x2 - x), s: 1.2 + Math.sin(u * Math.PI) * 0.5 };
}

export function drawPlane(ctx, pos, t) {
  if (!pos) return;
  ctx.save();
  ctx.translate(pos.x, pos.y + (pos.s < 1 ? Math.sin(t * 3) * 1.5 : 0));
  ctx.rotate(pos.rot);
  ctx.scale(pos.s, pos.s);
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(22, 0);
  ctx.lineTo(-16, -12);
  ctx.lineTo(-9, 0);
  ctx.lineTo(-16, 10);
  ctx.closePath();
  ctx.fillStyle = '#fbfaf4';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = INK;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(22, 0);
  ctx.lineTo(-9, 0);
  ctx.lineTo(-12, 6);
  ctx.closePath();
  ctx.fillStyle = '#d9d6cb';
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

export function flyPos(game, t) {
  const f = game.events && game.events.fly;
  if (!f) return null;
  const tx = INNER.x + 20 + f.x * (INNER.w - 40);
  const ty = rowBaseline(f.row) - 10;
  if (f.phase === 'incoming') {
    const u = smooth(f.t / 0.6);
    return { x: lerp(560, tx, u) + Math.sin(t * 20) * 8 * (1 - u), y: lerp(40, ty, u) + Math.cos(t * 17) * 10 * (1 - u), flying: true };
  }
  if (f.phase === 'leaving') {
    const u = smooth(f.t / 0.6);
    return { x: lerp(tx, -30, u), y: lerp(ty, 60, u) + Math.sin(t * 25) * 6, flying: true };
  }
  return { x: tx + Math.sin(t * 2.3) * 6, y: ty + Math.sin(t * 7) * 1, flying: false };
}

export function drawFly(ctx, pos, t) {
  if (!pos) return;
  ctx.save();
  ctx.translate(pos.x, pos.y);
  const flap = pos.flying ? Math.abs(Math.sin(t * 60)) : 0.4 + Math.abs(Math.sin(t * 9)) * 0.2;
  ctx.fillStyle = 'rgba(220,235,255,0.75)';
  ctx.strokeStyle = 'rgba(20,20,30,0.6)';
  ctx.lineWidth = 0.8;
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(s * 5, -5, 6, 3.5 * flap + 1, s * 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  ctx.fillStyle = '#16161c';
  ctx.beginPath();
  ctx.ellipse(0, 0, 6.5, 4.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(6, -1, 3.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#e03b3b';
  ctx.beginPath();
  ctx.arc(7.5, -2.5, 1.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.save();
  ctx.font = `9px ${FONTS.display}`;
  ctx.fillStyle = 'rgba(255,120,110,0.95)';
  ctx.textAlign = 'center';
  ctx.fillText('FUD', pos.x, pos.y - 11);
  ctx.restore();
}

// Silhouette passing behind the door's window; also his reflection on sneaky days.
export function drawDoorWindow(ctx, game, assets, t, reflect) {
  const { win } = DOOR;
  ctx.save();
  ctx.beginPath();
  ctx.rect(win.x, win.y, win.w, win.h);
  ctx.clip();
  const pr = game.events && game.events.principal;
  if (pr) {
    const u = pr.t / pr.dur;
    const cx = lerp(win.x - 40, win.x + win.w + 40, u);
    const bob = Math.abs(Math.sin(u * 30)) * 3;
    ctx.fillStyle = 'rgba(16,14,26,0.92)';
    ctx.beginPath();
    ctx.ellipse(cx, win.y + 96 - bob, 40, 34, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx, win.y + 40 - bob, 19, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(cx - 4, win.y + 56 - bob, 8, 10);
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillRect(cx - 10, win.y + 38 - bob, 7, 2.5);
    ctx.fillRect(cx + 3, win.y + 38 - bob, 7, 2.5);
  }
  if (reflect > 0.01 && assets.smug) {
    ctx.globalAlpha = 0.12 + reflect * 0.5;
    const fw = 44;
    const fh = (fw * assets.smug.height) / assets.smug.width;
    const fx = win.x + 10;
    const fy = win.y + 28 - reflect * 6;
    ctx.save();
    ctx.translate(fx + fw / 2, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(assets.smug, -fw / 2, fy, fw, fh);
    ctx.restore();
    // his little newspaper, lowering
    ctx.fillStyle = 'rgba(240,235,220,0.9)';
    ctx.fillRect(fx - 4, fy + fh * (0.42 + reflect * 0.25), fw + 8, 26);
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

// Wall shadow of his head rising as he gets ready to look (sneaky days).
export function drawWallShadow(ctx, amount) {
  if (amount <= 0.01) return;
  const x = 372;
  const y = lerp(700, 610, amount);
  ctx.save();
  ctx.globalAlpha = 0.32 * amount;
  ctx.fillStyle = '#10201a';
  ctx.beginPath();
  ctx.ellipse(x, y, 34, 40, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(x, y + 70, 70, 40, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export { approach, smooth, lerp, clamp01 };
export const BOARD_ROW_LEFT = ROWS.left;
