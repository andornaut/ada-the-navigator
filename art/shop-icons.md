# Shop icons

Glyphs for the [station and shop](shop.md) rows: cream `#ead4aa` pixel art on a
clear ground, drawn for the navy item well `#262b44` (9.59:1) and the card
`#3b3850` (7.76:1). Each shop item maps to one glyph:

| Item               | Glyph                                        | Size  |
| ------------------ | -------------------------------------------- | ----- |
| Basic              | `icon-shop-weapon-basic`                     | 20x20 |
| Rapid Missile      | `icon-shop-weapon-rapidMissile`              | 20x20 |
| Multi-Laser        | `icon-shop-weapon-multiLaser`                | 20x20 |
| Heavy Missile      | `icon-shop-weapon-heavyMissile`              | 20x20 |
| Scattershot        | `/art/ui/icons/weapon-scattershot.svg`       | 20x20 |
| Phaser             | `icon-shop-weapon-phaser`                    | 20x20 |
| `{weapon}` upgrade | Upgrade composite of that weapon's glyph     | 24x24 |
| Generic upgrade    | `icon-shop-weapon-upgrade`                   | 20x20 |
| Shield             | `icon-shop-shield`                           | 20x20 |
| Shield recharge    | `icon-shop-shield-recharge`                  | 20x20 |
| Engine tuning      | `icon-shop-engine-tuning`                    | 20x20 |
| Tractor beam       | `icon-shop-tractor-beam`                     | 20x20 |
| Ship paint heading | `icon-shop-ship-paint`                       | 20x20 |
| Paint scheme rows  | The scheme's idle frame 12, drawn 32x32      | 32x32 |
| Owned and In use   | `icon-shop-check`                            | 12x8  |
| Upgrade badge      | `icon-shop-upgrade-badge`, inside composites | 12x12 |

The Basic, Rapid Missile, Multi-Laser, Heavy Missile and Phaser sheets are the
same pixel grids as their [weapon icons](weapon-icons.md), written by
`art/tools/weapon-icons.ts`; Scattershot reuses its SVG. The plain double
chevron is the generic upgrade glyph, for any place that names upgrades without
a weapon.

## Upgrade composite

A weapon upgrade row draws the weapon's 20px glyph at (0, 4) of a 24x24 box and
`icon-shop-upgrade-badge` at (12, 0) over it. The badge is a cream face with an
ink `#181425` edge, its corners cut by one pixel, and an ink chevron, so it stays
separate from the glyph it overlaps.

## States

- `icon-shop-check` has one `rest` frame, cream: Owned and In use rows are
  never disabled.
- The other `icon-shop-*` sheets have tags `normal` (frame 0, cream) and
  `disabled` (frame 1, `#9a96ad`) for unaffordable rows. They are not tinted at
  runtime. The badge keeps its ink edge and chevron in both.
- Weapon SVGs are one colour. In an unaffordable row, use the weapon's sheet
  `disabled` frame, or draw the SVG as a CSS
  mask (`mask: url(...) center / 20px 20px no-repeat`) over a `#9a96ad`
  background; the integer-grid paths stay crisp at any device pixel ratio.

## Geometry

- Public paths: `/art/ui/sprites/<key>.png` and matching `.json`; manifest
  entries use paths relative to `/art/ui/` and the existing sprite schema,
  sorted by key.
- Frames are untrimmed and unrotated, named `<key> <index>.aseprite` for
  two-frame sheets and `<key>.aseprite` for one, 100 ms each. No nine-slice
  margins.
- Fully opaque pixels only, in 2-pixel strokes, matching the settings icons.

`art/tools/shop-icons.ts` holds the glyphs as pixel grids and writes them with
art-kit's `writeSpriteSheet`. Rebuild with `node art/tools/shop-icons.ts`, then
run Prettier on the written JSON.

| PNG                                 | SHA-256                                                            |
| ----------------------------------- | ------------------------------------------------------------------ |
| `icon-shop-check.png`               | `50000ad861883d7612f0fdf2e40d633f9a71e36599074e7653f2580da6e4c148` |
| `icon-shop-engine-tuning.png`       | `63a5f882e0e1bc130c65a206a6f290b5eb66f94f1b4a0043a9ab02cbdc5dab7a` |
| `icon-shop-shield.png`              | `2a65f554935484920101167705269f0fe9c47295badac9c01970d80cfc561f67` |
| `icon-shop-shield-recharge.png`     | `cbe31a9dae468c403ca3e8bb999d87a0df52f5ec20a7b78c6eb42fa14bef57ce` |
| `icon-shop-ship-paint.png`          | `c798f5f6f86b8edca627d14353e4f58363a7eb5618254cd6be72e42c59176417` |
| `icon-shop-tractor-beam.png`        | `106fdb4bc10757c00527dfc8182b130e0c2c6c8e0eec736e00f64afecf97ba97` |
| `icon-shop-upgrade-badge.png`       | `7db5eb19cbea06e1d3d2e187584c3c2a4139743c42e4e512f2842eb7823152ab` |
| `icon-shop-weapon-basic.png`        | `9f9d2688e6193f5bbbf477ad550b1ca040de42ca33a81465285314f6801fa61e` |
| `icon-shop-weapon-heavyMissile.png` | `65cd8c674398fba99112d3cbb768d6da1e2dbc296a13981ac51b266517c696e5` |
| `icon-shop-weapon-multiLaser.png`   | `b18e753142fa429b19cdda8161bdbe759508ca50f2c2bc015e4b80d588867f69` |
| `icon-shop-weapon-phaser.png`       | `7b6f8a8023f34e8a5b6a51273aa4a1cb2adcb0bcab4c41fc32b0670e60183d01` |
| `icon-shop-weapon-rapidMissile.png` | `75635f189837c64915f64e422d3bb083373c4832bc1383898153fb44b2eb0439` |
| `icon-shop-weapon-upgrade.png`      | `bbb8df92ae714b76ccc4e144b9e67ab752f8d71579ad24fa8f95d7b25d4496aa` |

- `icon-shop-shield`: a heater shield with its left half filled.
- `icon-shop-shield-recharge`: a solid shield with a lightning bolt knocked out.
- `icon-shop-engine-tuning`: an engine nozzle over a tapering exhaust plume.
- `icon-shop-tractor-beam`: an emitter over a widening beam around a caught mote.
- `icon-shop-ship-paint`: a paint roller.
- `icon-shop-weapon-basic`, `icon-shop-weapon-rapidMissile`,
  `icon-shop-weapon-multiLaser`, `icon-shop-weapon-heavyMissile` and
  `icon-shop-weapon-phaser`: the weapon's HUD glyph.
- `icon-shop-weapon-upgrade`: two stacked chevrons.
