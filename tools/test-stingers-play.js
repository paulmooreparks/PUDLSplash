/* Checks for the play of Stingers that need no browser:

     node tools/test-stingers-play.js

   The game is run against a stand-in for the shell (stand-in.js), frame
   by frame, with the random numbers fixed, and looked at through
   window.splash.stingers.game(). Wasps dive in groups and come back above their places; a queen
   sets a snare, the ship under it is taken, shooting her frees it, and
   the two ships fire and are hit as twins; a shot can lose the taken
   ship; no snare is set over the last ship; a bonus wave has no shooting
   and no diving and ends with a count; and the game counts its shots. */
'use strict';
const t = require('./stand-in')('stingers');
const { random, drawn, texts, said, held, start, frame, run } = t, g = t.g, s = t.s;
const G = t.splash.stingers, W = G.width, H = G.height;
const view = () => G.game();

let failures = 0;
function log(name, ok, detail) { console.log((ok ? 'PASS ' : 'FAIL ') + name + (ok ? '' : '  ' + String(detail === undefined ? '' : detail).slice(0, 400))); if (!ok) { failures++; } }

/* Takes the danger out of the wasps, for a check of something else:
   every diver has already passed the bottom, and no shot of theirs is
   in the air. */
function harmless() {
    const v = view();
    v.enemies.forEach(e => { if (e.alive && e.state === 'dive') { e.y = H + 30; } });
    v.bullets.length = 0;
}
const alive = () => view().enemies.filter(e => e.alive);
const inState = name => alive().filter(e => e.state === name);
/* Shoots a wasp standing in the ranks, by flying under it and firing. */
function shootDown(e, each) {
    return run(20000, () => !e.alive, () => {
        if (each) { each(); }
        const v = view();
        v.player.x = Math.max(6, Math.min(W - 6 - (v.twin ? 27 : 13), e.x - 6));
        if (!v.shots.length && s.mode === 'playing') { g.press('fire'); }
    });
}

/* --- Waves that differ ------------------------------------------------ */
random.rest = 0;
const nests = [];
for (let level = 1; nests.length < 16; level++) { if (level % G.bonusEvery) { nests.push(level); } }
const text = v => JSON.stringify(v);
log('each wave flies in by another plan than the one before', nests.slice(1).every((l, i) => text(G.plan(l)) !== text(G.plan(nests[i]))));
log('and settles into another shape', nests.slice(1).every((l, i) => text(G.shape(l)) !== text(G.shape(nests[i]))));
log('every plan and every shape comes round, in every pairing',
    new Set(nests.map(l => text(G.plan(l)))).size === G.plans && new Set(nests.map(l => text(G.shape(l)))).size === G.shapes &&
    new Set(nests.map(l => text([G.plan(l), G.shape(l)]))).size === G.plans * G.shapes, G.plans + ' plans, ' + G.shapes + ' shapes');
const bonuses = [1, 2, 3, 4].map(n => n * G.bonusEvery);
log('the bonus waves differ too', G.swarms >= 3 && new Set(bonuses.map(l => text(G.swarm(l)))).size === G.swarms && text(G.swarm(bonuses[0])) === text(G.swarm(bonuses[G.swarms])));
for (const level of nests.slice(0, G.plans)) {
    start(level);
    const settled = run(40000, () => view().enemies.every(e => e.state === 'form'), harmless);
    const counts = G.rows.map(y => view().enemies.filter(e => e.sy === y).length);
    log('wave ' + level + ': all thirty-six fly in and take their places', settled && view().enemies.length === 36 && text(counts) === text(G.shape(level)), text(counts) + ', ' + view().enemies.filter(e => e.state !== 'form').length + ' not in place');
}

/* --- Groups, and the way back ---------------------------------------- */
random.rest = 0;
start(1);
log('a game starts with the ranks of the nest and the wave shown', view().enemies.length === 36 && !view().bonus);
let first = run(40000, () => inState('dive').length > 0);
const leader = inState('dive')[0];
run(500);
let divers = view().enemies.filter(e => e.alive && (e.state === 'dive'));
log('a wasp dives and a neighbour follows it a moment later', first && divers.length === 2, divers.length + ' diving');
log('the two stood next to each other in the ranks', divers.length === 2 && Math.hypot(divers[0].sx - divers[1].sx, divers[0].sy - divers[1].sy) <= 40);
log('the wave is shown on the screen', texts.includes('WAVE 1'), texts.join(' | '));
let back = run(8000, () => leader.state === 'return');
log('a diver that misses comes back in at the top, above its own place', back && leader.y < 0 && Math.abs(leader.x - leader.sx) <= 16, leader.state + ' at ' + leader.x.toFixed(0) + ',' + leader.y.toFixed(0) + ' for a place at ' + leader.sx);
log('and drops back into the ranks', run(3000, () => leader.state === 'form' || !leader.alive) && leader.alive, leader.state);

start(3);
first = run(40000, () => inState('dive').length > 0);
run(700);
divers = inState('dive');
log('from the third wave a wasp can take two with it', first && divers.length === 3, divers.length + ' diving');

/* --- The snare, the taken ship, and the rescue ------------------------ */
start(1);
let cast = run(60000, () => inState('snare').length > 0, harmless);
const queen = inState('snare')[0];
log('a queen leaves the ranks to set a snare', cast && !!queen && queen.type.hp === 2, inState('snare').length);
let taken = run(8000, () => !!view().taking, harmless);
log('she stops above the ship and the ship under the snare is taken', taken && s.mode === 'dying' && Math.abs(queen.y - G.hoverY) < 4, s.mode + ', queen at ' + (queen && queen.y.toFixed(0)));
run(1700, () => s.mode === 'playing');
log('the taken ship costs one ship and play goes on', s.mode === 'playing' && s.lives === 2 && queen.held === true && !view().taking, s.mode + ' with ' + s.lives);
run(4000, () => queen.state === 'form', harmless);
log('the queen is back in her place with the ship above her',
    queen.state === 'form' && drawn.some(d => d.id === 'wp' && d.colour === 'danger' && Math.abs(d.x - (queen.x - 6)) <= 1 && d.y < queen.y - 10), queen.state);
log('no second snare is set while a ship is held', !run(30000, () => inState('snare').length > 0, harmless));
const before = s.score;
let down = shootDown(queen, harmless);
log('shooting that queen frees the ship', down && !!view().rescued && s.score >= before + 250, 'rescued ' + !!view().rescued + ', score ' + before + ' to ' + s.score);
let joined = run(6000, () => view().twin, harmless);
log('the freed ship comes down and joins the ship as its twin', joined && !view().rescued && s.lives === 2 && drawn.filter(d => d.id === 'wp' && d.colour === 'accent' && d.y === G.shipY).length === 2);
run(2000, () => !view().shots.length, harmless);
let fired = view().stats.shots;
g.press('fire');
log('twin ships fire two shots for one', view().shots.length === 2 && view().stats.shots === fired + 2 && Math.abs(view().shots[0].x - view().shots[1].x) === 14, view().shots.length);
log('no snare is set over twin ships', !run(30000, () => inState('snare').length > 0, harmless));
let at = view().player.x;
view().bullets.push({ x: at + 6, y: G.shipY + 2, vx: 0, vy: 10 });
frame();
log('a hit on twin ships costs one of the two and no life', !view().twin && s.mode === 'playing' && s.lives === 2 && view().player.x === at + 14, 'twin ' + view().twin + ', ' + s.mode + ', lives ' + s.lives);
view().bullets.push({ x: view().player.x + 6, y: G.shipY + 2, vx: 0, vy: 10 });
frame();
log('and the ship left is safe for a moment', s.mode === 'playing');
run(900, null, harmless);
view().bullets.push({ x: view().player.x + 6, y: G.shipY + 2, vx: 0, vy: 10 });
frame();
log('then a hit costs it as it does any ship', s.mode === 'dying');

/* --- A shot that finds the taken ship --------------------------------- */
start(1);
run(60000, () => !!view().taking, harmless);
const keeper = view().taking && view().taking.q;
run(1700, () => s.mode === 'playing');
run(4000, () => keeper.state === 'form', harmless);
view().shots.push({ x: Math.round(keeper.x), y: keeper.y - 8 });
frame();
log('a shot that reaches the taken ship loses it', !!keeper && keeper.alive && keeper.held === false && !view().rescued && !view().twin, keeper && keeper.held);

/* --- The last ship ---------------------------------------------------- */
start(1);
s.lives = 1;
log('no snare is set over the last ship', !run(60000, () => inState('snare').length > 0, harmless) && s.lives === 1 && s.mode === 'playing', s.mode);

/* --- The bonus wave --------------------------------------------------- */
start(G.bonusEvery);
log('every fourth wave is a bonus wave of forty', view().bonus && view().enemies.length === 40, view().enemies.length);
const odd = new Set();
let shotsSeen = 0, since = 0;
const over = run(60000, () => s.mode !== 'playing', () => {
    alive().forEach(e => { if (e.state !== 'wait' && e.state !== 'pass') { odd.add(e.state); } });
    shotsSeen += view().bullets.length;
    since += 16;
    if (since >= 240) { since = 0; g.press('fire'); }
});
const tally = view().tally;
log('the wasps of a bonus wave only fly past', odd.size === 0, [...odd].join(' '));
log('and never shoot', shotsSeen === 0, shotsSeen);
log('the ship comes to no harm standing still', over && s.mode === 'cleared' && s.lives >= 3, s.mode + ' with ' + s.lives);
const got = view().enemies.filter(e => e.shot);
log('the wave ends with a count of the wasps hit', !!tally && tally.of === 40 && tally.hits === got.length && tally.hits > 0 && tally.hits < 40 && tally.points === tally.hits * 100, JSON.stringify(tally));
log('and the count is paid', !!tally && s.score === got.reduce((sum, e) => sum + e.type.points, 0) + tally.points, s.score);
log('and shown', texts.includes(tally.hits + ' OF 40 HIT') && texts.includes('BONUS ' + tally.points), texts.join(' | '));
run(5000, () => s.mode === 'playing');
log('the wave after it is the nest again', s.level === G.bonusEvery + 1 && !view().bonus && view().enemies.length === 36, s.level);

/* --- The count of shots ----------------------------------------------- */
start(1);
log('a new game starts its count of shots again', view().stats.shots === 0 && view().stats.hits === 0 && !view().twin && !view().rescued);
since = 0;
const ended = run(400000, () => s.mode === 'over', () => { since += 16; if (since >= 400) { since = 0; g.press('fire'); } });
const st = view().stats;
log('a game left firing straight up ends', ended, s.mode);
log('it has counted its shots and its hits', st.shots > 0 && st.hits > 0 && st.hits <= st.shots, JSON.stringify(st));
log('and says so when the game is over', texts.includes(st.hits + ' OF ' + st.shots + ' SHOTS HIT') && texts.includes('ACCURACY ' + Math.round(100 * st.hits / st.shots) + ' PERCENT'), texts.join(' | '));

console.log(failures ? failures + ' check(s) failed' : 'all checks passed');
process.exit(failures ? 1 : 0);
