/* A stand-in for the shell and the page, for the checks of a game's play
   that need no browser (test-stingers-play.js, test-pantry-play.js):

     const t = require('./stand-in')('stingers');

   loads packages/stingers/stingers.js with the random numbers fixed and
   starts the applet. t.g is what the game handed the shell, t.s the
   shell's state, t.splash is window.splash, t.start(level) starts a game,
   t.frame() steps one frame of 16 ms as ../packages/shared/splash-shell.js
   steps it and draws it, and t.run(ms, done, each) steps frames until
   done() says so. t.drawn and t.texts are what the last frame drew, t.said
   what the status line was told, t.held the controls held down, and
   t.random.queue and t.random.rest the random numbers to come. */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

module.exports = function standIn(name) {
    const t = { random: { queue: [], rest: 0 }, drawn: [], texts: [], said: [], held: { left: false, right: false, fire: false }, g: null, s: null };
    const M = Object.create(Math);
    M.random = () => (t.random.queue.length ? t.random.queue.shift() : t.random.rest);

    const ctx = {
        fillStyle: '', fillRect() { }, save() { }, restore() { }, translate() { }, rotate() { },
        drawImage(img, x, y) { t.drawn.push({ id: img.id, colour: img.colour, x, y }); }
    };
    const document = { createElement() { return { width: 0, height: 0, getContext() { return { fillStyle: '', fillRect() { } }; } }; } };
    const window = {
        pudlApplets: { register(n, applet) { window.applet = applet; } },
        splash: {
            shell(root, opts, game) {
                const s = {
                    mode: 'ready', score: 0, hi: 0, lives: 3, level: 1, timer: 0, extraGiven: 0, root, ctx,
                    colours: { bg: 'bg', fg: 'fg', accent: 'accent', positive: 'positive', danger: 'danger', warn: 'warn', muted: 'muted' }
                };
                t.g = game; t.s = s;
                return {
                    state: s, instance: {},
                    say(text) { t.said.push(text); },
                    addScore(n) {
                        s.score += n;
                        const every = game.extraLifeEvery || 0;
                        if (every && Math.floor(s.score / every) > s.extraGiven) { s.extraGiven = Math.floor(s.score / every); s.lives++; }
                    },
                    die(ms) { s.mode = 'dying'; s.timer = ms; },
                    cleared(ms) { s.mode = 'cleared'; s.timer = ms; },
                    beep() { },
                    image(spr, colour) { return { id: spr.id, colour }; },
                    text(str) { t.texts.push(String(str).toUpperCase()); },
                    draw() { t.drawn.length = 0; t.texts.length = 0; game.draw(ctx); }
                };
            }
        }
    };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'packages', name, name + '.js'), 'utf8'), { window, document, Math: M });
    window.applet.init({}, {});
    t.splash = window.splash;

    t.start = function (level) {
        const s = t.s;
        s.score = 0; s.lives = 3; s.level = level; s.extraGiven = 0; t.said.length = 0;
        t.g.newGame(level);
        s.mode = 'playing';
    };
    t.frame = function () {
        const dt = 16, s = t.s, g = t.g;
        if (s.mode === 'dying') {
            s.timer -= dt;
            if (s.timer <= 0) {
                s.lives--;
                if (s.lives <= 0) { s.mode = 'over'; }
                else { if (g.respawn) { g.respawn(); } s.mode = 'playing'; }
            }
        } else if (s.mode === 'cleared') {
            s.timer -= dt;
            if (s.timer <= 0) { s.level++; g.newWave(s.level); s.mode = 'playing'; }
        } else if (s.mode === 'playing') { g.update(dt, t.held); }
        if (g.after) { g.after(dt); }
        t.drawn.length = 0; t.texts.length = 0;
        g.draw(ctx);
    };
    /* Frames until done() says so or ms have gone by; each() runs before
       every frame. Says whether done() said so. */
    t.run = function (ms, done, each) {
        for (let at = 0; at < ms; at += 16) {
            if (each) { each(); }
            t.frame();
            if (done && done()) { return true; }
        }
        return false;
    };
    return t;
};
