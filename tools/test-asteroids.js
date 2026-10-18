/* Browser checks for Asteroids on a host that has the package installed:

     PLAYWRIGHT_MODULE=... CHROMIUM_PATH=... UI_SITE=http://localhost:8102 node tools/test-asteroids.js

   The game on its page drawn at the size it is shown, a game started,
   the ship turned, thrust and fired, paused by the key and by losing the
   keyboard, the dialogs, the scores file through the host, and the game
   in a window with its menu. It runs signed out, so ~ is this browser's
   own. */
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const BASE = process.env.UI_SITE || 'http://localhost:8102';

let failures = 0;
function log(name, ok, detail) { console.log((ok ? 'PASS ' : 'FAIL ') + name + (ok ? '' : '  ' + String(detail || '').slice(0, 400))); if (!ok) { failures++; } }

(async () => {
  const browser = await chromium.launch(Object.assign({ args: process.env.HOST_MAP ? ['--host-resolver-rules=' + process.env.HOST_MAP] : [] }, process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}));
  const context = await browser.newContext({ viewport: { width: 1300, height: 900 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  const state = () => page.getAttribute('[data-applet="asteroids"]', 'data-splash-state');
  const sel = '[data-applet="asteroids"] canvas';
  /* The pixels of the ship's area in the middle, as a string. */
  const middle = () => page.evaluate(s => { const c = document.querySelector(s); const k = c.width / 640; return c.getContext('2d').getImageData(Math.round(290 * k), Math.round(210 * k), Math.round(60 * k), Math.round(60 * k)).data.join(''); }, sel);
  const lit = (x, y, w, h) => page.evaluate(([s, x, y, w, h]) => { const c = document.querySelector(s); const k = c.width / 640; const d = c.getContext('2d').getImageData(Math.round(x * k), Math.round(y * k), Math.round(w * k), Math.round(h * k)).data; let n = 0; for (let i = 0; i < d.length; i += 4) { if (d[i] + d[i + 1] + d[i + 2] > 150) { n++; } } return n; }, [sel, x, y, w, h]);

  await page.goto(BASE + '/page/asteroids', { waitUntil: 'networkidle' });
  await page.waitForSelector(sel, { timeout: 30000 });
  await page.waitForTimeout(800);
  log('the game is on its page, ready', (await state()) === 'ready' && (await page.textContent('.splash-status')) === 'Ready', await state());
  const size = await page.evaluate(s => { const c = document.querySelector(s); const r = c.getBoundingClientRect(); return { w: c.width, h: c.height, shown: Math.round(r.width), ratio: r.width / r.height, dpr: devicePixelRatio }; }, sel);
  log('the canvas is drawn at the size it is shown, four by three', Math.abs(size.ratio - 4 / 3) < 0.02 && Math.abs(size.w - size.shown * size.dpr) <= 2, JSON.stringify(size));
  log('the title screen is drawn, with rocks drifting', (await lit(0, 130, 640, 60)) > 200, await lit(0, 130, 640, 60));

  await page.click('[data-action="start"]');
  await page.waitForTimeout(300);
  log('New game starts a wave', (await state()) === 'playing' && /Wave 1/.test(await page.textContent('.splash-status')), await state());
  const before = await middle();
  await page.keyboard.down('ArrowLeft'); await page.waitForTimeout(250); await page.keyboard.up('ArrowLeft');
  const turned = await middle();
  log('the arrow turns the ship', before !== turned);
  await page.keyboard.down('ArrowUp'); await page.waitForTimeout(500); await page.keyboard.up('ArrowUp');
  await page.waitForTimeout(400);
  const moved = await middle();
  log('thrust moves it', moved !== turned);
  await page.keyboard.press('Space');
  await page.waitForTimeout(80);
  log('Space fires', (await lit(0, 60, 640, 420)) > 0);
  await page.keyboard.press('KeyP');
  log('P pauses', (await state()) === 'paused' && (await page.textContent('[data-action="pause"]')) === 'Resume', await state());
  await page.keyboard.press('KeyP');
  log('and resumes', (await state()) === 'playing', await state());
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  log('losing the keyboard pauses the game', (await state()) === 'paused', await state());
  await page.click('[data-action="pause"]');
  log('the button resumes it', (await state()) === 'playing', await state());
  if (process.env.SHOTS) { await page.screenshot({ path: process.env.SHOTS + '/asteroids-page.png' }); }

  await page.click('[data-action="scores"]');
  await page.waitForSelector('[data-role="scores-dialog"][open]');
  log('High scores opens, empty at first', /No scores yet/.test(await page.textContent('[data-role="scores-body"]')));
  await page.click('[data-action="close-scores"]');
  const recorded = await page.evaluate(async () => { const s = window.splash.scores(window.pudlHost, 'asteroids'); const a = await s.record(2500, 2); return { rank: a.rank, list: (await s.list()).map(e => e.score) }; });
  log('a score is kept, apart from the other game\'s', recorded.rank === 1 && recorded.list.join() === '2500', JSON.stringify(recorded));
  await page.click('[data-action="help"]');
  await page.waitForSelector('[data-role="help-dialog"][open]');
  log('Help says the keys', /Hyperspace/.test(await page.textContent('[data-role="help-dialog"]')));
  await page.click('[data-action="close-help"]');

  await page.goto(BASE + '/?view=window&open=asteroids&top=asteroids', { waitUntil: 'networkidle' });
  await page.waitForSelector('.win[data-win="asteroids"] canvas', { timeout: 30000 });
  await page.waitForTimeout(600);
  const win = await page.evaluate(() => { const w = document.querySelector('.win[data-win="asteroids"]'); const c = w.querySelector('canvas').getBoundingClientRect(), b = w.querySelector('.win-body').getBoundingClientRect(); return { min: w.getAttribute('data-win-min'), fit: w.querySelector('[data-applet]').getAttribute('data-applet-fit'), share: c.height / b.height, icon: w.getAttribute('data-window-icon') }; });
  log('the window fills with the game and carries its icon', win.fit === 'fill' && win.min === '480,420' && win.share > 0.5 && win.icon === '/applets/asteroids/icon.svg', JSON.stringify(win));
  await page.click('.menubar-front .menubar-title');
  const menu = await page.locator('#menubar-panel').innerText();
  log('its menu offers a new game, pause, the scores, sound and the window\'s commands', /New game/.test(menu) && /Pause/.test(menu) && /High scores/.test(menu) && /Sound/.test(menu) && /Open as a page/.test(menu), menu.slice(0, 200));
  await page.keyboard.press('Escape');
  if (process.env.SHOTS) { await page.click('.win[data-win="asteroids"] [data-action="start"]'); await page.waitForTimeout(1200); await page.screenshot({ path: process.env.SHOTS + '/asteroids-window.png' }); }

  log('no page errors', errors.length === 0, errors.join(' | '));
  await browser.close();
  console.log(failures ? failures + ' check(s) failed' : 'all checks passed');
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
