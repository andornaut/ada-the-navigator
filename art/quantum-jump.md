# Quantum jump

- Rebuild with `node art/tools/quantum-jump.ts`. It writes the effect data
  `public/art/quantum-jump.json`, three sheets in `public/art/`, their root
  [manifest](../public/art/manifest.json) entries and the manifest's
  `quantumJump` path.
- Every quantum jump uses this one effect: galaxy jumps, travel to discovered
  destinations, jumping home and Astra's emergency jump when the shield fails.
  Jumping home opens the iris on Ada's room; a jump to a new galaxy opens on
  its arrival point.

## Timeline

Seven frames, 1000 ms in all. Each frame holds for its duration; nothing tweens
between frames. The data's `frames` list holds the same values.

| Frame  | Start  | Duration | Shows                                                                                                 |
| ------ | ------ | -------- | ----------------------------------------------------------------------------------------------------- |
| space  | 0 ms   | 100 ms   | The source scene, unchanged                                                                           |
| charge | 100 ms | 150 ms   | Glow `full` round the ship; specks streak toward it (1.0)                                             |
| close  | 250 ms | 150 ms   | The in-between closes in from the edges: iris reach 0.645, field `close`, ship 30% white, streaks 1.4 |
| tight  | 400 ms | 120 ms   | Iris tight round the ship: radius 66, field `tight`, ship 70% white                                   |
| jump   | 520 ms | 80 ms    | The only bright frame: field `jump` over the whole view, the star, no ship                            |
| open   | 600 ms | 300 ms   | The iris opens on the destination: radius 120, field `open`, glow `mid`, ship 60% white               |
| clear  | 900 ms | 100 ms   | Only the corners remain: iris reach 0.925, field `clear`, glow `low`                                  |

After 1000 ms the destination shows unchanged.

## Rendering

Draw each frame bottom to top:

1. The scene: the source until `jump`, the destination (`destination: true`)
   after it, with the ship at its usual place.
2. Streaks (`streak`): every background speck draws a 1 px `#4a4858` line from
   itself toward the ship, `7 * streak` logical px long. A view without specks
   draws none.
3. The `quantum-jump-glow` frame named by `glow`, centred on the ship, under it.
4. The ship. `white` overlays a white silhouette of the current ship frame at
   that alpha.
5. The iris (`iris`): the `field` frame covers the view outside a circle
   centred on the ship. Its radius is `reach` times the view's half-diagonal,
   or `radius` logical px. A 3 px `#dcc3f2` rim fills radii r to r + 3, and a
   1 px `#8fe0f2` line sits at r + 5.
6. The `jump` frame: its field covers the whole view, no scene or ship, and
   `quantum-jump-star` centred on the ship's place.

The field canvas is 960 by 540 logical px at 1 image px per logical px,
centred on the view at scale `max(1, viewWidth / 960, viewHeight / 540)`, the
storybook background rule in [Layout](layout.md#storybook-page).

| Id                   | Frames                                                                         | Size                        |
| -------------------- | ------------------------------------------------------------------------------ | --------------------------- |
| `quantum-jump-field` | `close`, `tight`, `jump`, `open`, `clear`, `still`, `still-emergency`, stacked | 960 by 540 each, opaque     |
| `quantum-jump-glow`  | `full`, `mid`, `low`, `emergency`                                              | 112 by 112 each, soft alpha |
| `quantum-jump-star`  | `jump`                                                                         | 37 by 37, opaque or clear   |

Display every frame at its image size in logical px, pivot at the centre.

### Emergency jump

Astra's emergency jump when the shield fails tints only the charge frame red:
glow `emergency` (`#e43b44`) instead of `full`, and a `#e43b44` wash at 15%
over the whole view. Every other frame is unchanged. Its reduced-motion version
holds `still-emergency`, the still in-between with the same 15% red.

### Reduced motion

A 900 ms cross-fade through a still, darkened in-between, with no iris,
streaks, glow, whitening, star or flash. The ship fades with its scene and does
not move.

| Time          | Shows                                             |
| ------------- | ------------------------------------------------- |
| 0 to 100 ms   | The source scene                                  |
| 100 to 400 ms | Linear cross-fade from the source to `still`      |
| 400 to 550 ms | `still`, held                                     |
| 550 to 750 ms | Linear cross-fade from `still` to the destination |
| 750 to 900 ms | The destination                                   |

`still` is the field at 25% band contrast with no sparkle, blended 45% toward
the space background `#292734`, so the luminance change stays gentle.

## Flashing

One bright frame (80 ms) per jump, so at most one flash per second, well under
three. The emergency charge frame adds one red-tinted frame, still under three.

## In-between field

The field frames are the shimmer of [shimmer.ts](tools/shimmer.ts) at phases
0, 0.18, 0.36, 0.54 and 0.7, so it drifts between frames; `jump` is phase 0.36
blended 22% toward `#dcc3f2`. Diagonal sine bands blend through `#3a2f6b`,
`#5f4fa3`, `#7f6abd`, `#9b82d4` and `#c4a6e2`, with a faint `#8fe0f2` tint on
the bright crests, soft `#dcc3f2` glows and `#8fe0f2` and `#f3e6ff` sparkles
that twinkle with the phase. The aboard backdrop uses phase 0.

## Colour

| Role                | Colour                                                                                                               |
| ------------------- | -------------------------------------------------------------------------------------------------------------------- |
| In-between ramp     | `#1f1a38`, `#3a2f6b`, `#5f4fa3`, `#9b82d4`, `#dcc3f2` ([space palette](space-palette.md#in-between))                 |
| Shimmer             | `#8fe0f2`                                                                                                            |
| Iris rim, star arms | `#dcc3f2`                                                                                                            |
| Iris outer line     | `#8fe0f2`                                                                                                            |
| Charge glow         | `#a8dcff`: for level g (1, 0.6, 0.2), a disc of alpha `120 g` and radius `24 + 9.23 g` logical px, blurred by 7.4 px |
| Emergency           | `#e43b44`                                                                                                            |
| Streaks             | `#4a4858`                                                                                                            |
