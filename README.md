# PUDLSplash

PUDLSplash is a collection of classic arcade games, each a [PUDL applet package](https://github.com/paulmooreparks/pudl-applet-packages) that any site or application built with [PUDL](https://github.com/paulmooreparks/pudl) can install by copying its folder into the web root. The games draw in PUDL's theme tokens, so they look at home in light and dark, take the keyboard or a touch pad, pause when they lose the keyboard, have Game and Help menus, and keep their ten best scores in the reader's home directory where the host has one.

## The games

| Package | Game |
|---|---|
| `packages/invaders` | Space Invaders (1978) |
| `packages/asteroids` | Asteroids (1979), to come |

They share `packages/shared/splash-input.js`, the keys and the touch pad, and `packages/shared/splash-scores.js`, the scores file, `~/.splash/scores.json`.

## Installing

```
node tools/pack.js packages dist
```

builds `dist/`, with the games and `shared/` beside them, using the packing tool from `pudl-applet-packages` (copied into `tools/`). A host copies `dist/` into its `wwwroot/applets/`; on parkscomputing.com the games are then at `/page/invaders` and in the Applets menu.

## Playing

Space Invaders: arrows or A and D move, Space or X fires, P or Escape pauses, Enter starts. Each wave starts lower and marches faster as its numbers fall; a saucer now and then is worth 50 to 300; a fourth cannon comes at 1,500 points.

## Licence

Apache License 2.0; see `LICENSE`.
