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
| `basic`        | `public/art/ui/icons/weapon-basic.svg`        | One bolt: a 4 px capsule head on a 2 px trail         |
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
| `ammo-energy.svg`         | `e6708a0245b46f5a0b30861f8e7563fcd7da2f24cdf60e0fd8a12bbe47740701` |
| `ammo-missile.svg`        | `4b206ed8131c1699b460d8a6eae65f53f2a49a3490d03a4f00f489494928e836` |
| `ammo-shell.svg`          | `14108bd554451ee974486a4a053a6e2525ac8afc8c3820ab520947c5e886f16c` |
| `weapon-basic.svg`        | `94d4d1eae303b381f8d76baeba70e1cd0622a0d9c6fab3bb5998aacd60da6907` |
| `weapon-heavyMissile.svg` | `2ad7a6243bba7c6adea5f73c012fd1def43f4b5560f5f7532a42f8685408c829` |
| `weapon-multiLaser.svg`   | `1075f62fb2856d21b711c9d78f2c048b1c5a513302b6921e3cabe26dc198e247` |
| `weapon-phaser.svg`       | `688ed92c17cc1a6414bb4ba515b52420c1d005f70e85bcc57edafee3388f9838` |
| `weapon-rapidMissile.svg` | `9ec61fa0a35c711877e64fce082ed87f267bc2328e295c585d9d6122fd0dda24` |
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
colours. It shows owned weapons only, left to right in the order Basic, Rapid
Missile, Multi-Laser, Heavy Missile, Scattershot, Phaser. The same 20 px SVGs draw at 14 px in amber inside
[weapon pickups](weapons.md#pickups). Each non-Basic disc
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
