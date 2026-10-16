// In-world HUD chalked along the top of the board, the danger eye, and the wall clock hands.

import { T } from '../teacher.js';
import { PHASE } from '../game.js';
import { EYE, CLOCK, INNER } from './layout.js';
import { chalkPattern, rebelFont, punishFont, chalkStroke } from './chalk.js';
import { INK } from './scene.js';
import { approach } from './characters.js';

export class HudView {
  constructor() {
    this.score = 0;
    this.scorePop = 0;
    this.eyeOpen = 0;
    this.strikePop = [0, 0, 0];
    this.lastStrikes = 0;
    this.streakPop = 0;
    this.lastStreak = 0;
  }

  update(dt, game) {
    const target = Math.round(game.score);
    if (target > this.score) {
      this.score = Math.min(target, this.score + Math.max(1, (target - this.score) * dt * 9));
      this.scorePop = Math.min(1, this.scorePop + dt * 10);
    } else {
      this.score = target;
    }
    this.scorePop = approach(this.scorePop, 0, 6, dt);
    if (game.strikes > this.lastStrikes) for (let i = this.lastStrikes; i < game.strikes && i < 3; i++) this.strikePop[i] = 1;
    this.lastStrikes = game.strikes;
    for (let i = 0; i < 3; i++) this.strikePop[i] = approach(this.strikePop[i], 0, 5, dt);
    if (game.streak !== this.lastStreak) {
      if (game.streak > this.lastStreak) this.streakPop = 1;
      this.lastStreak = game.streak;
    }
    this.streakPop = approach(this.streakPop, 0, 5, dt);

    const tch = game.teacher;
    let open = 0;
    if (game.phase === PHASE.PLAY || game.phase === PHASE.CAUGHT) {
      if (tch.state === T.TELL || tch.state === T.FAKE_TELL) open = tch.snap ? 0 : tch.tellProgress * 0.62 * (game.day.tellVis ?? 1);
      else if (tch.state === T.LOOKING || game.phase === PHASE.CAUGHT) open = 1;
      else if (tch.state === T.DISTRACTED) open = 0.7;
      else if (tch.state === T.RETURNING) open = 0.25;
    }
    this.eyeOpen = approach(this.eyeOpen, open, open > this.eyeOpen ? 22 : 10, dt);
  }

  // Strikes cross out only once the CAUGHT animation reaches the board.
  shownStrikes(game) {
    if (game.phase === PHASE.CAUGHT && game.phaseT < 1.42) return game.strikes - 1;
    return game.strikes;
  }

  draw(ctx, game, t) {
    if (game.phase === PHASE.IDLE) return;
    const day = game.day;
    ctx.save();
    ctx.textBaseline = 'alphabetic';
    // day + lines
    ctx.font = punishFont(18);
    ctx.fillStyle = chalkPattern(ctx, 'white');
    ctx.textAlign = 'left';
    const dayName = game.phase === PHASE.IDLE ? 'DETENTION' : day.fullName || day.name;
    ctx.fillText(dayName, INNER.x + 12, 71);
    // score
    const s = 1 + this.scorePop * 0.12;
    ctx.save();
    ctx.translate(INNER.x + 12, 101);
    ctx.scale(s, s);
    ctx.font = rebelFont(27);
    ctx.fillStyle = chalkPattern(ctx, 'white');
    ctx.shadowColor = 'rgba(255,255,255,0.3)';
    ctx.shadowBlur = 3;
    ctx.fillText(Math.round(this.score).toLocaleString('en-US'), 0, 0);
    ctx.restore();
    // lines snuck (tiny, under the day name)
    ctx.font = punishFont(15);
    ctx.fillStyle = chalkPattern(ctx, 'dim');
    ctx.textAlign = 'left';
    ctx.font = punishFont(18);
    const lw = ctx.measureText(dayName).width;
    ctx.font = punishFont(15);
    ctx.fillText(`- ${game.lines} SNUCK`, INNER.x + 20 + lw, 71);

    // strikes
    const shown = this.shownStrikes(game);
    for (let i = 0; i < 3; i++) {
      const cx = INNER.x + INNER.w - 92 + i * 32;
      const cy = 74;
      if (i < shown) {
        const p = 1 + this.strikePop[i] * 0.8;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.scale(p, p);
        ctx.strokeStyle = this.strikePop[i] > 0.05 ? '#ffb4a8' : '#f4f1ea';
        chalkStroke(ctx, [[-9, -9], [9, 9]], 4, 300 + i * 7);
        chalkStroke(ctx, [[9, -9], [-9, 9]], 4, 340 + i * 7);
        ctx.restore();
      } else {
        ctx.save();
        ctx.strokeStyle = 'rgba(230,236,226,0.32)';
        ctx.setLineDash([3, 4]);
        ctx.lineWidth = 1.6;
        ctx.strokeRect(cx - 10, cy - 10, 20, 20);
        ctx.restore();
      }
    }
    // streak
    const sm = game.cfg.score.streakMults;
    const mult = game.streak > 0 ? sm[Math.min(game.streak, sm.length - 1)] : 1;
    const next = game.streak > 0 ? `NEXT ×${mult}` : 'STREAK ×1';
    ctx.save();
    ctx.textAlign = 'right';
    ctx.font = punishFont(16 + this.streakPop * 6);
    ctx.fillStyle = chalkPattern(ctx, mult >= 3 ? 'gold' : mult > 1 ? 'white' : 'dim');
    if (mult >= 5) {
      ctx.shadowColor = 'rgba(255,190,60,0.8)';
      ctx.shadowBlur = 10;
    }
    ctx.fillText(mult >= 5 ? `ON FIRE ×5` : next, INNER.x + INNER.w - 12, 102);
    ctx.restore();
    ctx.restore();

    this.drawEye(ctx, game, t);
  }

  drawEye(ctx, game, t) {
    const o = this.eyeOpen;
    const tch = game.teacher;
    const seeing = (tch.seeing && game.phase === PHASE.PLAY && !game.blind) || game.phase === PHASE.CAUGHT;
    const blind = game.phase === PHASE.PLAY && game.events.lightsOut;
    const distracted = tch.state === T.DISTRACTED && game.phase === PHASE.PLAY;
    const { x, y } = EYE;
    const w = 25;
    ctx.save();
    ctx.translate(x, y + 6);
    if (seeing) {
      const pulse = (t * 3) % 1;
      ctx.strokeStyle = `rgba(255,140,120,${0.7 * (1 - pulse)})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(0, 0, w + 8 + pulse * 18, 14 + pulse * 12, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    const top = -16 * o;
    const bot = 11 * o;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = seeing ? '#ffb0a0' : '#eef2ea';
    ctx.lineWidth = 3;
    if (o > 0.08) {
      ctx.beginPath();
      ctx.moveTo(-w, 0);
      ctx.quadraticCurveTo(0, top * 1.6, w, 0);
      ctx.quadraticCurveTo(0, bot * 1.6, -w, 0);
      ctx.closePath();
      ctx.fillStyle = seeing ? 'rgba(255,120,100,0.22)' : 'rgba(255,255,255,0.08)';
      ctx.fill();
      ctx.stroke();
      ctx.save();
      ctx.clip();
      const px = distracted ? 9 : Math.sin(t * 2) * 2;
      ctx.beginPath();
      ctx.arc(px, 0, 9 * Math.min(1, o + 0.2), 0, Math.PI * 2);
      ctx.fillStyle = seeing ? '#ff8a7a' : '#eef2ea';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(px, 0, 4.2, 0, Math.PI * 2);
      ctx.fillStyle = '#20302a';
      ctx.fill();
      ctx.restore();
    } else {
      // closed: a sleepy curve with lashes
      ctx.beginPath();
      ctx.moveTo(-w, -2);
      ctx.quadraticCurveTo(0, 10, w, -2);
      ctx.stroke();
      for (const lx of [-14, 0, 14]) {
        ctx.beginPath();
        ctx.moveTo(lx, lx === 0 ? 4 : 2);
        ctx.lineTo(lx * 1.15, lx === 0 ? 11 : 8);
        ctx.stroke();
      }
    }
    ctx.restore();
    ctx.save();
    ctx.font = rebelFont(15);
    ctx.textAlign = 'center';
    ctx.fillStyle = chalkPattern(ctx, 'white');
    if (blind) ctx.fillText('z Z', x + 34, y - 6 + Math.sin(t * 3) * 2);
    else if (distracted) ctx.fillText('?', x + 34, y - 4);
    else if (seeing) {
      ctx.font = rebelFont(20);
      ctx.fillStyle = chalkPattern(ctx, 'pink');
      ctx.fillText('!', x + 36, y + 2);
      ctx.fillText('!', x - 36, y + 2);
    }
    ctx.restore();
  }
}

export function drawClockHands(ctx, game, t, ring = 0) {
  const { x, y, r } = CLOCK;
  let frac;
  if (game.phase === PHASE.IDLE) frac = ((t / 120) % 1) * 0.4;
  else if (game.phase === PHASE.CARD) frac = 0;
  else frac = game.day ? Math.min(1, game.dayTime / game.day.duration) : 0;
  ctx.save();
  if (ring > 0) {
    ctx.translate(x, y);
    ctx.rotate(Math.sin(t * 70) * 0.06 * ring);
    ctx.translate(-x, -y);
  }
  // time left wedge
  if (game.phase === PHASE.PLAY || game.phase === PHASE.CAUGHT) {
    const a0 = -Math.PI / 2 + frac * Math.PI * 2;
    const urgent = game.dayLeft < 6;
    ctx.fillStyle = urgent ? `rgba(230,60,40,${0.25 + 0.15 * Math.sin(t * 10)})` : 'rgba(230,60,40,0.14)';
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.arc(x, y, r - 11, a0, Math.PI * 1.5);
    ctx.closePath();
    ctx.fill();
  }
  const hand = (ang, len, width, color) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x - Math.sin(ang) * 5, y + Math.cos(ang) * 5);
    ctx.lineTo(x + Math.sin(ang) * len, y - Math.cos(ang) * len);
    ctx.stroke();
  };
  hand(((2 + frac) / 12) * Math.PI * 2, r - 24, 4, INK);
  hand(frac * Math.PI * 2, r - 15, 3, INK);
  hand(Math.floor(t) * (Math.PI / 30), r - 13, 1.4, '#d0281c');
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.arc(x, y, 3.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
