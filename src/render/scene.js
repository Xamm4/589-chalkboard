// Static classroom art, pre-rendered into offscreen layers at the current resolution.

import { W, H, BOARD, INNER, TRAY, FLOOR_Y, CLOCK, PORTRAIT, SWITCH, DOOR, DESK, TRASH } from './layout.js';
import { hash01 } from '../rng.js';
import { FONTS } from './assets.js';

export const INK = '#1d130d';

export function makeLayer(rs, w = W, h = H) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w * rs));
  c.height = Math.max(1, Math.round(h * rs));
  const ctx = c.getContext('2d');
  ctx.setTransform(rs, 0, 0, rs, 0, 0);
  return { c, ctx };
}

export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function outlined(ctx, fill, lw = 3, stroke = INK) {
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = lw;
  ctx.strokeStyle = stroke;
  ctx.stroke();
}

function drawWall(ctx) {
  const g = ctx.createLinearGradient(0, 0, 0, FLOOR_Y);
  g.addColorStop(0, '#b9d3ab');
  g.addColorStop(0.55, '#a8c69c');
  g.addColorStop(1, '#93b489');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, FLOOR_Y);
  // faint vertical wallpaper stripes
  ctx.fillStyle = 'rgba(255,255,255,0.05)';
  for (let x = 0; x < W; x += 28) ctx.fillRect(x, 0, 12, FLOOR_Y);
  // mottled paint
  for (let i = 0; i < 140; i++) {
    const x = hash01(i, 1) * W;
    const y = hash01(i, 2) * FLOOR_Y;
    const r = 6 + hash01(i, 3) * 30;
    ctx.fillStyle = hash01(i, 4) > 0.5 ? 'rgba(255,255,240,0.035)' : 'rgba(40,70,40,0.03)';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  // wainscot + chair rail
  const wy = 604;
  const wg = ctx.createLinearGradient(0, wy, 0, FLOOR_Y);
  wg.addColorStop(0, '#6f9468');
  wg.addColorStop(1, '#5d8257');
  ctx.fillStyle = wg;
  ctx.fillRect(0, wy, W, FLOOR_Y - wy);
  ctx.strokeStyle = 'rgba(20,40,20,0.25)';
  ctx.lineWidth = 2;
  for (let x = 14; x < W; x += 66) {
    roundRect(ctx, x, wy + 18, 52, FLOOR_Y - wy - 40, 4);
    ctx.stroke();
  }
  ctx.fillStyle = '#7a5232';
  ctx.fillRect(0, wy - 6, W, 10);
  ctx.fillStyle = 'rgba(255,230,190,0.35)';
  ctx.fillRect(0, wy - 6, W, 2);
  ctx.fillStyle = INK;
  ctx.fillRect(0, wy + 4, W, 2);
  // baseboard
  ctx.fillStyle = '#5a3a22';
  ctx.fillRect(0, FLOOR_Y - 14, W, 14);
  ctx.fillStyle = INK;
  ctx.fillRect(0, FLOOR_Y - 15, W, 2);
}

function drawFloor(ctx) {
  const g = ctx.createLinearGradient(0, FLOOR_Y, 0, H);
  g.addColorStop(0, '#7b4f2e');
  g.addColorStop(1, '#a06a3d');
  ctx.fillStyle = g;
  ctx.fillRect(0, FLOOR_Y, W, H - FLOOR_Y);
  // planks: rows get taller toward the viewer
  let y = FLOOR_Y;
  let h = 14;
  let row = 0;
  ctx.lineWidth = 1.5;
  while (y < H) {
    ctx.strokeStyle = 'rgba(40,20,8,0.45)';
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
    const seg = 90 + row * 12;
    for (let x = (hash01(row, 5) * seg) | 0; x < W; x += seg) {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, y + h);
      ctx.stroke();
    }
    ctx.fillStyle = `rgba(255,220,170,${0.03 + hash01(row, 9) * 0.04})`;
    ctx.fillRect(0, y + 1, W, h * 0.4);
    y += h;
    h *= 1.18;
    row++;
  }
  // contact shadow along the wall
  const sg = ctx.createLinearGradient(0, FLOOR_Y, 0, FLOOR_Y + 30);
  sg.addColorStop(0, 'rgba(20,10,4,0.35)');
  sg.addColorStop(1, 'rgba(20,10,4,0)');
  ctx.fillStyle = sg;
  ctx.fillRect(0, FLOOR_Y, W, 30);
}

function drawBoardFrame(ctx) {
  const { x, y, w, h } = BOARD;
  // wall shadow
  ctx.fillStyle = 'rgba(20,35,20,0.28)';
  roundRect(ctx, x + 5, y + 7, w, h, 8);
  ctx.fill();
  // frame
  roundRect(ctx, x, y, w, h, 7);
  const fg = ctx.createLinearGradient(x, y, x, y + h);
  fg.addColorStop(0, '#b07a45');
  fg.addColorStop(1, '#8a5a30');
  outlined(ctx, fg, 3);
  // wood grain
  ctx.strokeStyle = 'rgba(70,40,15,0.25)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 6; i++) {
    ctx.beginPath();
    ctx.moveTo(x + 6, y + 4 + i * 2);
    ctx.lineTo(x + w - 6, y + 4 + i * 2 + Math.sin(i) * 1.5);
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(255,230,190,0.35)';
  ctx.fillRect(x + 6, y + 3, w - 12, 2);
  // inner bevel
  ctx.fillStyle = '#5c3a1c';
  ctx.fillRect(INNER.x - 3, INNER.y - 3, INNER.w + 6, INNER.h + 6);
  ctx.fillStyle = INK;
  ctx.fillRect(INNER.x - 1, INNER.y - 1, INNER.w + 2, INNER.h + 2);
  // screws
  for (const [sx, sy] of [[x + 7, y + 7], [x + w - 7, y + 7], [x + 7, y + h - 7], [x + w - 7, y + h - 7]]) {
    ctx.fillStyle = '#d8c09a';
    ctx.beginPath();
    ctx.arc(sx, sy, 2.4, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawTray(ctx) {
  const { x, y, w, h } = TRAY;
  // shadow under the ledge
  ctx.fillStyle = 'rgba(20,35,20,0.3)';
  ctx.fillRect(x, y + h, w, 10);
  // ledge top
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + w, y);
  ctx.lineTo(x + w - 4, y + 7);
  ctx.lineTo(x, y + 7);
  ctx.closePath();
  outlined(ctx, '#c08a52', 2);
  // ledge front
  ctx.beginPath();
  ctx.rect(x, y + 7, w - 4, h - 7);
  outlined(ctx, '#8d5c33', 2.5);
  // chalk dust along the ledge
  for (let i = 0; i < 70; i++) {
    ctx.fillStyle = `rgba(255,255,255,${0.15 + hash01(i, 40) * 0.35})`;
    ctx.fillRect(x + 6 + hash01(i, 41) * (w - 20), y + 1 + hash01(i, 42) * 5, 1.2 + hash01(i, 43) * 2.5, 1);
  }
  // chalk sticks
  const sticks = [[60, 0.05, '#fdfdf6'], [92, -0.12, '#fdfdf6'], [250, 0.2, '#ffe9a8'], [268, -0.02, '#fdfdf6']];
  for (const [sx, rot, col] of sticks) {
    ctx.save();
    ctx.translate(x + sx, y + 1);
    ctx.rotate(rot);
    roundRect(ctx, -11, -4.5, 22, 6, 3);
    outlined(ctx, col, 1.2);
    ctx.restore();
  }
  // felt eraser
  ctx.save();
  ctx.translate(x + 170, y - 6);
  roundRect(ctx, -26, -3, 52, 10, 3);
  outlined(ctx, '#3d4f7a', 2);
  roundRect(ctx, -26, 5, 52, 6, 2);
  outlined(ctx, '#d9d4c7', 1.5);
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.fillRect(-22, -1, 44, 2);
  ctx.restore();
}

function drawClockBody(ctx) {
  const { x, y, r } = CLOCK;
  ctx.fillStyle = 'rgba(20,35,20,0.25)';
  ctx.beginPath();
  ctx.arc(x + 4, y + 5, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  const rg = ctx.createLinearGradient(x, y - r, x, y + r);
  rg.addColorStop(0, '#ef5a43');
  rg.addColorStop(1, '#b52a1f');
  outlined(ctx, rg, 3);
  ctx.beginPath();
  ctx.arc(x, y, r - 8, 0, Math.PI * 2);
  outlined(ctx, '#fbf6ea', 2);
  ctx.strokeStyle = INK;
  for (let i = 0; i < 60; i++) {
    const a = (i / 60) * Math.PI * 2;
    const big = i % 5 === 0;
    const r0 = r - 10;
    const r1 = big ? r - 16 : r - 12.5;
    ctx.lineWidth = big ? 2 : 0.8;
    ctx.beginPath();
    ctx.moveTo(x + Math.sin(a) * r0, y - Math.cos(a) * r0);
    ctx.lineTo(x + Math.sin(a) * r1, y - Math.cos(a) * r1);
    ctx.stroke();
  }
  ctx.fillStyle = INK;
  ctx.font = `10px ${FONTS.display}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('12', x, y - r + 23);
  ctx.fillText('3', x + r - 22, y + 1);
  ctx.fillText('6', x, y + r - 21);
  ctx.fillText('9', x - r + 22, y + 1);
  // glass glare
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.beginPath();
  ctx.ellipse(x - 12, y - 16, 14, 7, -0.6, 0, Math.PI * 2);
  ctx.fill();
}

function drawPortrait(ctx, coin) {
  const { x, y, w, h } = PORTRAIT;
  ctx.fillStyle = 'rgba(20,35,20,0.28)';
  ctx.fillRect(x + 4, y + 6, w, h);
  // nail + string
  ctx.strokeStyle = 'rgba(30,20,10,0.6)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(x + 18, y + 4);
  ctx.lineTo(x + w / 2, y - 14);
  ctx.lineTo(x + w - 18, y + 4);
  ctx.stroke();
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.arc(x + w / 2, y - 14, 2, 0, Math.PI * 2);
  ctx.fill();
  roundRect(ctx, x, y, w, h, 3);
  const fg = ctx.createLinearGradient(x, y, x + w, y + h);
  fg.addColorStop(0, '#e2b54c');
  fg.addColorStop(0.5, '#a8771f');
  fg.addColorStop(1, '#d6a640');
  outlined(ctx, fg, 2.5);
  ctx.fillStyle = '#efe6cf';
  ctx.fillRect(x + 8, y + 8, w - 16, h - 16);
  ctx.strokeStyle = 'rgba(80,50,10,0.5)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 8, y + 8, w - 16, h - 16);
  const s = w - 26;
  const ix = x + 13;
  const iy = y + 13;
  if (coin) {
    ctx.drawImage(coin, ix, iy, s, s);
  } else {
    ctx.fillStyle = '#16204a';
    ctx.fillRect(ix, iy, s, s);
    ctx.fillStyle = '#f3c24a';
    ctx.font = `20px ${FONTS.display}`;
    ctx.textAlign = 'center';
    ctx.fillText('$589', ix + s / 2, iy + s / 2 + 7);
  }
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.2;
  ctx.strokeRect(ix, iy, s, s);
  // brass plaque
  roundRect(ctx, x + w / 2 - 22, y + h - 14, 44, 10, 2);
  outlined(ctx, '#d9b25a', 1);
  ctx.fillStyle = '#3b2a10';
  ctx.font = `7px ${FONTS.display}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('IN 589 WE TRUST', x + w / 2, y + h - 8.6);
  // glass glare
  ctx.fillStyle = 'rgba(255,255,255,0.14)';
  ctx.beginPath();
  ctx.moveTo(ix, iy);
  ctx.lineTo(ix + s * 0.45, iy);
  ctx.lineTo(ix, iy + s * 0.45);
  ctx.closePath();
  ctx.fill();
}

function drawSwitch(ctx) {
  const { x, y, w, h } = SWITCH;
  roundRect(ctx, x, y, w, h, 3);
  outlined(ctx, '#f1ead6', 1.8);
  roundRect(ctx, x + w / 2 - 3, y + 7, 6, 10, 2);
  outlined(ctx, '#d9cfb4', 1.2);
}

function drawDoor(ctx) {
  const { x, y, w, h, win } = DOOR;
  ctx.fillStyle = 'rgba(20,35,20,0.25)';
  ctx.fillRect(x - 6, y - 6, w + 12, h + 6);
  // frame
  ctx.beginPath();
  ctx.rect(x - 6, y - 8, w + 10, h + 8);
  outlined(ctx, '#6b4428', 2.5);
  // door slab
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  const dg = ctx.createLinearGradient(x, 0, x + w, 0);
  dg.addColorStop(0, '#9a6a42');
  dg.addColorStop(1, '#7f5432');
  outlined(ctx, dg, 2.5);
  // lower panels
  ctx.strokeStyle = 'rgba(40,20,8,0.45)';
  ctx.lineWidth = 2;
  roundRect(ctx, x + 14, y + 140, w - 28, 96, 3);
  ctx.stroke();
  roundRect(ctx, x + 14, y + 252, w - 28, 96, 3);
  ctx.stroke();
  // window
  ctx.beginPath();
  ctx.rect(win.x - 4, win.y - 4, win.w + 8, win.h + 8);
  outlined(ctx, '#5f3c22', 2);
  ctx.beginPath();
  ctx.rect(win.x, win.y, win.w, win.h);
  const wg = ctx.createLinearGradient(win.x, win.y, win.x + win.w, win.y + win.h);
  wg.addColorStop(0, '#d7e8ec');
  wg.addColorStop(1, '#93b3bf');
  outlined(ctx, wg, 1.5);
  // hallway hint: lockers behind the glass
  ctx.fillStyle = 'rgba(70,100,120,0.22)';
  for (let i = 0; i < 4; i++) ctx.fillRect(win.x + 3 + i * 15, win.y + 30, 12, win.h - 30);
  // knob
  ctx.beginPath();
  ctx.arc(x + 12, y + 196, 6, 0, Math.PI * 2);
  outlined(ctx, '#e0b64e', 1.8);
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.beginPath();
  ctx.arc(x + 10, y + 194, 1.6, 0, Math.PI * 2);
  ctx.fill();
}

// Panes of window glass + glare, drawn above anything seen through the door window.
export function drawDoorGlare(ctx) {
  const { win } = DOOR;
  ctx.save();
  ctx.beginPath();
  ctx.rect(win.x, win.y, win.w, win.h);
  ctx.clip();
  ctx.fillStyle = 'rgba(255,255,255,0.32)';
  ctx.beginPath();
  ctx.moveTo(win.x + 8, win.y);
  ctx.lineTo(win.x + 24, win.y);
  ctx.lineTo(win.x + 4, win.y + win.h * 0.6);
  ctx.lineTo(win.x - 12, win.y + win.h * 0.6);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = '#5f3c22';
  ctx.lineWidth = 2;
  ctx.strokeRect(win.x, win.y, win.w, win.h);
}

export function drawBackground(ctx, assets) {
  drawWall(ctx);
  drawFloor(ctx);
  drawDoor(ctx);
  drawBoardFrame(ctx);
  drawTray(ctx);
  drawClockBody(ctx);
  drawPortrait(ctx, assets.coin);
  drawSwitch(ctx);
}

// Teacher's desk, trash can and props that sit in front of the characters.
export function drawForeground(ctx) {
  const { x, y, w, h } = DESK;
  // floor shadow
  ctx.fillStyle = 'rgba(30,15,5,0.35)';
  ctx.beginPath();
  ctx.ellipse(x + w / 2 + 10, y + h - 4, w / 2 + 20, 18, 0, 0, Math.PI * 2);
  ctx.fill();
  // desktop
  ctx.beginPath();
  ctx.moveTo(x + 10, y);
  ctx.lineTo(x + w + 20, y);
  ctx.lineTo(x + w + 20, y + 24);
  ctx.lineTo(x - 4, y + 24);
  ctx.closePath();
  const tg = ctx.createLinearGradient(0, y, 0, y + 24);
  tg.addColorStop(0, '#b47a47');
  tg.addColorStop(1, '#9a643a');
  outlined(ctx, tg, 3);
  ctx.fillStyle = 'rgba(255,225,180,0.35)';
  ctx.fillRect(x + 12, y + 2, w, 2);
  // front panel
  ctx.beginPath();
  ctx.rect(x, y + 24, w + 20, h);
  const fg = ctx.createLinearGradient(0, y + 24, 0, H);
  fg.addColorStop(0, '#7e4d2b');
  fg.addColorStop(1, '#5e381e');
  outlined(ctx, fg, 3);
  // modesty panel inset
  ctx.strokeStyle = 'rgba(30,15,5,0.5)';
  ctx.lineWidth = 2;
  roundRect(ctx, x + 16, y + 40, w - 20, h - 40, 4);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,210,160,0.08)';
  ctx.fillRect(x + 18, y + 42, w - 24, 10);
  // name plate
  const px = x + 82;
  const py = y + 74;
  roundRect(ctx, px - 64, py - 15, 128, 30, 4);
  const pg = ctx.createLinearGradient(0, py - 15, 0, py + 15);
  pg.addColorStop(0, '#f2d27a');
  pg.addColorStop(1, '#b98a2c');
  outlined(ctx, pg, 2.5);
  ctx.fillStyle = '#3a2708';
  ctx.font = `14px ${FONTS.display}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('THE REGULATOR', px, py + 2);
  // trash can
  drawTrash(ctx);
}

function drawTrash(ctx) {
  const { x, y, w, h } = TRASH;
  ctx.fillStyle = 'rgba(30,15,5,0.35)';
  ctx.beginPath();
  ctx.ellipse(x + w / 2 + 4, y + h, w / 2 + 6, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  // paper balls spilling over
  const ball = (bx, by, r, seed) => {
    ctx.beginPath();
    for (let i = 0; i <= 9; i++) {
      const a = (i / 9) * Math.PI * 2;
      const rr = r * (0.82 + hash01(seed, i) * 0.3);
      const px = bx + Math.cos(a) * rr;
      const py = by + Math.sin(a) * rr;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    outlined(ctx, '#f6f1e3', 1.8);
    ctx.strokeStyle = 'rgba(80,70,50,0.45)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(bx - r * 0.5, by - r * 0.2);
    ctx.lineTo(bx + r * 0.1, by + r * 0.3);
    ctx.lineTo(bx + r * 0.5, by - r * 0.1);
    ctx.stroke();
  };
  ball(x + 14, y - 2, 10, 1);
  ball(x + 34, y - 4, 11, 2);
  ball(x + 24, y - 12, 9, 3);
  // can body (slightly tapered)
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + w, y);
  ctx.lineTo(x + w - 6, y + h);
  ctx.lineTo(x + 6, y + h);
  ctx.closePath();
  const g = ctx.createLinearGradient(x, 0, x + w, 0);
  g.addColorStop(0, '#9aa4ab');
  g.addColorStop(0.4, '#c9d0d4');
  g.addColorStop(1, '#7b858c');
  outlined(ctx, g, 2.5);
  ctx.strokeStyle = 'rgba(40,50,60,0.35)';
  ctx.lineWidth = 1.2;
  for (let i = 1; i < 6; i++) {
    const t = i / 6;
    ctx.beginPath();
    ctx.moveTo(x + w * t, y + 4);
    ctx.lineTo(x + 6 + (w - 12) * t, y + h - 3);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.ellipse(x + w / 2, y, w / 2, 4, 0, 0, Math.PI * 2);
  outlined(ctx, '#aeb7bd', 2);
  ball(x + w + 18, y + h - 6, 8, 4);
}

// Warm afternoon light + vignette, drawn over everything except UI text.
export function drawLight(ctx) {
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, 'rgba(255,196,120,0.16)');
  g.addColorStop(0.5, 'rgba(255,170,90,0.05)');
  g.addColorStop(1, 'rgba(60,30,90,0.08)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  // sun beams from an off-screen window (top-left)
  for (let i = 0; i < 3; i++) {
    const x0 = -60 + i * 120;
    const bg = ctx.createLinearGradient(x0, 0, x0 + 420, H);
    bg.addColorStop(0, 'rgba(255,235,190,0.075)');
    bg.addColorStop(1, 'rgba(255,235,190,0)');
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.moveTo(x0, -10);
    ctx.lineTo(x0 + 50 + i * 10, -10);
    ctx.lineTo(x0 + 470 + i * 30, H);
    ctx.lineTo(x0 + 330 + i * 30, H);
    ctx.closePath();
    ctx.fill();
  }
  const v = ctx.createRadialGradient(W / 2, H * 0.45, H * 0.3, W / 2, H * 0.5, H * 0.78);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(10,5,20,0.42)');
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, W, H);
}
