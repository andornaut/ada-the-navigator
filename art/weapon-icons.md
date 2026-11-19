# Weapon icons

Native SVG source, 20 × 20 px, `viewBox="0 0 20 20"`, transparent background.
Warm cream (`#ead4aa`) paths follow Chibi's compact navigation icon style, with
at least 2 px padding; Rapid Missile's lower trail dash runs to the left edge.
Laser strokes and scatter dots are 2 px thick.

## Current roster

Six weapons, each with a 20 px mask SVG and a [shop sheet](shop-icons.md)
`icon-shop-weapon-<id>`. IDs match Tech's weapon IDs. Filename case matches the
direct DOM URL `weapon-${id}.svg`.

| ID             | Path                                          | Icon semantics                                        |
| -------------- | --------------------------------------------- | ----------------------------------------------------- |
| `laser`        | `public/art/ui/icons/weapon-laser.svg`        | One bolt: a 4 px capsule head on a 2 px trail         |
| `rapidMissile` | `public/art/ui/icons/weapon-rapidMissile.svg` | Two slim staggered darts, each with a trail dash      |
| `multiLaser`   | `public/art/ui/icons/weapon-multiLaser.svg`   | Three 2 px bolts fanning from one origin              |
| `heavyMissile` | `public/art/ui/icons/weapon-heavyMissile.svg` | One deep body, warhead seam, rear fins, heavy exhaust |
| `scattershot`  | `public/art/ui/icons/weapon-scattershot.svg`  | Seven separate solid dots in a wide fan               |
| `phaser`       | `public/art/ui/icons/weapon-phaser.svg`       | A 2 px beam ending in a five-ray starburst            |

## Pixel grids

Every weapon and ammunition glyph is a 20 × 20 pixel grid in
`art/tools/weapon-icons.ts`. Each grid writes its shop sheet and registers it
in the UI manifest. The ammunition grids and five weapon grids also write their
HUD SVG as one path of whole-pixel runs; Scattershot's SVG is
hand-authored, and the tool checks that its grid matches that SVG's rectangles.
Rebuild with `node art/tools/weapon-icons.ts`.

| SVG                       | SHA-256                                                            |
| ------------------------- | ------------------------------------------------------------------ |
| `ammo-energy.svg`         | `6266a54397ac19f829fee0b1dbe57095815ce5400537d9f17dad5d0a3e143c33` |
| `ammo-missile.svg`        | `3f0091ae0affb1bdf98023513f28e6910b696518a05243a21dc457530fcf3e22` |
| `ammo-shell.svg`          | `5cfe832ed7a152f1ab5457625d78d0c168fe03f4893b4d8b37c4512a43f5acd1` |
| `weapon-laser.svg`        | `fcc831f563cccad2bf12512f32ee757c58cad3cabd4c4b9e9a95cba6df754a34` |
| `weapon-heavyMissile.svg` | `e43fe516d9e3f7503504f83502ed51564fbb17bfcd167e59d7b535e9c3ac6509` |
| `weapon-multiLaser.svg`   | `154d7be25169bb8e3619dd7d331cfb3a3e6be93941a4f4695666b93b5cc42318` |
| `weapon-phaser.svg`       | `fcf71d5cff54072faa7d5ed9d69d8c4470f6dc16c648a5ab71f025dd5841d5fe` |
| `weapon-rapidMissile.svg` | `88121e0f40abae9d1048c6b32d306e5e01cc0788046a40ebc93753f62ca2cab2` |
| `weapon-scattershot.svg`  | `e580a47402045f782c4d43b51060d8c096186455f45f5cd8312dea4d694920fd` |

## Ammunition icons

Three ammunition kinds, each a 20 px mask SVG and a [shop sheet](shop-icons.md)
`icon-shop-ammo-<kind>`, on the same grid rules. Ammunition stands upright as
stock; every weapon glyph is fire travelling right, so the two never read alike.

| Kind      | Path                                   | Weapons                      | Icon semantics                                                   |
| --------- | -------------------------------------- | ---------------------------- | ---------------------------------------------------------------- |
| `missile` | `public/art/ui/icons/ammo-missile.svg` | Rapid Missile, Heavy Missile | Two upright missiles on a rack bar: noses, warhead seam, fins    |
| `energy`  | `public/art/ui/icons/ammo-energy.svg`  | Multi-Laser, Phaser          | An upright cell: terminal cap, 2 px case, three charge bars      |
| `shell`   | `public/art/ui/icons/ammo-shell.svg`   | Scattershot                  | Two upright shells: crimped tops, hull seam over the brass, rims |

Each grid is centred with 2 px padding and is symmetric about the vertical
centre line. The shop's [ammunition rows](shop.md#ammunition-rows) draw the
sheet alone in the item well; the SVGs are the masks for any DOM or HUD use, in
the state colours of [Controls](controls.md#top-right-hud-icon-buttons).

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
