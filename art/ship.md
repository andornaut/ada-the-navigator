# Ship geometry

- Rebuild with `node art/tools/ship.ts` when resources are available.
  The single module uses Node builtins and writes directly to `public/art/`.
- Exports: `ship-{0..31}.svg`, `ship-thrust-{0..31}.svg`, `ship-jets.json`,
  `ship-nose.json` and the [paint schemes](#paint-schemes). Frames, jets and
  nose all derive from the one model in the module, so a model change
  regenerates them together.
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

| Vertex         | Local (x, y, z)      | Role                                      |
| -------------- | -------------------- | ----------------------------------------- |
| Nose           | (0, -32, 1.2)        | Forward tip; shots leave here             |
| Wing tips      | (±21.44, 20.48, 1.2) | Swept-back tips                           |
| Notches        | (±5.44, 15.68, 1.2)  | Inner ends of the trailing edges          |
| Tail           | (0, 24.32, 1.2)      | Tail tip                                  |
| Shoulder       | (0, 6, 7.5)          | Ridge kink at the canopy's rear edge      |
| Apex           | (0, 17, 15)          | Rear-centre top                           |
| Rear-face base | (±2.44, 20.44, 1.2)  | On the tail edges, 76 degrees below apex  |
| Corners        | (±4.29, 13.25, 9.21) | Where wall, steep face and tail side meet |

- The notches lie ahead of the apex, so no single rear face can rise from the
  notched outline to the apex without overhanging. The rear splits into planar
  faces instead: per side a wall from the trailing edge (wing tip to notch) at
  the 76 degree lean, up to its corner; a tail side from the notch and rear-face
  base up to the corner and the apex; and between the tail edges one rear face
  from the base up to the apex at 76 degrees, behind which a flat plate fills
  the tail tip at skirt height. Each corner is the common point of its wall,
  steep face and tail side planes, so every face is planar.
- Upper faces, slope from horizontal: per side a wing face (nose, wing tip,
  shoulder) at 23.7 degrees, a steep face (shoulder, wing tip, corner, apex) at
  45.5, the wall (wing tip, notch, corner) at 76.0 and the tail side (notch,
  rear-face base, apex, corner) at 74.2; the rear face at 76.0; the plate at 0.
  The ridge rises 9.4 degrees from the nose to the shoulder and 34.3 degrees
  from the shoulder to the apex. The steep face is concave at its corner.
- The canopy is a faceted dome on the two wing faces, its rear edge at the
  shoulder: plan semi-axes 9 across and 9 along, centre at local Y -3, 16
  segments and rings at 0, 30, 60 and 90 degrees (the top ring meets at the
  crown). The base ring lies on the wing faces; the crown is level at z 8.81,
  2.8 above the ridge at the centre, and each ring rises `sin(latitude)` of the
  way from the hull surface to the crown, so the glass sits mostly flat. The 0
  to 30 degree ring is the canopy side colour and the rest the roof colour. Per
  heading, the two facets whose world normals best face the light
  `(-0.25, 0.45, 1)` take the highlight colour, so the highlight stays upper
  left on screen.
- The canopy stays opaque: a clear canopy reads as grey at 42px and loses the
  blue accent.
- A canopy-roof-coloured underlay with the canopy's projected convex outline
  draws before the facets and hides antialiasing seams between them.
- Shading: upper faces take the hull paint in light order among the visible
  ones, by the same world light. The brightest is the top colour; every other
  face prefers the front side colour at light 0.6 or more and the rear side
  colour below it, and steps to the next tier (darker first, never top) while a
  brighter face it shares an edge with already has that colour, so neighbouring
  planes differ. The plate is always the top colour. Skirt edges 0 and 5 (the
  right wing's trailing and leading edges) take the front side colour, the rest
  the rear side colour.
- Twin subtle blue mouths sit on the walls: `|x|` 9.5 to 15, from 0.3 to 2.6
  above the skirt top, the top kept 0.6 under the wall's top edge, lifted 0.03
  off the wall. Thrust adds pale blue flames 16 units long with 9-unit white
  cores from each mouth's middle, readable at 42px display.
- Draw order, by layer: thrust flames, skirt, wing faces, canopy underlay and
  facets, then the tail faces (steep faces, walls, tail sides, rear face and
  plate), then the mouths. When the rear points away from the viewer (rotated
  `x + y <= 0`), the tail faces draw with the wing faces before the canopy
  instead.
- All faces use one projection. The viewer looks along `-(1, 1, 1)` from
  `+(1, 1, 1)`: outward-normal culling keeps faces whose normal has
  `nx + ny + nz > 0`, and depth `-(x + y + z)` orders faces far to near within
  each component layer.
- No raster assets, filters, strokes, external dependencies or screen rotation.

## Paint schemes

Ship paint sets five colours: the hull top, front sides and rear sides (the
three hull tiers, assigned per heading by the [shading](#ship-geometry) rule,
and skirt edges 0 and 5 front, the rest rear), the canopy roof and the canopy
sides. The canopy highlight is derived: the roof colour
mixed 45 percent toward white per channel. Engine mouths `#64caff`, thrust
flames and speed jets are the same on every scheme. Geometry, culling and draw
order are shared, so each painted frame has exactly the polygons of the matching
Classic frame.

| Scheme   | Price | Top       | Front sides | Rear sides | Canopy roof | Canopy sides | Highlight |
| -------- | ----: | --------- | ----------- | ---------- | ----------- | ------------ | --------- |
| Classic  |     0 | `#ffffff` | `#d4dfe9`   | `#abbfce`  | `#2585d0`   | `#1767b3`    | `#87bce5` |
| Cobalt   |    50 | `#6f9ff0` | `#4f7fd0`   | `#3a62a8`  | `#eef5ff`   | `#b4c8e6`    | `#f6faff` |
| Seafoam  |    50 | `#d4f6ea` | `#a7dcc9`   | `#80bba8`  | `#14697a`   | `#0d4c59`    | `#7eadb6` |
| Graphite |    50 | `#aab2c4` | `#858ea4`   | `#666f86`  | `#59d0ff`   | `#2a92cc`    | `#a4e5ff` |
| Iris     |    50 | `#d9ccff` | `#b2a0ec`   | `#8f7cd0`  | `#3a2b8c`   | `#271c66`    | `#938ac0` |

- Classic is the free default and is the `ship-{0..31}.svg` set.
- Other schemes export idle frames only:
  `paint/{cobalt,seafoam,graphite,iris}/ship-{0..31}.svg`. Draw speed jets
  behind them exactly as for Classic. There are no painted thrust frames.
- `ship-paint.json` (version 1) lists every scheme in shop order with `id`,
  `name`, `price` and the six colours as `top`, `frontSides`, `rearSides`,
  `canopyRoof`, `canopySides` and the derived `canopyHighlight`. Gameplay owns
  the player-facing names.
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

`ship-jets.json` (version 1) drives jets that scale continuously with speed. The
renderer draws them behind the idle `ship-{index}` frame; there are no jet frames.

- `f` is current speed as a fraction of max speed. No jet at `f = 0`.
- Jet length in ship units: `length.base + length.scale * f ^ length.exponent`
  (6 + 24 f²): about 2-3px at f = 0.25 and 13px at max on the 42px display.
- `headings` holds all 32 ship headings, `headings[k].index` = `k`. Per
  heading, each of the two `mouths` gives frame-px values in the 96 by 96
  frame: `anchor` (projected middle of the mouth on its wall, local
  (±12.25, 17.39, 2.60)), `axis` (projected rear
  direction per ship unit) and `half` (projected half mouth width along the
  trailing edge, local (±2.75, 0.83, 0)). Scale them
  with the ship's display size.
- Per mouth, draw one filled triangle per `layers` entry in order (halo, outer,
  core): base `anchor ± half * width`, tip `anchor + axis * jetLength * length`.
- Colour is `color`, or `colors` interpolated linearly in sRGB by `f`. The halo
  alpha is `max(0, (f - from) / (to - from)) * max`, skipped at zero; other layers
  are opaque.

## Nose

`ship-nose.json` (version 1) gives the point shots leave from. The manifest
links it as `shipNose`.

- `frame` is the frame size in px (96) and `displayScale` the display px per
  frame px (0.4375, 42 / 96).
- `noses[k]` is `[x, y]` in frame px for heading `k`, 32 entries: the hull's
  forward tip at the skirt top, local (0, -32, 1.2), projected like the frames, so it is the drawn
  tip vertex of `ship-k`. Its offset from the pivot (48, 48) times
  `displayScale` gives display px from the ship's position.
