// Every tunable number lives here. Times are in seconds unless noted.

const DAY_BASE = {
  duration: 45,
  quota: 3,
  read: [2.4, 4.6], // READING duration range
  firstRead: 1.4, // extra read time at the start of a day
  tell: 0.9, // TELL / FAKE_TELL duration (rustle → ahem → newspaper lowers)
  turn: 0.28, // head turn at the start of LOOKING; he can't see until it finishes
  look: [1.3, 2.2], // time spent actually looking (after the turn)
  ret: 0.42, // RETURNING: newspaper goes back up (safe)
  fake: 0, // chance a tell is a FAKE_TELL
  multiPeek: 0, // chance of an immediate re-peek after RETURNING
  multiPeekRead: [0.35, 0.7],
  snap: 0, // chance of a snap look (audio-only tell)
  snapTell: 0.5,
  tellStyle: 'obvious', // 'obvious' | 'sneaky' | 'walk'
  tellVis: 1, // how much of the tell the HUD eye shows (0..1)
  events: 0, // classroom events per day
  eventPool: [],
  airplane: false, // can a paper airplane spawn today?
  mode: 'desk', // 'desk' | 'walk' (EOY: he roams the room)
};

const day = (o) => ({ ...DAY_BASE, ...o });

export const CONFIG = {
  version: '1.0.0',
  // Public URL of the deployed game; appended to share text when set.
  gameUrl: 'https://xamm4.github.io/589-chalkboard/',
  shareHandle: '@589CTO',
  storageKey: 'chalkboardRebel_v1',

  view: { w: 540, h: 960, maxDpr: 2 },
  simHz: 60,

  text: {
    rebel: 'XRP TO HIT $589+ BY EOY',
    golden: 'XRP TO HIT $589+ BY EOY — NOT FINANCIAL ADVICE',
    goldenBreak: 25, // golden line wraps to a 2nd row after this many chars
    punish: 'I WILL NOT SHILL $589',
  },

  write: {
    rebelLps: 11, // letters per second while holding
    goldenLps: 8,
    punishLps: 4, // letters per second while released
    spaceFactor: 0.45, // spaces take this fraction of a letter's time
    chalkRegrab: 0.3, // penalty after a chalk break (re-press needed)
  },

  timing: {
    grace: 0.14, // after the head finishes turning, before a hold counts as caught
    closeCall: 0.18, // release this close before the turn ends → SO CLOSE!
    minHoldForCloseCall: 0.12,
    caughtFreeze: 0.25,
    caughtDuration: 2.0, // whole CAUGHT sequence (day clock paused)
    recoveryRead: 1.0, // extra read time after a catch
    dayCard: 2.1,
    dayEnd: 1.7,
    gameOver: 2.4,
    eoyWin: 3.4,
    lightsGrace: 0.3, // after a blackout ends
  },

  score: {
    letter: 1,
    line: 100,
    goldenMult: 3,
    closeCall: 250,
    punishLine: 10,
    streakMults: [1, 1.5, 2, 3, 5],
  },

  strikes: 3,
  golden: { chance: 0.16, minLinesBetween: 3, firstAfter: 2 },
  lifetimeGoal: 589,

  board: { rows: 11 },

  days: [
    day({
      id: 'mon', name: 'MONDAY', mood: 'Sleepy', blurb: 'He can barely keep his eyes open.',
      duration: 42, quota: 2, read: [3.0, 5.5], tell: 1.1, turn: 0.34, look: [1.4, 2.0],
    }),
    day({
      id: 'tue', name: 'TUESDAY', mood: 'Suspicious', blurb: 'He might be bluffing. Might.',
      duration: 45, quota: 3, read: [2.4, 4.6], tell: 0.95, turn: 0.3, look: [1.3, 2.2], fake: 0.25,
    }),
    day({
      id: 'wed', name: 'WEDNESDAY', mood: 'Caffeinated', blurb: 'Third coffee. Twitchy. Weird stuff happens.',
      duration: 48, quota: 3, read: [1.9, 3.7], tell: 0.78, turn: 0.25, look: [1.2, 2.2], fake: 0.25, ret: 0.36,
      events: 2, eventPool: ['bear', 'chalk', 'blackout', 'fly'], airplane: true,
    }),
    day({
      id: 'thu', name: 'THURSDAY', mood: 'Sneaky', blurb: 'Watch the window. Listen closely.',
      duration: 50, quota: 4, read: [1.7, 3.4], tell: 0.75, turn: 0.24, look: [1.1, 2.3], fake: 0.3,
      snap: 0.14, snapTell: 0.55, tellStyle: 'sneaky', tellVis: 0.55,
      events: 3, eventPool: ['bear', 'chalk', 'blackout', 'fly', 'principal'], airplane: true,
    }),
    day({
      id: 'fri', name: 'FRIDAY', mood: 'Paranoid', blurb: 'He peeks. Then peeks again.',
      duration: 52, quota: 4, read: [1.0, 2.4], tell: 0.5, turn: 0.2, look: [1.0, 2.5], fake: 0.4, ret: 0.32,
      multiPeek: 0.3, snap: 0.1, snapTell: 0.5,
      events: 3, eventPool: ['bear', 'chalk', 'blackout', 'fly', 'principal'], airplane: true,
    }),
    day({
      id: 'eoy', name: 'EOY', fullName: 'EOY — FINAL EXAM', mood: 'Boss', blurb: 'He walks the room. Only facing the board can he see you.',
      duration: 60, quota: 0, read: [1.3, 2.8], tell: 0.6, turn: 0.26, look: [1.0, 2.2], fake: 0.3, ret: 0.34,
      multiPeek: 0.2, snap: 0.08, snapTell: 0.5, tellStyle: 'walk', mode: 'walk',
      events: 4, eventPool: ['bear', 'chalk', 'blackout', 'fly', 'principal'], airplane: true,
    }),
  ],

  // Endless mode after EOY: each period is Friday, but meaner.
  overtime: {
    duration: 40,
    quota: 3,
    readScale: 0.9, // multiplied in per period
    minRead: [0.6, 1.4],
    tellScale: 0.95,
    minTell: 0.38,
    fakeAdd: 0.03,
    maxFake: 0.5,
  },

  events: {
    bear: { raise: 0.35, up: 1.9, down: 0.35, reactGrace: 0.25, snitchTurn: 0.16 },
    blackout: { dur: 3.0, flicker: 0.45, warn: 0.5 },
    principal: { dur: 5.5, readScale: 0.55 },
    fly: { dur: 4.0 },
    airplane: { distract: 3.0, spawnWindow: [0.12, 0.6] },
    spacing: 7, // min seconds between events
    margin: [6, 6], // no events in the first/last N seconds of a day
  },

  audio: {
    master: 0.8,
    music: 0.32,
    // Optional sample overrides: { bell: 'bell.mp3', ... } loaded from assets/sfx/.
    // Listed files are preloaded and preferred; everything else is synthesized.
    files: {},
  },

  fx: {
    shake: true,
    particles: 1,
  },
};

export const DAY_COUNT = CONFIG.days.length;
