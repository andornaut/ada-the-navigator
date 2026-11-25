# Station redesign

Production plan for the stations, outposts, project solids and hostile
stations: each structure is one model of connected solids, drawn with
depth-resolved occlusion in flat tones. All three stages are built: the model solids and the stations, the outposts
and project solids, and the hostile stations with the Claim platform.

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
7. Rows. Each state's rows carry the fields that name it in the game (its
   base, variant and project), the frame, display size and pivot, the
   `frameMs` step, and its dock or berths.

Curves are faceted: 48 to 72 sides on drums and 64 on rings. The largest
departure from a true arc is 0.15 frame px, on the hub's large rim.

## Output

`node art/tools/stations.ts` writes these sheets, their rows into the
manifests with `mergeEntries`, so each row keeps its place, and their
`projects.json` entries. Reruns are byte-identical. Ids ending
in a pair are the `-a` and `-b` blink frames.

| Structure                                | Ids                                                      | Sheet                                       | Frame px | Display           | Pivot y | Drawn                    |
| ---------------------------------------- | -------------------------------------------------------- | ------------------------------------------- | -------- | ----------------- | ------- | ------------------------ |
| Sunflower station                        | `station`                                                | `/art/station-bloom-sheet.svg`              | 272, 256 | 178.5 by 168      | 0.3125  | 172 by 161               |
| Growers, and with the ring               | `outpost-growers`, `outpost-growers-ring`                | `/art/sunflower/growers-leaf-sheet.svg`     | 192, 144 | 176.4 by 132.3    | 0.45139 | 132 by 108, 165 by 121   |
| Workshop                                 | `outpost-workshop`                                       | `/art/sunflower/workshop-bloom-sheet.svg`   | 200, 144 | 183.75 by 132.3   | 0.41667 | 151 by 122               |
| Workshop crane                           | `outpost-workshop-crane`                                 | `/art/sunflower/workshop-boom-sheet.svg`    | 128, 64  | 117.6 by 58.8     | 0.64063 | 65 by 49                 |
| Salvagers' yard                          | `outpost-salvagers`                                      | `/art/sunflower/salvagers-leaf-sheet.svg`   | 176, 120 | 161.7 by 110.25   | 0.48333 | 153 by 102               |
| Mining hub, worn, repaired and bay       | `outpost-hub`, `outpost-hub-repaired`, `outpost-hub-bay` | `/art/cartwheel/wheel-hub-sheet.svg`        | 360, 288 | 196.875 by 157.5  | 0.58333 | 168 by 142; bay 45 by 34 |
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
- Hub worn: the large wheel's rim is open from 42.19 to 109.69 degrees, on the
  rim's facets, with the spoke at 90 missing.
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
  left and right, clear of the worn opening: frame px `(26.592, 168)` outward
  `[-1, 0]` and `(333.408, 168)` outward `[1, 0]`, width 28.169, each 83.895
  display px to the side of the pivot.
- The docking bay's berth is the berth drum's wall, outward from the hub:
  `(346.277, 264)` outward `[0.866, 0.5]`, width 36.742, 90.933 display px
  right of the pivot and 52.5 below.
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

- The docking bay stands off the large wheel's rim at 0 degrees, the lower
  right on screen, where the worn and the repaired hub both have the rim. Its
  frames share the hub's frame and pivot, so it has no anchor in
  `projects.json`; its berth is beside the right berth and clear of a craft
  docked there; the producer fails unless it draws alike on both hub states.
- The crane and the school have their own frames, with the pivot on the lifting
  drum's or the school saucer's axis. Their `projects.json` anchors are in the
  base's frame px from its pivot: `workshopCrane` `(79.179, 45.714)` and
  `courierSchool` `(-194.093, 0)`, both `layer` `front`.
- The salvage beacons, which the friendly producer draws, stand in the gaps
  between the salvagers' leaves at plan radius 80 (`beacons` on the structure):
  `(0, -61.571)` behind the hub at 225 degrees, phase 0, and
  `(-106.644, 0)` and `(106.644, 0)` beside the yard at 135 and 315 degrees,
  `front`, phases 1 and 0.

`node art/tools/station-contact-sheet.ts <dir>` writes a review sheet of each
state's frames at 1x and 2x on its field with the destination keyline, an
overlay on its whole structure and alone; a third argument `marks` adds each
pivot, berth and dock.

## Hostile stations

`node art/tools/hostile-stations.ts` writes each family's hostile station and
the Claim turret platform at 16 headings, with their rows and `hardpoints`
sidecars in the manifests. Reruns are byte-identical. Each design has no engine or command part.

| Design                 | Key                    | Row prefix                    | Folder                    | Frame | Display | Mounts                                                                            |
| ---------------------- | ---------------------- | ----------------------------- | ------------------------- | ----: | ------: | --------------------------------------------------------------------------------- |
| Coral hostile station  | `hostileStationCoral`  | `enemy-hostileStation`        | `/art/enemies/`           |   376 |   164.5 | `weapon-0` to `-3` on the upper arm tips, `-4` to `-7` on the lower               |
| Claim hostile station  | `hostileStationClaim`  | `enemy-claim-hostileStation`  | `/art/cartwheel/enemies/` |   376 |   164.5 | `weapon-0` to `-7` on the wheel's corners                                         |
| Garnet hostile station | `hostileStationGarnet` | `enemy-garnet-hostileStation` | `/art/andromeda/enemies/` |   376 |   164.5 | `weapon-0` to `-5` on the upper deck's corners, `-6` and `-7` on the lower deck's |
| Claim turret platform  | `platformWheel`        | `enemy-claim-platform`        | `/art/cartwheel/enemies/` |   216 |    94.5 | `port`, `starboard`, `aft` on the wheel's corners                                 |

- Forms: coral is four arms over four, turned 45 degrees, with lamps on the
  hub only. Claim is one open eight-sided wheel over a solid eight-sided deck
  with four broad blades on its flats. Garnet is two six-sided decks, the lower
  one larger and turned 30 degrees. The platform is one open eight-sided wheel
  on a heavy hub.
- Size: each hull is scaled so its widest breadth as it turns is its contract
  span, 7 Ada widths for a station and 4 for the platform
  (`src/data/enemyDimensions.ts`), as the fleet producer sizes its craft. The
  frame is the smallest multiple of 8 frame px that holds the hull and every
  base at every heading; display size is `frame * 0.4375`.
- Files per design: `{key}-sheet.svg` (16 hull roots, four to a row),
  `{key}-bases-sheet.svg` and `{key}-hardpoints.json`.
- Hull rows are `{prefix}-{k}`, the platform's included: its hull turns with
  its heading.
- Bases are `{prefix}-{mount}-{state}-{k}` in a 32 frame px frame (display 14)
  centred on the mount's anchor, in three states: `intact` (the collar),
  `capped` (the collar closed by a low plate) and `destroyed` (a scorched
  stump with a breach). A base is drawn with its hull and keeps only the part
  the hull leaves visible. Bases that draw alike share one root through
  `svgSheetMember`.
- Mounts fit the enemy fleet's tops: collar radius 4.6 display px and height
  1.2, in the fleet's collar, plate and breach tones per family. A top's pivot
  is the centre of the collar's upper face.
- `{key}-hardpoints.json` is the version 1 schema. `hull` is the drawn hull's
  `length` (fore and aft) and `width` (across) in frame px, the model's extents
  as the enemy fleet's, and its spacing `radius`, the larger half. `hardpoints`,
  `fill`, `weaponTops` and `tiers` come from the design: a station fires rapid
  missiles from pods and the ring burst from the dome on `weapon-5`, and arms
  6, 7 and 8 mounts at route positions 4, 5 and 6; the platform fires lasers
  from its turrets and arms 2 and 3 mounts at positions 5 and 6. `headings[k]` holds
  `order` (the hull, then the mounts far to near), each mount's `anchor`,
  `pivot` and per-state `collision`, the hull's `collision` and `banner`. A
  mount whose intact collar shows less than half at a heading is `hidden`
  there, and its top is not drawn; it still fires and takes hits, so `hidden`
  is drawing data only: 28 mount headings of the coral station's
  lower arms and 10 of the Garnet station's lower deck.
- `tops` (shot origins and collision per aim) comes from the fleet's
  [fleet-tops.json](fleet-tops.json): `pod` and `dome` for the stations and
  `gun` as the platform's `turret`.
- The dome on the coral hub is cut on the light turned into mesh space at
  each heading.

`node art/tools/hostile-station-contact-sheet.ts <dir>` writes every heading
of each design at 1x with intact bases and at 2x with capped and destroyed
bases. A second argument names a folder of the fleet's top sheets under their
public paths; with it each armed, unhidden mount carries its top aimed
outward.

## Replaced producers

| Shipped producer                         | Replaced by                                                    | Stage |
| ---------------------------------------- | -------------------------------------------------------------- | ----: |
| `station.ts`                             | `flower` in the station producer                               |     1 |
| `whirlpool-station.ts`                   | `whirl`                                                        |     1 |
| `needle-station.ts`                      | `needle`, with the Loom hall as its two-eye form               |  1, 2 |
| `andromeda.ts`, station and settlements  | `saucer`: settlers' station, hamlet, lamphouse, courier school |  1, 2 |
| `phantom-station.ts`, `phantom.ts`       | `twin`: station, homes, harbour and signal, cracked and mended |  1, 2 |
| `cartwheel.ts`, hub                      | `wheels`: hub worn and repaired, docking bay                   |  1, 2 |
| `outposts.ts`, outposts and their frames | `leafFlower` (growers, salvagers) and `flower` (workshop)      |     2 |
| `hostile-station-export.ts` and its kin  | Three family models at 16 headings, and the Claim platform     |     3 |

`andromeda.ts`, `outposts.ts` and `hostile-station-export.ts` with its field,
surface and variant modules are removed. `node art/tools/hostile-station-icon.ts`
writes the Map mask `map-hostile-station` from the assembly in
`hostile-station.ts`. `primary-station-sheets.ts`, `station-model.ts` and
`station-sidecars.ts` retire with the producers that use them. The Needle ring
gate (`needle-gates.ts`), beacons, buoys and lamps belong to the friendly
objects set. The other entries of `cartwheel.ts` and `phantom.ts` stay with
their producers.

## Runtime values

- `src/data/storyShips.ts` holds the hub's berths and the bay's in the hub's
  360 by 288 frame: on screen from the pivot, at the hub's display scale,
  `(-83.895, 0)`, `(83.895, 0)` and the bay's `(90.933, 52.5)` display px,
  with outward directions `[-1, 0]`, `[1, 0]` and `[0.866, 0.5]`. A craft
  docked at the bay faces heading 8, into the berth drum.
- `svgSheetMember` on the repeated loop rows of the Whirlpool and Phantom
  stations and on the `-cracked-b` rows names the root they share.

## Stages

1. Model solids and the six main stations. Built.
2. Outposts, their states and the project solids. Built.
3. Hostile stations and the Claim platform at 16 headings, their weapon bases
   and one hardpoints file per family. Built. Weapon tops (`pod`, `dome`,
   `gun`) are the [enemy fleet producer](enemy-redesign.md)'s.

## Open points

- The Andromeda saucers read mostly by their keyline: cream on the periwinkle
  field is 2.38:1, and only the indigo keel, turret and band reach 3:1.
- The hub's silhouette is 142 display px high against the shipped 175.
- The hostile stations and the platform are sized to the contract span in
  model space, so they draw larger than the reference sheet: 160, 160 and 160
  display px across the screen at their widest against the sheet's 137, 121
  and 141, and the platform 92 against 76.
- Mount collars are 9.2 display px across to fit the fleet's tops, against the
  reference's 12 (9.6 on the platform), and take the fleet's family tones in
  place of the reference's dark grey.
- The Garnet station's mounts stand on its decks' corners, as the reference
  lists them; the reference model placed them over the middle of each flat's
  edge. The Claim station's blades sit on the lower deck's flats.
- Hostile stations have no dim frame: enemy rows carry no blink.
- The stations' `jets` sidecar is unchanged; the designs have no drive.
- The growers' outpost is the leaf-petal form on a long foot, 132 by 108
  display px against the shipped 132.3 by 110.25; with the greenhouse ring it
  is 165 by 121 against 165.4 by 128.6. There is no second Sunflower station.
- The leaf petals of the growers and the salvagers' yard are slabs 6 display
  px thick with their walls drawn, where the reference sheet shows them flat.
- The hub's berths move from the lower left and right of the hull to the
  rim's screen left and right, which the worn opening leaves whole.
- The Weavers' station's right berth no longer moves alone when the Loom hall
  is funded: the hall is a longer needle, so both ends move outward.
- Display scales follow the shipped rows, so the hub, the outposts and the
  settlements each keep a factor of their own. One destination scale for every
  structure would change only the frame px values.
