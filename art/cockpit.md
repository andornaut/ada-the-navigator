# Cockpit background

- Rebuild with `node art/tools/cockpit.ts` (about 25 s). It writes
  `public/art/cockpit.png`, `cockpit-seated.png` and `cockpit-astra.png`, and
  their root [manifest](../public/art/manifest.json) entries.
- A painted (anti-aliased) background, not pixel art: shapes are drawn at 3x
  and reduced with Lanczos filtering, then muted.

A close-up of Ada's ship from outside, with the cockpit seen through its clear
bubble canopy, over the in-between field. It sits behind dialogue and the galaxy
selection card.

## View

- The game's isometric projection and face culling
  ([projection.ts](tools/projection.ts)) at heading 12, flat-shaded polygons
  lit from the upper left.
- 11 design px per model unit. The canopy focus, model point (0, -3, 5.5),
  lands 150 design px from the top of the design frame, centred horizontally.
- Design px: the 844 by 390 design frame is the 779 by 360 logical view of an
  844 by 390 phone (13 design px per 12 logical px).

## Model

The silhouette is the in-game hull plan from `art/tools/ship.ts` at 0.32 model
units per plan unit, copied into the generator so the close-up stays fixed when
the sprite model changes. Close-up detail:

- Hull slab, 4 units high, with a chamfered top edge and a white top.
- Raised fuselage along the centreline that carries the canopy.
- Dorsal spine from the canopy to the fin.
- Tall swept tail fin with a blue cap band and a blue leading-edge strip.
- Octagonal thruster nacelles over the two engine mouths, with tapered fronts,
  dark intakes, blue exhaust rings and light blue mouths.
- Two dark vents beside the canopy.
- Plate seams, one teal pinstripe per side and blue wing-edge trim.
- Nav lights with soft glows: coral at the port wingtip, teal at the starboard
  wingtip, blue at the fin tip.
- Tessellated glass bubble canopy: back and front glass tinted by light, a
  light silhouette edge, a blue rim band and a soft highlight.
- Inside the tub: floor, dash, centre console and two teal seats with
  pedestals, cushions and reclined backrests with cream caps. Ada's seat is
  port (upper left on screen), Penny's starboard.
- Astra's rose-gold lens on the dash.
- Seated variant: the tops of Ada's head (navy hair, pink bow) and Penny's
  (golden head, orange ears) over the seat backs.

| Part        | Colours                                                       |
| ----------- | ------------------------------------------------------------- |
| Hull white  | `#9aabbf`, `#abbfce`, `#c3d1de`, `#d4dfe9`, `#ffffff`         |
| Blue        | `#0f4e8f`, `#1767b3`, `#2585d0`, `#4f9fe0`                    |
| Dark        | `#1d2234`, `#262b44`, `#3a4466`, `#5a6988`                    |
| Seats       | `#2f6a6e`, `#3d8084`, `#4f9ea3`, `#6cb8b9`; outline `#2c5f63` |
| Seat caps   | `#b8ad9a`, `#d9cbb1`, `#efe4cf`                               |
| Floor, dash | `#5a6988`, `#6d7b98`, `#8b9bb4`                               |
| Seams       | `#c9d4e0`; pinstripe `#6fb7b3`; trim `#2585d0`                |
| Mouths      | `#64caff`                                                     |
| Astra lens  | Bezel `#d9a08a`, glass `#3b2a3f`, ember `#9a6470`             |
| Astra glow  | Halo `#ffc9a8`, core `#fff1e0`                                |

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
- `cockpit` is empty, for the galaxy selection card and conversations before
  Ada sits; `cockpit-seated` shows Ada and Penny in their seats.

## Astra speaking

`cockpit-astra` holds four speaking frames as opaque patches over the lens and
its warm halo: 78 by 80 image px (39 by 40 logical px) each, frames `speak1` to
`speak4`, 120 ms each (480 ms loop, the `loop` list).

- Draw the current frame over either background with the background's
  transform, its top-left at `at`, (530, 169) logical px on the canvas. The
  heads never reach the patch, so one set serves both.
- Idle: no patch (the dim ember in the background).
- Reduced motion: `speak1` held while Astra speaks.
