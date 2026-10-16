// Local persistence (best score, lifetime lines, settings). Every access is guarded: storage can
// be missing or throw (private mode, blocked cookies, sandboxed iframes).

const DEFAULTS = {
  best: 0,
  bestLines: 0,
  bestDay: 0,
  lifetimeLines: 0,
  runs: 0,
  eoyClears: 0,
  muted: false,
  tutorialDone: false,
  goldenUnlocked: false,
  goldenOn: true,
  goldenCelebrated: false,
};

export class Storage {
  constructor(key) {
    this.key = key;
    this.data = { ...DEFAULTS };
    try {
      const raw = window.localStorage.getItem(key);
      if (raw) this.data = { ...DEFAULTS, ...JSON.parse(raw) };
    } catch {
      /* in-memory only */
    }
  }

  get(k) {
    return this.data[k];
  }

  set(patch) {
    Object.assign(this.data, patch);
    try {
      window.localStorage.setItem(this.key, JSON.stringify(this.data));
    } catch {
      /* ignore */
    }
  }

  // Fold a finished run into the records. Returns what changed (for the results screen).
  recordRun(s, goal) {
    const d = this.data;
    const before = d.lifetimeLines;
    const res = {
      newBest: s.score > d.best,
      prevBest: d.best,
      lifetimeBefore: before,
      lifetimeAfter: before + s.lines,
      unlockedGolden: !d.goldenUnlocked && before + s.lines >= goal,
    };
    this.set({
      best: Math.max(d.best, s.score),
      bestLines: Math.max(d.bestLines, s.lines),
      bestDay: Math.max(d.bestDay, s.dayIndex + (s.win ? 1 : 0)),
      lifetimeLines: before + s.lines,
      runs: d.runs + (s.overtime ? 0 : 1),
      eoyClears: d.eoyClears + (s.win && !s.overtime ? 1 : 0),
      goldenUnlocked: d.goldenUnlocked || res.unlockedGolden,
    });
    return res;
  }
}
