/* Copyright 2026 Paul Parks. SPDX-License-Identifier: Apache-2.0 */
/* Asteroids, a PUDL applet package (../../README.md). The 1979 game, in
   lines on a screen of 640 by 480: the ship turns, thrusts and drifts,
   wrapping at the edges; the rocks break into halves and then into
   pieces; saucers cross now and then and shoot, the small one aiming. The
   shell (../shared/splash-shell.js), bundled in front of this file when
   the package is built, gives it the canvas, the bar, the dialogs, the
   scores, the sound and the loop; this file is the game. */
(function () {
    'use strict';
    var W = 640, H = 480;
    var TURN = 3.8, THRUST = 240, DRAG = 0.55, TOP_SPEED = 420;
    var SHIP_R = 11, BULLET_SPEED = 500, BULLET_LIFE = 1100, BULLETS = 4;
    var SIZES = { 3: { r: 42, points: 20, speed: [30, 70] }, 2: { r: 22, points: 50, speed: [60, 110] }, 1: { r: 11, points: 100, speed: [90, 160] } };
    var HELP =
        '<p>Break the rocks into pieces and the pieces into dust, while the ship drifts where its thrust took it, and keep clear of the saucers: the big one shoots anywhere, the small one shoots at you. Hyperspace takes you somewhere else, which may be worse. A new ship every 10,000 points.</p>' +
        '<dl class="splash-keys">' +
          '<dt>← → or A D</dt><dd>Turn</dd>' +
          '<dt>↑ or W</dt><dd>Thrust</dd>' +
          '<dt>Space or X</dt><dd>Fire</dd>' +
          '<dt>↓, S, Z or Shift</dt><dd>Hyperspace</dd>' +
          '<dt>P or Esc</dt><dd>Pause and resume</dd>' +
          '<dt>Enter</dt><dd>Start a game</dd>' +
        '</dl>' +
        '<p>On a touch screen, the buttons under the game do the same. The game pauses when it loses the keyboard.</p>';

    function rand(a, b) { return a + Math.random() * (b - a); }
    function wrap(o, margin) {
        margin = margin || 0;
        if (o.x < -margin) { o.x += W + 2 * margin; } else if (o.x > W + margin) { o.x -= W + 2 * margin; }
        if (o.y < -margin) { o.y += H + 2 * margin; } else if (o.y > H + margin) { o.y -= H + 2 * margin; }
    }
    function near(a, b, d) { var dx = a.x - b.x, dy = a.y - b.y; return dx * dx + dy * dy < d * d; }

    function init(root, opts) {
        var shell = null, S = null, ctx = null, C = null;
        var ship = null, bullets = [], rocks = [], saucer = null, saucerShots = [], saucerTimer = 0, saucerBlip = 0;
        var bits = [], hyper = 0, beat = 0, beatTimer = 0, respawnWait = 0, thrustTone = 0;

        /* A rock: a jagged ring of the size's radius, turning as it goes. */
        function rock(size, x, y) {
            var d = SIZES[size], n = 11, shape = [];
            for (var i = 0; i < n; i++) { shape.push({ a: i / n * Math.PI * 2, r: d.r * rand(0.72, 1.18) }); }
            var a = rand(0, Math.PI * 2), v = rand(d.speed[0], d.speed[1]) + Math.min(S.level - 1, 8) * 6;
            return { size: size, r: d.r, x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, rot: 0, spin: rand(-1.2, 1.2), shape: shape };
        }
        function newShip() { return { x: W / 2, y: H / 2, vx: 0, vy: 0, a: -Math.PI / 2, thrusting: false }; }
        function startWave(level) {
            rocks = []; bullets = []; saucer = null; saucerShots = []; bits = []; hyper = 0;
            ship = newShip();
            var count = 4 + Math.min(level - 1, 6);
            for (var i = 0; i < count; i++) {
                var x, y;
                do { x = rand(0, W); y = rand(0, H); } while (near({ x: x, y: y }, ship, 150));
                rocks.push(rock(3, x, y));
            }
            saucerTimer = rand(12000, 20000);
            beat = 0; beatTimer = 0;
        }
        function respawn() { ship = newShip(); hyper = 0; bullets = []; saucerShots = []; respawnWait = 0; }

        function explode(x, y, n, colour, speed) {
            for (var i = 0; i < n; i++) {
                var a = rand(0, Math.PI * 2), v = rand(speed * 0.3, speed);
                bits.push({ x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, a: rand(0, Math.PI * 2), spin: rand(-6, 6), len: rand(3, 9), t: rand(500, 1100), colour: colour });
            }
        }
        function fire() {
            if (S.mode !== 'playing' || !ship || hyper > 0 || bullets.length >= BULLETS) { return; }
            bullets.push({ x: ship.x + Math.cos(ship.a) * SHIP_R, y: ship.y + Math.sin(ship.a) * SHIP_R,
                vx: ship.vx + Math.cos(ship.a) * BULLET_SPEED, vy: ship.vy + Math.sin(ship.a) * BULLET_SPEED, t: BULLET_LIFE });
            shell.beep(1100, 70, 'square', 0.03, 500);
        }
        function hyperspace() {
            if (S.mode !== 'playing' || !ship || hyper > 0) { return; }
            hyper = 900;
            shell.beep(300, 300, 'sawtooth', 0.03, 1800);
        }
        function breakRock(r, index) {
            rocks.splice(index, 1);
            shell.addScore(SIZES[r.size].points);
            explode(r.x, r.y, 6, C.fg, 60);
            shell.beep(r.size === 3 ? 80 : r.size === 2 ? 140 : 220, 180, 'square', 0.05, 30);
            if (r.size > 1) { rocks.push(rock(r.size - 1, r.x, r.y), rock(r.size - 1, r.x, r.y)); }
        }
        function die() {
            explode(ship.x, ship.y, 10, C.danger, 90);
            ship = null;
            shell.die(1800);
            shell.beep(150, 500, 'sawtooth', 0.05, 30);
        }
        function hitsRock(p, pad) {
            for (var i = 0; i < rocks.length; i++) { if (near(p, rocks[i], rocks[i].r * 0.9 + (pad || 0))) { return i; } }
            return -1;
        }

        function update(dt, held) {
            var sec = dt / 1000;
            if (ship) {
                if (hyper > 0) {
                    hyper -= dt;
                    if (hyper <= 0) {
                        hyper = 0;
                        ship.x = rand(40, W - 40); ship.y = rand(40, H - 40); ship.vx = 0; ship.vy = 0;
                        if (Math.random() < 1 / 6) { die(); return; }
                    }
                } else {
                    if (held.left) { ship.a -= TURN * sec; }
                    if (held.right) { ship.a += TURN * sec; }
                    ship.thrusting = !!held.up;
                    if (ship.thrusting) {
                        ship.vx += Math.cos(ship.a) * THRUST * sec;
                        ship.vy += Math.sin(ship.a) * THRUST * sec;
                        var v = Math.hypot(ship.vx, ship.vy);
                        if (v > TOP_SPEED) { ship.vx *= TOP_SPEED / v; ship.vy *= TOP_SPEED / v; }
                        thrustTone -= dt;
                        if (thrustTone <= 0) { thrustTone = 90; shell.beep(55, 100, 'sawtooth', 0.02); }
                    }
                    var drag = Math.pow(DRAG, sec);
                    ship.vx *= drag; ship.vy *= drag;
                    ship.x += ship.vx * sec; ship.y += ship.vy * sec;
                    wrap(ship, SHIP_R);
                    if (hitsRock(ship, SHIP_R * 0.7) >= 0) { die(); return; }
                    if (saucer && near(ship, saucer, saucer.r + SHIP_R * 0.7)) { saucer = null; die(); return; }
                }
            }

            bullets = bullets.filter(function (b) {
                b.t -= dt;
                b.x += b.vx * sec; b.y += b.vy * sec;
                wrap(b, 2);
                var i = hitsRock(b, 1);
                if (i >= 0) { breakRock(rocks[i], i); return false; }
                if (saucer && near(b, saucer, saucer.r)) {
                    shell.addScore(saucer.points);
                    explode(saucer.x, saucer.y, 8, C.warn, 70);
                    shell.beep(90, 250, 'square', 0.05, 30);
                    saucer = null; saucerTimer = rand(10000, 18000);
                    return false;
                }
                return b.t > 0;
            });

            rocks.forEach(function (r) { r.x += r.vx * sec; r.y += r.vy * sec; r.rot += r.spin * sec; wrap(r, r.r); });

            if (saucer) {
                saucer.x += saucer.vx * sec; saucer.y += saucer.vy * sec;
                saucer.turn -= dt;
                if (saucer.turn <= 0) { saucer.turn = rand(800, 2000); saucer.vy = [-60, 0, 60][Math.floor(Math.random() * 3)]; }
                if (saucer.y < 20 || saucer.y > H - 20) { saucer.vy = -saucer.vy; }
                saucer.fire -= dt;
                if (saucer.fire <= 0 && ship && hyper <= 0) {
                    saucer.fire = saucer.small ? rand(900, 1400) : rand(1200, 2000);
                    var aim = saucer.small ? Math.atan2(ship.y - saucer.y, ship.x - saucer.x) + rand(-0.25, 0.25) * Math.max(0.2, 1 - S.score / 40000) : rand(0, Math.PI * 2);
                    saucerShots.push({ x: saucer.x, y: saucer.y, vx: Math.cos(aim) * 320, vy: Math.sin(aim) * 320, t: 1400 });
                    shell.beep(700, 60, 'square', 0.03, 300);
                }
                saucerBlip -= dt;
                if (saucerBlip <= 0) { saucerBlip = 160; shell.beep(saucer.small ? 520 : 380, 120, 'square', 0.015, saucer.small ? 640 : 460); }
                var gone = saucer.vx > 0 ? saucer.x > W + saucer.r : saucer.x < -saucer.r;
                if (gone) { saucer = null; saucerTimer = rand(10000, 18000); }
            } else {
                saucerTimer -= dt;
                if (saucerTimer <= 0 && rocks.length) {
                    var small = S.score >= 10000 ? Math.random() < 0.7 : Math.random() < 0.25, d = Math.random() < 0.5 ? 1 : -1;
                    saucer = { x: d > 0 ? -20 : W + 20, y: rand(60, H - 60), vx: d * (small ? 150 : 100), vy: 0, r: small ? 9 : 16, small: small, points: small ? 1000 : 200, turn: 1000, fire: 800 };
                    saucerBlip = 0;
                }
            }
            saucerShots = saucerShots.filter(function (b) {
                b.t -= dt;
                b.x += b.vx * sec; b.y += b.vy * sec;
                wrap(b, 2);
                var i = hitsRock(b, 1);
                if (i >= 0) { var r = rocks[i]; rocks.splice(i, 1); explode(r.x, r.y, 4, C.fg, 50); if (r.size > 1) { rocks.push(rock(r.size - 1, r.x, r.y), rock(r.size - 1, r.x, r.y)); } return false; }
                if (ship && hyper <= 0 && near(b, ship, SHIP_R * 0.8)) { die(); return false; }
                return b.t > 0;
            });
            if (S.mode !== 'playing') { return; }

            /* The heartbeat quickens as the wave goes on. */
            beatTimer -= dt;
            if (beatTimer <= 0) { beatTimer = Math.max(300, 1000 - (S.level - 1) * 60 - (16 - Math.min(rocks.length, 16)) * 25); shell.beep(beat ? 50 : 60, 120, 'square', 0.03); beat ^= 1; }

            if (!rocks.length && !saucer) { shell.cleared(2000); }
        }

        /* After a death the ship comes back when the middle is clear, or
           after three seconds whatever is there. */
        function respawnWhenClear() {
            var centre = { x: W / 2, y: H / 2 };
            var clear = !rocks.some(function (r) { return near(centre, r, r.r + 90); }) && !(saucer && near(centre, saucer, 120));
            if (clear || respawnWait > 3000) { respawn(); return true; }
            return false;
        }

        /* === Drawing ======================================================== */
        function poly(points, colour, close) {
            ctx.strokeStyle = colour;
            ctx.beginPath();
            points.forEach(function (p, i) { if (i) { ctx.lineTo(p.x, p.y); } else { ctx.moveTo(p.x, p.y); } });
            if (close !== false) { ctx.closePath(); }
            ctx.stroke();
        }
        function shipPoints(s, scale) {
            var k = scale || 1, c = Math.cos(s.a), n = Math.sin(s.a), r = SHIP_R * k;
            function at(fx, fy) { return { x: s.x + (c * fx - n * fy) * r, y: s.y + (n * fx + c * fy) * r }; }
            return [at(1, 0), at(-0.8, 0.7), at(-0.5, 0), at(-0.8, -0.7)];
        }
        function drawRock(r) {
            poly(r.shape.map(function (p) { return { x: r.x + Math.cos(p.a + r.rot) * p.r, y: r.y + Math.sin(p.a + r.rot) * p.r }; }), C.fg);
        }
        function drawSaucer(sc) {
            var r = sc.r;
            poly([{ x: sc.x - r, y: sc.y }, { x: sc.x - r * 0.45, y: sc.y - r * 0.4 }, { x: sc.x + r * 0.45, y: sc.y - r * 0.4 }, { x: sc.x + r, y: sc.y },
                { x: sc.x + r * 0.45, y: sc.y + r * 0.45 }, { x: sc.x - r * 0.45, y: sc.y + r * 0.45 }], C.warn);
            poly([{ x: sc.x - r, y: sc.y }, { x: sc.x + r, y: sc.y }], C.warn, false);
            poly([{ x: sc.x - r * 0.3, y: sc.y - r * 0.4 }, { x: sc.x - r * 0.2, y: sc.y - r * 0.8 }, { x: sc.x + r * 0.2, y: sc.y - r * 0.8 }, { x: sc.x + r * 0.3, y: sc.y - r * 0.4 }], C.warn, false);
        }
        function draw() {
            var text = shell.text, mode = S.mode;
            ctx.lineWidth = 1.5;
            ctx.lineJoin = 'round';
            text(String(S.score), 16, 10, C.fg, 2);
            text('HI ' + S.hi, W / 2, 10, C.muted, 2, 'center');
            for (var l = 0; l < Math.min(S.lives, 6); l++) { poly(shipPoints({ x: 24 + l * 22, y: 44, a: -Math.PI / 2 }, 0.8), C.accent); }
            rocks.forEach(drawRock);
            if (saucer) { drawSaucer(saucer); }
            ctx.fillStyle = C.fg;
            bullets.forEach(function (b) { ctx.fillRect(b.x - 1.5, b.y - 1.5, 3, 3); });
            ctx.fillStyle = C.warn;
            saucerShots.forEach(function (b) { ctx.fillRect(b.x - 1.5, b.y - 1.5, 3, 3); });
            bits.forEach(function (b) {
                var c = Math.cos(b.a) * b.len / 2, n = Math.sin(b.a) * b.len / 2;
                poly([{ x: b.x - c, y: b.y - n }, { x: b.x + c, y: b.y + n }], b.colour, false);
            });
            if (ship && hyper <= 0 && mode !== 'ready' && mode !== 'over') {
                poly(shipPoints(ship), C.accent);
                if (ship.thrusting && Math.floor(Date.now() / 60) % 2) {
                    var c = Math.cos(ship.a), n = Math.sin(ship.a);
                    poly([{ x: ship.x - c * SHIP_R * 0.6 - n * 4, y: ship.y - n * SHIP_R * 0.6 + c * 4 }, { x: ship.x - c * SHIP_R * 1.5, y: ship.y - n * SHIP_R * 1.5 },
                        { x: ship.x - c * SHIP_R * 0.6 + n * 4, y: ship.y - n * SHIP_R * 0.6 - c * 4 }], C.warn, false);
                }
            }
            if (mode === 'ready') {
                text('ASTEROIDS', W / 2, 150, C.fg, 4, 'center');
                text('ENTER OR NEW GAME TO PLAY', W / 2, 200, C.muted, 2, 'center');
                text('TURN  THRUST  FIRE  HYPERSPACE', W / 2, 240, C.muted, 2, 'center');
            } else if (mode === 'paused') {
                text('PAUSED', W / 2, 220, C.fg, 4, 'center');
            } else if (mode === 'over') {
                text('GAME OVER', W / 2, 200, C.danger, 4, 'center');
                text('ENTER OR NEW GAME TO PLAY AGAIN', W / 2, 250, C.muted, 2, 'center');
            } else if (mode === 'cleared') {
                text('WAVE ' + S.level + ' CLEARED', W / 2, 220, C.fg, 4, 'center');
            }
        }

        shell = window.splash.shell(root, opts, {
            game: 'asteroids', title: 'Asteroids', width: W, height: H, help: HELP, crisp: true,
            pad: ['left', 'right', { name: 'up', label: 'Thrust' }, { name: 'fire', label: 'Fire' }, { name: 'alt', label: 'Hyperspace' }],
            extraLifeEvery: 10000,
            newGame: startWave, newWave: startWave,
            respawn: respawn,
            update: update, draw: draw,
            press: function (name) { if (name === 'fire') { fire(); } else if (name === 'alt' || name === 'down') { hyperspace(); } },
            after: function (dt) {
                var sec = dt / 1000;
                bits = bits.filter(function (b) { b.t -= dt; b.x += b.vx * sec; b.y += b.vy * sec; b.a += b.spin * sec; return b.t > 0; });
                /* Rocks keep drifting while the ship is gone, and the ship
                   comes back only when the middle is clear. */
                if (S.mode === 'dying') {
                    rocks.forEach(function (r) { r.x += r.vx * sec; r.y += r.vy * sec; r.rot += r.spin * sec; wrap(r, r.r); });
                    if (S.timer <= dt && S.lives > 1 && !respawnWhenClear()) { S.timer += dt; respawnWait += dt; }
                }
            },
            busy: function () { return bits.length > 0; }
        });
        S = shell.state; ctx = S.ctx; C = S.colours;
        startWave(1); ship = null; rocks.forEach(function (r) { r.vx *= 0.5; r.vy *= 0.5; });
        shell.draw();
        return shell.instance;
    }

    window.pudlApplets.register('asteroids', { init: init });
})();
