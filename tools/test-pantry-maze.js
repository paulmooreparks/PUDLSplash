/* Checks for Pantry Raid's mazes that need no browser:

     node tools/test-pantry-maze.js

   The pantries are drawn by hand and the levels go round them in turn.
   Every level from 1 to 99 has a maze that is the same each time it is
   made, mirrored left to right, and walled all round but for the two
   ends of the passage through the side walls. Every tile of floor is
   reached from the mouse's start, none is a dead end, and the start, the
   cats' corners and the bells are all on floor. The den is in the middle
   with its door above it, the mouse cannot get in, and a cat can get
   home to it from anywhere. */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const window = { splash: {}, pudlApplets: { register() { } } };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'packages', 'pantry', 'pantry.js'), 'utf8'), { window, Math });
const P = window.splash.pantry, COLS = P.cols, ROWS = P.rows;

let failures = 0;
function log(name, ok, detail) { console.log((ok ? 'PASS ' : 'FAIL ') + name + (ok ? '' : '  ' + String(detail || '').slice(0, 400))); if (!ok) { failures++; } }

const bad = { same: [], turn: [], mirror: [], border: [], reach: [], dead: [], places: [], den: [], home: [], passage: [] };
let fewest = Infinity, most = 0;
const pictures = new Set();
const NEXT = [[1, 0], [-1, 0], [0, 1], [0, -1]];
for (let level = 1; level <= 99; level++) {
    const m = P.maze(level), again = P.maze(level);
    const open = (x, y) => m.isOpen(x, y);
    const picture = m.open.join('') + m.den.join('') + m.slow.join('');
    if (picture !== again.open.join('') + again.den.join('') + again.slow.join('')) { bad.same.push(level); }
    const after = P.maze(level + P.pantries);
    if (picture !== after.open.join('') + after.den.join('') + after.slow.join('')) { bad.turn.push(level); }
    pictures.add(picture);
    let count = 0;
    const mouths = [];
    for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
            const i = y * COLS + x, j = y * COLS + COLS - 1 - x;
            if (m.open[i] !== m.open[j] || m.den[i] !== m.den[j] || m.slow[i] !== m.slow[j]) { bad.mirror.push(level); }
            if (m.den[i] && m.open[i]) { bad.den.push(level + ': the mouse can stand in the den at ' + x + ',' + y); }
            if (!m.open[i]) { continue; }
            count++;
            if (y === 0 || y === ROWS - 1) { bad.border.push(level); }
            if (x === 0 || x === COLS - 1) { mouths.push(x + ',' + y); }
            /* The passage comes out on the other side, which isOpen knows. */
            const exits = NEXT.filter(([dx, dy]) => open(x + dx, y + dy)).length;
            if (exits < 2) { bad.dead.push(level + ' at ' + x + ',' + y); }
        }
    }
    /* One passage: an opening in each side wall, on the same row, with
       floor that slows the cats at both ends. */
    if (mouths.length !== 2 || mouths[0].split(',')[1] !== mouths[1].split(',')[1] || !m.isSlow(0, +mouths[0].split(',')[1])) { bad.passage.push(level + ': ' + mouths.join(' ')); }
    const seen = new Set([P.start.y * COLS + P.start.x]), queue = [[P.start.x, P.start.y]];
    while (queue.length) {
        const [x, y] = queue.pop();
        for (const [dx, dy] of NEXT) {
            const nx = (x + dx + COLS) % COLS, k = (y + dy) * COLS + nx;
            if (open(nx, y + dy) && !seen.has(k)) { seen.add(k); queue.push([nx, y + dy]); }
        }
    }
    if (seen.size !== count) { bad.reach.push(level); }
    if ([P.start, P.exit].concat(P.corners, P.bells).some(t => !open(t.x, t.y))) { bad.places.push(level); }
    /* The den: three tiles in a row, the door over the middle one, and
       the tile outside the door over that. */
    const d = P.den, door = P.door;
    if (d.some(t => m.den[t.y * COLS + t.x] !== 2) || m.den[door.y * COLS + door.x] !== 1 || m.den.reduce((n, v) => n + (v ? 1 : 0), 0) !== d.length + 1 ||
        door.x !== d[0].x || door.y !== d[0].y - 1 || P.exit.x !== door.x || P.exit.y !== door.y - 1) { bad.den.push(level + ': the den is not as it is said to be'); }
    const far = P.homeward(m);
    for (let i = 0; i < far.length; i++) { if ((m.open[i] || m.den[i]) && far[i] > 500) { bad.home.push(level + ' from ' + (i % COLS) + ',' + Math.floor(i / COLS)); } }
    fewest = Math.min(fewest, count); most = Math.max(most, count);
}
const corner = b => Math.min(...[[1, 1], [COLS - 2, 1], [1, ROWS - 2], [COLS - 2, ROWS - 2]].map(([x, y]) => Math.abs(b.x - x) + Math.abs(b.y - y)));
log('a level\'s maze is the same every time', !bad.same.length, bad.same);
log('the pantries are all different', P.pantries >= 3 && pictures.size === P.pantries, pictures.size + ' of ' + P.pantries);
log('the levels go round the pantries in turn', !bad.turn.length, bad.turn);
log('every maze is mirrored left to right', !bad.mirror.length, [...new Set(bad.mirror)]);
log('every maze is walled along the top and the bottom', !bad.border.length, [...new Set(bad.border)]);
log('every maze has one passage through the side walls', !bad.passage.length, bad.passage.slice(0, 4));
log('every tile of floor is reached from the start', !bad.reach.length, bad.reach);
log('no maze has a dead end', !bad.dead.length, bad.dead.slice(0, 8));
log('the start, the corners, the bells and the tile outside the den are floor', !bad.places.length, bad.places);
log('the den is in the middle, with its door, and shut to the mouse', !bad.den.length && P.den[0].x === (COLS - 1) / 2 && P.den[0].y === (ROWS - 1) / 2, bad.den.slice(0, 4));
log('a cat can get home to the den from anywhere', !bad.home.length, bad.home.slice(0, 4));
log('the mouse starts under the den', P.start.x === P.den[0].x && P.start.y === P.den[0].y + 2, JSON.stringify(P.start));
log('there is a bell near each corner', P.bells.length === 4 && P.bells.every(b => corner(b) <= 3) && new Set(P.bells.map(b => (b.x < COLS / 2) + ',' + (b.y < ROWS / 2))).size === 4, JSON.stringify(P.bells));
log('the mazes have between 150 and 260 tiles of floor', fewest >= 150 && most <= 260, fewest + ' to ' + most);
console.log(failures ? failures + ' check(s) failed' : 'all checks passed');
process.exit(failures ? 1 : 0);
