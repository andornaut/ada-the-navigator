# Needle

Needle's space art: the [Weavers' station](#weavers-station) and its Loom
hall, the [ring gates](#ring-gates), the [channels](#channels) with their
stitched edges, harmless debris and the Eye's layout, the
[edge-on band](#space-look), [Elder Loom's glider](#elder-looms-glider) and
[portrait](#elder-looms-portrait), the [crimson drones](#needle-drones) and the
[world changes](#world-changes). Everything here is in
[Needle's manifest](../public/art/needle/manifest.json) (except the
`projects.json` entries) and under
`public/art/needle/`, drawn in the shared solid-model projection
([ship geometry](ship.md)) with the station family's parts
([art/tools/solid.ts](tools/solid.ts)). Shared generator parts and the Weaver
palette are in [art/tools/needle-common.ts](tools/needle-common.ts).

- Every SVG keeps its `viewBox` in frame px and declares its display size
  (frame times 0.4375) as `width` and `height`. Manifest `width` and `height`
  are frame px; `displayWidth` and `displayHeight` are the drawn size. Frame-px
  values (pivots, docks, berths, anchors) scale by 0.4375 to display px.
- Nothing is labelled: no text, signs or letters on or beside any asset.
- Contrast is WCAG against Needle's background `#26221F`. Needle is a dark
  field: no light-field keyline applies.

## Weavers' station

Needle's dockable station. Rebuild with `node art/tools/needle-station.ts`; it
writes `station-{a,b}.svg` and `station-hall-{a,b}.svg` and replaces its
`needle-station-` entries, which open Needle's manifest.

- A spool hub: pearl flanges round a core wound in lavender and silver thread,
  a domed cabin with warm windows, the spindle mast and a blue beacon.
- A loom frame to screen left: a sill, two posts and a lintel strung with nine
  silver warp threads behind a band of woven lavender cloth with rose and sage
  weft stripes.
- A bobbin rack behind the hub (lavender, rose and sage thread), a mooring arm
  and post to screen right, and the dock toward the viewer with the station
  family's collar, dark mouth, lit floor, four corner lights and two
  approach-light pairs.
- Fixed orientation: no headings and no screen rotation. 5.7 Ada wingspans
  across (the trading station is 3.0).

| Field               | Value                                                                     |
| ------------------- | ------------------------------------------------------------------------- |
| Ids                 | `needle-station-a`, `-b`; Loom hall `needle-station-hall-a`, `-b`         |
| Frame               | 320 by 144 frame px; display 140 by 63                                    |
| Pivot               | `(0.5, 0.5)`: the hub base on the world plane                             |
| `facing`            | `fixed`                                                                   |
| `frameMs`           | 700                                                                       |
| `destination`       | `station`; `variant` `base` or `loom-hall`                                |
| `dock`              | `(160, 122.912)`, outward `[0, 1]`, width 29.394                          |
| `berths`, base      | `(0.783, 72)` outward `[-1, 0]`; `(250.631, 72)` outward `[1, 0]`; 24.495 |
| `berths`, Loom hall | `(0.783, 72)` outward `[-1, 0]`; `(299.621, 72)` outward `[1, 0]`; 24.495 |

- `dock` and `berths` use the station schema: the point on the world plane in
  frame px, the outward screen direction and the drawn width. Ada docks moving
  screen-up, opposite `outward`; a craft at a berth holds just beyond its point
  along `outward`. The dock entrance is 50.912 frame px below the pivot.
- The berths are the loom's outer post (left) and the mooring post (right).
  The Loom hall moves the right berth out to the hall's end, so read `berths`
  from the frame in use.
- Blink as the station: frame A lights the dock corner lights and the mast
  beacon `#70ace8`, B the approach-light pairs; the loom post and mooring post
  (or hall end) beacons blink opposite the mast. Unlit blue `#3f5878`. Reduced
  motion shows A.

### Palette

| Role                   | Colour    | Contrast |
| ---------------------- | --------- | -------: |
| Pearl structure        | `#e9e3da` |  12.37:1 |
| Pearl side             | `#b3aba1` |   6.95:1 |
| Silver threads, cap    | `#cfc5bd` |   9.30:1 |
| Lavender thread, roof  | `#c4afcc` |   7.78:1 |
| Lavender side          | `#8f7c9c` |   4.16:1 |
| Rose thread            | `#e3b7c0` |   8.87:1 |
| Sage thread            | `#b9cfae` |   9.47:1 |
| Warm windows, lanterns | `#ffe9b8` |  13.22:1 |
| Blue lights            | `#70ace8` |   6.58:1 |

The silhouette's edge median is 5.95:1, with 90% of edge pixels at 3:1 or more.

### Loom hall

`loomHall` replaces the station frames: draw `needle-station-hall-a` and `-b`
in place of `needle-station-a` and `-b`. The mooring arm and post become a
short link and a long teaching hall: pearl walls with eight warm windows on the
near side, a stepped lavender roof with three warm lanterns, a lavender porch
with a lit door toward the dock side and a beacon on the far end. Frame, pivot
and dock are unchanged; the right berth moves to the hall's end. The hall sorts
in depth with the hub, so it is a replacement, not an overlay.

## Ring gates

Rebuild with `node art/tools/needle-gates.ts`. It writes the gate frames and
[gates.json](../public/art/needle/gates.json) and replaces its `needle-gate-`
entries; Needle's manifest links the data as `needleGates`.

An upright hoop with its axis along the channel: rim radius 40 and depth 7
model units, 32 flat-shaded segments in the world light of the debris model,
and eight lamps on each face. The opening is 66 across, Gameplay's pass
opening: a pass counts when Ada's centre crosses inside it, and the rim bumps
like scenery.

### Frames and layers

- Ids `needle-gate-{state}-{o}-{layer}`: `state` `dark` or `lit`, orientation
  `o` 0 to 4, `layer` `back` or `front`. Frame 112 (display 49), pivot
  `(0.5, 0.5)`: the hoop's centre on the world plane, the point a pass goes
  through. Entries carry `gate`, `orientation`, `layer` and `facing`
  `axis-{o}`.
- Orientation `o` puts the hoop's axis at `o * 22.5` degrees in the art's
  model plane. `orientations[o].axis` is that axis's screen direction. Pick the
  orientation whose `axis` (or its reverse) is nearest the screen direction of
  the channel tangent at the gate, the game's projection of the world tangent.
- The hoop is symmetric, so eight orientations cover every heading. Gameplay
  keeps each gate's tangent at least 30 degrees off screen horizontal
  (`minScreenAngle`), so only 0 to 4 are drawn; 5 to 7 would be 13.5 and 0
  degrees off and read thin or edge-on. `open` is how round the hoop reads
  (`|axis . view|` for the unit view `(1, 1, 1)`): 0.577 at 0 and 4, 0.754 at 1
  and 3, 0.816 at 2.
- A quad is in the front layer when its centre lies toward the viewer from the
  hoop's centre. Draw the back layer, then any ship whose centre is within
  `rim.outer` (40) world units of the pivot, then the front layer, so Ada
  visibly threads the gate. Otherwise both layers sort together with the play
  objects at the gate's pivot.

### States

| State | Rim ramp, lit to shadow | Lamps     | Veil                                | Edge median, worst orientation |
| ----- | ----------------------- | --------- | ----------------------------------- | -----------------------------: |
| Dark  | `#C3BAB1` to `#716B65`  | `#4d4640` | none                                |                         3.00:1 |
| Lit   | `#F3EDE6` to `#8A8178`  | `#ffe9b8` | `#ffe9b8` at 0.16 alpha, back layer |                         4.13:1 |

- The dark ramp is a dimmed silver lifted in Oklab L (0.11) until the worst
  drawn orientation's edge median reaches 3:1 at display size; the build fails
  if either state falls under 3:1. Lamps lit are 13.22:1.
- A gate lights when Gameplay counts Ada's pass: the lit pair fades in over the
  dark pair in 240 ms, `cubicOut` (`light`). Reduced motion cuts. When a run
  resets to its first gate, its gates cut back to dark.
- `rim` gives `inner` 33, `outer` 40 and `depth` 7 in world units: on the
  world plane the rim is two blocks across the channel, 33 to 40 from the
  centre on each side and 7 deep along the axis, for the bump.

## Channels

Rebuild with `node art/tools/needle-channels.ts`. It writes the debris frames,
[channels.json](../public/art/needle/channels.json) and
[eye.json](../public/art/needle/eye.json) and replaces its `needle-debris-`
entries; Needle's manifest links the data as `needleChannels` and `needleEye`.
Channels are 210 world units wide, the Eye 150 (Gameplay).

### Edge stitch

Tech draws each channel edge at runtime from `stitch`; there are no edge
sprites. The edges are the centre line offset by half the width each side, on
the world plane through the view projection.

| Part   | Rule                                                                                                                        |
| ------ | --------------------------------------------------------------------------------------------------------------------------- |
| Colour | `#CFC5BD` (`color`, Needle's marker) at alpha 0.38 (`alpha`): `#66605B`, 2.55:1                                             |
| Dashes | 6 on, 4 off (`dash`), logical px measured along the projected edge from the channel's start                                 |
| Stroke | 1 px (`width`), scaled by `s` like every other space stroke, butt caps                                                      |
| Inset  | 0 (`inset`): on the edge itself                                                                                             |
| Motion | None: the stitch is static, so reduced motion needs no change                                                               |
| Depth  | On the field, above specks, the band and backdrop rocks, below every play object, pickup and effect, as Whirlpool's streaks |

### Debris

Channel debris bumps Ada aside without damage, as scenery does, so it reads as
harmless matter: no coral contour (coral keeps meaning damage), and the
[asteroid drift cue](asteroids.md#drift-cue)'s stone chips in place of the
coral dashes (`cue` `asteroid`).

- The shared [debris models](tools/debris.ts), the bent plate and the girder,
  at 0.8 scale, tumbling about a tilted axis through 8 frames:
  `needle-debris-plate-{k}` and `needle-debris-girder-{k}`, `k` 0 to 7,
  `tumbleIndex` `k`. Frame 80 (display 35), pivot `(0.5, 0.5)`. Frame `k` shows
  the piece turned `45k` degrees; show frame `floor(angle / 45) mod 8` at a
  tumble rate in `tumble.degPerSecond` (60 to 120) per piece. Reduced motion
  shows frame 0; drift still happens.
- Body, lit to shadow: `#B2AAA0`, `#9D968C`, `#8A8179`, `#787068`, `#686058`
  (`body`; 6.87 to 2.56:1). It is the play stone ramp lifted in Oklab L by the
  least step (0.13) that puts each piece's edge median at display size at 3:1
  or more (3.02:1); the build fails under 3:1. Faces are flat-shaded from the
  world light, with a 1.2 frame px seam stroke in their own fill.
- `pieces[i]` lists `id`, `frame`, `display`, `pivot`, `radius` (frame px from
  the pivot to the farthest drawn point over all frames) and `frames[k]` with
  `file` and `bounds` (`[minX, minY, maxX, maxY]` in frame px), as Whirlpool's
  debris does. Collision radius is Gameplay's.

### The Eye

`eye.json` is Art's layout of the Eye, accepted by Gameplay. World units from
the Eye's entry; Gameplay places it in the galaxy.

- `path`: the centre line, 61 points: an S-curve of amplitude 90 (`swing`)
  along a 2600-long axis at 20 degrees on the world plane. `width` 150.
- `gates`: the eight gates at 312 to 2132 along the axis, 260 apart, each with
  its `point`, unit `tangent` and degrees off screen horizontal: 33.4 to 60.2,
  every one at least the 30 Gameplay requires (the build fails otherwise).
- `holodisk`: 60 beyond the path's end on the axis; `pack`: the drone pack's
  point, 420 beyond the end and 60 to one side, outside the exit.
- `eyelids`: two belts of dense debris either side of the channel forming an
  almond: half-width `base` 70 plus `swell` 260 times `sin(pi t)` along the
  axis, with a normal spread of 25.
- `debris`: three rows outside each edge, pieces about 34 apart along it, the
  first row 12 past the edge and each next 26 farther, drifting along the
  channel at 6 to 12 world units per second.

## Space look

Needle's field is in [galaxies.json](../public/art/galaxies.json) (`needle`)
and its backdrop rock tints in `asteroids.json` (`#48423D` lit, `#3A3531`
side). Rebuild the band with `node art/tools/needle-sky.ts`; it writes
[band.json](../public/art/needle/band.json), linked as `needleBand`.

Tech draws the edge-on band at runtime: one thin line across the whole sky,
the galaxy seen edge on. It follows the [backdrop haze](galaxies.md#backdrop-haze)
conventions (layer `backdrop`, anchor `view`, parallax 0) but is drawn from
data, not a texture: its 1.2 px core and 1 to 2 px stars would not survive the
haze's half-resolution texture and sigma 20 blur. Needle has no haze.

| Part    | Rule                                                                                                                                                       |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Line    | A straight line at `angle` -6 degrees on screen through `through` (0.5, 0.4) of the play view, fixed to the screen (`anchor` `view`, `parallax` 0)         |
| Profile | Across the line, `color` `#CFC5BD` at alpha `sum(alpha * exp(-(d / sigma)^2))`, `d` in logical px: haze 0.06 at sigma 30, glow 0.10 at 7, core 0.08 at 1.2 |
| Specks  | 1 px stars on the line, one per 2.2 px of its length on average, offset across it by a normal of sigma 12, `color` at alpha 0.25 to 0.8                    |
| Stars   | 2 px `#F1ECE6` stars, one per 240 px on average, sigma 7.2 across                                                                                          |
| Depth   | `layer` `backdrop`: over the field's background fill, under the dust specks, backdrop rocks, the channel stitch and every play object                      |
| Seed    | Speck and star positions come from one fixed seed, so the band looks the same on every flight                                                              |

- The line stays within the backdrop rocks' 1.8:1 cap: its peak (alpha 0.24)
  is `#4F4945`, 1.78:1, and 7 px out 1.24:1. The build fails over 1.8:1.
- Specks and stars are point stars, not the line: specks run 1.83 to 6.44:1
  and the pearl stars 13.43:1, as small and sparse as the field's dust specks.
- Reduced motion: the band is static, so it is unchanged. The
  [selector preview](galaxies.md#selector-preview) capture includes it.

## Elder Loom's glider

Rebuild with `node art/tools/needle-craft.ts`. It writes `glider-{0..15}.svg`
and `glider-jets.json` and replaces its `craft-glider-` entries.

A long-winged pearl sailplane: a slender fuselage, straight wings with lavender
thread bands near the tips and blue wingtip lights, a T-tail, a smoked lavender
canopy with a warm pane and two small steel motor nacelles under the wing
roots. Length 48 and span 67 model units (1.12 by 1.56 Ada widths). Not coral,
amber or Ada's white and blue, and no Gadget insignia.

- A non-hostile story craft in the [Cartwheel story craft](cartwheel.md#story-craft)
  contract: 16 headings in 22.5 degree steps (heading `k` faces world angle
  `k * 22.5`, local forward negative Y), no hit circle, no blink. Ids
  `craft-glider-{k}` with `craft` `glider`, `directionIndex` `k` and `facing`
  `world-{k}`. Frame 96 (display 42), pivot `(0.5, 0.5)`; render the selected
  frame with rotation zero.
- `glider-jets.json` uses the [enemy speed jets](enemies.md#speed-jets) schema
  (version 1, outer and core layers, no halo, length
  `(6 + 24 f²) * sqrt(frame / 96)`) in the story craft's civil palette: outer
  `#c9a978` to `#ffe9b8`, core `#efe4cf` to `#ffffff`. Two mouths 3 wide at
  the nacelle tails, `(u, v, z)` `(0.5, ±7, 4.8)`, clear of the fuselage at
  every heading.
- The same file carries `nose`, 16 entries, as the story craft do, from
  [art/tools/nose.ts](tools/nose.ts), shared with Pip's mail scooter. `nose[k]`
  gives `distance`, the world units from the pivot to the point under the nose
  on the centre line (the hull's tip, reach 23), and `tip`, the drawn tip in
  frame px; the build fails unless each tip lies within 0.5 frame px of a drawn
  edge. A docked or berthed glider holds with its pivot on the berth point
  moved along `outward` by `nose[k].distance`.

| Headings     | `distance` |
| ------------ | ---------: |
| 2, 10        |     10.063 |
| 1, 3, 9, 11  |      9.877 |
| 0, 4, 8, 12  |      9.413 |
| 5, 7, 13, 15 |      8.925 |
| 6, 14        |      8.714 |

| Role           | Colour    | Contrast |
| -------------- | --------- | -------: |
| Pearl hull     | `#e9e3da` |  12.37:1 |
| Pearl side     | `#b3aba1` |   6.95:1 |
| Lavender bands | `#c4afcc` |   7.78:1 |
| Canopy         | `#6f6688` |   2.95:1 |
| Nacelles       | `#8d8a99` |   4.68:1 |
| Wingtip lights | `#70ace8` |   6.58:1 |

The silhouette's edge median is 6.07:1.

## Elder Loom's portrait

Rebuild with `node art/tools/needle-portraits.ts`. It writes `loom.png` and
`loom-compact.png` with their Aseprite data to `public/art/needle/portraits/`
and replaces the `loom-portrait` entries in Needle's manifest.

- An Avi heron, drawn in the chibi bust style of the set: silver feathers
  `#c9ccd8` (shade `#9097ab`, light `#ffffff`), two white crest plumes swept
  back, a silver braided plume over the left shoulder with a rose tie, white
  brow tufts and a long yellow beak `#f2c45a` (shade `#c98d3a`) that opens when
  happy. A lavender Weaver tunic `#c4afcc` with a pearl collar `#e9e3da` and a
  rose thread badge `#e8968c`, and pilot goggles pushed up on the crown (strap
  `#4a4360`, frames `#6f6688`, glass `#8fd6e0`).
- The [conversation portrait](conversation.md) format, as for Ada and Penny:
  `loom-portrait` is two 32 × 32 frames for the storybook panel, drawn 2x in
  the 68 frame; `loom-portrait-compact` is their exact 22 × 22 crops at
  (5, 2), drawn 2x in the conversation box (`displayWidth` and `displayHeight`
  44). Frames `happy` 0 and `neutral` 1, 1000 ms each, no speaking loop: a line
  Gameplay marks `(happy)` shows `happy`, any other `neutral`. Integer scale,
  nearest neighbour.

## Avi portraits

`node art/tools/needle-portraits.ts` also writes Reed's and the station
keepers' sheets: `{key}.png` and `{key}-compact.png` with ids `{key}-portrait`
and `{key}-portrait-compact`, frame `neutral` 0, in the
[conversation portrait](conversation.md) format. Each is a pearl-collared
heron with a long yellow beak; compact crops at (5, 2).

| Speaker | Key      | Look                                                                                  |
| ------- | -------- | ------------------------------------------------------------------------------------- |
| Reed    | `reed`   | Pearl feathers, two slate crest plumes, a grey crown stripe, a rose thread scarf      |
| Sedge   | `sedge`  | Keeper: blue-grey feathers, three long dark plumes, a dark brow stripe, a sedge tunic |
| Willow  | `willow` | Keeper: pale feathers, plumes drooping at both sides, willow leaves, a lavender shawl |
| Marsh   | `marsh`  | Keeper: tan bittern-streaked feathers, a short spiky crest, a reed-brown tunic        |

The keepers wear the keepers' headset (cups `#3a4466` with a lit
accent and a mic boom).

## Needle drones

Rebuild with `node art/tools/needle-drones.ts`, which takes the same
`--offsets <file.json>` as `heavies.ts`. It draws the shared models in process,
writes `public/art/needle/enemies/` and replaces its `enemy-needle-` entries in
Needle's manifest, before the story craft.

Needle's drones and heavies are one family: the four drones, the frigate and
the capital in crimson lacquer. Needle's roster adds no archetype and no
platform.

- Models, parts, frames, headings, hardpoints, anchors and muzzles match the
  [coral family](enemies.md); only fills and jet colours change, as for the
  [claim jumpers](heavies.md#cartwheel-claim-jumpers). Every SVG and shards
  file goes through the colour swap below and every jets file through the
  Needle jet colours; the tool stops on any colour outside the family.
- Hardpoints files are the coral family's, byte-identical: the same `order`,
  `anchor`, `pivot` and `muzzles` per heading and aim, and the same hit areas
  from Gameplay's catalog. Jets files keep the coral shape, lengths, layers and
  mouth data. Destruction uses the shared `destruction.json` timing and flash
  with the Needle shards.
- File names are the coral names in `public/art/needle/enemies/`. Ids are the
  coral ids with `enemy-needle-` in place of `enemy-`, such as
  `enemy-needle-frigate-3` and `enemy-needle-capital-turret-top-9`, with the
  coral entry's fields, its own `path` and `family` `needle`. No Needle id
  matches `enemy-{archetype}-{index}`.
- Gadget's insignia (the ink claw on an amber disc) stays: these are Gadget's
  drones.

| Role                   | Coral                           | Needle    | Contrast |
| ---------------------- | ------------------------------- | --------- | -------: |
| Hull top               | `#d68b72`                       | `#d65b6c` |   4.19:1 |
| Hull side              | `#a8654f`                       | `#a14350` |   2.58:1 |
| Hull rear              | `#7f4b3d`                       | `#75313a` |   1.70:1 |
| Plates                 | `#e6a890`                       | `#d7cfc9` |  10.26:1 |
| Turret top             | `#c27a62`                       | `#b44858` |   3.01:1 |
| Scorch top             | `#5c3a31`                       | `#452a2c` |   1.22:1 |
| Scorch side            | `#42291f`                       | `#2e1d1e` |   1.02:1 |
| Burn (deck paint)      | `#6e4436`                       | `#58302f` |   1.41:1 |
| Guns, lights, disc     | `#f0bd68`                       | unchanged |   9.15:1 |
| Gun side               | `#b98a40`                       | unchanged |   5.09:1 |
| Visor, claw ink, ember | `#2a2433`, `#181425`, `#f0a07c` | unchanged |          |

Needle scorch is 3.44:1 on the crimson top and burn 2.97:1, so wrecks read on
the hull; the wreck ember is 6.19:1 on scorch. The fighter's edge median is
3.06:1.

| Layer | Gadget                 | Needle                 | Contrast, slow and fast |
| ----- | ---------------------- | ---------------------- | ----------------------: |
| Outer | `#b8644c` to `#f0a07c` | `#993847` to `#ed7477` |          2.26:1, 5.53:1 |
| Core  | `#d68b72` to `#ffe2c8` | `#d65b6c` to `#ffe7e9` |         4.19:1, 13.42:1 |

## World changes

Rebuild with `node art/tools/needle-projects.ts`. It writes the Channel lights
lamp frames and replaces its `needle-lamp-` entries, and writes the
`channelLights` and `loomHall` entries of
[projects.json](../public/art/projects.json) through `art/tools/projects.ts`
([World changes](projects.md#world-changes)). Both reveal with the shared
600 ms `cubicOut` fade.

### Channel lights

`channelLights`, a `path` change along Gameplay's practice channel (`path`
`practice`): soft lamps in pairs, one just inside each edge.

- `needle-lamp-a` and `-b`: a small pearl float, a silver mast and a soft warm
  lamp, `#ffe9b8` lit in A and `#8c7c60` dim in B, over a faint warm pool of
  light on the world plane (radius 14, alpha 0.14 in A, 0.05 in B). Frame 48 by
  48 (display 21), pivot `(0.5, 0.5625)`: the float's centre on the world
  plane. `facing` `fixed`, `frameMs` 700, `project` `channelLights`.
- `anchors`: the first pair 40 world units along the channel from its start,
  then every 80, each 4 inside its edge (`start`, `spacing`, `inset`), on both
  sides (`sides` `[-1, 1]`). `phase` `alternate`: neighbours along and across
  blink opposite. Reduced motion holds every lamp on A.
- Data shape for Tech: `{ galaxy, kind: "path", path, frames: [a, b], anchors:
{ start, spacing, inset, sides, phase } }`, with anchor `i` at arc length
  `start + i * spacing` on the centre line, offset `side * (width / 2 - inset)`
  along its left normal (`1` left of the line's direction, `-1` right).
- Lamp `#ffe9b8` 13.22:1, dim `#8c7c60` 3.88:1, pearl float 12.37:1.

### Loom hall

`loomHall`, a `replace` change at the Weavers' station (`galaxy` `needle`,
`destination` `station`): `needle-station-hall-a` and `-b` replace
`needle-station-a` and `-b` ([Loom hall](#loom-hall)).
