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
| `ammo`              | `#8FD14F` | Leaf green for the [ammo pack](weapons.md#ammo-pack) pickup only.             |

In a galaxy, `background`, `environment` and `environmentDetail` come from that
galaxy's [field hues](galaxies.md); the values above are the tint origin and the
fallback until a galaxy is set. Galaxy 1, Sunflower, makes the play field
Chibi's farm yellow `#D8C994`, a light field. Signal roles are the same in every
galaxy and stay at 5:1 or better on each dark galaxy's background; on a light
field every play object and pickup draws over an ink keyline
([Light fields](galaxies.md#light-fields)).

`ammo` is the one green in space: 0.142 or more in Oklab from every other
signal and pickup colour (Stardust's shade `#C8A24E` 0.142, `active` 0.144,
`weapon` 0.146), so the ammo pack never reads as the amber upgrade pickup,
Stardust or an active element. It is 7.86:1 or more on every dark galaxy's
background (Whirlpool lowest).

Keep environmental detail sparse so its combined coverage does not compete with
signals. Warm coral and amber balance cool lavender, mint and blue. Use signal
colors in compact accents with existing shapes and labels; color supplements
their existing meaning and introduces no mechanics.

## Backdrop caps

The field behind play is the layered [backdrop](backdrop.md), drawn only in
field tones. One rule caps it: no backdrop area tone is brighter than the
galaxy's brightest backdrop tone today (`backdropLit`, or Andromeda's haze core
or Needle's band peak where brighter), or on a light field
darker than its darkest (`backdropSide`). So no signal, the ship or the ink
keyline ever loses contrast against the backdrop. Within it, each layer has
its own cap against the galaxy background (light field in brackets):

| Layer               | Cap                                                                                                  |
| ------------------- | ---------------------------------------------------------------------------------------------------- |
| Sky gradient        | 1.08:1, darker only (1.05:1)                                                                         |
| Plates              | Lighter 1.24:1, darker 1.16:1 (cream 1.10:1, darker 1.24:1)                                          |
| Planets and nebulae | Bodies 1.30:1; lit sides, rings and nebula cores at or under `backdropLit` under the brightest plate |
| Stars               | Far 1.8:1, near 3.0:1 at peak, points under 2 px (1.06 and 1.10:1)                                   |
| Dust streaks        | 1.35:1, 1 px                                                                                         |
| Backdrop rocks      | 1.8:1 ([backdrop rule](asteroids.md#backdrop))                                                       |

The art build fails when any cap is passed. A placeholder galaxy flies the base
field above, with a monochrome backdrop under the same caps.

Preserve the selected ship's white body and opaque blue canopy. Hardpoint color
is an accent, not a replacement hull palette. This palette is for space visuals;
the borrowed UI palette remains separate.

## Edge markers

A seen object outside the view shows a marker on the border of the safe game
area, on the line from the view's centre to the object. The safe game area is
the game area clamped by the safe insets, `safeRect(insets, SAFE_MARGIN.edge,
view)` (each edge moved in by its own inset); the marker's outermost drawn
pixel, its light-field ink outline included, sits 1 logical px inside it.
Positions are in [Layout](layout.md#edge-markers). Markers draw on the canvas
above every play object and under the sticks and the HTML HUD, at alpha 1.
Sizes are logical px, scaled by `s`.

| Kind                                               | Glyph                                                                                      | Colour            |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------ | ----------------- |
| Enemy (swarm, fighter, interceptor, retaliator)    | Filled disc, 6 across                                                                      | `threat`          |
| Heavy (frigate, capital, platform, General Gadget) | Filled disc, 10 across                                                                     | `threat`          |
| Guard (a heavy that still blocks a route)          | The heavy's disc, 10 across, with an ink `#181425` bar 7 wide and 2 tall across its centre | `threat`, ink bar |
| Station (seen stations and outposts)               | Unfilled square diamond, 10 tall and 10 wide, 2 stroke inside that extent, miter joins     | `pointOfInterest` |

`threat` is the one red in space, used only for these markers. It is at least
5.2:1 on every dark galaxy's background (Whirlpool 5.22:1, the default 5.28:1,
Cartwheel 5.32:1, Phantom 6.13:1). It matches `obstacle` in luminance
(1.03:1), so the dot shape and the border position, not lightness, tell the
markers apart from coral art. `pointOfInterest` is 7.1:1 or more there.

The guard's bar is a no-entry sign on the heavy's own disc: a guard is a heavy
that blocks a route. The bar is 6.49:1 against `threat`, so the guard reads
apart from the heavy at 1x and in greyscale, where the two discs share a
lightness. The bar's corners sit 1.4 inside the disc's edge (the disc spans
4.9 either side at the bar's top and bottom), so the bar never meets the field.

When a guard is disabled, its marker becomes the heavy marker in place: the bar
fades from alpha 1 to 0 over `EDGE_MARKERS.swapMs` 150 ms, linear, over the
unchanged disc, then the marker is the heavy's. Under reduced motion the bar is
removed at once. A guard Ada has not seen yet still shows its marker (Gameplay).

On a light field (`tint.light`) each marker draws over an ink outline
(`lightField.markerOutline` 1): a disc over an ink disc 1 larger in radius,
the diamond over an ink stroke 2 wider (4) on the same path. The guard's bar
draws on the disc in the same ink on every field, so it adds no outline. Ink on
Sunflower is 10.90:1; bare `threat` there is 1.75:1.

## In-between

`inBetween` holds the in-between dimension's ramp, darkest to lightest, and its
shimmer. It colours the rock's glow, the aboard backdrop's field and the quantum
jump. The roles above do not read it.

| Key       | Value                                                 |
| --------- | ----------------------------------------------------- |
| `ramp`    | `#1F1A38`, `#3A2F6B`, `#5F4FA3`, `#9B82D4`, `#DCC3F2` |
| `shimmer` | `#8FE0F2`                                             |
