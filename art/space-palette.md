# Space palette

Canonical values: [space-palette.json](../public/art/space-palette.json).

Use Chibi's soft pastel character with a darker, dusty lavender and blue-gray
space field. Keep surroundings quiet and low contrast; reserve stronger color
and contrast for points of interest, obstacles and active elements.

| Role                | Value     | Usage                                                                         |
| ------------------- | --------- | ----------------------------------------------------------------------------- |
| `background`        | `#292734` | Dark dusty lavender space field, visibly colored rather than near black.      |
| `environment`       | `#34333F` | Muted blue-gray environmental masses close to the background value.           |
| `environmentDetail` | `#403F4D` | Quiet environmental edges and details, close to the other surrounding values. |
| `pointOfInterest`   | `#C4AFCC` | Cool lavender pastel for existing points of interest.                         |
| `obstacle`          | `#D68B72` | Warm coral pastel with stronger saturation and contrast for obstacles.        |
| `active`            | `#65C9BF` | Brighter saturated mint for existing active elements.                         |
| `weapon`            | `#F0BD68` | Bright warm amber for existing weapon signals.                                |
| `shipHardpoint`     | `#70ACE8` | Bright cool blue accents for existing ship hardpoints.                        |

Keep environmental detail sparse so its combined coverage does not compete with
signals. Warm coral and amber balance cool lavender, mint and blue. Use signal
colors in compact accents with existing shapes and labels; color supplements
their existing meaning and introduces no mechanics.

Preserve the selected ship's white body and opaque blue canopy. Hardpoint color
is an accent, not a replacement hull palette. This palette is for space visuals;
the borrowed UI palette remains separate.
