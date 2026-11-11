# Enemy destruction

A defeated enemy breaks into coral shards that drift, spin, shrink, cool and fade,
behind a brief pale flash, and releases its Stardust from the wreck. Tech renders
the effect from data; there are no animation frames.

- Rebuild with `node art/tools/destruction.ts`. It writes
  `public/art/enemies/{archetype}-shards.json`, `destruction.json` and
  `destruction-flash.svg`, formatting the JSON with the project's Prettier
  settings. The craft models in `art/tools/crafts.ts` are shared with
  [the idle frames](enemies.md).

## Shard files

`{archetype}-shards.json`, version 1. All positions are frame px in that
archetype's frame (pivot at its centre); scale them by the display size like the
idle frame.

- `halfSpan`: the hull's largest `|x|` in model units.
- `shards[i]`: the fixed per-shard draw table, identical for every heading.
  `kind` is `hull` (a wedge of the hull with the plates and guns on it, and
  its piece of the insignia, which is cut along the same wedge rays), `part`
  (a loose visor, turret or barrel) or `fleck` (small debris). `spin` is the
  signed total spin in radians. `jitter`, `distance` and `lift` are the inputs
  already applied to `drift`: direction jitter (rad), drift in half-spans and
  lift (model units).
- `headings[k].shards`: the shards for idle heading `k`, ordered far to near at
  rest. `shard` indexes `shards`. `centroid` is the pivot for spin and shrink.
  `drift` is the full displacement. `nearness` and `nearnessDrift` give the draw
  order. `polygons` are the shard's faces as they appear in the idle frame, in
  draw order: `color` and flat `points` `[x0, y0, x1, y1, ...]`. Insignia
  pieces never move a shard's `centroid` or `drift`.

## Timeline

For elapsed `t` and duration `T`, `u = min(1, t / T)` and the ease
`e = 1 - (1 - u) ^ 2.4` (`shards.ease`).

- Each shard point `p` draws at
  `centroid + M(spin * e) * (p - centroid) * s + drift * e`, with shrink
  `s = 1 - 0.35 u` (to 65%). `M(a) = [[cos a, -sqrt(3) sin a], [sin a / sqrt(3), cos a]]`
  is a plan rotation seen through the projection.
- Draw shards in ascending `nearness + nearnessDrift * e`.
- Colour: every polygon colour moves linearly in sRGB toward `#7f4b3d` by
  `0.55 u` (`shards.cool`).
- Alpha: hull and part shards stay opaque until `u = 0.3`, then
  `(1 - (u - 0.3) / 0.7) ^ 1.3`. Flecks fade linearly to zero at `u = 0.6`.
- Drift covers 0.45 to 0.75 half-spans for shards and 1.5 times that for flecks;
  spin magnitudes are 0.7 to 1.6 rad. Four flecks per archetype.
- Flash: `destruction-flash.svg` (80 by 64, pale `#ffe2c8` four-point star with
  a white core) centred on the pivot, drawn over the shards. Width
  `flashWidth * scale` frame px with alpha per phase: 0 to 20 ms scale 1 and
  alpha 0.922, 20 to 80 ms scale 0.55 and alpha 0.588, then none.

## Stardust release

At `releaseMs` the drop's pickups (counts are Gameplay's) appear at the pivot.
Pickup `i` of `n` heads to angle `2 pi i / n` plus a jitter within ±0.3 rad and
radius `spread * U(0.6, 1)` world units, with the screen-y offset squashed by
0.8. Its distance follows `1 - exp(-(t - releaseMs) / 110)`. Each pickup starts
its glint loop at a random phase.

## Per archetype

Approved: fighter and retaliator. Swarm and interceptor interpolate linearly by
frame size and round to 10 ms.

| Archetype     | Duration | Release | `flashWidth` | `spread` | Reduced duration | Reduced release | Reduced `spread` |
| ------------- | -------: | ------: | -----------: | -------: | ---------------: | --------------: | ---------------: |
| `swarm`       |   430 ms |  140 ms |        27.72 |     16.8 |           350 ms |          230 ms |             6.72 |
| `fighter`     |   450 ms |  150 ms |        41.58 |     19.2 |           360 ms |          240 ms |             7.68 |
| `interceptor` |   440 ms |  150 ms |         19.8 |       18 |           350 ms |          230 ms |              7.2 |
| `retaliator`  |   600 ms |  190 ms |        85.14 |     33.6 |           450 ms |          300 ms |            13.44 |

## Reduced motion

No flash and no shards. The idle frame stays in place, shrinks about its pivot
to 80%, darkens and fades out linearly over the reduced duration. Darkening is a
multiply tint from `#ffffff` to `#c1b9b8` (`reduced.tint`), which matches the
coral hull cooling 60% toward `#7f4b3d`. At the reduced release the pickups
appear already spread over `spread * U(0.6, 1)`, on their rest frame, with no
burst or glint.
