# Enemy fleet redesign

Production plan for the enemy fleet: fourteen ship designs and nine weapon tops,
each built as one model of connected solids and drawn at 16 headings with
depth-resolved occlusion. Stage 1 (the model layer and the three small craft) is
built; the other stages are planned.

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

## Fleet

Spans are Ada widths from `src/data/enemyDimensions.ts`.

| Class         | Design                                 | Span | Weapon and mounts                                         | Stage |
| ------------- | -------------------------------------- | ---: | --------------------------------------------------------- | ----: |
| `swarm`       | Pincer drone                           |  0.8 | Laser, one flush nose port. One drive cone                |     1 |
| `fighter`     | Arrowhead                              |    1 | Multi-Laser, three flush ports. Two engine pods           |     1 |
| `interceptor` | Spear                                  |    1 | Phaser, flush emitter nose cap. One drive cone            |     1 |
| `retaliator`  | Manta gunship                          |    3 | Rapid Missile, one aimed `pod` top. Three stern mouths    |     2 |
| `retaliator`  | Cargo Hauler, Mining Freighter         |    3 | Rapid Missile, one aimed `pod` top. Three nozzles         |     2 |
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
  profile variants retire with their hulls. General Gadget's flagship keeps its
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
   spacing and footprint radius. A small craft's `headings[k].muzzles` is its
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

## Stage 1 output

`node art/tools/fleet.ts` writes these files and rows. Reruns are byte-identical.

| Craft        | Key                | Frame | Display | Mouths | Hull length | Hull width | Radius |
| ------------ | ------------------ | ----: | ------: | -----: | ----------: | ---------: | -----: |
| Pincer drone | `fleetSwarm`       |    56 |    24.5 |      1 |       31.33 |       34.3 |  17.15 |
| Arrowhead    | `fleetFighter`     |    80 |      35 |      2 |       54.51 |      42.88 |  27.26 |
| Spear        | `fleetInterceptor` |   128 |      56 |      1 |       96.25 |      42.88 |  48.13 |

Hull sizes are frame px; display px are 0.4375 times them.

- `/art/enemies/{key}-sheet.svg`, `{key}-jets.json` and
  `{key}-shards-packed.json`: the coral sheet and the data every family reads.
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

`node art/tools/fleet-contact-sheet.ts <dir>` writes a review sheet of every
heading at 1x and 2x on each family's field.

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
2. Retaliator hulls: Manta gunship, Cargo Hauler, Mining Freighter. Adds the
   thick wedge wing solid, the turret base with intact and destroyed states,
   the `pod` top at 16 aims with its muzzles, and `{craft}-hardpoints.json`
   with hull size and the turret offset. All three ship in every family.
3. Frigates: Slim delta and Twin hull in cold armour, with engine, and `port`,
   `starboard`, `spine` and `bow` mounts in intact, destroyed and capped states.
4. Capitals: six hulls with `command`, two engines and eight mounts. The
   Crossbow follows its rework. The narrow and compact profile rows, sheets
   and sidecars are removed.
5. Weapon tops: `gun`, `triple`, `dish`, `rail`, `spread`, `lance`, `hopper`
   and `dome` at 16 aims with muzzles and collision, adding the ball and dome
   solids; the platform and hostile station take the tops they carry.

Stages 3 and 4 change `{craft}-hardpoints.json`, the part sheets and their
manifest rows, and the tests in `src/data/enemyHardpoints.test.ts`,
`src/game/heavyStates.test.ts`, `src/model/muzzles.test.ts` and
`art/tools/enemy-assets.test.ts`.

## Decisions needed

- Whether the redesigned craft carry General Gadget's insignia. The models have
  none.
- Jet length follows frame size, so the tighter frames change it: the swarm's
  base length falls from 5.48 to 4.58 frame px and the interceptor's rises from
  5.74 to 6.93.
