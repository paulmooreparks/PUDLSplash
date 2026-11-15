/* Browser checks for Pantry Raid on a host that has the package installed:

     PLAYWRIGHT_MODULE=... UI_SITE=http://localhost:8102 node tools/test-pantry.js

   or, on a host that gives each applet a page of its own address,

     UI_PAGE=http://pantry.localhost:8400/ node tools/test-pantry.js

   The game on its page, a game started, the mouse run by the keys, the
   game paused by the key and by losing the keyboard, and the dialogs
   keeping the keys from the game. */
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const PAGE = process.env.UI_PAGE || (process.env.UI_SITE || 'http://localhost:8102') + '/page/pantry';

let failures = 0;
function log(name, ok, detail) { console.log((ok ? 'PASS ' : 'FAIL ') + name + (ok ? '' : '  ' + String(detail || '').slice(0, 400))); if (!ok) { failures++; } }

(async () => {
  const browser = await chromium.launch(Object.assign({ args: process.env.HOST_MAP ? ['--host-resolver-rules=' + process.env.HOST_MAP] : [] }, process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}));
  const context = await browser.newContext({ viewport: { width: 1300, height: 900 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  const attr = name => page.getAttribute('[data-applet="pantry"]', 'data-splash-' + name);
  const state = () => attr('state');
  const lit = () => page.evaluate(() => { const c = document.querySelector('[data-applet="pantry"] canvas'); const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 0; i < d.length; i += 4) { if (d[i + 3] && (d[i] + d[i + 1] + d[i + 2]) > 90) { n++; } } return n; });

  await page.goto(PAGE, { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-applet="pantry"] canvas', { timeout: 30000 });
  await page.waitForFunction(() => !!window.splash && !!window.splash.pantry, null, { timeout: 15000 });
  log('the game is on its page, ready', (await state()) === 'ready' && (await page.textContent('.splash-status')) === 'Ready', await state());
  log('the canvas is 228 by 278', await page.evaluate(() => { const c = document.querySelector('[data-applet="pantry"] canvas'); return c.width === 228 && c.height === 278; }));
  log('the touch pad is hidden for a mouse', await page.evaluate(() => getComputedStyle(document.querySelector('.splash-pad')).display === 'none'));
  const title = await lit();
  log('the title screen is drawn', title > 300, title);
  if (process.env.SHOTS) { await page.screenshot({ path: process.env.SHOTS + '/pantry-title.png' }); }

  await page.click('[data-action="start"]');
  log('New game starts the first level', (await state()) === 'playing' && /Wave 1/.test(await page.textContent('.splash-status')), await state());
  await page.waitForTimeout(200);
  log('the maze is drawn', (await lit()) > 3000, await lit());
  await page.keyboard.press('ArrowLeft');
  await page.waitForTimeout(500);
  if ((await attr('score')) === '0') { await page.keyboard.press('ArrowUp'); await page.waitForTimeout(500); }
  log('the arrow keys run the mouse over the crumbs', +(await attr('score')) >= 10, await attr('score'));
  if (process.env.SHOTS) { await page.screenshot({ path: process.env.SHOTS + '/pantry-page.png' }); }
  await page.keyboard.press('KeyP');
  log('P pauses', (await state()) === 'paused' && (await page.textContent('[data-action="pause"]')) === 'Resume', await state());
  const held = await attr('score');
  await page.waitForTimeout(400);
  log('nothing moves while it is paused', (await attr('score')) === held, held + ' then ' + await attr('score'));
  await page.keyboard.press('KeyP');
  log('and resumes', (await state()) === 'playing', await state());
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  log('losing the keyboard pauses the game', (await state()) === 'paused', await state());

  await page.click('[data-action="help"]');
  await page.waitForSelector('[data-role="help-dialog"][open]');
  log('Help explains the game', /crumb/.test(await page.textContent('[data-role="help-dialog"]')) && /bell/.test(await page.textContent('[data-role="help-dialog"]')));
  await page.keyboard.press('KeyP');
  log('the keys do not reach the game while Help is open', (await state()) === 'paused', await state());
  await page.click('[data-action="close-help"]');
  await page.click('[data-action="scores"]');
  await page.waitForSelector('[data-role="scores-dialog"][open]');
  log('High scores opens and says where scores are kept', /kept in/i.test(await page.textContent('[data-role="scores-body"]')), await page.textContent('[data-role="scores-body"]'));
  await page.click('[data-action="close-scores"]');

  await page.click('[data-action="pause"]');
  log('the button resumes it', (await state()) === 'playing', await state());
  if (process.env.SHOTS) { await page.waitForTimeout(3000); await page.screenshot({ path: process.env.SHOTS + '/pantry-later.png' }); }

  log('no page errors', errors.length === 0, errors.join(' | '));
  await browser.close();
  console.log(failures ? failures + ' check(s) failed' : 'all checks passed');
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
