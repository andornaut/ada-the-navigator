# Asteroids

Asteroids are play objects: faceted low-poly rocks in the shared solid-model
projection, in one neutral stone ramp in every galaxy. Backdrop rocks are field
scenery: greyscale sprites tinted per galaxy at runtime.

- Rebuild with `node art/tools/asteroids.ts`. It writes one SVG per frame to
  `public/art/asteroids/`, writes [asteroids.json](../public/art/asteroids.json)
  (formatted with the project's Prettier settings) and links it from the root
  manifest as `asteroids`. Reruns are byte-identical.
- The models are seeded, so a shape changes only when its seed, aspect, width or
  class rules change in the generator.
- The build reads the field colours from
  [space-palette.json](../public/art/space-palette.json) and
  [galaxies.json](../public/art/galaxies.json), and fails if a backdrop colour
  reaches 1.8:1 on its galaxy background.

## Classes

Widths are display px of frame 0 (Ada is 42 px wide). Spin and drift rates are
ranges; Tech picks one value per rock from the level seed.

| Size     | Shapes | Width      | Frames | Spin       | Drift                    |  HP | Stardust |
| -------- | -----: | ---------- | -----: | ---------- | ------------------------ | --: | -------: |
| `small`  |      4 | 36 to 50   |     24 | 8 to 18°/s | 14 to 32 px/s            |   3 |      0–1 |
| `medium` |      4 | 84 to 118  |     24 | 4 to 10°/s | 8 to 20 px/s             |   5 |        1 |
| `large`  |      3 | 170 to 210 |      1 | none       | 4 to 10 px/s             |  10 |        2 |
| `huge`   |      3 | 260 to 400 |      1 | none       | never (`eligible` false) |  16 |        3 |

- Each model is a seeded star-shaped plan with one or two concave bays, built up
  through a tapered base, a full girth, an inset shoulder and a crown of one to
  three ridge peaks. Every face is a triangle with one flat tone.
- Spin frame `k` shows the rock turned `15k` degrees about its vertical axis
  under a fixed world light, so facets change tone as it turns. Show frame
  `floor(angle / 15) mod 24`; play frames ascending or descending for the two
  spin directions.
- HP and Stardust are Gameplay values ([economy](../gameplay/economy.md)), listed
  here for reference.

## Palette

Play stone, lit to shadow: Oklab L 0.61, 0.545, 0.48, 0.42 and 0.365 at chroma
0.016, hue 70 (`stone` in the data). A facet takes a tone by the dot product of
its normal with the world light: at least 0.9, 0.78, 0.6 and 0.3 for tones 0
to 3, and tone 4 below that. Neutral stone never reads as the coral
`obstacle` signal or as tinted field.

Contrast on each background (WCAG):

| Field       | `#8A8279` | `#766F66` | `#645C54` | `#534C44` | `#443D35` |    `backdropLit` |   `backdropSide` |
| ----------- | --------: | --------: | --------: | --------: | --------: | ---------------: | ---------------: |
| base        |    3.87:1 |    2.95:1 |    2.23:1 |    1.73:1 |    1.37:1 | `#49475D` 1.63:1 | `#3A394A` 1.30:1 |
| `sunflower` |    3.85:1 |    2.94:1 |    2.22:1 |    1.73:1 |    1.36:1 | `#5B4724` 1.65:1 | `#49391D` 1.31:1 |
| `cartwheel` |    3.90:1 |    2.98:1 |    2.25:1 |    1.75:1 |    1.38:1 | `#643F39` 1.63:1 | `#50322E` 1.29:1 |
| `whirlpool` |    3.83:1 |    2.92:1 |    2.21:1 |    1.71:1 |    1.35:1 | `#26515C` 1.66:1 | `#1E414A` 1.32:1 |
| `black-eye` |    4.58:1 |    3.50:1 |    2.64:1 |    2.05:1 |    1.62:1 | `#4F2F48` 1.51:1 | `#3F263A` 1.28:1 |

Lit stone stays at 3.8:1 or more on every background; backdrop rocks stay below
1.8:1, so play rocks always stand in front of the field. Signals are unchanged.

## Backdrop tint

Backdrop rocks (`backdrop.sprites`) are four greyscale SVGs, white tops and grey
sides, drawn under every play object with no collision. Tech multiplies them by
the current galaxy's `backdropLit` (Phaser `setTint`), so the tops take
`backdropLit` and the sides `backdropSide` exactly. The mock-ups draw them at
0.6 to 1 times their display size, and colour the field's dust specks with
`backdropSide`.

`tints` holds the computed colours for the base field and each galaxy id, from
one rule (`backdrop.rule`):

- `backdropLit`: Oklab L of the field's `environmentDetail` plus 0.035
  (`lift`), at the galaxy tint hue with 1.5 times the galaxy tint chroma
  (`chromaScale`). The base field uses the hue and chroma of its own
  `environmentDetail`.
- `backdropSide`: `backdropLit` times 0.8 per sRGB channel (`sideScale`).

## Placement and draw order

Gameplay rules, recorded here for the art's use and implemented by Gameplay and
Tech:

- Every asteroid can be destroyed; HP and Stardust follow [Classes](#classes).
- Drifting rocks follow seeded closed loops that never overlap other rocks, so
  rocks never bounce off each other.
- Ships bounce off rocks. Rocks deal no damage.
- Large and huge rocks keep their `radius` (converted to display px) plus 160 clear of
  stations, destinations and launch points, and stay out of passages.
- Draw play objects in ascending pivot screen y.

## Drift cue

A drifting rock trails four square stone chips behind it, in `#766F66` (stone
1), so it reads as moving but harmless rather than as coral debris. In logical
px from the silhouette centre (the centre of the current frame's collision
bounds) along the reverse drift direction:

- Chip `i` (0 to 3) sits `e + 4 + 6.5 i` behind, where `e` is the distance to the
  edge of the ellipse with the collision bounds' half extents, offset sideways
  by a seeded value within ±1.5.
- Sizes 2, 2, 1 and 1 px; alpha 0.9, 0.7, 0.5 and 0.35.
- The chips move with the rock and keep their offsets; still rocks have none.

## Reduced motion

Spinning rocks show frame 0 and never change frame. Drift is gameplay, so
drifting rocks still move, with their chips drawn as a static direction mark.

## Destruction

[Enemy destruction](destruction.md) defines its shards, flash and timings per
enemy archetype from the craft models, and cools coral toward `#7f4b3d`. It has
no asteroid entry, so the shard break does not apply to rocks. What applies to a
destroyed rock is the archetype-independent part: the reduced-motion form
(shrink about the pivot to 80%, multiply darken toward `#c1b9b8`, linear fade)
at every motion setting, and the Stardust release at the pivot. Asteroid
durations, release times and `spread` are not yet authored; a rock shard break
would need its own mock-up.

## Data

`asteroids.json`, version 1. Frame values are frame px in the art's own
projection; multiply by `displayScale` (0.4375) for display px. Tech maps them
to screen space.

- `stone`: the play stone ramp, lit to shadow.
- `asteroids[i]`:
  - `id` and `size` (`small`, `medium`, `large` or `huge`).
  - `frame` (frame px) and `display` (display px, `frame * displayScale`).
  - `pivot`: `[x, y]` as a fraction of the frame. It is the centre of the
    rock's base on the world plane: place it at the world position and sort by
    it.
  - `radius`: frame px from the pivot to the farthest outline point over all
    frames.
  - `drift`: `eligible` and `speed`, a `[min, max]` range in logical px per
    second.
  - `spin`: `{ "degPerSecond": [min, max] }`, or `false` for one still frame.
  - `frames[k]`: `file` (public path) and `collision`, that frame's convex parts
    as `[x, y]` frame px. The union of the parts is the silhouette.
- `backdrop`: `sideScale`, `rule` (`lift`, `chromaScale`) and `sprites`, each
  with `id`, `file`, `frame`, `display`, `pivot` and `tint` (`backdropLit`).
- `tints`: `backdropLit` and `backdropSide` for `base` and each galaxy id.

Sample (one small rock, first frame only):

```json
{
  "id": "asteroid-s3",
  "size": "small",
  "frame": { "width": 96, "height": 63 },
  "display": { "width": 42, "height": 27.56 },
  "pivot": [0.5, 0.66667],
  "radius": 47.46,
  "drift": { "eligible": true, "speed": [14, 32] },
  "spin": { "degPerSecond": [8, 18] },
  "frames": [
    {
      "file": "/art/asteroids/asteroid-s3-0.svg",
      "collision": [
        [
          [51.5, 5.5],
          [87.5, 24.25],
          [85, 42.5],
          [62.25, 58],
          [46.25, 56.5],
          [26, 52],
          [17.5, 45.25],
          [4.25, 24.75],
          [36.25, 10.75]
        ],
        [
          [4.25, 24.75],
          [16.25, 15],
          [36.25, 10.75]
        ]
      ]
    }
  ]
}
```

## Collision

Each frame's collision is traced from the drawing itself:

1. Fill the frame's visible projected facets into a grid of 4 cells per frame px
   and grow it by half the 1.2 px seam stroke.
2. Trace the outer boundary along cell edges and simplify it by Douglas-Peucker
   at 0.75 frame px.
3. Ear-clip the outline into triangles and merge neighbours while the result
   stays convex (Hertel-Mehlhorn).

Checked against the rendered SVGs at 4 px per frame px: every part is convex,
the parts' union matches the drawn alpha with intersection over union 0.983 or
more (0.993 or more from medium up), and no boundary lies more than 0.75 frame
px from the drawing in either direction. Parts per frame: 1 to 4 for small, 2 to
6 for medium, 3 to 8 for large and 5 to 9 for huge.

## Not yet drawn

Resource rocks (medium and large shapes with a distinct resource inset) need
their own mock-up before they join this set.
