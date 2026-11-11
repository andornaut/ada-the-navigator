# Needle

Needle's space art. Everything here is
in [Needle's manifest](../public/art/needle/manifest.json) and under
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
