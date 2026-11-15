# PUDLSplash

PUDLSplash is a collection of classic arcade games, each a [PUDL applet package](https://github.com/paulmooreparks/pudl-applet-packages) that any site or application built with [PUDL](https://github.com/paulmooreparks/pudl) can install by copying its folder into the web root. The games draw in PUDL's theme tokens, so they look at home in light and dark, take the keyboard or a touch pad, pause when they lose the keyboard, have Game and Help menus, and keep their ten best scores in the reader's home directory where the host has one.

## The games

| Package | Game |
|---|---|
| `packages/invaders` | Space Invaders (1978) |
| `packages/asteroids` | Asteroids (1979) |
| `packages/pantry` | Pantry Raid, a maze chase of the collection's own |
| `packages/stingers` | Stingers, a formation shooter of the collection's own |

They share `packages/shared`: the shell (the canvas, the bar, the dialogs, the scores, the sound and the loop), the keys and the touch pad, the pixel font and the scores file, `~/.splash/scores.json`, all bundled in front of each game's script when the collection is packed.

## Installing

```
node tools/pack.js packages dist
```

builds `dist/`, with the games and `shared/` beside them, using the packing tool from `pudl-applet-packages` (copied into `tools/`). A host copies `dist/` into its `wwwroot/applets/`; on a host whose applet pages are under `/page/`, the games are then at `/page/invaders` and in the Applets menu.

## Playing

Space Invaders: arrows or A and D move, Space or X fires, P or Escape pauses, Enter starts. Each wave starts lower and marches faster as its numbers fall; a saucer now and then is worth 50 to 300; a fourth cannon comes at 1,500 points.

Asteroids: arrows or A and D turn, the up arrow or W thrusts, Space or X fires, the down arrow, S, Z or Shift is hyperspace, P or Escape pauses, Enter starts. Rocks break in two until they are dust; the big saucer is worth 200 and the small one, which aims, 1,000; a new ship every 10,000 points.

Pantry Raid: the arrows or W, A, S and D turn the mouse, which keeps running until a wall stops it; P or Escape pauses, Enter starts. The mouse eats every crumb while four cats hunt it, each in its own way. The cats come out of their den in the middle one at a time, and by turns they hunt for eighteen seconds and go off to their own corners for five. A bell scares the cats for a few seconds, and a cat caught while it runs slinks back to the den for 150 points, then 300, 450 and 600. The passage through the side walls comes out on the other side, and the cats are slow in it. Cheese appears under the den once half the crumbs are gone. There are three pantries, drawn by hand, and the levels go round them in turn with faster cats each time. In every pantry the den is in the middle, the mouse starts under it, and there is a bell in each corner. A new mouse comes every 5,000 points.

Stingers: arrows or A and D move, Space or X fires two shots at a time, P or Escape pauses, Enter starts. The wasps fly in by squads and settle into ranks, then dive at the ship alone or two and three together, shooting as they come, and a wasp that misses comes back in at the top. Drones are worth 10, soldiers 20 and queens 50, and double when shot in a dive. A queen takes two hits and drops honey, which gives eight seconds of rapid fire. Now and then a queen stops above the ship and lets down a snare; a ship caught in it is carried up to the ranks and costs a ship, and shooting that queen brings it down to fly beside the next one, so that two ships fire two shots for one and a hit costs one of the two. No snare is set over the last ship. Every fourth wave is a bonus wave, where forty wasps fly past without shooting and each one hit is worth 100 more at the end, or 5,000 more for all forty. The waves differ: the nest has five plans for flying in and three shapes to settle into, which come round by turns, and the bonus waves have three sets of flights. A new ship comes every 4,000 points, and the game says how many shots hit when it is over.

## Licence

Apache License 2.0; see `LICENSE`.
