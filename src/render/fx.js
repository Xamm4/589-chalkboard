// Juice: particles, floating texts, stamp banners, screen-shake and camera zoom.

import { W, H } from './layout.js';
import { FONTS } from './assets.js';
import { roundRect, INK } from './scene.js';

const MAX_PARTS = 420;

let softSprite = null;
function soft() {
  if (softSprite) return softSprite;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const rg = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  rg.addColorStop(0, 'rgba(255,255,255,1)');
  rg.addColorStop(0.45, 'rgba(255,255,255,0.55)');
  rg.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = rg;
  g.fillRect(0, 0, 64, 64);
  softSprite = c;
  return c;
}

const CONFETTI = ['#fdfdf6', '#ffd23f', '#ff8fa3', '#7fd3ff', '#9ef0a0', '#ff9a3c'];

export class FX {
  constructor() {
    this.parts = [];
    this.texts = [];
    this.banners = [];
    this.trauma = 0;
    this.zoom = 1;
    this.zoomTarget = 1;
    this.zoomCx = W / 2;
    this.zoomCy = H / 2;
    this.flash = 0;
    this.flashColor = '255,255,255';
    this.reduced = false;
    this.particleScale = 1;
    this.slowmo = 0;
    this.rand = Math.random;
  }

  emit(p) {
    if (this.parts.length >= MAX_PARTS) this.parts.shift();
    this.parts.push(p);
  }

  count(n) {
    return Math.max(1, Math.round(n * this.particleScale * (this.reduced ? 0.4 : 1)));
  }

  dust(x, y, n = 3, opts = {}) {
    const r = this.rand;
    for (let i = 0; i < this.count(n); i++) {
      this.emit({
        type: 'soft', x: x + (r() - 0.5) * 6, y: y + (r() - 0.5) * 6,
        vx: (r() - 0.5) * 40 + (opts.vx || 0), vy: (r() - 0.7) * 30, g: 30,
        life: 0, max: 0.5 + r() * 0.5, size: (opts.size || 5) + r() * 5, alpha: opts.alpha ?? 0.5,
        color: opts.color || '255,255,255',
      });
    }
  }

  chunks(x, y, n = 8, color = '#fdfdf6') {
    const r = this.rand;
    for (let i = 0; i < this.count(n); i++) {
      this.emit({
        type: 'chunk', x, y, vx: (r() - 0.5) * 260, vy: -80 - r() * 220, g: 900,
        life: 0, max: 0.8 + r() * 0.5, size: 2 + r() * 4, rot: r() * 6, vr: (r() - 0.5) * 20, color,
      });
    }
  }

  cloud(x, y, n = 6, spread = 30) {
    const r = this.rand;
    for (let i = 0; i < this.count(n); i++) {
      this.emit({
        type: 'soft', x: x + (r() - 0.5) * spread, y: y + (r() - 0.5) * spread * 0.6,
        vx: (r() - 0.5) * 60, vy: -10 - r() * 30, g: -5, grow: 40,
        life: 0, max: 0.7 + r() * 0.6, size: 12 + r() * 16, alpha: 0.55, color: '240,245,238',
      });
    }
  }

  sparkle(x, y, n = 6, color = '255,214,92') {
    const r = this.rand;
    for (let i = 0; i < this.count(n); i++) {
      const a = r() * Math.PI * 2;
      const s = 40 + r() * 120;
      this.emit({
        type: 'spark', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, g: 60,
        life: 0, max: 0.4 + r() * 0.5, size: 2 + r() * 2.5, color,
      });
    }
  }

  confetti(n = 120) {
    const r = this.rand;
    for (let i = 0; i < this.count(n); i++) {
      this.emit({
        type: 'confetti', x: r() * W, y: -20 - r() * 300, vx: (r() - 0.5) * 80, vy: 80 + r() * 160, g: 60,
        life: 0, max: 4 + r() * 2, size: 4 + r() * 5, rot: r() * 6, vr: (r() - 0.5) * 10,
        color: CONFETTI[Math.floor(r() * CONFETTI.length)], wob: r() * 6,
      });
    }
  }

  sweat(x, y) {
    const r = this.rand;
    for (let i = 0; i < this.count(3); i++) {
      this.emit({
        type: 'drop', x: x + (r() - 0.5) * 40, y, vx: (r() - 0.5) * 120, vy: -140 - r() * 80, g: 700,
        life: 0, max: 0.7, size: 5 + r() * 2, color: '#8fd3ff',
      });
    }
  }

  motes(n = 1) {
    const r = this.rand;
    for (let i = 0; i < n; i++) {
      this.emit({
        type: 'soft', x: r() * W, y: 120 + r() * 600, vx: 6 + r() * 8, vy: -2 + r() * 4, g: 0,
        life: 0, max: 5 + r() * 4, size: 1.5 + r() * 2, alpha: 0.35, color: '255,240,200', fadeIn: true,
      });
    }
  }

  text(str, x, y, opts = {}) {
    this.texts.push({
      str, x, y, life: 0, max: opts.max || 1.1, size: opts.size || 26, color: opts.color || '#fff6dc',
      vy: opts.vy ?? -46, outline: opts.outline || INK, rot: opts.rot ?? (this.rand() - 0.5) * 0.12, font: opts.font || 'display',
    });
    if (this.texts.length > 24) this.texts.shift();
  }

  // Big stamp in screen space. kind: caught | close | gold | info | bad | win
  banner(str, kind = 'info', opts = {}) {
    this.banners = this.banners.filter((b) => b.kind !== kind || opts.stack);
    this.banners.push({ str, kind, life: 0, max: opts.max || 1.3, y: opts.y ?? H * 0.42, sub: opts.sub || '', size: opts.size });
  }

  shake(amount) {
    if (this.reduced) return;
    this.trauma = Math.min(1, this.trauma + amount);
  }

  zoomTo(z, cx = W / 2, cy = H / 2) {
    this.zoomTarget = z;
    this.zoomCx = cx;
    this.zoomCy = cy;
  }

  flashScreen(alpha = 0.6, color = '255,255,255') {
    if (this.reduced) alpha *= 0.4;
    this.flash = alpha;
    this.flashColor = color;
  }

  update(dt) {
    for (const p of this.parts) {
      p.life += dt;
      p.vy += p.g * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.vr) p.rot += p.vr * dt;
      if (p.grow) p.size += p.grow * dt;
      if (p.type === 'confetti') p.x += Math.sin(p.life * 3 + p.wob) * 30 * dt;
      if (p.type === 'chunk' && p.y > H - 20) {
        p.y = H - 20;
        p.vy *= -0.3;
        p.vx *= 0.6;
      }
    }
    this.parts = this.parts.filter((p) => p.life < p.max);
    for (const t of this.texts) {
      t.life += dt;
      t.y += t.vy * dt * (1 - t.life / t.max);
    }
    this.texts = this.texts.filter((t) => t.life < t.max);
    for (const b of this.banners) b.life += dt;
    this.banners = this.banners.filter((b) => b.life < b.max);
    this.trauma = Math.max(0, this.trauma - dt * 1.6);
    const zr = this.zoomTarget > this.zoom ? 9 : 4;
    this.zoom += (this.zoomTarget - this.zoom) * (1 - Math.exp(-zr * dt));
    this.flash = Math.max(0, this.flash - dt * 3);
    if (this.slowmo > 0) this.slowmo -= dt;
  }

  // Camera transform for the world layer.
  applyCamera(ctx, t) {
    const z = this.reduced ? 1 + (this.zoom - 1) * 0.5 : this.zoom;
    if (z !== 1) {
      ctx.translate(this.zoomCx, this.zoomCy);
      ctx.scale(z, z);
      ctx.translate(-this.zoomCx, -this.zoomCy);
    }
    if (this.trauma > 0) {
      const s = this.trauma * this.trauma * 14;
      ctx.translate(Math.sin(t * 91) * s, Math.cos(t * 77) * s);
      ctx.rotate(Math.sin(t * 53) * this.trauma * this.trauma * 0.012);
    }
  }

  drawWorld(ctx) {
    const sp = soft();
    for (const p of this.parts) {
      const k = p.life / p.max;
      if (p.type === 'soft') {
        let a = p.alpha * (1 - k);
        if (p.fadeIn) a = p.alpha * Math.sin(k * Math.PI);
        ctx.globalAlpha = a;
        const s = p.size * 2;
        ctx.drawImage(sp, p.x - s / 2, p.y - s / 2, s, s);
      } else if (p.type === 'chunk' || p.type === 'confetti') {
        ctx.globalAlpha = p.type === 'confetti' ? Math.min(1, (1 - k) * 3) : 1 - k * 0.5;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / (p.type === 'confetti' ? 1.6 : 2));
        ctx.restore();
      } else if (p.type === 'spark') {
        ctx.globalAlpha = 1 - k;
        ctx.fillStyle = `rgb(${p.color})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (1 - k * 0.5), 0, Math.PI * 2);
        ctx.fill();
      } else if (p.type === 'drop') {
        ctx.globalAlpha = 1 - k;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, p.size * 0.6, p.size, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
    for (const t of this.texts) this.drawText(ctx, t);
  }

  drawText(ctx, t) {
    const k = t.life / t.max;
    const pop = k < 0.15 ? 0.6 + (k / 0.15) * 0.55 : k < 0.25 ? 1.15 - ((k - 0.15) / 0.1) * 0.15 : 1;
    ctx.save();
    ctx.globalAlpha = k > 0.75 ? 1 - (k - 0.75) / 0.25 : 1;
    ctx.translate(t.x, t.y);
    ctx.rotate(t.rot);
    ctx.scale(pop, pop);
    ctx.font = `${t.size}px ${t.font === 'chalk' ? FONTS.chalk : FONTS.display}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(4, t.size * 0.22);
    ctx.strokeStyle = t.outline;
    ctx.strokeText(t.str, 0, 0);
    ctx.fillStyle = t.color;
    ctx.fillText(t.str, 0, 0);
    ctx.restore();
  }

  drawScreen(ctx) {
    if (this.flash > 0) {
      ctx.fillStyle = `rgba(${this.flashColor},${this.flash})`;
      ctx.fillRect(0, 0, W, H);
    }
    for (const b of this.banners) this.drawBanner(ctx, b);
  }

  drawBanner(ctx, b) {
    const k = b.life / b.max;
    const inT = Math.min(1, b.life / 0.16);
    const scale = b.life < 0.16 ? 2.2 - inT * 1.2 : 1 + Math.sin(Math.min(1, (b.life - 0.16) / 0.2) * Math.PI) * 0.06;
    const alpha = k > 0.82 ? 1 - (k - 0.82) / 0.18 : Math.min(1, inT * 1.5);
    const styles = {
      caught: { fill: '#e8382c', text: '#fff6e6', rot: -0.08, size: 64 },
      bad: { fill: '#e8382c', text: '#fff6e6', rot: 0.05, size: 40 },
      close: { fill: '#ffcf33', text: '#2a1a05', rot: 0.06, size: 56 },
      gold: { fill: '#ffcf33', text: '#2a1a05', rot: -0.04, size: 40 },
      info: { fill: '#fff3dc', text: '#14213d', rot: -0.03, size: 34 },
      dark: { fill: '#14213d', text: '#fff3dc', rot: 0.03, size: 40 },
      win: { fill: '#ff8a1f', text: '#fffaf0', rot: -0.05, size: 58 },
    };
    const st = styles[b.kind] || styles.info;
    const size = b.size || st.size;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(W / 2, b.y);
    ctx.rotate(st.rot);
    ctx.scale(scale, scale);
    ctx.font = `${size}px ${FONTS.display}`;
    const tw = ctx.measureText(b.str).width;
    const pw = Math.min(W - 30, tw + size * 0.9);
    const fit = Math.min(1, (W - 60) / (tw + size * 0.9));
    if (fit < 1) ctx.scale(fit, fit);
    const ph = size * 1.35 + (b.sub ? size * 0.55 : 0);
    roundRect(ctx, -pw / 2 / fit, -ph / 2, pw / fit, ph, 14);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.save();
    ctx.translate(5, 7);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = st.fill;
    ctx.fill();
    ctx.lineWidth = 5;
    ctx.strokeStyle = INK;
    ctx.stroke();
    ctx.fillStyle = st.text;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(b.str, 0, b.sub ? -size * 0.2 : size * 0.06);
    if (b.sub) {
      ctx.font = `${Math.round(size * 0.4)}px ${FONTS.display}`;
      ctx.fillText(b.sub, 0, size * 0.48);
    }
    ctx.restore();
  }
}
