/* Browser checks for Space Invaders on a host that has the package
   installed:

     PLAYWRIGHT_MODULE=... CHROMIUM_PATH=... UI_SITE=http://localhost:8102 node tools/test-invaders.js

   The game on its page, a game started, paused by the key and by losing
   the keyboard, the dialogs, the scores file through the host, and the
   game in a window with its menu. It runs signed out, so ~ is this
   browser's own. */
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
  const state = () => page.getAttribute('[data-applet="invaders"]', 'data-splash-state');

  await page.goto(BASE + '/page/invaders', { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-applet="invaders"] canvas', { timeout: 30000 });
  await page.waitForFunction(() => document.querySelector('[data-applet="invaders"]').classList.contains('splash-touch') === false && !!window.splash && !!window.splash.input, null, { timeout: 15000 });
  log('the game is on its page, ready', (await state()) === 'ready' && (await page.textContent('.splash-status')) === 'Ready', await state());
  log('the canvas is the arcade\'s 224 by 256', await page.evaluate(() => { const c = document.querySelector('[data-applet="invaders"] canvas'); return c.width === 224 && c.height === 256; }));
  log('the touch pad is hidden for a mouse', await page.evaluate(() => getComputedStyle(document.querySelector('.splash-pad')).display === 'none'));
  const painted = await page.evaluate(() => { const c = document.querySelector('[data-applet="invaders"] canvas'); const d = c.getContext('2d').getImageData(0, 0, 224, 256).data; let n = 0; for (let i = 0; i < d.length; i += 4) { if (d[i + 3] && (d[i] + d[i + 1] + d[i + 2]) > 90) { n++; } } return n; });
  log('the title screen is drawn', painted > 300, painted);

  await page.click('[data-action="start"]');
  log('New game starts a wave', (await state()) === 'playing' && /Wave 1/.test(await page.textContent('.splash-status')), await state());
  await page.waitForTimeout(400);
  const before = await page.evaluate(() => document.querySelector('[data-applet="invaders"] canvas').getContext('2d').getImageData(0, 216, 224, 8).data.join(''));
  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(400);
  await page.keyboard.up('ArrowRight');
  const after = await page.evaluate(() => document.querySelector('[data-applet="invaders"] canvas').getContext('2d').getImageData(0, 216, 224, 8).data.join(''));
  log('the arrow key moves the cannon', before !== after);
  await page.keyboard.press('KeyP');
  log('P pauses', (await state()) === 'paused' && (await page.textContent('[data-action="pause"]')) === 'Resume', await state());
  await page.keyboard.press('KeyP');
  log('and resumes', (await state()) === 'playing', await state());
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  log('losing the keyboard pauses the game', (await state()) === 'paused', await state());
  await page.click('[data-action="pause"]');
  log('the button resumes it', (await state()) === 'playing', await state());
  await page.keyboard.press('Space');
  await page.waitForTimeout(100);
  const shot = await page.evaluate(() => { const d = document.querySelector('[data-applet="invaders"] canvas').getContext('2d').getImageData(0, 100, 224, 112).data; let n = 0; for (let i = 0; i < d.length; i += 4) { if (d[i + 3]) { n++; } } return n; });
  log('Space fires', shot > 0, shot);
  if (process.env.SHOTS) { await page.screenshot({ path: process.env.SHOTS + '/invaders-page.png' }); }

  // The scores file, through the host's file service, as the game writes it.
  await page.click('[data-action="scores"]');
  await page.waitForSelector('[data-role="scores-dialog"][open]');
  log('High scores opens, empty at first, saying where scores are kept', /No scores yet/.test(await page.textContent('[data-role="scores-body"]')) && /~\/\.splash\/scores\.json/.test(await page.textContent('[data-role="scores-body"]')), await page.textContent('[data-role="scores-body"]'));
  await page.click('[data-action="close-scores"]');
  const recorded = await page.evaluate(async () => { const s = window.splash.scores(window.pudlHost, 'invaders'); const a = await s.record(420, 2); const b = await s.record(990, 3); const c = await s.record(10, 1); return { a: a.rank, b: b.rank, c: c.rank, list: (await s.list()).map(e => e.score) }; });
  log('scores rank themselves and keep the ten best', recorded.a === 1 && recorded.b === 1 && recorded.c === 3 && recorded.list.join() === '990,420,10', JSON.stringify(recorded));
  const home = await page.evaluate(() => localStorage.getItem('pc-terminal-home') || '');
  log('the file is in this browser\'s home directory', home.includes('scores.json') && home.includes('990'), home.slice(0, 120));
  await page.click('[data-action="scores"]');
  await page.waitForSelector('[data-role="scores-dialog"][open]');
  log('the dialog lists them', /990/.test(await page.textContent('[data-role="scores-body"]')) && (await page.locator('.splash-scores tbody tr').count()) === 3);
  await page.click('[data-action="close-scores"]');
  await page.click('[data-action="help"]');
  await page.waitForSelector('[data-role="help-dialog"][open]');
  log('Help says the keys', /Space or X/.test(await page.textContent('[data-role="help-dialog"]')));
  await page.click('[data-action="close-help"]');

  // In a window on the desktop, with its menu and the high score it kept.
  await page.goto(BASE + '/?view=window&open=invaders&top=invaders', { waitUntil: 'networkidle' });
  await page.waitForSelector('.win[data-win="invaders"] canvas', { timeout: 30000 });
  await page.waitForTimeout(500);
  const win = await page.evaluate(() => { const w = document.querySelector('.win[data-win="invaders"]'); const c = w.querySelector('canvas').getBoundingClientRect(), b = w.querySelector('.win-body').getBoundingClientRect(); return { min: w.getAttribute('data-win-min'), fit: w.querySelector('[data-applet]').getAttribute('data-applet-fit'), ratio: c.width / c.height, share: c.height / b.height }; });
  log('the window fills with the game, which keeps its shape inside', win.fit === 'fill' && win.min === '300,420' && win.share > 0.6, JSON.stringify(win));
  const hi = await page.evaluate(() => { const d = document.querySelector('.win[data-win="invaders"] canvas').getContext('2d').getImageData(80, 0, 64, 16).data; let n = 0; for (let i = 0; i < d.length; i += 4) { if (d[i + 3] && (d[i] + d[i + 1] + d[i + 2]) > 90) { n++; } } return n; });
  log('the high score it kept is on the screen', hi > 20, hi);
  await page.click('.menubar-front .menubar-title');
  const menu = await page.locator('#menubar-panel').innerText();
  log('its menu offers a new game, pause, the scores, sound and the window\'s commands', /New game/.test(menu) && /Pause/.test(menu) && /High scores/.test(menu) && /Sound/.test(menu) && /Open as a page/.test(menu), menu.slice(0, 200));
  await page.keyboard.press('Escape');
  if (process.env.SHOTS) { await page.click('.win[data-win="invaders"] [data-action="start"]'); await page.waitForTimeout(1500); await page.screenshot({ path: process.env.SHOTS + '/invaders-window.png' }); }

  log('no page errors', errors.length === 0, errors.join(' | '));
  await browser.close();
  console.log(failures ? failures + ' check(s) failed' : 'all checks passed');
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
