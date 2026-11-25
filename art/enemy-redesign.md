# Enemy fleet redesign

Production plan for the enemy fleet: fourteen ship designs and nine weapon tops,
each built as one model of connected solids and drawn at 16 headings with
depth-resolved occlusion. All five stages are built: the model layer, the three
small craft, the three retaliator hulls, the two frigates, the six capitals and
the nine weapon tops.

## Rules

- Connected 3D solids with correct occlusion, at medium detail: three to five
  functional features per ship, ordered and symmetric.
- Flat tones and one light from the upper left: tops lightest, walls facing
  screen left mid, walls facing right darkest.
- No repeated parallel stripes, ribs or panel rows. One band or one seam at most.
- Nothing sticks out ahead of a hull and there are no thin spars. Barrels are
  short and stay near their mount's footprint.
- No flat-plate hulls. Wings are thick wedges that taper.
- Small-craft weapons are flush hull ports.
- No ship is recognisable as a specific film or television ship.
- No insignia on any ship.

## Fleet

Spans are Ada widths from `src/data/enemyDimensions.ts`.

| Class         | Design                                 | Span | Weapon and mounts                                         | Stage |
| ------------- | -------------------------------------- | ---: | --------------------------------------------------------- | ----: |
| `swarm`       | Pincer drone                           |  0.8 | Laser, one flush nose port. One drive cone                |     1 |
| `fighter`     | Arrowhead                              |    1 | Multi-Laser, three flush ports. Two engine pods           |     1 |
| `interceptor` | Spear                                  |    1 | Phaser, flush emitter nose cap. One drive cone            |     1 |
| `retaliator`  | Manta gunship                          |    3 | Rapid Missile, one aimed `pod` top. Three stern mouths    |     2 |
| `retaliator`  | Cargo Hauler (2.5), Mining Freighter   |    3 | Rapid Missile, one aimed `pod` top. Three nozzles         |     2 |
| `frigate`     | Slim delta, Twin hull                  |    5 | Heavy Missile `rail` on `port`, Laser `gun` on the others |     3 |
| `capital`     | Six designs, one per galaxy            |    6 | Charged Lance or Mine Layer, Scattershot elsewhere        |     4 |
| Weapon tops   | `gun`, `triple`, `dish`, `pod`, `rail` |      | Aimed tops with capped and destroyed mount states         |     5 |
|               | `spread`, `lance`, `hopper`, `dome`    |      |                                                           |       |

- Retaliators roll Manta gunship, Cargo Hauler and Mining Freighter with equal
  weight in every galaxy, so each of the three ships in every family. The two
  stems keep their role paint, with the launcher top and jets in the family's.
- Frigates: Slim delta in Sunflower, Cartwheel and Phantom; Twin hull in
  Whirlpool, Andromeda and Needle.
- Capitals: Hammer (Sunflower), Manta dreadnought (Whirlpool), Outrigger carrier
  (Cartwheel), Broad wing (Andromeda), Crossbow (Needle), Forked fortress
  (Phantom).
- The `frigateNarrow`, `frigateCompact`, `capitalNarrow` and `capitalCompact`
  profile variants retire with their hulls. Admiral Archie's flagship keeps its
  shipped design.
- Health and speed are unchanged.

## Pipeline

Every class follows the same steps from model to shipped files.

1. Model. [fleet-models.ts](tools/fleet-models.ts) builds each ship from the
   mesh solids in [solid.ts](tools/solid.ts): boxes, extruded plans, lofted
   hulls and tubes. Mesh space is forward +x, port +y, up +z, in display px.
   Each ship is a list of named parts; a `loose` part breaks off whole when the
   ship is destroyed.
2. Scale. The producer scales the model so its lateral span is its contract
   span times Ada's model span (`enemy-size.ts`), then fits the square frame to
   the model at every heading: the smallest multiple of 8 frame px with a 1 px
   margin. Display size is `frame * 0.4375`.
3. Draw. [visible.ts](tools/visible.ts) turns the mesh to each of the 16
   headings (`rotate` in `projection.ts`), culls faces turned from the viewer,
   and cuts every face by each nearer face with exact planar depth. A face's
   tone is a function of its view normal, so tones follow the light at every
   heading.
4. Write. The visible fragments merge into one outline per tone. Paths draw
   largest tone first and each path also covers every later tone, so the first
   path is the silhouette and no seam between two tones shows the field. Every
   frame passes through `svgText` at one decimal and the 16 frames pack into
   one sheet of nested roots, four to a row (`packHullRoots` in `enemies.ts`).
5. Collision. Hits test the drawn convex outline at the current heading.
   `traceEnemyFills` traces each heading's fragments into strictly convex
   parts with the shared checker's thresholds; notch tips draw under the
   paths. The parts ship per hull and heading as `headings[k].collision`.
6. Jets. `jetsFile` in `crafts.ts` writes the version 1 jets file. Each mouth
   is the aft disc of a drive cone or engine pod, and the jet base is 0.75 of
   its diameter. `familyColors` carries the claim, garnet and needle ramps.
   The file adds `hull`, in frame px: the drawn `length` and `width`, and
   `radius`, the larger of half the length and half the width, which is the
   spacing and footprint radius. A frigate's or capital's length includes its
   intact engines and command tower. A small craft's `headings[k].muzzles` is its
   shot origin in frame px: the flush port its weapon fires from, which aims
   independently of the hull. The fighter's fan of three leaves from its one
   nose origin. Ships with hardpoints carry `hull` and the hardpoint offsets in
   `{craft}-hardpoints.json`.
7. Shards. The hull parts split along the craft's wedge cuts, loose parts
   stay whole and four flecks follow, with the seeds of `shard-geometry.ts`.
   Each shard is resolved for occlusion on its own, and ships as the version 2
   palette pack of [destruction](destruction.md).
8. Families. Geometry is produced once in coral. A family's sheet is the coral
   sheet with each tone swapped for the family's; the producer fails when two
   materials that share a coral tone differ in a family.

Layers per class:

| Layer                                 | Small craft                  | Retaliator hulls    | Frigates and capitals    |
| ------------------------------------- | ---------------------------- | ------------------- | ------------------------ |
| Hull sheet, 16 headings               | Yes                          | Yes                 | Yes                      |
| Hardpoint bases, intact and destroyed | None                         | Turret base         | Engines, command, mounts |
| Capped plates                         | None                         | None                | Every weapon mount       |
| Aimed tops, 16 aims                   | None, weapons are hull ports | `pod`               | Per weapon, stage 5      |
| Jets and mouths                       | In the jets file             | In the jets file    | Per engine hardpoint     |
| Collision outlines                    | In the jets file             | Jets and hardpoints | Jets and hardpoints      |
| Destruction shards                    | Palette pack                 | Palette pack        | None                     |
| Family recolours                      | claim, garnet, needle        | Top and jets only   | Armour per family        |

## Output

`node art/tools/fleet.ts` writes these files and rows. Reruns are byte-identical.

| Craft        | Key                | Frame | Display | Mouths | Hull length | Hull width | Radius |
| ------------ | ------------------ | ----: | ------: | -----: | ----------: | ---------: | -----: |
| Pincer drone | `fleetSwarm`       |    56 |    24.5 |      1 |       31.33 |       34.3 |  17.15 |
| Arrowhead    | `fleetFighter`     |    80 |      35 |      2 |       54.51 |      42.88 |  27.26 |
| Spear        | `fleetInterceptor` |   128 |      56 |      1 |       96.25 |      42.88 |  48.13 |

| Craft            | Key                              | Stem                        | Frame | Display | Hull length | Hull width | Radius | Mount offset | Collar frame | Top frame |
| ---------------- | -------------------------------- | --------------------------- | ----: | ------: | ----------: | ---------: | -----: | ------------ | -----------: | --------: |
| Manta gunship    | `fleetRetaliator`                | `retaliator`                |   160 |      70 |       77.69 |     128.64 |  64.32 | `[0, 11.43]` |           32 |        40 |
| Cargo Hauler     | `fleetRetaliatorCargoHauler`     | `retaliatorCargoHauler`     |   280 |   122.5 |         192 |      107.2 |     96 | `[0, -6.86]` |           24 |        32 |
| Mining Freighter | `fleetRetaliatorMiningFreighter` | `retaliatorMiningFreighter` |   176 |      77 |      114.25 |     128.64 |  64.32 | `[0, 11.43]` |           32 |        40 |

Hull sizes and offsets are frame px; display px are 0.4375 times them. Each
retaliator has three stern mouths.

The Cargo Hauler is sized per hull: its span is 2.5 Ada widths, below the
retaliator's 3, and it is the longest of the three at 84 by 46.9 display px.
Its spacing and footprint radius is 96 frame px (42 display px), against 64.32
(28.1) for the other two.

Each retaliator is its own hull: the three share no frames, jets, collision,
hardpoints or shards. Its launcher is the `turret` hardpoint, with one `intact`
state and the `pod` top, named `turret` in its rows and file:

- `{key}-turret-intact-sheet.svg`: the mount's collar at the 16 hull headings,
  centred on its anchor. Each frame is the part of the collar the hull leaves
  visible at that heading.
- `{key}-turret-top-sheet.svg`: the top at 16 aims, centred on its pivot. It
  draws over the hull and collar at every heading.
- `{key}-hardpoints.json`, version 1, in the shipped retaliator's schema:
  `headings[k]` gives the collar's `anchor`, the top's `pivot` and the collar's
  convex `collision`; `tops.turret[i]` gives the two shot origins (one per
  bright cell) and the top's convex collision at aim `i`, relative to the
  pivot. It adds `hull` and the hardpoint's `offset` from the hull pivot, x to
  starboard and y aft.
- The shards add the launcher, collar and top aimed ahead, as one loose part.
- The Manta gunship wears the family's hull paint. The stems keep their role
  paint; their collar, top, jets, nozzle glow and dark works take the family's,
  so the garnet and needle rows name the coral stem sheets and claim has its
  own.

### Frigates

| Craft      | Key                | Frame | Display | Hull length | Hull width | Radius | Engine frame | Mount frame | `gun` frame | `rail` frame |
| ---------- | ------------------ | ----: | ------: | ----------: | ---------: | -----: | -----------: | ----------: | ----------: | -----------: |
| Slim delta | `fleetFrigate`     |   344 |   150.5 |      267.43 |      214.4 | 133.71 |          128 |          32 |          40 |           48 |
| Twin hull  | `fleetFrigateTwin` |   400 |     175 |      246.86 |      214.4 | 123.43 |          256 |          32 |          40 |           48 |

| Hardpoint   | Slim delta offset | Twin hull offset   | States                    |
| ----------- | ----------------- | ------------------ | ------------------------- |
| `engine`    | `[0, 96]`         | `[0, 109.71]`      | intact, destroyed         |
| `port`      | `[-76.34, 27.43]` | `[-87.77, -22.86]` | intact, destroyed         |
| `starboard` | `[76.34, 27.43]`  | `[87.77, -22.86]`  | intact, destroyed         |
| `spine`     | `[0, 75.43]`      | `[0, 20.57]`       | intact, destroyed, capped |
| `bow`       | `[0, -96]`        | `[0, -18.29]`      | intact, destroyed, capped |

Offsets are frame px from the hull pivot, x to starboard and y aft, as in the
shipped layout: `port` is the mount to port on screen. The reference sheets
draw the Heavy Missile on the other wing, because their model axes mirror on
screen.

The Slim delta is one broad deep hull with a blunt stepped bow block, a thick
weapon shoulder close against each flank, a raised citadel aft and a stern
engine block with twin mouths. It is 117 by 93.8 display px, and its `port` and
`starboard` mounts stand on the shoulders.

- The hull sheet has no hardpoints. Each hardpoint base is its own layer per
  state, centred on its anchor and cut by the hull at each heading: the engine
  (the stern block and twin cones on the Slim delta, one cone per hull on the
  Twin hull, as one `engine` hardpoint), and each mount's collar.
- Destroyed: a mount is a low scorched stump with a breach; an engine keeps its
  block, its cones lose their flared lips and glow, and one mouth holds an
  ember. Capped: the collar closed by a low plate.
- `gun` and `rail` tops at 16 aims, one shot origin each.
- `{key}-parts-{size}-sheet.svg` holds every base set and top of one frame
  size, a set of 16 to a row.
- `{key}-jets.json`: two mouths tagged `hardpoint` `engine`, and `hull`.
- `{key}-hardpoints.json`, version 1, in the shipped frigate's schema:
  `hardpoints` with `capped` and `offset`, `fill`, `weaponTops`, `tiers`,
  per heading the layer `order`, each hardpoint's `anchor`, `pivot` and
  collision by state, the hull's convex `collision` and the `banner` centre,
  and `tops` with shot origins and collision per aim. It adds `hull`.
- Layer order per heading is the hull, then the hardpoints far to near.
- Frigates have no shards.

Each galaxy flies one frigate, and the rows are staged so that the frame key
selects it:

| Galaxy             | Frigate    | Manifest  | Rows                       | Sidecar key   |
| ------------------ | ---------- | --------- | -------------------------- | ------------- |
| Sunflower, Phantom | Slim delta | core      | `enemy-frigate-...`        | `frigate`     |
| Cartwheel          | Slim delta | Cartwheel | `enemy-claim-frigate-...`  | `frigate`     |
| Whirlpool          | Twin hull  | Whirlpool | `enemy-frigateTwin-...`    | `frigateTwin` |
| Andromeda          | Twin hull  | Andromeda | `enemy-garnet-frigate-...` | `frigate`     |
| Needle             | Twin hull  | Needle    | `enemy-needle-frigate-...` | `frigate`     |

A family's own `frigate` rows are that family's design, so Cartwheel,
Andromeda and Needle select as they do now. Whirlpool flies the coral family,
whose `frigate` is the Slim delta, so the coral Twin hull is the new frame key
`frigateTwin` in Whirlpool's manifest, its only user. The `frigateNarrow` and
`frigateCompact` rows and sidecars have no replacement.

### Capitals

| Craft             | Key                     | Galaxy    | Family | Frame | Display | Hull length | Radius | Command frame | Engine frame |
| ----------------- | ----------------------- | --------- | ------ | ----: | ------: | ----------: | -----: | ------------: | -----------: |
| Hammer            | `fleetCapital`          | Sunflower | coral  |   528 |     231 |       363.3 | 181.65 |            56 |           80 |
| Manta dreadnought | `fleetCapitalManta`     | Whirlpool | coral  |   472 |   206.5 |      349.59 | 174.79 |            56 |           56 |
| Outrigger carrier | `fleetCapitalOutrigger` | Cartwheel | claim  |   488 |   213.5 |       347.3 | 173.65 |            56 |           80 |
| Broad wing        | `fleetCapitalBroad`     | Andromeda | garnet |   456 |   199.5 |      319.89 | 159.94 |            56 |          160 |
| Crossbow          | `fleetCapitalCrossbow`  | Needle    | needle |   480 |     210 |      379.29 | 189.65 |            48 |           72 |
| Forked fortress   | `fleetCapitalForked`    | Phantom   | coral  |   512 |     224 |      388.43 | 194.22 |            56 |           80 |

Every capital is 257.28 frame px wide (6 Ada widths, 112.56 display px). Its
mount bases are frame 32, its `spread` and `lance` tops frame 56 and its
`hopper` top frame 40.

| Hardpoint                    | Hammer              | Manta dreadnought  | Outrigger carrier   | Broad wing          | Crossbow           | Forked fortress     |
| ---------------------------- | ------------------- | ------------------ | ------------------- | ------------------- | ------------------ | ------------------- |
| `command`                    | `[0, 61.69]`        | `[0, -15.99]`      | `[0, 52.55]`        | `[0, 15.99]`        | `[0, 49.13]`       | `[0, 43.41]`        |
| `engine-left`, `-right`      | `[∓55.98, 148.52]`  | `[∓34.27, 171.37]` | `[∓108.08, 129.1]`  | `[∓70.83, 75.4]`    | `[∓18.28, 166.8]`  | `[∓75.4, 161.09]`   |
| `weapon-left`, `-right`      | `[∓98.25, -153.09]` | `[∓68.55, -31.99]` | `[∓63.98, 54.84]`   | `[∓54.84, -4.57]`   | `[∓108.08, -45.7]` | `[∓91.4, -34.27]`   |
| `weapon-rear-left`, `-right` | `[∓55.98, 82.26]`   | `[∓102.82, 15.99]` | `[∓108.08, 63.98]`  | `[∓106.25, 63.98]`  | `[∓51.41, 105.11]` | `[∓107.39, 20.56]`  |
| `claw-left`, `-right`        | `[∓50.27, -153.09]` | `[∓43.41, -82.26]` | `[∓19.42, -143.95]` | `[∓13.71, -100.54]` | `[∓12.8, -100.54]` | `[∓35.42, -127.96]` |
| `stern-left`, `-right`       | `[∓18.28, 107.39]`  | `[∓15.08, 82.26]`  | `[∓18.28, 127.96]`  | `[∓17.14, 102.82]`  | `[∓17.37, 109.68]` | `[∓75.4, 100.54]`   |

Offsets are frame px from the hull pivot, x to starboard and y aft; every
`-left` hardpoint is at negative x.

- Each capital is its own hull in cold grey armour with a shaded keel, one band
  in its family's hull colour and no insignia. It has the shipped capital's
  hardpoints in the shipped order: `command`, `engine-left`, `engine-right` and
  eight mounts in the fill order `weapon`, `weapon-rear`, `claw`, `stern`, left
  then right.
- The hull sheet has no hardpoints. Each is its own layer per state, cut by the
  hull at each heading: the command tower, one drive cone per engine (a whole
  nacelle on the Broad wing) and each mount's collar on its armour pedestal.
- States are `intact` and `destroyed` for every hardpoint, and `capped` for the
  `claw` and `stern` pairs, which the tiers leave unarmed at route positions 1
  to 4. Destroyed, the tower is a low scorched stump with a breach and one
  ember, and each engine is the frigates' wrecked cone with one ember.
- `fill`, `weaponTops` and `tiers` equal the shipped capital's: Charged Lance
  `lance` and Scattershot `spread` aim at the target, Mine Layer `hopper` holds
  its aim aft, and positions 1 to 2, 3 to 4 and 5 to 6 arm four, six and eight
  mounts.
- `spread` has five shot origins across its mouth, `lance` one and `hopper` one
  at the tray's leading edge.
- `{key}-jets.json`: one mouth per engine, tagged `hardpoint` `engine-left` or
  `engine-right`, and `hull`.
- `{key}-hardpoints.json`, version 1, in the shipped capital's schema, with
  `hull`, each hardpoint's `offset` and the collision of every base and top.
- A deep hull hides a mount behind it at some headings. `headings[k]` marks
  such a mount `hidden` when less than half of its intact collar shows, and its
  top is not drawn at that heading. A base the hull hides whole is an empty
  frame with no collision. Hidden: the Hammer's `weapon-rear` pair at two
  headings each, the Broad wing's `weapon` pair at three, the Crossbow's
  `weapon-rear` pair at five and the Forked fortress's `claw` pair at two and
  `weapon-rear` pair at one. The frigates have none.
- A top draws whole over its mount, so the hull does not cut a top it only
  partly hides.
- Capitals have no shards.

Each galaxy flies one capital, and the rows are staged so that the frame key
selects it:

| Galaxy    | Capital           | Manifest  | Rows                       | Sidecar key     |
| --------- | ----------------- | --------- | -------------------------- | --------------- |
| Sunflower | Hammer            | core      | `enemy-capital-...`        | `capital`       |
| Whirlpool | Manta dreadnought | Whirlpool | `enemy-capitalManta-...`   | `capitalManta`  |
| Phantom   | Forked fortress   | Phantom   | `enemy-capitalForked-...`  | `capitalForked` |
| Cartwheel | Outrigger carrier | Cartwheel | `enemy-claim-capital-...`  | `capital`       |
| Andromeda | Broad wing        | Andromeda | `enemy-garnet-capital-...` | `capital`       |
| Needle    | Crossbow          | Needle    | `enemy-needle-capital-...` | `capital`       |

Three galaxies fly the coral family. Its `capital` is the Hammer, so the Manta
dreadnought and the Forked fortress are the new frame keys `capitalManta` and
`capitalForked`, each in its own galaxy's manifest. The `capitalNarrow` and
`capitalCompact` rows and sidecars have no replacement.

### Weapon tops

Every top is a separate solid that pivots about its mount's collar centre, at
16 aims, with its shot origins and convex collision per aim. The mount radius
is 10.51 frame px (4.6 display px) and the collar is 2.74 frame px high.

| Weapon         | Top      | Frame | Shot origins | Carried by                                | Design                                               |
| -------------- | -------- | ----: | -----------: | ----------------------------------------- | ---------------------------------------------------- |
| `laser`        | `gun`    |    40 |            1 | Frigate mounts, platform                  | One narrow block along the aim, bright muzzle face   |
| `multiLaser`   | `triple` |    40 |            3 | None: the fighter fires from hull ports   | Three stub lobes fanned from a back bar, bright tips |
| `phaser`       | `dish`   |    32 |            1 | None: the interceptor fires from its nose | Low disc wider than its collar, dark centre, one dot |
| `rapidMissile` | `pod`    |    40 |            2 | Retaliators, hostile station              | Low flat box, two bright cells on the face           |
| `heavyMissile` | `rail`   |    48 |            1 | Frigate `port`                            | Dark sled carrying one large missile                 |
| `scattershot`  | `spread` |    56 |            5 | Capital mounts                            | Flared fan with a wide bright mouth                  |
| `chargedLance` | `lance`  |    56 |            1 | Capital `weapon-left`                     | Capacitor block, two short broad rails round a slot  |
| `mineLayer`    | `hopper` |    40 |            1 | Capital `stern-right`, held aft           | Square tray holding two round mines                  |
| `ringBurst`    | `dome`   |    32 |            8 | Hostile station `weapon-5`                | Dome over a bright ring, no barrel                   |

- Round solids (the mines and the dome) are lit per aim, so their two tones
  meet on the light's terminator at every aim.
- A ship's tops are in its part sheets and hardpoints file. The tops the
  hostile station and the platform carry are produced at game scale for the
  station switch: `/art/enemies/fleetTop-pod-sheet.svg` and
  `fleetTop-dome-sheet.svg` in the coral, claim and garnet folders, and
  `fleetTop-gun-sheet.svg` in the claim folder.
- [fleet-top-rows.json](fleet-top-rows.json) stages their rows under the
  shipped ids `enemy-{family}-hostileStation-pod-top-{i}`,
  `enemy-{family}-hostileStation-dome-top-{i}` and
  `enemy-claim-platform-turret-top-{i}`, apart from the fleet's rows, because
  they switch with the stations.
- [fleet-tops.json](fleet-tops.json) holds the shot origins and collision of
  `gun`, `pod`, `dome`, `triple` and `dish` per aim, relative to the pivot, and
  the mount's radius and collar height. `triple` and `dish` have no carrier, so
  no sheet of them ships.

A sheet whose frames equal one already written ships once: its rows name that
file and its nested roots with `svgSheetMember`. The Mining Freighter's top is
the Manta gunship's, and the Manta dreadnought's and Forked fortress's `hopper`
tops are the Hammer's.

- `/art/enemies/{key}-sheet.svg`, `{key}-jets.json`, `{key}-shards-packed.json`
  and `{key}-hardpoints.json`: the coral sheet and the data every family
  reads, in the core folder for every craft. A shard pack's `archetype` is its sidecar key, the stem.
- `/art/cartwheel/enemies/{key}-sheet.svg`, `/art/andromeda/enemies/{key}-sheet.svg`
  and `/art/needle/enemies/{key}-sheet.svg`: the claim, garnet and needle sheets.
- [fleet-rows.json](fleet-rows.json): per manifest, the `assets` rows and
  `sidecars` entries that switch to these files. Each row has the id and fields
  of the shipped row it replaces, and each sheet's nested roots carry those ids.

The producer leaves the manifests alone, so the shipped rows, sheets and
sidecars are unchanged and nothing reads the new files until the switch. Rows
with a `family` load with their galaxy, and Cartwheel's manifest test accepts
no id outside its known groups, so the rows cannot sit in the manifests under
other ids.

`node art/tools/fleet-contact-sheet.ts <dir> [name]` writes review sheets of
every heading at 1x and 2x on each family's field, or only the sheets whose
name has `name`. Retaliators are composed with their collar and top at two
aims. A frigate shows armed, at route positions 1 to 2 and with every hardpoint
destroyed; a capital shows its lance profile, its mine profile, route positions
1 to 2 and every hardpoint destroyed. `fleet-weapon-tops.svg` shows the nine
tops on a collar at 16 aims, at 1x, 2x and 4x.

## Switch

Tech replaces, from `fleet-rows.json`:

- The 48 `enemy-{archetype}-{k}` rows of the core manifest, and the 48
  `enemy-{family}-{archetype}-{k}` rows of each of the Cartwheel, Andromeda and
  Needle manifests, with the rows of the same ids. `path`, `width`, `height`,
  `displayWidth` and `displayHeight` change.
- `sidecars.swarm`, `sidecars.fighter` and `sidecars.interceptor` in the same
  four manifests.
- The shot origin and the spacing radius, read from the jets file's
  `headings[k].muzzles` and `hull.radius`.
- `destruction.json` `archetypes.{archetype}`: `flashWidth` is the new half
  span times 1.98 (33.96 for the swarm, 42.45 for the fighter and interceptor);
  durations and `spread` follow the new frame sizes.

For the retaliators, from the same file:

- The hull, `-turret-intact-` and `-turret-top-` rows of `retaliator`,
  `retaliatorCargoHauler` and `retaliatorMiningFreighter`: 144 rows in the core
  manifest and 144 in each of the Cartwheel, Andromeda and Needle manifests.
  Sizes change for every row, and the Cargo Hauler no longer aliases the
  `retaliator` rows.
- `sidecars.retaliator`, `sidecars.retaliatorCargoHauler` and
  `sidecars.retaliatorMiningFreighter`: each names its own `jets`, `hardpoints`
  and `shards`.
- Each top has two shot origins where the shipped launcher has three tips.
- `destruction.json` needs an entry per stem: `flashWidth` is the hull's half
  span times 1.98, so 127.354 for the Manta gunship and the Mining Freighter
  and 106.128 for the Cargo Hauler.
- Gameplay rolls the three hulls with equal weight in every galaxy and takes
  each hull's `hull.radius` for spacing and footprint: 64.32, 96 and 64.32
  frame px. The Cargo Hauler's 2.5 width span is its own; `ENEMY_SIZE_RATIOS`
  keeps `retaliator` at 3 for the other two.

For the frigates, from the same file:

- The `frigate` hull, base and top rows of the core, Cartwheel, Andromeda and
  Needle manifests (240 rows each), and `sidecars.frigate`.
- Whirlpool's manifest gains the 240 `enemy-frigateTwin-...` rows and
  `sidecars.frigateTwin`, and Whirlpool selects that frame key for its
  frigates.
- The `frigateNarrow` and `frigateCompact` rows, sidecars and files are
  removed, with the profile selection that picks them.
- `tools/enemy-hardpoints.json` takes each design's offsets.
- A `flashWidth` for either frigate is 212.256.

For the capitals, from the same file:

- The `capital` hull, base and top rows of the core, Cartwheel, Andromeda and
  Needle manifests (480 rows each), and `sidecars.capital`.
- Whirlpool's manifest gains the 480 `enemy-capitalManta-...` rows and
  `sidecars.capitalManta`, and Phantom's the 480 `enemy-capitalForked-...` rows
  and `sidecars.capitalForked`. Whirlpool and Phantom select those frame keys
  for their capitals.
- The `capitalNarrow` and `capitalCompact` rows, sidecars and files are
  removed, with the profile selection that picks them.
- Every design has its own offsets, so the `capital` entry of
  `tools/enemy-hardpoints.json` becomes one entry per design, or the game reads
  `offset` from each hardpoints file.
- A mount marked `hidden` at a heading draws no top there.
- Each engine has one mouth, and `spread` has five shot origins, `lance` one
  and `hopper` one.
- A `flashWidth` for any capital is 254.707.

For the stations, from [fleet-top-rows.json](fleet-top-rows.json): the `pod`
and `dome` top rows of the hostile station in the core, Cartwheel and Andromeda
manifests and the platform's `turret` top rows in Cartwheel's, with the shot
origins and collision of [fleet-tops.json](fleet-tops.json): two for `pod`,
eight for `dome`, one for `gun`. The frames are 40, 32 and 40 px, against the
shipped 48, 48 and 120.

Art then moves the craft into `enemies.ts`, `destruction.ts` and the family
generators' ownership, renames the files to the `{archetype}-` stems and
removes `fleet-rows.json` and the replaced sheets and models.

Tests that assert the replaced art and need Tech's changes at the switch:

- `src/game/enemyArt.test.ts`: display sizes 35, 45.5 and 38.5 and frames 80,
  104 and 88 for the swarm, fighter and interceptor.
- `src/model/collisionData.test.ts` and `src/pwa/precacheArt.test.ts`: the
  heading sets and jets files by path.
- `src/game/destructionArt.test.ts` and `src/game/shardPalettePack.test.ts`:
  shard archetypes and palettes.
- `src/game/familyManifest.test.ts`, `src/game/claimArtLoad.test.ts` and
  `src/game/cartwheelArt.test.ts`: family sheet paths, Cartwheel's shared
  `claim-stock-hulls-sheet.svg` among them.
- `src/data/enemyHardpoints.test.ts`, `src/model/muzzles.test.ts` and
  `src/model/enemyAssetPair.test.ts`: the retaliator stems' files, sizes and
  launch tips.
- `art/tools/enemy-assets.test.ts` (jet mouths against `crafts.ts`) and
  `art/tools/enemy-size.test.ts` (size receipts), which move to the fleet
  models with the craft.

## Reused and new

Reused: `projection.ts` (heading rotation, projection, jet anchors, JSON
layout), `svg-text.ts`, `manifest.ts` (`writeOnce`, `mergeEntries`,
`mergeSidecars`), `enemy-size.ts` (Ada's span and the contract ratios),
`enemy-outline.ts` and `silhouette.ts` (collision tracing and checks),
`crafts.ts` (`jetsFile`, display scale), `enemies.ts` (`packHullRoots`),
`shard-geometry.ts` (seeds and flecks) and `shard-palette-pack.ts`.

New: the mesh solids in `solid.ts`, `visible.ts`, `fleet-models.ts`, `fleet.ts`
and `fleet-contact-sheet.ts`.

## Stages

1. Small craft: Pincer drone, Arrowhead, Spear. Built.
2. Retaliator hulls: Manta gunship, Cargo Hauler, Mining Freighter, in every
   family, with the launcher's collar, the `pod` top at 16 aims and
   `{craft}-hardpoints.json`. Built.
3. Frigates: Slim delta and Twin hull in cold armour, with engine, and `port`,
   `starboard`, `spine` and `bow` mounts in intact, destroyed and capped
   states, and the `gun` and `rail` tops. Built.
4. Capitals: six hulls with `command`, two engines and eight mounts, and the
   `spread`, `lance` and `hopper` tops their hardpoints files need. Built.
5. Weapon tops: `triple`, `dish` and `dome` at 16 aims with muzzles and
   collision, and the `gun`, `pod` and `dome` tops the platform and the hostile
   station carry. Built.

Stages 3 and 4 replace `{craft}-hardpoints.json`, the part sheets and their
manifest rows, and the tests in `src/data/enemyHardpoints.test.ts`,
`src/game/heavyStates.test.ts`, `src/model/muzzles.test.ts` and
`art/tools/enemy-assets.test.ts`.

## Decisions needed

- Jet length follows frame size, so the tighter frames change it: the swarm's
  base length falls from 5.48 to 4.58 frame px and the interceptor's rises from
  5.74 to 6.93.
- Whether a `hidden` mount still fires and can be hit while the hull covers it.
- Whether a top the hull partly covers needs its own cut frames: the hull cuts
  each base at each heading, and a top draws whole.
