# Whirlpool station, currents, debris rivers and project world changes

- Rebuild the station with `node art/tools/whirlpool-station.ts`, and the rest
  with `node art/tools/whirlpool.ts`. It writes `public/art/whirlpool/`:
  `currents.json` (the streak spec), the river debris frames and `debris.json`,
  the project world change frames and `projects.json`, and its own `whirlpool-`
  entries in [Whirlpool's manifest](../public/art/whirlpool/manifest.json),
  which names the data files as `whirlpoolCurrents`, `whirlpoolDebris` and
  `whirlpoolProjects`. Each generator replaces its own entries in place.
- The build fails if the whale's lit hull (`hull[0]` in `whales.json`) falls
  below 3:1 over the streak colour, or if the beacon glass, the lit buoy lamp
  or the cream body falls below 5:1 on the field.
- The debris model is shared in [art/tools/debris.ts](tools/debris.ts); the
  project models are in [art/tools/whirlpool-projects.ts](tools/whirlpool-projects.ts).

## Station

Whirlpool's own station, the Eddy, in place of the shared
[trading station](station.md) at every Whirlpool station. Ada enters it by
Use, the Dock action; it has no dock, mouth or approach lights.

- A pale teal ramp spirals in and up to a tower, as a whirlpool's eddy: 30
  segments over 1.3 turns, radius 66 to 24 model units, 11 wide, rising from 3
  to 16 as it winds in. The turns stay apart, so the spiral reads open.
- Current chevrons on every other ramp segment, 15 in all, point inward along
  the ramp, as the [current streaks](#current-streaks) point downstream.
- A hexagonal tower with two rows of warm windows, a cream cap, a mast and the
  blue beacon; three salvaged debris plates on its skirt, in the river debris'
  field-matter tones.
- An arm toward the viewer ending in the station family's closed collar with
  two warm windows: no mouth.
- The [station](station.md) solid model, projection and culling, in a fixed
  orientation: no headings and no screen rotation. 3.0 Ada wingspans across
  at its widest, as the trading station.

### Frames and manifest

| Field         | Value                                                                                      |
| ------------- | ------------------------------------------------------------------------------------------ |
| Ids           | `whirlpool-station-{k}`, `k` 0 to 3, files `/art/whirlpool/station-{k}.svg`                |
| Frame         | 176 by 128 frame px; display 115.5 by 84 at the [destination scale](destinations.md#scale) |
| Pivot         | `(0.5, 0.4375)`: the tower base on the world plane                                         |
| `facing`      | `fixed`                                                                                    |
| `frameMs`     | 350                                                                                        |
| `destination` | `station`; `frameIndex` `k`                                                                |

- Show frame `k` for 350 ms, 0 to 3 in order, and loop (1.4 s). Frames 0 and
  1 light the mast beacon `#70ace8`, the windows and the collar windows; 2 and
  3 dim them (`#3f5878`, `#a08f78`), the station family's 700 ms blink.
- Chevron `k`, counted from the outer end, is lit `#f7f2ff` on frame `f` when
  `(k + f) mod 4 = 0`, otherwise `#5b8089`, so the lit chevrons step inward one
  place per frame, flowing to the tower.
- Reduced motion holds frame 0.
- Every frame shares one frame size and pivot. Silhouette radius 55.2 and top
  32.5 above the pivot over all four frames, at 1.5x; the Dock callout's centre
  sits 52.5 above the pivot
  ([Destinations](destinations.md#collision-silhouette-dock-and-clearance)).
  Pass-through, with no `collision`, as every destination.
- No project world change attaches to the station: the nursery beacon sits at
  the whale family, 1200 or more from any station, and the current-map buoys
  along the whales' current, which keeps 800 clear of stations.

### Palette

| Role                  | Colour    | On the field |
| --------------------- | --------- | -----------: |
| Tower                 | `#dff6fa` |      12.89:1 |
| Ramp                  | `#c8eef5` |      11.72:1 |
| Tower side            | `#a9cfd8` |       8.69:1 |
| Ramp side             | `#7aa4ae` |       5.34:1 |
| Ramp rear             | `#6d8f97` |       4.15:1 |
| Cap, collar           | `#efe4cf` |      11.49:1 |
| Cap side, collar side | `#bfae94` |       6.68:1 |
| Chevron lit           | `#f7f2ff` |      13.16:1 |
| Chevron unlit, plates | `#5b8089` |       3.37:1 |
| Plate side            | `#3e636c` |       2.21:1 |
| Windows               | `#ffe9b8` |      12.13:1 |
| Windows dim           | `#a08f78` |       4.61:1 |
| Beacon                | `#70ace8` |       6.03:1 |

- The build fails if the tower, ramp, cap, lit chevron, windows or beacon falls
  below 5:1 on the field, Whirlpool's floor for bodies and lamps.
- The silhouette's edge median is 5.34:1, with 92.2% of edge pixels at 3:1 or
  more (librsvg at 1x over the field), above the station edge bar of a 5:1
  median and 90% at 3:1.
- The ramp's teal stays pale, clear of the mint `active` (`#65C9BF`) of ore
  and Stardust, and the station takes no coral `obstacle`.

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
even while `f` shrinks and fades them out. Currents are Whirlpool's, a dark
field: no light-field keyline applies.

Contrast (WCAG) on Whirlpool's `#132D33`:

| Pair                              |  Ratio |
| --------------------------------- | -----: |
| Streak on field                   | 2.11:1 |
| Whale top `#AAA5E6` over a streak | 3.02:1 |
| Whale top on field                | 6.36:1 |
| Debris contour `#D68B72` on field | 5.37:1 |
| Debris contour over a full streak | 2.55:1 |

The streak stays below the signals, a quiet field-level mark, and clear of
the mint `active` (`#65C9BF`) of ore and Stardust.

## River debris

A debris river's pieces are traveling debris and damage on contact, so they
take the coral hazard contour. Two pieces tumble about tilted axes, 8 frames
each:

| Piece                     | Shape                                                | Frame (px) | Display (px)      | Pivot          | `radius` |
| ------------------------- | ---------------------------------------------------- | ---------- | ----------------- | -------------- | -------: |
| `whirlpool-debris-plate`  | A bent hull plate, torn on one edge, folded on a rib | 118 by 115 | 51.625 by 50.3125 | (0.5, 0.50435) |    56.35 |
| `whirlpool-debris-girder` | An I-beam stub with a torn panel riveted to a flange | 108 by 95  | 47.25 by 41.5625  | (0.5, 0.48421) |    50.62 |

- Manifest `{piece}-{k}`, `k` 0 to 7, `tumbleIndex` `k`. Frame `k` shows the
  piece turned `45k` degrees; show frame `floor(angle / 45) mod 8` and pick a
  tumble rate in `tumble.degPerSecond` (60 to 120) per piece. Reduced motion
  shows frame 0; travel still happens. Choose the piece per river rock from
  its seed.
- Body, lit to shadow: `#5B8089`, `#4C717A`, `#3E636C`, `#335860` and
  `#2B4F58` (`body`): Whirlpool's `environmentDetail` lightness plus 0.2,
  0.15, 0.1, 0.06 and 0.03, at its tint hue with 1.3 times its chroma. The rib
  and the girder web sit one tone deeper. Muted field matter, never the
  neutral stone of harmless rocks; 3.37 to 1.63:1 on the field.
- A 1.5 px coral (`obstacle`, `#D68B72`) contour outside the silhouette
  (`contour`): 5.37:1 on the field and 1.59 to 3.30:1 on the body tones.
- `radius`: frame px from the pivot to the farthest drawn point over all
  frames, contour included. Each frame's `bounds` is its drawn box in frame
  px, `[minX, minY, maxX, maxY]`, and its `collision` is its drawn silhouette
  ([Collision](#collision)). Damage is a Gameplay value.
- Faces are flat polygons shaded from the world light `(-0.25, 0.45, 1)` into
  the body ramp (thresholds 0.9, 0.7, 0.45 and 0.15), with a 1.2 frame px seam
  stroke in their own fill.

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

- `art/tools/debris.ts` traces each frame's faces with the
  [shared tracer](ship.md#shared-tracer), grown by half the 6.86 frame px
  contour stroke (3.43), the outermost stroke. Each frame takes the first
  Douglas-Peucker tolerance of 0.75, 0.5, 0.4 and 0.3 frame px that passes the
  0.98 floor. No frame has a notch tip.

| Piece                     | Tolerance             | Parts   | Intersection over union |
| ------------------------- | --------------------- | ------- | ----------------------- |
| `whirlpool-debris-plate`  | 0.75                  | 4 to 7  | 0.984 to 0.993          |
| `whirlpool-debris-girder` | 0.75; 0.5 for frame 3 | 5 to 10 | 0.984 to 0.991          |

Against librsvg renders at 4 px per frame px: 0.981 or more, every boundary
within 1 frame px.

## Project world changes

Whirlpool's two [community projects](projects.md) change the world at the whale
family and along the whales' current: the current passing nearest the family
destination. Both are passable decoration with no collision: they block neither
Ada nor shots, and Ada draws in front of them while overlapping. Neither appears
on the Map. The calves keep their idle loop and offsets in the beacon's light.

Both are fixed flat-shaded solids in the whale convention: world light
`(-0.25, 0.45, 1)`, five-tone ramps (thresholds 0.9, 0.78, 0.6 and 0.3), the
frame projection, 1 frame px own-fill seams on body faces and unstroked decals.
Frames are multiples of 16 px; each SVG's intrinsic size is its display size
(`frame * 0.4375`) and its `viewBox` the frame. The pivot is the float's centre
on the world plane: place it at the world position and sort by its screen y.
Whirlpool is a dark field, so no keyline applies.

| Change            | Ids                                                        | Frame px | Display  | Pivot        |
| ----------------- | ---------------------------------------------------------- | -------- | -------- | ------------ |
| Nursery beacon    | `whirlpool-nursery-beacon-a`, `whirlpool-nursery-beacon-b` | 80, 112  | 35 by 49 | `(0.5, 0.8)` |
| Current-map buoys | `whirlpool-current-buoy-a`, `whirlpool-current-buoy-b`     | 48, 64   | 21 by 28 | `(0.5, 0.8)` |

| Part            | Colour                                                      | On `#132D33`  |
| --------------- | ----------------------------------------------------------- | ------------- |
| Cream body      | `#f7f0e2` to `#9f8f78`, the station family's cream and side | 12.76 to 4.60 |
| Beacon glass    | `#ffe9b8` (A, white core), `#ecc98a` (B, core `#fff6dc`)    | 12.13, 9.16   |
| Buoy lamp, band | Whale glow `#cbb8ee`, core `#f7f2ff` (A); `#4c4585` (B)     | 8.02, 1.72    |
| Light pool      | `#ffe9b8`, four rings                                       | 1.20 to 2.06  |

### Nursery beacon

`nurseryBeacon` at the family: a six-sided lantern with a cream stepped cap on
a mast over a cream cradle float, as its shop icon's lantern over a cradle.

- Anchor: the family destination (the smaller adult's position) plus world
  `(-54, 58)` (`offset`), screen `(-112, 2)`: ahead of the family's heads and
  clear of every member's frame, so the pivot sort needs no layers.
- A slow breathe, `frameMs` 1400: A lights the glass and a tall white core; B
  softens both. The light never goes out.
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
