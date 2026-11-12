# Galaxies

- Rebuild with `node art/tools/galaxies.ts`. It writes
  [galaxies.json](../public/art/galaxies.json) from the base field roles in
  [space-palette.json](../public/art/space-palette.json), formatted with the
  project's Prettier settings, and links it from the core manifest as
  `galaxyFields`. The build fails if any space signal falls below
  5:1 on a dark galaxy's background, or the ink keyline below 5:1 on a light
  galaxy's background.
- `galaxies` lists galaxy 1 to 4 in selector order with `number`, `id`,
  `tint` and `colors`. Ids are not display strings; Gameplay owns names and
  flavour lines.
- `lightField` holds the [light-field rule](#light-fields); `bank` holds field
  tints that no galaxy uses yet, with `id`, `tint` and `colors`.

## Field hues

Each galaxy retints the space field to one Oklab hue. `colors` holds the
results under the space palette's role names; they replace `background`,
`environment` and `environmentDetail` while Ada is in that galaxy. Signals
(`pointOfInterest`, `obstacle`, `active`, `weapon`, `shipHardpoint`), the ship
and the in-between colours never change.

| Number | Id          | `background` | `environment` | `environmentDetail` | Lowest edge contrast       |
| ------ | ----------- | ------------ | ------------- | ------------------- | -------------------------- |
| 1      | `sunflower` | `#D8C994`    | `#C9BA86`     | `#BAAB77`           | Ink keyline 10.90:1, light |
| 2      | `cartwheel` | `#39221E`    | `#452E2A`     | `#523A36`           | `obstacle` 5.48:1          |
| 3      | `whirlpool` | `#132D33`    | `#1F3940`     | `#2B464C`           | `obstacle` 5.37:1          |
| 4      | `black-eye` | `#271423`    | `#331F2F`     | `#3F2B3B`           | `obstacle` 6.44:1          |

On the dark galaxies every other signal is above 6:1. Sunflower is Chibi's farm
yellow: its environment (1.17:1) and detail (1.38:1) step darker than the
background, as Chibi's farm layers do. Bare signals there are 1.04:1
(`weapon`) to 1.63:1 (`obstacle`), so on a light field every play object and
pickup reads by its ink keyline.

## Tint rule

`tint` is `lightness` (Oklab L offset), `chroma`, `hue` (degrees) and, on a
light galaxy, `light: true`. A field colour keeps its own Oklab L plus
`lightness` and takes `chroma` at `hue`: `(L + lightness, chroma cos hue,
chroma sin hue)`, converted back to sRGB and clamped. The four base roles keep
their lightness steps, so the field reads the same in every galaxy, only in
another hue; Black Eye is also 0.055 darker.

With `light: true` each role's step from the base background mirrors below it:
`L' = 2 L_background - L + lightness`, with `L_background` the base
background's Oklab L. The background is unchanged by the mirror and the
environment and detail land darker by their usual steps. Sunflower's tint is
`lightness` +0.5549, `chroma` 0.0714, `hue` 94.2, which gives `#D8C994`
exactly.

The same rule retints raster space art and captures on a dark galaxy: a pixel
is field paint when its Oklab L is below `fieldPaint.lightness` (0.45) and its
chroma below `fieldPaint.chroma` (0.06). Other pixels are signals and stay as
they are. A light galaxy retints no raster art: the rule would lift ink and
dark outlines with the field.

## Light fields

A galaxy with `tint.light` has a light field. There Tech draws the following
from `lightField`, in addition to the usual art; a dark galaxy draws none of
it. Widths are logical px, scaled by `s` like every other space stroke; ink is
`#181425` (`lightField.ink`).

| Part                 | Rule                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Keyline              | Every play object and pickup draws over an opaque ink keyline (`keyline` 1): its drawn silhouette (alpha thresholded at 0.5, so the edge is crisp, never a soft fringe) grown by 1 px in all eight directions (a square kernel), directly beneath it in its depth slot, at its position, frame and alpha                                                                                                                                                                                                                                 |
| Keylined objects     | Ada's ship (hull and jets as one silhouette), the drones (swarm, fighter, interceptor, retaliator), the frigate and capital (hull, hardpoints and turret tops as one silhouette), play asteroids, Stardust, the discovery cache, outposts, the station, the holodisk pickup, the weapon pickup (its amber square and its glyph) (`keylined`)                                                                                                                                                                                             |
| Shots                | Each bolt draws over an ink line on the same endpoints and caps, `shotEdge` 1 wider each side (1.5 to 3.5). The Scattershot dot draws over an ink disc 1 larger in radius. Coral enemy bolts take the same ink edge as Ada's shots. The missile streak stays as it is                                                                                                                                                                                                                                                                    |
| Phaser beam          | The glow layer is ink, width 6.5 to 4 times `w`, alpha `0.9 a` (`phaser.glow`), in place of amber 8 to 5 at `0.38 a`; the bloom's outer disc is ink, radius `5 w`, alpha `0.6 a` (`phaser.bloom`). Body, core and the inner discs are unchanged. Reduced motion: the 4 px amber edge is ink at `0.9 a`                                                                                                                                                                                                                                   |
| Direction indicators | The arrow and circle's 2 px stroke at alpha 0.8 draws over a 4 px ink stroke (`indicatorStroke`) at alpha 0.8 on the same path, round joins                                                                                                                                                                                                                                                                                                                                                                                              |
| Edge markers         | Each disc draws over an ink disc 1 larger in radius; the station diamond over a 4 ink stroke on the same path (`markerOutline` 1); see [Edge markers](space-palette.md#edge-markers)                                                                                                                                                                                                                                                                                                                                                     |
| Jets                 | `jets.ship` replaces the layers in `ship-jets.json`, dropping the halo; `jets.enemy` replaces every enemy's jet layers. Each set is a flat dark outer layer and a core gradient. Mouths, widths and the length rule are unchanged                                                                                                                                                                                                                                                                                                        |
| Holodisk beacon      | Holds its `base` frame `#a83a96` (`holodiskBeacon`), with no pulse                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Effects              | The amber and coral effects draw over a 1 px ink edge with the same square kernel (`effects`): the missile dart and fins, blast ring strokes and flash outlines (never a blast's tint fill), hit sparks (rays, core and flecks), destruction shards and the feedback pulses (pickup diamonds and damage rings). A stroke draws over an ink stroke 2 wider on the same path; a filled shape over its silhouette grown by 1 px. The edge takes the effect's alpha. Corners rounded by less than a pixel off the square kernel are accepted |
| Status pill          | A 1 px ink outline around the shield icon and around the shield bar's rim (`hudOutline`), as on the `+N` tick; see [Controls](controls.md#status-pill)                                                                                                                                                                                                                                                                                                                                                                                   |
| Backdrop rocks       | The [light backdrop rule](asteroids.md#backdrop)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |

Contrast on Sunflower's `#D8C994` (WCAG):

| Item                             | Bare             | With the rule        |
| -------------------------------- | ---------------- | -------------------- |
| Silhouette edge, median          | 1.22 to 1.85:1   | Ink keyline, 10.90:1 |
| Ship jet outer                   | `#8ac0e6` 1.18:1 | `#1767b3` 3.50:1     |
| Enemy jet outer                  | `#d4826a` 1.76:1 | `#7f4b3d` 4.27:1     |
| Bolts and dot                    | 1.04 to 1.63:1   | Ink edge, 10.90:1    |
| Weapon pickup, blasts, sparks    | Amber 1.04:1     | Ink edge, 10.90:1    |
| Destruction shards               | Coral 1.63:1     | Ink edge, 10.90:1    |
| Phaser glow                      | 1.02:1           | Ink at 0.9, 8.93:1   |
| Direction indicators             | 1.18 to 1.61:1   | Ink at 0.8, 6.93:1   |
| Holodisk beacon                  | Bright 1.75:1    | Base held, 3.42:1    |
| Lit play stone (`#8A8279`)       | 2.29:1           | Ink keyline, 10.90:1 |
| `+N` tick, mint with ink outline | Outline 10.90:1  | Unchanged            |

The HUD panels are the same on every field, and only the status pill gains
its ink outlines on a light field; panel numbers are in
[Controls](controls.md#status-pill).

## Asset bank

All art is one shared bank; Gameplay places content per galaxy
([Presentation](../gameplay/ships.md#presentation)). Art's record of the bank
and where each asset sits:

| Asset                                                         | Placement                                               |
| ------------------------------------------------------------- | ------------------------------------------------------- |
| Trading station                                               | Shared, keylined on Sunflower                           |
| Discovery cache                                               | Shared, keylined on Sunflower                           |
| Coral frigate and capital                                     | Shared, keylined on Sunflower                           |
| Sunflower's outposts (growers, workshop, salvagers)           | Sunflower, keylined                                     |
| Coral drone family (swarm, fighter, interceptor, retaliator)  | Shared, keylined on Sunflower                           |
| [Claim-jumper family and turret platform](heavies.md)         | Cartwheel                                               |
| Play asteroids                                                | Shared                                                  |
| Stardust                                                      | Shared                                                  |
| [Current streaks and river debris](whirlpool.md)              | Whirlpool                                               |
| Backdrop rocks                                                | Shared, tinted per galaxy (`tints` in `asteroids.json`) |
| Dark gold field `#332712`, `#3F331E`, `#4C3F29` (`dark-gold`) | `bank`, no galaxy: a field for a later dark galaxy      |

## Selector preview

The [galaxy selector](layout.md#galaxy-selector) card shows one preview per
galaxy, `preview` in the data. Tech captures each one; Art owns this spec.

- Capture the galaxy's space view with no HUD, touch controls, notices, panels
  or cards, at 1 px per logical px.
- Unlocked: capture in the galaxy's own field (its `colors`, backdrop tints
  and, on a light galaxy, the light-field rule). Do not tint-map a base-field
  capture: the tint rule lifts ink on a light field.
- Crop a 360 by 180 logical px window (`preview.crop`) framed off centre: the
  galaxy's first destination sits a third in from the crop's left edge (x 120,
  y 90), and the rest of the crop shows field and backdrop rocks on the cleared
  side. Ada's ship may appear.
- Halve it to 180 by 90 (`preview.width`, `preview.height`) by nearest
  neighbour and draw it at that size in a 1 px `#181425` frame.
- Locked: unchanged. A base-field capture in greyscale, each pixel `30 + 0.6 Y`
  (`preview.locked`), with `Y` the ITU-R 601 luma, truncated. Every locked
  galaxy shares one grey range, so a locked preview gives away no hue.

## Space palette

`space-palette.json` keeps the base field (`#292734`, `#34333F`, `#403F4D`):
the tint origin, and the fallback until a galaxy is set. In play the field
comes from the current galaxy, so Sunflower, galaxy 1, replaces the base
`#292734` background with `#D8C994`.
