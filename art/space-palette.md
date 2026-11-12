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
| `threat`            | `#FF6B6B` | Red for off-screen enemy edge markers only.                                   |

In a galaxy, `background`, `environment` and `environmentDetail` come from that
galaxy's [field hues](galaxies.md); the values above are the tint origin and the
fallback until a galaxy is set. Galaxy 1, Sunflower, makes the play field
Chibi's farm yellow `#D8C994`, a light field. Signal roles are the same in every
galaxy and stay at 5:1 or better on each dark galaxy's background; on a light
field every play object and pickup draws over an ink keyline
([Light fields](galaxies.md#light-fields)).

Keep environmental detail sparse so its combined coverage does not compete with
signals. Warm coral and amber balance cool lavender, mint and blue. Use signal
colors in compact accents with existing shapes and labels; color supplements
their existing meaning and introduces no mechanics.

Preserve the selected ship's white body and opaque blue canopy. Hardpoint color
is an accent, not a replacement hull palette. This palette is for space visuals;
the borrowed UI palette remains separate.

## Edge markers

A seen object outside the view shows a marker on the game area's border, on
the line from the view's centre to the object. The marker's outermost drawn
pixel, its light-field ink outline included, sits 1 logical px in from the game
area's edge. Markers draw on the canvas above every play object and
under the HTML HUD, at alpha 1. Sizes are logical px, scaled by `s`.

| Kind                                               | Glyph                                                                                  | Colour            |
| -------------------------------------------------- | -------------------------------------------------------------------------------------- | ----------------- |
| Enemy (swarm, fighter, interceptor, retaliator)    | Filled disc, 6 across                                                                  | `threat`          |
| Heavy (frigate, capital, platform, General Gadget) | Filled disc, 10 across                                                                 | `threat`          |
| Station (seen stations and outposts)               | Unfilled square diamond, 10 tall and 10 wide, 2 stroke inside that extent, miter joins | `pointOfInterest` |

`threat` is the one red in space, used only for these markers. It is at least
5.2:1 on every dark galaxy's background (Whirlpool 5.22:1, the default 5.28:1,
Cartwheel 5.32:1, Black Eye 6.25:1). It matches `obstacle` in luminance
(1.03:1), so the dot shape and the border position, not lightness, tell the
markers apart from coral art. `pointOfInterest` is 7.1:1 or more there.

On a light field (`tint.light`) each marker draws over an ink outline
(`lightField.markerOutline` 1): a disc over an ink disc 1 larger in radius,
the diamond over an ink stroke 2 wider (4) on the same path. Ink on Sunflower
is 10.90:1; bare `threat` there is 1.75:1.

## In-between

`inBetween` holds the in-between dimension's ramp, darkest to lightest, and its
shimmer. It colours the rock's glow, the cockpit's surroundings and the quantum
jump. The roles above do not read it.

| Key       | Value                                                 |
| --------- | ----------------------------------------------------- |
| `ramp`    | `#1F1A38`, `#3A2F6B`, `#5F4FA3`, `#9B82D4`, `#DCC3F2` |
| `shimmer` | `#8FE0F2`                                             |
