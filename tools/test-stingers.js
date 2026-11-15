/* Browser checks for Stingers on a host that has the package installed:

     PLAYWRIGHT_MODULE=... UI_SITE=http://localhost:8102 node tools/test-stingers.js

   or, on a host that gives each applet a page of its own address,

     UI_PAGE=http://stingers.localhost:8400/ node tools/test-stingers.js

   The game on its page, a game started, the ship moved and fired by the
   keys, wasps shot out of the ranks, the game paused by the key and by
   losing the keyboard, the dialogs keeping the keys from the game, and a
   game left alone ending when the ships are gone. */
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const PAGE = process.env.UI_PAGE || (process.env.UI_SITE || 'http://localhost:8102') + '/page/stingers';

let failures = 0;
function log(name, ok, detail) { console.log((ok ? 'PASS ' : 'FAIL ') + name + (ok ? '' : '  ' + String(detail || '').slice(0, 400))); if (!ok) { failures++; } }

(async () => {
  const browser = await chromium.launch(Object.assign({ args: process.env.HOST_MAP ? ['--host-resolver-rules=' + process.env.HOST_MAP] : [] }, process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}));
  const context = await browser.newContext({ viewport: { width: 1300, height: 900 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  const attr = name => page.getAttribute('[data-applet="stingers"]', 'data-splash-' + name);
  const state = () => attr('state');
  const band = (y, h) => page.evaluate(([y, h]) => document.querySelector('[data-applet="stingers"] canvas').getContext('2d').getImageData(0, y, 224, h).data.join(''), [y, h]);

  await page.goto(PAGE, { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-applet="stingers"] canvas', { timeout: 30000 });
  await page.waitForFunction(() => !!window.splash && !!window.splash.input, null, { timeout: 15000 });
  log('the game is on its page, ready', (await state()) === 'ready' && (await page.textContent('.splash-status')) === 'Ready', await state());
  log('the canvas is 224 by 256', await page.evaluate(() => { const c = document.querySelector('[data-applet="stingers"] canvas'); return c.width === 224 && c.height === 256; }));
  if (process.env.SHOTS) { await page.screenshot({ path: process.env.SHOTS + '/stingers-title.png' }); }

  await page.click('[data-action="start"]');
  log('New game starts the first wave', (await state()) === 'playing' && /Wave 1/.test(await page.textContent('.splash-status')), await state());
  await page.keyboard.press('KeyP');
  const before = await band(228, 9);
  await page.keyboard.press('KeyP');
  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(400);
  await page.keyboard.up('ArrowRight');
  await page.keyboard.press('KeyP');
  log('the arrow key moves the ship', before !== await band(228, 9));
  await page.keyboard.press('KeyP');
  await page.keyboard.down('ArrowLeft');
  await page.waitForTimeout(400);
  await page.keyboard.up('ArrowLeft');

  /* Shooting straight up from the middle, where the ranks settle. */
  for (let n = 0; n < 60 && (await attr('score')) === '0' && (await state()) === 'playing'; n++) { await page.keyboard.press('Space'); await page.waitForTimeout(150); }
  log('Space shoots wasps and scores', +(await attr('score')) >= 10, await attr('score'));
  if (process.env.SHOTS) { await page.screenshot({ path: process.env.SHOTS + '/stingers-page.png' }); }

  if ((await state()) === 'dying') { await page.waitForFunction(() => document.querySelector('[data-applet="stingers"]').getAttribute('data-splash-state') === 'playing', null, { timeout: 5000 }).catch(() => { }); }
  await page.keyboard.press('KeyP');
  log('P pauses', (await state()) === 'paused' && (await page.textContent('[data-action="pause"]')) === 'Resume', await state());
  await page.click('[data-action="help"]');
  await page.waitForSelector('[data-role="help-dialog"][open]');
  log('Help explains the game', /queen/.test(await page.textContent('[data-role="help-dialog"]')) && /snare/.test(await page.textContent('[data-role="help-dialog"]')) && /bonus wave/.test(await page.textContent('[data-role="help-dialog"]')));
  await page.keyboard.press('KeyP');
  log('the keys do not reach the game while Help is open', (await state()) === 'paused', await state());
  await page.click('[data-action="close-help"]');
  await page.keyboard.press('KeyP');
  log('and P resumes', (await state()) === 'playing', await state());
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  log('losing the keyboard pauses the game', (await state()) === 'paused', await state());
  await page.click('[data-action="pause"]');

  /* Left alone under the nest, the ships are lost one by one. */
  await page.waitForFunction(() => document.querySelector('[data-applet="stingers"]').getAttribute('data-splash-state') === 'over', null, { timeout: 150000 }).catch(() => { });
  log('a game left alone ends', (await state()) === 'over' && /Game over/.test(await page.textContent('.splash-status')), (await state()) + ' with ' + (await attr('lives')) + ' lives');
  if (process.env.SHOTS) { await page.screenshot({ path: process.env.SHOTS + '/stingers-over.png' }); }

  log('no page errors', errors.length === 0, errors.join(' | '));
  await browser.close();
  console.log(failures ? failures + ' check(s) failed' : 'all checks passed');
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
