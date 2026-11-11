# App icon

Compact delta ship with two wings, a triangular tail and an opaque blue canopy.
No text, outlines or fine details. All exports have an opaque dark lavender
background; the maskable export uses the same safe composition as the regular icon.

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
- Hull: white `#ffffff` and warm cream `#f4e4bc`.
- Canopy: opaque blue `#70ace8`.

The maskable safe zone is the centred circle with diameter 80% of the canvas:
409.6 px at 512 px, centred at (256, 256), radius 204.8 px. Every hull and canopy
vertex lies within radius 185 px; straight polygon edges remain inside that circle.
Only background extends outside the safe zone. No baked corner rounding.

## Export and integration

Edit the native SVG master. Export each PNG directly at its listed dimensions
with local `rsvg-convert --width SIZE --height SIZE --output OUTPUT icon.svg`.
Assemble the two favicon PNGs with local ImageMagick:
`convert favicon-16.png favicon-32.png favicon.ico`. No downloaded dependencies.

Tech owns manifest and HTML icon links. Asset delivery does not enable PWA,
service worker or offline behaviour. Keep contact-sheet imagery out of icon links.
The integrated project gate and installed-device preview belong to Tech.
