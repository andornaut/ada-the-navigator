# Cockpit background

- Rebuild with `node art/tools/cockpit.ts` (about 25 s). It writes
  `public/art/cockpit.png` and `cockpit-seated.png`, and their root [manifest](../public/art/manifest.json) entries.
- A painted (anti-aliased) background, not pixel art: shapes are drawn at 3x
  and reduced with Lanczos filtering, then muted.

A close-up of Ada's ship from outside, its opaque canopy the in-game canopy
enlarged, over the in-between field. It sits behind dialogue and the galaxy
selection card.

## View

- The game's isometric projection and face culling
  ([projection.ts](tools/projection.ts)) at ship heading 24 of 32,
  flat-shaded polygons lit from the upper left. The rear
  points toward the viewer, so the tail faces draw after the canopy.
- 9.35 design px per model unit: the ship at 0.85 of the close-up's 11, about
  the canopy focus, so the dome spans canvas rows 175 to 298 and fits the strip
  above the story panel. The lights, lines, glows and blurs scale with it. The
  canopy focus, model point (0, -3, 5.5), lands 150 design px from the top of
  the design frame, centred horizontally.
- Design px: the 844 by 390 design frame is the 779 by 360 logical view of an
  844 by 390 phone (13 design px per 12 logical px).

## Model

The hull is the in-game pyramid from [ship geometry](ship.md): the same plan at
0.32 model units per plan unit, 1.2-unit skirt, shoulder, apex, 76 degree rear
lean and planar faces, copied into the generator so the close-up stays fixed
when the sprite model changes. The faces take the Classic paint by the sprite's
shading rule at heading 24, so the close-up and the `ship-24` frame share every
hull colour: blue walls round the mouths, a white tail with blue-grey shade and
a white-dominant hull. Close-up detail:

- Engine mouths where the sprite has them, a dark blue frame round a light blue
  face inset 0.3 units.
- Two faint plate seams on each wing face, the face colour mixed 45% toward
  the rear side colour.
- Nav lights with soft glows: coral at the port wingtip, teal at the starboard
  wingtip and a smaller blue light at the tail apex.
- The sprite's opaque canopy, finer: the same 9 by 9 plan centred at local Y
  -3, rear edge at the shoulder and level crown 2.8 above the ridge, in 48
  segments and 12 rings. A roof-coloured underlay fills the canopy's outline;
  the rings below 30 degrees are the darker lower band in the canopy side
  colour (lifted up to 25% toward the roof colour where the light falls), the
  rest the roof colour lifted up to 35% toward the highlight by the square of
  the light. The sprite's own two highlight facets (16 segments, rings at 0,
  30, 60 and 90 degrees, the two that best face the light) draw in the
  highlight colour blurred 5 design px into a soft specular patch, with a white
  glint at the brighter one and a thin rim of light along the upper left edge,
  all kept inside the outline. A dark blue seam runs along the near arc where
  the canopy meets the hull. No interior shows.
- The ridge ahead of the canopy is plain hull: no lamp or Astra cue.

| Part        | Colours                                                    |
| ----------- | ---------------------------------------------------------- |
| Hull        | Top `#ffffff`, front sides `#d4dfe9`, rear sides `#abbfce` |
| Walls, band | `#1767b3`                                                  |
| Canopy      | Roof `#2585d0`, highlight `#87bce5`, glint `#ffffff`       |
| Mouths      | Frame `#0f4e8f`, face `#64caff`; seam `#0f4e8f`            |
| Nav lights  | Port `#d68b72`, starboard `#65c9bf`, apex `#70ace8`        |

## Muting

Treatment d keeps the background behind the UI:

1. Gaussian blur of 1.2 design px.
2. 25% desaturation toward ITU-R 601 luma.
3. A haze of the space background `#292734` from 22% opacity at the design
   frame's top to 72% at its bottom, easing in (`0.22 + 0.5 t^2`), held at those
   values above and below the frame.

The in-between field behind the ship is the shimmer of
[shimmer.ts](tools/shimmer.ts) at phase 0: diagonal bands blended through
`#3a2f6b`, `#5f4fa3`, `#7f6abd`, `#9b82d4` and `#c4a6e2`, a faint `#8fe0f2`
tint on the bright crests, soft `#dcc3f2` glows and `#8fe0f2` and `#f3e6ff`
sparkles.

## Canvas and anchor

| Asset            | Size         | Display (logical px) |
| ---------------- | ------------ | -------------------- |
| `cockpit`        | 1920 by 1080 | 960 by 540           |
| `cockpit-seated` | 1920 by 1080 | 960 by 540           |

- 2 image px per logical px. The canvas centre sits on the view centre.
- Scale `max(1, viewWidth / 960, viewHeight / 540)`: the canvas shows at 1x
  in every view up to 960 by 540 and grows only past it, so it always covers
  the view without letterboxing. At 779 by 360 it shows the approved framing.
- The opaque canopy hides the seats, so `cockpit` and `cockpit-seated` are
  the same image under two ids: `cockpit` for the prologue's arrival pages
  before Ada sits, `cockpit-seated` for every page after and for the galaxy
  selection card. The page text carries the change. See
  [storybook](storybook.md#locations).

## Astra speaking

The background has no Astra patch: Astra speaks with her dialogue portrait,
like every other speaker, over either cockpit background.
