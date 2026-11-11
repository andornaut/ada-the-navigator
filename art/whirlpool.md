# Whirlpool currents and debris rivers

- Rebuild with `node art/tools/whirlpool.ts`. It writes `public/art/whirlpool/`:
  `currents.json` (the streak spec), the river debris frames and `debris.json`,
  and its own `whirlpool-` entries in
  [Whirlpool's manifest](../public/art/whirlpool/manifest.json), which names the
  data files as `whirlpoolCurrents` and `whirlpoolDebris`.
- The build fails if the whale's lit hull (`hull[0]` in `whales.json`) falls
  below 3:1 over the streak colour.
- The debris model is shared in [art/tools/debris.ts](tools/debris.ts).

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
  px, `[minX, minY, maxX, maxY]`. Collision radius and damage are Gameplay
  values.
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

## Data

`currents.json`, version 1: `streaks` holds the values in the streak table
under the names given there.

`debris.json`, version 1: `displayScale` (0.4375), `body`, `contour` (`color`,
`width`), `tumble` (`frames`, `degPerSecond`), `marks` (`color`, `width`,
`dashes[i]` with `length`, `alpha`, `behind`, `side`) and `debris[i]` with
`id`, `frame`, `display`, `pivot`, `radius` and `frames[k]` (`file`,
`bounds`). Manifest entries carry `tumbleIndex`, `pivot`, `debris` (the piece
id) and the display size as `displayWidth` and `displayHeight`.
