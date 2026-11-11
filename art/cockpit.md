# Cockpit background

- Rebuild with `node art/tools/cockpit.ts` (about 25 s). It writes
  `public/art/cockpit.png`, `cockpit-seated.png` and `cockpit-astra.png`, and
  their root [manifest](../public/art/manifest.json) entries.
- A painted (anti-aliased) background, not pixel art: shapes are drawn at 3x
  and reduced with Lanczos filtering, then muted.

A close-up of Ada's ship from outside, with the cockpit seen through its clear
canopy, over the in-between field. It sits behind dialogue and the galaxy
selection card.

## View

- The game's isometric projection and face culling
  ([projection.ts](tools/projection.ts)) at ship heading 24 of 32,
  flat-shaded polygons lit from the upper left. The rear
  points toward the viewer, so the tail faces draw after the canopy.
- 11 design px per model unit. The canopy focus, model point (0, -3, 5.5),
  lands 150 design px from the top of the design frame, centred horizontally.
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
- The sprite's canopy made clear: the same 9 by 9 plan centred at local Y -3,
  rear edge at the shoulder and level crown 2.8 above the ridge, in 48 segments
  and 12 rings. The glass is the canopy roof colour lifted toward the highlight
  where the light falls; the rings below 30 degrees are a denser sill in the
  canopy side colour. Back glass draws before the interior, front glass after
  it, then a light silhouette edge and a soft highlight on the upper left. A
  dark blue seam runs where the canopy meets the hull: the far arc behind the
  tub, the near arc over the glass.
- Inside, clipped to the canopy outline: a tub sunk into the hull, its floor
  at z 3.8 and at least 0.4 under the hull surface, with dark inner walls; a
  dash, centre console and two teal seats with pedestals, cushions and reclined
  backrests with cream caps. Ada's seat is port (upper left on screen),
  Penny's starboard.
- Astra's rose-gold lens on the dash's rear face, model point (0, -9, 5.3).
- Seated variant: the tops of Ada's head (navy hair, pink bow) and Penny's
  (golden head, orange ears) over the seat backs.

| Part         | Colours                                                       |
| ------------ | ------------------------------------------------------------- |
| Hull         | Top `#ffffff`, front sides `#d4dfe9`, rear sides `#abbfce`    |
| Walls, sill  | `#1767b3`                                                     |
| Canopy glass | `#2585d0` toward highlight `#87bce5`                          |
| Mouths       | Frame `#0f4e8f`, face `#64caff`; seam `#0f4e8f`               |
| Nav lights   | Port `#d68b72`, starboard `#65c9bf`, apex `#70ace8`           |
| Tub walls    | `#1d2234`, `#262b44`, `#3a4466`, `#5a6988`                    |
| Seats        | `#2f6a6e`, `#3d8084`, `#4f9ea3`, `#6cb8b9`; outline `#2c5f63` |
| Seat caps    | `#b8ad9a`, `#d9cbb1`, `#efe4cf`                               |
| Floor, dash  | `#5a6988`, `#6d7b98`, `#8b9bb4`                               |
| Astra lens   | Bezel `#d9a08a`, glass `#3b2a3f`, ember `#9a6470`             |
| Astra glow   | Halo `#ffc9a8`, core `#fff1e0`                                |

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
- `cockpit` is empty, for the prologue's arrival pages before Ada sits;
  `cockpit-seated` shows Ada and Penny in their seats, for every page after
  and for the galaxy selection card. See
  [storybook](storybook.md#locations).

## Astra speaking

`cockpit-astra` holds four speaking frames as opaque patches over the lens and
its warm halo: 78 by 74 image px (39 by 37 logical px) each, frames `speak1` to
`speak4`, 120 ms each (480 ms loop, the `loop` list).

- Draw the current frame over either background with the background's
  transform, its top-left at `at`, (513, 182) logical px on the canvas. The
  heads never reach the patch, so one set serves both.
- Idle: no patch (the dim ember in the background).
- Reduced motion: `speak1` held while Astra speaks.
