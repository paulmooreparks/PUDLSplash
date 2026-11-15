/* Copyright 2026 Paul Parks. SPDX-License-Identifier: Apache-2.0 */
/* Pantry Raid, a PUDL applet package (../../README.md). A maze chase: a
   mouse eats every crumb in a pantry while four cats hunt it, and a bell
   sends the cats running for a few seconds. Every level has a maze of its
   own, made from the level's number, so level 7 is the same maze for
   everybody. The shell (../shared/splash-shell.js) gives it the canvas,
   the bar, the dialogs, the scores, the sound and the loop; this file is
   the game. */
(function () {
    'use strict';
    /* The shared modules are bundled in front of this file when the
       package is built (applet.json, "bundle"), so window.splash is here. */
    var T = 12, COLS = 19, ROWS = 21, TOP = 12, FOOT = 14;
    var W = COLS * T, H = TOP + ROWS * T + FOOT;
    var DIR = { left: { x: -1, y: 0, a: -Math.PI / 2 }, right: { x: 1, y: 0, a: Math.PI / 2 }, up: { x: 0, y: -1, a: 0 }, down: { x: 0, y: 1, a: Math.PI } };
    var DIRS = [DIR.up, DIR.left, DIR.down, DIR.right];
    var START = { x: 9, y: 15 };
    var HOMES = [{ x: 1, y: 1 }, { x: 17, y: 1 }, { x: 1, y: 19 }, { x: 17, y: 19 }];
    var BELLS = [{ x: 5, y: 5 }, { x: 13, y: 5 }, { x: 5, y: 15 }, { x: 13, y: 15 }];

    function sprite(id, rows) { return { id: id, w: rows[0].length, h: rows.length, rows: rows }; }
    /* The mouse from above, nose up; it is turned to face the way it runs. */
    var MOUSE = [
        sprite('pm1', ['....X....', '...XXX...', '.X.XXX.X.', 'XXXXXXXXX', 'XX.XXX.XX', '.XXXXXXX.', '.XXXXXXX.', '.XXXXXXX.', '..XXXXX..', '....X....', '...X.....']),
        sprite('pm2', ['....X....', '...XXX...', '.X.XXX.X.', 'XXXXXXXXX', 'XX.XXX.XX', '.XXXXXXX.', '.XXXXXXX.', '.XXXXXXX.', '..XXXXX..', '....X....', '.....X...'])
    ];
    var CAT = sprite('pc', ['X.........X', 'XX.......XX', 'XXX.....XXX', 'XXXXXXXXXXX', 'XXXXXXXXXXX', 'XX..XXX..XX', 'XX..XXX..XX', 'XXXXX.XXXXX', 'XXXXXXXXXXX', '.XXXXXXXXX.']);
    var BELL = sprite('pb', ['...X...', '..XXX..', '.XXXXX.', '.XXXXX.', '.XXXXX.', 'XXXXXXX', '...X...']);
    var CHEESE = sprite('pz', ['......XXX', '....XXXXX', '..XXXXXXX', 'XXXXXXXXX', 'X.XXX.XXX', 'XXXXXXX.X', 'XXXXXXXXX']);
    var HELP =
        '<p>Eat every crumb in the pantry and keep away from the four cats. Ring a bell and the cats run from you for a few seconds; catch one while it runs and it goes back to its corner. A piece of cheese appears once half the crumbs are gone. Every level is a new maze with faster cats. You have three mice, and another every 5,000 points.</p>' +
        '<dl class="splash-keys">' +
          '<dt>Arrows or W A S D</dt><dd>Turn; the mouse keeps running until a wall stops it</dd>' +
          '<dt>P or Esc</dt><dd>Pause and resume</dd>' +
          '<dt>Enter</dt><dd>Start a game</dd>' +
        '</dl>' +
        '<p>On a touch screen, the buttons under the game do the same. The game pauses when it loses the keyboard.</p>';

    /* A small generator of random numbers from a seed, so a level's maze
       is always the same maze. */
    function rng(seed) {
        var a = seed >>> 0;
        return function () {
            a = (a + 0x6D2B79F5) | 0;
            var t = Math.imul(a ^ (a >>> 15), 1 | a);
            t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }

    /* A level's maze, as COLS by ROWS tiles that are open (1) or wall (0).
       The rooms are the tiles at odd columns and rows. The left half and
       the middle column are carved as one tree, so every room is reached,
       and mirrored onto the right. Then every dead end is opened into a
       neighbour and a few more walls are knocked through, so there is
       always a second way out of a corridor. */
    function makeMaze(level) {
        var rnd = rng(level * 7919 + 17), open = new Uint8Array(COLS * ROWS);
        var CX = 5, CY = 10;
        function carve(x, y) { open[y * COLS + x] = 1; open[y * COLS + (COLS - 1 - x)] = 1; }
        function isOpen(x, y) { return x >= 0 && y >= 0 && x < COLS && y < ROWS && open[y * COLS + x] === 1; }
        var seen = new Uint8Array(CX * CY), stack = [[4, 7]];
        seen[7 * CX + 4] = 1;
        carve(START.x, START.y);
        while (stack.length) {
            var c = stack[stack.length - 1], ways = [];
            for (var i = 0; i < DIRS.length; i++) {
                var nx = c[0] + DIRS[i].x, ny = c[1] + DIRS[i].y;
                if (nx >= 0 && ny >= 0 && nx < CX && ny < CY && !seen[ny * CX + nx]) { ways.push(DIRS[i]); }
            }
            if (!ways.length) { stack.pop(); continue; }
            var d = ways[Math.floor(rnd() * ways.length)];
            seen[(c[1] + d.y) * CX + c[0] + d.x] = 1;
            carve(1 + 2 * c[0] + d.x, 1 + 2 * c[1] + d.y);
            carve(1 + 2 * (c[0] + d.x), 1 + 2 * (c[1] + d.y));
            stack.push([c[0] + d.x, c[1] + d.y]);
        }
        function room(x, y) { return x >= 1 && y >= 1 && x <= COLS - 2 && y <= ROWS - 2; }
        for (var cy = 0; cy < CY; cy++) {
            for (var cx = 0; cx < CX; cx++) {
                var x = 1 + 2 * cx, y = 1 + 2 * cy;
                var shut = DIRS.filter(function (w) { return !isOpen(x + w.x, y + w.y) && room(x + 2 * w.x, y + 2 * w.y); });
                var exits = DIRS.filter(function (w) { return isOpen(x + w.x, y + w.y); }).length;
                if (exits < 2 && shut.length) { var k = shut[Math.floor(rnd() * shut.length)]; carve(x + k.x, y + k.y); }
                if (room(x + 2, y) && !isOpen(x + 1, y) && rnd() < 0.12) { carve(x + 1, y); }
                if (room(x, y + 2) && !isOpen(x, y + 1) && rnd() < 0.12) { carve(x, y + 1); }
            }
        }
        return { open: open, isOpen: isOpen };
    }
    window.splash.pantry = { maze: makeMaze, cols: COLS, rows: ROWS, start: START, homes: HOMES, bells: BELLS };

    function init(root, opts) {
        var shell = null, S = null, ctx = null, C = null;
        var maze = makeMaze(1), mazeImg = null, crumbs = new Uint8Array(COLS * ROWS), left = 0, total = 0;
        var bells = [], cheese = null, cheeseDone = false, toast = null;
        var mouse = { x: START.x, y: START.y, p: 0, dir: null, face: DIR.up }, want = null, cats = [];
        var phase = 0, combo = 0, clock = 0, munch = 0;

        function place() {
            mouse = { x: START.x, y: START.y, p: 0, dir: null, face: DIR.up };
            want = null; phase = 0; combo = 0;
            cats = HOMES.map(function (h, i) { return { kind: i, hx: h.x, hy: h.y, x: h.x, y: h.y, p: 0, dir: null, wait: 800 + i * 2500, scared: 0 }; });
        }
        function startWave(level) {
            maze = makeMaze(level); mazeImg = null;
            crumbs = new Uint8Array(maze.open);
            crumbs[START.y * COLS + START.x] = 0;
            HOMES.concat(BELLS).forEach(function (t) { crumbs[t.y * COLS + t.x] = 0; });
            total = 0;
            for (var i = 0; i < crumbs.length; i++) { total += crumbs[i]; }
            left = total;
            bells = BELLS.map(function (b) { return { x: b.x, y: b.y, on: true }; });
            cheese = null; cheeseDone = false; toast = null;
            place();
        }

        /* Something that runs along the corridors: it is p of the way from
           its tile (x, y) to the next one in its direction. advance moves
           it a distance in tiles, asking choose for a direction at every
           tile it reaches. */
        function advance(e, dist, choose, arrive) {
            for (var guard = 0; dist > 0 && guard < 8; guard++) {
                if (!e.dir || !maze.isOpen(e.x + e.dir.x, e.y + e.dir.y)) { e.dir = choose(e); if (!e.dir) { return; } }
                var room = 1 - e.p;
                if (dist < room) { e.p += dist; return; }
                dist -= room;
                e.x += e.dir.x; e.y += e.dir.y; e.p = 0;
                if (arrive) { arrive(e); }
                e.dir = choose(e);
            }
        }
        function opposite(d) { return d === DIR.left ? DIR.right : d === DIR.right ? DIR.left : d === DIR.up ? DIR.down : DIR.up; }
        function reverse(e) {
            if (!e.dir) { return; }
            if (e.p > 0) { e.x += e.dir.x; e.y += e.dir.y; e.p = 1 - e.p; }
            e.dir = opposite(e.dir);
        }
        function at(e) { return { x: e.x + (e.dir ? e.dir.x * e.p : 0), y: e.y + (e.dir ? e.dir.y * e.p : 0) }; }

        function chooseMouse(m) {
            if (want && maze.isOpen(m.x + want.x, m.y + want.y)) { return want; }
            if (m.dir && maze.isOpen(m.x + m.dir.x, m.y + m.dir.y)) { return m.dir; }
            return null;
        }
        function ring() {
            shell.addScore(50);
            combo = 0;
            var time = Math.max(2500, 7000 - (S.level - 1) * 500);
            cats.forEach(function (c) { if (c.wait <= 0) { c.scared = time; reverse(c); } });
            shell.beep(1300, 260, 'triangle', 0.06, 900);
        }
        function arrive(m) {
            var i = m.y * COLS + m.x;
            if (crumbs[i]) {
                crumbs[i] = 0; left--;
                shell.addScore(10);
                munch ^= 1;
                shell.beep(munch ? 520 : 440, 40, 'square', 0.03);
                if (!cheeseDone && left <= total / 2) { cheeseDone = true; cheese = { t: 10000 }; }
            }
            bells.forEach(function (b) { if (b.on && b.x === m.x && b.y === m.y) { b.on = false; ring(); } });
            if (cheese && m.x === START.x && m.y === START.y) {
                var points = Math.min(500, 100 * S.level);
                shell.addScore(points);
                toast = { text: String(points), x: START.x, y: START.y, t: 900 };
                cheese = null;
                shell.beep(700, 200, 'triangle', 0.06, 1400);
            }
        }

        /* Where a hunting cat is heading. The first goes for the mouse, the
           second for the corridor ahead of it, the third only when the
           mouse comes near, and the fourth stands guard over the nearest
           bell that is left. */
        function target(c) {
            if (c.kind === 1) { return { x: mouse.x + mouse.face.x * 4, y: mouse.y + mouse.face.y * 4 }; }
            if (c.kind === 3) {
                var best = null, far = 1e9;
                bells.forEach(function (b) {
                    var d = (b.x - c.x) * (b.x - c.x) + (b.y - c.y) * (b.y - c.y);
                    if (b.on && d < far && d > 4) { far = d; best = b; }
                });
                if (best) { return best; }
            }
            return mouse;
        }
        function chooseCat(c) {
            var ways = DIRS.filter(function (d) { return maze.isOpen(c.x + d.x, c.y + d.y) && !(c.dir && d === opposite(c.dir)); });
            if (!ways.length) { ways = DIRS.filter(function (d) { return maze.isOpen(c.x + d.x, c.y + d.y); }); }
            if (!ways.length) { return null; }
            var near = (mouse.x - c.x) * (mouse.x - c.x) + (mouse.y - c.y) * (mouse.y - c.y) < 36;
            if (c.scared > 0 || phase % 20000 > 16000 || (c.kind === 2 && !near)) { return ways[Math.floor(Math.random() * ways.length)]; }
            var t = target(c), best = ways[0], least = 1e9;
            ways.forEach(function (d) {
                var dx = c.x + d.x - t.x, dy = c.y + d.y - t.y, far = dx * dx + dy * dy;
                if (far < least) { least = far; best = d; }
            });
            return best;
        }

        function update(dt) {
            clock += dt; phase += dt;
            if (want && mouse.dir && want === opposite(mouse.dir)) { reverse(mouse); }
            else if (mouse.p === 0 && mouse.dir) { mouse.dir = chooseMouse(mouse); }
            advance(mouse, 6.2 * dt / 1000, chooseMouse, arrive);
            if (mouse.dir) { mouse.face = mouse.dir; }
            if (left <= 0) { shell.beep(660, 500, 'triangle', 0.06, 1320); shell.cleared(1500); return; }

            var speed = Math.min(6, 4.6 + (S.level - 1) * 0.2), caught = false, m = at(mouse);
            cats.forEach(function (c) {
                if (c.wait > 0) { c.wait -= dt; return; }
                c.scared = Math.max(0, c.scared - dt);
                advance(c, (c.scared > 0 ? 3 : speed) * dt / 1000, chooseCat, null);
                var p = at(c), dx = p.x - m.x, dy = p.y - m.y;
                if (dx * dx + dy * dy > 0.4) { return; }
                if (c.scared > 0) {
                    combo++;
                    shell.addScore(150 * combo);
                    toast = { text: String(150 * combo), x: p.x, y: p.y, t: 900 };
                    c.x = c.hx; c.y = c.hy; c.p = 0; c.dir = null; c.scared = 0; c.wait = 3000;
                    shell.beep(300, 220, 'sawtooth', 0.05, 1200);
                } else { caught = true; }
            });
            if (caught) { shell.die(1300); shell.beep(500, 600, 'sawtooth', 0.05, 60); return; }
            if (cheese) { cheese.t -= dt; if (cheese.t <= 0) { cheese = null; } }
        }

        function buildMaze() {
            var c = document.createElement('canvas');
            c.width = W; c.height = ROWS * T;
            var g = c.getContext('2d');
            g.fillStyle = C.muted;
            for (var y = 0; y < ROWS; y++) {
                for (var x = 0; x < COLS; x++) {
                    if (maze.open[y * COLS + x]) { continue; }
                    var cx = x * T + T / 2, cy = y * T + T / 2;
                    g.fillRect(cx - 2, cy - 2, 4, 4);
                    if (x + 1 < COLS && !maze.open[y * COLS + x + 1]) { g.fillRect(cx + 2, cy - 2, T - 4, 4); }
                    if (y + 1 < ROWS && !maze.open[(y + 1) * COLS + x]) { g.fillRect(cx - 2, cy + 2, 4, T - 4); }
                }
            }
            mazeImg = c;
        }
        function px(x) { return Math.round(x * T + T / 2); }
        function py(y) { return Math.round(TOP + y * T + T / 2); }
        function pad(n) { return ('00000' + n).slice(-5); }
        function banner(str, colour, sub) {
            ctx.fillStyle = C.bg;
            ctx.fillRect(0, 116, W, sub ? 46 : 30);
            shell.text(str, W / 2, 124, colour, 2, 'center');
            if (sub) { shell.text(sub, W / 2, 146, C.muted, 1, 'center'); }
        }
        var COAT = ['danger', 'warn', 'positive', 'accent'];
        function draw() {
            var text = shell.text, image = shell.image, mode = S.mode;
            text('SCORE ' + pad(S.score), 4, 2, C.fg);
            text('HI ' + pad(S.hi), W - 4, 2, C.muted, 1, 'right');
            if (mode === 'ready') {
                text('PANTRY RAID', W / 2, 56, C.fg, 2, 'center');
                text('ENTER OR NEW GAME TO PLAY', W / 2, 80, C.muted, 1, 'center');
                ctx.drawImage(image(MOUSE[0], C.fg), 50, 108); text('EATS THE CRUMBS', 70, 110, C.muted);
                ctx.drawImage(image(CAT, C.danger), 49, 130); text('EATS THE MOUSE', 70, 132, C.muted);
                ctx.drawImage(image(BELL, C.warn), 51, 154); text('SCARES THE CATS', 70, 154, C.muted);
                ctx.drawImage(image(CHEESE, C.warn), 50, 176); text('IS WORTH A DETOUR', 70, 176, C.muted);
                return;
            }
            if (!mazeImg) { buildMaze(); }
            ctx.drawImage(mazeImg, 0, TOP);
            ctx.fillStyle = C.fg;
            for (var y = 0; y < ROWS; y++) {
                for (var x = 0; x < COLS; x++) { if (crumbs[y * COLS + x]) { ctx.fillRect(px(x) - 1, py(y) - 1, 2, 2); } }
            }
            var blink = Math.floor(clock / 250) % 2 === 0 || mode !== 'playing';
            bells.forEach(function (b) { if (b.on && blink) { ctx.drawImage(image(BELL, C.warn), px(b.x) - 3, py(b.y) - 3); } });
            if (cheese && (cheese.t > 2500 || blink)) { ctx.drawImage(image(CHEESE, C.warn), px(START.x) - 4, py(START.y) - 3); }
            cats.forEach(function (c) {
                var p = at(c), colour = C[COAT[c.kind]];
                if (c.scared > 0) { colour = c.scared < 1500 && Math.floor(clock / 150) % 2 ? C.fg : C.muted; }
                ctx.drawImage(image(CAT, colour), px(p.x) - 5, py(p.y) - 5);
            });
            if (mode !== 'dying' || Math.floor(S.timer / 120) % 2) {
                var m = at(mouse);
                ctx.save();
                ctx.translate(px(m.x), py(m.y));
                ctx.rotate(mouse.face.a);
                ctx.drawImage(image(MOUSE[mouse.dir ? Math.floor(clock / 120) % 2 : 0], C.fg), -4, -5);
                ctx.restore();
            }
            if (toast) { text(toast.text, px(toast.x), py(toast.y) - 12, C.warn, 1, 'center'); }
            for (var l = 0; l < Math.min(S.lives - 1, 5); l++) { ctx.drawImage(image(MOUSE[0], C.fg), 4 + l * 13, H - FOOT + 2); }
            text('LEVEL ' + S.level, W - 4, H - FOOT + 4, C.muted, 1, 'right');
            if (mode === 'paused') { banner('PAUSED', C.fg); }
            else if (mode === 'over') { banner('GAME OVER', C.danger, 'ENTER OR NEW GAME TO PLAY AGAIN'); }
            else if (mode === 'cleared') { banner('PANTRY EMPTIED', C.fg); }
        }

        shell = window.splash.shell(root, opts, {
            game: 'pantry', title: 'Pantry Raid', width: W, height: H, help: HELP,
            pad: ['left', 'up', 'down', 'right'], extraLifeEvery: 5000,
            newGame: startWave, newWave: startWave, respawn: place,
            update: update, draw: draw,
            press: function (name) { if (DIR[name]) { want = DIR[name]; } },
            after: function (dt) { if (toast) { toast.t -= dt; if (toast.t <= 0) { toast = null; } } },
            busy: function () { return !!toast; },
            recolour: function () { if (S) { C = S.colours; } mazeImg = null; }
        });
        S = shell.state; ctx = S.ctx; C = S.colours;
        shell.draw();
        return shell.instance;
    }

    window.pudlApplets.register('pantry', { init: init });
})();
