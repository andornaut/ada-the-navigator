# Ship drawing specification

## Drawing requirements

- Keep the canonical bilateral hull and tail geometry, proportions, silhouette,
  edge and 1.2 unit skirt. No wall, rim, collar, nozzle ring, outline or line
  runs along the hull edge or round any part. Size, hit circle, nose point and
  jet behaviour stay with Gameplay.
- One light from the upper left, fixed in the view, picks every flat tone
  ([Light and tones](#light-and-tones)). This supersedes materials fixed by
  facet role independent of the view: a facet's tone now follows the light, so
  the two wing tops differ by one soft step and no hard line runs down the ridge.
- The canopy is a clean bubble with a highlight and a soft shade step, with no
  dark dot, line, notch or seam at any of the 64 headings.
- The wing-tip caps carry each paint's accent colour; the tail block behind the
  canopy takes a blue-grey hull shade; the rear is calm, with hull-toned walls
  and plain cyan mouths.
- All six paints derive from one solid and one rule set. Paint changes do not
  duplicate geometry or alter collision.
- Render 64 player headings from the one model and heading contract, with the
  documented frame, pivot and collision alignment. Enemy craft retain 16 headings.
- Exhaust is a teardrop plume in three flat tones rooted on the engine mouths:
  a dark halo round the flame and its core ([Speed jets](#speed-jets)). The
  halo draws only on the 42 px flight sprite, never on the start screen, app
  icon, jump poses or other large renders, and always under the hull, so it
  covers no hull, skirt or tail pixel. This
  supersedes the three nested triangles and the rule that dropped the core at
  a display size of 42 px or less: the core draws at every size. Every title, warp, map and flight
  consumer draws the same plume from the same projected roots.
- A plume is a round flame about its axis: it shows its silhouette across the
  projected axis and takes its depth on its centre line. The hull draws over
  reverse plumes; the hull nearer than a forward plume draws over it. Jets
  take no keyline.

## Model consumers

A model or paint change regenerates all of these, in this order:

| Consumer                                 | Producer                            | Output                                                                                           |
| ---------------------------------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------ |
| 64 headings, six paints, nine jump poses | `node art/tools/ship.ts`            | `ship-materials.json`, `ship-paint.json` and the 385 logical manifest entries                    |
| Collision and nose                       | `node art/tools/ship.ts`            | `ship-nose.json`                                                                                 |
| Forward plumes                           | `node art/tools/ship.ts`            | `ship-jets.json`                                                                                 |
| Reverse plumes                           | `node art/tools/ship-retro-jets.ts` | `ship-retro-jets.json`                                                                           |
| Light-field plume colours                | `node art/tools/galaxies.ts`        | `galaxies.json` `lightField.jets.shipLevels`                                                     |
| App icon                                 | `node art/tools/app-icon.ts`        | `app-icon/` ([app icon](app-icon.md))                                                            |
| Aboard scenes                            | `node art/tools/aboard.ts`          | `aboard.svg`, `aboard-emergency.svg`, `aboard-holodisk-{0..3}.svg` ([aboard](aboard.md))         |
| Jump pose plumes                         | `node art/tools/quantum-jump.ts`    | `quantum-jump.json` `warp.poses[].jets` ([quantum jump](quantum-jump.md#warp-ship))              |
| Galaxy preview cards                     | `node art/tools/galaxy-previews.ts` | `previews/card-{galaxy}.png` and `-locked` ([preview cards](galaxies.md#preview-cards))          |
| Title screen ship                        | `node art/tools/title-screen.ts`    | `title-screen.json` `ship.jetLengthScale` and `ship.jetMouths` ([title screen](title-screen.md)) |

- `art/tools/ship-check.ts` and `art/tools/ship-materials-check.ts` pin the
  model, paints, slots, plumes and published data
  (`node --test art/tools/ship-check.ts art/tools/ship-materials-check.ts`).
- `node art/tools/ship-contact-sheet.ts <directory>` draws review sheets from
  the published data: all 64 headings idle and at full thrust, the six paints,
  the jets by Engine level and the canopy at every heading, on a light field
  and on Phantom, each with the ink keyline.
- Runtime tests that read the ship art: `shipMaterials`, `shipArt`,
  `shipHeading64`, `shipJets`, `staticShipJets`, `reverseJets`, `retroClip`,
  `retroProfile`, `normalAperture`, `normalMaterialPolicy`, `normalJetDepth`,
  `smallShipJetCore`, `engineGroup`, `shipJetKeyline`, `lightFieldKeylines`,
  `lightField`, `quantumJump`, `decorationAssets`, `conversationBox`,
  `collisionData`, `nose` and `shipBody` under `src/`.

## Canonical exports and geometry

- Rebuild with `node art/tools/ship.ts` when resources are available. It uses
  Node builtins and writes data directly to `public/art/`. Classic, purchased
  paints and jump poses resolve from shared material geometry.
- The model is [ship-model.ts](tools/ship-model.ts), a module with no side
  effects: `drawn(pivot, paint, pose)` returns a pose's polygons in draw order.
  Every ship drawing imports it rather than copying the geometry:
  [ship.ts](tools/ship.ts), the [aboard backdrop](aboard.md), the
  [quantum jump](quantum-jump.md#warp-ship) and the [app icon](app-icon.md)
  ([Model consumers](#model-consumers)).
- A pose is a heading (`yaw`) and `thrust`, plus optional `roll` (degrees
  about the hull's forward axis), `stretch` along the hull and `squash` across
  it, about the pivot and before the heading turn. Sprite frames use the bare
  heading, so their numbers are the heading rotation's exactly.
- Exports include `ship-materials.json`, `ship-jets.json`, `ship-nose.json` and
  the [paint schemes](#paint-schemes). Hulls, jets and nose derive from the same
  model. Thrust uses the idle hull with procedural jet geometry. The manifest
  retains the logical `ship` alias at heading 40.
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
  apex. The climb starts 2 units behind the canopy's rear edge, so no tail face
  covers the canopy in any view, so the top of the rear triangle reads as a small white tail. No fin.
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
| Shoulder  | (0, 9, 10.16)        | Ridge kink behind the canopy              |
| Apex      | (0, 17, 16.5)        | Rear-centre top                           |
| Corners   | (±4.46, 13.17, 9.71) | Where wall, steep face and tail side meet |

- The ridge runs from the nose through (0, 6, 9.5); the shoulder is the point
  on it 2 units behind the canopy's rear edge, local Y 9, so the wing tops keep
  their plane and no steep face, tail side or rear wall covers any canopy
  pixel at the 64 headings or in the nine jump poses (`ship-check.ts` counts
  them at 8 samples per frame px).

- The notches lie ahead of the apex, so no single rear face can rise from the
  notched outline to the apex without overhanging. The rear splits into planar
  faces instead: per side a wall from the trailing edge (wing tip to notch) at
  the 76 degree lean, up to its corner, and a tail side from the notch up to the
  corner and the apex and down to the tail tip. The two tail sides meet on one
  straight ridge from the apex to the tail tip, 64.4 degrees from horizontal, so
  the tail is a sharp wedge from behind. Each corner is the common point of its
  wall, steep face and tail side planes, so every face is planar.
- The tail apex and shoulder are on local X 0. Each left corner is the exact
  reflection of its right corner, preserving the original notches and outer plan.
- The canopy is a closed bubble on an elliptical plan, semi-axes 8.8 across
  and 10 along the hull, centred at local Y -3, its crown 4.4 units above the
  ridge. It sits 0.6 above the ridge on a saddle that falls 0.62 of the wing's
  slope across the hull, and carries its own lower envelope 0.5 units deep, so
  its outline does not follow the roof crease. The lip's bottom stays 0.1
  above the ridge at the canopy's tips and above the wing tops elsewhere, so
  no hull face cuts a nick into the canopy's outline at any heading or pose. The surface samples 72 angular
  positions and 14 rings; the crown inside 0.3 of the radius is one planar face.
- The tip caps are the wing tips themselves: everything outboard of the chord
  at local `|x| = 15.4`, parallel to the hull axis, the outer 28 percent of the
  21.44 unit half span. A cap runs to the tip and both edges and includes its
  edge faces: the wing top, the skirt along the leading and trailing edges,
  the rear wall and the sliver of the steep face that reaches the tip, all
  outboard of the chord. No geometry is added.
- The tail block is both tail sides and the part of each steep face inboard of
  the notch, `|x| <= 5.44`.
- Surface-plane partitioning orders visible vector fragments by depth, so the
  canopy, hull and tail occlude each other exactly; consecutive equal fills
  share compound SVG paths, so internal tessellation edges do not form seams.
- One plain cyan mouth sits on each rear wall: `|x|` 8.8 to 15.7, from 0.3 to
  2.8 units up the wall above the skirt top, kept 0.35 inside the wall's edges
  and lifted 0.05 off it. No frame or housing.
- All faces use one projection. The viewer looks from `+(1, 1, 1)`;
  outward normals determine visibility, and geometric depth partitioning handles
  overlap for ordinary, rolled and stretched poses. Raster generators sample
  the same ordered fragments at pixel centres before supersampling reduction.
- SVG exports contain vector paths, with no embedded raster image, filter or
  screen rotation. The frames' coordinates carry two decimals
  ([SVG output](README.md#svg-output)); the shared path table keeps four. The shared source also generates the aboard and icon PNGs.

## Light and tones

One light from the upper left, fixed in the view: `(-0.2, 0.5, 0.84)`
normalised, in world axes with the viewer at `+(1, 1, 1)`. Flat tones only.
Rolled and stretched jump poses take the same light on their posed faces.

| Tone       | Rule                                                                     |
| ---------- | ------------------------------------------------------------------------ |
| Lit top    | Face normal with z above 0.6 and `normal . light >= 0.60`                |
| Turned top | Face normal with z above 0.6 and `normal . light < 0.60`                 |
| Left wall  | Other faces whose normal has `y >= x` in world axes (facing screen left) |
| Right wall | Other faces (facing screen right)                                        |

| Surface              | Faces                                                               | Slots                                                 |
| -------------------- | ------------------------------------------------------------------- | ----------------------------------------------------- |
| Wing tops            | The two wing-top faces inboard of the tip caps                      | `top`, `topTurned`                                    |
| Outboard steep faces | Steep faces outboard of the notch                                   | `wallLeft`, `wallRight`                               |
| Rear walls           | The leaning walls above the trailing edges, inboard of the tip caps | `wallLeft`, `wallRight`                               |
| Tail block           | Both tail sides and the steep faces inboard of the notch            | `tailLeft`, `tailRight`                               |
| Tip caps             | Tops and edge faces outboard of the chord                           | `accent`, `accentTurned`, `accentLeft`, `accentRight` |
| Skirt                | The 1.2 unit vertical band inboard of the tip caps                  | `skirt`                                               |
| Engine mouths        | One rectangle per rear wall                                         | `engineOpening`                                       |
| Canopy               | Bands of the smooth bubble                                          | `canopyHighlight`, `canopyRoof`, `canopyShade`        |

Canopy bands come from the smooth surface normal, so their edges are curves:
highlight where `normal . light >= 0.93`, shade where it is below 0.36, roof
between.

## Paint schemes

| Paint    | Hull lit  | Hull turned | Left wall | Right wall | Tail left | Tail right | Skirt     | Mouth     |
| -------- | --------- | ----------- | --------- | ---------- | --------- | ---------- | --------- | --------- |
| Classic  | `#ffffff` | `#ebf1f7`   | `#b4c4d6` | `#8497ae`  | `#6d829d` | `#445a76`  | `#abbfce` | `#86deff` |
| Cobalt   | `#6f9ff0` | `#6997e4`   | `#557bbb` | `#426195`  | `#314a73` | `#20314f`  | `#5074b1` | `#e4f6ff` |
| Obsidian | `#282d36` | `#252a33`   | `#1d2128` | `#15181d`  | `#0d1014` | `#06080b`  | `#1b1e25` | `#ffd4c0` |
| Crimson  | `#d96b73` | `#ce656d`   | `#a95258` | `#863f45`  | `#672f33` | `#461e21`  | `#a04d53` | `#dac3ff` |
| Iris     | `#8455bf` | `#7d50b5`   | `#664094` | `#4f3175`  | `#3c245a` | `#27163d`  | `#603c8c` | `#b0d3ff` |
| Amber    | `#f4b665` | `#e8ad60`   | `#be8d4d` | `#976f3c`  | `#75552c` | `#503a1c`  | `#b48548` | `#82e0fa` |

| Paint    | Accent lit | Accent turned | Accent left | Accent right | Canopy highlight | Canopy roof | Canopy shade | Glazing reference |
| -------- | ---------- | ------------- | ----------- | ------------ | ---------------- | ----------- | ------------ | ----------------- |
| Classic  | `#2456b8`  | `#2251af`     | `#1a418f`   | `#123271`    | `#6d829d`        | `#445a76`   | `#1f78c3`    | `#1767b3`         |
| Cobalt   | `#16245c`  | `#142257`     | `#0e1a46`   | `#091236`    | `#314a73`        | `#20314f`   | `#d4e1f4`    | `#b4c8e6`         |
| Obsidian | `#aebbc7`  | `#a5b1bd`     | `#87919b`   | `#6a737a`    | `#f3d89d`        | `#eab84d`   | `#d3a042`    | `#b68334`         |
| Crimson  | `#f6efe6`  | `#eae3da`     | `#c0bab3`   | `#98948e`    | `#672f33`        | `#461e21`   | `#2f242c`    | `#251d24`         |
| Iris     | `#e0489f`  | `#d54497`     | `#ae367b`   | `#8a2961`    | `#938ac0`        | `#3a2b8c`   | `#31247b`    | `#271c66`         |
| Amber    | `#12233a`  | `#102137`     | `#0b192b`   | `#071120`    | `#75552c`        | `#503a1c`   | `#1e4a6b`    | `#173a57`         |

- Classic's hull and tail tones are authored. Every other tone is its top
  colour scaled in linear light by the linear luminance of a neutral grey at
  an sRGB step: turned top 0.95, left wall 0.78, right wall 0.62, tail left
  0.48, tail right 0.33. Accent tones take the turned and wall steps from the
  accent. The skirt keeps its linear-luminance reference `#abbfce`.
- The canopy highlight is the roof mixed 45 percent toward white; the shade is
  45 percent of the way from the roof to the glazing reference.
- Each opening derives from its paint's glazing reference: it targets Classic
  `#86deff`'s Oklab lightness `0.8569` and chroma `0.0963`, with Classic's
  opening hue turned by the paint glazing's hue difference from Classic's, and
  reduces chroma at fixed lightness and hue to reach sRGB. Engine surfaces do
  not recolour the plumes.
- Obsidian and Crimson retain the stable `seafoam` and `graphite` ids and asset paths.
- Classic is free and uses the 64 logical `ship-N` entries. Other schemes use
  Gameplay's purchase-order prices; Gameplay owns names and prices.
- Purchased paints use the same geometry and plumes as Classic. Their logical
  paths are `paint/{cobalt,seafoam,graphite,iris,amber}/ship-{0..63}.svg`.
- `ship-paint.json` version 1 lists the six schemes in order, each with `id`,
  `name`, the 15 slot colours above and the glazing reference `canopySides`,
  which is not a slot.
- Manifest entries `ship-{scheme}-{N}` follow the ship entries and copy
  `ship-N`'s fields, with their own `path` and a `paint` field holding the
  scheme id. Classic frames have no `paint` field. Select by `paint` and
  `directionIndex`; a lookup by `ship-` prefix alone must exclude entries with
  `paint`.
- `art/tools/ship.ts` writes ship data and logical frame entries. It replaces the
  ship manifest entries in order: `ship`, the 64 `ship-N` entries, then the
  paint entries. It also sets the manifest's `shipNose` link. `--data-only`
  writes jets, paint and material data. `--paint-only` writes paint data.

## Heading package

The pure `src/model/shipHeadingContract.ts` owns the player sample count and
contract version. Art projection re-exports that contract. The active core
manifest, nose/collision, main jets, retro jets, title and quantum data require
`shipHeadings: { count: 64, version: 2 }`; their root and generic geometry
versions remain 1. These artifacts are consumed together. A stale descriptor,
missing index, duplicate index or wrong array count invalidates the player set.
The six paint materials are independent of heading indices. Warp pose geometry
keeps its single local heading 0 under the quantum data's player descriptor.

The unused yellow retro archive is a version 1, 32-heading file, not an active
player fallback. Enemy and other craft heading sets remain independent at 16.

## Shared material geometry

`node art/tools/ship-materials.ts` writes `public/art/ship-materials.json`
and the core manifest's `shipMaterials` link. The ship and quantum producers
also rebuild it. The version 2 payload retains the canonical 64-heading
descriptor and references the `ship-paint.json` palettes.

`slots` lists the 15 material slots in the order of the
[paint tables](#paint-schemes). All materials are opaque. Antialias coverage
comes from the SVG paths, without per-material bitmap masks.

A shared path table stores exact SVG path data once. Each heading and warp
pose has ordered `draws`, `{ path, slot, alpha }` references, one path per
slot that heading shows. The light moves tones across faces, so the path set
differs per heading. Resolve fills from the selected palette. Keep the path
order, nonzero fill rule, alpha 1 and four-decimal coordinates. No paint gives
two slots one colour, so one draw list serves every paint.

Ship geometry keeps frame 96, display scale 42/96 and pivot `[0.5, 0.5]`.
Warp geometry keeps frame 256, heading 48, the same display scale and pivot,
and all nine authored bank/stretch/squash poses. Their shared source is
`art/tools/ship-poses.ts`; each pose exports its actual projected paths.
Jet geometry, collision and all palette values remain independent of this
material contract.

The shared contract supplies all six paints, the heading 40 alias and all
nine jump poses. The core manifest keeps 385 logical player entries: the
alias, 64 Classic headings and 320 paid headings. These resolve through
the material package.

The landing page (heading 40), boot (heading 26), Local Map Classic frames
and the Classic shop swatch (heading 48) use the same geometry serialized as
a standalone SVG with two-decimal coordinates. Flight, title, Galaxy Map, warp
and painted views retain the full-precision material paths.

## Speed jets

`ship-jets.json` (version 1) drives plumes that scale continuously with speed.
There are no animated jet frames.

- `f` is current speed as a fraction of max speed. No jet at `f = 0`.
- Jet length in ship units: `length.base + length.scale * f ^ length.exponent`
  (6 + 24 f²). The halo reaches 1.1 jet lengths, the outer flame 1 and the
  core 0.55.
- `profile` is the plume outline as `[t, w]` pairs: `t` the fraction of a
  layer's length from the root, `w` the fraction of its half width. The
  teardrop is 0.85 at the root, full from 0.10 to 0.28, 0.70 at 0.5, 0.30 at
  0.8 and a point at the tip, so its tail keeps the width the earlier
  triangles had along their length. A layer's polygon runs down one side of the
  profile to the tip and back up the other:
  `anchor + axis * t * length * layer.length +- half * w * layer.width`.
- `engineLevels` holds three layers per Engine level, drawn in order. Only the
  colours change with level; shape is the same on every paint.
- The halo carries `underHull: true` and `maxDisplay: 42`. `underHull` draws
  the layer before the hull and its keyline, forward and reverse, so the whole
  hull silhouette (skirt and tail included) covers it. `maxDisplay` draws the
  layer only where the ship frame's larger logical display side is 42 px or
  less: the flight sprite, not the 280 px start screen ship, the warp poses or
  the app icon. The outer flame and core carry neither and draw as before.
  `layersAt` in [ship-plume.ts](tools/ship-plume.ts) applies `maxDisplay`.

| Layer   | `width`, half width | `length` |
| ------- | ------------------: | -------: |
| `halo`  |  5.8 units (2.5 px) |      1.1 |
| `outer` |  4.2 units (1.8 px) |        1 |
| `core`  |  1.6 units (0.7 px) |     0.55 |

| Speed `f` | Jet length | Halo reach | Outer reach | Core reach |
| --------: | ---------: | ---------: | ----------: | ---------: |
|      0.25 |        7.5 |       8.25 |         7.5 |       4.13 |
|       0.6 |      14.64 |      16.10 |       14.64 |       8.05 |
|         1 |         30 |         33 |          30 |       16.5 |

- At game scale the plumes match the earlier triangles' reach, the reach at
  which they are still 3 canvas px across, and their pixel area at speeds
  0.25, 0.6 and 1, measured on Sunflower at headings 0, 16, 32 and 48.

- Each colour pair is the value at `f = 0` and `f = 1`, interpolated linearly
  in sRGB. All layers are opaque. The core draws at every display size.

| Engine level | Halo, both fields | Dark field outer     | Dark field core      | Light field outer | Light field core     |
| -----------: | ----------------- | -------------------- | -------------------- | ----------------- | -------------------- |
|            1 | `#101a2e`         | `#5b93cc`, `#b9ecff` | `#8cc4f0`, `#ffffff` | `#1767b3`         | `#2585d0`, `#64caff` |
|            2 | `#583036`         | `#a62c22`, `#e74b35` | `#f0895d`, `#ffcab0` | `#9e3027`         | `#cf4935`, `#ee7960` |
|            3 | `#584a37`         | `#b77d22`, `#e8ba3c` | `#f3d46c`, `#fff0a6` | `#91620e`         | `#d49b22`, `#f2cf62` |

- Dark field values are `ship-jets.json` `engineLevels`. Light field values
  are `lightField.jets.shipLevels` in [galaxies.json](../public/art/galaxies.json)
  ([Light fields](galaxies.md#light-fields)): the same three layers and shape
  in their own colours.
- `headings` holds all 64 headings, two mouths each, port then starboard.
  `anchor` is the plume root in frame px: the mouth centre, local
  `(+-12.25, 17.563, 2.2)`, 0.1 behind the rear wall and 1 unit above the
  skirt top. `axis` is the projected exhaust direction per ship unit and
  `half` the projected vector across the plume per ship unit of half width:
  perpendicular to the projected axis on screen, as long as a round section
  of unit radius about the axis projects, pointing to the mouth's outboard
  side.
- A plume takes its depth on the plane that holds its axis and faces the
  viewer. `occluders` are the outlines, in frame px, of every visible hull
  region in front of that plane inside the plume's widest and longest reach
  (`plumeReach`: the halo's 5.8 by 33 units). Draw the halo under the hull,
  then the hull, then the outer flame and core above it, then the hull again
  inside the occluders, taken from the loaded hull image.
  The nearer plume draws over the tail and the farther one passes behind it.
- `node art/tools/ship.ts --jets-only` updates only this file.
  [ship-plume.ts](tools/ship-plume.ts) is the pure polygon and colour helper
  every Art drawing of the plume uses.

### Verification contract

Check actual rendered pixels before accepting a change: all 64 headings at
game scale and enlarged, both fields, idle and at full thrust, with
`ship-contact-sheet.ts`. Review the canopy strip for dots, lines and seams, the
rear views for the plume roots and the hull drawn over them, and the reverse
plumes under the wing tips. Source-coordinate assertions alone do not
establish visible compliance.

### Retro jets

`node art/tools/ship-retro-jets.ts` writes `ship-retro-jets.json`, version 1,
with all 64 headings in the same 96 px frame and pivot as the ship.

- The same `profile` and three layers at half the forward widths: halo 2.9,
  outer 2.1 and core 0.8 units, at the forward lengths 1.1, 1 and 0.55.
  `engineLevels` carries the same colours as `ship-jets.json`; light fields
  use `lightField.jets.shipLevels` colours on these widths. At game scale they
  match the earlier reverse plumes' reach, 3 px reach and pixel area.
- Jet length is `14.85 + 23.1 f` ship units, `length`
  `{ base: 14.85, scale: 23.1, exponent: 1 }`, so the reverse plumes outreach
  the forward ones, which matters because the wings hide part of them. Zero
  strength is off.

| Strength `f` | Jet length | Halo reach | Outer reach | Core reach |
| -----------: | ---------: | ---------: | ----------: | ---------: |
|         0.25 |      20.63 |      22.69 |       20.63 |      11.34 |
|          0.6 |      28.71 |      31.58 |       28.71 |      15.79 |
|            1 |      37.95 |      41.75 |       37.95 |      20.87 |

- The axis aims 10 degrees outboard of forward, `(+-sin 10, -cos 10, 0)`, and
  `half` is the round-flame vector across it, as for the forward plumes.
- Each mouth has `anchor`, `axis` and `half` only. The root sits at the wing
  tip (`retroRoot` in [ship-model.ts](tools/ship-model.ts)): the halo's widest
  outboard flank leaves from the tip `(+-21.44, 20.48)`, and the root slides
  forward along the axis until its inboard root corner reaches the trailing
  edge, so no plume shows behind the wing. The local root is
  `(+-18.69, 19.36)`. At speeds 0.25 and 0.6 both plumes show clearly past
  the wings at headings 0, 16, 32 and 48. The nearer wing's plume lies at the skirt bottom
  (z 0) and the farther wing's at the skirt top (z 1.2); level wings both
  take the bottom.
- The hull draws over the reverse plumes. There is no rear clip, corner
  attachment or wing-edge ink.
- Actual backward velocity relative to facing selects retro jets with the
  existing motion threshold; forward motion and reduced-motion behaviour retain
  their contracts.

`art/sources/ship-retro-jets-yellow.json` is a static archive, not shipped and
not rewritten by the active producer.

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
- The solid is the same under every paint, so the one set serves all six.
- The parts cover the hull; thrust flames and speed jets have none.
- No heading has a notch tip; the generator fails if one appears.

### Shared tracer

`art/tools/silhouette.ts` turns a frame's drawn alpha into convex parts in frame
px. The [sector one enemies](enemies.md#collision), the
[heavies](heavies.md#collision), the traveling debris
([Cartwheel](cartwheel-props.md#collision), [Whirlpool](whirlpool.md#collision))
and the asteroids and crystal rocks
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
