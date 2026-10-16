// Boot, input, fixed-timestep loop, and wiring between game, renderer, audio and UI.

import { CONFIG } from './config.js';
import { Game, PHASE, earnedTitle } from './game.js';
import { T } from './teacher.js';
import { Renderer } from './render/renderer.js';
import { loadAssets } from './render/assets.js';
import { renderMemeBoard } from './render/cards.js';
import { Sound } from './audio.js';
import { Storage } from './storage.js';
import { UI } from './ui.js';

const $ = (id) => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

const params = new URLSearchParams(location.search);
const DEBUG = params.get('debug') === '1';
const SPEED = clamp(Number(params.get('speed')) || 1, 0.1, 8);
const FIXED_SEED = params.has('seed') ? Number(params.get('seed')) >>> 0 : null;
const START_DAY = params.has('day') ? clamp(Math.floor(Number(params.get('day')) || 0), 0, CONFIG.days.length) : 0;

const store = new Storage(CONFIG.storageKey);
const sound = new Sound(CONFIG);
sound.setMuted(store.get('muted'));
const reducedMQ = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };

const stage = $('stage');
const frame = $('frame');
const canvas = $('game');
const uiRoot = $('ui');

let game = null;
let renderer = null;
let ui = null;
let assets = null;
let paused = false;
let renderTime = 0;
let acc = 0;
let lastTs = 0;
let tutorial = !store.get('tutorialDone');
let countedLines = 0; // lines already folded into lifetime stats (overtime continues a run)
let lastTickSec = -1;
const input = { pointers: new Set(), key: false };
export const debugState = { slowmo: false };

const playing = () => game && !paused && !ui.menuOpen && [PHASE.PLAY, PHASE.CAUGHT, PHASE.CARD, PHASE.DAY_END].includes(game.phase);
const isHolding = () => (input.pointers.size > 0 || input.key) && !ui.menuOpen && !paused;

// ---------------------------------------------------------------- boot
async function boot() {
  ui = new UI(handlers);
  ui.setMuted(store.get('muted'));
  ui.touchFocusOnly = false;
  assets = await loadAssets((p) => ui.setLoading(p));
  renderer = new Renderer(canvas, assets, CONFIG);
  renderer.setReducedMotion(!!reducedMQ.matches);
  if (reducedMQ.addEventListener) reducedMQ.addEventListener('change', (e) => renderer.setReducedMotion(e.matches));
  game = new Game({ seed: FIXED_SEED ?? 589 });
  game.on(onGameEvent);
  resize();
  if (window.ResizeObserver) new ResizeObserver(resize).observe(stage);
  else window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', () => setTimeout(resize, 120));
  applyGolden();
  ui.setTitleStats(store.data, CONFIG.lifetimeGoal);
  ui.show('title');
  setupInput();
  requestAnimationFrame(loop);
  if (DEBUG) {
    const { initDebug } = await import('./debug.js');
    initDebug({ getGame: () => game, debugState, start: (day) => startRun(day) });
  }
  // Test/automation hook (read-only use is fine; it changes nothing on its own).
  window.__CR = { get game() { return game; }, PHASE, T, CONFIG, store, ui, renderer };
}

function resize() {
  if (!renderer) return;
  const w = stage.clientWidth || window.innerWidth;
  const h = stage.clientHeight || window.innerHeight;
  const s = renderer.resize(w, h, window.devicePixelRatio || 1);
  frame.style.width = `${Math.round(CONFIG.view.w * s)}px`;
  frame.style.height = `${Math.round(CONFIG.view.h * s)}px`;
  uiRoot.style.setProperty('--s', String(s));
}

function applyGolden() {
  if (renderer) renderer.board.goldenChalk = !!(store.get('goldenUnlocked') && store.get('goldenOn'));
}

// ---------------------------------------------------------------- loop
function loop(ts) {
  requestAnimationFrame(loop);
  const dtReal = lastTs ? Math.min(0.1, (ts - lastTs) / 1000) : 0;
  lastTs = ts;
  let visualScale = 1;
  if (!paused) {
    const slow = renderer.fx.slowmo > 0 ? 0.35 : 1;
    const dbg = debugState.slowmo ? 0.25 : 1;
    visualScale = slow * dbg;
    acc += dtReal * SPEED * visualScale;
    const step = 1 / CONFIG.simHz;
    let n = 0;
    const holding = isHolding();
    while (acc >= step && n < 16) {
      game.update(step, { holding });
      acc -= step;
      n++;
    }
    if (n === 16) acc = 0;
    renderTime += dtReal * visualScale;
    perFrame();
  }
  renderer.frame(game, paused ? 0 : dtReal * visualScale, renderTime);
}

function perFrame() {
  ui.setPlane(game.phase === PHASE.PLAY && game.events.airplane.state === 'ready');
  if (game.phase === PHASE.PLAY) {
    const left = Math.ceil(game.dayLeft);
    if (left <= 5 && left > 0 && left !== lastTickSec) {
      sound.play('tick');
      lastTickSec = left;
    }
  }
}

// ---------------------------------------------------------------- input
function setupInput() {
  stage.addEventListener('pointerdown', (e) => {
    sound.unlock();
    if (e.pointerType === 'touch') ui.touchFocusOnly = true;
    if (ui.menuOpen || paused) return;
    if (e.target.closest && e.target.closest('button')) return;
    e.preventDefault();
    input.pointers.add(e.pointerId);
    try {
      stage.setPointerCapture(e.pointerId);
    } catch {
      /* not all browsers allow capture here */
    }
  });
  const up = (e) => input.pointers.delete(e.pointerId);
  stage.addEventListener('pointerup', up);
  stage.addEventListener('pointercancel', up);
  stage.addEventListener('lostpointercapture', up);
  stage.addEventListener('contextmenu', (e) => e.preventDefault());
  document.addEventListener('gesturestart', (e) => e.preventDefault());
  document.addEventListener('dblclick', (e) => e.preventDefault());
  window.addEventListener('blur', () => {
    input.pointers.clear();
    input.key = false;
  });

  window.addEventListener('keydown', (e) => {
    const holdKey = e.code === 'Space' || e.code === 'Enter' || e.code === 'NumpadEnter';
    if (e.repeat) {
      if (holdKey && !ui.menuOpen) e.preventDefault();
      return;
    }
    sound.unlock();
    if (e.code === 'Escape' || e.code === 'KeyP') {
      if (paused) handlers.resume();
      else if (playing()) handlers.pause();
      e.preventDefault();
      return;
    }
    if (e.code === 'KeyA' && playing()) {
      handlers.throwPlane();
      return;
    }
    if (holdKey && !ui.menuOpen && !paused) {
      input.key = true;
      e.preventDefault();
    }
  });
  window.addEventListener('keyup', (e) => {
    if (e.code === 'Space' || e.code === 'Enter' || e.code === 'NumpadEnter') input.key = false;
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      input.pointers.clear();
      input.key = false;
      if (playing()) handlers.pause();
      sound.suspend();
    } else if (!paused) {
      sound.resume();
      lastTs = 0;
    }
  });
}

// ---------------------------------------------------------------- flow
function startRun(day = START_DAY) {
  sound.unlock();
  paused = false;
  ui.hideAll();
  renderer.tutorial = tutorial && day === 0;
  countedLines = 0;
  lastTickSec = -1;
  input.pointers.clear();
  input.key = false;
  game.start({ seed: FIXED_SEED ?? (Math.random() * 2 ** 32) >>> 0, day });
}

function endTutorial() {
  if (!tutorial) return;
  tutorial = false;
  renderer.tutorial = false;
  store.set({ tutorialDone: true });
}

function shareText() {
  const s = game.summary();
  const url = CONFIG.gameUrl ? ` ${CONFIG.gameUrl}` : '';
  return `I snuck ${s.lines} bullish lines past the Regulator ✏️ Reached ${s.dayLabel}. Can you make it to EOY? ${CONFIG.shareHandle} $589 $XRP${url}`;
}

async function copyText(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through */
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}

const handlers = {
  click: () => sound.play('click'),
  play: () => startRun(),
  menu: () => {
    paused = false;
    sound.resume();
    sound.stopMusic();
    game.setupIdle(589);
    ui.setTitleStats(store.data, CONFIG.lifetimeGoal);
    ui.show('title');
  },
  pause: () => {
    if (!playing()) return;
    paused = true;
    input.pointers.clear();
    input.key = false;
    sound.suspend();
    ui.show('pause');
  },
  resume: () => {
    paused = false;
    lastTs = 0;
    sound.resume();
    ui.hideAll();
  },
  overtime: () => {
    ui.hideAll();
    game.startOvertime();
  },
  toggleMute: () => {
    const m = !store.get('muted');
    store.set({ muted: m });
    sound.setMuted(m);
    ui.setMuted(m);
  },
  toggleGolden: () => {
    store.set({ goldenOn: !store.get('goldenOn') });
    applyGolden();
    ui.setTitleStats(store.data, CONFIG.lifetimeGoal);
  },
  throwPlane: () => {
    if (game && !paused) game.throwAirplane();
  },
  share: async () => {
    const text = shareText();
    const url = `https://x.com/intent/tweet?text=${encodeURIComponent(text)}`;
    let win = null;
    try {
      win = window.open(url, '_blank');
      if (win) win.opener = null;
    } catch {
      win = null;
    }
    if (!win) {
      // popups blocked (e.g. a sandboxed iframe): hand the text over instead
      const ok = await copyText(text);
      ui.toast(ok ? 'Popup blocked — text copied!' : 'Popup blocked');
    }
  },
  copy: async () => {
    const ok = await copyText(shareText());
    ui.toast(ok ? 'Copied! Paste it anywhere.' : 'Copy not allowed here');
  },
  unlockClosed: () => {
    store.set({ goldenCelebrated: true });
    applyGolden();
  },
};

function onGameEvent(type, d, g) {
  renderer.onGameEvent(type, d, g);
  sound.onGameEvent(type, d, g);
  switch (type) {
    case 'dayCard':
      if (g.dayIndex > 0) endTutorial();
      lastTickSec = -1;
      ui.announce(`${d.day.name}. Teacher mood: ${d.day.mood}.`);
      break;
    case 'caught':
      ui.announce(`Caught! Strike ${d.strikes}.`);
      break;
    case 'closeCall':
      ui.announce('So close!');
      break;
    case 'results':
      onResults(d);
      break;
  }
}

function onResults(s) {
  endTutorial();
  const delta = { ...s, lines: s.lines - countedLines };
  const rec = store.recordRun(delta, CONFIG.lifetimeGoal);
  countedLines = s.lines;
  renderMemeBoard($('res-board'), s, CONFIG, {
    mascot: assets.mascot,
    goldenChalk: renderer.board.goldenChalk,
  });
  ui.showResults(s, rec, { title: earnedTitle(s, CONFIG), goal: CONFIG.lifetimeGoal });
  if (rec.unlockedGolden) {
    setTimeout(() => {
      store.set({ goldenOn: true });
      applyGolden();
      ui.showUnlock();
      sound.play('unlock');
    }, 1100);
  }
}

boot().catch((err) => {
  console.error(err);
  const note = document.querySelector('.loading-note');
  if (note) note.textContent = 'Something went wrong. Please reload.';
});
