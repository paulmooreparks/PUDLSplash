/* Copyright 2026 Paul Parks. SPDX-License-Identifier: Apache-2.0 */
/* Pantry Raid, a PUDL applet package (../../README.md). A maze chase: a
   mouse eats every crumb in a pantry while four cats hunt it, and a bell
   sends the cats running for a few seconds. There are three pantries,
   drawn by hand, and the levels go round them in turn. Every one has the
   cats' den in the middle, with the mouse starting under it, a bell in
   each corner, and a passage through the side walls that comes out on
   the other side. The cats leave the den one at a time, hunt and go off
   to their corners by turns, and a cat that is caught slinks back to the
   den. The shell (../shared/splash-shell.js) gives it the canvas, the
   bar, the dialogs, the scores, the sound and the loop; this file is the
   game. */
(function () {
    'use strict';
    /* The shared modules are bundled in front of this file when the
       package is built (applet.json, "bundle"), so window.splash is here. */
    var T = 12, COLS = 19, ROWS = 21, TOP = 12, FOOT = 14;
    var W = COLS * T, H = TOP + ROWS * T + FOOT;
    var DIR = { left: { x: -1, y: 0, a: -Math.PI / 2 }, right: { x: 1, y: 0, a: Math.PI / 2 }, up: { x: 0, y: -1, a: 0 }, down: { x: 0, y: 1, a: Math.PI } };
    var DIRS = [DIR.up, DIR.left, DIR.down, DIR.right];
    /* The same in every pantry: where the mouse starts, the tile outside
       the den's door, the door, the three tiles of the den with its
       middle first, the corners the cats go off to, and the bells. */
    var START = { x: 9, y: 12 }, EXIT = { x: 9, y: 8 }, DOOR = { x: 9, y: 9 };
    var DEN = [{ x: 9, y: 10 }, { x: 8, y: 10 }, { x: 10, y: 10 }];
    var CORNERS = [{ x: 17, y: 1 }, { x: 1, y: 1 }, { x: 17, y: 19 }, { x: 1, y: 19 }];
    var BELLS = [{ x: 1, y: 3 }, { x: 17, y: 3 }, { x: 1, y: 17 }, { x: 17, y: 17 }];
    /* The cats hunt for CHASE milliseconds, then go to their corners for
       SCATTER, and so on, starting with the corners. */
    var SCATTER = 5000, CHASE = 18000;
    /* The pantries: the left half of each and its middle column. The
       right half is the left one mirrored. A # is wall, a dot is floor
       with a crumb, a space is floor of the passage through the side
       walls, where there are no crumbs and the cats are slow, a c is the
       den and a - is its door, which only the cats pass.
       ../../tools/test-pantry-maze.js checks that each is walled all
       round but for the passage, has no dead end, and has floor under
       the mouse, the bells and the cats' corners. */
    var PANTRIES = [[
        '##########',
        '#.........',
        '#.##.###.#',
        '#.##.###.#',
        '#.........',
        '#.##.#.###',
        '#....#....',
        '####.####.',
        '####......',
        '####.#.##-',
        '    ...#cc',
        '####.#.###',
        '####......',
        '####.####.',
        '#....#....',
        '#.##.#.###',
        '#.........',
        '#.##.###.#',
        '#.##.###.#',
        '#.........',
        '##########'
    ], [
        '##########',
        '#.........',
        '#.#.####.#',
        '#.#......#',
        '#.#.##.#.#',
        '#...##.#..',
        '#.#....###',
        '#.####.#..',
        '#.........',
        '####.#.##-',
        '    ...#cc',
        '####.#.###',
        '#.........',
        '#.##.##.##',
        '#.##.##...',
        '#....##.##',
        '#.##....##',
        '#.##.##.##',
        '#.##.##.##',
        '#.........',
        '##########'
    ], [
        '##########',
        '#.........',
        '#.##.###.#',
        '#.##.###.#',
        '#....#....',
        '##.#.#.###',
        '#..#......',
        '#.##.###.#',
        '#.........',
        '####.#.##-',
        '    ...#cc',
        '####.#.###',
        '#.........',
        '#.#.####.#',
        '#.........',
        '#.##.#.###',
        '#.##.#....',
        '#....####.',
        '#.##.####.',
        '#.........',
        '##########'
    ]];

    function sprite(id, rows) { return { id: id, w: rows[0].length, h: rows.length, rows: rows }; }
    /* The mouse from above, nose up; it is turned to face the way it runs. */
    var MOUSE = [
        sprite('pm1', ['....X....', '...XXX...', '.X.XXX.X.', 'XXXXXXXXX', 'XX.XXX.XX', '.XXXXXXX.', '.XXXXXXX.', '.XXXXXXX.', '..XXXXX..', '....X....', '...X.....']),
        sprite('pm2', ['....X....', '...XXX...', '.X.XXX.X.', 'XXXXXXXXX', 'XX.XXX.XX', '.XXXXXXX.', '.XXXXXXX.', '.XXXXXXX.', '..XXXXX..', '....X....', '.....X...'])
    ];
    var CAT = sprite('pc', ['X.........X', 'XX.......XX', 'XXX.....XXX', 'XXXXXXXXXXX', 'XXXXXXXXXXX', 'XX..XXX..XX', 'XX..XXX..XX', 'XXXXX.XXXXX', 'XXXXXXXXXXX', '.XXXXXXXXX.']);
    /* A caught cat on its way back to the den: only its eyes. */
    var EYES = sprite('pe', ['XX...XX', 'XX...XX']);
    var BELL = sprite('pb', ['...X...', '..XXX..', '.XXXXX.', '.XXXXX.', '.XXXXX.', 'XXXXXXX', '...X...']);
    var CHEESE = sprite('pz', ['......XXX', '....XXXXX', '..XXXXXXX', 'XXXXXXXXX', 'X.XXX.XXX', 'XXXXXXX.X', 'XXXXXXXXX']);
    var HELP =
        '<p>Eat every crumb in the pantry and keep away from the four cats. They come out of their den in the middle one at a time and hunt you, each in its own way, and every so often they give up for a few seconds and go off to their own corners. Ring one of the bells in the corners and the cats run from you for a few seconds; catch one while it runs and it slinks back to the den.</p>' +
        '<p>The passage through the side walls comes out on the other side, and the cats are slow in it. A piece of cheese appears under the den once half the crumbs are gone. There are three pantries, which take turns, and the cats get faster every level. You have three mice, and another every 5,000 points.</p>' +
        '<dl class="splash-keys">' +
          '<dt>Arrows or W A S D</dt><dd>Turn; the mouse keeps running until a wall stops it</dd>' +
          '<dt>P or Esc</dt><dd>Pause and resume</dd>' +
          '<dt>Enter</dt><dd>Start a game</dd>' +
        '</dl>' +
        '<p>On a touch screen, the buttons under the game do the same. The game pauses when it loses the keyboard.</p>';

    /* A column, brought back onto the board from past either side, for
       the passage through the side walls. */
    function wrap(x) { return (x + COLS) % COLS; }
    /* A level's maze, as COLS by ROWS tiles. open is the floor the mouse
       runs on (1) or not (0), crumbs the floor that starts with a crumb,
       den the den (2) and its door (1), and slow the floor where the cats
       are slow. The levels go round the pantries in turn. */
    function makeMaze(level) {
        var rows = PANTRIES[(level - 1) % PANTRIES.length], n = COLS * ROWS, mid = (COLS - 1) / 2;
        var open = new Uint8Array(n), crumbs = new Uint8Array(n), den = new Uint8Array(n), slow = new Uint8Array(n);
        for (var y = 0; y < ROWS; y++) {
            for (var x = 0; x <= mid; x++) {
                var ch = rows[y].charAt(x), tiles = [y * COLS + x, y * COLS + (COLS - 1 - x)];
                for (var k = 0; k < 2; k++) {
                    var i = tiles[k];
                    if (ch === '.') { open[i] = 1; crumbs[i] = 1; }
                    else if (ch === ' ') { open[i] = 1; slow[i] = 1; }
                    else if (ch === 'c') { den[i] = 2; }
                    else if (ch === '-') { den[i] = 1; }
                }
            }
        }
        function inside(y) { return y >= 0 && y < ROWS; }
        return {
            open: open, crumbs: crumbs, den: den, slow: slow,
            isOpen: function (x, y) { return inside(y) && open[y * COLS + wrap(x)] === 1; },
            inDen: function (x, y) { return inside(y) && den[y * COLS + wrap(x)] > 0; },
            isSlow: function (x, y) { return inside(y) && slow[y * COLS + wrap(x)] === 1; }
        };
    }
    /* How many tiles each tile is from the middle of the den, by the
       floor, the door and the den: the way home for a caught cat. */
    function homeward(maze) {
        var far = new Int16Array(COLS * ROWS).fill(9999), queue = [DEN[0]];
        far[DEN[0].y * COLS + DEN[0].x] = 0;
        for (var n = 0; n < queue.length; n++) {
            var t = queue[n], d = far[t.y * COLS + t.x];
            for (var k = 0; k < DIRS.length; k++) {
                var x = wrap(t.x + DIRS[k].x), y = t.y + DIRS[k].y;
                if ((maze.isOpen(x, y) || maze.inDen(x, y)) && far[y * COLS + x] > d + 1) { far[y * COLS + x] = d + 1; queue.push({ x: x, y: y }); }
            }
        }
        return far;
    }
    /* For the checks that need no browser (../../tools/test-pantry-maze.js). */
    window.splash.pantry = {
        maze: makeMaze, homeward: homeward, pantries: PANTRIES.length, cols: COLS, rows: ROWS,
        start: START, exit: EXIT, door: DOOR, den: DEN, corners: CORNERS, bells: BELLS
    };

    function init(root, opts) {
        var shell = null, S = null, ctx = null, C = null;
        var maze = makeMaze(1), home = homeward(maze), mazeImg = null, crumbs = new Uint8Array(COLS * ROWS), left = 0, total = 0;
        var bells = [], cheese = null, cheeseDone = false, toast = null;
        var mouse = { x: START.x, y: START.y, p: 0, dir: null, face: DIR.up }, want = null, cats = [];
        var phase = 0, scatter = true, combo = 0, clock = 0, munch = 0;

        /* The first cat stands outside the door and the others wait in
           the den, each a while longer than the one before. A cat is in
           the den, leaving it, hunting, or going home. */
        function place() {
            mouse = { x: START.x, y: START.y, p: 0, dir: null, face: DIR.up };
            want = null; phase = 0; scatter = true; combo = 0;
            cats = CORNERS.map(function (corner, i) {
                var at = i === 0 ? EXIT : DEN[i - 1];
                var c = { kind: i, corner: corner, x: at.x, y: at.y, p: 0, dir: null, mode: 'den', wait: i === 0 ? 800 : 500 + i * 3500, scared: 0 };
                c.can = function (x, y) { return maze.isOpen(x, y) || ((c.mode === 'leave' || c.mode === 'home') && maze.inDen(x, y)); };
                return c;
            });
        }
        function startWave(level) {
            maze = makeMaze(level); home = homeward(maze); mazeImg = null;
            crumbs = new Uint8Array(maze.crumbs);
            crumbs[START.y * COLS + START.x] = 0;
            BELLS.forEach(function (t) { crumbs[t.y * COLS + t.x] = 0; });
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
           tile it reaches; can says which tiles it may run on. */
        function advance(e, dist, choose, arrive, can) {
            for (var guard = 0; dist > 0 && guard < 8; guard++) {
                if (!e.dir || !can(e.x + e.dir.x, e.y + e.dir.y)) { e.dir = choose(e); if (!e.dir) { return; } }
                var room = 1 - e.p;
                if (dist < room) { e.p += dist; return; }
                dist -= room;
                e.x = wrap(e.x + e.dir.x); e.y += e.dir.y; e.p = 0;
                if (arrive) { arrive(e); }
                e.dir = choose(e);
            }
        }
        function opposite(d) { return d === DIR.left ? DIR.right : d === DIR.right ? DIR.left : d === DIR.up ? DIR.down : DIR.up; }
        function reverse(e) {
            if (!e.dir) { return; }
            if (e.p > 0) { e.x = wrap(e.x + e.dir.x); e.y += e.dir.y; e.p = 1 - e.p; }
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
            cats.forEach(function (c) { if (c.mode === 'hunt') { c.scared = time; reverse(c); } });
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
            if (c.mode === 'den') { return null; }
            /* Out of the den: to its middle, then up through the door. */
            if (c.mode === 'leave') { return c.x < EXIT.x ? DIR.right : c.x > EXIT.x ? DIR.left : DIR.up; }
            /* Home: always to the tile that is nearer the den. */
            if (c.mode === 'home') {
                var back = null, near = home[c.y * COLS + c.x];
                DIRS.forEach(function (d) {
                    var x = wrap(c.x + d.x), y = c.y + d.y;
                    if (c.can(x, y) && home[y * COLS + x] < near) { near = home[y * COLS + x]; back = d; }
                });
                return back;
            }
            var ways = DIRS.filter(function (d) { return maze.isOpen(c.x + d.x, c.y + d.y) && !(c.dir && d === opposite(c.dir)); });
            if (!ways.length) { ways = DIRS.filter(function (d) { return maze.isOpen(c.x + d.x, c.y + d.y); }); }
            if (!ways.length) { return null; }
            var close = (mouse.x - c.x) * (mouse.x - c.x) + (mouse.y - c.y) * (mouse.y - c.y) < 36;
            if (c.scared > 0 || (!scatter && c.kind === 2 && !close)) { return ways[Math.floor(Math.random() * ways.length)]; }
            var t = scatter ? c.corner : target(c), best = ways[0], least = 1e9;
            ways.forEach(function (d) {
                var dx = c.x + d.x - t.x, dy = c.y + d.y - t.y, far = dx * dx + dy * dy;
                if (far < least) { least = far; best = d; }
            });
            return best;
        }
        function arriveCat(c) {
            if (c.mode === 'leave' && c.x === EXIT.x && c.y === EXIT.y) { c.mode = 'hunt'; }
            else if (c.mode === 'home' && c.x === DEN[0].x && c.y === DEN[0].y) { c.mode = 'den'; c.wait = 2500; c.dir = null; }
        }

        function update(dt) {
            clock += dt; phase += dt;
            /* The cats turn round when they change between hunting and
               going to their corners, which is the mouse's warning. */
            var now = phase % (SCATTER + CHASE) < SCATTER;
            if (now !== scatter) { scatter = now; cats.forEach(function (c) { if (c.mode === 'hunt' && c.scared <= 0) { reverse(c); } }); }
            if (want && mouse.dir && want === opposite(mouse.dir)) { reverse(mouse); }
            else if (mouse.p === 0 && mouse.dir) { mouse.dir = chooseMouse(mouse); }
            advance(mouse, 6.2 * dt / 1000, chooseMouse, arrive, maze.isOpen);
            if (mouse.dir) { mouse.face = mouse.dir; }
            if (left <= 0) { shell.beep(660, 500, 'triangle', 0.06, 1320); shell.cleared(1500); return; }

            var speed = Math.min(6, 4.6 + (S.level - 1) * 0.2), caught = false, m = at(mouse);
            cats.forEach(function (c) {
                if (c.mode === 'den') {
                    c.wait -= dt;
                    if (c.wait <= 0) { c.mode = c.x === EXIT.x && c.y === EXIT.y ? 'hunt' : 'leave'; }
                    return;
                }
                c.scared = c.mode === 'hunt' ? Math.max(0, c.scared - dt) : 0;
                var v = c.mode === 'home' ? 11 : c.mode === 'leave' || c.scared > 0 ? 3 : maze.isSlow(c.x, c.y) ? speed * 0.55 : speed;
                advance(c, v * dt / 1000, chooseCat, arriveCat, c.can);
                if (c.mode !== 'hunt') { return; }
                var p = at(c), dx = p.x - m.x, dy = p.y - m.y;
                if (dx * dx + dy * dy > 0.4) { return; }
                if (c.scared > 0) {
                    combo++;
                    shell.addScore(150 * combo);
                    toast = { text: String(150 * combo), x: p.x, y: p.y, t: 900 };
                    c.mode = 'home'; c.scared = 0;
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
            /* The walls are shelves. A wall tile is drawn as its middle,
               an arm to each side where the next tile is wall too, and a
               corner where the two tiles beside the corner and the one
               across it are all wall. So a wall one tile thick is a bar
               with a margin of floor, and a block of wall is solid. */
            var M = 3, MID = T - 2 * M;
            function wall(x, y) { return x >= 0 && y >= 0 && x < COLS && y < ROWS && !maze.open[y * COLS + x] && !maze.den[y * COLS + x]; }
            for (var y = 0; y < ROWS; y++) {
                for (var x = 0; x < COLS; x++) {
                    if (!wall(x, y)) { continue; }
                    for (var j = -1; j <= 1; j++) {
                        for (var i = -1; i <= 1; i++) {
                            if (!wall(x + i, y) || !wall(x, y + j) || !wall(x + i, y + j)) { continue; }
                            g.fillRect(x * T + (i < 0 ? 0 : i > 0 ? T - M : M), y * T + (j < 0 ? 0 : j > 0 ? T - M : M), i ? M : MID, j ? M : MID);
                        }
                    }
                }
            }
            /* The den's door, a thin bar between the ends of its wall. */
            g.fillStyle = C.warn;
            g.fillRect(DOOR.x * T - M, DOOR.y * T + T / 2 - 1, T + 2 * M, 2);
            mazeImg = c;
        }
        function px(x) { return Math.round(x * T + T / 2); }
        function py(y) { return Math.round(TOP + y * T + T / 2); }
        /* Draws something at a place across the board, and again at the
           other side when it is in the passage through the side walls. */
        function across(x, fn) {
            fn(px(x));
            if (x < 0.5) { fn(px(x + COLS)); }
            if (x > COLS - 1.5) { fn(px(x - COLS)); }
        }
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
                if (c.mode === 'home') { across(p.x, function (sx) { ctx.drawImage(image(EYES, C.fg), sx - 3, py(p.y) - 1); }); return; }
                if (c.scared > 0) { colour = c.scared < 1500 && Math.floor(clock / 150) % 2 ? C.fg : C.muted; }
                across(p.x, function (sx) { ctx.drawImage(image(CAT, colour), sx - 5, py(p.y) - 5); });
            });
            if (mode !== 'dying' || Math.floor(S.timer / 120) % 2) {
                var m = at(mouse);
                across(m.x, function (sx) {
                    ctx.save();
                    ctx.translate(sx, py(m.y));
                    ctx.rotate(mouse.face.a);
                    ctx.drawImage(image(MOUSE[mouse.dir ? Math.floor(clock / 120) % 2 : 0], C.fg), -4, -5);
                    ctx.restore();
                });
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
        current = function () { return { maze: maze, mouse: mouse, cats: cats, bells: bells, crumbs: crumbs, scatter: scatter, left: left }; };
        shell.draw();
        return shell.instance;
    }
    /* The game most lately started, as it stands, for the checks that
       need no browser (../../tools/test-pantry-play.js). */
    var current = null;
    window.splash.pantry.game = function () { return current ? current() : null; };

    window.pudlApplets.register('pantry', { init: init });
})();
