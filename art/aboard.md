# Aboard backdrop

- Rebuild with `node art/tools/aboard.ts` (about 75 s). It writes
  `public/art/aboard.png`, `aboard-emergency.png`, the holodisk overlays
  `aboard-holodisk-0.png` to `-3.png` and
  [aboard-holodisk.json](../public/art/aboard-holodisk.json), places their
  `aboard` entries in the root [manifest](../public/art/manifest.json) and
  links the sequence as `aboardHolodisk`. Reruns are byte-identical.
- A painted (anti-aliased) background: the ship is drawn at 3x and reduced with
  Lanczos filtering, then muted.

Every page aboard shows Ada's ship from outside over the in-between field; no
page shows the cockpit's interior. The text carries where Ada and Penny are,
standing or seated, so both share one image. Pages: the prologue's aboard pages
(the arrival through Astra's introduction, the optional questions, then seated
from the buckle-in line), Astra's boarding line, the holodisk moment and the
jump-home page.

## Ship

- The shared ship model in [ship-model.ts](tools/ship-model.ts) (`drawn`, the
  Classic paint), the same faces as the `ship-25` sprite frame: heading 25 of
  32, up and to the right, the engine mouths toward the viewer.
- 5.85 logical px per frame px, the frame centre on canvas (476, 245), so the
  canopy spans canvas rows 172 to 256.
- A soft engine glow from each mouth (the `ship-jets.json` anchors at heading
  25): `#64caff`, 34 by 24 px, peak alpha 170, blurred 6 px, drawn under the
  hull.
- The canopy stays opaque, as in the game; no interior or figures show.

## Field and muting

The in-between field is the shimmer of [shimmer.ts](tools/shimmer.ts) at phase
0, as on every in-between view. Treatment d keeps the background behind the
UI:

1. Gaussian blur of 1.2 design px.
2. 25% desaturation toward ITU-R 601 luma.
3. A haze of the space background `#292734` from 22% opacity at the design
   frame's top to 72% at its bottom, easing in (`0.22 + 0.5 t^2`), held at
   those values above and below the frame.

## Canvas and anchor

| Asset              | Size         | Display (logical px) | Subject band | `focus`        |
| ------------------ | ------------ | -------------------- | ------------ | -------------- |
| `aboard`           | 1920 by 1080 | 960 by 540           | 172..256     | (493.9, 213.9) |
| `aboard-emergency` | 1920 by 1080 | 960 by 540           | 172..256     | (493.9, 213.9) |

- Drawn as every story background ([storybook](storybook.md#canvas)): centred
  across, offset down by the [run anchor](layout.md#storybook-page) so the
  band sits in the strip above the run's tallest panel.
- `focus` is the canopy's centre in canvas logical px: where a quantum jump
  from an aboard page centres.
- Placements are in [subject bands](storybook.md#subject-bands).

## Astra speaking

Astra speaks with her dialogue portrait in the story panel, like every other
speaker; the background stays still.

## Holodisk moment

Inserting a holodisk plays on the ship from outside, on the narration page
"Ada slides the holodisk into Astra's drive.": Astra's drive is a point on the
hull just ahead of the canopy, toward the nose (canvas (592.6, 243.3)).

| Overlay             | Shows                                                                                      | Hold   |
| ------------------- | ------------------------------------------------------------------------------------------ | ------ |
| `aboard-holodisk-0` | Hold: the disk's magenta dot at the drive, a plum rim                                      | 400 ms |
| `aboard-holodisk-1` | Read: a pink `#ffb3ec` pulse round the drive                                               | 250 ms |
| `aboard-holodisk-2` | Link: a ring of 16 magenta `#e868c8` dots and Astra's teal light (`#8fe0f2`) in the canopy | 400 ms |
| `aboard-holodisk-3` | Restored: the ring wider and Astra's light brighter                                        | 600 ms |

- Each overlay is that frame's full render cropped to one box (canvas (387,
  137), 276 by 180 logical px) round every pixel any frame changes, opaque, so
  each alone shows its frame over `aboard`. Entries: `pivot` (0, 0) and `at`,
  their top-left corner on the canvas, as the
  [sleep overlays](storybook.md#sleep-scene-overlays).
- `aboard-holodisk.json` key `holodisk`, in the
  [overnight sequence](storybook.md#sequence)'s step schema: `background`
  (`aboard`), `overlays` (each id's `at`), `steps` (each fades its overlay in
  over the last, `fadeMs` 0, then holds), `durationMs` 1650, `reducedMotion`
  (frame 0, then a 300 ms cross-fade to frame 3) and `reducedMotionMs` 300.
- The sequence starts when the narration page shows; frame 3 holds until the
  next page, Astra's "Memory restored.", then fades out over `exitFadeMs` 200.
- The overlays are canvas rows 137 to 317; on the narration page (panel top
  273 at 720 by 360) the drive, the ring and Astra's light stay above it.

## Emergency jump home

`aboard-emergency` is the jump-home page's background ("Astra jumped you back
to Earth to recharge."): the same ship in the emergency jump's red. The field
keeps its lightness on a red ramp (`#e05a5a` light to `#300c14` deep, 65% over
the field), the engines glow `#ff8a7a` and a soft `#ff6a6a` glow (300 by 180
px, peak 90, blurred 24 px) lies over the canopy. The sleep scene follows in
Ada's room.

## Rock glow

Boarding from Ada's room is the rock's glow, then a cut to `aboard`
([rock glow transition](storybook.md#rock-glow-transition)).
