# App icon

The app icon shows Ada's Classic ship facing the upper right at heading 46 of
64, with two plumes at medium thrust. The hull uses the shared ship model. All exports use the opaque dark lavender
background.

## Files

Paths are relative to `public/art/app-icon/`; browser URLs start at
`/art/app-icon/`.

| File                    | Actual dimensions | Purpose                    |
| ----------------------- | ----------------- | -------------------------- |
| `icon-192.png`          | 192 × 192         | Manifest icon, `any`       |
| `icon-512.png`          | 512 × 512         | Manifest icon, `any`       |
| `icon-maskable-512.png` | 512 × 512         | Manifest icon, `maskable`  |
| `apple-touch-icon.png`  | 180 × 180         | Apple touch icon           |
| `favicon-16.png`        | 16 × 16           | Small browser favicon      |
| `favicon-32.png`        | 32 × 32           | Browser favicon            |
| `favicon.ico`           | 16 × 16, 32 × 32  | Multi-size browser favicon |

The review contact sheet, `art/review/app-icon-contact-sheet.png` (576 × 192),
is not shipped. Left to right: 192 px icon, 16 px favicon enlarged with nearest
neighbour sampling, 32 px favicon enlarged with nearest neighbour sampling.

## Palette and maskable safe zone

- Background: `#292734`.
- Hull, canopy and mouths: the Classic [ship paint](ship.md#paint-schemes)
  under the model's light, with accent `#2456b8` tip caps.
- Plumes: Engine level 1's dark-field outer and core.

The regular composition centres the combined hull and jet bounds and scales
their farthest point to 48% of the canvas width. The maskable icon scales the
same composition by 0.8. At 512 px its mark fits within radius 196.6 px,
leaving about 8 px of background inside the minimum 204.8 px safe circle.
The background also fills the square outside the circle for launcher masks
of other shapes.

## Export and integration

Rebuild with `node art/tools/app-icon.ts`. The exporter uses the Classic
[ship model](ship.md) and Engine level 1 [plumes](ship.md#speed-jets) at speed
fraction 0.6. The length curve gives 14.64 model units before projection; the
halo reaches 16.1 of them. The
plume occluders restore the painted hull where it is nearer than a plume.
Every size reduces the one master, with all three plume layers.

The command writes every PNG, the two-size ICO and the contact sheet. Raster
exports sample the projected geometry at 4× the 512 px master before
reduction. The ICO embeds the exact 16 and 32 px PNG payloads. The maskable
PNG is rendered from its own scaled master.

Tech owns manifest and HTML icon links. Asset delivery does not enable PWA,
service worker or offline behaviour. Keep contact-sheet imagery out of icon links.
The integrated project gate and installed-device preview belong to Tech.
