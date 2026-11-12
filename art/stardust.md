# Stardust

- Rebuild with `node art/tools/stardust.ts`. It writes the pickup sheet
  `public/art/stardust.png` with its Aseprite data `stardust.json`, the HUD icon
  sheets in `public/art/ui/sprites/`, and the `stardust` root manifest entry.
  JSON goes through the project's Prettier settings.
- Pixel art from character grids, like the [settings icons](settings-icons.md).
  Every pixel is opaque or clear; draw with nearest-neighbour filtering.

## Colour

Pale gold-white: a light glinting star, apart from ore's matte ember brown
([ore nugget](cartwheel-props.md#ore-nugget)) by silhouette, colour, surface,
size and lightness, so the two read apart in greyscale too.

| Role       | Colour    |
| ---------- | --------- |
| Glint core | `#ffffff` |
| Light      | `#fff2cc` |
| Body       | `#f4d98a` |
| Shade      | `#c8a24e` |

| Field     | Body    | Shade  |
| --------- | ------- | ------ |
| Base      | 10.56:1 | 6.09:1 |
| Cartwheel | 10.65:1 | 6.14:1 |
| Whirlpool | 10.43:1 | 6.02:1 |
| Needle    | 11.37:1 | 6.56:1 |
| Andromeda | 10.62:1 | 6.13:1 |
| Black Eye | 12.51:1 | 7.21:1 |

On Sunflower's light field the pickup draws over the ink keyline
([Light fields](galaxies.md#light-fields)), 10.90:1. The body is 0.07 from the
weapon pickup's amber `#F0BD68` in Oklab: the weapon pickup is a square with a
glyph and darker, the Stardust a small star.

## Pickup

Every pickup looks the same regardless of the Stardust it carries.

- Root manifest id `stardust`: a 36 by 9 sheet of 9 by 9 frames, displayed at
  9 by 9 logical px with the pivot at the centre. `frames` names `rest` (0),
  `glint1` (1) and `glint2` (2).
- A small four-point star lit from the upper left: at rest a 5 by 5 star in the
  frame's middle, its core white; `glint1` lengthens the rays to 7 by 7, and
  `glint2` whitens the core and reaches the full 9 px.
- Glint loop (`loop`, and the sheet's `glint` tag): rest 420 ms, glint1 60 ms,
  glint2 80 ms, glint1 60 ms; 620 ms in all. Each pickup starts at a random phase
  so a cluster twinkles out of step.
- Reduced motion: the rest frame only.
- Collision: each frame of `stardust.json` carries `collision`, its drawn
  silhouette: an array of convex parts, each an array of `[x, y]` in frame px of that
  frame (one frame px is one display px), the schema of the ship's
  `collision[k]`. Traced by the
  [shared tracer](ship.md#shared-tracer) at 0.4 frame px, the first of the
  ladder that passes: `rest` 7 parts at 0.4 (intersection over union 0.990),
  `glint1` 7 parts at 0.5 (0.985), `glint2` 12 parts at 0.4 (0.991). Frames 1
  and 3 are both `glint1`, so they carry the same parts.
- The tractor beam has no visual. A pulled pickup's drift toward Ada is the only
  feedback.

### Optional pull streak

While a pickup is pulled, a 1 px fading streak may trail it, 6 px past the resting
star's edge. Plot single pixels behind the centre, opposite the pull direction, at
distances 2.5 to 8.5 px in 0.5 px steps. For `f = (distance - 2.5) / 6`, the colour
is body for `f < 0.5` and shade after, with alpha `(210 (1 - f) + 40) / 255`.
Reduced motion draws no streak.

## HUD icon

| Key                | Size     | Use                                             |
| ------------------ | -------- | ----------------------------------------------- |
| `icon-stardust`    | 16 by 16 | Price pills                                     |
| `icon-stardust-20` | 20 by 20 | HUD status pill, balances and the confirm price |

One large four-point star and two small ones, in the four Stardust colours on
a clear background. Both are UI subset sprites with a single `rest` frame.

## HUD count

The count shares the HUD status pill with the shield bar, beside the pause
button: `icon-stardust-20` and the count in bold cream `#ead4aa`, with a gold
`+N` tick (`#f4d98a`, the body) on pickup. Geometry and timing are `STATUS_PILL` in
[Layout](layout.md#status-pill); colours are in
[Controls](controls.md#status-pill).
