# Weapon icons

Native SVG source, 20 × 20 px, `viewBox="0 0 20 20"`, transparent background.
Warm cream (`#ead4aa`) masks follow Chibi's compact navigation icon style.
Weapon glyphs are bold vector shapes: filled bodies and round-capped strokes
2.4 to 2.8 px wide, with no part thinner than 2.4 px. Each spans 14.4 to
16.5 px of the box and keeps at least 2.4 px of padding on every side.
Ammunition glyphs are whole-pixel grids with 2 px padding.

## Current roster

Six weapons share their 20 px SVG masks across the HUD, [Shop](shop-icons.md),
and weapon details. Filename case follows the runtime IDs in
`src/data/weaponGlyphs.ts`. Every weapon glyph is fire travelling right.

| ID             | Path                                          | Icon semantics                                         | Drawn extent (px) |
| -------------- | --------------------------------------------- | ------------------------------------------------------ | ----------------- |
| `laser`        | `public/art/ui/icons/weapon-laser.svg`        | One bolt: a round-nosed slug on a short trail          | 16.0 by 5.2       |
| `rapidMissile` | `public/art/ui/icons/weapon-rapidMissile.svg` | Two staggered darts                                    | 14.4 by 13.6      |
| `multiLaser`   | `public/art/ui/icons/weapon-multiLaser.svg`   | Three bolts fanning from one muzzle dot                | 16.5 by 15.8      |
| `heavyMissile` | `public/art/ui/icons/weapon-heavyMissile.svg` | One heavy warhead with a swept tail fin block          | 15.0 by 12.4      |
| `scattershot`  | `public/art/ui/icons/weapon-scattershot.svg`  | Six round pellets spreading in a cone: one, two, three | 14.6 by 14.2      |
| `phaser`       | `public/art/ui/icons/weapon-phaser.svg`       | A short beam and two widening arcs ahead of it         | 15.7 by 13.6      |

## Sources

`art/tools/weapon-icons.ts` holds every weapon glyph as vector shapes and
every ammunition glyph as a 20 × 20 pixel grid written as whole-pixel runs.
Rebuild with `node art/tools/weapon-icons.ts`, then pack the sheets with
`node art/tools/ui-icon-sheets.ts --out <scratch directory>`. The views
`weapon-<id>` and `ammo-<kind>` are in `public/art/ui/icons/icons-20x20.svg`.

| SVG source                | SHA-256                                                            |
| ------------------------- | ------------------------------------------------------------------ |
| `ammo-energy.svg`         | `6266a54397ac19f829fee0b1dbe57095815ce5400537d9f17dad5d0a3e143c33` |
| `ammo-missile.svg`        | `3f0091ae0affb1bdf98023513f28e6910b696518a05243a21dc457530fcf3e22` |
| `ammo-shell.svg`          | `5cfe832ed7a152f1ab5457625d78d0c168fe03f4893b4d8b37c4512a43f5acd1` |
| `weapon-laser.svg`        | `0e8e66d2cd82f8ddb19986a8f6f900c759aeabb56a1178ecd5d29706d96559ca` |
| `weapon-heavyMissile.svg` | `e65e28b5c00c24a6286d24ebe0f2763a5c71d5e9be1eee6be91e1f2936b31126` |
| `weapon-multiLaser.svg`   | `dacc3d7606e7cc68b66ccc8e36b1fd8a6e8d81de82c4b692a66b1d5bea4fc6ae` |
| `weapon-phaser.svg`       | `1b3f82ce820236672f5de3c87fcd3f863829eecfadda25b90bbf093ef7d52ce0` |
| `weapon-rapidMissile.svg` | `7d5cee78397439d76cca412dd0abae48d2c5d9b48c81d7de5c1eb5e29be51799` |
| `weapon-scattershot.svg`  | `ca3ed172c200e61312a0a8da46fa38b3a87d001e0790ee4cd07a32cd0bf8be6f` |

## Ammunition icons

Three ammunition kinds use 20 px SVG masks on the same grid rules.
Ammunition stands upright as stock, while weapon glyphs show fire travelling
right.

| Kind      | Path                                   | Weapons                      | Icon semantics                                                   |
| --------- | -------------------------------------- | ---------------------------- | ---------------------------------------------------------------- |
| `missile` | `public/art/ui/icons/ammo-missile.svg` | Rapid Missile, Heavy Missile | Two upright missiles on a rack bar: noses, warhead seam, fins    |
| `energy`  | `public/art/ui/icons/ammo-energy.svg`  | Multi-Laser, Phaser          | An upright cell: terminal cap, 2 px case, three charge bars      |
| `shell`   | `public/art/ui/icons/ammo-shell.svg`   | Scattershot                  | Two upright shells: crimped tops, hull seam over the brass, rims |

Each grid is centred with 2 px padding and is symmetric about the vertical
centre line. Shop [ammunition rows](shop.md#ammunition-rows) draw the mask in
the item well, using the well's ink. Weapon detail ammo rows use the same
kind mapping.

## HUD glyphs

The top-right weapon selector draws the 20 px icons as masks on its 33 px discs;
[Controls](controls.md#top-right-hud-icon-buttons) defines their states and
colours. It shows owned weapons only, left to right in the order Laser, Multi-Laser,
Rapid Missile, Heavy Missile, Scattershot, Phaser. The
[upgrade pickup](weapons.md#pickups) shows no weapon glyph. Each non-Laser disc
carries its ammunition [count pill](controls.md#ammunition-count), and an empty
weapon's glyph dims to `#75748c`.

## Projectiles

[Weapons](weapons.md) specifies every projectile, blast, the Multi-Laser fan,
the Phaser beam and pickups. These icons do not define runtime geometry or timing.
Gameplay owns weapon labels.

## Integration

Each SVG is decorative (`aria-hidden="true"`), with no embedded player strings.
The caller supplies the accessible weapon label on its control or image element,
using Gameplay's strings. Keep inline SVGs hidden from the accessibility tree.

Use Chibi's dark navigation button background. Cream glyphs have poor contrast on
cream cards; Tech owns button styling and final background contrast review.
