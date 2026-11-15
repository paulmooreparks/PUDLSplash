/* Copyright 2026 Paul Parks. SPDX-License-Identifier: Apache-2.0 */
/* Stingers, a PUDL applet package (../../README.md). A formation shooter:
   a nest of wasps flies in by squads and settles into ranks above the
   ship, then they peel off one at a time and dive at it, shooting as they
   come. A wasp shot in its dive is worth double, a queen takes two hits,
   and the honey a queen drops gives the ship rapid fire for a while. The
   shell (../shared/splash-shell.js) gives it the canvas, the bar, the
   dialogs, the scores, the sound and the loop; this file is the game. */
(function () {
    'use strict';
    /* The shared modules are bundled in front of this file when the
       package is built (applet.json, "bundle"), so window.splash is here. */
    var W = 224, H = 256, PLAYER_Y = 228, MID = W / 2;
    /* A wasp turns in a circle of this many pixels, flying in and diving,
       at any speed: the paths are drawn for these circles, so a faster
       wave flies the same curves sooner instead of missing its points.
       A point of a path is given up after GIVE_UP milliseconds. */
    var FLY_R = 27, DIVE_R = 30, GIVE_UP = 3000;

    function sprite(id, rows) { return { id: id, w: rows[0].length, h: rows.length, rows: rows }; }
    var DRONE = { points: 10, hp: 1, colour: 'fg', frames: [
        sprite('wd1', ['X..XXX..X', 'XX.XXX.XX', 'XXXXXXXXX', '.XXXXXXX.', '...XXX...', '..XX.XX..', '..XXXXX..', '...X.X...']),
        sprite('wd2', ['...XXX...', '...XXX...', 'XXXXXXXXX', 'XXXXXXXXX', 'XX.XXX.XX', 'X.XX.XX.X', '..XXXXX..', '...X.X...'])
    ] };
    var SOLDIER = { points: 20, hp: 1, colour: 'positive', frames: [
        sprite('ws1', ['X...XXX...X', 'XX.XXXXX.XX', 'XXXX.X.XXXX', '.XXXXXXXXX.', '..XXXXXXX..', '...XX.XX...', '..XX...XX..', '..X.....X..']),
        sprite('ws2', ['....XXX....', '...XXXXX...', 'XXXX.X.XXXX', 'XXXXXXXXXXX', 'XXXXXXXXXXX', 'X..XX.XX..X', '..XX...XX..', '...X...X...'])
    ] };
    var QUEEN = { points: 50, hp: 2, colour: 'warn', frames: [
        sprite('wq1', ['..X.......X..', '...X.XXX.X...', 'XX.XXXXXXX.XX', 'XXXXXX.XXXXXX', 'XXXXXXXXXXXXX', '.XXXXXXXXXXX.', '...XXXXXXX...', '..XXX.X.XXX..', '..XX.XXX.XX..', '...X.....X...']),
        sprite('wq2', ['...X.....X...', '...X.XXX.X...', '...XXXXXXX...', 'XXXXXX.XXXXXX', 'XXXXXXXXXXXXX', 'XXXXXXXXXXXXX', 'XX.XXXXXXX.XX', '..XXX.X.XXX..', '..XX.XXX.XX..', '..X.......X..'])
    ] };
    var SHIP = sprite('wp', ['......X......', '......X......', '.....XXX.....', '.....XXX.....', 'X...XXXXX...X', 'X..XXXXXXX..X', 'XXXXXXXXXXXXX', 'XXX.XXXXX.XXX', 'X....X.X....X']);
    var SHIP_BOOM = [
        sprite('wx1', ['..X.....X....', '......X....X.', '.X..X.....X..', '....XX.X.....', 'X..XXXXX..X..', '..XXXXXXXX...', '.XXXXXXXXXXX.', 'XXX.XXXXX.XXX', 'X....X.X....X']),
        sprite('wx2', ['....X.....X..', '.X.....X.....', '...X.....X..X', 'X.....XX.....', '..X..XXXX..X.', '...XXXXXXX...', '.XXXXXXXXXX..', 'XXX.XXXXX.XXX', 'X....X.X....X'])
    ];
    var BOOM = sprite('wb', ['X...X...X', '.X..X..X.', '..X...X..', '.........', 'XX.....XX', '.........', '..X...X..', '.X..X..X.', 'X...X...X']);
    var HONEY = sprite('wh', ['..X..', '..X..', '.XXX.', 'XXXXX', 'XXXXX', '.XXX.']);
    var RANKS = [{ type: QUEEN, n: 3 }, { type: SOLDIER, n: 6 }, { type: SOLDIER, n: 8 }, { type: DRONE, n: 9 }, { type: DRONE, n: 10 }];
    var HELP =
        '<p>Shoot the whole nest. The wasps fly in by squads and settle into ranks, then dive at you one at a time, shooting as they come. A wasp hit in its dive is worth double. A queen takes two hits and drops honey: catch it for rapid fire. Each wave dives more often and faster. You have three ships, and another every 4,000 points.</p>' +
        '<dl class="splash-keys">' +
          '<dt>← → or A D</dt><dd>Move</dd>' +
          '<dt>Space or X</dt><dd>Fire, two shots at a time; hold it down with rapid fire</dd>' +
          '<dt>P or Esc</dt><dd>Pause and resume</dd>' +
          '<dt>Enter</dt><dd>Start a game</dd>' +
        '</dl>' +
        '<p>On a touch screen, the buttons under the game do the same. The game pauses when it loses the keyboard.</p>';

    /* Flying is turning towards a point no faster than a turn rate
       allows, at a steady speed, which is what makes the curves. */
    function steer(e, tx, ty, speed, turn, dt) {
        var diff = Math.atan2(ty - e.y, tx - e.x) - e.ang;
        while (diff > Math.PI) { diff -= 2 * Math.PI; }
        while (diff < -Math.PI) { diff += 2 * Math.PI; }
        var most = turn * dt / 1000;
        e.ang += Math.max(-most, Math.min(most, diff));
        e.x += Math.cos(e.ang) * speed * dt / 1000;
        e.y += Math.sin(e.ang) * speed * dt / 1000;
    }
    /* Flies e towards the next point of its path and says when the path
       is done. A point is given up after a while, so that a wasp that
       cannot turn tightly enough to reach one does not circle it. */
    function follow(e, speed, turn, dt) {
        var p = e.path[e.wp];
        steer(e, p.x, p.y, speed, turn, dt);
        e.wpT += dt;
        var dx = p.x - e.x, dy = p.y - e.y;
        if (dx * dx + dy * dy < 256 || e.wpT > GIVE_UP) { e.wp++; e.wpT = 0; }
        return e.wp >= e.path.length;
    }
    function diveSpeed(level) { return Math.min(190, 125 + level * 5); }
    /* The path of a dive from a place in the ranks, by a wasp that starts
       out flying up the screen. The first point is a quarter of a turn
       away, so the wasp passes through it. The wasp turns away from the
       ship and loops round to come down across the screen; where that
       loop would cross the side of the screen, it turns towards the ship
       instead. The second point is just above where the ship was. The
       wasp then flies on the way it was going and off the bottom, or
       hooks back where flying on would cross the side. */
    function divePath(x, y, aim) {
        var s = aim < x ? -1 : 1, k = -s, out = aim + s * 34;
        if (x + k * 2 * DIVE_R < 8 || x + k * 2 * DIVE_R > W - 8) { k = s; }
        if (out < 16 || out > W - 16) { out = aim - s * 34; }
        return [{ x: x + k * DIVE_R, y: y - DIVE_R }, { x: aim, y: PLAYER_Y - 36 }, { x: out, y: H + 20 }];
    }
    /* For the checks that need no browser (../../tools/test-stingers-dive.js). */
    window.splash.stingers = {
        width: W, height: H, shipY: PLAYER_Y, turn: DIVE_R, flyTurn: FLY_R, giveUp: GIVE_UP, follow: follow, diveSpeed: diveSpeed, divePath: divePath,
        rows: RANKS.map(function (rank, r) { return 34 + r * 15; })
    };

    function init(root, opts) {
        var shell = null, S = null, ctx = null, C = null;
        var enemies = [], shots = [], bullets = [], booms = [], stars = [], honey = null, toast = null;
        var player = { x: MID - 6 }, clock = 0, diveTimer = 0, rapid = 0, cool = 0;

        for (var i = 0; i < 28; i++) { stars.push({ x: Math.floor(Math.random() * W), y: Math.random() * H, v: 8 + Math.random() * 22 }); }

        function startWave() {
            enemies = [];
            RANKS.forEach(function (rank, r) {
                for (var n = 0; n < rank.n; n++) {
                    enemies.push({ type: rank.type, sx: MID + (n - (rank.n - 1) / 2) * 18, sy: 34 + r * 15, x: 0, y: -20, ang: 0,
                        state: 'wait', delay: 0, path: null, wp: 0, wpT: 0, hp: rank.type.hp, alive: true, shots: 0, fireT: 0 });
                }
            });
            /* Squads of six, a moment apart, from the top and from the
               sides by turns, and from the left and the right by pairs. */
            enemies.forEach(function (e, n) {
                var squad = Math.floor(n / 6);
                e.delay = 600 + squad * 1700 + (n % 6) * 150;
                e.side = squad % 4 < 2 ? 1 : -1;
                e.top = squad % 2 === 0;
            });
            shots = []; bullets = []; booms = []; honey = null; toast = null;
            player.x = MID - 6; diveTimer = 1500; rapid = 0; cool = 0;
        }
        function respawn() {
            player.x = MID - 6; shots = []; bullets = []; honey = null; rapid = 0;
            enemies.forEach(function (e) { if (e.alive && e.state === 'dive') { home(e); } });
        }

        /* Where an enemy's place in the ranks is now: the ranks sway from
           side to side and breathe in and out. */
        function slot(e) {
            return { x: MID + (e.sx - MID) * (1 + 0.05 * Math.sin(clock / 770)) + 10 * Math.sin(clock / 1430), y: e.sy };
        }
        /* A wasp that has left the screen comes back in at the top, above
           its own place in the ranks, and drops into it. */
        function home(e) { e.x = slot(e).x; e.y = -12; e.state = 'return'; }
        function enter(e) {
            var s = e.side;
            if (e.top) {
                e.x = MID - s * 30; e.y = -10; e.ang = Math.PI / 2;
                e.path = [{ x: MID + s * 70, y: 110 }, { x: MID + s * 40, y: 170 }, { x: MID - s * 30, y: 150 }];
            } else {
                e.x = MID - s * (MID + 12); e.y = 190; e.ang = s > 0 ? 0 : Math.PI;
                e.path = [{ x: MID - s * 20, y: 170 }, { x: MID + s * 50, y: 130 }, { x: MID, y: 100 }];
            }
            e.state = 'enter'; e.wp = 0; e.wpT = 0;
        }
        function launch(e) {
            e.state = 'dive'; e.ang = -Math.PI / 2; e.wp = 0; e.wpT = 0;
            e.path = divePath(e.x, e.y, Math.max(20, Math.min(W - 20, player.x + 6)));
            e.shots = Math.min(3, 1 + Math.floor(S.level / 3)); e.fireT = 500;
            shell.beep(900, 350, 'sawtooth', 0.03, 300);
        }
        function shoot(e) {
            var dx = player.x + 6 - e.x, dy = PLAYER_Y - e.y, speed = Math.min(150, 95 + S.level * 5);
            dx = Math.max(-dy / 2, Math.min(dy / 2, dx));
            var len = Math.sqrt(dx * dx + dy * dy);
            bullets.push({ x: e.x, y: e.y + 4, vx: dx / len * speed, vy: dy / len * speed });
        }
        function box(e) { var f = e.type.frames[0]; return { x: e.x - f.w / 2, y: e.y - f.h / 2, w: f.w, h: f.h }; }
        function hit(a, b) { return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y; }
        function fire() {
            if (S.mode !== 'playing' || shots.length >= (rapid > 0 ? 4 : 2)) { return; }
            shots.push({ x: Math.round(player.x + 6), y: PLAYER_Y - 5 });
            cool = 140;
            shell.beep(1040, 70, 'square', 0.03, 520);
        }
        function strike(e) {
            e.hp--;
            if (e.hp > 0) { shell.beep(420, 80, 'square', 0.04); return; }
            e.alive = false;
            var formed = e.state === 'form', points = e.type.points * (formed ? 1 : 2);
            shell.addScore(points);
            booms.push({ x: e.x - 4, y: e.y - 4, t: 250 });
            if (!formed) { toast = { text: String(points), x: e.x, y: e.y - 14, t: 700 }; }
            if (e.type === QUEEN && !honey && rapid <= 0) { honey = { x: e.x, y: e.y }; }
            shell.beep(240, 130, 'square', 0.05, 70);
        }
        function die() {
            bullets = []; shots = [];
            shell.die(1300);
            shell.beep(180, 500, 'sawtooth', 0.06, 40);
        }

        function update(dt, held) {
            clock += dt;
            var move = 110 * dt / 1000;
            if (held.left) { player.x = Math.max(6, player.x - move); }
            if (held.right) { player.x = Math.min(W - 6 - SHIP.w, player.x + move); }
            stars.forEach(function (s) { s.y += s.v * dt / 1000; if (s.y > H) { s.y = 0; s.x = Math.floor(Math.random() * W); } });
            cool -= dt;
            if (rapid > 0) {
                rapid -= dt;
                if (held.fire && cool <= 0) { fire(); }
                if (rapid <= 0) { shell.say('Wave ' + S.level); }
            }

            shots = shots.filter(function (s) {
                s.y -= 330 * dt / 1000;
                if (s.y < 14) { return false; }
                var r = { x: s.x, y: s.y, w: 1, h: 5 };
                for (var n = 0; n < enemies.length; n++) {
                    var e = enemies[n];
                    if (e.alive && e.state !== 'wait' && hit(r, box(e))) { strike(e); return false; }
                }
                return true;
            });
            var live = enemies.filter(function (e) { return e.alive; });
            if (!live.length) { shell.cleared(1500); return; }

            var fly = Math.min(170, 120 + S.level * 4), dive = diveSpeed(S.level);
            var settled = true, diving = 0, killed = false, ship = { x: player.x, y: PLAYER_Y, w: SHIP.w, h: SHIP.h };
            live.forEach(function (e) {
                var p;
                if (e.state === 'wait') { settled = false; e.delay -= dt; if (e.delay <= 0) { enter(e); } return; }
                if (e.state === 'enter') { settled = false; if (follow(e, fly, fly / FLY_R, dt)) { e.state = 'settle'; } return; }
                if (e.state === 'settle' || e.state === 'return') {
                    if (e.state === 'settle') { settled = false; }
                    p = slot(e);
                    var dx = p.x - e.x, dy = p.y - e.y, far = Math.sqrt(dx * dx + dy * dy), step = 140 * dt / 1000;
                    if (far <= step) { e.x = p.x; e.y = p.y; e.state = 'form'; }
                    else { e.x += dx / far * step; e.y += dy / far * step; }
                    return;
                }
                if (e.state === 'form') { p = slot(e); e.x = p.x; e.y = p.y; return; }
                diving++;
                e.fireT -= dt;
                if (e.shots > 0 && e.fireT <= 0 && e.wp >= 1 && e.y > 50 && e.y < PLAYER_Y - 60) { shoot(e); e.shots--; e.fireT = 450; }
                if (follow(e, dive, dive / DIVE_R, dt) || e.y > H + 10) { home(e); }
                else if (hit(box(e), ship)) { killed = true; }
            });

            if (settled) {
                diveTimer -= dt;
                var formed = live.filter(function (e) { return e.state === 'form'; });
                if (diveTimer <= 0 && formed.length && diving < Math.min(5, 2 + Math.floor(S.level / 3))) {
                    diveTimer = live.length <= 4 ? 500 : Math.max(700, 2300 - S.level * 130);
                    launch(formed[Math.floor(Math.random() * formed.length)]);
                }
            }

            bullets = bullets.filter(function (b) {
                b.x += b.vx * dt / 1000; b.y += b.vy * dt / 1000;
                if (hit({ x: b.x - 1, y: b.y, w: 2, h: 4 }, ship)) { killed = true; return false; }
                return b.y < H;
            });
            if (honey) {
                honey.y += 60 * dt / 1000;
                if (hit({ x: honey.x - 2, y: honey.y, w: 5, h: 6 }, ship)) {
                    honey = null; rapid = 8000;
                    shell.say('Rapid fire');
                    shell.beep(600, 250, 'triangle', 0.06, 1500);
                } else if (honey.y > H) { honey = null; }
            }
            if (killed) { die(); }
        }

        function pad(n) { return ('00000' + n).slice(-5); }
        function draw() {
            var text = shell.text, image = shell.image, mode = S.mode, frame = Math.floor(clock / 400) % 2;
            ctx.fillStyle = C.muted;
            stars.forEach(function (s) { ctx.fillRect(s.x, Math.round(s.y), 1, 1); });
            text('SCORE ' + pad(S.score), 8, 5, C.fg);
            text('HI ' + pad(S.hi), MID, 5, C.muted, 1, 'center');
            for (var l = 0; l < Math.min(S.lives - 1, 4); l++) { ctx.drawImage(image(SHIP, C.accent), W - 8 - (l + 1) * 16, 3); }
            if (mode === 'ready') {
                text('STINGERS', MID, 52, C.fg, 2, 'center');
                text('ENTER OR NEW GAME TO PLAY', MID, 76, C.muted, 1, 'center');
                ctx.drawImage(image(QUEEN.frames[0], C.warn), 62, 99); text('= 50, TWO HITS', 84, 100, C.muted);
                ctx.drawImage(image(SOLDIER.frames[0], C.positive), 63, 116); text('= 20 POINTS', 84, 116, C.muted);
                ctx.drawImage(image(DRONE.frames[0], C.fg), 64, 132); text('= 10 POINTS', 84, 132, C.muted);
                ctx.drawImage(image(HONEY, C.warn), 66, 149); text('= RAPID FIRE', 84, 148, C.muted);
                text('DOUBLE FOR A WASP IN ITS DIVE', MID, 172, C.muted, 1, 'center');
                return;
            }
            enemies.forEach(function (e) {
                if (!e.alive || e.state === 'wait') { return; }
                var spr = e.type.frames[e.state === 'form' ? frame : Math.floor(clock / 120) % 2];
                var colour = e.type === QUEEN && e.hp < 2 ? C.danger : C[e.type.colour];
                ctx.drawImage(image(spr, colour), Math.round(e.x - spr.w / 2), Math.round(e.y - spr.h / 2));
            });
            booms.forEach(function (b) { ctx.drawImage(image(BOOM, C.fg), Math.round(b.x), Math.round(b.y)); });
            if (toast) { text(toast.text, Math.round(toast.x), Math.round(toast.y), C.warn, 1, 'center'); }
            if (honey) { ctx.drawImage(image(HONEY, C.warn), Math.round(honey.x - 2), Math.round(honey.y)); }
            ctx.fillStyle = rapid > 0 ? C.warn : C.accent;
            shots.forEach(function (s) { ctx.fillRect(s.x, Math.round(s.y), 1, 5); });
            ctx.fillStyle = C.danger;
            bullets.forEach(function (b) { ctx.fillRect(Math.round(b.x) - 1, Math.round(b.y), 2, 4); });
            if (mode === 'dying') { ctx.drawImage(image(SHIP_BOOM[Math.floor(S.timer / 150) % 2], C.danger), Math.round(player.x), PLAYER_Y); }
            else if (mode !== 'over') { ctx.drawImage(image(SHIP, C.accent), Math.round(player.x), PLAYER_Y); }
            if (mode === 'paused') { text('PAUSED', MID, 130, C.fg, 2, 'center'); }
            else if (mode === 'over') {
                text('GAME OVER', MID, 122, C.danger, 2, 'center');
                text('ENTER OR NEW GAME TO PLAY AGAIN', MID, 146, C.muted, 1, 'center');
            } else if (mode === 'cleared') { text('WAVE ' + S.level + ' CLEARED', MID, 130, C.fg, 2, 'center'); }
        }

        shell = window.splash.shell(root, opts, {
            game: 'stingers', title: 'Stingers', width: W, height: H, help: HELP,
            pad: ['left', 'right', { name: 'fire', label: 'Fire' }], extraLifeEvery: 4000,
            newGame: startWave, newWave: startWave, respawn: respawn,
            update: update, draw: draw,
            press: function (name) { if (name === 'fire') { fire(); } },
            after: function (dt) {
                booms = booms.filter(function (b) { b.t -= dt; return b.t > 0; });
                if (toast) { toast.t -= dt; if (toast.t <= 0) { toast = null; } }
            },
            busy: function () { return booms.length > 0 || !!toast; },
            recolour: function () { if (S) { C = S.colours; } }
        });
        S = shell.state; ctx = S.ctx; C = S.colours;
        shell.draw();
        return shell.instance;
    }

    window.pudlApplets.register('stingers', { init: init });
})();
