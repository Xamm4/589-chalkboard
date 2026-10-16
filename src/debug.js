// ?debug=1 panel: state machine readout, timers, invincibility, day jump, slow-mo.

export function initDebug({ getGame, debugState, start }) {
  const el = document.getElementById('debug');
  el.hidden = false;
  el.innerHTML = `
    <pre id="dbg-state">…</pre>
    <div>
      <button id="dbg-inv">invincible: off</button>
      <button id="dbg-slow">slow-mo: off</button>
    </div>
    <div>jump to:
      ${['MON', 'TUE', 'WED', 'THU', 'FRI', 'EOY', 'OT'].map((d, i) => `<button data-day="${i}">${d}</button>`).join('')}
    </div>
    <div><button id="dbg-plane">+ airplane</button><button id="dbg-hide">hide</button></div>`;
  const pre = el.querySelector('#dbg-state');
  el.addEventListener('pointerdown', (e) => e.stopPropagation());
  el.querySelector('#dbg-inv').onclick = (e) => {
    const g = getGame();
    g.invincible = !g.invincible;
    e.target.textContent = `invincible: ${g.invincible ? 'ON' : 'off'}`;
  };
  el.querySelector('#dbg-slow').onclick = (e) => {
    debugState.slowmo = !debugState.slowmo;
    e.target.textContent = `slow-mo: ${debugState.slowmo ? 'ON' : 'off'}`;
  };
  el.querySelector('#dbg-plane').onclick = () => {
    const g = getGame();
    g.events.airplane = { state: 'ready', t: 0 };
    g.airplaneHeld = true;
  };
  el.querySelector('#dbg-hide').onclick = () => (el.hidden = true);
  el.querySelectorAll('[data-day]').forEach((b) => (b.onclick = () => start(Number(b.dataset.day))));
  setInterval(() => {
    const g = getGame();
    if (!g) return;
    const t = g.teacher;
    const ev = g.events;
    pre.textContent = [
      `phase   ${g.phase}  t=${g.phaseT.toFixed(2)}`,
      `day     ${g.day ? g.day.name : '-'}  ${g.dayTime.toFixed(1)}/${g.day ? g.day.duration : 0}s`,
      `teacher ${t.state}${t.snap ? ' (snap)' : ''}${t.forced ? ' (snitch)' : ''}`,
      `        t=${t.t.toFixed(2)} / ${t.dur.toFixed(2)}  turn=${t.turn.toFixed(2)}`,
      `seeing  ${t.seeing}  blind=${g.blind}`,
      `hold    ${g.holding}  chalk=${g.chalk}`,
      `score   ${Math.round(g.score)}  lines=${g.lines}  streak=${g.streak}`,
      `strikes ${g.strikes}  close=${g.closeCalls}  quota=${g.punishToday}/${g.quota}`,
      `events  bear=${ev.bear ? ev.bear.phase : '-'} dark=${ev.blackout ? ev.blackout.phase : '-'} fly=${ev.fly ? ev.fly.phase : '-'} plane=${ev.airplane.state}`,
    ].join('\n');
  }, 100);
}
