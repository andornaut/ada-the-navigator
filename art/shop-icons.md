# Shop icons

The [Shop](shop.md) and Jobs & Projects draw their glyphs from
`/art/ui/icons/`. The normal ink is cream `#ead4aa` on the navy
`#262b44` item well. Shop rows and their confirm dialogs share
`src/ui/stationItemIcon.ts`.

| Item                      | Asset or treatment                                      | Size  |
| ------------------------- | ------------------------------------------------------- | ----- |
| Weapons                   | `weapon-<id>.svg`, shared with the HUD                  | 20x20 |
| Ammunition                | `ammo-<kind>.svg`, upright stock glyph                  | 20x20 |
| Weapon upgrade            | Weapon glyph with its upgrade badge                     | 24x24 |
| Shield                    | `icon-shop-shield.svg`, a half-filled shield            | 20x20 |
| Engine tuning             | `icon-shop-engine-tuning.svg`, a gauge                  | 20x20 |
| Tractor beam              | `icon-shop-tractor-beam.svg`, a beam with a caught mote | 20x20 |
| Ship paint equipment icon | `icon-shop-ship-paint.svg`, a paint roller              | 20x20 |
| Shop paint swatch         | The paint scheme's idle frame 12                        | 32x32 |
| Owned and In use          | `icon-shop-check.svg`                                   | 12x8  |
| Upgrade badge             | `icon-shop-upgrade-badge.svg`                           | 12x12 |

[Weapon icons](weapon-icons.md) lists each weapon and ammunition mask.
Shop ammunition uses the stock glyph by itself in the well. Ship uses the
equipment SVGs for its equipment rows. Paint schemes in Shop retain their
ship swatches.

## Job icons

Each [job row](shop.md#job-board) uses its job type's 20x20 station SVG.
Repeatable activities share the Activity glyph. The Map's
[separate job symbols](map.md#symbols) use `map-job-<type>.svg`.
Active activities use the target's map chip and the Quests “Job:” line.

| Job type       | SVG key             | Glyph                      |
| -------------- | ------------------- | -------------------------- |
| Survey         | `icon-job-survey`   | Folded chart with an X     |
| Delivery       | `icon-job-delivery` | Parcel with a cutout label |
| Rescue and tow | `icon-job-rescue`   | Tow hook and eye           |
| Lost-item hunt | `icon-job-hunt`     | Magnifier                  |
| Activity       | `icon-job-activity` | Circular repeat arrow      |

## Project icons

Each [community project](projects.md) uses its 20x20 glyph in the row well
and reuses it in the contribution dialog.

| Project            | SVG key                        |
| ------------------ | ------------------------------ |
| Greenhouse ring    | `icon-project-greenhouse-ring` |
| Workshop crane     | `icon-project-workshop-crane`  |
| Salvage beacons    | `icon-project-salvage-beacons` |
| Second docking bay | `icon-project-docking-bay`     |
| Hub repairs        | `icon-project-hub-repairs`     |
| Nursery beacon     | `icon-project-nursery-beacon`  |
| Current-map buoys  | `icon-project-current-buoys`   |
| Quiet crossing     | `icon-project-quiet-crossing`  |
| Channel lights     | `icon-project-channel-lights`  |
| Loom hall          | `icon-project-loom-hall`       |
| Practice berth     | `icon-project-practice-berth`  |
| Courier school     | `icon-project-courier-school`  |
| Spare beacon       | `icon-project-spare-beacon`    |
| Route exchange     | `icon-project-route-exchange`  |

## Upgrade composite

The 24x24 box places the 20x20 weapon mask at (0, 4) and the 12x12 badge at
(12, 0). The badge's ink face and outline separate its chevron from the
overlapped weapon mark.

## States

- Weapon and ammo masks inherit the well's ink. Normal wells use `#ead4aa`
  and unaffordable wells use `#9a96ad`.
- Equipment, Jobs and Projects use `<key>.svg` and `<key>-disabled.svg`.
  These assets supply their own cream and muted ink. The unaffordable row
  state selects the disabled file. Shop upgrades also swap to the disabled
  badge.
- The check mark has one cream SVG for Owned and In use. The active glyphs
  draw with smooth sampling. Paint swatches retain pixelated sampling.

`art/tools/jobs-projects-svg.ts` writes the Jobs and Projects vectors.
`art/tools/shop-equipment-svg.ts` writes equipment vectors, and
`art/tools/weapon-icons.ts` writes the shared weapon and ammo masks.

## Raster references

The UI manifest retains the generic double-chevron `icon-shop-weapon-upgrade`
sheet. Weapon upgrade rows use the weapon and badge composite.

The following original PNG hashes identify source art for the retired sheets
and the retained generic upgrade sheet. Their PNG and JSON bytes are preserved
under `public/art/ui/sprites/` in Git. Use the parent of `199128c0` for the
weapon, ammo, Jobs and Projects rasters, the parent of `9fccb8f8` for equipment,
and the parent of `ebc39cac` for the check and badge.

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
| `icon-shop-weapon-rapidMissile.png` | `20bac149a5ca5e1f4b8fd1f74894f9afc571b931f73bd58dfe7757c9f82e97fe` |
| `icon-shop-weapon-scattershot.png`  | `c9a03fc49da03bed20e21eb493694d9eca461e4351f7ebfc64af652a9a6ebf37` |
| `icon-shop-weapon-upgrade.png`      | `bbb8df92ae714b76ccc4e144b9e67ab752f8d71579ad24fa8f95d7b25d4496aa` |
