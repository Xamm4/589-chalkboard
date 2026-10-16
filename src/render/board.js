// The chalkboard: used-looking surface, ghost smudges, rebel lines, punishment strip, tallies.
// Completed lines are baked into an offscreen layer; only the line in progress is drawn per frame.

import { INNER, ROWS, PUNISH, rowBaseline, rowTop } from './layout.js';
import { chalkPattern, layoutText, drawGlyph, rebelFont, punishFont, fitFontSize, chalkStroke, REBEL_SIZE } from './chalk.js';
import { makeLayer, roundRect } from './scene.js';
import { hash01 } from '../rng.js';

const WIPE_SHIMMER = 0.6;
const WIPE_SWEEP = 1.05;

export class BoardRenderer {
  constructor(cfg) {
    this.cfg = cfg;
    this.version = -1;
    this.goldenChalk = false;
    this.rs = 1;
    this.wipe = null;
    this.rebelSize = REBEL_SIZE;
  }

  boardLayer(rs) {
    const l = makeLayer(rs, INNER.w, INNER.h);
    l.ctx.setTransform(rs, 0, 0, rs, -INNER.x * rs, -INNER.y * rs);
    return l;
  }

  resize(rs) {
    this.rs = rs;
    const maxW = INNER.x + INNER.w - ROWS.left - 12;
    const t = this.cfg.text;
    this.rebelSize = fitFontSize(t.rebel, maxW);
    this.goldenSize = Math.min(this.rebelSize, fitFontSize(t.golden.slice(0, t.goldenBreak), maxW));
    this.surface = this.boardLayer(rs);
    this.layer = this.boardLayer(rs);
    this.drawSurface(this.surface.ctx);
    this.version = -1;
    this.drawnIds = null;
  }

  layoutFor(line) {
    if (line.golden) return layoutText(line.text, rebelFont(this.goldenSize), this.cfg.text.goldenBreak, 26);
    return layoutText(line.text, rebelFont(this.rebelSize));
  }

  glyphPos(line, index) {
    const L = this.layoutFor(line);
    const c = L.chars[Math.min(index, L.chars.length - 1)];
    return { x: ROWS.left + c.x + c.w / 2, y: rowBaseline(line.row + c.row) - 8 };
  }

  cursorPos(line) {
    if (!line) return null;
    const L = this.layoutFor(line);
    const i = Math.min(Math.floor(line.progress), L.chars.length - 1);
    const c = L.chars[i];
    const f = line.progress - Math.floor(line.progress);
    return { x: ROWS.left + c.x + c.w * f, y: rowBaseline(line.row + c.row) - 8 };
  }

  punishCursor(game) {
    const L = layoutText(this.cfg.text.punish, punishFont(21));
    const p = game.board.punish.progress;
    const c = L.chars[Math.min(Math.floor(p), L.chars.length - 1)];
    return { x: PUNISH.x + c.x + c.w * (p - Math.floor(p)), y: PUNISH.baseline - 6 };
  }

  drawSurface(ctx) {
    const { x, y, w, h } = INNER;
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, '#30604a');
    g.addColorStop(0.5, '#2b5743');
    g.addColorStop(1, '#264d3b');
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w, h);
    // big soft cloudy patches of old chalk
    for (let i = 0; i < 46; i++) {
      const cx = x + hash01(i, 101) * w;
      const cy = y + hash01(i, 102) * h;
      const r = 20 + hash01(i, 103) * 80;
      const rg = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      rg.addColorStop(0, `rgba(235,245,235,${0.018 + hash01(i, 104) * 0.03})`);
      rg.addColorStop(1, 'rgba(235,245,235,0)');
      ctx.fillStyle = rg;
      ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    }
    // ghosts of yesterday's punishment lines
    ctx.save();
    ctx.font = punishFont(20);
    ctx.textBaseline = 'alphabetic';
    for (let r = 0; r < 14; r++) {
      ctx.globalAlpha = 0.022 + hash01(r, 7) * 0.022;
      ctx.fillStyle = '#e8f0e4';
      const ox = x + 10 + hash01(r, 8) * 40;
      ctx.fillText(this.cfg.text.punish, ox, y + 40 + r * 33);
      if (hash01(r, 9) > 0.4) ctx.fillText(this.cfg.text.punish, ox + 200, y + 40 + r * 33);
    }
    ctx.restore();
    // eraser swirls over the ghosts
    for (let i = 0; i < 9; i++) this.swirl(ctx, x + hash01(i, 50) * w * 0.6, y + 20 + hash01(i, 51) * (h - 40), 120 + hash01(i, 52) * 160, 1000 + i, 0.03);
    // fine grain
    for (let i = 0; i < 2200; i++) {
      ctx.fillStyle = hash01(i, 61) > 0.5 ? `rgba(255,255,255,${0.04 + hash01(i, 62) * 0.07})` : `rgba(0,20,10,${0.05 + hash01(i, 63) * 0.06})`;
      ctx.fillRect(x + hash01(i, 64) * w, y + hash01(i, 65) * h, 1, 1);
    }
    // edge darkening
    const eg = ctx.createLinearGradient(x, 0, x + w, 0);
    eg.addColorStop(0, 'rgba(0,15,8,0.22)');
    eg.addColorStop(0.08, 'rgba(0,15,8,0)');
    eg.addColorStop(0.92, 'rgba(0,15,8,0)');
    eg.addColorStop(1, 'rgba(0,15,8,0.22)');
    ctx.fillStyle = eg;
    ctx.fillRect(x, y, w, h);
  }

  // Eraser smear: long soft wavy strokes plus a couple of loose loops where the eraser turned.
  swirl(ctx, x0, y0, len, seed, alpha) {
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (let p = 0; p < 3; p++) {
      ctx.strokeStyle = `rgba(232,242,230,${alpha * (p === 0 ? 1 : 0.55)})`;
      ctx.lineWidth = 9 + hash01(seed, p) * 13;
      const yoff = (hash01(seed, p + 10) - 0.5) * 12;
      const amp = 2 + hash01(seed, p + 20) * 4;
      const freq = 0.015 + hash01(seed, p + 30) * 0.03;
      const ph = hash01(seed, p + 40) * 6;
      const start = x0 + hash01(seed, p + 50) * 20;
      const l = len * (0.75 + hash01(seed, p + 60) * 0.25);
      ctx.beginPath();
      for (let i = 0; i <= 24; i++) {
        const x = start + (i / 24) * l;
        const y = y0 + yoff + Math.sin(x * freq + ph) * amp;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.lineWidth = 7;
    ctx.strokeStyle = `rgba(232,242,230,${alpha * 0.6})`;
    for (let k = 0; k < 2; k++) {
      const cx = x0 + hash01(seed, k + 70) * len;
      const r = 9 + hash01(seed, k + 80) * 9;
      ctx.beginPath();
      ctx.ellipse(cx, y0 + (hash01(seed, k + 90) - 0.5) * 8, r * 1.5, r, 0, 0, Math.PI * 1.6);
      ctx.stroke();
    }
    ctx.restore();
  }

  setRebelStyle(ctx, golden) {
    ctx.fillStyle = chalkPattern(ctx, golden ? 'gold' : this.goldenChalk ? 'goldChalk' : 'white');
    ctx.shadowColor = golden ? 'rgba(255,190,60,0.65)' : 'rgba(255,255,255,0.3)';
    ctx.shadowBlur = (golden ? 8 : 2.5) * this.rs;
    ctx.textBaseline = 'alphabetic';
  }

  drawLine(ctx, line, upto, opts = {}) {
    const L = this.layoutFor(line);
    ctx.save();
    ctx.font = rebelFont(line.golden ? this.goldenSize : this.rebelSize);
    this.setRebelStyle(ctx, line.golden);
    const n = Math.min(L.chars.length, Math.ceil(upto));
    const minX = opts.minX ?? -Infinity;
    const maxX = opts.maxX ?? Infinity;
    for (let i = 0; i < n; i++) {
      const c = L.chars[i];
      const gx = ROWS.left + c.x;
      if (gx + c.w < minX || gx > maxX) continue;
      const frac = i < Math.floor(upto) ? 1 : upto - Math.floor(upto);
      const smudged = line.smudged.includes(i);
      if (smudged) {
        ctx.globalAlpha = 0.28;
        drawGlyph(ctx, c.ch, gx - 1.5, rowBaseline(line.row + c.row) + 1, c.w, line.id, i, frac);
        drawGlyph(ctx, c.ch, gx + 1.5, rowBaseline(line.row + c.row) - 1, c.w, line.id, i, frac);
        ctx.globalAlpha = 1;
      } else {
        drawGlyph(ctx, c.ch, gx, rowBaseline(line.row + c.row), c.w, line.id, i, frac);
      }
    }
    ctx.restore();
  }

  drawLayer(game) {
    const ctx = this.layer.ctx;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.layer.c.width, this.layer.c.height);
    ctx.drawImage(this.surface.c, 0, 0);
    ctx.restore();
    const board = game.board;
    for (const s of board.smudges) {
      for (let r = 0; r < s.span; r++) {
        const len = s.kind === 'erase' ? Math.max(60, 330 * (s.progress ?? 1)) : 340;
        this.swirl(ctx, ROWS.left - 4, rowTop(s.row + r) + 15, len, s.seed * 13 + r, s.kind === 'erase' ? 0.075 : 0.045);
      }
    }
    for (const line of board.lines) this.drawLine(ctx, line, line.text.length);
    this.version = board.version;
    this.layerGolden = this.goldenChalk;
    this.drawnIds = board.lines.map((l) => l.id);
    this.drawnSmudges = board.smudges.length;
  }

  // Bring the baked layer up to date. A newly finished line is drawn on top of what is
  // already there (cheap); erasures, wipes and style changes redraw everything.
  syncLayer(game) {
    const board = game.board;
    const ids = this.drawnIds || [];
    const appendOnly =
      this.drawnIds !== null &&
      this.drawnIds !== undefined &&
      this.layerGolden === this.goldenChalk &&
      this.drawnSmudges === board.smudges.length &&
      board.lines.length >= ids.length &&
      ids.every((id, i) => board.lines[i].id === id);
    if (!appendOnly) {
      this.drawLayer(game);
      return;
    }
    for (let i = ids.length; i < board.lines.length; i++) this.drawLine(this.layer.ctx, board.lines[i], board.lines[i].text.length);
    this.drawnIds = board.lines.map((l) => l.id);
    this.version = board.version;
  }

  // Board-full: freeze the current image and sweep it away.
  startWipe(game, now) {
    this.drawLayer(game);
    const snap = this.boardLayer(this.rs);
    snap.ctx.setTransform(1, 0, 0, 1, 0, 0);
    snap.ctx.drawImage(this.layer.c, 0, 0);
    this.wipe = { snap: snap.c, t0: now };
    this.version = -1;
  }

  wipeState(now) {
    if (!this.wipe) return null;
    const t = now - this.wipe.t0;
    if (t > WIPE_SHIMMER + WIPE_SWEEP) {
      this.wipe = null;
      return null;
    }
    const sweep = Math.max(0, (t - WIPE_SHIMMER) / WIPE_SWEEP);
    const ex = INNER.x - 30 + (INNER.w + 70) * easeInOut(sweep);
    return { t, sweeping: t >= WIPE_SHIMMER, ex, ey: INNER.y + INNER.h / 2 + Math.sin(t * 22) * (INNER.h * 0.42) };
  }

  draw(ctx, game, now, state) {
    if (this.version !== game.board.version || this.layerGolden !== this.goldenChalk) this.syncLayer(game);
    ctx.drawImage(this.layer.c, INNER.x, INNER.y, INNER.w, INNER.h);

    const wipe = this.wipeState(now);
    let clipMax = Infinity;
    if (wipe) {
      ctx.save();
      ctx.beginPath();
      const cut = wipe.sweeping ? wipe.ex : INNER.x;
      ctx.rect(cut, INNER.y, INNER.x + INNER.w - cut, INNER.h);
      ctx.clip();
      ctx.drawImage(this.wipe.snap, INNER.x, INNER.y, INNER.w, INNER.h);
      if (!wipe.sweeping) {
        // shimmer: a glint runs across the finished board
        const gx = INNER.x + (wipe.t / WIPE_SHIMMER) * (INNER.w + 120) - 60;
        const gg = ctx.createLinearGradient(gx - 50, 0, gx + 50, 0);
        gg.addColorStop(0, 'rgba(255,255,220,0)');
        gg.addColorStop(0.5, 'rgba(255,255,220,0.35)');
        gg.addColorStop(1, 'rgba(255,255,220,0)');
        ctx.fillStyle = gg;
        ctx.fillRect(INNER.x, INNER.y, INNER.w, INNER.h);
      }
      ctx.restore();
      clipMax = wipe.sweeping ? wipe.ex : -1;
    }

    const board = game.board;
    const cur = board.current;
    if (cur) {
      if (cur.golden) this.drawGoldenGuide(ctx, cur, now);
      if (cur.progress > 0) this.drawLine(ctx, cur, cur.progress, { maxX: clipMax });
    }
    if (game.erasing && state.eraserX !== undefined) {
      this.drawLine(ctx, game.erasing, game.erasing.progress, { minX: state.eraserX });
    }
    this.drawPunish(ctx, game);
    if (wipe && wipe.sweeping) this.drawBigEraser(ctx, wipe.ex, wipe.ey);
    return wipe;
  }

  drawGoldenGuide(ctx, line, now) {
    const pulse = 0.5 + 0.5 * Math.sin(now * 5);
    for (let r = 0; r < line.span; r++) {
      const y = rowTop(line.row + r);
      const g = ctx.createLinearGradient(INNER.x, 0, INNER.x + INNER.w, 0);
      g.addColorStop(0, `rgba(255,200,70,${0.1 + pulse * 0.08})`);
      g.addColorStop(1, 'rgba(255,200,70,0)');
      ctx.fillStyle = g;
      ctx.fillRect(INNER.x + 4, y + 2, INNER.w - 8, ROWS.h - 2);
    }
    ctx.save();
    ctx.font = rebelFont(16);
    ctx.fillStyle = chalkPattern(ctx, 'gold');
    ctx.textAlign = 'right';
    ctx.globalAlpha = 0.7 + pulse * 0.3;
    ctx.fillText('×3', INNER.x + INNER.w - 8, rowBaseline(line.row + line.span - 1));
    ctx.restore();
  }

  drawPunish(ctx, game) {
    const text = this.cfg.text.punish;
    const L = layoutText(text, punishFont(21));
    // divider
    ctx.save();
    ctx.strokeStyle = 'rgba(220,230,215,0.16)';
    ctx.setLineDash([6, 7]);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(INNER.x + 10, PUNISH.top);
    ctx.lineTo(INNER.x + INNER.w - 10, PUNISH.top);
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.font = punishFont(21);
    ctx.fillStyle = chalkPattern(ctx, 'dim');
    ctx.globalAlpha = 0.95;
    const p = game.board.punish.progress;
    const n = Math.ceil(p);
    for (let i = 0; i < n && i < L.chars.length; i++) {
      const c = L.chars[i];
      const frac = i < Math.floor(p) ? 1 : p - Math.floor(p);
      drawGlyph(ctx, c.ch, PUNISH.x + c.x, PUNISH.baseline, c.w, 7000 + game.board.punish.id, i, frac, { jitter: 1.6 });
    }
    ctx.restore();
    this.drawTally(ctx, game);
  }

  drawTally(ctx, game) {
    const q = game.quota;
    const done = game.punishToday;
    const x0 = PUNISH.tallyX;
    const yb = PUNISH.baseline + 2;
    ctx.save();
    ctx.font = punishFont(14);
    ctx.fillStyle = 'rgba(225,232,220,0.7)';
    ctx.textAlign = 'left';
    ctx.fillText(q ? 'QUOTA' : 'NO QUOTA', x0 - 2, PUNISH.top + 13);
    ctx.restore();
    if (!q && !done) return;
    const total = Math.max(q, done);
    if (q && done < q && game.phase === 'play' && game.dayLeft < 12) {
      // running out of time: the tally throbs
      const pulse = 0.5 + 0.5 * Math.sin(game.time * 9);
      ctx.save();
      ctx.strokeStyle = `rgba(255,130,110,${0.45 + pulse * 0.5})`;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.ellipse(x0 + 18, yb - 12, 30 + pulse * 3, 19 + pulse * 2, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    ctx.strokeStyle = '#eef3ea';
    for (let i = 0; i < total; i++) {
      const group = Math.floor(i / 5);
      const k = i % 5;
      const gx = x0 + group * 34;
      if (k === 4) {
        if (i < done) chalkStroke(ctx, [[gx - 3, yb - 4], [gx + 26, yb - 18]], 2.4, 900 + i);
        continue;
      }
      const tx = gx + k * 7;
      if (i < done) {
        chalkStroke(ctx, [[tx + 1, yb - 22], [tx - 1, yb]], i < q ? 2.6 : 2.2, 800 + i, i < q ? 0.95 : 0.7);
      } else {
        ctx.save();
        ctx.setLineDash([3, 3]);
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.5;
        ctx.beginPath();
        ctx.moveTo(tx + 1, yb - 22);
        ctx.lineTo(tx - 1, yb);
        ctx.stroke();
        ctx.restore();
      }
    }
    if (q && done >= q) {
      // circled: quota done
      ctx.save();
      ctx.strokeStyle = 'rgba(150,240,160,0.8)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      const w = Math.min(total, 4) * 7 + 10 + (total > 4 ? 30 : 0);
      ctx.ellipse(x0 + w / 2 - 6, yb - 11, w / 2 + 2, 15, -0.05, 0.3, Math.PI * 2.15);
      ctx.stroke();
      ctx.restore();
    }
  }

  drawBigEraser(ctx, x, y) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.sin(y * 0.05) * 0.15);
    roundRect(ctx, -36, -20, 72, 26, 6);
    ctx.fillStyle = '#3d4f7a';
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#1d130d';
    ctx.stroke();
    roundRect(ctx, -36, 4, 72, 16, 4);
    ctx.fillStyle = '#e8e2d2';
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.fillRect(-30, -16, 60, 4);
    ctx.restore();
  }
}

function easeInOut(t) {
  t = Math.min(1, Math.max(0, t));
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}
