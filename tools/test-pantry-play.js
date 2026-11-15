/* Checks for the play of Pantry Raid that need no browser:

     node tools/test-pantry-play.js

   The game is run against a stand-in for the shell (stand-in.js), frame
   by frame, with the random numbers fixed, and looked at through
   window.splash.pantry.game(). The cats leave the den one at a time by
   its door, go to their corners and hunt by turns, run from a bell, and
   go home when caught; the passage through the side walls comes out on
   the other side and slows the cats; and the mouse cannot get into the
   den. */
'use strict';
const t = require('./stand-in')('pantry');
const { drawn, start, frame, run } = t, g = t.g, s = t.s;
const P = t.splash.pantry;
const view = () => P.game();

let failures = 0;
function log(name, ok, detail) { console.log((ok ? 'PASS ' : 'FAIL ') + name + (ok ? '' : '  ' + String(detail === undefined ? '' : detail).slice(0, 400))); if (!ok) { failures++; } }

const same = (a, b) => a.x === b.x && a.y === b.y;
const put = (e, x, y) => { e.x = x; e.y = y; e.p = 0; e.dir = null; };
const where = e => ({ x: e.x + (e.dir ? e.dir.x * e.p : 0), y: e.y + (e.dir ? e.dir.y * e.p : 0) });
/* Keeps the mouse from being caught, for a check of something else: a
   hunting cat that comes near it is put back outside the den. */
function safe() {
    const v = view(), m = where(v.mouse);
    v.cats.forEach(c => {
        const p = where(c);
        if (c.mode === 'hunt' && c.scared <= 0 && Math.hypot(p.x - m.x, p.y - m.y) < 2.5) { put(c, P.exit.x, P.exit.y); }
    });
}
/* How many tiles something runs in so many milliseconds. */
function ran(e, ms) {
    let last = where(e), sum = 0;
    run(ms, null, () => { const now = where(e), d = Math.abs(now.x - last.x) + Math.abs(now.y - last.y); if (d < 1) { sum += d; } last = now; });
    return sum;
}

/* --- Out of the den --------------------------------------------------- */
start(1);
let cats = view().cats;
log('a game starts with one cat outside the den and three inside it',
    cats.length === 4 && same(cats[0], P.exit) && cats.slice(1).every((c, i) => same(c, P.den[i])) && cats.every(c => c.mode === 'den'), cats.map(c => c.x + ',' + c.y + ' ' + c.mode).join(' | '));
log('the mouse starts under the den', same(view().mouse, P.start));
const out = [null, null, null, null], door = [true, false, false, false];
let clock = 0;
run(16000, () => out.every(v => v !== null), () => {
    safe();
    clock += 16;
    cats.forEach((c, i) => { if (same(c, P.door)) { door[i] = true; } if (out[i] === null && c.mode === 'hunt') { out[i] = clock; } });
});
log('the cats come out one at a time', out.every(v => v !== null) && out[0] < out[1] && out[1] + 2000 < out[2] && out[2] + 2000 < out[3], out.join(' '));
log('and by the door', door.every(Boolean), door.join(' '));

/* --- Corners and hunting by turns ------------------------------------- */
start(1);
cats = view().cats;
log('the cats begin by going to their corners', view().scatter === true);
let nearest = Infinity;
run(4800, null, () => { safe(); if (cats[0].mode === 'hunt') { nearest = Math.min(nearest, Math.abs(cats[0].x - cats[0].corner.x) + Math.abs(cats[0].y - cats[0].corner.y)); } });
log('the first cat reaches its own corner', nearest <= 2, nearest);
let before = null, after = null;
clock = 4800;
const turned = run(2000, () => !view().scatter, () => { safe(); clock += 16; before = cats[0].dir; });
after = cats[0].dir;
log('after five seconds they hunt', turned && clock >= 4990 && clock <= 5040, clock);
log('and turn round as they change', !!before && !!after && before.x === -after.x && before.y === -after.y, JSON.stringify([before, after]));
log('and after eighteen more they go to their corners again', run(19000, () => view().scatter, safe));

/* --- A bell, and a cat caught ----------------------------------------- */
start(1);
cats = view().cats;
run(1500, null, safe);
let mouse = view().mouse;
const bell = view().bells.find(b => b.x === 1 && b.y === 3);
put(mouse, 1, 4);
g.press('up');
let score = s.score;
run(600, () => !bell.on, safe);
log('running over a bell rings it for 50 points', !bell.on && s.score >= score + 50, s.score - score);
log('the cats that are out run from it, and the ones in the den do not', cats[0].scared > 0 && cats.slice(1).every(c => c.mode === 'den' && c.scared === 0), cats.map(c => c.mode + ' ' + c.scared).join(' | '));
score = s.score;
put(cats[0], mouse.x, mouse.y);
frame();
log('a cat caught while it runs is worth 150 and goes home', cats[0].mode === 'home' && s.score === score + 150 && s.mode === 'playing', cats[0].mode + ', ' + (s.score - score));
frame();
log('it is drawn as its eyes and does the mouse no harm', drawn.some(d => d.id === 'pe') && s.mode === 'playing');
log('it goes back into the den', run(8000, () => cats[0].mode === 'den', safe) && same(cats[0], P.den[0]), cats[0].mode + ' at ' + cats[0].x + ',' + cats[0].y);
log('and comes out again to hunt', run(6000, () => cats[0].mode === 'hunt', safe) && same(cats[0], P.exit), cats[0].mode);

/* --- The passage ------------------------------------------------------ */
start(1);
cats = view().cats;
mouse = view().mouse;
put(mouse, 2, 10);
g.press('left');
const crossed = run(1500, () => mouse.x === P.cols - 1, safe);
log('the passage through the side wall comes out on the other side', crossed && mouse.y === 10, mouse.x + ',' + mouse.y);
start(1);
cats = view().cats;
run(1200);
const free = ran(cats[0], 480);
put(cats[0], 2, 10);
const slowed = ran(cats[0], 480);
log('the cats are slow in the passage', free > 1.8 && slowed > 0.5 && slowed < free * 0.7, free.toFixed(2) + ' tiles in the open, ' + slowed.toFixed(2) + ' in the passage');

/* --- The den is the cats' --------------------------------------------- */
start(1);
cats = view().cats;
mouse = view().mouse;
run(2000, null, safe);
put(mouse, P.exit.x, P.exit.y);
g.press('down');
run(500, null, safe);
log('the mouse cannot go through the den\'s door', same(mouse, P.exit), mouse.x + ',' + mouse.y);

/* --- Caught ----------------------------------------------------------- */
put(cats[0], mouse.x, mouse.y);
cats[0].mode = 'hunt';
frame();
log('a hunting cat that reaches the mouse catches it', s.mode === 'dying');
run(1500, () => s.mode === 'playing');
log('which costs a mouse and puts the cats back in the den', s.mode === 'playing' && s.lives === 2 && view().cats.every(c => c.mode === 'den') && same(view().mouse, P.start));

console.log(failures ? failures + ' check(s) failed' : 'all checks passed');
process.exit(failures ? 1 : 0);
