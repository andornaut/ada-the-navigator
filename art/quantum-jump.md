# Quantum jump

- Rebuild with `node art/tools/quantum-jump.ts`. It writes the effect data
  `public/art/quantum-jump.json`, four sheets in `public/art/` (field, glow,
  star and tunnel), the warp ship frames in `public/art/quantum-jump-ship/`,
  the sheets' root [manifest](../public/art/manifest.json) entries and the
  manifest's `quantumJump` path.
- Every quantum jump uses this one effect, the warp: galaxy jumps from the
  route map, Travel to discovered destinations, Return to Earth and Astra's
  emergency jump when the shield fails. Boarding from Ada's room is the rock's
  glow, not a jump.
- Ada's ship shows in every jump, drawn from the shared
  [ship model](ship.md) in the selected paint.

## Timeline

1000 ms in seven phases. The game switches to the destination at 520 ms, the
start of the `jump` phase, the only bright one. Each phase holds a list of
steps (`steps`); each step holds for its `ms`, and nothing tweens between
steps. The data's `frames` list holds the phases and their steps.

| Phase  | Start  | Steps                  | Shows                                                                                                                                    |
| ------ | ------ | ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| space  | 0 ms   | 100                    | The source scene, unchanged                                                                                                              |
| charge | 100 ms | 50, 50, 50             | The ship turns to the arrival heading through its sprite frames; glow `full`; specks streak toward it (1.0)                              |
| close  | 250 ms | 50, 50, 50             | The tunnel closes from the edges (opening 0.86, 0.74, 0.62 of the half-diagonal); the ship banks 8, 16, 24 degrees at 1.25x, 1.55x, 1.9x |
| tight  | 400 ms | 60, 60                 | The tunnel over the whole view; the ship banked 30 degrees with thrust at 2.6x, then 3.2x                                                |
| jump   | 520 ms | 80                     | The bright tunnel; the ship stretched 3.2x along its heading at 3.3x, 70% white, under the star                                          |
| open   | 600 ms | 50, 50, 50, 50, 50, 50 | The destination opens round the ship (radius 46, 90, 140, 196, 258, 320); the ship unbanks, unstretches and settles to 1.1x              |
| clear  | 900 ms | 50, 50                 | Only the corners remain (opening 0.86, 0.96 of the half-diagonal); the ship at its in-game size                                          |

After 1000 ms the destination shows unchanged.

## Rendering

The jump centre is the flight ship's place, the play view's centre, in every
jump. Draw each step bottom to top:

1. The scene: the source until 520 ms, the destination (`destination: true`)
   after it, with the scene's own ship hidden from the first step with a
   `ship`.
2. Streaks (`streak`): every background speck draws a 1 px `#4a4858` line from
   itself toward the jump centre, `7 * streak` logical px long. A view without
   specks draws none.
3. The tunnel (`tunnel`, a `quantum-jump-tunnel` frame): outside the opening
   circle centred on the jump centre when the step has `iris`, else over the
   whole view. The opening's radius is `reach` times the view's half-diagonal,
   or `radius` logical px. A 3 px `#dcc3f2` rim fills radii r to r + 3, and a
   1 px `#8fe0f2` line sits at r + 5.
4. The `quantum-jump-glow` frame named by `glow`, centred on the jump centre.
5. The warp ship (`ship`), centred on the jump centre, then its whitening:
   a white silhouette of the drawn ship at alpha `white`.
6. The star (`star: true`): `quantum-jump-star`, centred on the jump centre.

The tunnel canvas is 960 by 540 logical px at 1 image px per logical px,
centred on the jump centre at scale
`max(1, 2 * max(cx, viewWidth - cx) / 960, 2 * max(cy, viewHeight - cy) / 540)`
for a jump centre (cx, cy), so it covers the view. Display every sheet frame
at its image size in logical px times that scale for the tunnel, pivot at the
centre.

### Warp ship

A step's `ship` names a `pose`, a `scale` and an optional `white`.

- `pose: "sprite"` draws the in-game idle frame (`ship-N`, or the selected
  paint's `ship-{scheme}-N`) at `scale` times its display size. Its heading is
  the source ship's heading turned `turn` of the shortest way to the arrival
  heading, rounded to a whole frame; without `turn`, the arrival heading.
- Any other pose draws that pose's SVG for the selected paint, from
  `warp.poses[].paths`, at `scale * warp.frame * warp.displayScale` logical
  px square (112 at scale 1, the in-game size), as vector art at that size.

| Pose         | Roll | Stretch | Squash | Thrust |
| ------------ | ---: | ------: | -----: | ------ |
| `bank-8`     |    8 |       1 |      1 | No     |
| `bank-16`    |   16 |       1 |      1 | Yes    |
| `bank-24`    |   24 |       1 |      1 | Yes    |
| `bank-30`    |   30 |       1 |      1 | Yes    |
| `stretch-30` |   30 |     3.2 |   0.85 | Yes    |
| `settle-24`  |   24 |     1.8 |      1 | Yes    |
| `settle-16`  |   16 |     1.3 |      1 | Yes    |
| `settle-10`  |   10 |     1.1 |      1 | Yes    |
| `settle-5`   |    5 |       1 |      1 | No     |

- Every pose faces the arrival heading, 24 (`warp.heading`), the heading a
  flight starts on (facing (0, -1)), and draws from the shared ship model in
  all six paints: `quantum-jump-ship/{scheme}/{pose}.svg`, 256 frame px
  square, pivot at the centre, frame px times `warp.displayScale` (0.4375) at
  scale 1. Thrust poses carry the model's thrust flames.
- From the route map the charge steps draw the sprite at the jump centre,
  turning from the heading the route map ship shows.
- A flight destination arrives with the ship at heading 24 at the jump centre,
  where the warp ship ends.
- A destination without the ship (Ada's room after Return to Earth or the
  emergency jump) draws no warp ship from 520 ms: the ship leaves in the jump
  flash and the room opens without it.

### Emergency jump

Astra's emergency jump when the shield fails tints only the charge steps red:
glow `emergency` (`#e43b44`) instead of `full`, and a `#e43b44` wash at 15%
over the whole view. Every other step is unchanged. Its reduced-motion version
holds `still-emergency`, the still in-between with the same 15% red.

### Reduced motion

A 900 ms cross-fade through a still, darkened in-between, with no tunnel,
streaks, glow, bank, stretch, whitening, star or flash. The switch is at
400 ms, when `still` covers the view.

| Time          | Shows                                             |
| ------------- | ------------------------------------------------- |
| 0 to 100 ms   | The source scene                                  |
| 100 to 400 ms | Linear cross-fade from the source to `still`      |
| 400 to 550 ms | `still`, held                                     |
| 550 to 750 ms | Linear cross-fade from `still` to the destination |
| 750 to 900 ms | The destination                                   |

The ship holds still at the jump centre above the cross-fade, at its source
heading and in-game size, until 550 ms (`reducedMotion.ship.holdToMs`), then
cross-fades into the destination's ship by 750 ms (`crossFadeToMs`), or out
on a destination without it. From the route map it holds the route map ship's
heading.

`still` is the field at 25% band contrast with no sparkle, blended 45% toward
the space background `#292734`, so the luminance change stays gentle. It
draws at the field canvas rule: 960 by 540 logical px centred on the view at
scale `max(1, viewWidth / 960, viewHeight / 540)`.

## Flashing

One bright step (80 ms) per jump, so at most one flash per second, well under
three. The emergency charge steps add one red-tinted phase, still under three.

## In-between field and tunnel

The field frames are the shimmer of [shimmer.ts](tools/shimmer.ts) at phases
0, 0.18, 0.36, 0.54 and 0.7; `jump` is phase 0.36 blended 22% toward
`#dcc3f2`. Diagonal sine bands blend through `#3a2f6b`, `#5f4fa3`, `#7f6abd`,
`#9b82d4` and `#c4a6e2`, with a faint `#8fe0f2` tint on the bright crests,
soft `#dcc3f2` glows and `#8fe0f2` and `#f3e6ff` sparkles.

The tunnel wraps the phase 0 field round the canvas centre: angle to field x
and depth (5200 over the radius) to field y, both mirrored because the field
does not tile, sampled bilinearly. It darkens toward `#1f1a38` by
`0.75 (1 - r / 150)^1.5`, reaching the full colour at the centre within 40 px.
70 streaks run outward in `#dcc3f2` and `#8fe0f2` (one in three), 1 px, 2 px
past 60% of their run, their alpha rising with radius. Frames `t0` to `t5`
loop: each advances the depth a sixth of the mirrored period and every streak
one or two laps per loop. `jump` is the next loop frame blended 22% toward
`#dcc3f2`. The steps run `t0` to `t4` through close and tight, `jump`, then
`t0` to `t5` and `t0` to `t1` from open.

| Id                    | Frames                                                                         | Size                        |
| --------------------- | ------------------------------------------------------------------------------ | --------------------------- |
| `quantum-jump-tunnel` | `t0` to `t5`, `jump`, stacked                                                  | 960 by 540 each, opaque     |
| `quantum-jump-field`  | `close`, `tight`, `jump`, `open`, `clear`, `still`, `still-emergency`, stacked | 960 by 540 each, opaque     |
| `quantum-jump-glow`   | `full`, `mid`, `low`, `emergency`                                              | 112 by 112 each, soft alpha |
| `quantum-jump-star`   | `jump`                                                                         | 37 by 37, opaque or clear   |

## Data

`quantum-jump.json` version 1:

- `durationMs`; `frames`, the phases in order, each with `name`, `startMs`,
  `ms`, `destination` and `bright` where set, and `steps`.
- A step: `ms`, and any of `tunnel` (a tunnel frame name), `iris`
  (`{ reach }` or `{ radius }`), `glow`, `streak`, `star: true` and `ship`
  (`{ pose, scale, turn?, white? }`). A phase's steps' `ms` sum to its `ms`.
- `warp`: `heading` (24), `frame` (256), `displayScale` (0.4375), `tunnel`
  (the sheet id) and `poses`, each with `id`, `roll`, `stretch`, `squash`,
  `thrust` and `paths` (one SVG path per paint scheme id).
- `iris` (`rim`, `line`), `streak`, `emergency` and `reducedMotion`
  (`durationMs`, `still`, `steps`, `ship`) as above.
- CLEANUP (added 2026-11-12): each phase also keeps `iris`, `field`, `white`,
  `streak`, `glow` and `star` for the renderer that draws one hold per phase,
  with the field frames `close`, `tight`, `jump`, `open` and `clear`. Remove
  them from the data, the field sheet and this list once the game draws the
  steps.

## Colour

| Role                | Colour                                                                                                               |
| ------------------- | -------------------------------------------------------------------------------------------------------------------- |
| In-between ramp     | `#1f1a38`, `#3a2f6b`, `#5f4fa3`, `#9b82d4`, `#dcc3f2` ([space palette](space-palette.md#in-between))                 |
| Shimmer             | `#8fe0f2`                                                                                                            |
| Iris rim, star arms | `#dcc3f2`                                                                                                            |
| Iris outer line     | `#8fe0f2`                                                                                                            |
| Tunnel streaks      | `#dcc3f2`, `#8fe0f2`                                                                                                 |
| Charge glow         | `#a8dcff`: for level g (1, 0.6, 0.2), a disc of alpha `120 g` and radius `24 + 9.23 g` logical px, blurred by 7.4 px |
| Emergency           | `#e43b44`                                                                                                            |
| Speck streaks       | `#4a4858`                                                                                                            |
