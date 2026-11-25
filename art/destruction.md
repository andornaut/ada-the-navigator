# Enemy destruction

A defeated enemy breaks into coral shards that drift, spin, shrink, cool and fade,
behind a brief pale flash, and releases its Stardust from the wreck. Tech renders
the effect from data; there are no animation frames.

- Rebuild with `node art/tools/destruction.ts`. It writes
  `public/art/enemies/destruction.json` and `destruction-flash.svg`,
  formatting the JSON with the project's Prettier settings. The shard files
  are the [enemy fleet](enemy-redesign.md)'s `{key}-shards-packed.json`.

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
- Colour: every polygon colour moves linearly in sRGB toward its family's
  darkest hull tone by `0.55 u` (`shards.cool`, [flat look](#flat-look)).
- Alpha: hull and part shards hold 1 until `u = 0.55`, 0.6 until `u = 0.8`,
  then 0.3 until the shard ends at `u = 1` (`shards.fade.steps`). Flecks fade
  linearly to zero at `u = 0.6`.
- Drift covers 0.45 to 0.75 half-spans for shards and 1.5 times that for flecks;
  spin magnitudes are 0.7 to 1.6 rad. Four flecks per archetype.
- Flash: `destruction-flash.svg` (80 by 64, pale `#ffe2c8` four-point star with
  a white core) centred on the pivot, drawn over the shards. Width
  `flashWidth * scale` frame px with alpha per phase: 0 to 20 ms scale 1 and
  alpha 0.922, 20 to 80 ms scale 0.55 and alpha 0.588, then none.

## Flat look

Each family's shards cool toward its own darkest hull tone
(`shards.cool.families`), and alpha holds in steps (`shards.fade.steps`).

| Family | Cool target |
| ------ | ----------- |
| coral  | `#7f4b3d`   |
| claim  | `#703921`   |
| garnet | `#823643`   |
| needle | `#75313a`   |

## Stardust release

At `releaseMs` the drop's pickups (counts are Gameplay's) appear at the pivot.
Pickup `i` of `n` heads to angle `2 pi i / n` plus a jitter within ±0.3 rad and
radius `spread * U(0.6, 1)` world units, with the screen-y offset squashed by
0.8. Its distance follows `1 - exp(-(t - releaseMs) / 110)`. Each pickup starts
its glint loop at a random phase.

## Per archetype

Duration, release and `spread` interpolate linearly by frame size from 450 ms,
150 ms and 19.2 at frame 96 to 600 ms, 190 ms and 33.6 at frame 192, times
rounded to 10 ms: the small craft at their fleet frames (56, 80 and 128), the
retaliators at 192. `flashWidth` is the fleet hull's half span times 1.98.

| Archetype                   | Duration | Release | `flashWidth` | `spread` | Reduced duration | Reduced release | Reduced `spread` |
| --------------------------- | -------: | ------: | -----------: | -------: | ---------------: | --------------: | ---------------: |
| `swarm`                     |   390 ms |  130 ms |       33.961 |     13.2 |           320 ms |          210 ms |             5.28 |
| `fighter`                   |   430 ms |  140 ms |       42.451 |     16.8 |           350 ms |          230 ms |             6.72 |
| `interceptor`               |   500 ms |  160 ms |       42.451 |       24 |           390 ms |          260 ms |              9.6 |
| `retaliator`                |   600 ms |  190 ms |      127.354 |     33.6 |           450 ms |          300 ms |            13.44 |
| `retaliatorCargoHauler`     |   600 ms |  190 ms |      106.128 |     33.6 |           450 ms |          300 ms |            13.44 |
| `retaliatorMiningFreighter` |   600 ms |  190 ms |      127.354 |     33.6 |           450 ms |          300 ms |            13.44 |

## Reduced motion

No flash and no shards. The idle frame stays in place, shrinks about its pivot
to 80%, darkens and fades out linearly over the reduced duration. Darkening is a
multiply tint from `#ffffff` to `#c1b9b8` (`reduced.tint`), which matches the
coral hull cooling 60% toward `#7f4b3d`. At the reduced release the pickups
appear already spread over `spread * U(0.6, 1)`, on their rest frame, with no
burst or glint.
