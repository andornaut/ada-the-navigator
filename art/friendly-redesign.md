# Friendly object redesign

Production plan for the friendly objects and points of interest: the pickups
and caches, the galaxy beacons, buoys and lamps, the job landmarks, the Needle
ring gate, the 32 friendly craft and the whales. Each is one model of connected
solids drawn with depth-resolved occlusion. All four stages are built.
Stations, outposts, enemy ships and Ada's ship are outside this plan.

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
- The shipped frames carry no keyline. The game draws the 1 px ink keyline in
  every galaxy.

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
7. Rows. The producer writes each object's rows, data links and sidecars into
   its manifest; the whales stay staged (see [Whale switch](#whale-switch)).

`node art/tools/friendly.ts` writes the files and rows; reruns are
byte-identical. `node art/tools/friendly-contact-sheet.ts <dir> [scale ...]`
writes two review sheets with the keyline: `friendly-objects.svg`, every fixed
object's frames on its galaxy's field, and `friendly-craft.svg`, every craft's
16 headings on its home galaxy's field.

The model layer gained these solids for the friendly objects: `meshRing` (a
ring on the vertical axis), `meshHoop` (a ring about any axis, whole or the
half on one side of a plane, with end caps), `meshDome`, `meshSpiral`,
`meshBlock` and `meshBar` (oriented boxes), `meshPlace` (turn, scale and move),
`meshCapped` (a convex solid cut by a plane and closed) and `meshBall` (an
ellipsoid in two tones split on the light).

## Groups and the producers they replace

| Group                                            | Stage | Replaces                                                                                                                                                                              |
| ------------------------------------------------ | ----: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
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

Stardust and ore are outside the redesign: they are the 9 px pixel sheets of
[Stardust](stardust.md) and the [ore nugget](cartwheel-props.md#ore-nugget),
and the pickups sheet and `pickups.json` carry neither.

## Stage 1 output

| Object                   | Row ids                                                                       |     Frame | Drawn, display px | Pivot   |
| ------------------------ | ----------------------------------------------------------------------------- | --------: | ----------------: | ------- |
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
- `/art/pickups/pickups.json`: per row id, the frame size, pivot, drawn
  extents and convex collision parts in frame px, for the pickups and the
  cache. The core manifest names it as the `pickups` data link. An animated
  pickup's parts are its rest frame's, so its body holds still through its
  loop.
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
- `/art/needle/ring-gates.json`: the gate data, Needle's `needleGates`
  link.
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

`ring-gates.json` holds `opening`, `rim` and the orientations, and `collar`, `worldUnit` (display px
per world unit), `groundDepth` (how many times farther down the screen the art
draws a ground offset than the game), and per orientation `worldAxis`,
`gameAxis` and `extent` (the drawn width and height in display px). `colors` holds the rim's and band's three flat tones and the two
lamp colours. `src/data/needle.ts` imports it and reads `opening`, `rim` and
the orientations.

## Stage 3 output: friendly craft

[friendly-craft-models.ts](tools/friendly-craft-models.ts) builds the 32 craft
in display px and [friendly-craft.ts](tools/friendly-craft.ts) draws them. A
craft is modelled forward along +x and built once per heading, so each rounded
part splits its two tones on the light as that heading sees it.

- The yard hull has three tiers: a lower hull with a sloped nose, a full-width
  stern engine block with two jet ports, and a cabin tier with a canopy front.
  Each role adds one feature.
- A lifeboat is one rounded capsule with one window band, one stern port, one
  lamp and one feature of its galaxy. Blink frame A lights the lamp and frame B
  darkens it; the two share one outline.
- Needle's three slim hulls differ by one feature: the stranded glider's long
  cabin with one window band, the student's lamp drum and lavender livery, and
  Avi's blunt nose behind one bumper block.
- The Blocker is a broad blunt chartreuse hull with an oversized engine tier
  and two white high beams.
- Elder Loom's saucer keeps the id `craft-glider` and Reed's ring ship
  `craft-reed`.
- The stranded lamp buoy is a small guide beacon, drawn the same at all 16
  headings; only its tow point turns.

| Craft                      | Manifest  | Feature                                   | Frame | Drawn at heading 0, display px |
| -------------------------- | --------- | ----------------------------------------- | ----: | -----------------------------: |
| `miner`                    | core      | Two side bins, one drill cone on a collar |   144 |                        50 x 35 |
| `pip`                      | core      | One roof lamp                             |   104 |                        37 x 24 |
| `stranded-scrap-barge`     | sunflower | One short scrap hold                      |   112 |                        39 x 26 |
| `stranded-seed-pod`        | sunflower | Petal cup at the stern                    |    80 |                        28 x 24 |
| `visitor1`, `visitor2`     | cartwheel | Long cabin with one window band           |   104 |                        37 x 26 |
| `blocker`                  | cartwheel | Two white high beams                      |    96 |                        39 x 26 |
| `stranded-hauler`          | cartwheel | Two side bins, no drill                   |   128 |                        47 x 33 |
| `stranded-ore-pod`         | cartwheel | White wheel rim at the waist              |    72 |                        24 x 21 |
| `stranded-current-skimmer` | whirlpool | Flat rounded hull, one stern drum         |    96 |                        33 x 22 |
| `stranded-whirlpool-pod`   | whirlpool | Family drum on its back                   |    72 |                        24 x 24 |
| `glider`                   | needle    | Saucer in three tiers, centred dome       |   112 |                        41 x 28 |
| `stranded-glider`          | needle    | Long cabin with one window band           |   128 |                        45 x 29 |
| `stranded-needle-pod`      | needle    | Blunt needle cone at each end             |    88 |                        29 x 20 |
| `stranded-courier`         | andromeda | Slate livery, no lamp                     |   104 |                        37 x 24 |
| `stranded-lamp-buoy`       | andromeda | Small guide beacon                        |    72 |                        20 x 28 |
| `stranded-traveler-pod`    | phantom   | Three arms in a Y at the stern            |    80 |                        28 x 25 |
| `barge`                    | phantom   | Cargo hold in two stepped tiers           |   136 |                        47 x 30 |
| `grower`                   | phantom   | Garden dome                               |    72 |                        24 x 20 |
| `crane`                    | phantom   | Jib tier along the roof                   |   112 |                        42 x 30 |
| `salvager`                 | phantom   | Magnet drum on a blunt bow                |   112 |                        43 x 29 |
| `driller`                  | phantom   | Blunt drill cone on a collar              |   120 |                        42 x 29 |
| `tug`                      | phantom   | Push block across the bow                 |   104 |                        41 x 30 |
| `buoytender`               | phantom   | Two buoys on deck                         |   112 |                        39 x 28 |
| `voronguide`               | phantom   | Small skimmer                             |    80 |                        27 x 18 |
| `reed`                     | phantom   | Spindle hull through an eye ring          |    88 |                        32 x 21 |
| `student`                  | phantom   | Lamp drum on the roof, lavender livery    |    96 |                        33 x 22 |
| `loomship`                 | phantom   | Cloth bed and beam drum                   |   104 |                        39 x 29 |
| `avipracticeglider`        | phantom   | Blunt nose behind one bumper block        |    88 |                        30 x 20 |
| `trainee`                  | phantom   | Second canopy                             |   104 |                        37 x 26 |
| `beacontender`             | phantom   | Upright guide beacon on the aft deck      |   120 |                        42 x 36 |
| `courierrunner`            | phantom   | Small courier with one roof lamp          |    80 |                        28 x 19 |

Frames and ids:

- Ids are `craft-{name}-{k}` for heading `k` of 16, and
  `craft-{name}-{k}-a` and `-b` for the five lifeboats and the lamp buoy.
- A craft's frame is square, a multiple of 8 frame px, with the pivot at
  `(0.5, 0.5)`: the middle of the hull's length and height. It fits all 16
  headings with 1 px of margin. Display size is the frame times 0.4375.
- `/art/{folder}/friendly-{name}-sheet.svg`: 16 nested roots four to a row, or
  32 with the A frames first. The folder is the manifest's, except `miner` in
  `cartwheel` and `pip` in `andromeda`, as shipped.

Data files:

- The 21 flying craft each have a `jets` sidecar in the story craft jets
  shape: `/art/{folder}/friendly-{name}-jets.json`, and for
  Phantom's 15 one file keyed by craft, `/art/phantom/friendly-craft-jets.json`.
  Per heading it holds each drive port's `anchor`, `axis` and `half` in frame
  px and that heading's strictly convex `collision` parts; `nose` holds the
  drawn tip and the world distance from the pivot to the point under it. The
  jet ramps are Ada's level one blues.
- The 11 stranded craft are in their galaxy's `tow` link,
  `/art/{galaxy}/friendly-tow.json`:
  per heading the `tow` point at the bow in frame px and the `collision` parts.
  Cartwheel's file holds the tow `line` (`TOW_LINE` in
  [friendly-craft.ts](tools/friendly-craft.ts)), and core's `tow` link names
  it.
- The nose tip and the tow point are the top of the hull's forward-most
  points on the centre line. The lamp buoy's tow point is its float's rim on
  the side it faces.

## Pickup animations

The pickups keep the shipped animations. Each pickup is one row whose nested
root is a strip of its frames, left to right: `width` spans the strip,
`frameWidth` and `frameHeight` are one frame in frame px, `displayWidth` and
`displayHeight` are one frame's display size, and `frames`, `loop` and `climb`
are the shipped rows' fields. The frame and the drawn sizes in the stage 1
table are the rest frame's.

| Pickup            | Strip frames | Animation                                                              | Loop, as shipped                                    |
| ----------------- | -----------: | ---------------------------------------------------------------------- | --------------------------------------------------- |
| `hunt-glint`      |            4 | Twinkle: the crystal turns a quarter facet and back as its tones light | rest 420 ms, glint1 60, glint2 80, glint1 60        |
| `ammo-pack`       |            4 | A glint crosses the crate: top, top and lit side, lit side             | rest 1100 ms, glint1 70, glint2 70, glint3 70       |
| `holodisk`        |            4 | Turn about its upright diameter: face on, 50, 90 and 130 degrees       | rest 600 ms, turn1 70, edge 70, turn2 70            |
| `upgrade-chevron` |            3 | Climbing light: rest, lower chevron lit, upper chevron lit             | `climb`: 900 ms unlit, 120 lit lower, 120 lit upper |

- The twinkle strips' fourth frame repeats glint 1, as the shipped strips do,
  so `loop` indexes frames 0 to 3 unchanged.
- `upgrade-chevron` gains `frames` `rest`, `lower` and `upper`; a `climb`
  step's `lit` names the frame to show, and a step without one shows `rest`.
  The shipped `chevrons` offsets are gone: each frame holds both chevrons.
- The upgrade pickup is two flat chevrons facing the viewer with a clear gap
  between them, each one tone: `#f0bd68` at rest and `#fff2cc` lit. Its
  collision part is the convex hull of the pair.
- The holodisk is a black disc in the ink family (`#3a3448`, `#2a2536`,
  `#181425`) with the pink hologram ring `#e868c8` and a dark hub. The
  waypoint beacon's dish takes the same ramp under its pink lamp. In every
  galaxy the body merges with the ink keyline and the ring carries the read.
- The item icons `icon-holodisk` and `icon-holodisk-20`
  ([shared-resource-svg.ts](tools/shared-resource-svg.ts)) match: a `#2a2536`
  disc with a pink rim in place of the ink outline, so the disc reads on the
  item notice's ink chip, the pink ring and the ink hub. This producer writes
  `icon-holodisk-24`, the 20 px design rasterised at 24 px, as
  `public/art/ui/sprites/icon-holodisk-24.png` with its Aseprite data and
  keeps its UI manifest entry ([Holodisk](holodisk.md#item-icon)).
- `node art/tools/friendly-contact-sheet.ts <dir>` also writes
  `friendly-pickup-loops.svg`: each strip frame by frame at 1x and 4x on the
  lightest field and on Phantom's.

## Stage 4 output: whales

[friendly-whale-models.ts](tools/friendly-whale-models.ts) builds one humpback
at four lengths and [friendly-whales.ts](tools/friendly-whales.ts) draws it: a
rounded twelve-sided body with a broad round head, a pale jaw along the lower
head, one dark blowhole on the crown, a low back hump, a tail stock tapering
into a horizontal notched fluke, and curved flippers swept back along the
flanks. The blowhole marks the head at the two headings that see the whale end
on.

| Kind        | Manifest  | Length, display px | Spots               | Frame | Drawn at heading 0, display px | Footprint radius, world units |
| ----------- | --------- | -----------------: | ------------------- | ----: | -----------------------------: | ----------------------------- |
| `whale`     | core      |                100 | Six, in three pairs |   336 |                       112 x 66 | 51.5 to 58.5                  |
| `adult`     | core      |                 79 | Five, in one row    |   264 |                        89 x 52 | 40.7 to 46.2                  |
| `calf`      | whirlpool |                 43 | Four, in two pairs  |   144 |                        49 x 29 | 22.2 to 25.1                  |
| `youngCalf` | whirlpool |                 36 | Three, in one row   |   120 |                        41 x 25 | 18.5 to 21.1                  |

The loop has 8 frames, in shares of the length:

- The body ahead of the hump stays stiff, so its tones hold still, and heaves
  0.01 against the tail.
- From 0.06 aft of the middle to the fluke's root the rear body and tail stock
  bend up and down by 0.035 at the root, as a wave that travels aft.
- The end of the stock and the fluke turn as one stiff piece about the root,
  along the stock's slope there plus a pitch of 0.15 radians that lags the
  stock. The fluke's tips swing about 0.19 from top to bottom.
- The hump and the spots ride the spine; the flippers and eyes do not move.

Frames, ids and data:

- Ids are `whale-{kind}-{k}-{f}` for heading `k` of 16 and loop frame `f` of
  8, as shipped, with `kind`, `directionIndex` and `loopFrame` on each row.
- A kind's frame is square, a multiple of 8 frame px, and fits every heading
  and loop frame with 1 px of margin. The pivot is `(0.5, 0.5)`, the middle of
  the body on the world plane. Display size is the frame times 0.4375.
- `/art/whales/friendly-{kind}-sheet-{n}.svg`: nine sheets of nested roots.
  A sheet holds as many whole headings of a kind as fit a square 2048 logical
  px on its longest edge, heading by heading with no gutters: Marlo four
  sheets of four headings (2016 x 2016), the adult three of six, six and four
  headings (1848 x 1848 and 1848 x 1320), the calf one (2016 x 1440) and the
  young calf one (2040 x 960). Each row names its sheet in `path`; the data
  file's `headingsPerSheet` gives the same split.
- Coordinates keep one decimal. Against three decimals, one decimal moves the
  99th percentile of frame pixels by 2 levels for Marlo and the adult and by
  3 at the calves' worst headings, at display size; two decimals hold 1 level
  and cost 37% more compressed bytes.
- `/art/friendly-whales.json`, staged as the `whales` link of Whirlpool and
  Phantom, in the shape of the shipped `whales.json`. The loop timings, each
  kind's `stationaryHeading`, `reducedMotion` and the `family` offsets are
  read from the shipped file and unchanged. Per heading it holds the frame,
  the display size, the pivot and `footprintRadius`: the world distance from
  the pivot to the farthest point of the whale's plan over the loop.
- `palette` holds each material's three flat tones and the spot colours;
  `sheets` replaces `files`.

`node art/tools/friendly-whale-sheet.ts <dir> [kind]` writes
`friendly-whale-loop.svg`, one kind's rest pose and 8 loop frames at four
headings, and `friendly-whales.svg`, every kind's 16 headings.

## Manifests

`node art/tools/friendly.ts` writes every friendly row but the whales' into
its manifest with `mergeEntries`, so each row keeps its place, with the
`pickups`, `needleGates` and `tow` links, the craft `jets` sidecars and the
project placements of
[friendly-projects.ts](tools/friendly-projects.ts): the `spareBeacon`,
`channelLights`, `practiceBerth` and `routeExchange` entries of
`public/art/projects.json` and the whole of
`public/art/whirlpool/projects.json` with its `whirlpoolProjects` link. The
salvage beacons stand on the salvagers' yard, so the
[station producer](station-redesign.md) places them. Every row is an
`svgSheet` row whose `width` and `height` are frame px and whose display size
is the frame times 0.4375.

The animated pickups are vector strips in one nested root with `frames` and
`loop` fields; the loader slices an `svgSheet` row that carries `frameWidth`
and `frameHeight` into frames. The upgrade pickup's strip names its lit frames
in `frames` for its `climb`.

## Whale switch

The whale rows and the `whales` link of Whirlpool and Phantom stay staged in
[friendly-rows.json](friendly-rows.json) beside the shipped whale art. Tech
replaces the shipped rows with the staged rows of the same ids, in the
manifest each is staged under. What changes:

- Every heading of a kind shares one square frame with a centre pivot, at
  display scale 0.4375. The shipped rows had a frame and a pivot per heading
  at display scale 1.
- The whales draw larger than the shipped ones and each footprint radius
  grows with them, so spacing tuned to the shipped radii needs a look.
- The sheets are `friendly-{kind}-sheet-{n}.svg`, several headings to a
  sheet, and the data file's
  `palette` and `sheets` fields differ from the shipped `palette` and `files`.
  `src/game/whaleArt.ts` reads `kinds`, `family` and `reducedMotion`, which
  keep their shape; `src/game/whaleArt.test.ts` asserts the shipped sizes.

After the switch the producer writes the whales into their manifests and
`friendly-rows.json` is removed.

## Stages

1. Pickups, caches, landmarks and galaxy beacons, buoys and lamps. Built.
2. Ring gate, true to Gameplay's opening of 66 and the rim of 33, 40 and 7
   world units ([Needle](needle.md#ring-gates)): five axes, lit and dark, back and front layers as closed solids, a
   288 px frame and the gate data file with the new extents. Built.
3. The 32 craft at 16 headings: the yard hull with one role feature each, Elder
   Loom's saucer, Reed's ring ship, the Blocker and the lifeboat pods with
   their galaxy features and blink frames, with jets and nose sidecars. Ids
   stay `craft-{name}-{k}`. Built.
4. The whales (Marlo, adult, calf, young calf) at 16 headings with an 8-frame
   swim loop that bends the tail stock and fluke. Built.
