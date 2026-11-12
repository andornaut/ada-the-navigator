# Route sky

- Rebuild with `node art/tools/route-sky.ts` (about 2 s). It writes
  `public/art/route-sky.png` and `route-ground.png` and their `route-` entries
  in the root [manifest](../public/art/manifest.json).
- `node art/tools/storybook.ts` draws the figures on the ground,
  `story-ada-skywatch` and `story-penny-sitting`
  ([Ada's sprites](storybook.md#adas-sprites)), and lists them with the story
  entries.
- Painted (anti-aliased) art, not pixel art; the figures are pixel sprites.

The backdrop of the [galaxy selector](layout.md#galaxy-selector): an evening
sky full of stars, galaxies and stellar phenomena behind the route chart, and
along the bottom a grassy field where Ada and Penny stand, seen from behind,
looking up at it.

## Layers

| Id                    | Image        | Display (logical px) | Anchor                                                                                     |
| --------------------- | ------------ | -------------------- | ------------------------------------------------------------------------------------------ |
| `route-sky`           | 1920 by 1080 | 960 by 540           | `pivot` (0.5, 0): its top-centre on the play view's top-centre, so it moves with the chart |
| `route-ground`        | 1920 by 240  | 960 by 120           | `pivot` (0.5, 1): its bottom on the view's bottom, its centre on the play view's centre    |
| `story-ada-skywatch`  | 28 by 52     | 28 by 52, scale 1    | Overlay of `route-ground`, `at` (199, 60) on its canvas                                    |
| `story-penny-sitting` | 23 by 28     | 23 by 28, scale 1    | Overlay of `route-ground`, `at` (228, 84) on its canvas                                    |

- Both images draw at 2 image px per logical px and never scale, so the sky's
  guard stays on the chart at every view. A play view point (x, y) is sky
  canvas point (x + 120, y). The sky covers every view up to 960 by 540
  logical (720 by 540 at 4:3, 840 by 360 at 21:9); past it the view shows the
  sky's top colour `#1F1A38`.
- Draw order, bottom to top: `route-sky`, the chart's rules, `route-ground`
  with its overlays (nearest-neighbour, as every pixel sprite), then the
  route legs, markers, labels, ship, panel and controls. The grass covers the
  rules' lower part.
- The figures' foot centres are ground canvas (213, 112) and (236, 112), 26
  below the grass line: Ada at play view x 79 to 107, Penny 108 to 131, left
  of Earth (play view x 160) and clear of every press area at every view.
  Ada's top is 60 above the view bottom: 300 at 360 high, 12 below the panel's
  bottom at 288 (15 below 285 with the phone insets), and 345 at 405 high, 12
  below 333.

## Sky

Every colour is from the [space palette](space-palette.md), its in-between
ramp, or a galaxy's [marker hue](galaxies.md#markers).

| Part      | Rule                                                                                                                                                                                      |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Field     | Vertical gradient from `#1F1A38` (in-between, darkest) at the top to `#292734` (space `background`) at the bottom                                                                         |
| Milky Way | `#5F4FA3` added along `y = 0.34 x + 40` (play view px), Gaussian sigma 42 across, at 0.10 to 0.28 by two octaves of value noise (30, 13)                                                  |
| Dust lane | `#1F1A38` over the band 6 below its centre line, sigma 7, at up to 0.55 by the same noise                                                                                                 |
| Stars     | 1,100 dim (alpha 0.12 to 0.45) and 110 bright (0.55 to 0.95, a third with cross spikes) in `#C4AFCC`, `#DCC3F2`, `#9B82D4`, `#70ACE8`, `#8FE0F2` and `#F0BD68`, weighted 5, 4, 3, 1, 1, 1 |

Phenomena sit in the chart's gaps, under the arc and over its ends (play view px):

| Phenomenon                      | At         | Colours                                |
| ------------------------------- | ---------- | -------------------------------------- |
| Tilted two-armed spiral         | (290, 126) | Andromeda `#B8C1FF`, core `#DCC3F2`    |
| Ring galaxy with a nucleus      | (452, 120) | Cartwheel `#F3B6AC`, `#EAD4AA`         |
| Edge-on galaxy with a bulge     | (200, 148) | Needle `#CFC5BD`, `#EAD4AA`            |
| Nebula with a teal knot         | (48, 46)   | Phantom `#E9B4DC`, Whirlpool `#94D3E3` |
| Planetary nebula ring           | (600, 196) | Whirlpool `#94D3E3`, shimmer `#8FE0F2` |
| Comet, tail rising to the right | (470, 30)  | Shimmer `#8FE0F2`, head `#DCC3F2`      |
| Star cluster                    | (128, 196) | `#DCC3F2`                              |

The phenomena are scenery: none stands for a galaxy on the route, so a locked
galaxy's hue in the sky gives nothing away.

### Guard

The sky is dimmed behind every chart mark, in place of an ink layer over the
whole view. Its footprint, in play view px (`GUARD` in the tool):

- a disc of radius 21 at each marker centre (the 15 backing disc plus 6);
- a stadium from centre - 56 to + 56 across and centre + 15 to + 43 down
  under each marker, the widest name's label pill with 6 to spare each side;
- a band 6 either side of every route leg, along the chart's arc
  ([layout](layout.md#galaxy-selector));
- the close X's corner: play view x 600 to the sky's right edge, y 0 to 56.

Inside the footprint the sky's WCAG relative luminance is scaled down to at
most 0.028 (its linear RGB times `0.028 / L`), feathered outward by a
Gaussian of sigma 3 over the footprint grown by 6, at gain 1.6. The build
fails if any footprint pixel is above the cap by more than 2% (byte rounding).
The field itself is 0.013 to 0.022, so the guard shows only where a star,
the band or a phenomenon crosses a mark.

Contrast at the cap (WCAG, a grey sky at 0.028):

| Mark                                                       | Ratio                  |
| ---------------------------------------------------------- | ---------------------- |
| Label text on its ink pill at 0.85: cream, `#B8B3C9`       | 12.01:1, 8.56:1        |
| Marker disc on its ink backing at 0.85: locked grey, hues  | 5.11:1, 9.97:1 or more |
| Open leg (cream), locked leg dashes (`#B8B3C9`) on the sky | 9.29:1, 6.62:1         |
| Close X (cream) on the sky                                 | 9.29:1                 |

## Ground

`route-ground` is transparent above the grass and opaque below it.

| Part       | Rule                                                                                                                                                                           |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Grass line | 86 below the strip's top (34 above the view's bottom), `+ 3 sin(x / 47) + 2 sin(x / 13 + 1.3)`, with 192 tufts 2 to 6 high and 3.2 wide; 4 by 4 samples per pixel for its edge |
| Grass      | `#3D5638` at the line to `#293A2C` at the strip's bottom                                                                                                                       |
| Rim light  | The top 2 of the grass mixed toward `#86A65E` and amber `#F0BD68` half and half, at 0.45 to 0.90 by the sunset weight                                                          |
| Afterglow  | Coral `#D68B72` over the sky above the grass, alpha `0.28 t^2` with `t` from 0 at the strip's top to 1 at the grass line, times 0.35 to 1 by the sunset weight                 |
| Sunset     | The warm light's weight, a Gaussian of sigma 260 centred 40 left of the play view's left edge                                                                                  |

The grass is ground, not space art, so its greens sit outside the space
palette; its rim and the afterglow take the palette's amber and coral.
