// DOM screens: title, how-to, pause, results, unlock, toast. Pure presentation + callbacks.

const $ = (id) => document.getElementById(id);

export class UI {
  constructor(handlers) {
    this.h = handlers;
    this.current = 'loading';
    this.screens = ['loading', 'title', 'howto', 'pause', 'results'];
    this.lastFocus = null;
    const on = (id, fn) => $(id).addEventListener('click', (e) => {
      e.stopPropagation();
      this.h.click?.();
      fn(e);
    });
    on('btn-play', () => this.h.play());
    on('btn-howto', () => this.show('howto'));
    on('btn-howto-ok', () => this.show(this.howtoBack || 'title'));
    on('btn-mute', () => this.h.toggleMute());
    on('btn-sound2', () => this.h.toggleMute());
    on('btn-pause', () => this.h.pause());
    on('btn-resume', () => this.h.resume());
    on('btn-quit', () => this.h.menu());
    on('btn-again', () => this.h.play());
    on('btn-overtime', () => this.h.overtime());
    on('btn-share', () => this.h.share());
    on('btn-copy', () => this.h.copy());
    on('btn-menu', () => this.h.menu());
    on('btn-golden', () => this.h.toggleGolden());
    on('btn-unlock-ok', () => this.hideUnlock());
    // the airplane is a game action: react on pointerdown for zero latency
    const plane = $('btn-plane');
    plane.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      e.preventDefault();
      this.h.throwPlane();
    });
    plane.addEventListener('click', (e) => {
      e.stopPropagation();
      if (e.detail === 0) this.h.throwPlane(); // keyboard activation
    });
    for (const id of this.screens) $(id).addEventListener('pointerdown', (e) => e.stopPropagation());
    $('unlock').addEventListener('pointerdown', (e) => e.stopPropagation());
  }

  show(name) {
    for (const id of this.screens) $(id).classList.toggle('show', id === name);
    this.current = name;
    $('btn-pause').hidden = name !== null;
    const first = { title: 'btn-play', howto: 'btn-howto-ok', pause: 'btn-resume', results: 'btn-again' }[name];
    if (first && !this.touchFocusOnly) requestAnimationFrame(() => $(first).focus({ preventScroll: true }));
  }

  hideAll() {
    for (const id of this.screens) $(id).classList.remove('show');
    this.current = null;
    $('btn-pause').hidden = false;
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  }

  get menuOpen() {
    return this.current !== null || !$('unlock').hidden;
  }

  setLoading(p) {
    $('loading-fill').style.width = `${Math.round(p * 100)}%`;
  }

  setMuted(m) {
    $('btn-mute').setAttribute('aria-pressed', String(m));
    $('btn-mute').setAttribute('aria-label', m ? 'Sound off' : 'Sound on');
    $('btn-sound2').textContent = m ? 'SOUND: OFF' : 'SOUND: ON';
  }

  setTitleStats(st, goal) {
    $('t-best').textContent = st.best.toLocaleString('en-US');
    $('t-runs').textContent = String(st.runs);
    $('t-life').textContent = String(Math.min(st.lifetimeLines, 99999));
    $('t-life-bar').style.width = `${Math.min(100, (st.lifetimeLines / goal) * 100)}%`;
    $('t-golden-note').hidden = st.goldenUnlocked;
    $('btn-golden').hidden = !st.goldenUnlocked;
    $('btn-golden').textContent = `GOLDEN CHALK: ${st.goldenOn ? 'ON' : 'OFF'}`;
  }

  setPlane(visible) {
    const b = $('btn-plane');
    if (b.hidden === !visible) return;
    b.hidden = !visible;
  }

  showResults(s, rec, extra) {
    const banner = $('res-h');
    banner.textContent = s.win ? (s.overtime ? 'OVERTIME OVER!' : 'EOY REACHED!') : 'SENT TO THE PRINCIPAL!';
    banner.classList.toggle('win', s.win);
    $('res-title').textContent = extra.title;
    $('res-lines').textContent = String(s.lines);
    $('res-score').textContent = s.score.toLocaleString('en-US');
    $('res-streak').textContent = String(s.bestStreak);
    $('res-close').textContent = String(s.closeCalls);
    $('res-day').textContent = s.dayLabel;
    $('res-best').hidden = !rec.newBest;
    const goal = extra.goal;
    $('res-life').textContent = String(rec.lifetimeAfter);
    $('res-life-label').textContent = rec.lifetimeAfter >= goal ? 'LIFETIME LINES · GOLDEN CHALK' : `LIFETIME LINES  +${rec.lifetimeAfter - rec.lifetimeBefore}`;
    const bar = $('res-life-bar');
    bar.style.transition = 'none';
    bar.style.width = `${Math.min(100, (rec.lifetimeBefore / goal) * 100)}%`;
    requestAnimationFrame(() => {
      bar.style.transition = '';
      bar.style.width = `${Math.min(100, (rec.lifetimeAfter / goal) * 100)}%`;
    });
    const ot = s.win && !s.overtime;
    $('btn-overtime').hidden = !ot;
    $('btn-overtime').closest('.res-actions').classList.toggle('with-ot', ot);
    this.show('results');
  }

  showUnlock() {
    $('unlock').hidden = false;
    requestAnimationFrame(() => $('btn-unlock-ok').focus({ preventScroll: true }));
  }

  hideUnlock() {
    $('unlock').hidden = true;
    this.h.unlockClosed?.();
  }

  toast(msg, ms = 1600) {
    const t = $('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(this.toastT);
    this.toastT = setTimeout(() => t.classList.remove('show'), ms);
  }

  announce(msg) {
    const el = $('sr-live');
    el.textContent = '';
    requestAnimationFrame(() => (el.textContent = msg));
  }
}
