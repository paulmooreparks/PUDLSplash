/* Copyright 2026 Paul Parks. SPDX-License-Identifier: Apache-2.0 */
/* Space Invaders, a PUDL applet package (../../README.md). The 1978 game:
   fifty-five invaders march across a canvas of 224 by 256 pixels, dropping
   a row and speeding up as their number falls, while the cannon shoots
   from behind four shields that crumble under fire. Everything is drawn
   in PUDL's theme tokens and redrawn when the theme changes. Keys and
   touch come from ../shared/splash-input.js, and the ten best scores go
   to ~/.splash/scores.json through ../shared/splash-scores.js. A request
   to play (handles: play, param level) starts a game at that level. */
(function () {
    'use strict';
    var SELF = document.currentScript && document.currentScript.src;
    function beside(file) { return SELF ? new URL(file, SELF).href : file; }
    function loadScript(src) {
        return new Promise(function (resolve, reject) {
            var s = document.createElement('script');
            s.src = src;
            s.onload = resolve;
            s.onerror = function () { reject(new Error(src + ' did not load')); };
            document.head.appendChild(s);
        });
    }
    var shared = Promise.all(['../shared/splash-input.js', '../shared/splash-scores.js'].map(function (f) { return loadScript(beside(f)); }));

    var W = 224, H = 256;
    var PLAYER_Y = 216, SHIELD_Y = 184, GROUND_Y = 247;

    /* The sprites, as rows of pixels. */
    function sprite(id, rows) { return { id: id, w: rows[0].length, h: rows.length, rows: rows }; }
    var SQUID = [
        sprite('sa', ['...XX...', '..XXXX..', '.XXXXXX.', 'XX.XX.XX', 'XXXXXXXX', '..X..X..', '.X.XX.X.', 'X.X..X.X']),
        sprite('sb', ['...XX...', '..XXXX..', '.XXXXXX.', 'XX.XX.XX', 'XXXXXXXX', '.X.XX.X.', 'X......X', '.X....X.'])
    ];
    var CRAB = [
        sprite('ca', ['..X.....X..', '...X...X...', '..XXXXXXX..', '.XX.XXX.XX.', 'XXXXXXXXXXX', 'X.XXXXXXX.X', 'X.X.....X.X', '...XX.XX...']),
        sprite('cb', ['..X.....X..', 'X..X...X..X', 'X.XXXXXXX.X', 'XXX.XXX.XXX', 'XXXXXXXXXXX', '.XXXXXXXXX.', '..X.....X..', '.X.......X.'])
    ];
    var OCTOPUS = [
        sprite('oa', ['....XXXX....', '.XXXXXXXXXX.', 'XXXXXXXXXXXX', 'XXX..XX..XXX', 'XXXXXXXXXXXX', '...XX..XX...', '..XX.XX.XX..', 'XX........XX']),
        sprite('ob', ['....XXXX....', '.XXXXXXXXXX.', 'XXXXXXXXXXXX', 'XXX..XX..XXX', 'XXXXXXXXXXXX', '..XXX..XXX..', '.XX..XX..XX.', '..XX....XX..'])
    ];
    var PLAYER = sprite('pl', ['......X......', '.....XXX.....', '.....XXX.....', '.XXXXXXXXXXX.', 'XXXXXXXXXXXXX', 'XXXXXXXXXXXXX', 'XXXXXXXXXXXXX', 'XXXXXXXXXXXXX']);
    var UFO = sprite('uf', ['.....XXXXXX.....', '...XXXXXXXXXX...', '..XXXXXXXXXXXX..', '.XX.XX.XX.XX.XX.', 'XXXXXXXXXXXXXXXX', '...XXX....XXX...', '....X......X....']);
    var BOOM = sprite('bm', ['.X..X...X..X.', '..X..X.X..X..', '...X.....X...', 'XX.........XX', '...X.....X...', '..X..X.X..X..', '.X..X...X..X.']);
    var PLAYER_BOOM = [
        sprite('pa', ['....X........', '.X.......X...', '...X..X......', 'X......X.X..X', '..X.XXXX.....', '...XXXXXXX...', '.XXXXXXXXXXX.']),
        sprite('pb', ['........X....', '...X.....X...', '......X..X...', '.X.X......X.X', '.....XXXX.X..', '...XXXXXXX...', '.XXXXXXXXXXX.'])
    ];
    var SHIELD = sprite('sh', [
        '....XXXXXXXXXXXXXX....', '...XXXXXXXXXXXXXXXX...', '..XXXXXXXXXXXXXXXXXX..', '.XXXXXXXXXXXXXXXXXXXX.',
        'XXXXXXXXXXXXXXXXXXXXXX', 'XXXXXXXXXXXXXXXXXXXXXX', 'XXXXXXXXXXXXXXXXXXXXXX', 'XXXXXXXXXXXXXXXXXXXXXX',
        'XXXXXXXXXXXXXXXXXXXXXX', 'XXXXXXXXXXXXXXXXXXXXXX', 'XXXXXXXXXXXXXXXXXXXXXX', 'XXXXXXXXXXXXXXXXXXXXXX',
        'XXXXXXXX......XXXXXXXX', 'XXXXXXX........XXXXXXX', 'XXXXXX..........XXXXXX', 'XXXXXX..........XXXXXX'
    ]);
    var TYPES = [
        { frames: SQUID, points: 30 },
        { frames: CRAB, points: 20 },
        { frames: CRAB, points: 20 },
        { frames: OCTOPUS, points: 10 },
        { frames: OCTOPUS, points: 10 }
    ];
    var MARCH = [110, 98, 87, 78];

    /* A five-by-seven pixel font for the screen's words, so they are as
       square as the invaders. */
    var FONT = {
        A: ['.XXX.', 'X...X', 'X...X', 'XXXXX', 'X...X', 'X...X', 'X...X'], B: ['XXXX.', 'X...X', 'X...X', 'XXXX.', 'X...X', 'X...X', 'XXXX.'],
        C: ['.XXXX', 'X....', 'X....', 'X....', 'X....', 'X....', '.XXXX'], D: ['XXXX.', 'X...X', 'X...X', 'X...X', 'X...X', 'X...X', 'XXXX.'],
        E: ['XXXXX', 'X....', 'X....', 'XXXX.', 'X....', 'X....', 'XXXXX'], F: ['XXXXX', 'X....', 'X....', 'XXXX.', 'X....', 'X....', 'X....'],
        G: ['.XXXX', 'X....', 'X....', 'X.XXX', 'X...X', 'X...X', '.XXXX'], H: ['X...X', 'X...X', 'X...X', 'XXXXX', 'X...X', 'X...X', 'X...X'],
        I: ['XXXXX', '..X..', '..X..', '..X..', '..X..', '..X..', 'XXXXX'], J: ['....X', '....X', '....X', '....X', 'X...X', 'X...X', '.XXX.'],
        K: ['X...X', 'X..X.', 'X.X..', 'XX...', 'X.X..', 'X..X.', 'X...X'], L: ['X....', 'X....', 'X....', 'X....', 'X....', 'X....', 'XXXXX'],
        M: ['X...X', 'XX.XX', 'X.X.X', 'X...X', 'X...X', 'X...X', 'X...X'], N: ['X...X', 'XX..X', 'X.X.X', 'X..XX', 'X...X', 'X...X', 'X...X'],
        O: ['.XXX.', 'X...X', 'X...X', 'X...X', 'X...X', 'X...X', '.XXX.'], P: ['XXXX.', 'X...X', 'X...X', 'XXXX.', 'X....', 'X....', 'X....'],
        Q: ['.XXX.', 'X...X', 'X...X', 'X...X', 'X.X.X', 'X..X.', '.XX.X'], R: ['XXXX.', 'X...X', 'X...X', 'XXXX.', 'X.X..', 'X..X.', 'X...X'],
        S: ['.XXXX', 'X....', 'X....', '.XXX.', '....X', '....X', 'XXXX.'], T: ['XXXXX', '..X..', '..X..', '..X..', '..X..', '..X..', '..X..'],
        U: ['X...X', 'X...X', 'X...X', 'X...X', 'X...X', 'X...X', '.XXX.'], V: ['X...X', 'X...X', 'X...X', 'X...X', 'X...X', '.X.X.', '..X..'],
        W: ['X...X', 'X...X', 'X...X', 'X.X.X', 'X.X.X', 'XX.XX', 'X...X'], X: ['X...X', 'X...X', '.X.X.', '..X..', '.X.X.', 'X...X', 'X...X'],
        Y: ['X...X', 'X...X', '.X.X.', '..X..', '..X..', '..X..', '..X..'], Z: ['XXXXX', '....X', '...X.', '..X..', '.X...', 'X....', 'XXXXX'],
        0: ['.XXX.', 'X...X', 'X..XX', 'X.X.X', 'XX..X', 'X...X', '.XXX.'], 1: ['..X..', '.XX..', '..X..', '..X..', '..X..', '..X..', '.XXX.'],
        2: ['.XXX.', 'X...X', '....X', '...X.', '..X..', '.X...', 'XXXXX'], 3: ['XXXXX', '...X.', '..X..', '...X.', '....X', 'X...X', '.XXX.'],
        4: ['...X.', '..XX.', '.X.X.', 'X..X.', 'XXXXX', '...X.', '...X.'], 5: ['XXXXX', 'X....', 'XXXX.', '....X', '....X', 'X...X', '.XXX.'],
        6: ['..XX.', '.X...', 'X....', 'XXXX.', 'X...X', 'X...X', '.XXX.'], 7: ['XXXXX', '....X', '...X.', '..X..', '.X...', '.X...', '.X...'],
        8: ['.XXX.', 'X...X', 'X...X', '.XXX.', 'X...X', 'X...X', '.XXX.'], 9: ['.XXX.', 'X...X', 'X...X', '.XXXX', '....X', '...X.', '.XX..'],
        '=': ['.....', '.....', 'XXXXX', '.....', 'XXXXX', '.....', '.....'], '?': ['.XXX.', 'X...X', '....X', '...X.', '..X..', '.....', '..X..'],
        '.': ['.....', '.....', '.....', '.....', '.....', '.....', '..X..'], ',': ['.....', '.....', '.....', '.....', '.....', '..X..', '.X...'],
        ':': ['.....', '..X..', '.....', '.....', '.....', '..X..', '.....'], '-': ['.....', '.....', '.....', 'XXXXX', '.....', '.....', '.....'],
        ' ': ['.....', '.....', '.....', '.....', '.....', '.....', '.....']
    };
    var GLYPH = {};
    Object.keys(FONT).forEach(function (k) { GLYPH[k] = sprite('f' + k, FONT[k]); });

    function init(root, opts) {
        var host = window.pudlHost || {};
        var uid = 'inv-' + Math.random().toString(36).slice(2, 8);
        root.classList.add('splash', 'splash-invaders');
        if (!root.hasAttribute('tabindex')) { root.tabIndex = 0; }
        root.innerHTML =
            '<div class="splash-stage"><canvas width="' + W + '" height="' + H + '" aria-label="Space Invaders: the game"></canvas></div>' +
            '<div class="splash-bar">' +
              '<button type="button" class="btn btn-primary" data-action="start">New game</button>' +
              '<button type="button" class="btn" data-action="pause" disabled>Pause</button>' +
              '<button type="button" class="btn" data-action="scores">High scores</button>' +
              '<button type="button" class="btn" data-action="help">Help</button>' +
              '<span class="splash-status" data-role="status" role="status" aria-live="polite">Ready</span>' +
            '</div>' +
            '<dialog class="dialog" data-role="scores-dialog" aria-labelledby="' + uid + '-scores">' +
              '<h3 class="dialog-title" id="' + uid + '-scores">High scores</h3>' +
              '<div class="dialog-body" data-role="scores-body"></div>' +
              '<div class="dialog-actions"><button type="button" class="btn btn-primary" data-action="close-scores">Close</button></div>' +
            '</dialog>' +
            '<dialog class="dialog" data-role="help-dialog" aria-labelledby="' + uid + '-help">' +
              '<h3 class="dialog-title" id="' + uid + '-help">Space Invaders</h3>' +
              '<div class="dialog-body">' +
                '<p>Shoot the invaders before they reach the ground. Each wave starts lower and marches faster as its numbers fall. A saucer now and then is worth more. You have three cannons, and a fourth at 1,500 points.</p>' +
                '<dl class="splash-keys">' +
                  '<dt>← → or A D</dt><dd>Move</dd>' +
                  '<dt>Space or X</dt><dd>Fire</dd>' +
                  '<dt>P or Esc</dt><dd>Pause and resume</dd>' +
                  '<dt>Enter</dt><dd>Start a game</dd>' +
                '</dl>' +
                '<p>On a touch screen, the buttons under the game do the same. The game pauses when it loses the keyboard.</p>' +
              '</div>' +
              '<div class="dialog-actions"><button type="button" class="btn btn-primary" data-action="close-help">Close</button></div>' +
            '</dialog>';
        var el = {
            canvas: root.querySelector('canvas'), bar: root.querySelector('.splash-bar'),
            start: root.querySelector('[data-action="start"]'), pause: root.querySelector('[data-action="pause"]'),
            status: root.querySelector('[data-role="status"]'),
            scores: root.querySelector('[data-role="scores-dialog"]'), scoresBody: root.querySelector('[data-role="scores-body"]'),
            help: root.querySelector('[data-role="help-dialog"]')
        };
        var ctx = el.canvas.getContext('2d');
        ctx.imageSmoothingEnabled = false;

        /* === Colours from the theme ========================================= */
        var colours = {}, cache = {};
        function readColours() {
            var cs = getComputedStyle(root);
            function t(name, fallback) { var v = cs.getPropertyValue(name).trim(); return v || fallback; }
            colours = {
                bg: t('--surface-alt', '#111418'), fg: t('--text', '#e8e8e8'), accent: t('--accent', '#4a90e2'),
                positive: t('--positive', '#2e7d32'), danger: t('--danger', '#c62828'), warn: t('--warn', '#f9a825'),
                muted: t('--text-muted', '#9a9a9a'), mono: t('--mono', 'monospace')
            };
            cache = {};
            shields.forEach(function (s) { s.dirty = true; });
        }
        /* A sprite in a colour, drawn once to its own canvas. */
        function image(spr, colour) {
            var key = spr.id + '|' + colour;
            if (cache[key]) { return cache[key]; }
            var c = document.createElement('canvas');
            c.width = spr.w; c.height = spr.h;
            var g = c.getContext('2d');
            g.fillStyle = colour;
            for (var y = 0; y < spr.h; y++) { for (var x = 0; x < spr.w; x++) { if (spr.rows[y][x] === 'X') { g.fillRect(x, y, 1, 1); } } }
            cache[key] = c;
            return c;
        }

        /* === The game ======================================================= */
        var mode = 'ready';       // ready, playing, paused, dying, cleared, over
        var score = 0, hi = 0, lives = 3, level = 1, extraGiven = false;
        var aliens = [], fx = 0, fy = 0, dir = 1, frame = 0, stepTimer = 0, marchNote = 0;
        var player = { x: (W - PLAYER.w) / 2, w: PLAYER.w }, shot = null, bombs = [], bombTimer = 0;
        var ufo = null, ufoTimer = 0, ufoBlip = 0, toast = null, booms = [], shields = [];
        var timer = 0, pausedBefore = null;
        var input = null, scores = null, sound = { on: true }, audio = null;

        function newShields() {
            return [32, 80, 128, 176].map(function (x) {
                var mask = new Uint8Array(SHIELD.w * SHIELD.h);
                for (var y = 0; y < SHIELD.h; y++) { for (var i = 0; i < SHIELD.w; i++) { mask[y * SHIELD.w + i] = SHIELD.rows[y][i] === 'X' ? 1 : 0; } }
                return { x: x, y: SHIELD_Y, w: SHIELD.w, h: SHIELD.h, mask: mask, img: null, dirty: true };
            });
        }
        function startWave() {
            aliens = [];
            for (var row = 0; row < 5; row++) {
                for (var col = 0; col < 11; col++) {
                    var t = TYPES[row], w = t.frames[0].w;
                    aliens.push({ type: t, col: col, row: row, ax: col * 16 + Math.floor((16 - w) / 2), ay: row * 16, w: w, h: 8, alive: true });
                }
            }
            fx = 24; fy = 40 + Math.min(level - 1, 6) * 8; dir = 1; frame = 0; stepTimer = 0;
            shot = null; bombs = []; bombTimer = 1500; ufo = null; ufoTimer = 15000 + Math.random() * 10000; booms = []; toast = null;
            player.x = (W - PLAYER.w) / 2;
            shields = newShields();
        }
        function newGame(startLevel) {
            score = 0; lives = 3; level = Math.max(1, Math.min(99, startLevel || 1)); extraGiven = false;
            startWave();
            setMode('playing');
            say('Wave ' + level);
            root.focus({ preventScroll: true });
        }
        function setMode(m) {
            mode = m;
            el.pause.disabled = !(m === 'playing' || m === 'paused');
            el.pause.textContent = m === 'paused' ? 'Resume' : 'Pause';
            root.setAttribute('data-splash-state', m);
            tell();
            loop();
        }
        function tell() {
            root.setAttribute('data-splash-score', String(score));
            root.setAttribute('data-splash-level', String(level));
            root.setAttribute('data-splash-lives', String(lives));
        }
        function say(text) { el.status.textContent = text; }
        function togglePause() {
            if (mode === 'playing') { setMode('paused'); say('Paused'); }
            else if (mode === 'paused') { setMode('playing'); say('Wave ' + level); root.focus({ preventScroll: true }); }
        }
        function alive() { return aliens.filter(function (a) { return a.alive; }); }
        function stepInterval() { return Math.max(35, 25 + alive().length * 12); }

        function fire() {
            if (mode !== 'playing' || shot) { return; }
            shot = { x: Math.round(player.x + player.w / 2), y: PLAYER_Y - 4 };
            beep(880, 80, 'sawtooth', 0.04, 220);
        }
        function hit(a, b) { return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y; }
        /* A shot or bomb against a shield's pixels: true, with a hole left,
           when it hits one. */
        function shieldHit(s, px, py, blast) {
            var lx = Math.floor(px - s.x), ly = Math.floor(py - s.y);
            if (lx < 0 || ly < 0 || lx >= s.w || ly >= s.h || !s.mask[ly * s.w + lx]) { return false; }
            for (var dy = -blast; dy <= blast; dy++) {
                for (var dx = -blast - 1; dx <= blast + 1; dx++) {
                    var x = lx + dx, y = ly + dy;
                    if (x < 0 || y < 0 || x >= s.w || y >= s.h) { continue; }
                    if (Math.abs(dx) + Math.abs(dy) <= blast + 1 || Math.random() < 0.4) { s.mask[y * s.w + x] = 0; }
                }
            }
            s.dirty = true;
            return true;
        }
        function addScore(n) {
            score += n;
            if (score > hi) { hi = score; }
            if (!extraGiven && score >= 1500) { extraGiven = true; lives++; say('An extra cannon.'); }
            tell();
        }
        function die() {
            setMode('dying');
            timer = 1200;
            bombs = []; shot = null;
            beep(160, 400, 'square', 0.05, 40);
        }
        function gameOver() {
            setMode('over');
            say('Game over: ' + score + ' points.');
            if (scores && score > 0) {
                scores.record(score, level).then(function (r) {
                    if (r.error) { say('Game over: ' + score + ' points. The score could not be kept: ' + r.error); }
                    else if (r.rank) { say('Game over: ' + score + ' points, your ' + ordinal(r.rank) + ' best.'); }
                }).catch(function () { });
            }
        }
        function ordinal(n) { return n + (n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th'); }

        function update(dt) {
            if (mode === 'dying') {
                timer -= dt;
                if (timer <= 0) {
                    lives--; tell();
                    if (lives <= 0) { gameOver(); return; }
                    player.x = (W - PLAYER.w) / 2;
                    setMode('playing');
                }
                return;
            }
            if (mode === 'cleared') {
                timer -= dt;
                if (timer <= 0) { level++; startWave(); setMode('playing'); say('Wave ' + level); }
                return;
            }
            if (mode !== 'playing') { return; }
            var held = input ? input.held : {};
            var move = 90 * dt / 1000;
            if (held.left) { player.x = Math.max(8, player.x - move); }
            if (held.right) { player.x = Math.min(W - 8 - player.w, player.x + move); }

            // The shot: up, into an invader, the saucer, a shield or the top.
            if (shot) {
                shot.y -= 240 * dt / 1000;
                var sr = { x: shot.x, y: shot.y, w: 1, h: 4 };
                var target = null;
                for (var i = 0; i < aliens.length && !target; i++) {
                    var a = aliens[i];
                    if (a.alive && hit(sr, { x: fx + a.ax, y: fy + a.ay, w: a.w, h: a.h })) { target = a; }
                }
                if (target) {
                    target.alive = false;
                    booms.push({ x: fx + target.ax + (target.w - BOOM.w) / 2, y: fy + target.ay, t: 250, spr: BOOM, colour: colours.fg });
                    addScore(target.type.points);
                    shot = null;
                    beep(200, 120, 'square', 0.05, 60);
                    if (!alive().length) { setMode('cleared'); timer = 1500; say('Wave ' + level + ' cleared'); }
                } else if (ufo && hit(sr, { x: ufo.x, y: ufo.y, w: UFO.w, h: UFO.h })) {
                    addScore(ufo.points);
                    toast = { text: String(ufo.points), x: ufo.x, y: ufo.y, t: 1000 };
                    ufo = null; shot = null;
                    beep(1200, 200, 'square', 0.05, 300);
                } else if (shields.some(function (s) { return shieldHit(s, shot.x, shot.y, 1); })) {
                    shot = null;
                } else if (shot.y < 20) {
                    booms.push({ x: shot.x - 3, y: 16, t: 200, spr: BOOM, colour: colours.danger });
                    shot = null;
                }
            }

            // The formation steps, sideways until an edge, then down and back.
            stepTimer += dt;
            var interval = stepInterval();
            if (stepTimer >= interval) {
                stepTimer = 0;
                var live = alive(), left = W, right = 0;
                live.forEach(function (a) { left = Math.min(left, fx + a.ax); right = Math.max(right, fx + a.ax + a.w); });
                if ((dir > 0 && right + 2 > W - 8) || (dir < 0 && left - 2 < 8)) { fy += 8; dir = -dir; }
                else { fx += dir * 2; }
                frame ^= 1;
                beep(MARCH[marchNote], 60, 'square', 0.03);
                marchNote = (marchNote + 1) % MARCH.length;
                live.forEach(function (a) { shields.forEach(function (s) { if (hit({ x: fx + a.ax, y: fy + a.ay, w: a.w, h: a.h }, s)) { s.mask.fill(0); s.dirty = true; } }); });
                if (live.some(function (a) { return fy + a.ay + a.h >= PLAYER_Y; })) { lives = 1; die(); return; }
            }

            // Bombs from the lowest invader of a column.
            bombTimer -= dt;
            if (bombTimer <= 0) {
                bombTimer = (1400 - Math.min(level, 10) * 80) * (0.6 + Math.random() * 0.8);
                var most = Math.min(3, 1 + Math.floor(level / 2));
                if (bombs.length < most) {
                    var cols = {};
                    alive().forEach(function (a) { if (!cols[a.col] || a.row > cols[a.col].row) { cols[a.col] = a; } });
                    var keys = Object.keys(cols);
                    if (keys.length) {
                        var from = cols[keys[Math.floor(Math.random() * keys.length)]];
                        bombs.push({ x: fx + from.ax + Math.floor(from.w / 2), y: fy + from.ay + from.h, w: 2, h: 6, wiggle: 0 });
                    }
                }
            }
            var fall = (80 + Math.min(level, 10) * 8) * dt / 1000;
            bombs = bombs.filter(function (b) {
                b.y += fall; b.wiggle += dt;
                if (shields.some(function (s) { return shieldHit(s, b.x, b.y + b.h, 1); })) { return false; }
                if (hit(b, { x: player.x, y: PLAYER_Y, w: player.w, h: PLAYER.h })) { die(); return false; }
                return b.y < GROUND_Y - 1;
            });
            if (mode !== 'playing') { return; }

            // The saucer, now and then while enough invaders remain.
            if (ufo) {
                ufo.x += ufo.dir * 40 * dt / 1000;
                ufoBlip -= dt;
                if (ufoBlip <= 0) { ufoBlip = 300; beep(620, 90, 'square', 0.02, 820); }
                if (ufo.x < -UFO.w || ufo.x > W) { ufo = null; ufoTimer = 15000 + Math.random() * 10000; }
            } else {
                ufoTimer -= dt;
                if (ufoTimer <= 0 && alive().length >= 8) {
                    var d = Math.random() < 0.5 ? 1 : -1;
                    ufo = { x: d > 0 ? -UFO.w : W, y: 24, dir: d, points: [50, 100, 150, 300][Math.floor(Math.random() * 4)] };
                    ufoBlip = 0;
                }
            }
        }

        /* === Drawing ======================================================== */
        /* Words in the pixel font, upper case, scale pixels big, with y the
           top of the letters and x the left, middre or right by align. */
        function text(s, x, y, colour, scale, align) {
            s = String(s).toUpperCase();
            scale = scale || 1;
            var step = 6 * scale, width = s.length * step - scale;
            var left = align === 'center' ? Math.round(x - width / 2) : align === 'right' ? Math.round(x - width) : Math.round(x);
            for (var i = 0; i < s.length; i++) {
                var g = GLYPH[s[i]];
                if (!g) { continue; }
                ctx.drawImage(image(g, colour), 0, 0, g.w, g.h, left + i * step, Math.round(y), g.w * scale, g.h * scale);
            }
        }
        function pad(n) { return ('0000' + n).slice(-4); }
        function draw() {
            ctx.fillStyle = colours.bg;
            ctx.fillRect(0, 0, W, H);
            text('SCORE ' + pad(score), 8, 5, colours.fg);
            text('HI ' + pad(hi), W / 2, 5, colours.muted, 1, 'center');
            for (var l = 0; l < Math.min(lives - 1, 5); l++) { ctx.drawImage(image(PLAYER, colours.accent), W - 8 - (l + 1) * 16, 4); }
            ctx.fillStyle = colours.positive;
            ctx.fillRect(8, GROUND_Y, W - 16, 1);
            shields.forEach(function (s) {
                if (s.dirty || !s.img) {
                    var c = s.img || document.createElement('canvas');
                    c.width = s.w; c.height = s.h;
                    var g = c.getContext('2d');
                    g.clearRect(0, 0, s.w, s.h);
                    g.fillStyle = colours.positive;
                    for (var y = 0; y < s.h; y++) { for (var x = 0; x < s.w; x++) { if (s.mask[y * s.w + x]) { g.fillRect(x, y, 1, 1); } } }
                    s.img = c; s.dirty = false;
                }
                ctx.drawImage(s.img, s.x, s.y);
            });
            aliens.forEach(function (a) { if (a.alive) { ctx.drawImage(image(a.type.frames[frame], colours.fg), fx + a.ax, fy + a.ay); } });
            booms.forEach(function (b) { ctx.drawImage(image(b.spr, b.colour), Math.round(b.x), Math.round(b.y)); });
            if (ufo) { ctx.drawImage(image(UFO, colours.warn), Math.round(ufo.x), ufo.y); }
            if (toast) { text(toast.text, Math.round(toast.x + UFO.w / 2), toast.y, colours.warn, 1, 'center'); }
            if (shot) { ctx.fillStyle = colours.accent; ctx.fillRect(shot.x, Math.round(shot.y), 1, 4); }
            ctx.fillStyle = colours.danger;
            bombs.forEach(function (b) { var z = Math.floor(b.wiggle / 100) % 2; ctx.fillRect(Math.round(b.x) + z, Math.round(b.y), 1, 3); ctx.fillRect(Math.round(b.x) + 1 - z, Math.round(b.y) + 3, 1, 3); });
            if (mode === 'dying') { ctx.drawImage(image(PLAYER_BOOM[Math.floor(timer / 150) % 2], colours.danger), Math.round(player.x), PLAYER_Y + 1); }
            else if (mode !== 'ready' && mode !== 'over') { ctx.drawImage(image(PLAYER, colours.accent), Math.round(player.x), PLAYER_Y); }
            if (mode === 'ready') {
                text('SPACE INVADERS', W / 2, 100, colours.fg, 2, 'center');
                text('ENTER OR NEW GAME TO PLAY', W / 2, 124, colours.muted, 1, 'center');
                ctx.drawImage(image(SQUID[0], colours.fg), 76, 148); text('= 30 POINTS', 96, 148, colours.muted);
                ctx.drawImage(image(CRAB[0], colours.fg), 74, 164); text('= 20 POINTS', 96, 164, colours.muted);
                ctx.drawImage(image(OCTOPUS[0], colours.fg), 74, 180); text('= 10 POINTS', 96, 180, colours.muted);
                ctx.drawImage(image(UFO, colours.warn), 72, 196); text('= ? MYSTERY', 96, 196, colours.muted);
            } else if (mode === 'paused') {
                text('PAUSED', W / 2, 116, colours.fg, 2, 'center');
            } else if (mode === 'over') {
                text('GAME OVER', W / 2, 108, colours.danger, 2, 'center');
                text('ENTER OR NEW GAME TO PLAY AGAIN', W / 2, 132, colours.muted, 1, 'center');
            } else if (mode === 'cleared') {
                text('WAVE ' + level + ' CLEARED', W / 2, 116, colours.fg, 2, 'center');
            }
        }

        /* The frame loop runs while something moves; a still screen is
           drawn once and the loop stops. */
        var raf = null, last = 0;
        function moving() { return mode === 'playing' || mode === 'dying' || mode === 'cleared' || booms.length > 0 || !!toast; }
        function tick(t) {
            raf = null;
            var dt = last ? Math.min(50, t - last) : 0;
            last = t;
            update(dt);
            booms = booms.filter(function (b) { b.t -= dt; return b.t > 0; });
            if (toast) { toast.t -= dt; if (toast.t <= 0) { toast = null; } }
            draw();
            if (moving()) { raf = requestAnimationFrame(tick); } else { last = 0; }
        }
        function loop() { if (!raf) { last = 0; raf = requestAnimationFrame(tick); } }

        /* === Sound ========================================================== */
        function beep(freq, ms, type, gain, to) {
            if (!sound.on) { return; }
            try {
                audio = audio || new (window.AudioContext || window.webkitAudioContext)();
                if (audio.state === 'suspended') { audio.resume(); }
                var o = audio.createOscillator(), g = audio.createGain(), now = audio.currentTime;
                o.type = type || 'square';
                o.frequency.setValueAtTime(freq, now);
                if (to) { o.frequency.exponentialRampToValueAtTime(to, now + ms / 1000); }
                g.gain.setValueAtTime(gain || 0.04, now);
                g.gain.exponentialRampToValueAtTime(0.0005, now + ms / 1000);
                o.connect(g); g.connect(audio.destination);
                o.start(now); o.stop(now + ms / 1000 + 0.01);
            } catch (err) { sound.on = false; }
        }
        function loadSound() {
            if (host.config) { host.config.load('invaders', { sound: true }).then(function (s) { sound.on = s.sound !== false; }).catch(function () { }); }
            else { try { sound.on = localStorage.getItem('splash-invaders-sound') !== 'off'; } catch (err) { } }
        }
        function toggleSound() {
            sound.on = !sound.on;
            if (host.config) { host.config.set('invaders', { sound: sound.on }).catch(function () { }); }
            else { try { localStorage.setItem('splash-invaders-sound', sound.on ? 'on' : 'off'); } catch (err) { } }
        }

        /* === Dialogs ======================================================== */
        function openScores() {
            var list = scores ? scores.list() : Promise.resolve([]);
            list.then(function (l) {
                if (!l.length) { el.scoresBody.innerHTML = '<p>No scores yet. The ten best games are kept in ' + (scores ? scores.where : 'this browser') + '.</p>'; }
                else {
                    el.scoresBody.innerHTML = '<table class="splash-scores"><thead><tr><th>#</th><th>Score</th><th>Wave</th><th>Date</th></tr></thead><tbody>' +
                        l.map(function (e, i) { return '<tr' + (mode === 'over' && e.score === score && e.date === new Date().toISOString().slice(0, 10) ? ' class="splash-mine"' : '') + '><td>' + (i + 1) + '</td><td>' + e.score + '</td><td>' + e.level + '</td><td>' + e.date + '</td></tr>'; }).join('') +
                        '</tbody></table><p class="form-help">Kept in ' + scores.where + '.</p>';
                }
                if (!el.scores.open) { el.scores.showModal(); }
            }).catch(function () { });
        }
        function openHelp() { if (!el.help.open) { el.help.showModal(); } }

        /* === Wiring ========================================================= */
        function onClick(e) {
            var b = e.target.closest('[data-action]');
            if (!b || !root.contains(b)) { return; }
            switch (b.getAttribute('data-action')) {
                case 'start': newGame(1); break;
                case 'pause': togglePause(); break;
                case 'scores': openScores(); break;
                case 'help': openHelp(); break;
                case 'close-scores': el.scores.close(); root.focus({ preventScroll: true }); break;
                case 'close-help': el.help.close(); root.focus({ preventScroll: true }); break;
            }
        }
        root.addEventListener('click', onClick);
        function onTheme() { readColours(); draw(); }
        document.addEventListener('pudl:theme-change', onTheme);
        var mql = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
        if (mql && mql.addEventListener) { mql.addEventListener('change', onTheme); }

        function levelAsked(s) {
            if (!s) { return null; }
            var v = new URLSearchParams(String(s).replace(/^\?/, '')).get('level');
            return v && /^[1-9][0-9]?$/.test(v) ? +v : null;
        }

        readColours();
        shields = newShields();
        draw();
        tell();
        root.setAttribute('data-splash-state', mode);
        var ready = shared.then(function () {
            input = window.splash.input(root, {
                press: function (name) {
                    if (name === 'fire') { if (mode === 'ready' || mode === 'over') { newGame(1); } else { fire(); } }
                    else if (name === 'start') { if (mode === 'ready' || mode === 'over') { newGame(1); } else if (mode === 'paused') { togglePause(); } }
                    else if (name === 'pause') { togglePause(); }
                },
                away: function () { if (mode === 'playing') { togglePause(); } },
                pad: ['left', 'right', { name: 'fire', label: 'Fire' }]
            });
            if (input.pad) { root.insertBefore(input.pad, el.scores); }
            scores = window.splash.scores(host, 'invaders');
            scores.best().then(function (b) { hi = b; draw(); }).catch(function () { });
            loadSound();
            var asked = levelAsked(opts.state);
            if (asked) { newGame(asked); }
        }).catch(function (err) { say('The game could not load its controls: ' + err.message); });

        return {
            state: function () { return null; },
            setState: function (s) { var asked = levelAsked(s); if (asked) { ready.then(function () { newGame(asked); }); } },
            menus: function () {
                var items = [
                    { label: 'New game', run: function () { newGame(1); } },
                    { label: mode === 'paused' ? 'Resume' : 'Pause', disabled: !(mode === 'playing' || mode === 'paused'), run: togglePause },
                    '-',
                    { label: 'High scores…', run: openScores },
                    { label: 'Sound', checked: sound.on, run: toggleSound }
                ];
                return { titles: [{ label: 'Space Invaders', items: host.identity ? host.identity(root, items) : items }], into: { help: [{ label: 'Space Invaders help', run: openHelp }] } };
            },
            destroy: function () {
                if (raf) { cancelAnimationFrame(raf); raf = null; }
                root.removeEventListener('click', onClick);
                document.removeEventListener('pudl:theme-change', onTheme);
                if (mql && mql.removeEventListener) { mql.removeEventListener('change', onTheme); }
                if (input) { input.destroy(); }
                if (audio) { try { audio.close(); } catch (err) { } }
            }
        };
    }

    window.pudlApplets.register('invaders', { init: init });
})();
