# Station redesign

Production plan for the stations, outposts, project solids and hostile
stations: each structure is one model of connected solids, drawn with
depth-resolved occlusion in flat tones. Stage 1 (the model solids and the six
main civilian stations) is built; the other stages are planned.

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

## Stage 1 output

`node art/tools/stations.ts` writes these sheets and
[station-rows.json](station-rows.json). Reruns are byte-identical.

| Structure           | Ids                            | Sheet                                         | Frame px | Display          | Pivot            | Silhouette |
| ------------------- | ------------------------------ | --------------------------------------------- | -------- | ---------------- | ---------------- | ---------- |
| Sunflower station   | `station-a`, `-b`              | `/art/station-bloom-sheet.svg`                | 272, 256 | 178.5 by 168     | `(0.5, 0.3125)`  | 172 by 161 |
| Mining hub repaired | `outpost-hub-repaired-a`, `-b` | `/art/cartwheel/wheel-hub-repaired-sheet.svg` | 320, 272 | 175 by 148.75    | `(0.5, 0.61765)` | 168 by 142 |
| Whirlpool station   | `whirlpool-station-0` to `-3`  | `/art/whirlpool/ramp-station-sheet.svg`       | 328, 224 | 215.25 by 147    | `(0.5, 0.42411)` | 205 by 138 |
| Weavers' station    | `needle-station-a`, `-b`       | `/art/needle/eye-station-sheet.svg`           | 496, 120 | 325.5 by 78.75   | `(0.5, 0.5)`     | 316 by 73  |
| Settlers' station   | `station-settlers-a`, `-b`     | `/art/andromeda/saucer-station-sheet.svg`     | 312, 232 | 204.75 by 152.25 | `(0.5, 0.42241)` | 197 by 145 |
| Phantom station     | `phantom-station-0` to `-7`    | `/art/phantom/triarm-station-sheet.svg`       | 312, 272 | 204.75 by 178.5  | `(0.5, 0.38603)` | 196 by 169 |

- Frame A or the first half of a loop is lit; frame B or the second half swaps
  every lamp tone for a dull dark tone. `frameMs` and `frameIndex` keep their
  shipped values: the Whirlpool loop is 0 and 1 lit, 2 and 3 dim, and Phantom's
  is 0 to 3 lit, 4 to 7 dim.
- Pivots lie on the world plane on the model's vertical axis: the seed disc's
  mid height, the hub's large wheel at mid height, the core drum at the ramps'
  foot, the needle's axis, the saucer's rim deck and the spindle midway
  between the two slabs.
- Hub `berths`, left then right, lie on the large wheel's rim wall where it
  meets the world axes: frame px `(51.524, 230.629)` outward `[-0.866, 0.5]`
  and `(268.476, 230.629)` outward `[0.866, 0.5]`, width 28.169. From the pivot
  they are 68.5 display px along world +y and +x.
- Weavers' station `berths` are the needle's two blunt ends: frame px
  `(7.25, 60)` outward `[-1, 0]` and `(488.75, 60)` outward `[1, 0]`, width
  24.495, each 129 display px from the pivot along the needle.
- The Sunflower, Whirlpool, settlers' and Phantom stations carry no `dock` or
  `berths`, as shipped.

`node art/tools/station-contact-sheet.ts <dir>` writes a review sheet of each
structure's lit and dim frame at 1x and 2x on its field with the destination
keyline; a third argument `marks` adds each pivot and berth.

The producer leaves the manifests alone, so the shipped rows and sheets are
unchanged and nothing reads the new files until the switch.

## Replaced producers

| Shipped producer                         | Replaced by                                                    | Stage |
| ---------------------------------------- | -------------------------------------------------------------- | ----: |
| `station.ts`                             | `flower` in the station producer, and the second station       |  1, 2 |
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
`core`, `cartwheel`, `whirlpool`, `needle`, `andromeda` and `phantom`
manifests. A group switches in one landing with the removal of the sheet it
replaces, so no unreferenced file ships.

Runtime values that follow the shipped frames:

- `src/data/storyShips.ts`: `HUB_BERTHS` and `DOCKS` hold the hub's berth
  points in the shipped 240 px reference frame. The new points are in the
  staged rows' `berths`; from the pivot at the hub's display scale they are
  `(-59.322, 34.25)` and `(59.322, 34.25)` display px on screen.
- [Destinations](destinations.md#collision-silhouette-dock-and-clearance) and
  [Needle](needle.md) list the Weavers' station berths as world offsets; both
  berths move to the needle's ends, and with the Loom hall both move again.
- `svgSheetMember` on the repeated loop rows of the Whirlpool and Phantom
  stations must reach the sheet loader for station frames.

Tests that assert the replaced art and need Tech's changes at the switch:

- `src/game/stationArt.test.ts`: station frame sizes, pivots and loops.
- `src/game/familyManifest.test.ts`: station and hub sheet paths per family.
- `src/game/cartwheelArt.test.ts` and `src/model/storyShips.test.ts`: the
  hub's frames, berths and docked spots.
- `src/ui/station.test.ts` and `src/game/drawOrder.test.ts`: station ids and
  display sizes where they assert them.
- `src/pwa/precacheArt.test.ts`: the sheet paths.

Art then moves the structures into the shipped file stems, removes
`station-rows.json` and the replaced producers and sheets, and rewrites
[station](station.md), [outposts](outposts.md), [Cartwheel](cartwheel.md),
[Whirlpool](whirlpool.md#station), [Needle](needle.md#weavers-station),
[Andromeda](andromeda.md), [Phantom](phantom.md) and the Use callout tops in
[destinations](destinations.md).

## Stages

1. Model solids and the six main stations. Built.
2. Outposts and second stations with their states and project solids:
   Sunflower's second station (leaf petals), growers, workshop and salvagers;
   the hub worn (large rim open over a quarter); the Loom hall; hamlet and
   lamphouse; homes, harbour and signal, cracked and mended. Project frames:
   `greenhouseRing` and `loomHall` replace their structure's frames;
   `workshopCrane`, `dockingBay` and `courierSchool` are overlay frames with
   anchors for `projects.json` and their berths. Outposts carry a `dock` on
   the world plane straight down the screen from the pivot, as shipped.
3. Hostile stations: the Garnet, Claim and coral stations and the Claim
   platform at 16 headings, with eight mount bases, capped states and one
   hardpoints file per family. Weapon tops (`pod`, `dome`, `gun`) come from
   the [enemy fleet producer](enemy-redesign.md).

## Open points

- The Andromeda saucers read mostly by their keyline: cream on the periwinkle
  field is 2.38:1, and only the indigo keel, turret and band reach 3:1.
- The hub's silhouette is 142 display px high against the shipped 175.
- Hostile stations need per-family geometry (hardpoints, collision and hit
  areas) where `src/data/hostileStations.ts` keys one geometry per route
  position.
- The second Sunflower station needs a manifest id, a placement and a Map
  entry from Tech, and Gameplay's decision on whether it is a destination,
  where it sits, and its name and services. Its art is produced under a
  staged id in stage 2.
- The Weavers' station's right berth no longer moves alone when the Loom hall
  is funded: the hall is a longer needle, so both ends move outward.
- Display scales follow the shipped rows: 1.5 for stations and 1.25 for the
  hub. Outposts and settlements keep their shipped growth factors in stage 2
  unless one destination scale is preferred for every structure.
- `tidy` in `visible.ts` drops a corner that lies between two points rounding
  onto each other. `tonePaths` removes such points first; the enemy fleet
  producer's own copy of the tone path step does not.
