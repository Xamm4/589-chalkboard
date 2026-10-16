// Chalk look: grainy fill patterns, jittered glyph layout and stroke-reveal drawing.

import { hash01 } from '../rng.js';
import { FONTS } from './assets.js';

export const REBEL_SIZE = 27;
export const rebelFont = (size = REBEL_SIZE) => `700 ${size}px ${FONTS.chalk}`;
export const punishFont = (size = 19) => `${size}px ${FONTS.hand}`;

const grainCache = new Map();

// A tile of chalk grain: mostly opaque specks with random holes.
function grainCanvas(rgb, density = 0.82, seed = 7) {
  const key = `${rgb}|${density}|${seed}`;
  if (grainCache.has(key)) return grainCache.get(key);
  const size = 96;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const img = g.createImageData(size, size);
  const [r, gg, b] = rgb;
  for (let i = 0; i < size * size; i++) {
    const h = hash01(i, seed);
    const h2 = hash01(i * 3 + 1, seed + 11);
    let a = h < density ? 0.62 + 0.38 * h2 : 0.05 + 0.2 * h2;
    // occasional streaks, like chalk skipping over the board's grain
    if ((i % size) % 23 === 0 && h2 > 0.6) a *= 0.45;
    img.data[i * 4] = r;
    img.data[i * 4 + 1] = gg;
    img.data[i * 4 + 2] = b;
    img.data[i * 4 + 3] = Math.round(a * 255);
  }
  g.putImageData(img, 0, 0);
  grainCache.set(key, c);
  return c;
}

const patternCache = new WeakMap();

export function chalkPattern(ctx, kind = 'white') {
  let byKind = patternCache.get(ctx);
  if (!byKind) patternCache.set(ctx, (byKind = {}));
  if (byKind[kind]) return byKind[kind];
  const spec = {
    white: [[246, 246, 238], 0.84, 7],
    dim: [[214, 222, 210], 0.66, 13],
    gold: [[255, 214, 92], 0.86, 21],
    goldChalk: [[255, 226, 140], 0.84, 29],
    pink: [[255, 170, 170], 0.8, 31],
  }[kind];
  const p = ctx.createPattern(grainCanvas(...spec), 'repeat');
  if (p.setTransform && typeof DOMMatrix !== 'undefined') p.setTransform(new DOMMatrix().scale(0.55));
  byKind[kind] = p;
  return p;
}

// Per-text glyph layout (x offsets from the line start), cached per font.
const layoutCache = new Map();
let measureCtx = null;

export function layoutText(text, font, breakAt = -1, indent = 18) {
  const key = `${font}|${text}|${breakAt}`;
  if (layoutCache.has(key)) return layoutCache.get(key);
  measureCtx ??= document.createElement('canvas').getContext('2d');
  measureCtx.font = font;
  const chars = [];
  let x = 0;
  let row = 0;
  for (let i = 0; i < text.length; i++) {
    if (breakAt > 0 && i === breakAt) {
      row = 1;
      x = indent;
    }
    const ch = text[i];
    const w = measureCtx.measureText(ch).width + (ch === ' ' ? 1 : 0.6);
    chars.push({ ch, x, w, row });
    x += w;
  }
  const width = Math.max(...chars.map((c) => c.x + c.w));
  const res = { chars, width };
  layoutCache.set(key, res);
  return res;
}

export function fitFontSize(text, maxWidth, base = REBEL_SIZE) {
  measureCtx ??= document.createElement('canvas').getContext('2d');
  measureCtx.font = rebelFont(base);
  const w = measureCtx.measureText(text).width + text.length * 0.6;
  return w > maxWidth ? Math.floor(base * (maxWidth / w) * 10) / 10 : base;
}

// One glyph with hand jitter. `frac` < 1 reveals it left→right like a chalk stroke.
export function drawGlyph(ctx, ch, x, y, w, seedA, seedB, frac = 1, opts = {}) {
  if (ch === ' ' || frac <= 0) return;
  const jitter = opts.jitter ?? 1;
  const rot = (hash01(seedA, seedB) - 0.5) * 0.1 * jitter;
  const dy = (hash01(seedA, seedB + 97) - 0.5) * 3.2 * jitter;
  const sc = 1 + (hash01(seedA, seedB + 31) - 0.5) * 0.09 * jitter;
  ctx.save();
  ctx.translate(x + w / 2, y + dy);
  ctx.rotate(rot);
  ctx.scale(sc, sc);
  if (frac < 1) {
    ctx.beginPath();
    ctx.rect(-w / 2 - 2, -40, (w + 4) * frac, 60);
    ctx.clip();
  }
  ctx.fillText(ch, -w / 2, 0);
  ctx.restore();
}

// A rough chalk stroke (for X marks, tallies, underlines).
export function chalkStroke(ctx, pts, width = 3, seed = 1, alpha = 0.92) {
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (let pass = 0; pass < 3; pass++) {
    ctx.globalAlpha = alpha * (pass === 0 ? 0.9 : 0.35);
    ctx.lineWidth = width * (pass === 0 ? 1 : 0.55);
    ctx.beginPath();
    for (let i = 0; i < pts.length; i++) {
      const jx = (hash01(seed + i, pass + 3) - 0.5) * (pass ? 2.2 : 0.8);
      const jy = (hash01(seed + i, pass + 17) - 0.5) * (pass ? 2.2 : 0.8);
      if (i === 0) ctx.moveTo(pts[i][0] + jx, pts[i][1] + jy);
      else ctx.lineTo(pts[i][0] + jx, pts[i][1] + jy);
    }
    ctx.stroke();
  }
  ctx.restore();
}
