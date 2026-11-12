# Shop icons

Glyphs for the [station and shop](shop.md) and
[community project](projects.md) rows: cream `#ead4aa` pixel art on a
clear ground, drawn for the navy item well `#262b44` (9.59:1) and the card
`#3b3850` (7.76:1). Each shop item maps to one glyph:

| Item               | Glyph                                        | Size  |
| ------------------ | -------------------------------------------- | ----- |
| Laser              | `icon-shop-weapon-laser`                     | 20x20 |
| Rapid Missile      | `icon-shop-weapon-rapidMissile`              | 20x20 |
| Multi-Laser        | `icon-shop-weapon-multiLaser`                | 20x20 |
| Heavy Missile      | `icon-shop-weapon-heavyMissile`              | 20x20 |
| Scattershot        | `icon-shop-weapon-scattershot`               | 20x20 |
| Phaser             | `icon-shop-weapon-phaser`                    | 20x20 |
| `{weapon}` upgrade | Upgrade composite of that weapon's glyph     | 24x24 |
| `{weapon}` ammo    | `icon-shop-ammo-<kind>` for that weapon      | 20x20 |
| Generic upgrade    | `icon-shop-weapon-upgrade`                   | 20x20 |
| Shield             | `icon-shop-shield`                           | 20x20 |
| Engine tuning      | `icon-shop-engine-tuning`                    | 20x20 |
| Tractor beam       | `icon-shop-tractor-beam`                     | 20x20 |
| Ship paint heading | `icon-shop-ship-paint`                       | 20x20 |
| Paint scheme rows  | The scheme's idle frame 12, drawn 32x32      | 32x32 |
| Owned and In use   | `icon-shop-check`                            | 12x8  |
| Upgrade badge      | `icon-shop-upgrade-badge`, inside composites | 12x12 |
| Greenhouse ring    | `icon-project-greenhouse-ring`               | 20x20 |
| Workshop crane     | `icon-project-workshop-crane`                | 20x20 |
| Salvage beacons    | `icon-project-salvage-beacons`               | 20x20 |
| Second docking bay | `icon-project-docking-bay`                   | 20x20 |
| Hub repairs        | `icon-project-hub-repairs`                   | 20x20 |
| Nursery beacon     | `icon-project-nursery-beacon`                | 20x20 |
| Current-map buoys  | `icon-project-current-buoys`                 | 20x20 |

Each weapon sheet is the same pixel grid as its [weapon icon](weapon-icons.md),
and each ammunition sheet the same grid as its
[ammunition icon](weapon-icons.md#ammunition-icons), written by
`art/tools/weapon-icons.ts`: `missile` for Rapid Missile and Heavy Missile,
`energy` for Multi-Laser and Phaser, `shell` for Scattershot. The plain double
chevron is the generic upgrade glyph, for any place that names upgrades without
a weapon.

## Job icons

The [job board](shop.md#job-board) rows' glyphs, one per Gameplay job type and
one shared by every repeatable activity, cream on the navy well and `#9a96ad`
in busy rows. Each job type's grid is also the Map's job glyph,
`map-job-<type>.svg`, ink on the job-orange chip ([Map](map.md#symbols)), as
each weapon glyph serves the HUD and the shop. The activity glyph has no Map
mask: Gameplay shows an active activity on the Map only as the Quests modal's
"Job:" line, with its target's own chip.

| Job type       | Sheet               | Glyph                                                                        |
| -------------- | ------------------- | ---------------------------------------------------------------------------- |
| Survey         | `icon-job-survey`   | A folded chart, its middle panel raised, an X knocked out                    |
| Delivery       | `icon-job-delivery` | A parcel: a lid over the box with a knocked-out label                        |
| Rescue and tow | `icon-job-rescue`   | A tow hook hanging from its eye                                              |
| Lost-item hunt | `icon-job-hunt`     | A magnifier with a glint in the lens                                         |
| Activity       | `icon-job-activity` | A circular repeat arrow, its head at the top pointing clockwise into the gap |

The grids are in `art/tools/job-glyphs.ts`, every pixel inside the Map chip's
13 px face (reach 8.60 to 11.40). Each glyph's drawn bounds are centred on its
20 x 20 frame within 0.5 px on both axes, so it sits centred in the row well:
the rescue hook is half a pixel left of centre, the others exact. `art/tools/job-icons.ts` writes the sheets
with tags `normal` (frame 0, cream) and `disabled` (frame 1, `#9a96ad`) and
registers them in the UI subset manifest; rebuild with
`node art/tools/job-icons.ts`, and the Map masks with
`node art/tools/map-icons.ts`.

## Upgrade composite

A weapon upgrade row draws the weapon's 20px glyph at (0, 4) of a 24x24 box and
`icon-shop-upgrade-badge` at (12, 0) over it. The badge is a cream face with an
ink `#181425` edge, its corners cut by one pixel, and an ink chevron, so it stays
separate from the glyph it overlaps.

## States

- `icon-shop-check` has one `rest` frame, cream: Owned and In use rows are
  never disabled.
- The other `icon-shop-*` sheets and the `icon-project-*` sheets have tags `normal` (frame 0, cream) and
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
| `icon-shop-ammo-energy.png`         | `3d1cda8ba36de4069bf310b662b9276880372f287b165cc741215089f19fff9a` |
| `icon-shop-ammo-missile.png`        | `b2830979f4bec10fe08e2df534ed3fd5097242e72f84ce4989cb1f4fdfcb15d4` |
| `icon-shop-ammo-shell.png`          | `b6e9725afc78907e5a68e4e22f9c44e326aaa927f90ab8ca1c48b45750bdf93a` |
| `icon-job-activity.png`             | `64e6b771c89b4df177cf40c8e348b22c901c5ffdb59ca649d2b818e6eb145ec5` |
| `icon-job-delivery.png`             | `ecc66fad164c64485072eec6f73603bd57f48740d3f61b1a0db71dc4928d3d2d` |
| `icon-job-hunt.png`                 | `d9cbae46f8cfff4f8c5e9740e6b3a4c0166eff8eb93d7d26f5e06ba0238bfe5c` |
| `icon-job-rescue.png`               | `6f5a309c8df514e7b7a74e334e8a8c0f512df1348d310690fc0921f02d2658f5` |
| `icon-job-survey.png`               | `a64d28393eeaf585a2713663f4e5b51ef298224eda159b6d7566152acc3af334` |
| `icon-project-current-buoys.png`    | `5506bbcad2512bfde4a81aff6de192c0323362489c7328d38a94affbbf60f5ef` |
| `icon-project-docking-bay.png`      | `e095d8686977f4106b3c0ad2411463f69f882db4a5b232229226d6782cd049f7` |
| `icon-project-greenhouse-ring.png`  | `ba3f3a641b967036222e6b50524be3565e5d62abe5e3d7244bf5662148436542` |
| `icon-project-hub-repairs.png`      | `1739732899b4686c7b71148ab3a6c8161cf76f15105691219e0455de5254af0f` |
| `icon-project-nursery-beacon.png`   | `dcd26f20c29b2878e804476c0f174eac9c12698a02583746f6b6e3c2164048a7` |
| `icon-project-salvage-beacons.png`  | `5cc9cadcceb5ae00a6ba0990c9c797f997cdcf4710b81c2672612e0235a43c4e` |
| `icon-project-workshop-crane.png`   | `faabbcbdb7df95dd1d9ac04d10f92dc623e0d14f4574c003489b5a89a5291b1b` |
| `icon-shop-check.png`               | `50000ad861883d7612f0fdf2e40d633f9a71e36599074e7653f2580da6e4c148` |
| `icon-shop-engine-tuning.png`       | `63a5f882e0e1bc130c65a206a6f290b5eb66f94f1b4a0043a9ab02cbdc5dab7a` |
| `icon-shop-shield.png`              | `2a65f554935484920101167705269f0fe9c47295badac9c01970d80cfc561f67` |
| `icon-shop-ship-paint.png`          | `c798f5f6f86b8edca627d14353e4f58363a7eb5618254cd6be72e42c59176417` |
| `icon-shop-tractor-beam.png`        | `106fdb4bc10757c00527dfc8182b130e0c2c6c8e0eec736e00f64afecf97ba97` |
| `icon-shop-upgrade-badge.png`       | `7db5eb19cbea06e1d3d2e187584c3c2a4139743c42e4e512f2842eb7823152ab` |
| `icon-shop-weapon-laser.png`        | `9f9d2688e6193f5bbbf477ad550b1ca040de42ca33a81465285314f6801fa61e` |
| `icon-shop-weapon-heavyMissile.png` | `65cd8c674398fba99112d3cbb768d6da1e2dbc296a13981ac51b266517c696e5` |
| `icon-shop-weapon-multiLaser.png`   | `b18e753142fa429b19cdda8161bdbe759508ca50f2c2bc015e4b80d588867f69` |
| `icon-shop-weapon-phaser.png`       | `7b6f8a8023f34e8a5b6a51273aa4a1cb2adcb0bcab4c41fc32b0670e60183d01` |
| `icon-shop-weapon-rapidMissile.png` | `75635f189837c64915f64e422d3bb083373c4832bc1383898153fb44b2eb0439` |
| `icon-shop-weapon-scattershot.png`  | `c9a03fc49da03bed20e21eb493694d9eca461e4351f7ebfc64af652a9a6ebf37` |
| `icon-shop-weapon-upgrade.png`      | `bbb8df92ae714b76ccc4e144b9e67ab752f8d71579ad24fa8f95d7b25d4496aa` |

- `icon-shop-shield`: a heater shield with its left half filled.
- `icon-shop-engine-tuning`: an engine nozzle over a tapering exhaust plume.
- `icon-shop-tractor-beam`: an emitter over a widening beam around a caught mote.
- `icon-shop-ship-paint`: a paint roller.
- `icon-shop-weapon-laser`, `icon-shop-weapon-rapidMissile`,
  `icon-shop-weapon-multiLaser`, `icon-shop-weapon-heavyMissile`,
  `icon-shop-weapon-scattershot` and `icon-shop-weapon-phaser`: the weapon's
  HUD glyph.
- `icon-shop-weapon-upgrade`: two stacked chevrons.
- `icon-project-greenhouse-ring`: a greenhouse dome with a sprout, inside a ring.
- `icon-project-workshop-crane`: a tower crane lifting a crate.
- `icon-project-salvage-beacons`: a beacon lamp on a post over a float, between
  two signal arcs.
- `icon-project-docking-bay`: a dock collar with two mouths and their lit floor
  strips.
- `icon-project-hub-repairs`: an open-ended wrench.
- `icon-project-nursery-beacon`: a lantern with a lit core over a cradle.
- `icon-project-current-buoys`: buoys along a current that ends in an arrow.
- `icon-shop-ammo-missile`, `icon-shop-ammo-energy` and `icon-shop-ammo-shell`:
  the ammunition kind's HUD glyph, upright stock.
