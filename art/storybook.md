# Storybook art

- Rebuild with `node art/tools/storybook.ts` (optionally one id). It writes the
  Earth backgrounds to `public/art/story/` and their `story-` root manifest
  entries. `art/tools/diorama.ts` holds the solids, painter and treatment.
- Output is deterministic: the same source writes byte-identical PNGs.

## Canvas

Every storybook background, like the cockpit, is a 960 by 540 logical px canvas
at 2x: a 1920 by 1080 opaque PNG with `displayWidth` 960 and `displayHeight` 540
and the pivot at the centre. Draw it at display size, centred on the view under
the insets. It covers every view up to 960 by 540 (a 720 by 540 4:3 view, an
800 by 360 21:9 phone); scale it up to cover only past that.

Scenes are composed on the 844 by 390 design frame, the 779 by 360 logical view
of an 844 by 390 phone, which sits at the canvas centre (logical x 90.5 to
869.5, y 90 to 450). Taller views reveal more backdrop above and floor or lot
edge below; wider views reveal more backdrop at the sides.

## Style

- Isometric dioramas in the game's projection (`projectAt`, view direction
  (1, 1, 1), +z up): rooms as two back walls on a floor slab, outdoor scenes as
  a 24-unit square lot floating on the backdrop.
- Convex solids are flat-shaded in Oklab: a face loses 0.07 L by its +x normal
  and 0.13 L by its +y normal; the top keeps the material colour. Decals (doors,
  windows, tiles, paths) paint over their face unshaded.
- Painter's order: floor, back walls, then props by depth key. Rendered at 2x
  supersampling and box-downsampled.
- Backdrop: a vertical two-colour ramp down the design frame, held past it.

## Treatment d

Applied after rendering, in order:

1. Gaussian blur, sigma 1.2 design px (2.2 canvas px), as three extended box
   passes per axis.
2. Desaturate 25% toward ITU-R 601 luma.
3. Haze `#efe8ef` composited with alpha `0.18 + 0.45 t^2`, `t` running 0 to 1
   from the design frame's top to its bottom and held past it: 18% at the top,
   63% at the bottom.

The haze is thickest under the story panel, so prose sits on the lightest band
and the scene's subject stays clearest above it.

## Locations

| Id                          | Scene                                                 | Backdrop              | Key colours                                                         |
| --------------------------- | ----------------------------------------------------- | --------------------- | ------------------------------------------------------------------- |
| `story-park`                | Park: pond, bench, three trees, the dig spot and rock | `#cfe4e8` → `#dfeadb` | grass `#8cc777`, path `#e8d3a2`, pond `#8fc8de`, rock `#93877e`     |
| `story-ada-room-unpolished` | Ada's room, the rock on the desk as dug up            | `#d9d2e6` → `#cfc5de` | wall `#e6d6ea`, floor `#d9b98f`, blanket `#8fb0e2`, rock `#93877e`  |
| `story-ada-room`            | Ada's room, the polished rock's faint glowing pattern | `#d9d2e6` → `#cfc5de` | as above, glow line `#53d1c2`, glow `#96ecde`                       |
| `story-grandma-garden`      | Grandma's house, fence, raised beds in bloom, tree    | `#bfe0e8` → `#d9ecd6` | grass `#86c46f`, wall `#f0d7a8`, roof `#d06a55`, blooms `#ef7f8f`   |
| `story-community-garden`    | Fenced lot: shed, one sprouting and two empty beds    | `#d3dfe6` → `#dfe6dc` | ground `#cfae82`, patches `#a9c98b`, shed `#b49ad6`, bin `#6f9a7a`  |
| `story-schoolyard`          | School, hopscotch, play structure and slide, tree     | `#cfe0ea` → `#dde6e4` | asphalt `#b6aebf`, brick `#d48f7e`, slide `#f2c95c`, bars `#ea8f84` |
| `story-school-hallway`      | Lockers, notice board, two doors, bench               | `#c7d3e6` → `#a9b8d2` | wall `#f1e3c6`, lockers `#5fb3a6`, floor `#d8c29c`, bench `#7d8fc0` |
| `story-front-door`          | Front door, coats and lead, shoe rack, dog's bowl     | `#e6dccd` → `#dcd0c0` | door `#a98bc4`, floor `#d6b48e`, coats `#f0c95e` and `#86ade0`      |

Full palettes are in the generator. Colours are before treatment d.

## Pages

Gameplay owns the page sequence and copy. Each page names one background; the
[storybook page layout](layout.md#storybook-page) places the panel over it:
bottom-anchored on the available rect, sized to its own content, no dim. The
background never moves or scales between pages of a scene. Choice pages reuse
their scene's background (Grandma's choice uses `story-grandma-garden`).
