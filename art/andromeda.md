# Andromeda

Andromeda's art: the settlers' station, the settlements, the guide beacons,
Pip's mail scooter, the two project world changes, the garnet drones and the
portraits of Pip and the settlers.

- Rebuild with `node art/tools/andromeda.ts`. It writes
  `public/art/andromeda/` and replaces its own entries in place in
  [Andromeda's manifest](../public/art/andromeda/manifest.json). Pip's
  `craft-pip-` entries are in the [core manifest](../public/art/manifest.json),
  since the Black Eye finale draws the scooter too; its files stay in
  `public/art/andromeda/`.
- [art/tools/andromeda-models.ts](tools/andromeda-models.ts) holds the solid
  models in the [station](station.md) projection, culling and family: the
  station's closed collar, the settlements' and the courier school's dock
  collars with their mouths, lit floor strips and blue corner lights, and warm
  lit windows `#ffe9b8`.
- Nothing is labelled: no text, signs or letters are drawn on or beside any
  asset.
- The space look adds a [backdrop haze](galaxies.md#backdrop-haze): two soft
  spiral arms round a pale core, fixed to the screen, built by
  `node art/tools/haze.ts` and linked as `backdropHaze`. In the
  [backdrop layers](backdrop.md) the haze is the fixed part of L2, over the
  sky and under everything else. Andromeda's plates are shadow plates only
  (`lighter` false in [its backdrop.json](../public/art/andromeda/backdrop.json)):
  they multiply the haze darker as they pass and never brighten its core, so
  the core stays Andromeda's brightest backdrop tone. A lavender crescent and
  blue-white star clusters complete the sky.

## Sizes and frames

As for [Cartwheel](cartwheel.md#sizes-and-frames): frames are multiples of
16 px with the pivot on the vertical centre line at an exact five-decimal
fraction; each SVG's intrinsic `width` and `height` are its display size
(`frame * 0.4375 * 1.5`, the [destination scale](destinations.md#scale), for every asset here but Pip's
scooter) and its `viewBox` is the frame in frame px. Manifest `width`
and `height` are the frame, so pivots and docks are frame px; `displayWidth`
and `displayHeight` equal the SVG's intrinsic size.

| Asset              | Ids                                                                         | Frame px | Display      | Pivot           |
| ------------------ | --------------------------------------------------------------------------- | -------- | ------------ | --------------- |
| Settlers' station  | `station-settlers-a`, `station-settlers-b`                                  | 144, 160 | 94.5 by 105  | `(0.5, 0.5125)` |
| Hamlet             | `outpost-hamlet-a`, `outpost-hamlet-b`                                      | 80, 80   | 52.5 by 52.5 | `(0.5, 0.4375)` |
| Lamp house         | `outpost-lamphouse-a`, `outpost-lamphouse-b`                                | 64, 80   | 42 by 52.5   | `(0.5, 0.6)`    |
| Guide beacon       | `beacon-guide-lit-{a,b}`, `beacon-guide-dented`, `beacon-guide-relit-{a,b}` | 48, 64   | 31.5 by 42   | `(0.5, 0.75)`   |
| Pip's mail scooter | `craft-pip-{0..15}`                                                         | 80       | 35           | `(0.5, 0.5)`    |
| Courier school     | `station-settlers-school-a`, `-b`                                           | 64, 96   | 42 by 63     | `(0.5, 0.3125)` |
| Spare beacon       | `beacon-guide-spare-a`, `-b`                                                | 48, 64   | 31.5 by 42   | `(0.5, 0.625)`  |

## Settlers' station

Every Andromeda station is a settlers' station: Tech draws
`station-settlers-a` and `-b` in place of the trading station's `station-a`
and `-b` for every station in Andromeda, with the trading station's shop and
blink. Ada enters it by Use, so it has no `dock`. Entries carry `station`
`settlers`.

A lantern station on a pearl deck 104 units across (2.4 Ada wingspans):

- Pearl deck `#e4e2ef` (sides `#a9a6c2`) with a lighter inset top `#d6d3e6`
  and warm rim lamps on the facing rim.
- Six cottages around the deck, clear of the arm: cream walls `#efe4cf`
  (sides `#bfae94`) with warm windows and two-step slate-blue roofs `#8d94c4`
  (sides `#5f6594`).
- A striped lighthouse at the centre: a pearl tower with two marker-dark bands
  `#6f78b8` (sides `#4a5080`), a cream gallery, the marker lantern `#b8c1ff`
  with a white core, a slate-blue cap and a mast with the blue beacon.
- A cream post depot with a periwinkle sign band, and two slate tanks
  `#8d9bb0` behind.
- The family arm toward the viewer ending in a closed cream collar with two
  warm windows, as on the trading station.

### Blink

`facing` `fixed`, `frameMs` 700. Frame A lights the mast beacon, the rim lamps
and the collar windows, and the lantern shows `#b8c1ff` with its white core;
frame B shows the beacon unlit `#3f5878`, dims the lantern to `#8f9cf0` and
the rim lamps and collar windows to `#a08f78`. Reduced motion shows frame A.

## Settlements

The settlements are Andromeda's outposts, used like Sunflower's: Ada uses one
without docking, so their docks are decorative. Entries use the
[outpost schema](outposts.md#frames-and-manifest) with `outpost`
`settlement` and `variant` naming the design, `hamlet` or `lamphouse`; Tech
assigns a design to each settlement. Fixed orientation, the station blink
(`frameMs` 700) and reduced motion as on the station.

- Hamlet: a round pearl float 52 units across with three cottages, a slate
  lamp post with a marker lamp and a small dock collar.
- Lamp house: a pearl float 44 units across with a tall cream house under a
  rooftop marker lantern, a shed, a slate mailbox post with a periwinkle box
  and a small dock collar.
- Frame A lights the dock corner lights and the marker lamps; frame B dims the
  corner lights to `#3f5878` and the lamps to `#4a5080`.

| Variant     | Dock `(x, y)`  | Dock width | Below the pivot |
| ----------- | -------------- | ---------: | --------------: |
| `hamlet`    | `(40, 59.042)` |     22.045 |          24.042 |
| `lamphouse` | `(32, 69.213)` |     19.596 |          21.213 |

Dock values are frame px with `outward` `[0, 1]`, in the outposts' dock
schema.

## Guide beacons

The chain of guide beacons ships follow between the settlements. They are
story objects, separate from the galaxy's beacon landmarks: the dark beacon is
a story place, and the rest of the chain is scenery. Entries carry `beacon`
`guide` and `state`; there is no dock, and the pivot is the float's centre on
the world plane. Every state shares one frame and pivot, so a state change
swaps the sprite in place.

- A pearl float with three fins, a banded pearl tower (marker-dark band
  `#6f78b8`), a cream gallery, an eight-sided lantern and a slate-blue cap.
  About 33 units across the fins and 41 tall: larger than Sunflower's salvage
  beacons (13.125 by 26.25 display px).
- `lit` (`beacon-guide-lit-a`, `-b`): the chain. Frame A shows the lantern
  `#b8c1ff` with a white core, frame B `#8f9cf0`. Neighbouring beacons in a
  chain blink opposite: the n-th beacon along the chain shows frame A while
  its neighbours show B.
- `dented` (`beacon-guide-dented`): the dark beacon before it is relit, one
  frame with no `frameMs`. The lantern is dark glass `#2a2d48`; the head is
  knocked askew toward screen right, the front of the gallery is caved in,
  and a crease `#7d7a9c` and a scrape `#cfcde0` mark the tower. It is dented,
  not shot: no scorch, breach or ember.
- `relit` (`beacon-guide-relit-a`, `-b`): the dark beacon once relit,
  straight again with a cream patch plate over the crease, blinking as `lit`.
- Reduced motion shows frame A of a blinking beacon.

## Pip's mail scooter

Pip's courier ship: a non-hostile story craft in the
[Cartwheel story craft](cartwheel.md#story-craft) contract. Shots pass through
it, drones ignore it and it has no hit circle.

- 16 headings in 22.5 degree world steps, as the [enemies](enemies.md):
  heading `k` faces world angle `k * 22.5` degrees and local forward is
  negative Y. Square transparent frames with the pivot at the centre; render
  the selected frame with rotation zero. No blink and no thrust frames.
- Entries carry `craft` `pip`, `directionIndex` and `facing` `world-{k}`; ids
  are `craft-pip-{k}`.
- A short cream capsule (`#efe4cf`, sides `#bfae94`, rear `#a08f78`) with a
  warm-lit cab, two periwinkle mail panniers `#8f9cf0` (sides `#6f78b8`, rear
  `#4a5080`) with cream flaps, a tail fin carrying the marker courier lamp
  `#b8c1ff`, twin small graphite engines `#6e7482` and two warm headlights.
  35 by 23 model units: 0.82 by 0.54 Ada wingspans, about the size of
  Cartwheel's visitors, and nothing like Ada's white triangle.
- Groups draw far to near; a group resting on the hull top (10) or the cab top
  (14) draws after every group below that level.

### Speed jets and nose

`pip-jets.json` uses the [enemy speed jets](enemies.md#speed-jets) schema
(version 1, outer and core layers, no halo, length
`(6 + 24 f²) * sqrt(frame / 96)`) in the civil story-craft palette shared
with Cartwheel's story craft: outer `#c9a978` to `#ffe9b8` and core `#efe4cf`
to `#ffffff`. Two mouths 3 units wide at `(u, v, z)` `(-19, ±4, 6.5)`, u
forward.

The file also carries `nose`: 16 entries, `nose[k]` for heading `k`. The nose
reaches to the forward-most solid part; the 0.6-deep window panes do not count.

- `distance`: world units from the pivot to the point under the nose on the
  centre line. The generator projects that point the art's way at display
  scale (0.4375) and inverts the game's projection `(x - y, (x + y) / 2)`, so
  it depends on heading `k` at angle `a = k * 22.5` degrees:
  `0.4375 * reach * sqrt(7/8 + sin(2a) / 8)`.
- `tip`: `[x, y]` in frame px, the drawn tip projected like the frames: the
  midpoint of the forward-most top edge nearest the centre line. The generator
  fails unless it lies within 0.5 frame px of an edge of a face the heading's
  frame draws.

The scooter's reach is 16 units, to the hull nose: `distance` is 7 at headings
2 and 10, 6.548 at 0, 4, 8 and 12, and 6.062 at 6 and 14. A docked scooter
holds with its pivot on the dock or berth point moved along `outward` by
`nose[k].distance` for its docking heading `k`, so the nose meets the dock
face.

## World changes

Both of Andromeda's [community projects](projects.md#world-changes) are
overlays: every part sits beside its base, so the base frames stay unchanged
and drawing the overlay before the base gives the same pixels as one depth
sort of both. The generator fails if any overlay face, placed at its site,
overlaps a base face on screen. Each overlay's pivot is its own site on the
world plane, and `projects.json` places it with one anchor, `layer` `behind`
(both sites are farther from the viewer than the base pivot) and `phase` 0,
blinking on the base's clock. Reduced motion holds frame A.

| Project         | Base                                                      | Anchor `(x, y)`       | Entries                                                                      |
| --------------- | --------------------------------------------------------- | --------------------- | ---------------------------------------------------------------------------- |
| `courierSchool` | Every settlers' station (`station` `settlers`)            | `(-123.033, -19.033)` | `station-settlers-school-a`, `-b`: `overlay`, `station`, `project`, `berths` |
| `spareBeacon`   | The relit dark beacon (`beacon` `guide`, `state` `relit`) | `(-55.426, -2)`       | `beacon-guide-spare-a`, `-b`: `overlay`, `beacon`, `project`                 |

### Courier school

A small training dock beside the station at the screen left, its pad centre
104 units from the station pivot at plan angle 150 degrees: a pearl training
pad with a classroom cottage, a short pier toward the viewer ending in a
narrow cream collar with its own mouth and corner lights, and a slalom of four
slate buoys whose lamps alternate warm `#ffe9b8` and marker `#b8c1ff` (frame A
lights the first and third, frame B the second and fourth in `#4a5080` off).

- `berths` adds the pier's mouth in the dock schema, frame px of the overlay:
  `(27.101, 51.213)`, outward `[0, 1]`, width 19.596. A craft docks there
  moving opposite `outward`, held off the face by its nose distance.

### Spare beacon

A spare guide beacon held upright in a slate cradle on a small pad, its site
34 units left and 30 back of the relit beacon (screen left, just behind it).
Its lantern is on standby, a steady dim `#6f78b8` in both frames, and a blue
standby light on the pad blinks: `#70ace8` in frame A, `#3f5878` in B.

## Garnet drones

Andromeda's drones and heavies are one family: the four sector one drones,
the frigate and the capital recoloured into garnet, Gadget's drones hunting in
the open. Sunflower keeps the coral originals and Cartwheel the
[claim jumpers](heavies.md#cartwheel-claim-jumpers).

- Rebuild with `node art/tools/garnet-drones.ts`, which takes the same
  `--offsets <file.json>` as `heavies.ts`. It draws the shared models in
  process, writes `public/art/andromeda/enemies/` and replaces its own entries
  in place in Andromeda's manifest, after the destinations and before the
  story craft.
- Models, parts, frames, headings, hardpoints, anchors and muzzles match the
  coral family; only fills change. Every SVG and shards file goes through the
  colour swap below, every jets file through the garnet jet colours, and the
  tool stops on any colour outside the family. Hardpoints files are the coral
  family's, unchanged; destruction uses the shared `destruction.json` timing
  and flash with the garnet shards.
- File names are the coral names in `public/art/andromeda/enemies/`. Ids are
  the coral ids with `enemy-garnet-` in place of `enemy-`, such as
  `enemy-garnet-frigate-3` and `enemy-garnet-capital-turret-top-9`. Each entry
  has the coral entry's fields, its own `path`, the coral `archetype` and
  `family` `garnet`. No garnet id matches `enemy-{archetype}-{index}`, so the
  coral heading sets stay complete.

Contrast is WCAG against Andromeda's field `#232641`.

| Role                   | Coral                           | Garnet    | Contrast |
| ---------------------- | ------------------------------- | --------- | -------: |
| Hull top               | `#d68b72`                       | `#e47485` |   5.01:1 |
| Hull side              | `#a8654f`                       | `#b0495b` |   2.77:1 |
| Hull rear              | `#7f4b3d`                       | `#823643` |   1.79:1 |
| Plates                 | `#e6a890`                       | `#deb7b6` |   8.11:1 |
| Turret top             | `#c27a62`                       | `#c65c6d` |   3.62:1 |
| Scorch top             | `#5c3a31`                       | `#583237` |   1.35:1 |
| Scorch side            | `#42291f`                       | `#3f2125` |   1.02:1 |
| Burn (deck paint)      | `#6e4436`                       | `#6b3a41` |   1.62:1 |
| Guns, lights, disc     | `#f0bd68`                       | unchanged |   8.55:1 |
| Visor, claw ink, ember | `#2a2433`, `#181425`, `#f0a07c` | unchanged |          |

Garnet is Oklab hue 12: 27 degrees from coral, 38 from claim rust and 34 from
the holodisk magenta `#E868C8`, at a higher chroma than coral. The hull top
keeps the space palette's 5:1. Claw ink is 6.12:1 on the garnet hull; scorch
is 3.70:1 on it, so deck wrecks read; the wreck ember is 5.20:1 on garnet
scorch and 7.03:1 on the field.

Speed jets ramp slow to fast, in place of Gadget's jet colours:

| Layer | Gadget                 | Garnet                 | Contrast, slow and fast |
| ----- | ---------------------- | ---------------------- | ----------------------: |
| Outer | `#b8644c` to `#f0a07c` | `#c1445c` to `#fb8898` |          2.98:1, 6.37:1 |
| Core  | `#d68b72` to `#ffe2c8` | `#e47485` to `#ffe0e0` |         5.01:1, 11.92:1 |

## Portraits

Andromeda's conversation and storybook portraits, drawn as Munix, Andromeda's
androids, in the chibi bust style of the set: Pip, Wick (the story's settler,
on the `settler` sheet), the settlements' greeter and the station keepers. Rebuild with
`node art/tools/andromeda-portraits.ts`; it writes
`public/art/andromeda/portraits/` and replaces its own entries at the end of
Andromeda's manifest. Sizes, frames, the frame and face colours and the
integer nearest-neighbour scale follow
[Conversation portraits](conversation.md).

| Manifest id                | Sheet                   | Frames                              |
| -------------------------- | ----------------------- | ----------------------------------- |
| `pip-portrait`             | `pip.png`, 96 by 32     | `happy` 0, `neutral` 1, `worried` 2 |
| `pip-portrait-compact`     | `pip-compact.png`       | The same, 22 px, displayed at 44    |
| `settler-portrait`         | `settler.png`, 96 by 32 | `happy` 0, `neutral` 1, `worried` 2 |
| `settler-portrait-compact` | `settler-compact.png`   | The same, 22 px, displayed at 44    |
| `settler-greeter-portrait` | `settler-greeter.png`   | `neutral` 0                         |
| `lumen-portrait`           | `lumen.png`             | `neutral` 0                         |
| `dial-portrait`            | `dial.png`              | `neutral` 0                         |
| `cog-portrait`             | `cog.png`               | `neutral` 0                         |

- A Munix: a pearl dome `#e9e3da` (shade `#b3aba1`, light `#ffffff`) with a
  seam over the crown, periwinkle ear discs, a metal neck `#8b9bb4` and a
  beacon antenna, its ball lit `#fee761`. The face is a dark screen `#232845`
  with LED eyes and mouth `#8ff3ff`.
- Moods show on the screen: `happy` LED arcs, a smile and pink cheek LEDs
  `#f6757a`; `neutral` tall LED eyes and a short line; `worried` slanted LED
  brows, a wobbling mouth and the set's sweat drop.
- Pip: a young courier under a periwinkle cap `#8f9cf0` (brim and shade
  `#5b6093`) with a white badge and the antenna through it, a periwinkle jacket
  with a panel seam and a tan satchel strap `#e4a672` with an amber buckle.
- Wick, on the `settler` sheet: a brimmed hat `#b86f50` with a periwinkle band,
  a brown coat `#c28569`, a pearl collar and a periwinkle tie `#5b6093`.
- The settlements' greeter (tab "Settler"), every settler but Wick: a rose
  bobble hat `#f2a7c6` (shade `#c46f98`) with a white pompom and the antenna
  through it, and a rose sweater with a periwinkle stripe and a pearl collar.
- The station keepers, each with the keepers' mic boom: Lumen, a lantern
  antenna lit `#fee761` and warm `#ffe9a0` LEDs on a periwinkle body; Dial, a
  periwinkle shell `#b9c2f7`, big pearl dial ears, twin lit antennae and a
  pearl body; Cog, a silver shell `#c0cbdc`, a cog crown round a lit hub, green
  `#9ff7a0` LEDs and a deep periwinkle body.
- Each `-compact` sheet is the exact 22 by 22 crop of its 32 frames: Pip, Wick
  and Dial at (5, 2), the greeter, Lumen and Cog at (5, 1), from the antenna
  ball or crown to the chin.

## Palette

Contrast is WCAG against Andromeda's field background `#232641`; the table
lists top colours, which carry each silhouette. The dark beacon's glass reads
against its pearl tower and cream gallery, not the field.

| Asset   | Role                | Colour    | Contrast |
| ------- | ------------------- | --------- | -------: |
| Station | Pearl structure     | `#e4e2ef` |  11.53:1 |
| Station | Pearl side          | `#a9a6c2` |   6.26:1 |
| Station | Cream walls, collar | `#efe4cf` |  11.70:1 |
| Station | Slate-blue roofs    | `#8d94c4` |   5.03:1 |
| Station | Lighthouse band     | `#6f78b8` |   3.55:1 |
| Station | Lantern, frame A    | `#b8c1ff` |   8.50:1 |
| Station | Lantern, frame B    | `#8f9cf0` |   5.74:1 |
| Station | Tanks               | `#8d9bb0` |   5.23:1 |
| Beacons | Lantern, frame A    | `#b8c1ff` |   8.50:1 |
| Beacons | Lantern, frame B    | `#8f9cf0` |   5.74:1 |
| Beacons | Dark glass          | `#2a2d48` |   1.10:1 |
| Beacons | Dent crease         | `#7d7a9c` |   3.60:1 |
| Beacons | Scrape              | `#cfcde0` |   9.45:1 |
| Pip     | Cream hull          | `#efe4cf` |  11.70:1 |
| Pip     | Periwinkle panniers | `#8f9cf0` |   5.74:1 |
| Pip     | Courier lamp        | `#b8c1ff` |   8.50:1 |
| Pip     | Engines             | `#6e7482` |   3.15:1 |
| Pip     | Jet outer, fast     | `#ffe9b8` |  12.35:1 |
| All     | Warm windows        | `#ffe9b8` |  12.35:1 |
| All     | Blue lights         | `#70ace8` |   6.14:1 |

The lantern takes the galaxy's marker `#b8c1ff`
([Markers](galaxies.md#markers)), the field's own hue at Oklab L 0.83, so
Andromeda's lights read as its own; it sits 1.17:1 from the
`pointOfInterest` lavender.
