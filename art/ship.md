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
- Exports: `ship-{0..63}.svg`, `ship-thrust-{0..31}.svg`, `ship-jets.json`,
  `ship-nose.json` and the [paint schemes](#paint-schemes). Frames, jets and
  nose all derive from the one model, so a model change regenerates them
  together.
  `ship.svg` and `ship-thrust.svg` are byte-identical aliases of index 20 (up).
- Transparent 96 by 96 viewport, pivot (48, 48), display 42 by 42.
  Keep the viewport intact and render the selected frame with rotation zero.
- The ship has 64 headings from the shared player heading contract; enemy
  craft keep 16. Enemy heading `k` faces ship heading `4k`. World heading `k`
  is `k * 360 / 64` degrees. Quantization uses normalized
  `round(atan2(world.y, world.x) / (PI / 32))` modulo 64, retaining the nearest
  sample tie rule. Movement and aim stay continuous.
- The isometric projection makes screen angles uneven. World quarter turns are
  indices 0, 16, 32 and 48; screen down, left, up and right are 8, 24, 40 and 56.
  These projected forward angles are clockwise from screen right, with screen
  y down; the fixed nose height is excluded from the angle table.

| Index |   World | Screen | Index |   World | Screen |
| ----: | ------: | -----: | ----: | ------: | -----: |
|     0 |       0 |   30.0 |    32 |     180 |  210.0 |
|     1 |   5.625 |   35.1 |    33 | 185.625 |  215.1 |
|     2 |   11.25 |   40.8 |    34 |  191.25 |  220.8 |
|     3 |  16.875 |   47.2 |    35 | 196.875 |  227.2 |
|     4 |    22.5 |   54.3 |    36 |   202.5 |  234.3 |
|     5 |  28.125 |   62.3 |    37 | 208.125 |  242.3 |
|     6 |   33.75 |   71.0 |    38 |  213.75 |  251.0 |
|     7 |  39.375 |   80.3 |    39 | 219.375 |  260.3 |
|     8 |      45 |   90.0 |    40 |     225 |  270.0 |
|     9 |  50.625 |   99.7 |    41 | 230.625 |  279.7 |
|    10 |   56.25 |  109.0 |    42 |  236.25 |  289.0 |
|    11 |  61.875 |  117.7 |    43 | 241.875 |  297.7 |
|    12 |    67.5 |  125.7 |    44 |   247.5 |  305.7 |
|    13 |  73.125 |  132.8 |    45 | 253.125 |  312.8 |
|    14 |   78.75 |  139.2 |    46 |  258.75 |  319.2 |
|    15 |  84.375 |  144.9 |    47 | 264.375 |  324.9 |
|    16 |      90 |  150.0 |    48 |     270 |  330.0 |
|    17 |  95.625 |  154.6 |    49 | 275.625 |  334.6 |
|    18 |  101.25 |  158.9 |    50 |  281.25 |  338.9 |
|    19 | 106.875 |  162.8 |    51 | 286.875 |  342.8 |
|    20 |   112.5 |  166.6 |    52 |   292.5 |  346.6 |
|    21 | 118.125 |  170.1 |    53 | 298.125 |  350.1 |
|    22 |  123.75 |  173.4 |    54 |  303.75 |  353.4 |
|    23 | 129.375 |  176.7 |    55 | 309.375 |  356.7 |
|    24 |     135 |  180.0 |    56 |     315 |  360.0 |
|    25 | 140.625 |  183.3 |    57 | 320.625 |    3.3 |
|    26 |  146.25 |  186.6 |    58 |  326.25 |    6.6 |
|    27 | 151.875 |  189.9 |    59 | 331.875 |    9.9 |
|    28 |   157.5 |  193.4 |    60 |   337.5 |   13.4 |
|    29 | 163.125 |  197.2 |    61 | 343.125 |   17.2 |
|    30 |  168.75 |  201.1 |    62 |  348.75 |   21.1 |
|    31 | 174.375 |  205.4 |    63 | 354.375 |   25.4 |

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
  off the wall. Compatibility thrust exports retain the authored 16-unit outer length and
  use the canonical three layers through the shared projected geometry helper.
  Their visible group attaches at the selected wing corner with the core outboard;
  aperture enlargement does not scale the flames.
- All faces use one projection. The viewer looks from `+(1, 1, 1)`;
  outward normals determine visibility, and geometric depth partitioning handles
  overlap for ordinary, rolled and stretched poses. Raster generators sample
  the same ordered fragments at pixel centres before supersampling reduction.
- SVG exports contain vector paths, with no embedded raster image, filter or
  screen rotation. The shared source also generates the aboard and icon PNGs.

## Paint schemes

Ship paint assigns a fixed material to each hull facet role, the skirt and the
opaque canopy. Classic uses white wings, steep panels `#929ca3`, rear panels
`#28558a` and skirt `#abbfce`. Other paints use fixed linear-luminance references
`#b2bec6`, `#647d8d` and `#abbfce` for those three tiers relative to their own top hue. Rear booster walls use the scoped `engineHousing` material; luminous mouths use
`engineOpening`. Canopy sides, tail, kink, skirt and hull keep their own materials.
Engine surfaces do not recolour flame layers.

| Scheme  | Top       | Canopy roof | Canopy sides |
| ------- | --------- | ----------- | ------------ |
| Classic | `#ffffff` | `#2585d0`   | `#1767b3`    |
| Cobalt  | `#6f9ff0` | `#eef5ff`   | `#b4c8e6`    |
| Seafoam | `#d4f6ea` | `#14697a`   | `#0d4c59`    |
| Crimson | `#d96b73` | `#382a32`   | `#251d24`    |
| Iris    | `#d9ccff` | `#3a2b8c`   | `#271c66`    |
| Amber   | `#f4b665` | `#24577b`   | `#173a57`    |

- Crimson retains the stable `graphite` id and asset paths.
- Classic is free and is the `ship-{0..63}.svg` set. Other schemes use
  Gameplay's purchase-order prices; Art does not assign a fixed scheme price.
- Other schemes export idle frames only:
  `paint/{cobalt,seafoam,graphite,iris,amber}/ship-{0..63}.svg`. Draw speed jets
  as for Classic. There are no painted thrust frames.
- `ship-paint.json` version 1 lists these six schemes in order, with `id`,
  `name`, `top`, `frontSides`, `rearSides`, `skirt`, `canopyRoof`, `canopySides`,
  `engineHousing`, `engineOpening` and the derived compatibility colour `canopyHighlight`. Highlight metadata
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
  `shipNose` link. `--data-only` writes only the jet and paint JSON, without
  generating frames, collision or manifest entries. `--paint-only` writes
  `ship-paint.json` and the five purchased paint frame sets, without changing
  Classic frames, jets, collision or manifest entries.

### Engine housing and opening materials

`engineMaterials` derives engine surfaces from each paint's unchanged
`canopySides`. Housing adds 0.055 to the glazing's Oklab lightness and uses
0.92 times its chroma at the same hue. Housing conversion clips to sRGB and
rounds half to even.

Every opening targets Classic `#86deff`'s measured Oklab lightness
`Lref = 0.8569375081` and chroma `Cref = 0.0963169227`. Opening hue is Classic's
opening hue plus the paint glazing's hue difference from Classic glazing.
Let `q = (Lref - LhousingClassic) / (1 - LhousingClassic) = 0.6717177581`.
Opening lightness is `max(Lref, Lhousing + (1 - Lhousing) * q)`: this keeps an
opening brighter than its housing, including Cobalt's pale housing. There are
no per-paint brightness or chroma controls.

The published colour helper maps openings into sRGB by reducing chroma at
fixed lightness and hue in 24 steps, then rounds bytes nearest, ties upward.
Cobalt, Crimson and Iris reach their hue's gamut boundary below `Cref`.
Classic retains its exact `#86deff` bytes. The table records the resulting
in-gamut colours and measured Oklab values.

The luminous aperture is enlarged
1.25 times in both in-plane dimensions about its existing centre, increasing
area by 1.5625. Its raised luminous surface is constrained to the projected
housing boundary at grazing views. Jet hardpoints, widths and lengths
derive from the unchanged base opening; the luminous-aperture scale is not
applied to flames or hull geometry.

| Scheme  | Housing   | Opening   | Housing Oklab L / C | Opening Oklab L / C |
| ------- | --------- | --------- | ------------------- | ------------------- |
| Classic | `#3578bf` | `#86deff` | 0.5642 / 0.1295     | 0.8569 / 0.0963     |
| Cobalt  | `#c7daf6` | `#e4f6ff` | 0.8830 / 0.0438     | 0.9625 / 0.0225     |
| Seafoam | `#275b67` | `#80e5db` | 0.4411 / 0.0583     | 0.8577 / 0.0963     |
| Crimson | `#322a31` | `#dac3ff` | 0.2966 / 0.0169     | 0.8563 / 0.0854     |
| Iris    | `#342e72` | `#b0d3ff` | 0.3485 / 0.1131     | 0.8565 / 0.0721     |
| Amber   | `#294964` | `#82e0fa` | 0.3934 / 0.0596     | 0.8577 / 0.0962     |

## Heading package

The pure `src/model/shipHeadingContract.ts` owns the player sample count and
contract version. Art projection re-exports that contract. The active core
manifest, nose/collision, main jets, retro jets, title and quantum data require
`shipHeadings: { count: 64, version: 2 }`; their root and generic geometry
versions remain 1. These artifacts are consumed together. A stale descriptor,
missing index, duplicate index or wrong array count invalidates the player set.
The six paint materials are independent of heading indices. Warp pose geometry
keeps its single local heading 0 under the quantum data's player descriptor.

The unused yellow retro archive remains a historical version 1, 32-heading
file. It is not an active player fallback. Enemy and other craft heading sets
remain independent at 16.

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
- `headings` holds all 64 ship headings, `headings[k].index` = `k`. Per
  heading, each of the two `mouths` gives frame-px values in the 96 by 96
  frame: `anchor` (legacy projected opening middle), `outerCorner` (the visible wing
  corner controlling the whole group), `coreOutboard: true`, `axis` (projected rear
  direction per ship unit) and `half` (projected half mouth width along the
  trailing edge, local (±2.75, 0.83, 0)). Scale them
  with the ship's display size.
- At the current speed, find the widest selected layer with positive alpha and
  set the common group anchor to `outerCorner - half * visibleWidth`. Every
  layer receives the same group translation. Near wings attach to the actual
  skirt-bottom corner at model z = 0; far wings retain the upper corner at
  z = 1.2. Nearness follows the rotated model's viewer depth. Equal-depth wings
  share the same lower attachment.
- Draw halo, outer and core in their canonical order with unchanged widths,
  lengths, colours and alpha. The approved outboard-core arrangement adds
  `half * min(outer.width - core.width,
outer.width * (1 - core.length / outer.length))` to the core's centre only.
  This is 0.72 half-mouth units for the canonical layers. The core remains
  contained by the outer triangle, with the darker band toward the hull.
- Forward groups have no `rearClip`. The canonical opaque hull occludes them;
  title occluders describe actual nearer hull fragments at the new group plane.
- Colour is `color`, or `colors` interpolated linearly in sRGB by `f`. The halo
  alpha is `max(0, (f - from) / (to - from)) * max`, skipped at zero; other layers
  are opaque.
- `engineLevels` holds the layers for each engine level, `level` 1 to 3: draw
  Ada's jets in her level's `layers`. Only the colours change; widths, lengths
  and the halo's alpha ramp are the same at every level, on every paint scheme.

| Engine level | `halo.color` | `outer.colors`       | `core.colors`        |
| -----------: | ------------ | -------------------- | -------------------- |
|      1, base | `#70ace8`    | `#5b93cc`, `#b9ecff` | `#8cc4f0`, `#ffffff` |
|       2, red | `#e34a3c`    | `#a62c22`, `#e74b35` | `#f0895d`, `#ffcab0` |
|     3, amber | `#e3b13f`    | `#b77d22`, `#e8ba3c` | `#f3d46c`, `#fff0a6` |

On a light field the jets take `lightField.jets.shipLevels` in
[galaxies.json](../public/art/galaxies.json) for the same level
([Light fields](galaxies.md#light-fields)).

Light fields keep Engine 1 blue. Engine 2 uses outer `#9e3027`, core
`#cf4935` to `#ee7960`; Engine 3 uses outer `#91620e`, core `#d49b22` to
`#f2cf62`. Both use the existing two-layer geometry without a halo.

### Retro jets

`node art/tools/ship-retro-jets.ts` writes `ship-retro-jets.json`, using the
version 1 engine-jet geometry with all 64 headings in the same 96 px frame
and pivot as the ship. Its compatibility `engineLevels` derive from the
same `JET_LEVELS` source as `ship-jets.json`.

Every paint uses the exact main-exhaust layers selected for its Engine level
and field: the forward engine material on dark fields, or the corresponding
`lightField.jets.shipLevels` entry on light fields. The consumer applies that
same layer array to retro geometry; paint does not define another exhaust
palette.

`retroMouthAxis` derives each wing's half-mouth vector `(±2.75, 0, 0)`
and forward/outward unit direction `(±sin(10°), -cos(10°), 0)`.
`jetAttachment` selects the same near underside or far upper corner as the
forward group, at model x/y `(±21.44, 20.48)`. Each mouth's `outerCorner`
is this selected point projected into its heading frame. The common anchor
uses the widest currently visible selected layer, including a visible halo.
`coreOutboard` applies the same contained outboard-core geometry as forward
exhaust. The compatibility `anchor` uses the base engine's full-speed width.

All layers, including the halo, stop at the wing's rear tip-to-notch plane.
With side `sign` equal to -1 or 1 and local positive Y pointing rearward, keep
`y - 0.3 * sign * x <= 14.048`. Each mouth's `rearClip` expresses this as
`dot(normal, framePoint) <= constant` in heading-frame pixels. The producer
calibrates the plane to the same rounded half/direction basis as the jet
triangles. Apply it consistently through the jet display's pivot and scale;
the selected visible attachment corner remains fixed. Only the portion behind
this true rear boundary is removed; there is no additional attachment crop.

The retro length curve is `6.6 + 26.4 f²`, 1.10 times the main curve.
Layer widths, relative lengths, colours and alpha ramps come from the selected
main material. Retro rendering adds no wing-edge ink. Actual backward velocity
relative to facing selects retro jets with the existing motion threshold;
forward motion and reduced-motion behavior retain their contracts. Forward
attachment uses the shared visible-corner rule without retro trimming.

`ship-retro-jets-yellow.json` is a static archive and is not rewritten by the
active producer. It is not a Settings toggle.

## Nose

`ship-nose.json` (version 1) gives the point shots leave from. The manifest
links it as `shipNose`.

- `frame` is the frame size in px (96) and `displayScale` the display px per
  frame px (0.4375, 42 / 96).
- `noses[k]` is `[x, y]` in frame px for heading `k`, 64 entries: the hull's
  forward tip at the skirt top, local (0, -32, 1.2), projected like the frames, so it is the drawn
  tip vertex of `ship-k`. Its offset from the pivot (48, 48) times
  `displayScale` gives display px from the ship's position.
- `collision[k]` is idle heading `k`'s drawn silhouette, 64 entries in heading
  order: an array of convex parts, each an array of `[x, y]` in frame px, the
  schema of the asteroids' `frames[k].collision`. See [Collision](#collision).

## Collision

The ship collides, makes contact and is placed by its drawn silhouette,
`ship-nose.json` `collision[k]` for heading `k`. Offsets from the pivot
(48, 48) times `displayScale` give display px.

- `art/tools/ship.ts` traces each idle frame's fills with the shared tracer
  (below). The frames have no strokes, so the drawing is not grown. Douglas-Peucker
  runs at 0.5 frame px and retains the 0.98 intersection-over-union floor.
- Paint schemes share the geometry. The generator traces every scheme and fails
  unless all six give the same parts, so the one set serves every paint.
- The parts cover the hull; thrust flames and speed jets have none.
- No heading has a notch tip; the generator fails if one appears.

- Across all64 actual SVGs at 4 px per frame px: 3 to 8 collision parts, minimum intersection over union 0.9821 and maximum boundary distance 0.500 frame px.

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
