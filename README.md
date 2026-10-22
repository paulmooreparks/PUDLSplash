# PUDLSplash

PUDLSplash is a collection of classic arcade games, each a [PUDL applet package](https://github.com/paulmooreparks/pudl-applet-packages) that any site or application built with [PUDL](https://github.com/paulmooreparks/pudl) can install by copying its folder into the web root. The games draw in PUDL's theme tokens, so they look at home in light and dark, take the keyboard or a touch pad, pause when they lose the keyboard, have Game and Help menus, and keep their ten best scores in the reader's home directory where the host has one.

## The games

| Package | Game |
|---|---|
| `packages/invaders` | Space Invaders (1978) |
| `packages/asteroids` | Asteroids (1979) |

They share `packages/shared`: the shell (the canvas, the bar, the dialogs, the scores, the sound and the loop), the keys and the touch pad, the pixel font and the scores file, `~/.splash/scores.json`, all bundled in front of each game's script when the collection is packed.

## Installing

```
node tools/pack.js packages dist
```

builds `dist/`, with the games and `shared/` beside them, using the packing tool from `pudl-applet-packages` (copied into `tools/`). A host copies `dist/` into its `wwwroot/applets/`; on a host whose applet pages are under `/page/`, the games are then at `/page/invaders` and in the Applets menu.

## Playing

Space Invaders: arrows or A and D move, Space or X fires, P or Escape pauses, Enter starts. Each wave starts lower and marches faster as its numbers fall; a saucer now and then is worth 50 to 300; a fourth cannon comes at 1,500 points.

Asteroids: arrows or A and D turn, the up arrow or W thrusts, Space or X fires, the down arrow, S, Z or Shift is hyperspace, P or Escape pauses, Enter starts. Rocks break in two until they are dust; the big saucer is worth 200 and the small one, which aims, 1,000; a new ship every 10,000 points.

## Licence

Apache License 2.0; see `LICENSE`.
