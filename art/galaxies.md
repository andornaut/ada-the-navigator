# Galaxies

- Rebuild with `node art/tools/galaxies.ts`. It writes
  [galaxies.json](../public/art/galaxies.json) from the base field roles in
  [space-palette.json](../public/art/space-palette.json), formatted with the
  project's Prettier settings, and links it from the core manifest as
  `galaxyFields`. The build fails if any space signal falls below
  5:1 on a dark galaxy's background, or the ink keyline below 5:1 on a light
  galaxy's background, or a [marker](#markers) below its ink or distance
  floors. It also draws the [placeholder previews](#placeholder-previews) and
  lists them in the core manifest.
- `galaxies` maps each stable galaxy id to its `tint`, `colors` and `marker`.
  It holds no position or number: route order, numbers, names and flavour
  lines are Gameplay's, and keys sit in id order.
- `marker` holds the [marker rule](#markers) and the shared locked grey;
  `lightField` holds the [light-field rule](#light-fields); `bank` maps field
  tints that no galaxy uses yet by id to their `tint` and `colors`.

## Field hues

Each galaxy retints the space field to one Oklab hue. `colors` holds the
results under the space palette's role names; they replace `background`,
`environment` and `environmentDetail` while Ada is in that galaxy. Signals
(`pointOfInterest`, `obstacle`, `active`, `weapon`, `shipHardpoint`), the ship
and the in-between colours never change.

| Id          | `background` | `environment` | `environmentDetail` | Lowest edge contrast       |
| ----------- | ------------ | ------------- | ------------------- | -------------------------- |
| `sunflower` | `#D8C994`    | `#C9BA86`     | `#BAAB77`           | Ink keyline 10.90:1, light |
| `whirlpool` | `#132D33`    | `#1F3940`     | `#2B464C`           | `obstacle` 5.37:1          |
| `needle`    | `#26221F`    | `#312D2A`     | `#3E3936`           | `obstacle` 5.86:1          |
| `andromeda` | `#232641`    | `#2F324E`     | `#3A3E5B`           | `obstacle` 5.47:1          |
| `cartwheel` | `#39221E`    | `#452E2A`     | `#523A36`           | `obstacle` 5.48:1          |
| `black-eye` | `#241827`    | `#302333`     | `#3C2E3F`           | `obstacle` 6.31:1          |

On the dark galaxies every other signal is above 6:1. Needle is a warm
graphite, so its thin silver line of stars carries the galaxy; Andromeda is a
deep blue under the brightest marker on the route. On both, the ship's white
body is 14.74:1 or more and its darkest hull tone `#9AABBF` 6.28:1 or more, and
cream HUD text on the ink panel at 0.65 is 11.71:1 or more. Sunflower is Chibi's farm
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
another hue; Needle is also 0.025 darker and Black Eye 0.05.

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
| Keyline              | Every play object and pickup draws over an opaque ink keyline (`keyline` 1, and 2 for stations, outposts and story places: `destinationKeyline`, see [Destinations](destinations.md#light-field-keyline)): its drawn silhouette (alpha thresholded at 0.5, so the edge is crisp, never a soft fringe) grown by 1 px in all eight directions (a square kernel), directly beneath it in its depth slot, at its position, frame and alpha                                                                                                   |
| Keylined objects     | Ada's ship (hull and jets as one silhouette), the drones (swarm, fighter, interceptor, retaliator), the frigate and capital (hull, hardpoints and turret tops as one silhouette), play asteroids, Stardust, the discovery cache, outposts, the station, the holodisk pickup, the upgrade pickup (its amber square and its two chevrons), the wreck and beacon landmarks, the nebula's stars, the lost item's glint ([Job art](jobs.md)) and the stranded craft ([Stranded craft](cartwheel-props.md#stranded-craft)) (`keylined`)        |
| Shots                | Each bolt draws over an ink line on the same endpoints and caps, `shotEdge` 1 wider each side (1.5 to 3.5). The Scattershot dot draws over an ink disc 1 larger in radius. Coral enemy bolts take the same ink edge as Ada's shots. The missile streak stays as it is                                                                                                                                                                                                                                                                    |
| Phaser beam          | The glow layer is ink, width 6.5 to 4 times `w`, alpha `0.9 a` (`phaser.glow`), in place of amber 8 to 5 at `0.38 a`; the bloom's outer disc is ink, radius `5 w`, alpha `0.6 a` (`phaser.bloom`). Body, core and the inner discs are unchanged. Reduced motion: the 4 px amber edge is ink at `0.9 a`                                                                                                                                                                                                                                   |
| Enemy weapons        | The enemy Phaser and the enemy-only weapons take ink edges and an ink beam glow ([enemy-only conventions](weapons.md#enemy-only-conventions))                                                                                                                                                                                                                                                                                                                                                                                            |
| Direction indicators | The arrow and circle's 2 px stroke at alpha 0.8 draws over a 4 px ink stroke (`indicatorStroke`) at alpha 0.8 on the same path, round joins                                                                                                                                                                                                                                                                                                                                                                                              |
| Edge markers         | Each disc draws over an ink disc 1 larger in radius; the station diamond over a 4 ink stroke on the same path (`markerOutline` 1); see [Edge markers](space-palette.md#edge-markers)                                                                                                                                                                                                                                                                                                                                                     |
| Jets                 | `jets.shipLevels` replaces Ada's engine level's layers in `ship-jets.json`, dropping the halo: outer `#1767b3`, `#a84400` and `#7a3fd6` at levels 1 to 3, cores `#2585d0` to `#64caff`, `#ea6a00` to `#ffb24d` and `#8652e7` to `#b98cff`; `jets.enemy` replaces every enemy's jet layers. Each set is a flat dark outer layer and a core gradient. Mouths, widths and the length rule are unchanged                                                                                                                                     |
| Holodisk beacon      | Holds its `base` frame `#a83a96` (`holodiskBeacon`), with no pulse                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Effects              | The amber and coral effects draw over a 1 px ink edge with the same square kernel (`effects`): the missile dart and fins, blast ring strokes and flash outlines (never a blast's tint fill), hit sparks (rays, core and flecks), destruction shards and the feedback pulses (pickup diamonds and damage rings). A stroke draws over an ink stroke 2 wider on the same path; a filled shape over its silhouette grown by 1 px. The edge takes the effect's alpha. Corners rounded by less than a pixel off the square kernel are accepted |
| Status pill          | A 1 px ink outline around the shield icon and around the shield bar's rim (`hudOutline`), as on the `+N` tick; see [Controls](controls.md#status-pill)                                                                                                                                                                                                                                                                                                                                                                                   |
| Backdrop rocks       | The [light backdrop rule](asteroids.md#backdrop)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |

Contrast on Sunflower's `#D8C994` (WCAG):

| Item                             | Bare             | With the rule                                        |
| -------------------------------- | ---------------- | ---------------------------------------------------- |
| Silhouette edge, median          | 1.22 to 1.85:1   | Ink keyline, 10.90:1                                 |
| Ship jet outer, levels 1 to 3    | `#8ac0e6` 1.18:1 | `#1767b3` 3.50:1, `#a84400` 3.64:1, `#7a3fd6` 3.62:1 |
| Enemy jet outer                  | `#d4826a` 1.76:1 | `#7f4b3d` 4.27:1                                     |
| Bolts and dot                    | 1.04 to 1.63:1   | Ink edge, 10.90:1                                    |
| Upgrade pickup, blasts, sparks   | Amber 1.04:1     | Ink edge, 10.90:1                                    |
| Destruction shards               | Coral 1.63:1     | Ink edge, 10.90:1                                    |
| Phaser glow                      | 1.02:1           | Ink at 0.9, 8.93:1                                   |
| Direction indicators             | 1.18 to 1.61:1   | Ink at 0.8, 6.93:1                                   |
| Holodisk beacon                  | Bright 1.75:1    | Base held, 3.42:1                                    |
| Lit play stone (`#8A8279`)       | 2.29:1           | Ink keyline, 10.90:1                                 |
| `+N` tick, mint with ink outline | Outline 10.90:1  | Unchanged                                            |

The HUD panels are the same on every field, and only the status pill gains
its ink outlines on a light field; panel numbers are in
[Controls](controls.md#status-pill).

## Asset bank

All art is one shared bank; Gameplay places content per galaxy
([Presentation](../gameplay/ships.md#presentation)). Art's record of the bank
and where each asset sits:

| Asset                                                                                                                                                                                                                          | Placement                                                                   |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------- |
| Trading station                                                                                                                                                                                                                | Sunflower only, keylined                                                    |
| Station art per galaxy: [mining hub](cartwheel.md), [settlers' station](andromeda.md#settlers-station), [Weavers' station](needle.md#weavers-station), [Eddy](whirlpool.md#station), [Black Eye station](black-eye.md#station) | Cartwheel, Andromeda, Needle, Whirlpool, Black Eye: every station there     |
| Discovery cache                                                                                                                                                                                                                | Shared, keylined on Sunflower                                               |
| Landmarks (nebula, wreck, beacon) and the lost item's glint                                                                                                                                                                    | Shared, nebula tinted per galaxy; keylined on Sunflower                     |
| Coral frigate and capital                                                                                                                                                                                                      | Shared, keylined on Sunflower                                               |
| Sunflower's outposts (growers, workshop, salvagers)                                                                                                                                                                            | Sunflower, keylined                                                         |
| [Andromeda's settlements](andromeda.md#settlements) (hamlet, lamp house)                                                                                                                                                       | Andromeda                                                                   |
| [Guide beacons](andromeda.md#guide-beacons) (lit, dented, relit)                                                                                                                                                               | Andromeda                                                                   |
| [Pip's mail scooter](andromeda.md#pips-mail-scooter)                                                                                                                                                                           | Andromeda                                                                   |
| [Courier school and spare beacon](andromeda.md#world-changes)                                                                                                                                                                  | Andromeda, once funded                                                      |
| [Pip's and the settler's portraits](andromeda.md#portraits)                                                                                                                                                                    | Andromeda                                                                   |
| Coral drone family (swarm, fighter, interceptor, retaliator)                                                                                                                                                                   | Shared, keylined on Sunflower                                               |
| [Claim-jumper family and turret platform](heavies.md)                                                                                                                                                                          | Cartwheel                                                                   |
| [Cartwheel's stranded craft](cartwheel-props.md#stranded-craft) (ore pod, stuck hauler)                                                                                                                                        | Cartwheel                                                                   |
| [Sunflower's stranded craft](outposts.md#stranded-craft) (seed pod, scrap barge)                                                                                                                                               | Sunflower, keylined                                                         |
| [Whirlpool's stranded craft](whirlpool.md#stranded-craft) (current skimmer, shell pod)                                                                                                                                         | Whirlpool                                                                   |
| [Needle's stranded craft](needle.md#stranded-craft) (stuck glider, spool pod)                                                                                                                                                  | Needle                                                                      |
| [Andromeda's stranded craft](andromeda.md#stranded-craft) (lost courier, drifting lamp buoy)                                                                                                                                   | Andromeda                                                                   |
| [Black Eye's stranded craft](black-eye.md#stranded-craft) (traveler's pod)                                                                                                                                                     | Black Eye                                                                   |
| [Garnet drone family, frigate and capital](andromeda.md#garnet-drones)                                                                                                                                                         | Andromeda                                                                   |
| Play asteroids                                                                                                                                                                                                                 | Shared                                                                      |
| Stardust                                                                                                                                                                                                                       | Shared                                                                      |
| [Current streaks and river debris](whirlpool.md)                                                                                                                                                                               | Whirlpool                                                                   |
| [Ring gates, channel stitch and debris, the Eye](needle.md#ring-gates)                                                                                                                                                         | Needle                                                                      |
| [Elder Loom's saucer and portrait](needle.md#elder-looms-saucer)                                                                                                                                                               | Needle                                                                      |
| [Channel lights and Loom hall](needle.md#world-changes)                                                                                                                                                                        | Needle, once funded                                                         |
| [Needle crimson drone family, frigate and capital](needle.md#needle-drones)                                                                                                                                                    | Needle                                                                      |
| [Edge-on band](needle.md#space-look)                                                                                                                                                                                           | Needle                                                                      |
| [Blurb settlements](black-eye.md) (homes, harbour, signal)                                                                                                                                                                     | Black Eye                                                                   |
| Backdrop rocks                                                                                                                                                                                                                 | Shared, tinted per galaxy (`tints` in `asteroids.json`)                     |
| [Backdrop haze](#backdrop-haze) (spiral arms and core)                                                                                                                                                                         | Andromeda                                                                   |
| [Backdrop layers](backdrop.md) (sky, plates, planets, stars, streaks)                                                                                                                                                          | Shared rules, drawn in each galaxy's own tones (`backdrop.json` per galaxy) |
| [Nebula banks](backdrop.md#generation)                                                                                                                                                                                         | Whirlpool                                                                   |
| Dark gold field `#332712`, `#3F331E`, `#4C3F29` (`dark-gold`)                                                                                                                                                                  | `bank`, no galaxy: a field for a later dark galaxy                          |

## Markers

Each galaxy's route-map [marker](layout.md#galaxy-selector) takes its main hue
(`marker` per galaxy):

- A light galaxy's marker is its background. A dark galaxy's is Oklab L 0.83
  (`marker.lightness`) at its tint hue with twice its tint chroma
  (`marker.chromaScale`), so every marker sits at one lightness and differs by
  hue.
- Every locked marker is one grey, `#8B8B8B` (`marker.locked`), so a locked
  marker gives away no hue.
- The build fails if ink is below 4.5:1 on a marker or the locked grey (each
  face carries an ink route number), if two markers are less than 0.055 apart
  in Oklab, or if a marker is less than 0.15 from the locked grey.

| Id          | `marker`  | Ink on it | Oklab distance to the locked grey |
| ----------- | --------- | --------- | --------------------------------- |
| `sunflower` | `#D8C994` | 10.90:1   | 0.211                             |
| `whirlpool` | `#94D3E3` | 10.88:1   | 0.205                             |
| `needle`    | `#CFC5BD` | 10.62:1   | 0.193                             |
| `andromeda` | `#B8C1FF` | 10.39:1   | 0.208                             |
| `cartwheel` | `#F3B6AC` | 10.38:1   | 0.206                             |
| `black-eye` | `#DCBAE3` | 10.45:1   | 0.206                             |
| Locked      | `#8B8B8B` | 5.29:1    |                                   |

In Gameplay's route order (Sunflower, Whirlpool, Needle, Andromeda, Cartwheel,
Black Eye), neighbouring markers are 0.121, 0.082, 0.101, 0.133 and 0.079 apart
in Oklab. The closest pairs two apart are Needle and Sunflower (0.059),
Andromeda and Black Eye (0.060) and Needle and Cartwheel (0.060), which differ
by number and name too. Black Eye's smoke violet (hue 320, chroma 0.034) is as
blue as the marker floor allows: a bluer hue would bring its marker within
0.055 of Andromeda's. Needle's
silver is warm rather than neutral, because a neutral grey marker would read
as locked.

## Selector preview

The [galaxy selector](layout.md#galaxy-selector) panel shows one preview per
galaxy, `preview` in the data. Tech captures each one with `make previews`;
Art owns this spec. The captures show the current ship sprite, so recapture
them after a [ship model](ship.md) change.

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
- Placeholder: the galaxy's [placeholder preview](#placeholder-previews)
  until its galaxy is built and captured; locked, its locked file.

## Backdrop haze

A galaxy may add a backdrop haze: soft field-coloured shapes fixed to the
screen, like a distant sky. Rebuild with `node art/tools/haze.ts`. A galaxy
with a haze links `backdropHaze` from its manifest to its `haze.json`; a
galaxy without the link draws none. Andromeda's is two spiral arms round a
pale core ([Andromeda](andromeda.md)).

`haze.json`, version 1:

| Key        | Value           | Rule                                                                                                                                                                                    |
| ---------- | --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `asset`    | `{galaxy}-haze` | The texture's manifest entry: a PNG at half resolution (`width`, `height` in texels) with `displayWidth` and `displayHeight` in logical px, 960 by 480 for Andromeda                    |
| `layer`    | `backdrop`      | The fixed part of [L2](backdrop.md#layers): over the sky gradient, under the far items, planets and plates, the stars, the debris, current streaks and every play object                |
| `anchor`   | `view`          | The texture's centre on the play view's centre at its display size, fixed to the screen: it never scrolls, turns or scales with the camera. The 720 by 360 view sits inside its margins |
| `parallax` | 0               | No movement with the camera; the [backdrop layers](backdrop.md) in front of it carry motion                                                                                             |
| `filter`   | `linear`        | Draw the texture with linear filtering at its display size; every edge is blurred, so the half-resolution texels never show                                                             |

- Straight alpha over the field: each texel's colour is the field colours the
  generator painted, blurred with a Gaussian of sigma 20 logical px.
- Andromeda's arms are logarithmic spirals `r = 36 e^(0.42 t)` for `t` from 0
  to 4.2 radians, squashed to 0.55 vertically, two arms half a turn apart: an
  `environment` stroke 92 px wide at alpha 0.9 and an `environmentDetail`
  stroke 28 px wide at alpha 0.55, a quarter radian ahead. The core is two
  ellipses at (660, 186) of the texture, which lands at (540, 126) of the play
  view: `#6E76AE` 92 by 52 px at alpha 0.55 and `#A3ABE6` 40 by 22 px at alpha
  0.45.
- Over the field the arms stay at or below 1.22:1 and the core peaks at 3.07:1
  (`#686FA0`); 4% of the view is above 1.8:1. The core is Andromeda's
  brightest backdrop tone, the one above the rocks' 1.8:1: a single soft glow,
  below every signal's 5:1. The [backdrop caps](backdrop.md#contrast-caps)
  hold every other layer at or under it, and Andromeda's plates only darken,
  so nothing brightens it.
- The same in every state: no blink, so reduced motion changes nothing. The
  [selector preview](#selector-preview) capture includes it.

## Backdrop layers

Every galaxy draws the shared [backdrop layers](backdrop.md) (sky, phenomena,
plates, stars and debris) in its own field tones, from its `backdrop.json`.
Each gets its own character within the system:

| Galaxy    | Plates (L1)                                                                                            | Phenomena (L2)                                                                | Stars and streaks                              |
| --------- | ------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------- | ---------------------------------------------- |
| Sunflower | Diamond plots along the isometric axes, like farm fields from above, stepping darker, with cream plots | A pale day moon and a small ringed planet; no far items                       | Faint cream points; streaks in `backdropSide`  |
| Cartwheel | Triangles in five-spoke pinwheels round far hubs, rust and peach                                       | Crescent and ringed planets; a star cluster                                   | Marker-pink stars; streaks rising to the right |
| Whirlpool | Triangles toned in flowing wave bands                                                                  | A ringed planet and a crescent; blue-violet nebula banks                      | Marker-teal stars                              |
| Andromeda | Shadow plates only, so the haze stays the light                                                        | The [spiral haze](#backdrop-haze), fixed; a lavender crescent; a star cluster | Marker-blue stars                              |
| Needle    | Long slivers parallel to the band at -6 degrees                                                        | The [edge-on band](needle.md#space-look), fixed; a graphite crescent          | Marker-silver stars; streaks along the band    |
| Black Eye | Smoke: triangles toned by drifting bands under a noise warp, lighter wisps over shadow                 | One dim crescent; violet smoke-bank nebulae                                   | Marker-violet stars; streaks rising gently     |

On Sunflower the backdrop takes no keyline: the [light-field rule](#light-fields)
keylines play objects only, and the plates step darker within the caps, so the
ink keyline keeps 8.8:1 or more over every plate.

## Placeholder previews

Needle and Andromeda have no space art yet, so `galaxies.ts` draws their
previews as placeholders until their galaxies are built and captured:
`public/art/previews/galaxy-{id}.png` and `galaxy-{id}-locked.png`, 180x90,
opaque. The core manifest lists them as `galaxy-preview-{id}` and
`galaxy-preview-{id}-locked`, each with `placeholder: true`.

- Field tones only: the galaxy's `background`, `environment` and
  `environmentDetail`, no signals, ship or HUD.
- A motif centred on the first-destination point (60, 45): Needle a thin
  edge-on line of stars at -12 degrees with a small central bulge, Andromeda a
  two-armed spiral tilted 18 degrees.
- Marked as a placeholder by a dashed 1 px `environmentDetail` frame 2 in from
  the edge and a hatched lower-right corner.
- The locked file draws the same placeholder on the base field and applies
  the locked rule above.

A capture replaces a placeholder once its galaxy is built; the placeholder's
files and manifest entries go with it.

## Space palette

`space-palette.json` keeps the base field (`#292734`, `#34333F`, `#403F4D`):
the tint origin, and the fallback until a galaxy is set. In play the field
comes from the current galaxy, so Sunflower, galaxy 1, replaces the base
`#292734` background with `#D8C994`.
