# Station redesign

Production plan for the stations, outposts, project solids and hostile
stations: each structure is one model of connected solids, drawn with
depth-resolved occlusion in flat tones. Stages 1 and 2 (the model solids, the stations, the
outposts and the project solids) are built; stage 3 is planned.

## Rules

- Connected 3D solids with correct occlusion. Large simple shapes, three to
  five functional features per structure, ordered and symmetric.
- Flat tones and one light from the upper left: tops lightest, walls facing
  screen left mid, walls facing right darkest. A wall facing straight down the
  screen takes the mid tone. Domes split in two tones on the terminator.
- No repeated parallel stripes, ribs or panel rows. One band at most per body.
- Nothing thin sticks out. Caps, booms, keels and needle ends are thick
  tapered forms with blunt ends.
- No flat plates. Petals carry an inner pad, saucers step up and down from the
  rim deck and arm slabs carry a ridge.
- Three to five base hues per galaxy. No insignia.
- No structure is recognisable as a specific film or television station.

## Families

| Galaxy    | Form                                                          | Palette                                                |
| --------- | ------------------------------------------------------------- | ------------------------------------------------------ |
| Sunflower | Petal slabs round a seed disc on a stalk                      | Gold `#f2a51f`, seed `#6a4630`, lamp cream `#fff4d6`   |
| Cartwheel | A six-spoke wheel under a three-spoke wheel on a tapered axle | Bone `#f3ece1`, slate `#465066`, cap red `#c22b40`     |
| Whirlpool | Two ramps wind out of a core drum's wall                      | Ivory `#f6f1e4`, teal `#2a6676`, lamp coral `#ff6f4e`  |
| Needle    | A round needle through its eye                                | Indigo `#3a3f63`, bone `#f3ecdd`, thread red `#d7263d` |
| Andromeda | Saucer: rim deck, stepped tiers, bulge, turret and keel       | Cream `#f4ead3`, indigo `#34376f`, lamp gold `#ffc43d` |
| Phantom   | Thick tri-arm slabs echoed down a spindle                     | Pale `#f0e9f8`, violet `#a292c8`, lamp mint `#62f0c4`  |

## Pipeline

Every structure follows the same steps from model to shipped files.

1. Model. [station-models.ts](tools/station-models.ts) builds each structure
   from the mesh solids in [solid.ts](tools/solid.ts): extruded plans, tubes
   (drums, frustums and cones), rings (`meshRing`, whole or open over an arc),
   domes (`meshDome`) and winding ramps (`meshSpiral`). Mesh space is the fixed
   view's: +x and +y run down the screen to the right and left, +z is up.
   Units are display px at game scale. A lamp tone takes a `lit` flag, so the
   lit and dim frames share one geometry.
2. Place. The producer divides the model by the structure's display scale
   (`0.4375 * 1.5` for stations, `0.4375 * 1.25` for the Cartwheel hub) and
   puts the model's axis at its world-plane height on the pivot.
3. Draw. [visible.ts](tools/visible.ts) culls faces turned from the viewer and
   cuts every face by each nearer face with exact planar depth. A face's tone
   is a function of its normal. A dome facet is cut on the light's terminator
   plane, and each side keeps its tone.
4. Write. `tonePaths` merges the visible fragments into one outline per tone,
   largest first, each also covering every later tone; the first path is the
   silhouette, holes included. The producer fails when the lit and dim
   silhouettes differ or the silhouette is more than 1.5 display px from its
   reference size. Frames pass through `svgText` at one decimal.
5. Frame. The frame is the silhouette of both states plus 4 frame px, widened
   to keep the pivot on the vertical centre line, in multiples of 8 frame px.
6. Sheet. A structure's frames are nested roots of one sheet, side by side.
   A root is drawn once per lit state; a row that repeats a state names that
   root in `svgSheetMember`. A row that carries `intrinsicWidth` has its root
   at display size.
7. Rows. Each staged row is the shipped row of the same id with `path`,
   `width`, `height`, `displayWidth`, `displayHeight`, `pivot`, `berths` and
   the intrinsic size replaced.

Curves are faceted: 48 to 72 sides on drums and 64 on rings. The largest
departure from a true arc is 0.15 frame px, on the hub's large rim.

## Output

`node art/tools/stations.ts` writes these sheets and
[station-rows.json](station-rows.json). Reruns are byte-identical. Ids ending
in a pair are the `-a` and `-b` blink frames.

| Structure                                | Ids                                                      | Sheet                                       | Frame px | Display           | Pivot y | Drawn                    |
| ---------------------------------------- | -------------------------------------------------------- | ------------------------------------------- | -------- | ----------------- | ------- | ------------------------ |
| Sunflower station                        | `station`                                                | `/art/station-bloom-sheet.svg`              | 272, 256 | 178.5 by 168      | 0.3125  | 172 by 161               |
| Sunflower second station                 | `station-leaf`                                           | `/art/sunflower/leaf-station-sheet.svg`     | 264, 168 | 173.25 by 110.25  | 0.50595 | 165 by 101               |
| Growers, and with the ring               | `outpost-growers`, `outpost-growers-ring`                | `/art/sunflower/growers-bud-sheet.svg`      | 192, 144 | 176.4 by 132.3    | 0.42361 | 146 by 110, 169 by 123   |
| Workshop                                 | `outpost-workshop`                                       | `/art/sunflower/workshop-bloom-sheet.svg`   | 200, 144 | 183.75 by 132.3   | 0.41667 | 151 by 122               |
| Workshop crane                           | `outpost-workshop-crane`                                 | `/art/sunflower/workshop-boom-sheet.svg`    | 128, 64  | 117.6 by 58.8     | 0.64063 | 65 by 49                 |
| Salvagers' yard                          | `outpost-salvagers`                                      | `/art/sunflower/salvagers-leaf-sheet.svg`   | 176, 120 | 161.7 by 110.25   | 0.48333 | 153 by 102               |
| Mining hub, worn, repaired and bay       | `outpost-hub`, `outpost-hub-repaired`, `outpost-hub-bay` | `/art/cartwheel/wheel-hub-sheet.svg`        | 320, 320 | 175 by 175        | 0.525   | 168 by 142; bay 32 by 35 |
| Whirlpool station                        | `whirlpool-station-0` to `-3`                            | `/art/whirlpool/ramp-station-sheet.svg`     | 328, 224 | 215.25 by 147     | 0.42411 | 205 by 138               |
| Weavers' station, and with the Loom hall | `needle-station`, `needle-station-hall`                  | `/art/needle/eye-station-sheet.svg`         | 528, 120 | 346.5 by 78.75    | 0.5     | 316 by 73, 341 by 60     |
| Settlers' station                        | `station-settlers`                                       | `/art/andromeda/saucer-station-sheet.svg`   | 312, 232 | 204.75 by 152.25  | 0.42241 | 197 by 145               |
| Courier school                           | `station-settlers-school`                                | `/art/andromeda/saucer-school-sheet.svg`    | 104, 64  | 68.25 by 42       | 0.46875 | 49 by 33                 |
| Hamlet                                   | `outpost-hamlet`                                         | `/art/andromeda/hamlet-saucer-sheet.svg`    | 96, 88   | 91.35 by 83.738   | 0.36364 | 80 by 75                 |
| Lamphouse                                | `outpost-lamphouse`                                      | `/art/andromeda/lamphouse-saucer-sheet.svg` | 72, 96   | 68.513 by 91.35   | 0.45833 | 60 by 76                 |
| Phantom station                          | `phantom-station-0` to `-7`                              | `/art/phantom/triarm-station-sheet.svg`     | 312, 272 | 204.75 by 178.5   | 0.38603 | 196 by 169               |
| Homes, cracked and mended                | `outpost-homes-cracked`, `outpost-homes-mended`          | `/art/phantom/homes-triarm-sheet.svg`       | 128, 80  | 121.8 by 76.125   | 0.4625  | 113 by 55, 113 by 67     |
| Harbour, cracked and mended              | `outpost-harbour-cracked`, `outpost-harbour-mended`      | `/art/phantom/harbour-triarm-sheet.svg`     | 152, 72  | 144.638 by 68.513 | 0.38889 | 136 by 59                |
| Signal, cracked and mended               | `outpost-signal-cracked`, `outpost-signal-mended`        | `/art/phantom/signal-triarm-sheet.svg`      | 96, 136  | 91.35 by 129.413  | 0.39706 | 82 by 119                |

Display scales follow the shipped rows: `0.4375 * 1.5` for stations and the
courier school, times 1.4 for Sunflower's outposts and 1.45 for the Andromeda
and Phantom settlements, and `0.4375 * 1.25` for the hub. Pivot x is 0.5.

### States

- Frame A or the first half of a loop is lit; frame B or the second half swaps
  every lamp tone for a dull dark tone. `frameMs` and `frameIndex` keep their
  shipped values: the Whirlpool loop is 0 and 1 lit, 2 and 3 dim, and Phantom's
  is 0 to 3 lit, 4 to 7 dim.
- The states of one structure share a frame and pivot, so a state change swaps
  in place: the growers and their ring, the hub worn and repaired, the
  Weavers' station and its Loom hall, and each settlement cracked and mended.
- Hub worn: the large wheel's rim is open from 40 to 110 degrees, with the
  spoke at 90 missing.
- Cracked: the arm of the top slab that points down the screen ends at 0.52 of
  its length and every lamp is dim, so `-cracked-a` and `-cracked-b` share one
  root. Mended: the arm is whole with one lamp collar over the old break.
- `greenhouseRing` and `loomHall` replace their structure's frames.

### Pivots, docks and berths

- Pivots lie on the world plane on the model's vertical axis: the seed disc
  and peg at mid height, the hub's large wheel at mid height, the core drum at
  the ramps' foot, the needle's axis, a saucer's rim deck, the spindle midway
  between the Phantom station's slabs, and the homes' slab base.
- An outpost's `dock` is on the world plane straight down the screen from the
  pivot, on the body's wall: the seed disc or peg collar, a saucer's rim, the
  harbour's hull between its arms, and for the homes and the signal the end of
  the arm that cracks, at its cracked length. `outward` is `[0, 1]` and the
  width is the shipped row's.
- Hub `berths`, left then right, are the large wheel's rim wall at its screen
  left and right, clear of the worn opening: frame px `(6.592, 168)` outward
  `[-1, 0]` and `(313.408, 168)` outward `[1, 0]`, width 28.169, each 83.895
  display px to the side of the pivot.
- The docking bay's berth is the berth drum's wall straight down the screen:
  `(160, 303.765)` outward `[0, 1]`, width 36.742, 74.246 display px below the
  pivot.
- Weavers' station `berths` are the needle's blunt ends: `(23.25, 60)` and
  `(504.75, 60)`, outward `[-1, 0]` and `[1, 0]`, width 24.495, each 157.992
  display px from the pivot. With the Loom hall they are `(4.587, 60)` and
  `(523.413, 60)`, 170.239 display px out.
- The courier school's berth is its saucer's wall straight down the screen:
  `(52, 47.24)` outward `[0, 1]`, width 19.596.
- The Sunflower, Whirlpool, settlers' and Phantom stations carry no `dock` or
  `berths`, as shipped.

### Overlays

`workshopCrane`, `dockingBay` and `courierSchool` are overlay frames. Each is
drawn with its whole structure and keeps only the part of the project's solid
that the structure leaves visible, so it draws in front of its base with
correct occlusion.

- The docking bay's frames share the hub's frame and pivot, as shipped.
- The crane and the school have their own frames, with the pivot on the lifting
  drum's or the school saucer's axis. `station-rows.json` `projects` holds
  their `projects.json` entries with the new anchors, in the base's frame px
  from its pivot: `workshopCrane` `(79.179, 45.714)` and `courierSchool`
  `(-194.093, 0)`, both `layer` `front`.

`node art/tools/station-contact-sheet.ts <dir>` writes a review sheet of each
state's frames at 1x and 2x on its field with the destination keyline, an
overlay on its whole structure and alone; a third argument `marks` adds each
pivot, berth and dock.

The producer leaves the manifests and `projects.json` alone, so the shipped
rows and sheets are unchanged and nothing reads the new files until the switch.

## Replaced producers

| Shipped producer                         | Replaced by                                                    | Stage |
| ---------------------------------------- | -------------------------------------------------------------- | ----: |
| `station.ts`                             | `flower` in the station producer, and `leafFlower`             |  1, 2 |
| `whirlpool-station.ts`                   | `whirl`                                                        |     1 |
| `needle-station.ts`                      | `needle`, with the Loom hall as its two-eye form               |  1, 2 |
| `andromeda.ts`, station and settlements  | `saucer`: settlers' station, hamlet, lamphouse, courier school |  1, 2 |
| `phantom-station.ts`, `phantom.ts`       | `twin`: station, homes, harbour and signal, cracked and mended |  1, 2 |
| `cartwheel.ts`, hub                      | `wheels`: hub worn and repaired, docking bay                   |  1, 2 |
| `outposts.ts`, outposts and their frames | `flower` and the leaf form: growers, workshop, salvagers       |     2 |
| `hostile-station-export.ts` and its kin  | Three family models at 16 headings, and the Claim platform     |     3 |

`primary-station-sheets.ts`, `station-model.ts` and `station-sidecars.ts`
retire with the producers that use them. The Needle ring gate
(`needle-gates.ts`), beacons, buoys and lamps belong to the friendly objects
set. The other entries of `andromeda.ts`, `cartwheel.ts`, `outposts.ts` and
`phantom.ts` stay with their producers.

## Switch

Tech replaces, from `station-rows.json`, the rows of the same ids in the
`core`, `sunflower`, `cartwheel`, `whirlpool`, `needle`, `andromeda` and
`phantom` manifests, and the `workshopCrane` and `courierSchool` entries of
`projects.json` from its `projects`. A group switches in one landing with the
removal of the sheet it replaces, so no unreferenced file ships.
`station-leaf-a` and `-b` are new rows and wait for the second station's
placement.

Runtime values that follow the shipped frames:

- `src/data/storyShips.ts`: `HUB_BERTHS` and `DOCKS` hold the hub's berths and
  the bay's in the shipped 240 px reference frame. The new points are the
  staged rows' `berths`. On screen from the pivot, at the hub's display scale,
  they are `(-83.895, 0)`, `(83.895, 0)` and the bay's `(0, 74.246)` display
  px, with outward directions `[-1, 0]`, `[1, 0]` and `[0, 1]`.
- [Destinations](destinations.md#collision-silhouette-dock-and-clearance) and
  [Needle](needle.md) list the Weavers' station berths as world offsets; both
  berths move to the needle's ends, and with the Loom hall both move again.
- `svgSheetMember` on the repeated loop rows of the Whirlpool and Phantom
  stations and on the `-cracked-b` rows must reach the sheet loader.
- The courier school's anchor changes `layer` from `behind` to `front`.

Tests that assert the replaced art and need Tech's changes at the switch:

- `src/game/stationArt.test.ts`: station frame sizes, pivots, docks and loops.
- `src/game/familyManifest.test.ts`: station, hub and settlement sheet paths
  per family.
- `src/game/cartwheelArt.test.ts` and `src/model/storyShips.test.ts`: the
  hub's frames, berths and docked spots.
- `src/game/projectArt.test.ts`: overlay frames and anchors.
- `src/ui/station.test.ts` and `src/game/drawOrder.test.ts`: station ids and
  display sizes where they assert them.
- `src/pwa/precacheArt.test.ts`: the sheet paths.

Art then moves the structures into the shipped file stems, removes
`station-rows.json` and the replaced producers and sheets, and rewrites
[station](station.md), [outposts](outposts.md), [Cartwheel](cartwheel.md),
[Whirlpool](whirlpool.md#station), [Needle](needle.md#weavers-station),
[Andromeda](andromeda.md), [Phantom](phantom.md), the project world changes
in [projects](projects.md) and the Use callout tops in
[destinations](destinations.md).

## Stages

1. Model solids and the six main stations. Built.
2. Outposts, the second Sunflower station, states and project solids. Built.
3. Hostile stations: the Garnet, Claim and coral stations and the Claim
   platform at 16 headings, with eight mount bases, capped states and one
   hardpoints file per family. Weapon tops (`pod`, `dome`, `gun`) come from
   the [enemy fleet producer](enemy-redesign.md). A dome is cut on the light
   turned into mesh space at each heading (`meshDome`'s `light`).

## Open points

- The Andromeda saucers read mostly by their keyline: cream on the periwinkle
  field is 2.38:1, and only the indigo keel, turret and band reach 3:1.
- The hub's silhouette is 142 display px high against the shipped 175.
- Hostile stations need per-family geometry (hardpoints, collision and hit
  areas) where `src/data/hostileStations.ts` keys one geometry per route
  position.
- The second Sunflower station needs a manifest id, a placement and a Map
  entry from Tech, and Gameplay's decision on whether it is a destination,
  where it sits, and its name and services. Its rows are staged as
  `station-leaf-a` and `-b`, without `station` or `destination`, which would
  make them Sunflower's own station art.
- The leaf petals of the second station and the salvagers' yard are slabs 6
  display px thick with their walls drawn, so the second station is 101
  display px high against the reference sheet's 95.
- The docking bay attaches at 45 degrees, inside the worn rim's opening (40 to
  110 degrees). Its frames are cut against the repaired hub; over the worn hub
  the arm meets the opening's edge. Gameplay's funding order decides whether
  the bay can show before the repairs.
- The hub's berths move from the lower left and right of the hull to the
  rim's screen left and right, which the worn opening leaves whole.
- The Weavers' station's right berth no longer moves alone when the Loom hall
  is funded: the hall is a longer needle, so both ends move outward.
- Display scales follow the shipped rows, so the hub, the outposts and the
  settlements each keep a factor of their own. One destination scale for every
  structure would change only the frame px values.
- `tidy` in `visible.ts` drops a corner that lies between two points rounding
  onto each other. `tonePaths` removes such points first; the enemy fleet
  producer's own copy of the tone path step does not.
