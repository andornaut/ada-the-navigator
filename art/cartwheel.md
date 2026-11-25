# Cartwheel hub and story craft

- `node art/tools/stations.ts` draws the hub with its docking bay
  ([Station redesign](station-redesign.md)), and `node art/tools/friendly.ts`
  the mooring buoy and the story craft
  ([Friendly object redesign](friendly-redesign.md)), into
  [Cartwheel's manifest](../public/art/cartwheel/manifest.json). The miner's
  `craft-miner-` entries are in the [core manifest](../public/art/manifest.json),
  since the Phantom finale draws it too; their files stay in
  `public/art/cartwheel/`.
- [art/tools/solid.ts](tools/solid.ts) holds the station family's solid-model
  helpers, shared with the [station](station.md) and the
  [outposts](outposts.md). Craft use the [enemy](enemies.md) heading convention
  and speed jets schema from [art/tools/crafts.ts](tools/crafts.ts).
- Nothing is labelled: no text, signs or letters are drawn on or beside any
  asset.
- Cartwheel's hostile craft, the claim jumpers and the turret platform, follow
  the [heavies](heavies.md#cartwheel-claim-jumpers) contract.

## Sizes and frames

- Geometry is built at its intended size. Structure is about 1.55 times the
  outposts' proportions on the hub and 1.45 on the buoy; window panes, lamps,
  beacons, dock collar depth, corner lights and approach lights keep the
  outposts' sizes. The miner and the visitors are modelled in design units and
  built whole at 1.3 and 1.45 times, lamps and panes included.
- Frames are multiples of 16 px. Each SVG's intrinsic `width` and `height` are
  its display size (`frame * 0.4375`, times 1.25 for the hub and its changes,
  the hub scale in [Destinations](destinations.md#scale)) and its `viewBox` is the frame
  in frame px. Tech rasterizes at the on-screen device size
  ([Layout](layout.md#coordinates-and-scale)).
- Manifest `width` and `height` are the frame (the `viewBox`), so pivots, docks,
  berths, moorings and jets are frame px, as for the station and the outposts.
  `displayWidth` and `displayHeight` equal the SVG's intrinsic size.

| Asset       | Ids                                                | Frame px | Display       | Pivot            |
| ----------- | -------------------------------------------------- | -------- | ------------- | ---------------- |
| Hub, worn   | `outpost-hub-a`, `outpost-hub-b`                   | 304, 320 | 166.25 by 175 | `(0.5, 0.5625)`  |
| Hub repairs | `outpost-hub-repaired-a`, `-b`                     | 304, 320 | 166.25 by 175 | `(0.5, 0.5625)`  |
| Second bay  | `outpost-hub-bay-a`, `-b` (overlay)                | 304, 320 | 166.25 by 175 | `(0.5, 0.5625)`  |
| Buoy        | `mooring-buoy-a`, `mooring-buoy-b`                 | 96, 96   | 42 by 42      | `(0.5, 0.65625)` |
| Miner       | `craft-miner-{0..15}`                              | 128      | 56            | `(0.5, 0.5)`     |
| Visitors    | `craft-visitor1-{0..15}`, `craft-visitor2-{0..15}` | 80       | 35            | `(0.5, 0.5)`     |
| Blocker     | `craft-blocker-{0..15}`                            | 96       | 42            | `(0.5, 0.5)`     |

## Hub

A teal and slate mining hub with a centered face and matching rectangular
side housings. The face has a concentric bezel around a rectangular plate and
a horizontal light strip. Each side housing repeats the same pair of square
lights. The lower contact plate carries the two recessed story-craft berths.
Ada enters the hub by Use.

- Fixed orientation in the station schema: `facing` `fixed`, `frameMs` 700.
  Windows and berth guide lights alternate with the station blink. Reduced
  motion shows A.
- The pivot is the deck centre on the world plane. Entries carry
  `destination` `hub` and `variant` (`worn` or `repaired`), not `outpost`, so
  the sector one outpost reader does not pick them up.
- `berths` lists the free berths left then right on screen, each in the dock
  schema with its own outward screen direction: `(53.374, 220.72)` outward
  `[-0.924, 0.382]` and `(250.626, 220.72)` outward `[0.924, 0.382]`, width
  28.169. A craft docks moving opposite `outward`.
- A docked craft holds just outside its berth: its pivot sits on the berth
  point moved along `outward` by the craft's
  [`nose[k].distance`](#nose) for its docking heading `k`, so the nose meets
  the berth's face and the pier stays visible. The same rule holds at the
  second bay's berth.

### Worn and repaired

The hub looks worn but working until the Hub repairs project is funded.

Restoring the hub lights the repaired panel and more of the guide lights.
Both states retain the same frame, pivot and recessed berth mouths.

## World changes

Both project changes keep the hub's frame, pivot and berths.

- Hub repairs (`project` `hub-repairs`): a replacement pair. Draw
  `outpost-hub-repaired-a` and `-b` in place of `outpost-hub-a` and `-b`.
- Second docking bay (`project` `second-docking-bay`): an overlay pair. Draw
  `outpost-hub-bay-a` over the current hub frame A and `-b` over B, at the hub's
  position with the same pivot, over either the worn or the repaired hub. The
  overlay is a small guide slit in the forward hull plate. The third story
  craft meets the hull at this point.
- The overlay entry has `overlay` `true` and `berths` with the forward
  attachment at `(140, 239.571)`, outward `[-0.612, 0.791]`, width 36.742.
  Its offset from the frame pivot is `(-12, 59.571)` frame px. In the
  story's 240 px reference frame it is `(108, 194.571)`.

### Placement anchors

Both changes anchor on the hub destination's own position: the hub pivot, offset
`(0, 0)`. Keys for the projects file:

| Key           | Hub repairs                    | Second docking bay                 |
| ------------- | ------------------------------ | ---------------------------------- |
| `id`          | `hub-repairs`                  | `second-docking-bay`               |
| `galaxy`      | `cartwheel`                    | `cartwheel`                        |
| `destination` | `hub`                          | `hub`                              |
| `change`      | `replace`                      | `overlay`                          |
| `frames`      | `outpost-hub-repaired-a`, `-b` | `outpost-hub-bay-a`, `-b`          |
| `replaces`    | `outpost-hub-a`, `-b`          | none                               |
| `anchor`      | `pivot`, offset `(0, 0)`       | `pivot`, offset `(0, 0)`           |
| `adds`        | none                           | one berth (the overlay's `berths`) |

## Mooring buoy

A static prop where the story craft hold between scenes: a cream buoy with a
stepped top, a beacon, a decorative dock collar and three mooring arms ending in
cream eyes with blue lamps.

- `facing` `fixed`, `frameMs` 700. A lights the beacon, the dock corner lights
  and the left and back eyes; B lights the right eye and dims the rest.
- `moorings` lists the arm tips on the world plane in frame px with each arm's
  outward screen direction: left `(10.033, 63)` `[-1, 0]`, right
  `(85.967, 63)` `[1, 0]`, back `(61.019, 42.409)` `[0.534, -0.845]`.
  These tips keep their world offsets from the pivot as the core grows.

## Story craft

Non-hostile small craft that fly short scripted paths near the hub. Shots pass
through them, so they have no hit circle.

- 16 headings in 22.5 degree world steps, as the [enemies](enemies.md):
  heading `k` faces world angle `k * 22.5` degrees and local forward is
  negative Y. Square transparent frames with the pivot at the centre; render the
  selected frame with rotation zero. No blink and no thrust frames.
- Entries carry `craft` (the craft name), `directionIndex` and `facing`
  `world-{k}`. Ids match `^craft-([a-z][a-z0-9]*)-(\d+)$`.
- Groups draw far to near, and a group resting on the hull or cab top draws
  after every group below that level.

| Craft      | Length, span (model units) | Shape                                                                                                        |
| ---------- | -------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `miner`    | 93, 49.9                   | Tri-hull ore hauler: drill-nosed sand keel with a forward cab between two outrigger hulls with open ore bins |
| `visitor1` | 43.5, 22.6                 | Sage loaf shuttle: rounded passenger body, warm window band, roof cupola, corner engines, no wings           |
| `visitor2` | 43.5, 22.6                 | The same shuttle in periwinkle                                                                               |
| `blocker`  | 53, 38.6                   | Chartreuse wedge, oversized graphite engine pods, a wide ram bar, high beams                                 |

Ada's wingspan is 42.88 model units. The blocking pilot reads as pushy (a loud
hot rod with a ram bar and white high beams) without Admiral Archie's coral,
forward pincers, dark visor or insignia. Its chartreuse stays clear of the
holodisk magenta `#E868C8`, the coral drones and the
[claim jumpers](heavies.md#cartwheel-claim-jumpers)' rust and ember.

### Speed jets

`{craft}-jets.json` beside the frames (`visitor2` uses `visitor1-jets.json`,
the same shuttle's) uses the [enemy speed jets](enemies.md#speed-jets)
schema (version 1, outer and core layers, no halo, length
`(6 + 24 f²) * sqrt(frame / 96)`) in one civil palette for every story craft:
outer `#c9a978` to `#ffe9b8` and core `#efe4cf` to `#ffffff`.

| Craft      | Mouths | Mouth width | Mouth (u, v, z), u forward                  |
| ---------- | -----: | ----------: | ------------------------------------------- |
| `miner`    |      3 |        5.72 | `(-45.76, 0, 7.8)`, `(-39.26, ±19.5, 6.24)` |
| `visitor1` |      2 |        4.64 | `(-22.91, ±7.83, 7.54)`                     |
| `visitor2` |      2 |        4.64 | `(-22.91, ±7.83, 7.54)`                     |
| `blocker`  |      2 |           6 | `(-26, ±15, 7)`                             |

### Nose

`{craft}-jets.json` also carries `nose`: 16 entries, `nose[k]` for heading `k`,
from [art/tools/nose.ts](tools/nose.ts), shared with every story craft.
The nose reaches to the forward-most solid part (hull, wing, pod, ram bar or
lamp); the 0.6-deep window panes on the walls do not count.

- `distance`: world units from the pivot to the point under the nose on the
  centre line. The generator projects that point the art's way at display
  scale (0.4375) and inverts the game's projection `(x - y, (x + y) / 2)`, as
  for the [asteroid footprints](asteroids.md#footprint). The two projections
  differ in aspect, so it depends on heading `k` at angle `a = k * 22.5`
  degrees: `0.4375 * reach * sqrt(7/8 + sin(2a) / 8)`, from 0.866 to 1 times
  `0.4375 * reach`.
- `tip`: `[x, y]` in frame px, the drawn tip projected like the frames: the
  midpoint of the forward-most top edge nearest the centre line. The generator
  fails unless it lies within 0.5 frame px of an edge of a face the heading's
  frame draws.

| Craft      | Reach (u) | Forward-most part         | `distance` at 2, 10 | At 0, 4, 8, 12 | At 6, 14 |
| ---------- | --------: | ------------------------- | ------------------: | -------------: | -------: |
| `miner`    |     47.45 | Drill tip                 |              20.759 |         19.419 |   17.978 |
| `visitor1` |    21.025 | Hull nose                 |               9.198 |          8.604 |    7.966 |
| `visitor2` |    21.025 | Hull nose                 |               9.198 |          8.604 |    7.966 |
| `blocker`  |        27 | High beams (tip: v = -13) |              11.813 |          11.05 |    10.23 |

## Palettes

Ore on the hub, the miner's bins, the stranded hauler's bins and the ore pod's
band takes ore's solid tones (`ORE_SOLID` in `art/tools/ore.ts`): lit tops
`#e798cd`, tops and bands `#d481b9`, sides `#a56490` and the unlit band
`#774667`, so everything that means ore reads as the
[ore nugget](cartwheel-props.md#ore-nugget).

Contrast is WCAG against Cartwheel's field background `#BC9D90`, a light field;
the table lists top colours. The hub takes the 2 px ink
[light-field keyline](galaxies.md#light-fields), 7.18:1 on the field, which
carries its silhouette. The mooring buoy (`mooringBuoy`) and the story craft
(`storyCraft`, their jets included) take the 1 px keyline.

| Asset     | Role                 | Colour    |   Fill | Keyline |
| --------- | -------------------- | --------- | -----: | ------: |
| Hub, buoy | Cream structure      | `#efe4cf` | 1.99:1 |  7.18:1 |
| Hub       | Slate tower, collars | `#9aaccb` | 1.09:1 |  7.18:1 |
| Hub       | Slate cap            | `#c3cfe2` | 1.60:1 |  7.18:1 |
| Hub       | Ore, lit tops        | `#e798cd` | 1.17:1 |  7.18:1 |
| Hub       | Ore tops, bands      | `#d481b9` | 1.09:1 |  7.18:1 |
| Hub       | Worn patch plate     | `#b3a68a` | 1.04:1 |  7.18:1 |
| Hub       | Worn rust streak     | `#9a5f48` | 2.04:1 |  7.18:1 |
| Hub       | Worn scorch          | `#a39784` | 1.14:1 |  7.18:1 |
| All       | Blue lights          | `#70ace8` | 1.05:1 |  7.18:1 |
| All       | Warm windows         | `#ffe9b8` | 2.10:1 |  7.18:1 |
| Miner     | Sand hull            | `#dcc49a` | 1.48:1 |  7.18:1 |
| Miner     | Bins, beams, engines | `#6e7482` | 1.87:1 |  7.18:1 |
| Miner     | Drill                | `#b8bfc9` | 1.36:1 |  7.18:1 |
| Visitor 1 | Sage hull            | `#a7c49a` | 1.32:1 |  7.18:1 |
| Visitor 2 | Periwinkle hull      | `#aab0e6` | 1.20:1 |  7.18:1 |
| Blocker   | Chartreuse hull      | `#b6dd30` | 1.60:1 |  7.18:1 |
| Blocker   | Graphite pods, ram   | `#7d7a92` | 1.65:1 |  7.18:1 |
| Blocker   | High beams           | `#fffbea` | 2.42:1 |  7.18:1 |

Sides use the darker partner of each top: slate `#6a7c9e`, sand `#a8916a`
(rear `#8a7656`), sage `#728f66` (rear `#5a7351`), periwinkle `#7379b4` (rear
`#5b6093`), chartreuse `#84a41e` (rear `#617c18`), graphite `#5e5b72`. No craft is
coral, amber or Ada's blue.
