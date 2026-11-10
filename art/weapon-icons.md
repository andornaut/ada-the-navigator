# Weapon icons

Native SVG source, 20 × 20 px, `viewBox="0 0 20 20"`, transparent background.
Solid warm cream (`#f4e4bc`) paths use at least 2 px padding. The compact
silhouettes follow Chibi's navigation icon style and Ada's pickup glyph semantics.

| ID              | Path                                   | Semantics                              |
| --------------- | -------------------------------------- | -------------------------------------- |
| `weapon-basic`  | `public/art/ui/icons/weapon-basic.svg`  | Single rightward bolt                  |
| `weapon-rapid`  | `public/art/ui/icons/weapon-rapid.svg`  | Three parallel short shots             |
| `weapon-spread` | `public/art/ui/icons/weapon-spread.svg` | Three bolts fanning outward            |
| `weapon-pierce` | `public/art/ui/icons/weapon-pierce.svg` | Long arrow beam crossing a target bar  |

Each SVG is decorative (`aria-hidden="true"`), with no embedded player strings.
The caller supplies the accessible weapon label on its control or image element,
using Gameplay's strings. Keep inline SVGs hidden from the accessibility tree.

Use Chibi's dark navigation background. Cream glyphs have poor contrast on cream
cards; Tech owns button styling and final background contrast review. These files
contain no settings assets or runtime integration.
