# Whirlpool station, currents, debris rivers and project world changes

- `node art/tools/stations.ts` draws the station
  ([Station redesign](station-redesign.md)). `node art/tools/whirlpool.ts`
  writes `public/art/whirlpool/`: `currents.json` (the streak spec), the river
  debris frames and `debris.json`, and the debris entries in
  [Whirlpool's manifest](../public/art/whirlpool/manifest.json), which names
  the data files as `whirlpoolCurrents` and `whirlpoolDebris`. Each generator
  replaces its own entries in place.
- `node art/tools/friendly.ts` draws the project world changes and writes
  `projects.json`, the `whirlpoolProjects` link
  ([Friendly object redesign](friendly-redesign.md#manifests)).
- The build fails if the whale's lit hull (`hull[0]` in `whales.json`) falls
  below 3:1 over the streak colour.
- The debris models are shared in [art/tools/debris.ts](tools/debris.ts).

## Station

Whirlpool's own station, the Eddy, in place of the shared
[trading station](station.md) at every Whirlpool station. Ada enters it by
Use, the Dock action. Its hull has no collar or dock mouth.

- A suspended ribbon winds 1.3 turns around the core with open gaps
  between the turns. Thirty segments climb from the outer tip to a
  short brace at the core. Five colour bands mark the sweep. A pale outer
  rail and dark channel trace the turns.
- Fifteen current chevrons point inward along the ribbon, as the
  [current streaks](#current-streaks) point downstream.
- A blue plinth supports a faceted teal hull, a lilac observation deck and an
  offset sea-glass crown. Amber and mint windows distinguish the two levels,
  and a low blue beacon caps the crown.
- A short brace on the outer turn carries a raised sensor pod with a mint
  signal on the near-right edge.
- The [station](station.md) solid model, projection and culling give the
  Eddy a fixed orientation.

### Frames and manifest

| Field         | Value                                                                                         |
| ------------- | --------------------------------------------------------------------------------------------- |
| Ids           | `whirlpool-station-{k}`, `k` 0 to 3, files `/art/whirlpool/station-{k}.svg`                   |
| Frame         | 304 by 208 frame px; display 199.5 by 136.5 at the [destination scale](destinations.md#scale) |
| Pivot         | `(0.5, 0.4375)`, frame px `(152, 91)` at the station world origin                             |
| `facing`      | `fixed`                                                                                       |
| `frameMs`     | 350                                                                                           |
| `destination` | `station`; `frameIndex` `k`                                                                   |

- Show frame `k` for 350 ms, 0 to 3 in order, and loop (1.4 s). The blue
  beacon, window banks and sensor signal light on frames 0 and 1 and dim on
  frames 2 and 3, the station family's 700 ms blink.
- Chevron `k`, counting from zero at the outer tip, lights on frame
  `k mod 4`. The lit positions advance inward one place per frame.
- Reduced motion holds frame 0.
- Every frame shares one frame size and pivot. At 1×, the painted silhouette
  spans about 164 px across, reaches 55 px above the pivot and has a 93 px
  screen radius. Its reach on the world plane is about 78 units. The Dock callout
  follows the drawn top
  ([Destinations](destinations.md#collision-silhouette-dock-and-clearance)).
  The station is pass-through and carries no `collision`.
- No project world change attaches to the station: the nursery beacon sits at
  the whale family, 1200 or more from any station, and the current-map buoys
  along the whales' current, which keeps 800 clear of stations.

### Palette

| Role                   | Top or lit                                            | Side or dim                                           |
| ---------------------- | ----------------------------------------------------- | ----------------------------------------------------- |
| Ribbon, outer to inner | `#57c0ad`, `#5abdd5`, `#779cda`, `#a398cb`, `#6ec7ac` | `#317f84`, `#326b92`, `#465983`, `#655984`, `#438c85` |
| Plinth                 | `#537caa`                                             | `#35476b`                                             |
| Core hull              | `#46adad`                                             | `#2e707c`                                             |
| Observation deck       | `#9e8eb9`                                             | `#54496e`                                             |
| Crown                  | `#94d5c0`                                             | `#397b83`                                             |
| Current chevrons       | `#f9fff4`                                             | `#82b9b6`                                             |
| Amber windows          | `#ffe9b8`                                             | `#b29a73`                                             |
| Mint windows           | `#c1ffdf`                                             | `#65948d`                                             |
| Blue beacon            | `#70ace8`                                             | `#3f5878`                                             |

The producer checks the 5:1 field contrast floor for the hull and lit accents.
On Whirlpool's light field, `floorColour` uses the ink of the
[2 px destination keyline](destinations.md#light-field-keyline), which has
10.86:1 contrast on the field.

## Current streaks

Tech draws the streaks at runtime from `currents.json`; there are no streak
sprites. Chevrons lie on the world plane and go through the view projection,
so they foreshorten with the path. They are larger and stronger toward the
centre line and fade with the flow at the ends.

Let `w` be the current's width, `s` an arc position along its path and `d` an
offset across it (positive to the left of the flow). `P(s, d)` is the path
point at `s` plus `d` along the left normal of the local tangent. `f` is the
flow speed at `P(s, d)` over the peak flow, as the model computes it (zero at
the edges and at both ends). A pair `[a, b]` means `a + b f`. Lengths are
world units; stroke widths are logical px, scaled by `s` like every other
space stroke.

| Part    | Rule                                                                                                                                                                                                                                                                                                                                            |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Colour  | `#296362` (`color`), one colour for every mark                                                                                                                                                                                                                                                                                                  |
| Lanes   | `n = max(3, round(w / 46))` (`lanes.min`, `lanes.spacing`), lane width `w / n`. Lane `j` sits at `d = -w / 2 + (j + 0.5) w / n + 0.12 (w / n) (2 frac(0.618034 j) - 1)` (`jitter`, `jitterStep`)                                                                                                                                                |
| Rows    | Marks 64 apart along the path (`rows.spacing`). Lane `j`'s offset is `o = 64 (0.5 (j mod 2) + 0.3 frac(0.414214 j))` (`stagger`, `phase`, `phaseStep`)                                                                                                                                                                                          |
| Chevron | Reach `a = 6 + 7 f` (`chevron.arm`). Each chevron is built in the path's tangent frame at its own centre point `C = P(s, d)`, with `T` the unit tangent at `s` and `N` its left normal, so a bend never bends its arms: a two-segment polyline `C - 0.6 a T - a N`, tip `C + 0.6 a T`, `C - 0.6 a T + a N` (`tip`, `back`), pointing downstream |
| Stroke  | Width `1.1 + 0.7 f` px (`stroke`), alpha `0.3 + 0.7 f` (`alpha`), round join, butt caps                                                                                                                                                                                                                                                         |
| Culling | Draw marks with `0 <= s <= length` and `f > 0.06` (`minFlow`)                                                                                                                                                                                                                                                                                   |
| Motion  | Lane `j` scrolls at its lane speed `v = peak (1 - (2 d / w)^2)` world units per second, so its marks move with the flow. At time `t` its marks sit at `s = o + (v t mod 64) + 64 k` for integer `k`                                                                                                                                             |
| Reduced | Draw the `t = 0` frame (`reducedMotion.time`) and hold it                                                                                                                                                                                                                                                                                       |
| Depth   | On the field, above specks and backdrop rocks and below every play object, pickup and effect                                                                                                                                                                                                                                                    |

Marks keep their lane speed through the end fades, so their spacing stays
even while `f` shrinks and fades them out. Streaks take no light-field
keyline.

Contrast (WCAG) on Whirlpool's `#B8CEC4`:

| Pair                              |   Ratio |
| --------------------------------- | ------: |
| Streak on field                   |  4.14:1 |
| Whale top `#AAA5E6` over a streak |  3.02:1 |
| Whale top on field                |  1.37:1 |
| Whale ink keyline on field        | 10.86:1 |
| Debris contour `#D68B72` on field |  1.62:1 |
| Debris contour over a full streak |  2.55:1 |
| Debris ink keyline on field       | 10.86:1 |

The streak stays a field-level mark under every play object, clear of the
mint `active` (`#65C9BF`) of ore and Stardust.

### Ordered darts

The accepted streak look, staged as `runtime-currents` in
[polish-rows.json](polish-rows.json) for `currents.json`
([handoff](polish-handoff.md)). Colour, flow, `minFlow`, drift and reduced
motion are unchanged.

| Rule  | Shipped                                                      | Ordered darts                                                                                          |
| ----- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| Lanes | 46 apart, each moved up to 0.12 of a lane                    | 56 apart, no jitter                                                                                    |
| Rows  | 64 apart, odd lanes half a row on, plus an irrational phase  | 72 apart, odd lanes half a row on, no further phase                                                    |
| Mark  | A two-segment chevron stroke 1.1 to 1.8 px wide, arm 6 to 13 | A filled dart of arm `a`: `(-0.6 a, -a) (0.6 a, 0) (-0.6 a, a) (-0.05 a, 0)` along and across the flow |
| Size  | Arm `6 + 7 f`, continuous in the flow `f`                    | Arm `6 + 7 q` in three steps: `q` 0.3 under flow 0.34, 0.65 under 0.67, else 1 (8.1, 10.55 and 13)     |
| Alpha | `0.3 + 0.7 f`                                                | `0.3 + 0.5 q`: 0.45, 0.625 and 0.8                                                                     |

## River debris

A debris river's pieces are traveling debris and damage on contact, so they
take the coral hazard contour. Two broken pieces of the Whirlpool station,
each one connected solid, tumble about a tilted axis, 8 frames each:

| Piece                     | Shape                                                   | Frame (px) | Display (px)      | Pivot          | `radius` |
| ------------------------- | ------------------------------------------------------- | ---------- | ----------------- | -------------- | -------: |
| `whirlpool-debris-plate`  | A spiral-arm segment that still carries its end pod     | 118 by 115 | 51.625 by 50.3125 | (0.5, 0.50435) |    59.91 |
| `whirlpool-debris-girder` | A slice of the drum with its cap and the root of an arm | 108 by 95  | 47.25 by 41.5625  | (0.5, 0.48421) |    51.87 |

The ids keep `plate` and `girder`. The arm segment is a 78 degree arc 10 wide
and 9 deep at radius 26 with a round pod of radius 8 on its end, at scale
0.86; the drum slice is a drum of radius 11 and depth 12 with a cap of radius
6.5 and an arm root 10 wide, at scale 0.92, in display px. Their widest drawn
extents are 47.7 and 39.1 px.

- Manifest `{piece}-{k}`, `k` 0 to 7, `tumbleIndex` `k`. The piece leans 20
  degrees, then frame `k` shows it turned `45k` degrees about an axis tilted
  24 degrees from vertical; show frame `floor(angle / 45) mod 8` and pick a
  tumble rate in `tumble.degPerSecond` (60 to 120) per piece. Reduced motion
  shows frame 0; travel still happens. Choose the piece per river rock from
  its seed.
- Body, lit to shadow: `#CFECDF`, `#BFDCCF`, `#AFCCBF`, `#A2BFB2` and
  `#99B5A9` (`body`): Whirlpool's `environmentDetail` lightness plus 0.2,
  0.15, 0.1, 0.06 and 0.03, at its tint hue with 1.3 times its chroma. Muted
  field matter, never the neutral stone of harmless rocks; 1.04 to 1.33:1 on
  the field.
- A 1.5 px coral (`obstacle`, `#D68B72`) contour outside the silhouette
  (`contour`): 1.62:1 on the field and 1.22 to 2.14:1 on the body tones.
- On the light field each piece draws over the 1 px ink keyline of the
  [light-field rule](galaxies.md#light-fields) (`debris`): the silhouette,
  contour included, at alpha 0.5, grown by 1 px in all eight directions. Ink
  `#181425` is 10.86:1 on the field, 6.69:1 against the contour and 8.18 to
  14.34:1 against the body tones.
- `radius`: frame px from the pivot to the farthest drawn point over all
  frames, contour included. Each frame's `bounds` is its drawn box in frame
  px, `[minX, minY, maxX, maxY]`, and its `collision` is its drawn silhouette
  ([Collision](#collision)). Damage is a Gameplay value.
- Faces resolve by depth into flat tones under the one light from the upper
  left. The arm and the drum's cap and arm root take steps 1, 3 and 5 of the
  ramp for tops, walls facing left and walls facing right; the pod and the
  drum take steps 2 and 4 and `#87A297`, step 5 lowered by 0.06 Oklab L.
  Each frame is one path per tone, with no seam strokes.

### Direction mark

Tech draws three coral dashes trailing each moving piece (`marks`), in logical
px, 2 px wide. Let `e` be the distance from the centre of the current frame's
`bounds` to the edge of the ellipse with the bounds' half extents along the
reverse screen velocity, as for the [asteroid drift cue](asteroids.md#drift-cue).

| Dash | Length | Alpha | Centre behind `e` | Side (left of travel) |
| ---- | -----: | ----: | ----------------: | --------------------: |
| 0    |      9 |  0.95 |               7.5 |                    -3 |
| 1    |      6 |   0.7 |              14.5 |                     3 |
| 2    |      4 |  0.45 |              21.5 |                     0 |

The dashes lie along the velocity, move with the piece and are drawn under
it. Reduced motion keeps them, static.

## Collision

Each traveling debris frame collides, makes contact and is placed by its drawn
silhouette, contour included: `debris[i].frames[k].collision` beside `file` and
`bounds`, an array of convex parts, each an array of `[x, y]` in frame px of
that piece's frame (the schema of the ship's `collision[k]`). Multiply offsets
from the pivot by `displayScale` for display px.

- `art/tools/debris.ts` traces each frame's visible faces with the
  [shared tracer](ship.md#shared-tracer), grown by half the 6.86 frame px
  contour stroke (3.43), the outermost stroke. Each frame takes the first
  Douglas-Peucker tolerance of 0.75, 0.5, 0.4 and 0.3 frame px that passes the
  0.98 floor. No frame has a notch tip.

| Piece                     | Parts  |
| ------------------------- | ------ |
| `whirlpool-debris-plate`  | 2 to 7 |
| `whirlpool-debris-girder` | 3 to 7 |

Every frame passes the floor.

## Project world changes

Whirlpool's two [community projects](projects.md) change the world at the whale
family and along the whales' current: the current passing nearest the family
destination. Both are passable decoration with no collision: they block neither
Ada nor shots, and Ada draws in front of them while overlapping. Neither appears
on the Map. The calves keep their idle loop and offsets in the beacon's light.

Both are [friendly objects](friendly-redesign.md), drawn from the model layer
in the galaxy's station family palette. The pivot is the float's centre on the
world plane: place it at the world position and sort by its screen y. On
Whirlpool's light field both draw over the 1 px ink keyline of the
[light-field rule](galaxies.md#light-fields) (`nurseryBeacon`, `currentBuoy`).
`node art/tools/friendly.ts` fails unless their lit lamp and cream arm meet
5:1 on the field: on a light field through that keyline, which both must
take, and on a dark field by their fills.

| Change            | Ids                                                        | Frame px | Display      | Pivot           |
| ----------------- | ---------------------------------------------------------- | -------- | ------------ | --------------- |
| Nursery beacon    | `whirlpool-nursery-beacon-a`, `whirlpool-nursery-beacon-b` | 120, 168 | 52.5 by 73.5 | `(0.5, 0.506)`  |
| Current-map buoys | `whirlpool-current-buoy-a`, `whirlpool-current-buoy-b`     | 96, 80   | 42 by 35     | `(0.5, 0.3625)` |

### Nursery beacon

`nurseryBeacon` at the family: a tall drum with one cream arm that climbs it in
under one turn, a lamp on top and a keel below the float.

- Anchor: the family destination (the smaller adult's position) plus world
  `(-68, 60)` (`offset`), screen `(-128, -4)`: ahead of the family's heads,
  with the keel that hangs below the pivot clear of every member's frame, so
  the pivot sort needs no layers.
- A slow breathe, `frameMs` 1400: A lights the lamp; B dims it.
- Light pool (`pool`): four filled world circles, radii 72, 56, 40 and 24,
  centred at world `(-6, 54)` from the family destination, in `#ffe9b8` at
  alpha 0.07 each with frame A and 0.05 with B. Tech draws them on the world
  plane at field level, above the specks and backdrop rocks and below every
  play object, as for the current streaks. The calves lie inside it.

### Current-map buoys

`currentBuoys` along the whales' current: a cream spindle float with a song
band at its waist and a lamp on a short mast. A lights the band and lamp in
the whale glow; B dims both to the whale fin shadows.

- Placement: buoy `k` at arc `s = 64 + 128 k` (`start`, `spacing`) while
  `s <= length - 64`, on both edges at `d = +/-(w / 2 + 20)` (`edge`, `sides`):
  20 outside the edge, where the flow is zero, so buoys sit off the streaks and
  the debris river. A 3000 to 8000 current carries 23 to 62 buoys per edge.
- Chase: at step `floor(t / 300 ms)` (`chase.stepMs`), buoy `k` on either edge
  shows A when `(step - k) mod 4 = 0` (`chase.steps`), otherwise B. One lit
  pair runs downstream per 1.2 s, the whale swim loop, as the song ripple
  lights spot pairs head to tail.

### Reveal and reduced motion

- The reveal follows [projects.md](projects.md#reveal): the after state fades
  in once, as one group, on the first frame its site is on screen; for the
  buoys, every buoy then on screen.
- Reduced motion shows frame A on the beacon, the pool and every buoy.

## Stranded craft

Two craft for Whirlpool's rescue tows, in the whale lilac, glow and buoy cream., drawn by `node art/tools/friendly.ts`. Each craft follows
Cartwheel's [stranded craft](cartwheel-props.md#stranded-craft) schema: the
sixteen enemy headings, the smallest square frame (a multiple of 16 px) with
4 px padding round a centred pivot, no jets and no collision parts. Files are
`/art/whirlpool/{craft}-{k}[-{a,b}].svg`;
[whirlpool/tow.json](../public/art/whirlpool/tow.json), linked from
[Whirlpool's manifest](../public/art/whirlpool/manifest.json) as `tow`, gives each craft's
`frame`, `display`, `blink` and `frameMs`, and `headings[k].tow`, the tow point
in frame px.

| Craft                      | Job subject       | Manifest ids                             | Frame | Display | Frames per heading       | Hull top on field | Keyline |
| -------------------------- | ----------------- | ---------------------------------------- | ----: | ------: | ------------------------ | ----------------: | ------: |
| `stranded-current-skimmer` | a current skimmer | `craft-stranded-current-skimmer-{k}`     |    80 |      35 | one                      |  `#aaa5e6` 1.37:1 | 10.86:1 |
| `stranded-whirlpool-pod`   | a pod             | `craft-stranded-whirlpool-pod-{k}-{a,b}` |    64 |      28 | `a` lit, `b` dim, 700 ms |  `#aaa5e6` 1.37:1 | 10.86:1 |

- Current skimmer: a low lilac lens hull with a whale-glow band `#cbb8ee`, a
  dark bubble canopy, two cream spindle floats on struts and dead twin nozzles
  astern; power off, listing 14 degrees to port and 3 nose up.
- Shell pod: a low lilac rescue capsule in a serrated stabilizer collar.
  Its glow lamp blinks over the dark canopy; reduced motion holds frame A.
- Each tow point is the bow lug's face.

## Data

`currents.json`, version 1: `streaks` holds the values in the streak table
under the names given there.

`debris.json`, version 1: `displayScale` (0.4375), `body`, `contour` (`color`,
`width`), `tumble` (`frames`, `degPerSecond`), `marks` (`color`, `width`,
`dashes[i]` with `length`, `alpha`, `behind`, `side`) and `debris[i]` with
`id`, `frame`, `display`, `pivot`, `radius` and `frames[k]` (`file`,
`bounds`, `collision`). Manifest entries carry `tumbleIndex`, `pivot`, `debris` (the piece
id) and the display size as `displayWidth` and `displayHeight`.

`projects.json`, version 1: `displayScale` (0.4375), `reducedMotion.frame` (0)
and `projects`, keyed by project id. `nurseryBeacon`: `site` (`family`),
`frames` (A, B), `frameMs`, `offset` and `pool` (`color`, `centre`, `radii`,
`alpha` per ring for A and B). `currentBuoys`: `site` (`whalesCurrent`),
`frames` (A, B), `spacing`, `start`, `edge`, `sides` and `chase` (`stepMs`,
`steps`). Offsets and lengths are world units. Manifest entries carry `facing`
`fixed`, `pivot`, `project` and the display size as `displayWidth` and
`displayHeight`; the beacon's also carry `frameMs`.
