/* Checks for the dives in Stingers that need no browser:

     node tools/test-stingers-dive.js

   A dive is flown from every place a wasp can be in the ranks, at every
   place the ship can be, at the first wave's speed and at the fastest.
   Every dive passes through each point of its path instead of circling
   one until it is given up, stays between the sides of the screen, comes
   within reach of where the ship was, leaves by the bottom, and is over
   in a few seconds. */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const window = { splash: {}, pudlApplets: { register() { } } };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'packages', 'stingers', 'stingers.js'), 'utf8'), { window, Math });
const G = window.splash.stingers, W = G.width, H = G.height;

let failures = 0;
function log(name, ok, detail) { console.log((ok ? 'PASS ' : 'FAIL ') + name + (ok ? '' : '  ' + String(detail || '').slice(0, 400))); if (!ok) { failures++; } }

const bad = { circled: [], side: [], missed: [], exit: [], slow: [] };
let dives = 0, longest = 0;
/* The ranks sway and breathe, so a wasp can leave from anywhere between
   17 and 207 across; the ship's aim is kept between 20 and 204. */
for (const level of [1, 13, 40]) {
    const speed = G.diveSpeed(level);
    for (const y of G.rows) {
        for (let x = 15; x <= W - 15; x += 2) {
            for (let aim = 20; aim <= W - 20; aim += 4) {
                const e = { x, y, ang: -Math.PI / 2, path: G.divePath(x, y, aim), wp: 0, wpT: 0 };
                const what = 'level ' + level + ' from ' + x + ',' + y + ' at ' + aim;
                let t = 0, done = false, low = x, high = x, near = Infinity, circled = false;
                while (!done && e.y <= H + 10 && t < 20000) {
                    const leg = e.wp, waited = e.wpT;
                    done = G.follow(e, speed, speed / G.turn, 16);
                    t += 16;
                    if (e.wp !== leg && waited + 16 > G.giveUp) { circled = true; }
                    if (e.y < H) { low = Math.min(low, e.x); high = Math.max(high, e.x); }
                    if (e.y > G.shipY - 44 && e.y < G.shipY + 9) { near = Math.min(near, Math.abs(e.x - aim)); }
                }
                dives++;
                longest = Math.max(longest, t);
                if (circled) { bad.circled.push(what); }
                if (low < 0 || high > W) { bad.side.push(what + ' spans ' + low.toFixed(0) + ' to ' + high.toFixed(0)); }
                if (near > 8) { bad.missed.push(what + ' by ' + near.toFixed(0)); }
                if (e.y <= H) { bad.exit.push(what + ' ends at ' + e.x.toFixed(0) + ',' + e.y.toFixed(0)); }
                if (t > 4000) { bad.slow.push(what + ' takes ' + t); }
            }
        }
    }
}
log('every dive passes through each point of its path', !bad.circled.length, bad.circled.length + ' of ' + dives + ', as ' + bad.circled.slice(0, 4).join('; '));
log('every dive stays between the sides of the screen', !bad.side.length, bad.side.length + ' of ' + dives + ', as ' + bad.side.slice(0, 4).join('; '));
log('every dive comes within reach of the ship', !bad.missed.length, bad.missed.length + ' of ' + dives + ', as ' + bad.missed.slice(0, 4).join('; '));
log('every dive leaves by the bottom of the screen', !bad.exit.length, bad.exit.length + ' of ' + dives + ', as ' + bad.exit.slice(0, 4).join('; '));
log('every dive is over within four seconds', !bad.slow.length, bad.slow.length + ' of ' + dives + ', the longest ' + longest + ' ms');
console.log(dives + ' dives, the longest ' + longest + ' ms');

/* A queen going to set a snare flies from every place in her rank to
   every place she can stop, and arrives there without circling a point
   or crossing a side. */
const snare = { circled: [], side: [], short: [] };
let snares = 0;
for (const level of [1, 13, 40]) {
    const speed = G.diveSpeed(level), y = G.rows[0];
    for (let x = 15; x <= W - 15; x += 2) {
        for (let over = 30; over <= W - 30; over += 4) {
            const e = { x, y, ang: -Math.PI / 2, path: G.snarePath(x, y, over), wp: 0, wpT: 0 };
            const what = 'level ' + level + ' from ' + x + ' to ' + over;
            let t = 0, done = false, low = x, high = x, circled = false;
            while (!done && t < 20000) {
                const leg = e.wp, waited = e.wpT;
                done = G.follow(e, speed, speed / G.turn, 16);
                t += 16;
                if (e.wp !== leg && waited + 16 > G.giveUp) { circled = true; }
                low = Math.min(low, e.x); high = Math.max(high, e.x);
            }
            snares++;
            if (circled) { snare.circled.push(what); }
            if (low < 0 || high > W) { snare.side.push(what + ' spans ' + low.toFixed(0) + ' to ' + high.toFixed(0)); }
            if (Math.hypot(e.x - over, e.y - G.hoverY) > 17) { snare.short.push(what + ' ends at ' + e.x.toFixed(0) + ',' + e.y.toFixed(0)); }
        }
    }
}
log('every queen reaches the place where she sets her snare', !snare.circled.length && !snare.short.length, snare.circled.concat(snare.short).slice(0, 4).join('; '));
log('and stays between the sides of the screen on her way', !snare.side.length, snare.side.length + ' of ' + snares + ', as ' + snare.side.slice(0, 4).join('; '));

/* The ways across the screen in a bonus wave, from the left and from
   the right, at the speed of the first bonus wave and of the fastest:
   each is flown through every point, is on the screen for a while, stays
   above the ship, and ends off the screen. */
const across = { circled: [], low: [], seen: [], exit: [], slow: [] };
for (const level of [G.bonusEvery, 40]) {
    const speed = G.flySpeed(level);
    for (let n = 0; n < G.passes; n++) {
        for (const s of [1, -1]) {
            const p = G.pass(n, s), e = { x: p.x, y: p.y, ang: p.ang, path: p.path, wp: 0, wpT: 0 };
            const what = 'level ' + level + ' way ' + n + (s > 0 ? ' from the left' : ' from the right');
            let t = 0, done = false, seen = 0, deepest = 0, circled = false;
            while (!done && t < 30000) {
                const leg = e.wp, waited = e.wpT;
                done = G.follow(e, speed, speed / G.flyTurn, 16);
                t += 16;
                if (e.wp !== leg && waited + 16 > G.giveUp) { circled = true; }
                if (e.x > 8 && e.x < W - 8 && e.y > 16) { seen += 16; deepest = Math.max(deepest, e.y); }
            }
            if (circled) { across.circled.push(what); }
            if (deepest > G.shipY - 20) { across.low.push(what + ' comes down to ' + deepest.toFixed(0)); }
            if (seen < 1500) { across.seen.push(what + ' is seen for ' + seen + ' ms'); }
            if (e.x > -4 && e.x < W + 4 && e.y > -4) { across.exit.push(what + ' ends at ' + e.x.toFixed(0) + ',' + e.y.toFixed(0)); }
            if (t > 7000) { across.slow.push(what + ' takes ' + t + ' ms'); }
        }
    }
}
log('every way across in a bonus wave is flown through each of its points', !across.circled.length, across.circled.join('; '));
log('and stays above the ship', !across.low.length, across.low.join('; '));
log('and is on the screen for a second and a half or more', !across.seen.length, across.seen.join('; '));
log('and ends off the screen within seven seconds', !across.exit.length && !across.slow.length, across.exit.concat(across.slow).join('; '));
console.log(failures ? failures + ' check(s) failed' : 'all checks passed');
process.exit(failures ? 1 : 0);
