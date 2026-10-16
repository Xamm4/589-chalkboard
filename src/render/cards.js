// Calendar "next day" card and the results-screen meme board.

import { W, H } from './layout.js';
import { FONTS } from './assets.js';
import { roundRect, INK } from './scene.js';
import { chalkPattern, rebelFont, punishFont, drawGlyph, layoutText, fitFontSize } from './chalk.js';
import { hash01 } from '../rng.js';

const easeOutBack = (t) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};

const DAY_HINTS = {
  mon: 'HOLD to write. LET GO when he looks.',
  tue: 'Some tells are fake. Stay sharp.',
  wed: 'Classroom chaos begins.',
  thu: 'Watch the door window. Listen.',
  fri: 'He peeks. Then peeks again.',
  eoy: 'Only facing the board can he see you.',
};

const MOOD_FACE = { mon: 'ko', tue: 'smug', wed: 'shock', thu: 'grin', fri: 'angry', eoy: 'angry' };

function drawPage(ctx, day, x, y, w, h, opts = {}) {
  ctx.save();
  ctx.translate(x, y);
  if (opts.rot) ctx.rotate(opts.rot);
  // paper
  roundRect(ctx, -w / 2, 0, w, h, 10);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.save();
  ctx.translate(6, 9);
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = '#fff8e8';
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = INK;
  ctx.stroke();
  // header band
  ctx.save();
  roundRect(ctx, -w / 2, 0, w, 64, 10);
  ctx.clip();
  ctx.fillStyle = day.id === 'eoy' ? '#ff8a1f' : day.overtime ? '#7b2cbf' : '#d8342a';
  ctx.fillRect(-w / 2, 0, w, 64);
  ctx.restore();
  ctx.beginPath();
  ctx.moveTo(-w / 2, 64);
  ctx.lineTo(w / 2, 64);
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.fillStyle = '#fff8e8';
  ctx.font = `20px ${FONTS.display}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(day.overtime ? 'NO BELL CAN SAVE YOU' : 'DETENTION WEEK', 0, 36);
  // rings
  for (const rx of [-w * 0.3, 0, w * 0.3]) {
    ctx.beginPath();
    ctx.arc(rx, 0, 9, 0, Math.PI * 2);
    ctx.fillStyle = '#cfd3d8';
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.stroke();
  }
  // big day name
  const name = day.id === 'eoy' ? 'EOY' : day.name;
  ctx.fillStyle = '#14213d';
  let size = day.id === 'eoy' ? 92 : 56;
  ctx.font = `${size}px ${FONTS.display}`;
  const tw = ctx.measureText(name).width;
  if (tw > w - 40) {
    size *= (w - 40) / tw;
    ctx.font = `${size}px ${FONTS.display}`;
  }
  ctx.fillText(name, 0, 64 + 58);
  if (day.id === 'eoy') {
    ctx.font = `20px ${FONTS.display}`;
    ctx.fillStyle = '#d8342a';
    ctx.fillText('FINAL EXAM', 0, 64 + 108);
  }
  // mood strip: tiny chalkboard
  const my = day.id === 'eoy' ? 64 + 132 : 64 + 104;
  roundRect(ctx, -w / 2 + 26, my, w - 52, 52, 6);
  ctx.fillStyle = '#2d5a45';
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#8a5a30';
  ctx.stroke();
  ctx.font = punishFont(15);
  ctx.fillStyle = 'rgba(230,236,226,0.75)';
  ctx.fillText('TEACHER MOOD', 0, my + 15);
  ctx.font = rebelFont(26);
  ctx.fillStyle = chalkPattern(ctx, day.id === 'eoy' || day.overtime ? 'gold' : 'white');
  ctx.fillText(day.mood.toUpperCase(), 0, my + 37);
  // hint + quota
  ctx.fillStyle = '#3b3b4a';
  ctx.font = punishFont(19);
  const hint = DAY_HINTS[day.id] || day.blurb;
  wrapText(ctx, hint, 0, my + 80, w - 50, 22);
  ctx.font = `17px ${FONTS.display}`;
  ctx.fillStyle = '#14213d';
  const q = day.quota ? `PUNISHMENT QUOTA: ${day.quota} LINES` : 'NO QUOTA. JUST SURVIVE.';
  ctx.fillText(q, 0, h - 26);
  // the Regulator's mood, as a sticker
  const face = opts.faces && opts.faces[MOOD_FACE[day.id] || 'angry'];
  if (face) {
    ctx.save();
    ctx.translate(w / 2 - 22, 18);
    ctx.rotate(0.14);
    ctx.beginPath();
    ctx.arc(0, 0, 38, 0, Math.PI * 2);
    ctx.fillStyle = '#ffd23f';
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = INK;
    ctx.stroke();
    const fw = 70;
    const fh = (fw * face.height) / face.width;
    ctx.drawImage(face, -fw / 2, -fh / 2 - 2, fw, fh);
    ctx.restore();
  }
  ctx.restore();
}

function wrapText(ctx, text, x, y, maxW, lh) {
  const words = text.split(' ');
  let line = '';
  const lines = [];
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxW && line) {
      lines.push(line);
      line = w;
    } else line = test;
  }
  lines.push(line);
  lines.forEach((l, i) => ctx.fillText(l, x, y + i * lh));
}

// t: seconds since the card started; dur: total duration.
export function drawDayCard(ctx, day, prevDay, t, dur, faces) {
  const outT = Math.max(0, t - (dur - 0.35)) / 0.35;
  const dim = Math.min(1, t / 0.2) * (1 - outT);
  ctx.save();
  ctx.fillStyle = `rgba(8,12,28,${0.62 * dim})`;
  ctx.fillRect(0, 0, W, H);
  const pw = 330;
  const ph = 372;
  const cx = W / 2;
  const cy = H * 0.5 - ph / 2 - 20;
  const slideOut = outT * outT * (H * 0.9);
  if (prevDay) {
    // new page underneath, old page tears off and tumbles away
    drawPage(ctx, day, cx, cy - slideOut, pw, ph, { faces });
    const k = Math.min(1, t / 0.75);
    if (k < 1) {
      const fall = k * k;
      drawPage(ctx, prevDay, cx + fall * 140, cy + fall * 520, pw, ph, { rot: fall * 0.9, faces });
      // torn strip left at the binding
      ctx.fillStyle = '#fff8e8';
      ctx.fillRect(cx - pw / 2 + 4, cy - 2, pw - 8, 6);
    }
  } else {
    const k = Math.min(1, t / 0.55);
    const y = -ph - 40 + (cy + ph + 40) * easeOutBack(k);
    drawPage(ctx, day, cx, y - slideOut, pw, ph, { rot: (1 - k) * -0.15, faces });
  }
  ctx.restore();
}

// The results-screen board: your rebel lines, front and center. The meme.
export function renderMemeBoard(canvas, summary, cfg, opts = {}) {
  const w = 500;
  const h = 300;
  const dpr = Math.min(2, (typeof window !== 'undefined' && window.devicePixelRatio) || 1) * (opts.scale || 1);
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  // frame
  roundRect(ctx, 0, 0, w, h, 10);
  ctx.fillStyle = '#9a6a3c';
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = INK;
  ctx.stroke();
  const ix = 12;
  const iy = 12;
  const iw = w - 24;
  const ih = h - 24;
  const g = ctx.createLinearGradient(0, iy, 0, iy + ih);
  g.addColorStop(0, '#30604a');
  g.addColorStop(1, '#264d3b');
  ctx.fillStyle = g;
  ctx.fillRect(ix, iy, iw, ih);
  for (let i = 0; i < 600; i++) {
    ctx.fillStyle = `rgba(255,255,255,${0.03 + hash01(i, 5) * 0.05})`;
    ctx.fillRect(ix + hash01(i, 6) * iw, iy + hash01(i, 7) * ih, 1, 1);
  }
  const rows = 10;
  const rh = ih / rows;
  const lines = summary.lines;
  const rebelSize = fitFontSize(cfg.text.rebel, iw - 40, 22);
  const rebelL = layoutText(cfg.text.rebel, rebelFont(rebelSize));
  const punishL = layoutText(cfg.text.punish, punishFont(19));
  ctx.textBaseline = 'alphabetic';
  // Your rebel lines first; the rest of the board is the "official" punishment.
  for (let r = 0; r < rows; r++) {
    const rebel = r < lines;
    const golden = rebel && r < (summary.goldenLines || 0) * 3 && r % 3 === 1;
    const L = rebel ? rebelL : punishL;
    ctx.font = rebel ? rebelFont(rebelSize) : punishFont(19);
    ctx.fillStyle = chalkPattern(ctx, rebel ? (golden ? 'gold' : opts.goldenChalk ? 'goldChalk' : 'white') : 'dim');
    ctx.shadowColor = golden ? 'rgba(255,190,60,0.6)' : 'rgba(255,255,255,0.25)';
    ctx.shadowBlur = (rebel ? (golden ? 6 : 2) : 0) * dpr;
    ctx.globalAlpha = rebel ? 1 : 0.55;
    const ox = ix + 16 + (hash01(r, 3) - 0.5) * 6;
    for (let i = 0; i < L.chars.length; i++) {
      const c = L.chars[i];
      drawGlyph(ctx, c.ch, ox + c.x, iy + rh * (r + 1) - 7, c.w, 5000 + r, i, 1, { jitter: rebel ? 1 : 1.6 });
    }
    ctx.globalAlpha = 1;
  }
  ctx.shadowBlur = 0;
  if (lines > rows) {
    // tally the overflow, circled in chalk
    ctx.save();
    ctx.translate(ix + iw - 62, iy + ih - 36);
    ctx.rotate(-0.12);
    ctx.font = rebelFont(30);
    ctx.fillStyle = chalkPattern(ctx, 'gold');
    ctx.textAlign = 'center';
    ctx.fillText(`×${lines}`, 0, 10);
    ctx.strokeStyle = 'rgba(255,214,92,0.85)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.ellipse(0, 0, 50, 26, 0, 0.2, Math.PI * 2.1);
    ctx.stroke();
    ctx.restore();
  }
  if (opts.mascot) {
    const mh = 300;
    const mw = (mh * opts.mascot.width) / opts.mascot.height;
    ctx.drawImage(opts.mascot, -6, h - 132, mw, mh);
  }
}
