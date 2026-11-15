/* Checks for Pantry Raid's mazes that need no browser:

     node tools/test-pantry-maze.js

   Every level from 1 to 99 has a maze that is the same each time it is
   made, mirrored left to right, walled all round, with every open tile
   reachable from the mouse's start, no dead ends, and the start, the
   cats' corners and the bells all on open tiles. */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const window = { splash: {}, pudlApplets: { register() { } } };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'packages', 'pantry', 'pantry.js'), 'utf8'), { window, Math, Uint8Array });
const P = window.splash.pantry, COLS = P.cols, ROWS = P.rows;

let failures = 0;
function log(name, ok, detail) { console.log((ok ? 'PASS ' : 'FAIL ') + name + (ok ? '' : '  ' + String(detail || '').slice(0, 400))); if (!ok) { failures++; } }

const bad = { same: [], mirror: [], border: [], reach: [], dead: [], places: [] };
let fewest = Infinity, most = 0;
const pictures = new Set();
for (let level = 1; level <= 99; level++) {
    const m = P.maze(level), again = P.maze(level);
    const open = (x, y) => m.open[y * COLS + x] === 1;
    if (m.open.join('') !== again.open.join('')) { bad.same.push(level); }
    pictures.add(m.open.join(''));
    let count = 0;
    for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
            if (open(x, y) !== open(COLS - 1 - x, y)) { bad.mirror.push(level); }
            if (!open(x, y)) { continue; }
            count++;
            if (x === 0 || y === 0 || x === COLS - 1 || y === ROWS - 1) { bad.border.push(level); continue; }
            const exits = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => open(x + dx, y + dy)).length;
            if (exits < 2) { bad.dead.push(level + ' at ' + x + ',' + y); }
        }
    }
    const seen = new Set([P.start.y * COLS + P.start.x]), queue = [[P.start.x, P.start.y]];
    while (queue.length) {
        const [x, y] = queue.pop();
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const k = (y + dy) * COLS + x + dx;
            if (open(x + dx, y + dy) && !seen.has(k)) { seen.add(k); queue.push([x + dx, y + dy]); }
        }
    }
    if (seen.size !== count) { bad.reach.push(level); }
    if ([P.start].concat(P.homes, P.bells).some(t => !open(t.x, t.y))) { bad.places.push(level); }
    fewest = Math.min(fewest, count); most = Math.max(most, count);
}
log('a level\'s maze is the same every time', !bad.same.length, bad.same);
log('the levels have mazes of their own', pictures.size === 99, pictures.size);
log('every maze is mirrored left to right', !bad.mirror.length, [...new Set(bad.mirror)]);
log('every maze is walled all round', !bad.border.length, [...new Set(bad.border)]);
log('every open tile is reached from the start', !bad.reach.length, bad.reach);
log('no maze has a dead end', !bad.dead.length, bad.dead.slice(0, 8));
log('the start, the corners and the bells are open', !bad.places.length, bad.places);
log('the mazes have between 150 and 260 open tiles', fewest >= 150 && most <= 260, fewest + ' to ' + most);
console.log(failures ? failures + ' check(s) failed' : 'all checks passed');
process.exit(failures ? 1 : 0);
