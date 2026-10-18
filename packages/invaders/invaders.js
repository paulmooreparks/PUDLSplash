/* Copyright 2026 Paul Parks. SPDX-License-Identifier: Apache-2.0 */
/* Space Invaders, a PUDL applet package (../../README.md). The 1978 game:
   fifty-five invaders march across a canvas of 224 by 256 pixels, dropping
   a row and speeding up as their number falls, while the cannon shoots
   from behind four shields that crumble under fire. The shell
   (../shared/splash-shell.js) gives it the canvas, the bar, the dialogs,
   the scores, the sound and the loop; this file is the game. */
(function () {
    'use strict';
    /* The shared modules are bundled in front of this file when the
       package is built (applet.json, "bundle"), so window.splash is here. */
    var W = 224, H = 256;
    var PLAYER_Y = 216, SHIELD_Y = 184, GROUND_Y = 247;

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
    var HELP =
        '<p>Shoot the invaders before they reach the ground. Each wave starts lower and marches faster as its numbers fall. A saucer now and then is worth more. You have three cannons, and a fourth at 1,500 points.</p>' +
        '<dl class="splash-keys">' +
          '<dt>← → or A D</dt><dd>Move</dd>' +
          '<dt>Space or X</dt><dd>Fire</dd>' +
          '<dt>P or Esc</dt><dd>Pause and resume</dd>' +
          '<dt>Enter</dt><dd>Start a game</dd>' +
        '</dl>' +
        '<p>On a touch screen, the buttons under the game do the same. The game pauses when it loses the keyboard.</p>';

    function init(root, opts) {
        var shell = null, S = null, ctx = null, C = null;
        var aliens = [], fx = 0, fy = 0, dir = 1, frame = 0, stepTimer = 0, marchNote = 0;
        var player = { x: (W - PLAYER.w) / 2, w: PLAYER.w }, shot = null, bombs = [], bombTimer = 0;
        var ufo = null, ufoTimer = 0, ufoBlip = 0, toast = null, booms = [], shields = [];

        function newShields() {
            return [32, 80, 128, 176].map(function (x) {
                var mask = new Uint8Array(SHIELD.w * SHIELD.h);
                for (var y = 0; y < SHIELD.h; y++) { for (var i = 0; i < SHIELD.w; i++) { mask[y * SHIELD.w + i] = SHIELD.rows[y][i] === 'X' ? 1 : 0; } }
                return { x: x, y: SHIELD_Y, w: SHIELD.w, h: SHIELD.h, mask: mask, img: null, dirty: true };
            });
        }
        function startWave(level) {
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
        function alive() { return aliens.filter(function (a) { return a.alive; }); }
        function stepInterval() { return Math.max(35, 25 + alive().length * 12); }
        function fire() {
            if (S.mode !== 'playing' || shot) { return; }
            shot = { x: Math.round(player.x + player.w / 2), y: PLAYER_Y - 4 };
            shell.beep(880, 80, 'sawtooth', 0.04, 220);
        }
        function hit(a, b) { return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y; }
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
        function die() {
            bombs = []; shot = null;
            shell.die(1200);
            shell.beep(160, 400, 'square', 0.05, 40);
        }

        function update(dt, held) {
            var move = 90 * dt / 1000;
            if (held.left) { player.x = Math.max(8, player.x - move); }
            if (held.right) { player.x = Math.min(W - 8 - player.w, player.x + move); }

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
                    booms.push({ x: fx + target.ax + (target.w - BOOM.w) / 2, y: fy + target.ay, t: 250, spr: BOOM, colour: C.fg });
                    shell.addScore(target.type.points);
                    shot = null;
                    shell.beep(200, 120, 'square', 0.05, 60);
                    if (!alive().length) { shell.cleared(1500); return; }
                } else if (ufo && hit(sr, { x: ufo.x, y: ufo.y, w: UFO.w, h: UFO.h })) {
                    shell.addScore(ufo.points);
                    toast = { text: String(ufo.points), x: ufo.x, y: ufo.y, t: 1000 };
                    ufo = null; shot = null;
                    shell.beep(1200, 200, 'square', 0.05, 300);
                } else if (shields.some(function (s) { return shieldHit(s, shot.x, shot.y, 1); })) {
                    shot = null;
                } else if (shot.y < 20) {
                    booms.push({ x: shot.x - 3, y: 16, t: 200, spr: BOOM, colour: C.danger });
                    shot = null;
                }
            }

            stepTimer += dt;
            var interval = stepInterval();
            if (stepTimer >= interval) {
                stepTimer = 0;
                var live = alive(), left = W, right = 0;
                live.forEach(function (a) { left = Math.min(left, fx + a.ax); right = Math.max(right, fx + a.ax + a.w); });
                if ((dir > 0 && right + 2 > W - 8) || (dir < 0 && left - 2 < 8)) { fy += 8; dir = -dir; }
                else { fx += dir * 2; }
                frame ^= 1;
                shell.beep(MARCH[marchNote], 60, 'square', 0.03);
                marchNote = (marchNote + 1) % MARCH.length;
                live.forEach(function (a) { shields.forEach(function (s) { if (hit({ x: fx + a.ax, y: fy + a.ay, w: a.w, h: a.h }, s)) { s.mask.fill(0); s.dirty = true; } }); });
                if (live.some(function (a) { return fy + a.ay + a.h >= PLAYER_Y; })) { S.lives = 1; die(); return; }
            }

            bombTimer -= dt;
            if (bombTimer <= 0) {
                bombTimer = (1400 - Math.min(S.level, 10) * 80) * (0.6 + Math.random() * 0.8);
                var most = Math.min(3, 1 + Math.floor(S.level / 2));
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
            var fall = (80 + Math.min(S.level, 10) * 8) * dt / 1000, killed = false;
            bombs = bombs.filter(function (b) {
                b.y += fall; b.wiggle += dt;
                if (shields.some(function (s) { return shieldHit(s, b.x, b.y + b.h, 1); })) { return false; }
                if (!killed && hit(b, { x: player.x, y: PLAYER_Y, w: player.w, h: PLAYER.h })) { killed = true; return false; }
                return b.y < GROUND_Y - 1;
            });
            if (killed) { die(); return; }

            if (ufo) {
                ufo.x += ufo.dir * 40 * dt / 1000;
                ufoBlip -= dt;
                if (ufoBlip <= 0) { ufoBlip = 300; shell.beep(620, 90, 'square', 0.02, 820); }
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

        function pad(n) { return ('0000' + n).slice(-4); }
        function draw() {
            var text = shell.text, image = shell.image, mode = S.mode;
            text('SCORE ' + pad(S.score), 8, 5, C.fg);
            text('HI ' + pad(S.hi), W / 2, 5, C.muted, 1, 'center');
            for (var l = 0; l < Math.min(S.lives - 1, 5); l++) { ctx.drawImage(image(PLAYER, C.accent), W - 8 - (l + 1) * 16, 4); }
            ctx.fillStyle = C.positive;
            ctx.fillRect(8, GROUND_Y, W - 16, 1);
            shields.forEach(function (s) {
                if (s.dirty || !s.img) {
                    var c = s.img || document.createElement('canvas');
                    c.width = s.w; c.height = s.h;
                    var g = c.getContext('2d');
                    g.clearRect(0, 0, s.w, s.h);
                    g.fillStyle = C.positive;
                    for (var y = 0; y < s.h; y++) { for (var x = 0; x < s.w; x++) { if (s.mask[y * s.w + x]) { g.fillRect(x, y, 1, 1); } } }
                    s.img = c; s.dirty = false;
                }
                ctx.drawImage(s.img, s.x, s.y);
            });
            aliens.forEach(function (a) { if (a.alive) { ctx.drawImage(image(a.type.frames[frame], C.fg), fx + a.ax, fy + a.ay); } });
            booms.forEach(function (b) { ctx.drawImage(image(b.spr, b.colour), Math.round(b.x), Math.round(b.y)); });
            if (ufo) { ctx.drawImage(image(UFO, C.warn), Math.round(ufo.x), ufo.y); }
            if (toast) { text(toast.text, Math.round(toast.x + UFO.w / 2), toast.y, C.warn, 1, 'center'); }
            if (shot) { ctx.fillStyle = C.accent; ctx.fillRect(shot.x, Math.round(shot.y), 1, 4); }
            ctx.fillStyle = C.danger;
            bombs.forEach(function (b) { var z = Math.floor(b.wiggle / 100) % 2; ctx.fillRect(Math.round(b.x) + z, Math.round(b.y), 1, 3); ctx.fillRect(Math.round(b.x) + 1 - z, Math.round(b.y) + 3, 1, 3); });
            if (mode === 'dying') { ctx.drawImage(image(PLAYER_BOOM[Math.floor(S.timer / 150) % 2], C.danger), Math.round(player.x), PLAYER_Y + 1); }
            else if (mode !== 'ready' && mode !== 'over') { ctx.drawImage(image(PLAYER, C.accent), Math.round(player.x), PLAYER_Y); }
            if (mode === 'ready') {
                /* The title and the table end above the shields at 184. */
                text('SPACE INVADERS', W / 2, 52, C.fg, 2, 'center');
                text('ENTER OR NEW GAME TO PLAY', W / 2, 76, C.muted, 1, 'center');
                ctx.drawImage(image(SQUID[0], C.fg), 76, 100); text('= 30 POINTS', 96, 100, C.muted);
                ctx.drawImage(image(CRAB[0], C.fg), 74, 116); text('= 20 POINTS', 96, 116, C.muted);
                ctx.drawImage(image(OCTOPUS[0], C.fg), 74, 132); text('= 10 POINTS', 96, 132, C.muted);
                ctx.drawImage(image(UFO, C.warn), 72, 148); text('= ? MYSTERY', 96, 148, C.muted);
            } else if (mode === 'paused') {
                text('PAUSED', W / 2, 116, C.fg, 2, 'center');
            } else if (mode === 'over') {
                text('GAME OVER', W / 2, 108, C.danger, 2, 'center');
                text('ENTER OR NEW GAME TO PLAY AGAIN', W / 2, 132, C.muted, 1, 'center');
            } else if (mode === 'cleared') {
                text('WAVE ' + S.level + ' CLEARED', W / 2, 116, C.fg, 2, 'center');
            }
        }

        shields = newShields();
        shell = window.splash.shell(root, opts, {
            game: 'invaders', title: 'Space Invaders', width: W, height: H, help: HELP,
            pad: ['left', 'right', { name: 'fire', label: 'Fire' }], extraLifeEvery: 1500,
            newGame: startWave, newWave: startWave,
            respawn: function () { player.x = (W - PLAYER.w) / 2; },
            update: update, draw: draw,
            press: function (name) { if (name === 'fire') { fire(); } },
            after: function (dt) {
                booms = booms.filter(function (b) { b.t -= dt; return b.t > 0; });
                if (toast) { toast.t -= dt; if (toast.t <= 0) { toast = null; } }
            },
            busy: function () { return booms.length > 0 || !!toast; },
            recolour: function () { shields.forEach(function (s) { s.dirty = true; }); }
        });
        S = shell.state; ctx = S.ctx; C = S.colours;
        shell.draw();
        return shell.instance;
    }

    window.pudlApplets.register('invaders', { init: init });
})();
