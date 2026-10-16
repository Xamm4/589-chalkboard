// Headless balance simulation: runs bot games through the real Game class and reports which
// day they reach. Usage:  node tests/balance.mjs [gamesPerProfile=1000]

import { Game, PHASE } from '../src/game.js';
import { CONFIG } from '../src/config.js';
import { Bot } from './bot.mjs';

const N = Number(process.argv[2] || 1000);
const DT = 1 / CONFIG.simHz;
const PROFILES = [
  // Reaction time is only part of a player; see tests/bot.mjs for the other knobs.
  { name: 'experienced 150ms', rt: 0.15, attention: 0.9, greed: 0.65, margin: 0.1, timing: 0.16 },
  { name: 'good        250ms', rt: 0.25, attention: 0.82, greed: 0.5, margin: 0.16, timing: 0.2 },
  { name: 'learning    320ms', rt: 0.32, attention: 0.76, greed: 0.45, margin: 0.19, timing: 0.22 },
  { name: 'first-timer 400ms', rt: 0.4, attention: 0.68, greed: 0.4, margin: 0.22, timing: 0.25 },
];
const LABELS = [...CONFIG.days.map((d) => d.id.toUpperCase()), 'CLEAR'];

function play(profile, seed) {
  const game = new Game({ seed });
  game.start({ seed });
  const bot = new Bot(game, { ...profile, seed: seed * 7 + 3 });
  let guard = 0;
  while (game.phase !== PHASE.RESULTS && guard++ < 60 * 60 * 12) {
    const holding = bot.step(DT);
    game.update(DT, { holding });
  }
  const s = game.summary();
  return { reached: s.win ? CONFIG.days.length : s.dayIndex, ...s, caughtBy: game.caughtReason };
}

function run() {
  const out = [];
  for (const p of PROFILES) {
    const hist = new Array(LABELS.length).fill(0);
    let score = 0, lines = 0, close = 0;
    const t0 = Date.now();
    for (let i = 0; i < N; i++) {
      const r = play(p, 1000 + i);
      hist[r.reached]++;
      score += r.score;
      lines += r.lines;
      close += r.closeCalls;
    }
    const median = (() => {
      let acc = 0;
      for (let d = 0; d < hist.length; d++) {
        acc += hist[d];
        if (acc >= N / 2) return LABELS[d];
      }
      return '?';
    })();
    const row = {
      profile: p.name,
      ...Object.fromEntries(LABELS.map((l, i) => [l, `${((hist[i] / N) * 100).toFixed(1)}%`])),
      median,
      avgScore: Math.round(score / N),
      avgLines: (lines / N).toFixed(1),
      avgClose: (close / N).toFixed(1),
      ms: Date.now() - t0,
    };
    out.push(row);
  }
  console.log(`\nChalkboard Rebel balance — ${N} games per profile (share of runs ENDING on each day)\n`);
  console.table(out);
}

run();
