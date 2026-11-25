# Friendly object redesign

Production plan for the friendly objects and points of interest: the pickups
and caches, the galaxy beacons, buoys and lamps, the job landmarks, the Needle
ring gate, the 32 friendly craft and the whales. Each is one model of connected
solids drawn with depth-resolved occlusion. Stages 1 and 2 are built; the other
stages are planned. Stations, outposts, enemy ships and Ada's ship are outside this
plan.

## Rules

- Connected 3D solids with correct occlusion, at medium detail: three to five
  functional features on craft and beacons, one or two solids and one accent
  on pickups.
- Flat tones and one light from the upper left: tops lightest, walls facing
  screen left mid, walls facing right darkest. No gradients or texture.
- No repeated parallel stripes, no thin spars or rods, nothing thin ahead of a
  hull, no flat-plate forms.
- Nothing is recognisable as a specific film or television design, and nothing
  carries an insignia.
- Friendly craft carry Ada's canopy blue `#2585d0` and jet blue `#86deff`. None
  has wings, fins, blades or a red hull or lamp.
- Galaxy beacons, buoys and gates are the smallest members of their galaxy's
  station family and take its palette.
- The shipped frames carry no keyline. The game draws the 1 px ink keyline on
  light fields and Phantom's white edge.

## Pipeline

1. Model. [friendly-models.ts](tools/friendly-models.ts) builds each object
   from the mesh solids in [solid.ts](tools/solid.ts). Fixed objects are
   authored in view space (the projection's x, y and up z) in model units. An
   object lists its frames, the display box its first frame fits, and the
   fields its manifest rows keep.
2. Scale. The producer scales the model so the first frame's drawn extents fit
   the object's display box, keeping proportion. Frame px are display px
   divided by 0.4375, as for Ada and the enemy fleet.
3. Frame. Every frame of an object shares one frame, sized in multiples of 8
   with a 1 px margin. A `ground` object puts its model origin (the centre of
   its float or hub) at the pivot, with the frame symmetric across it. A
   `centre` object centres its drawn extents, with the pivot at `(0.5, 0.5)`.
4. Draw. [visible.ts](tools/visible.ts) culls faces turned from the viewer and
   cuts every face by each nearer face with exact planar depth. A dome is split
   on the light terminator, so its two tones meet on a true curve.
5. Write. The visible fragments merge into one outline per tone, largest tone
   first, each path also covering every later tone. Frames pass through
   `svgText` at one decimal and pack into sheets of nested roots, one sheet per
   manifest and group, each root carrying its manifest id.
6. Collision. The objects Ada collects are traced into strictly convex parts
   with the shared checker's thresholds and ship in
   [pickups.json](../public/art/pickups/pickups.json).
7. Stage. [friendly-rows.json](friendly-rows.json) holds, per manifest, the
   rows that switch to the new files. The producer leaves the manifests alone.

`node art/tools/friendly.ts` writes the files and rows; reruns are
byte-identical. `node art/tools/friendly-contact-sheet.ts <dir> [scale ...]`
writes a review sheet of every frame on its galaxy's field with the keyline.

The model layer gained these solids for the friendly objects: `meshRing` (a
ring on the vertical axis), `meshHoop` (a ring about any axis, whole or the
half on one side of a plane, with end caps), `meshDome`, `meshSpiral`,
`meshBlock` and `meshBar` (oriented boxes), `meshPlace` (turn, scale and move)
and `meshCapped` (a convex solid cut by a plane and closed).

## Groups and the producers they replace

| Group                                            | Stage | Replaces                                                                                                                                                                              |
| ------------------------------------------------ | ----: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Stardust                                         |     1 | `stardust.ts`: `stardust.png` and `stardust.json`                                                                                                                                     |
| Ore                                              |     1 | `cartwheel-props.ts`: `cartwheel/ore-nugget.png` and `ore-nugget.json`                                                                                                                |
| Ammo pack                                        |     1 | `ammo-pack.ts`: `pickups/ammo-pack.png` and `ammo-pack.json`                                                                                                                          |
| Upgrade pickup                                   |     1 | `upgrade-pickup.ts`: `pickups/upgrade-chevron.svg`                                                                                                                                    |
| Lost item glint                                  |     1 | `job-art.ts`: `hunt-glint.png` and `hunt-glint.json`                                                                                                                                  |
| Holodisk and waypoint beacon                     |     1 | `holodisk.ts`: `holodisk.png` and `holodisk-beacon.png`                                                                                                                               |
| Discovery cache                                  |     1 | `discovery-cache.ts`: `discovery-cache.png` and `discovery-cache.json`                                                                                                                |
| Survey beacon and wreck                          |     1 | `job-art.ts`: `landmarks/beacon-sheet.svg` and `landmarks/wreck.svg`                                                                                                                  |
| Salvage beacon                                   |     1 | `outposts.ts`: the two beacon roots of `outposts/outposts-sheet.svg`                                                                                                                  |
| Mooring buoy                                     |     1 | `cartwheel.ts`: `cartwheel/mooring-buoy-sheet.svg`                                                                                                                                    |
| Current-map buoy, Nursery beacon, Quiet crossing |     1 | `whirlpool-projects.ts`: the buoy and crossing sheets and the two nursery beacon files                                                                                                |
| Guide, spare beacon, Route exchange              |     1 | `andromeda.ts`: `andromeda/beacon-*.svg` and `route-exchange-sheet.svg`                                                                                                               |
| Channel lamp and Practice berth                  |     1 | `needle-projects.ts`: the lamp and berth roots of `needle/projects-sheet.svg`                                                                                                         |
| Ring gate                                        |     2 | `needle-gates.ts`: `needle/gates-sheet.svg` and `gates.json`                                                                                                                          |
| Friendly craft                                   |     3 | `crafts.ts` and `story-hull-sheet.ts` (story craft), `cartwheel.ts`, `andromeda.ts` and `needle-craft.ts` (their galaxies' craft), `stranded.ts` and `stranded-craft.ts`, `allies.ts` |
| Whales                                           |     4 | `whales.ts`, `whale-sheets.ts` and the whale frames of `allies.ts`                                                                                                                    |

The nebula landmark, the search area, the tow line, map marks, job row icons
and Projects tab icons are unchanged.

## Stage 1 output

| Object                   | Row ids                                                                       |     Frame | Drawn, display px | Pivot   |
| ------------------------ | ----------------------------------------------------------------------------- | --------: | ----------------: | ------- |
| Stardust                 | `stardust`                                                                    |   32 x 40 |           13 x 14 | centre  |
| Ore                      | `ore-nugget`                                                                  |   40 x 40 |           13 x 14 | centre  |
| Ammo pack                | `ammo-pack`                                                                   |   40 x 40 |           16 x 15 | centre  |
| Upgrade pickup           | `upgrade-chevron`                                                             |   40 x 40 |           14 x 16 | centre  |
| Lost item glint          | `hunt-glint`                                                                  |   24 x 40 |            9 x 15 | centre  |
| Holodisk                 | `holodisk`                                                                    |   40 x 40 |           16 x 16 | centre  |
| Holodisk waypoint beacon | `holodisk-beacon-a`, `-b`                                                     |   72 x 64 |           28 x 24 | centre  |
| Discovery cache          | `discovery-cache-lit-a`, `-lit-b`, `-hidden`                                  |   64 x 80 |           24 x 31 | centre  |
| Survey beacon            | `landmark-beacon-a`, `-b`                                                     | 216 x 160 |           93 x 68 | centre  |
| Wreck                    | `landmark-wreck`                                                              | 440 x 240 |         189 x 103 | centre  |
| Salvage beacon           | `outpost-salvagers-beacon-a`, `-b`                                            |   48 x 80 |           18 x 33 | 0.2125  |
| Mooring buoy             | `mooring-buoy-a`, `-b`                                                        |  112 x 80 |           42 x 31 | 0.5875  |
| Current-map buoy         | `whirlpool-current-buoy-a`, `-b`                                              |   96 x 80 |           32 x 32 | 0.3625  |
| Nursery beacon           | `whirlpool-nursery-beacon-a`, `-b`                                            | 120 x 168 |           49 x 71 | 0.506   |
| Quiet crossing marker    | `whirlpool-quiet-crossing-a`, `-b`                                            |  152 x 64 |           64 x 26 | 0.53125 |
| Guide beacon             | `beacon-guide-lit-a`, `-lit-b`, `-relit-a`, `-relit-b`, `beacon-guide-dented` | 104 x 152 |           44 x 63 | 0.7105  |
| Spare beacon             | `beacon-guide-spare-a`, `-b`                                                  |  96 x 112 |           40 x 44 | 0.6429  |
| Route exchange           | `andromeda-route-exchange-a`, `-b`                                            |   80 x 64 |           34 x 24 | 0.53125 |
| Channel lamp             | `needle-lamp-a`, `-b`                                                         |   56 x 72 |           21 x 27 | 0.4583  |
| Practice berth           | `needle-practice-berth-a`, `-b`                                               |   88 x 56 |           35 x 21 | 0.5179  |

The pivot column is the row's `pivot.y`; `pivot.x` is 0.5 for every row.

- `/art/pickups/pickups-sheet.svg`: the pickups, the holodisk waypoint beacon
  and the discovery cache.
- `/art/pickups/pickups.json`: per frame id, the frame size, pivot, drawn
  extents and convex collision parts in frame px, for the pickups and the
  cache. The staged core rows name it as the `pickups` data link.
- `/art/landmarks/landmarks-sheet.svg`: the survey beacon and the wreck.
- `/art/{galaxy}/beacons-sheet.svg` for Sunflower, Cartwheel, Whirlpool,
  Andromeda and Needle: that galaxy's beacons, buoys and lamps.

States:

- Frame A is lit and frame B dims the lamp. The guide beacon's relit pair
  carries a cream repair collar in place of the navy band, and its dented frame
  has a dark lamp house knocked off the tower's axis.
- The discovery cache's band is `#f0ddf8` lit A, `#c4afcc` lit B and ink while
  hidden.
- The mooring buoy rows carry `moorings`: the top centre of each arm's cleat in
  frame px and the unit screen direction the arm points.

## Stage 2 output: ring gate

The gate is one slim eye ring on edge with a navy band round its rim and, at
each side, a blunt needle collar carrying one lamp band. It is true to
Gameplay's gate: `opening` 66 and `rim` inner 33, outer 40 and depth 7 world
units, unchanged.

| Rim                                             | World units | Model units |
| ----------------------------------------------- | ----------: | ----------: |
| Inner radius                                    |          33 |        38.1 |
| Outer radius                                    |          40 |        46.2 |
| Depth along the axis                            |           7 |         8.1 |
| Collar reach from the centre, without collision |        43.6 |        50.4 |

- `/art/needle/ring-gates-sheet.svg`: 20 frames, ids
  `needle-gate-{state}-{o}-{layer}` as shipped: `state` `dark` or `lit`,
  orientation `o` 0 to 4, `layer` `back` or `front`. Frame 288 (display 126),
  pivot `(0.5, 0.5)` at the ring's centre.
- `/art/needle/ring-gates.json`: the gate data in the shape of the shipped
  `gates.json`, staged as Needle's `needleGates` link.
- Orientation `o` puts the gate's axis at `o * 22.5` degrees on the world
  plane. Drawn extents in display px: 97 x 107 at 0 and 4, 119 x 101 at 1 and
  3, 123 x 98 at 2. The opening is 93 px wide and 76 px high at 2.
- The lamp bands are `#d7263d` lit and `#4a4358` dark. Nothing else differs
  between the states; there is no veil and no guide field.
- Layers: the front layer is the half of the gate on the viewer's side of the
  plane through its centre whose normal is the view direction projected onto
  the ring's plane; the back layer is the other half. Each layer is a closed
  solid: the ring and the collars the plane crosses are capped over the cut.
  Draw the back layer, the ship, then the front layer. Where the game keylines
  each layer on its own, the front layer's keyline crosses the ring at the two
  cuts.

### World scale and the projection mismatch

The game draws a world offset `(x, y)` at `(x - y, (x + y) / 2)`. The art
projection draws a model point at `((x - y) * sqrt(3) / 2, (x + y) / 2 - z)`.
The gate's model is the world rim scaled by `2 / sqrt(3)` (1.1547 display px
per world unit), which makes its width across the screen exact: at axis 2 the
rim's outer diameter draws 113.1 px wide and the opening 93.3 px, as the game
draws 80 and 66 world units across the screen.

The same scale draws every ground offset 15.47% farther down the screen than
the game does, and the two cannot both be exact in this projection:

- At axis 2 the ring's plane lies across the screen, so the rim and the
  opening match the game's exactly across it; only the 7 unit depth draws 15%
  deep.
- At the oblique axes the ring's ground line, from collar to collar, is drawn
  steeper than the game's rim: its ends sit 3.1 px lower and higher than the
  game's at axes 0 and 4, and 1.7 px at axes 1 and 3.
- `orientations[o].worldAxis` is the axis on the world plane, `gameAxis` its
  screen direction as the game draws it and `axis` its screen direction as the
  art draws it. Choose the orientation by `worldAxis` or `gameAxis`; `axis`
  differs from `gameAxis` by 3.4 degrees at axes 0 and 4 and 4 degrees at
  axes 1 and 3.
- A gate rendered through the game's own projection would remove the mismatch
  and would no longer share the projection of every other object.

`ring-gates.json` adds to the shipped fields: `collar`, `worldUnit` (display px
per world unit), `groundDepth` (how many times farther down the screen the art
draws a ground offset than the game), and per orientation `worldAxis`,
`gameAxis` and `extent` (the drawn width and height in display px). `colors` holds the rim's and band's three flat tones and the two
lamp colours in place of the shipped ramps and veil.

Tests that assert the shipped gate: `src/game/familyManifest.test.ts` (sheet
path and frame) and the readers of `src/data/needle.ts`, which imports
`gates.json` and reads `opening`, `rim` and the orientations.

## Switch

Tech replaces the shipped rows with the rows of the same ids from
`friendly-rows.json`, in the manifest each is staged under. Every row is an
`svgSheet` row whose `width` and `height` are frame px and whose display size
is the frame times 0.4375.

Rows that change shape:

- The pickups were Aseprite PNG strips drawn at native size with frame loops.
  Each is now one vector frame: the glint loops of Stardust, the lost item and
  the ammo pack, the holodisk's four-frame turn and their `frames` and `loop`
  fields have no art.
- `holodisk-beacon` becomes `holodisk-beacon-a` and `-b`, and
  `discovery-cache` becomes `discovery-cache-lit-a`, `-lit-b` and `-hidden`:
  one row per frame, in place of `frames` indices into a strip.
- `upgrade-chevron` is one frame of both chevron blocks. The shipped row drew
  one chevron twice from `chevrons` offsets and lit each in a `climb`; those
  fields have no art.
- `ore-nugget` draws 14 px for one unit; the five-unit chunk stays a scale of
  the same frame.
- The salvage beacon, the nursery beacon and the lamp and berth move to their
  galaxy's `beacons-sheet.svg`, so the outposts sheet, the two nursery files
  and Needle's projects sheet lose those roots.
- `landmark-beacon-*` drop `intrinsicWidth` and `intrinsicHeight`, and
  `landmark-wreck` becomes a sheet root.
- The channel lamp carries no light pool polygon.
- Every `ground` pivot is the model's float or hub centre, so placement offsets
  tuned to the shipped art need a look: the salvage beacon's bud is now at the
  pivot with its stalk below, and the current buoy and nursery beacon hang
  their keels below the pivot.

Code and tests that read the replaced files:

- `src/model/pickupBody.ts` imports the five Aseprite sidecars; it reads
  `pickups.json` instead, where `collision` is in frame px from the frame's
  top left and the display size is the frame times `displayScale`.
- `src/model/collisionData.test.ts`, `src/model/economy.test.ts` and
  `src/model/orePickups.test.ts`: frame counts and outlines of the sidecars.
- `src/game/worldArt.test.ts`: the ammo pack, holodisk beacon and cache rows.
- `src/game/upgradePickup.test.ts`: the chevron pair and its climb.
- `src/model/jobs.test.ts`, `src/game/jobArt.test.ts` and
  `src/game/landmarkScanCallout.test.ts`: the glint and landmark rows.
- `src/game/projectArt.test.ts`, `src/game/whirlpoolProjects.test.ts`,
  `src/game/sceneGuideLights.test.ts` and `src/game/sceneAndromeda.test.ts`:
  project and beacon frame sizes and paths.
- `src/game/cartwheelArt.test.ts`, `src/game/sceneObjects.test.ts`,
  `src/game/drawOrder.test.ts` and `src/model/storyShips.test.ts`: the mooring
  buoy's frame and `moorings`, and the ore nugget's size.
- `src/game/familyManifest.test.ts` and the precache tests: file lists.

After the switch Art moves each group into the producer that owns its
manifest group, removes the replaced producers, files and their documents'
sections, and deletes `friendly-rows.json`.

## Stages

1. Pickups, caches, landmarks and galaxy beacons, buoys and lamps. Built.
2. Ring gate, true to Gameplay's opening of 66 and rim of 33, 40 and 7 world
   units: five axes, lit and dark, back and front layers as closed solids, a
   288 px frame and the gate data file with the new extents. Built.
3. The 32 craft at 16 headings: the yard hull with one role feature each, Elder
   Loom's saucer, Reed's ring ship, the Blocker and the lifeboat pods with
   their galaxy features and blink frames, with jets and nose sidecars. Ids
   stay `craft-{name}-{k}`.
4. The whales (Marlo, adult, calf, young calf) at 16 headings with an 8-frame
   swim loop that bends the tail stock and fluke.
