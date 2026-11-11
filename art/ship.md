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
  corners, a rounded opaque canopy and a tall vertical fin. The six-point hull
  matches the selected plan coordinates at scale 0.32:
  `localX = planY * 0.32`, `localY = planX * 0.32`. Reversing mapped vertex
  order preserves counterclockwise top winding.
- Hull thickness is 4 units. No interior, seams or panel detail.
- The canopy is a faceted half-ellipsoid on the hull top: semi-axes 9.2 across
  and 12.8 along, centre at local Y -4.2, 5.5 units high, 16 segments and rings
  at 0, 30, 60 and 90 degrees (the top ring meets at the apex). The 0 to 30 degree
  ring is the canopy side colour and the rest the roof colour. Per heading, the
  two facets whose world normals best face the light `(-0.25, 0.45, 1)` take the
  highlight colour, so the highlight stays upper left on screen.
- The canopy stays opaque: a clear canopy reads as grey at 42px and loses the
  blue accent.
- A canopy-roof-coloured underlay with the canopy's projected convex outline
  draws before the facets and hides antialiasing seams between them.
- The fin stands on the rear centreline from local Y 14.5 to 24.2 at the hull top,
  rises to z 12.5 with a 21.5 to 23.6 tip chord, and tapers from 1.2 to 0.6 units
  half thickness. Its flanks carry a roof-coloured leading-edge stripe (base to
  Y 18, tip to Y 22.6); the leading edge and tip are roof colour, the trailing
  edge side colour. The flank lit by the canopy light uses the front side colour,
  the other the rear side colour. The height keeps the fin below the canopy's
  rear edge on screen when the ship points up.
- Twin subtle blue mouths follow the rear wing edges near their outer corners.
  Thrust adds pale blue flames 16 units long with 9-unit white cores, readable at
  42px display. Hull sides precede the continuous hull top; the canopy underlay
  precedes its facets. The fin draws after the canopy when the rear points toward
  the viewer (rotated `x + y > 0`), otherwise before it.
- All faces use one projection. The viewer looks along `-(1, 1, 1)` from
  `+(1, 1, 1)`: outward-normal culling keeps faces whose normal has
  `nx + ny + nz > 0`, and depth `-(x + y + z)` orders faces far to near within
  each component layer.
- No raster assets, filters, strokes, external dependencies or screen rotation.

## Paint schemes

Ship paint sets five colours: the hull top, the front side faces (hull edges 0
and 5 and the lit fin flank), the rear side faces (and the shaded fin flank), the
canopy roof (with the fin stripe, leading edge and tip) and the canopy sides
(with the fin trailing edge). The canopy highlight is derived: the roof colour
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

- Classic is the free default and is the `ship-{0..15}.svg` set.
- Other schemes export idle frames only:
  `paint/{cobalt,seafoam,graphite,iris}/ship-{0..15}.svg`. Draw speed jets
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
