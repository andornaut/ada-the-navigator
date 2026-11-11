# Ship geometry

- Rebuild with `node art/tools/ship.ts` when resources are available.
  The single module uses Node builtins and writes directly to `public/art/`.
- Exports: `ship-{0..15}.svg`, `ship-thrust-{0..15}.svg`, `ship-jets.json`,
  and the [paint schemes](#paint-schemes).
  `ship.svg` and `ship-thrust.svg` are byte-identical aliases of index 10 (up).
- Transparent 96 by 96 viewport, pivot (48, 48), display 42 by 42.
  Keep the viewport intact and render the selected frame with rotation zero.
- Heading index is normalized `round(atan2(world.y, world.x) / (PI / 8))` modulo 16,
  in 22.5 degree steps. Even indices project down-right (0), down (2),
  down-left (4), left (6), up-left (8), up (10), up-right (12) and right (14);
  odd indices fall between them.
- Local forward is negative Y. Rotate the solid model into world heading before
  projecting `screenX = (x - y) * sqrt(3) / 2` and
  `screenY = (x + y) / 2 - z`, then add the viewport pivot.
- Compact delta A uses one continuous filled white hull with two rear wing
  corners and a small vertical triangular tail. The six-point hull and large
  six-point opaque blue canopy match the selected plan coordinates at scale 0.32:
  `localX = planY * 0.32`, `localY = planX * 0.32`. Reversing mapped vertex
  order preserves counterclockwise top winding.
- Hull thickness is 4 units. The canopy uses its full selected hexagonal footprint,
  a flat roof 3.5 units above the hull and darker blue vertical sides. No interior,
  seams or panel detail. The canopy size follows the selected profile directly.
- Twin subtle blue mouths follow the rear wing edges near their outer corners.
  Thrust adds pale blue flames 16 units long with 9-unit white cores, readable at
  42px display. Hull sides precede the continuous hull top;
  canopy sides precede its roof. The tail draws after the canopy when the rear
  points toward the viewer (rotated `x + y > 0`), otherwise before it.
- All faces use one projection. The viewer looks along `-(1, 1, 1)` from
  `+(1, 1, 1)`: outward-normal culling keeps faces whose normal has
  `nx + ny + nz > 0`, and depth `-(x + y + z)` orders faces far to near within
  each component layer.
- No raster assets, filters, strokes, external dependencies or screen rotation.

## Paint schemes

Ship paint recolours five faces: the hull top and tail, the front side faces
(hull edges 0 and 5), the rear side faces, the canopy roof and the canopy
sides. Engine mouths `#64caff`, thrust flames and speed jets are the same on
every scheme. Geometry, culling and draw order are shared, so each painted
frame has exactly the polygons of the matching Classic frame.

| Scheme   | Price | Top       | Front sides | Rear sides | Canopy roof | Canopy sides |
| -------- | ----: | --------- | ----------- | ---------- | ----------- | ------------ |
| Classic  |     0 | `#ffffff` | `#d4dfe9`   | `#abbfce`  | `#2585d0`   | `#1767b3`    |
| Cobalt   |    50 | `#6f9ff0` | `#4f7fd0`   | `#3a62a8`  | `#eef5ff`   | `#b4c8e6`    |
| Seafoam  |    50 | `#d4f6ea` | `#a7dcc9`   | `#80bba8`  | `#14697a`   | `#0d4c59`    |
| Graphite |    50 | `#aab2c4` | `#858ea4`   | `#666f86`  | `#59d0ff`   | `#2a92cc`    |
| Iris     |    50 | `#d9ccff` | `#b2a0ec`   | `#8f7cd0`  | `#3a2b8c`   | `#271c66`    |

- Classic is the free default and is the existing `ship-{0..15}.svg` set,
  unchanged.
- Other schemes export idle frames only:
  `paint/{cobalt,seafoam,graphite,iris}/ship-{0..15}.svg`. Draw speed jets
  behind them exactly as for Classic. There are no painted thrust frames.
- `ship-paint.json` (version 1) lists every scheme in shop order with `id`,
  `name`, `price` and the five colours as `top`, `frontSides`, `rearSides`,
  `canopyRoof` and `canopySides`. Gameplay owns the player-facing names.
- Manifest entries `ship-{scheme}-{N}` follow the ship entries and copy
  `ship-N`'s fields, with their own `path` and a `paint` field holding the
  scheme id. Classic frames have no `paint` field. Select by `paint` and
  `directionIndex`; a lookup by `ship-` prefix alone must exclude entries with
  `paint`.
- `art/tools/ship.ts` writes the frames, `ship-paint.json` and the paint
  manifest entries, replacing any earlier paint entries.

## Speed jets

`ship-jets.json` (version 1) drives jets that scale continuously with speed. The
renderer draws them behind the idle `ship-{index}` frame; there are no jet frames.

- `f` is current speed as a fraction of max speed. No jet at `f = 0`.
- Jet length in ship units: `length.base + length.scale * f ^ length.exponent`
  (6 + 24 f²): about 2-3px at f = 0.25 and 13px at max on the 42px display.
- Per heading, each of the two `mouths` gives frame-px values in the 96 by 96
  frame: `anchor` (projected mouth midpoint at z = 2), `axis` (projected rear
  direction per ship unit) and `half` (projected half mouth width). Scale them
  with the ship's display size.
- Per mouth, draw one filled triangle per `layers` entry in order (halo, outer,
  core): base `anchor ± half * width`, tip `anchor + axis * jetLength * length`.
- Colour is `color`, or `colors` interpolated linearly in sRGB by `f`. The halo
  alpha is `max(0, (f - from) / (to - from)) * max`, skipped at zero; other layers
  are opaque.
