# App icon

Ada's ship as the in-game sprite draws it nose up (heading 20, `ship.svg`):
the pyramid hull with swept wings, blue walls and engine mouths either side of
the white tail, and the opaque blue canopy, so the icon and the game show the
same craft. No text or outlines. All exports have an opaque dark lavender
background; the maskable export uses the same safe composition as the regular
icon.

## Files

Paths are relative to `public/art/app-icon/`; browser URLs start at
`/art/app-icon/`.

| File                    | Actual dimensions | Purpose                         |
| ----------------------- | ----------------- | ------------------------------- |
| `icon.svg`              | 512 × 512         | Vector master and scalable icon |
| `icon-192.png`          | 192 × 192         | Manifest icon, `any`            |
| `icon-512.png`          | 512 × 512         | Manifest icon, `any`            |
| `icon-maskable-512.png` | 512 × 512         | Manifest icon, `maskable`       |
| `apple-touch-icon.png`  | 180 × 180         | Apple touch icon                |
| `favicon-16.png`        | 16 × 16           | Small browser favicon           |
| `favicon-32.png`        | 32 × 32           | Browser favicon                 |
| `favicon.ico`           | 16 × 16, 32 × 32  | Multi-size browser favicon      |
| `contact-sheet.png`     | 576 × 192         | Review only                     |

Contact sheet, left to right: 192 px icon, 16 px favicon enlarged with nearest
neighbour sampling, 32 px favicon enlarged with nearest neighbour sampling.

## Palette and maskable safe zone

- Background: `#292734`.
- Hull: the Classic ship paint, top `#ffffff`, front sides `#d4dfe9` and rear
  sides `#abbfce`.
- Walls and canopy sides `#1767b3`, canopy roof `#2585d0`, canopy highlight
  `#87bce5`, engine mouths `#64caff`.

The maskable safe zone is the centred circle with diameter 80% of the canvas:
409.6 px at 512 px, centred at (256, 256), radius 204.8 px. Every hull and
canopy vertex, its stroke included, lies within radius 185 px; straight polygon
edges remain inside that circle. Only background extends outside the safe zone. No baked corner rounding.

## Export and integration

Edit the native SVG master. It holds the polygons of `ship.svg` verbatim, in
order, inside one group with `translate(-22.4 -3.2) scale(5.8)`, which centres
the frame's bounding box on the canvas and fits it inside radius 185 px. Each
polygon also has a stroke of its own fill colour, 0.12 frame px wide with round
joins, which hides antialiasing seams between faces. When the ship model
changes, copy the new `ship.svg` polygons in the same way.

Export each PNG directly at its listed dimensions with local
`rsvg-convert --width SIZE --height SIZE --output OUTPUT icon.svg`. Assemble
the two favicon PNGs with local ImageMagick:
`convert favicon-16.png favicon-32.png favicon.ico`. Build the contact sheet
from `icon-192.png` and the two favicons resized to 192 px with
`-filter point`, joined with `+append`. No downloaded dependencies.

Tech owns manifest and HTML icon links. Asset delivery does not enable PWA,
service worker or offline behaviour. Keep contact-sheet imagery out of icon links.
The integrated project gate and installed-device preview belong to Tech.
