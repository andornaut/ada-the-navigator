# Ship geometry

- Rebuild with `node art/tools/ship.ts` when resources are available. It uses
  Node builtins and writes directly to `public/art/`.
- The model is [ship-model.ts](tools/ship-model.ts), a module with no side
  effects: `drawn(pivot, paint, pose)` returns a pose's polygons in draw order.
  Every ship drawing imports it rather than copying the geometry:
  [ship.ts](tools/ship.ts), the [aboard backdrop](aboard.md), the
  [quantum jump](quantum-jump.md#warp-ship) and the [app icon](app-icon.md).
  A model change regenerates all four.
- A pose is a heading (`yaw`) and `thrust`, plus optional `roll` (degrees
  about the hull's forward axis), `stretch` along the hull and `squash` across
  it, about the pivot and before the heading turn. Sprite frames use the bare
  heading, so their numbers are the heading rotation's exactly.
- Exports: `ship-{0..31}.svg`, `ship-thrust-{0..31}.svg`, `ship-jets.json`,
  `ship-nose.json` and the [paint schemes](#paint-schemes). Frames, jets and
  nose all derive from the one model, so a model change regenerates them
  together.
  `ship.svg` and `ship-thrust.svg` are byte-identical aliases of index 20 (up).
- Transparent 96 by 96 viewport, pivot (48, 48), display 42 by 42.
  Keep the viewport intact and render the selected frame with rotation zero.
- The ship has 32 headings (`SHIP_HEADINGS`); enemy craft keep 16
  (`ENEMY_HEADINGS`, [sector one enemies](enemies.md)). Heading index is
  normalized `round(atan2(world.y, world.x) / (PI / 16))` modulo 32, in 11.25
  degree world steps. Ship heading `2k` faces the same angle as enemy heading
  `k`. Multiples of four project down-right (0), down (4), down-left (8), left
  (12), up-left (16), up (20), up-right (24) and right (28).
- The isometric projection makes screen steps uneven: 19.0 degrees either side
  of down and up, 6.6 degrees either side of left and right. Nose screen angles are
  clockwise from screen right, with screen y down:

| Index |  World | Screen | Index |  World | Screen |
| ----: | -----: | -----: | ----: | -----: | -----: |
|     0 |      0 |   30.0 |    16 |    180 |  210.0 |
|     1 |  11.25 |   40.8 |    17 | 191.25 |  220.8 |
|     2 |   22.5 |   54.3 |    18 |  202.5 |  234.3 |
|     3 |  33.75 |   71.0 |    19 | 213.75 |  251.0 |
|     4 |     45 |   90.0 |    20 |    225 |  270.0 |
|     5 |  56.25 |  109.0 |    21 | 236.25 |  289.0 |
|     6 |   67.5 |  125.7 |    22 |  247.5 |  305.7 |
|     7 |  78.75 |  139.2 |    23 | 258.75 |  319.2 |
|     8 |     90 |  150.0 |    24 |    270 |  330.0 |
|     9 | 101.25 |  158.9 |    25 | 281.25 |  338.9 |
|    10 |  112.5 |  166.6 |    26 |  292.5 |  346.6 |
|    11 | 123.75 |  173.4 |    27 | 303.75 |  353.4 |
|    12 |    135 |  180.0 |    28 |    315 |    0.0 |
|    13 | 146.25 |  186.6 |    29 | 326.25 |    6.6 |
|    14 |  157.5 |  193.4 |    30 |  337.5 |   13.4 |
|    15 | 168.75 |  201.1 |    31 | 348.75 |   21.1 |

- Local forward is negative Y. Rotate the solid model into world heading before
  projecting `screenX = (x - y) * sqrt(3) / 2` and
  `screenY = (x + y) / 2 - z`, then add the viewport pivot.
- The hull is a pyramid on the swept delta plan: triangular in rear view, with
  a low ridge under the canopy that climbs steeply behind it to a rear-centre
  apex, so the top of the rear triangle reads as a small white tail. No fin.
  The six-point plan matches the selected plan coordinates at scale 0.32:
  `localX = planY * 0.32`, `localY = planX * 0.32`. Reversing mapped vertex
  order preserves counterclockwise top winding. No interior, seams or panel
  detail.
- A vertical 1.2-unit skirt runs round the plan; every upper face starts at its
  top (z 1.2).

| Vertex    | Local (x, y, z)      | Role                                      |
| --------- | -------------------- | ----------------------------------------- |
| Nose      | (0, -32, 1.2)        | Forward tip; shots leave here             |
| Wing tips | (±21.44, 20.48, 1.2) | Swept-back tips                           |
| Notches   | (±5.44, 15.68, 1.2)  | Inner ends of the trailing edges          |
| Tail      | (0, 24.32, 1.2)      | Tail tip                                  |
| Shoulder  | (0, 6, 9.5)          | Ridge kink at the canopy's rear edge      |
| Apex      | (0, 17, 15)          | Rear-centre top                           |
| Corners   | (±4.18, 13.02, 9.98) | Where wall, steep face and tail side meet |

- The notches lie ahead of the apex, so no single rear face can rise from the
  notched outline to the apex without overhanging. The rear splits into planar
  faces instead: per side a wall from the trailing edge (wing tip to notch) at
  the 76 degree lean, up to its corner, and a tail side from the notch up to the
  corner and the apex and down to the tail tip. The two tail sides meet on one
  straight ridge from the apex to the tail tip, 62.1 degrees from horizontal, so
  the tail is a sharp wedge from behind. Each corner is the common point of its
  wall, steep face and tail side planes, so every face is planar.
- The tail apex and shoulder are on local X 0. Each left corner is the exact
  reflection of its right corner, preserving the original notches and outer plan.
- The canopy is one opaque closed rounded solid with plan semi-axes 9, centred
  at local Y -3. Its upper profile is one cubic Bezier from the hood at
  `(0, -12, 5.568421)` to the rear contact `(0, 6, 9.5)`. A gently curved lower
  envelope gives the rear more fullness without moving either contact. The
  surface samples 48 angular positions and latitudes at 7.5 degree intervals;
  a 0.18-unit geometric lower band takes the darker canopy material.
- Material roles are fixed across views: wing top, steep front-side tier,
  rear-side tier, separate skirt, blue booster walls and cyan mouths. Canopy
  materials do not depend on triangle normals or the camera heading.
- Roof openings and the collar are clipped against the actual canopy volume.
  Concave hull facets use ear triangulation. Surface-plane partitioning orders
  visible vector fragments by depth; consecutive equal fills share compound
  SVG paths, so internal tessellation edges do not form visible seams.
- Twin subtle blue mouths sit on the walls: `|x|` 9.5 to 15, from 0.3 to 2.6
  above the skirt top, the top kept 0.6 under the wall's top edge, lifted 0.03
  off the wall. Thrust adds pale blue flames 16 units long with 9-unit white
  cores from each mouth's middle, readable at 42px display.
- All faces use one projection. The viewer looks from `+(1, 1, 1)`;
  outward normals determine visibility, and geometric depth partitioning handles
  overlap for ordinary, rolled and stretched poses. Raster generators sample
  the same ordered fragments at pixel centres before supersampling reduction.
- SVG exports contain vector paths, with no embedded raster image, filter or
  screen rotation. The shared source also generates the aboard and icon PNGs.

## Paint schemes

Ship paint assigns a fixed material to each hull facet role, the skirt and the
opaque canopy. Classic uses white wings, steep panels `#b2bec6`, rear panels
`#647d8d` and skirt `#abbfce`. Other paints preserve these linear-luminance
ratios relative to their own top hue. Booster walls use the canopy side colour;
cyan mouths, thrust flames and speed jets retain their original colours.

| Scheme   | Top       | Canopy roof | Canopy sides |
| -------- | --------- | ----------- | ------------ |
| Classic  | `#ffffff` | `#2585d0`   | `#1767b3`    |
| Cobalt   | `#6f9ff0` | `#eef5ff`   | `#b4c8e6`    |
| Seafoam  | `#d4f6ea` | `#14697a`   | `#0d4c59`    |
| Graphite | `#aab2c4` | `#59d0ff`   | `#2a92cc`    |
| Iris     | `#d9ccff` | `#3a2b8c`   | `#271c66`    |
| Amber    | `#f4b665` | `#24577b`   | `#173a57`    |

- Classic is free and is the `ship-{0..31}.svg` set. Other schemes use
  Gameplay's purchase-order prices; Art does not assign a fixed scheme price.
- Other schemes export idle frames only:
  `paint/{cobalt,seafoam,graphite,iris,amber}/ship-{0..31}.svg`. Draw speed jets
  as for Classic. There are no painted thrust frames.
- `ship-paint.json` version 1 lists these six schemes in order, with `id`,
  `name`, `top`, `frontSides`, `rearSides`, `skirt`, `canopyRoof`, `canopySides`
  and the derived compatibility colour `canopyHighlight`. Highlight metadata
  does not change the fixed rendered materials. Gameplay owns names and prices.
- Manifest entries `ship-{scheme}-{N}` follow the ship entries and copy
  `ship-N`'s fields, with their own `path` and a `paint` field holding the
  scheme id. Classic frames have no `paint` field. Select by `paint` and
  `directionIndex`; a lookup by `ship-` prefix alone must exclude entries with
  `paint`.
- `art/tools/ship.ts` writes the frames, `ship-paint.json` and every `ship`
  and `ship-*` manifest entry at the start of the manifest, in order: `ship`,
  `ship-thrust`, then `ship-N` and `ship-thrust-N` per heading, then the paint
  entries. It replaces any earlier ship entries and sets the manifest's
  `shipNose` link.

## Speed jets

`ship-jets.json` (version 1) drives jets that scale continuously with speed. Each
mouth may include `occluders`, a list of polygons in the same 96px frame as its
anchor. They contain actual surface fragments nearer than that mouth's
horizontal exhaust plane, clipped to the maximum jet support. An empty list is
clear; absence retains the legacy behind-sprite rendering. The title screen
uses these polygons to attach each plume without covering nearer hull faces.
The
renderer draws them behind the idle `ship-{index}` frame; there are no jet frames.

- `f` is current speed as a fraction of max speed. No jet at `f = 0`.
- Jet length in ship units: `length.base + length.scale * f ^ length.exponent`
  (6 + 24 f²): about 2-3px at f = 0.25 and 13px at max on the 42px display.
- `headings` holds all 32 ship headings, `headings[k].index` = `k`. Per
  heading, each of the two `mouths` gives frame-px values in the 96 by 96
  frame: `anchor` (projected middle of the actual opening on its wall), `axis` (projected rear
  direction per ship unit) and `half` (projected half mouth width along the
  trailing edge, local (±2.75, 0.83, 0)). Scale them
  with the ship's display size.
- Per mouth, draw one filled triangle per entry of the level's `layers`, in order (halo, outer,
  core): base `anchor ± half * width`, tip `anchor + axis * jetLength * length`.
- Colour is `color`, or `colors` interpolated linearly in sRGB by `f`. The halo
  alpha is `max(0, (f - from) / (to - from)) * max`, skipped at zero; other layers
  are opaque.
- `engineLevels` holds the layers for each engine level, `level` 1 to 3: draw
  Ada's jets in her level's `layers`. Only the colours change; widths, lengths
  and the halo's alpha ramp are the same at every level, on every paint scheme.

| Engine level | `halo.color` | `outer.colors`       | `core.colors`        |
| -----------: | ------------ | -------------------- | -------------------- |
|      1, base | `#70ace8`    | `#5b93cc`, `#b9ecff` | `#8cc4f0`, `#ffffff` |
|    2, orange | `#ff8f1f`    | `#ea6a00`, `#ffd59a` | `#ffb24d`, `#ffffff` |
|    3, purple | `#a66bff`    | `#8652e7`, `#e6ccff` | `#b98cff`, `#ffffff` |

On a light field the jets take `lightField.jets.shipLevels` in
[galaxies.json](../public/art/galaxies.json) for the same level
([Light fields](galaxies.md#light-fields)).

Every colour that carries a jet holds 3:1 or better on every dark galaxy
(Whirlpool lowest): orange halo 6.34:1, outer start 4.52:1, core start 8.08:1;
purple halo 4.25:1, outer start 3.02:1, core start 5.69:1; on Phantom's
`#241827` purple is 4.99:1, 3.54:1 and 6.69:1. Each tier is 0.08 or more in
Oklab from the warm signals beside it: the orange halo is 0.098 from coral
`#d68b72`, 0.104 from amber `#f0bd68`, 0.148 from the low red `#e4574e` and
0.091 from its pulse peak `#ff8a80`; orange jets are 0.082 to 0.131 from the
coral enemy jets at the same speed; purple is 0.25 or more from every warm
signal and 0.092 from the Iris scheme's rear sides `#8f7cd0`.

## Nose

`ship-nose.json` (version 1) gives the point shots leave from. The manifest
links it as `shipNose`.

- `frame` is the frame size in px (96) and `displayScale` the display px per
  frame px (0.4375, 42 / 96).
- `noses[k]` is `[x, y]` in frame px for heading `k`, 32 entries: the hull's
  forward tip at the skirt top, local (0, -32, 1.2), projected like the frames, so it is the drawn
  tip vertex of `ship-k`. Its offset from the pivot (48, 48) times
  `displayScale` gives display px from the ship's position.
- `collision[k]` is idle heading `k`'s drawn silhouette, 32 entries in heading
  order: an array of convex parts, each an array of `[x, y]` in frame px, the
  schema of the asteroids' `frames[k].collision`. See [Collision](#collision).

## Collision

The ship collides, makes contact and is placed by its drawn silhouette,
`ship-nose.json` `collision[k]` for heading `k`. Offsets from the pivot
(48, 48) times `displayScale` give display px.

- `art/tools/ship.ts` traces each idle frame's fills with the shared tracer
  (below). The frames have no strokes, so the drawing is not grown. Douglas-Peucker
  runs at 0.5 frame px: at the default 0.75 the hull's long straight edges
  leave headings 15, 17, 19 and 21 below the 0.98 floor.
- Paint schemes share the geometry. The generator traces every scheme and fails
  unless all six give the same parts, so the one set serves every paint.
- The parts cover the hull; thrust flames and speed jets have none.
- No heading has a notch tip; the generator fails if one appears.
- Results: 3 to 7 parts per heading, intersection over union 0.982 to 0.993
  (0.981 or more against librsvg renders at 4 px per frame px) and every
  boundary within 0.5 frame px of the drawing.

### Shared tracer

`art/tools/silhouette.ts` turns a frame's drawn alpha into convex parts in frame
px. The [sector one enemies](enemies.md#collision), the
[heavies](heavies.md#collision), the traveling debris
([Cartwheel](cartwheel-props.md#collision), [Whirlpool](whirlpool.md#collision))
and the asteroids and resource rocks
([asteroid collision](asteroids.md#collision)) use it too.

1. Rasterize at 4 cells per frame px: vector polygons by cell centre with
   nonzero winding (`rasterize`), PNG sprites by alpha at 128 or more
   (`alphaMask`). An SVG drawing grows by its own stroke half-width as a round
   stroke does (`grow`): a cell fills when a drawn cell centre lies within the
   half-width of its centre. A PNG never grows, as its alpha already includes
   the outline.
2. Trace the outer boundary along cell edges; holes and specks are dropped.
   Simplify by Douglas-Peucker, 0.75 frame px unless the caller passes another
   tolerance.
3. Cut every notch tip narrower than 30 degrees at the chord 0.6 frame px wide.
   The caller draws the returned tip triangles into the frame.
4. Ear-clip the outline and merge the triangles while they stay convex
   (Hertel-Mehlhorn). Coordinates round to 0.01 frame px.

`check` fails the build unless every part is strictly convex, the parts' union
matches the drawing (enclosed background filled) with intersection over union
0.98 or more, and no cell that one has and the other lacks lies more than 1
frame px from the other.

`traceFills` traces a frame of vector fills, grown by their stroke half-width:
it tries each given tolerance in order, keeps the first whose parts pass
`check`, and returns the notch tips in the colour of the topmost fill within
0.6 frame px of each apex (stroke included), rounded as the SVG writes them.
`traceGrid` traces a pixel-art frame (every drawn pixel opaque) and
`withCollision` adds the parts to each frame of its Aseprite data. `TOLERANCES`
is the per-sprite ladder 0.75, 0.5, 0.4 and 0.3 frame px; each sprite takes
the first that passes.
