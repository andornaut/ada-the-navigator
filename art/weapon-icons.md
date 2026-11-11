# Weapon icons

Native SVG source, 20 × 20 px, `viewBox="0 0 20 20"`, transparent background.
Warm cream (`#ead4aa`) paths follow Chibi's compact navigation icon style, with
at least 2 px padding. Laser strokes and scatter dots are 2 px thick.

## Current roster

| ID            | Path                                         | Icon semantics                          |
| ------------- | -------------------------------------------- | --------------------------------------- |
| `basic`       | `public/art/ui/icons/weapon-basic.svg`       | Single rightward bolt, starter weapon   |
| `missiles`    | `public/art/ui/icons/weapon-missiles.svg`    | Pointed solid body, fins and exhaust    |
| `tripleLaser` | `public/art/ui/icons/weapon-tripleLaser.svg` | Three long thin bolts in a tight fan    |
| `scattershot` | `public/art/ui/icons/weapon-scattershot.svg` | Seven separate solid dots in a wide fan |

## HUD glyphs

The top-right weapon selector draws the 20 px icons as masks on its 33 px discs;
[Controls](controls.md#top-right-hud-icon-buttons) defines their states and
colours. The 20 px icons are also the shop row glyphs. The 24 × 24 px versions,
`public/art/ui/icons/weapon-${id}-24.svg`, `viewBox="0 0 24 24"`, follow the
20 px shapes with 4 px dots and exhaust, 3 px laser strokes and a larger bolt
head, and stay published for existing references.

Filename case matches the direct DOM URL `weapon-${id}.svg`. Legacy rapid, spread
and pierce icons remain available for existing references.

## Projectile visual specification

- Missiles: compact white projectile with an amber trail. Automatic fire, slow
  travel and cadence, high power. No manual trigger, homing or splash.
- Triple Laser: three thin amber bolts, centred at 0° with side bolts at ±20°.
- Scattershot: many small amber dot pellets in a shotgun fan, fading and vanishing
  by roughly half the projected screen width. Dots describe pellet shapes, not
  damage over time.

The logical screen is 720 × 360. Scattershot range follows projected screen width;
these assets do not define runtime projectile geometry or timing. Gameplay owns
weapon labels, including Missiles, Triple Laser and Scattershot.

## Integration

Each SVG is decorative (`aria-hidden="true"`), with no embedded player strings.
The caller supplies the accessible weapon label on its control or image element,
using Gameplay's strings. Keep inline SVGs hidden from the accessibility tree.

Use Chibi's dark navigation button background. Cream glyphs have poor contrast on
cream cards; Tech owns button styling and final background contrast review.
