// End-to-end: a bot plays through the real UI (keyboard input), we check for console errors,
// scoring, a day transition, and that the results screen fits the viewport without scrolling.
import { test, expect } from '@playwright/test';

const VIEWPORTS = [
  { name: 'phone 390x844', width: 390, height: 844 },
  { name: 'small phone 360x640', width: 360, height: 640 },
  { name: 'desktop 1280x800', width: 1280, height: 800 },
  { name: 'iframe 480x700', width: 900, height: 800, iframe: true },
];

// In-page bot: holds Space while he reads, lets go the moment a tell starts.
// mode 'smart' plays properly; mode 'reckless' never lets go (to reach the results screen).
const BOT = () => {
  const key = (type) => window.dispatchEvent(new KeyboardEvent(type, { code: 'Space', key: ' ', bubbles: true }));
  let down = false;
  window.__bot = { mode: 'smart' };
  const tick = () => {
    const g = window.__CR && window.__CR.game;
    if (g) {
      let want = false;
      if (g.phase === 'play') {
        const bear = g.events.bear && g.events.bear.phase !== 'down';
        want = window.__bot.mode === 'reckless' ? g.chalk !== 'broken' : g.teacher.state === 'READING' && !bear && g.chalk !== 'broken';
      }
      if (want && !down) key('keydown');
      if (!want && down) key('keyup');
      down = want;
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
};

for (const vp of VIEWPORTS) {
  test(`bot plays a run — ${vp.name}`, async ({ page }) => {
    const errors = [];
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    page.on('pageerror', (e) => errors.push(e.message));
    await page.setViewportSize({ width: vp.width, height: vp.height });

    let app;
    if (vp.iframe) {
      await page.goto('/tests/e2e/embed.html');
      const handle = await page.waitForSelector('#game');
      app = await handle.contentFrame();
    } else {
      await page.goto('/?seed=1234&speed=4');
      app = page.mainFrame();
    }
    await app.waitForSelector('#title.show');
    await app.evaluate(BOT);
    await app.locator('#btn-play').click({ force: true });

    // Monday → Tuesday with a well-behaved bot
    await app.waitForFunction(() => window.__CR.game.phase === 'play', null, { timeout: 15_000 });
    await app.waitForFunction(() => window.__CR.game.score > 0, null, { timeout: 20_000 });
    await app.waitForFunction(() => window.__CR.game.dayIndex >= 1, null, { timeout: 60_000 });
    const mid = await app.evaluate(() => ({ score: window.__CR.game.score, lines: window.__CR.game.lines }));
    expect(mid.score).toBeGreaterThan(0);
    expect(mid.lines).toBeGreaterThan(0);

    // Now get greedy until the Principal calls
    await app.evaluate(() => (window.__bot.mode = 'reckless'));
    await app.waitForSelector('#results.show', { timeout: 90_000 });
    await app.waitForTimeout(1300); // let the intro animations settle

    const fit = await app.evaluate(() => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const ids = ['res-h', 'res-board', 'res-lines', 'btn-again', 'btn-share', 'btn-copy', 'btn-menu'];
      const out = ids.map((id) => {
        const r = document.getElementById(id).getBoundingClientRect();
        return { id, ok: r.top >= -1 && r.left >= -1 && r.bottom <= vh + 1 && r.right <= vw + 1 && r.width > 0 };
      });
      const se = document.scrollingElement;
      return { out, scrolls: se.scrollHeight > vh + 1 || se.scrollWidth > vw + 1 };
    });
    expect(fit.scrolls, 'page must not scroll').toBe(false);
    for (const o of fit.out) expect(o.ok, `${o.id} inside the viewport`).toBe(true);

    const summary = await app.evaluate(() => window.__CR.game.summary());
    expect(summary.strikes).toBeGreaterThanOrEqual(3);
    await expect(app.locator('#res-lines')).toHaveText(String(summary.lines));

    // Play again goes straight back into a run
    await app.locator('#btn-again').click({ force: true });
    await app.waitForFunction(() => window.__CR.game.phase === 'card');

    expect(errors, errors.join('\n')).toEqual([]);
  });
}

test('title, how-to and pause screens are reachable by keyboard', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/?seed=5');
  await page.waitForSelector('#title.show');
  await page.locator('#btn-howto').click({ force: true });
  await expect(page.locator('#howto')).toHaveClass(/show/);
  await page.keyboard.press('Enter'); // GOT IT! is focused
  await expect(page.locator('#title')).toHaveClass(/show/);
  await page.locator('#btn-play').click({ force: true });
  await page.waitForFunction(() => window.__CR.game.phase === 'play', null, { timeout: 10_000 });
  await page.keyboard.press('Escape');
  await expect(page.locator('#pause')).toHaveClass(/show/);
  const t0 = await page.evaluate(() => window.__CR.game.dayTime);
  await page.waitForTimeout(600);
  expect(await page.evaluate(() => window.__CR.game.dayTime)).toBe(t0);
  await page.keyboard.press('Escape');
  await expect(page.locator('#pause')).not.toHaveClass(/show/);
  expect(errors).toEqual([]);
});
