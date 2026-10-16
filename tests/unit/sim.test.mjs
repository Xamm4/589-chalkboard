// Unit tests for the DOM-free simulation:  node --test tests/unit/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RNG, hash01 } from '../../src/rng.js';
import { Teacher, T } from '../../src/teacher.js';
import { Board } from '../../src/writing.js';
import { Game, PHASE, dayParams, earnedTitle } from '../../src/game.js';
import { CONFIG } from '../../src/config.js';

const DT = 1 / 60;

function run(game, seconds, holding) {
  const n = Math.round(seconds / DT);
  for (let i = 0; i < n; i++) game.update(DT, { holding: typeof holding === 'function' ? holding(game) : holding });
}

test('rng is deterministic and in range', () => {
  const a = new RNG(42);
  const b = new RNG(42);
  for (let i = 0; i < 1000; i++) {
    const x = a.next();
    assert.equal(x, b.next());
    assert.ok(x >= 0 && x < 1);
  }
  assert.notEqual(new RNG(1).next(), new RNG(2).next());
  const h = hash01(3, 4);
  assert.equal(h, hash01(3, 4));
  assert.ok(h >= 0 && h < 1);
});

test('teacher cycles READING → TELL → LOOKING → RETURNING → READING', () => {
  const seen = [];
  const t = new Teacher(new RNG(5), (type, d) => type === 'teacherState' && seen.push(d.to));
  t.setDay({ ...dayParams(CONFIG, 0), fake: 0, snap: 0 });
  for (let i = 0; i < 60 * 30; i++) t.update(DT);
  const cycle = seen.filter((s, i) => i > 0 || s !== T.READING).slice(0, 4);
  assert.deepEqual(cycle, [T.TELL, T.LOOKING, T.RETURNING, T.READING]);
});

test('teacher cannot see during the head turn, then can', () => {
  const t = new Teacher(new RNG(9));
  const p = { ...dayParams(CONFIG, 0), fake: 0, snap: 0 };
  t.setDay(p);
  while (t.state !== T.LOOKING) t.update(DT);
  assert.equal(t.seeing, false);
  for (let i = 0; i < Math.ceil(p.turn / DT) + 1; i++) t.update(DT);
  assert.equal(t.seeing, true);
});

test('fake tells go back to reading without looking', () => {
  const states = [];
  const t = new Teacher(new RNG(1), (type, d) => type === 'teacherState' && states.push(d.to));
  t.setDay({ ...dayParams(CONFIG, 1), fake: 1, snap: 0 });
  for (let i = 0; i < 60 * 20; i++) t.update(DT);
  assert.ok(states.includes(T.FAKE_TELL));
  assert.ok(!states.includes(T.LOOKING));
});

test('board writes a rebel line at the configured speed and completes it', () => {
  const b = new Board(CONFIG, new RNG(3));
  b.ensureCurrent();
  const line = b.current;
  let done = null;
  let t = 0;
  while (!done && t < 10) {
    done = b.writeRebel(DT).completed;
    t += DT;
  }
  assert.ok(done, 'line completed');
  assert.equal(done.id, line.id);
  const letters = CONFIG.text.rebel.replace(/ /g, '').length;
  const spaces = CONFIG.text.rebel.length - letters;
  const expected = (letters + spaces * CONFIG.write.spaceFactor) / CONFIG.write.rebelLps;
  assert.ok(Math.abs(t - expected) < 0.05, `took ${t.toFixed(2)}s, expected ~${expected.toFixed(2)}s`);
  assert.equal(b.lines.length, 1);
  assert.equal(b.nextRow, 1);
});

test('board asks for a wipe when full', () => {
  const b = new Board({ ...CONFIG, golden: { ...CONFIG.golden, chance: 0 } }, new RNG(3));
  for (let i = 0; i < CONFIG.board.rows; i++) {
    assert.notEqual(b.ensureCurrent(), 'wipe');
    while (!b.writeRebel(0.5).completed);
  }
  assert.equal(b.ensureCurrent(), 'wipe');
  b.wipe();
  assert.equal(b.nextRow, 0);
  assert.ok(b.smudges.length > 0);
});

test('holding while he looks gets you caught; the line is erased', () => {
  const g = new Game({ seed: 1 });
  g.start({ seed: 1 });
  run(g, CONFIG.timing.dayCard + 0.05, false);
  assert.equal(g.phase, PHASE.PLAY);
  let caught = null;
  g.on((type, d) => {
    if (type === 'caught') caught = { ...d, streak: g.streak, current: g.board.current };
  });
  for (let i = 0; i < 60 * 15 && !caught; i++) g.update(DT, { holding: true });
  assert.ok(caught, 'caught');
  assert.equal(caught.strikes, 1);
  assert.equal(caught.streak, 0);
  assert.equal(caught.current, null, 'line in progress was erased');
  assert.ok(caught.line, 'erased line is handed to the renderer');
});

test('releasing on every tell never gets you caught and scores', () => {
  const g = new Game({ seed: 2 });
  g.start({ seed: 2 });
  let caught = 0;
  g.on((type) => type === 'caught' && caught++);
  run(g, 30, (game) => game.teacher.state === T.READING);
  assert.equal(caught, 0);
  assert.ok(g.score > 0);
  assert.ok(g.lines > 0);
});

test('close call: release just before the turn finishes', () => {
  const g = new Game({ seed: 4 });
  g.start({ seed: 4 });
  let close = 0;
  g.on((type) => type === 'closeCall' && close++);
  // hold until 0.1s before he can see, then let go
  run(g, 25, (game) => {
    const tch = game.teacher;
    if (tch.state === T.READING) return true;
    if (tch.state === T.TELL || tch.state === T.LOOKING) return tch.timeToSeeing > 0.1;
    return false;
  });
  assert.ok(close > 0, 'got a close call');
  assert.equal(g.strikes, 0);
});

test('missing the punishment quota at the bell costs a strike', () => {
  const g = new Game({ seed: 5 });
  g.start({ seed: 5 });
  g.invincible = true;
  let missed = false;
  g.on((type) => type === 'quotaMiss' && (missed = true));
  run(g, CONFIG.timing.dayCard + CONFIG.days[0].duration + 0.5, true);
  assert.ok(missed);
  assert.equal(g.strikes, 1);
});

test('three strikes ends the run on the results screen', () => {
  const g = new Game({ seed: 6 });
  g.start({ seed: 6 });
  run(g, 120, true);
  assert.equal(g.phase, PHASE.RESULTS);
  const s = g.summary();
  assert.equal(s.win, false);
  assert.ok(typeof earnedTitle(s) === 'string');
});

test('surviving EOY wins; overtime continues the run', () => {
  const g = new Game({ seed: 7 });
  g.start({ seed: 7, day: CONFIG.days.length - 1 });
  g.invincible = true;
  run(g, CONFIG.timing.dayCard + CONFIG.days.at(-1).duration + CONFIG.timing.dayEnd + CONFIG.timing.eoyWin + 1, false);
  assert.equal(g.phase, PHASE.RESULTS);
  assert.equal(g.summary().win, true);
  g.startOvertime();
  assert.equal(g.phase, PHASE.CARD);
  assert.equal(g.day.overtime, 1);
  assert.equal(g.strikes, 0);
});

test('paper airplane distracts him: no catch while distracted', () => {
  const g = new Game({ seed: 8 });
  g.start({ seed: 8, day: 2 });
  run(g, CONFIG.timing.dayCard + 0.1, false);
  g.events.airplane = { state: 'ready', t: 0 };
  assert.equal(g.throwAirplane(), true);
  assert.equal(g.teacher.state, T.DISTRACTED);
  let caught = 0;
  g.on((type) => type === 'caught' && caught++);
  run(g, CONFIG.events.airplane.distract - 0.1, true);
  assert.equal(caught, 0);
});

test('same seed + same inputs = same game', () => {
  const a = new Game({ seed: 9 });
  const b = new Game({ seed: 9 });
  a.start({ seed: 9 });
  b.start({ seed: 9 });
  const policy = (game) => game.teacher.state === T.READING;
  run(a, 60, policy);
  run(b, 60, policy);
  assert.equal(a.score, b.score);
  assert.equal(a.lines, b.lines);
  assert.equal(a.dayIndex, b.dayIndex);
});
