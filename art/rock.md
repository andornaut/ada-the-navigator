# The rock

- Rebuild with `node art/tools/rock.ts`. It writes four UI subset sheets in
  `public/art/ui/sprites/` with their Aseprite data and sorted entries in the
  [UI manifest](../public/art/ui/manifest.json).
- Pixel art drawn procedurally at native size. Every pixel is opaque or clear;
  draw with nearest-neighbour filtering.

An ordinary grey pebble when dug up. Polishing shows a one-arm spiral that glows
in the in-between ramp, the colours of the dimension the rock opens. A spiral
also hints at galaxies.

## Sheets

| Key            | Frame    | Use                                           |
| -------------- | -------- | --------------------------------------------- |
| `icon-rock`    | 16 by 16 | Inline and row icons                          |
| `icon-rock-24` | 24 by 24 | HUD and item wells                            |
| `icon-rock-32` | 32 by 32 | Large item wells                              |
| `rock-closeup` | 70 by 70 | Story cards, shown at 2x by nearest neighbour |

Every sheet has the same four frames and three tags:

| Frame | Tag        | State                   | Duration |
| ----- | ---------- | ----------------------- | -------- |
| 0     | `raw`      | Dug up                  | Held     |
| 1     | `polished` | Polished, faint spiral  | Held     |
| 2     | `glow`     | Glowing, dim pulse step | 700 ms   |
| 3     | `glow`     | Glowing, bright step    | 700 ms   |

- Glow pulse: frames 2 and 3 loop at 700 ms each (0.7 Hz), stepping the spiral
  one ramp value. No flashing.
- Reduced motion: frame 3, held.
- The close-up frame is the 64 px rock with a 3 px margin on every side. Its
  glowing frames add a dithered outer aura in that margin (sparser on the dim
  step); the dug-up and polished frames leave it clear. Item icons have no aura.
- The close-up uses its own rock shape (seed 8); the three item sizes share one
  (seed 3).

## Colour

| Role                 | Colour                                     |
| -------------------- | ------------------------------------------ |
| Rock, light to dark  | `#c0cbdc`, `#8b9bb4`, `#5a6988`, `#3a4466` |
| Outline              | `#181425`                                  |
| Dirt specks (dug up) | `#733e39`, `#3e2731`                       |
| Glint, glow centre   | `#ffffff`                                  |
| Engraved spiral      | `#3a4466`                                  |
| Spiral core, bright  | `#dcc3f2`                                  |
| Spiral core, dim     | `#9b82d4`                                  |
| Spiral halo          | `#9b82d4` bright, `#5f4fa3` dim            |
| Aura                 | `#5f4fa3`                                  |

The rock greys are the Endesga greys of the reused Archie sprites. The spiral
colours are the in-between ramp in the [space palette](space-palette.md#in-between).

- Dug up: dithered greys lit from the upper left, capped below the lightest
  grey, with dirt specks.
- Polished: smooth bands, a white glint at the upper left and the spiral
  engraved in the darkest grey.
- Glowing: the spiral core lit, with a dithered halo beside it on the 24 px and
  larger sizes.
