# Stardust

- Rebuild with `node art/tools/stardust.ts`. It writes the pickup sheet
  `public/art/stardust.png` with its Aseprite data `stardust.json`, the HUD icon
  sheets in `public/art/ui/sprites/`, and the `stardust` root manifest entry.
  JSON goes through the project's Prettier settings.
- Pixel art from character grids, like the [settings icons](settings-icons.md).
  Every pixel is opaque or clear; draw with nearest-neighbour filtering.

## Colour

Mint green, the only free hue band between weapon amber and active teal; no other
space signal uses green.

| Role       | Colour    |
| ---------- | --------- |
| Light      | `#d2fbdf` |
| Body       | `#8ee8a8` |
| Shade      | `#52b47e` |
| Glint core | `#ffffff` |

## Pickup

Every pickup looks the same regardless of the Stardust it carries.

- Root manifest id `stardust`: a 36 by 9 sheet of 9 by 9 frames, displayed at
  9 by 9 logical px with the pivot at the centre. `frames` names `rest` (0),
  `glint1` (1) and `glint2` (2).
- The resting gem is 7 by 7 px; the glint grows four rays to the full 9 px.
- Glint loop (`loop`, and the sheet's `glint` tag): rest 420 ms, glint1 60 ms,
  glint2 80 ms, glint1 60 ms; 620 ms in all. Each pickup starts at a random phase
  so a cluster twinkles out of step.
- Reduced motion: the rest frame only.
- The tractor beam has no visual. A pulled pickup's drift toward Ada is the only
  feedback.

### Optional pull streak

While a pickup is pulled, a 1 px fading streak may trail it, 6 px past the gem
edge. Plot single pixels behind the centre, opposite the pull direction, at
distances 3.5 to 9.5 px in 0.5 px steps. For `f = (distance - 3.5) / 6`, the colour
is body for `f < 0.5` and shade after, with alpha `(210 (1 - f) + 40) / 255`.
Reduced motion draws no streak.

## HUD icon

| Key                | Size     | Use                                       |
| ------------------ | -------- | ----------------------------------------- |
| `icon-stardust`    | 16 by 16 | Price pills                               |
| `icon-stardust-20` | 20 by 20 | HUD count, balances and the confirm price |

One large sparkle with a small sparkle and a dust mote, in the four Stardust
colours on a clear background. Both are UI subset sprites with a single `rest`
frame.

## HUD count

A pill left of the top-right weapon buttons, 6 px from them and vertically
centred on them, in logical px:

- Ink `#181425` fill, 26 px high, corner radius 6, 7 px side padding.
- `icon-stardust-20`, 4 px gap, then the count in bold cream `#ead4aa` at 15 px.
- The pill grows leftward with the count; its right edge stays fixed.
