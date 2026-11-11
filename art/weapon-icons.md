# Weapon icons

Native SVG source, 20 × 20 px, `viewBox="0 0 20 20"`, transparent background.
Warm cream (`#ead4aa`) paths follow Chibi's compact navigation icon style, with
at least 2 px padding; Rapid Missile's lower trail dash runs to the left edge.
Laser strokes and scatter dots are 2 px thick.

## Current roster

IDs match Tech's weapon IDs. Filename case matches the direct DOM URL
`weapon-${id}.svg`.

| ID             | Path                                          | Icon semantics                                        |
| -------------- | --------------------------------------------- | ----------------------------------------------------- |
| `basic`        | `public/art/ui/icons/weapon-basic.svg`        | One bolt: a 4 px capsule head on a 2 px trail         |
| `rapidMissile` | `public/art/ui/icons/weapon-rapidMissile.svg` | Two slim staggered darts, each with a trail dash      |
| `multiLaser`   | `public/art/ui/icons/weapon-multiLaser.svg`   | Three 2 px bolts fanning from one origin              |
| `heavyMissile` | `public/art/ui/icons/weapon-heavyMissile.svg` | One deep body, warhead seam, rear fins, heavy exhaust |
| `scattershot`  | `public/art/ui/icons/weapon-scattershot.svg`  | Seven separate solid dots in a wide fan               |
| `phaser`       | `public/art/ui/icons/weapon-phaser.svg`       | A 2 px beam ending in a five-ray starburst            |

`weapon-multiLaser.svg` replaces `weapon-tripleLaser.svg` for the `multiLaser`
ID. The `missiles` and `tripleLaser` icons, the legacy spread and pierce icons
and the 24 px set stay published for existing references; `weapon-basic-24.svg`
keeps the earlier arrow shape.

## Pixel grids

The Basic, Rapid Missile, Multi-Laser, Heavy Missile and Phaser glyphs are
20 × 20 pixel grids in `art/tools/weapon-icons.ts`. Each grid writes both its HUD SVG, one path of
whole-pixel runs, and its [shop sheet](shop-icons.md)
`icon-shop-weapon-<id>`, and registers the sheet in the UI manifest. Rebuild
with `node art/tools/weapon-icons.ts`. The other weapon SVGs, Scattershot's
included, are hand-authored.

| SVG                       | SHA-256                                                            |
| ------------------------- | ------------------------------------------------------------------ |
| `weapon-basic.svg`        | `94d4d1eae303b381f8d76baeba70e1cd0622a0d9c6fab3bb5998aacd60da6907` |
| `weapon-heavyMissile.svg` | `2ad7a6243bba7c6adea5f73c012fd1def43f4b5560f5f7532a42f8685408c829` |
| `weapon-multiLaser.svg`   | `1075f62fb2856d21b711c9d78f2c048b1c5a513302b6921e3cabe26dc198e247` |
| `weapon-phaser.svg`       | `688ed92c17cc1a6414bb4ba515b52420c1d005f70e85bcc57edafee3388f9838` |
| `weapon-rapidMissile.svg` | `9ec61fa0a35c711877e64fce082ed87f267bc2328e295c585d9d6122fd0dda24` |

## HUD glyphs

The top-right weapon selector draws the 20 px icons as masks on its 33 px discs;
[Controls](controls.md#top-right-hud-icon-buttons) defines their states and
colours. It shows owned weapons only, left to right in the order Basic, Rapid
Missile, Multi-Laser, Heavy Missile, Scattershot, Phaser. The 24 × 24 px
versions, `public/art/ui/icons/weapon-${id}-24.svg`, `viewBox="0 0 24 24"`,
follow the 20 px shapes with 4 px dots and exhaust, 3 px laser strokes and a
larger bolt head. The same 20 px SVGs draw at 14 px in amber inside
[weapon pickups](weapons.md#pickups).

## Projectiles

[Weapons](weapons.md) specifies every projectile, blast, the Multi-Laser fan
the Phaser beam and pickups. These icons do not define runtime geometry or timing.
Gameplay owns weapon labels.

## Integration

Each SVG is decorative (`aria-hidden="true"`), with no embedded player strings.
The caller supplies the accessible weapon label on its control or image element,
using Gameplay's strings. Keep inline SVGs hidden from the accessibility tree.

Use Chibi's dark navigation button background. Cream glyphs have poor contrast on
cream cards; Tech owns button styling and final background contrast review.
