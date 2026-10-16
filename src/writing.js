// Board model: what has been written where. Pure data, no rendering.
//
// Rebel lines fill the main rows top→bottom and stay there. Golden lines take two rows.
// The punishment line is written in a separate strip along the bottom of the board.

export class Board {
  constructor(config, rng) {
    this.cfg = config;
    this.rng = rng;
    this.rows = config.board.rows;
    this.reset();
  }

  reset() {
    this.lines = []; // completed rebel lines on the current board
    this.smudges = []; // ghost smudges of erased lines {row, span, seed}
    this.nextRow = 0;
    this.lineId = 0;
    this.linesSinceGolden = 0;
    this.totalLines = 0;
    this.current = null;
    this.punish = { progress: 0, id: 0 };
    this.version = 0; // bumps whenever the static board image must be redrawn
  }

  // Lines kept from a previous screen (title screen board decoration).
  seed(count) {
    for (let i = 0; i < count; i++) {
      const line = this.makeLine(false);
      line.progress = line.text.length;
      this.lines.push(line);
      this.nextRow += line.span;
    }
    this.version++;
  }

  makeLine(golden) {
    const text = golden ? this.cfg.text.golden : this.cfg.text.rebel;
    return {
      id: ++this.lineId,
      text,
      golden,
      row: this.nextRow,
      span: golden ? 2 : 1,
      progress: 0, // letters written (float)
      smudged: [], // indices of letters smudged by the FUD fly
    };
  }

  // Returns 'wipe' when the board is full and must be wiped first.
  ensureCurrent() {
    if (this.current) return null;
    let golden = false;
    const g = this.cfg.golden;
    if (this.totalLines >= g.firstAfter && this.linesSinceGolden >= g.minLinesBetween) {
      golden = this.rng.chance(g.chance);
    }
    if (this.nextRow + (golden ? 2 : 1) > this.rows) return 'wipe';
    this.current = this.makeLine(golden);
    return golden ? 'golden' : 'new';
  }

  wipe() {
    // Every erased row leaves a ghost behind.
    for (const l of this.lines) this.smudges.push({ row: l.row, span: l.span, seed: l.id, kind: 'wipe' });
    if (this.smudges.length > 24) this.smudges.splice(0, this.smudges.length - 24);
    this.lines = [];
    this.nextRow = 0;
    this.version++;
  }

  charDuration(ch, lps) {
    return (ch === ' ' ? this.cfg.write.spaceFactor : 1) / lps;
  }

  // Advance the rebel line by dt seconds. Returns written letters and a completed line, if any.
  writeRebel(dt, smudging = false) {
    const out = { letters: [], completed: null };
    const line = this.current;
    if (!line) return out;
    const lps = line.golden ? this.cfg.write.goldenLps : this.cfg.write.rebelLps;
    let time = dt;
    while (time > 0 && line.progress < line.text.length) {
      const idx = Math.floor(line.progress);
      const ch = line.text[idx];
      const need = (1 - (line.progress - idx)) * this.charDuration(ch, lps);
      if (time >= need) {
        time -= need;
        line.progress = idx + 1;
        if (ch !== ' ') {
          if (smudging) line.smudged.push(idx);
          out.letters.push({ index: idx, ch, smudged: smudging });
        }
      } else {
        line.progress += time / this.charDuration(ch, lps);
        time = 0;
      }
    }
    if (line.progress >= line.text.length) {
      line.progress = line.text.length;
      this.lines.push(line);
      this.nextRow += line.span;
      this.current = null;
      this.totalLines++;
      this.linesSinceGolden = line.golden ? 0 : this.linesSinceGolden + 1;
      this.version++;
      out.completed = line;
    }
    return out;
  }

  writePunish(dt) {
    const out = { letters: 0, completed: false };
    const text = this.cfg.text.punish;
    const p = this.punish;
    let time = dt;
    const lps = this.cfg.write.punishLps;
    while (time > 0) {
      const idx = Math.floor(p.progress);
      const ch = text[idx];
      const need = (1 - (p.progress - idx)) * this.charDuration(ch, lps);
      if (time >= need) {
        time -= need;
        p.progress = idx + 1;
        if (ch !== ' ') out.letters++;
        if (p.progress >= text.length) {
          p.progress = 0;
          p.id++;
          out.completed = true;
        }
      } else {
        p.progress += time / this.charDuration(ch, lps);
        time = 0;
      }
    }
    return out;
  }

  // Caught: the line in progress gets erased, leaving a smudge.
  eraseCurrent() {
    const line = this.current;
    if (!line) return null;
    if (line.progress > 0.5) this.smudges.push({ row: line.row, span: line.span, seed: line.id, kind: 'erase', progress: line.progress / line.text.length });
    if (this.smudges.length > 24) this.smudges.shift();
    this.current = null;
    this.version++;
    return line;
  }

  get currentRow() {
    return this.current ? this.current.row : this.nextRow;
  }
}
