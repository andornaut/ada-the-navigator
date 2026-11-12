# Cartwheel hub and story craft

- Rebuild with `node art/tools/cartwheel.ts`. It writes `public/art/cartwheel/`
  and replaces its own entries in place in
  [Cartwheel's manifest](../public/art/cartwheel/manifest.json): the hub and
  the mooring buoy open it; the story craft follow the claim jumpers. The
  miner's `craft-miner-` entries are in the
  [core manifest](../public/art/manifest.json), since the Black Eye finale
  draws it too; their files stay in `public/art/cartwheel/`.
- `node art/tools/cartwheel.ts --alternates <dir>` also writes the unused
  designs (the pale cream visitor `visitor3` and the plough blocker
  `blocker-plough`) with their entries to `<dir>`, outside `public/art/`.
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
  outposts' proportions on the hub, 1.5 on the miner and 1.45 on the visitors
  and the buoy; window panes, lamps, beacons, dock collar depth, corner lights
  and approach lights keep the outposts' sizes.
- Frames are multiples of 16 px. Each SVG's intrinsic `width` and `height` are
  its display size (`frame * 0.4375`, whole px) and its `viewBox` is the frame
  in frame px. Tech rasterizes at the on-screen device size
  ([Layout](layout.md#coordinates-and-scale)).
- Manifest `width` and `height` are the frame (the `viewBox`), so pivots, docks,
  berths, moorings and jets are frame px, as for the station and the outposts.
  `displayWidth` and `displayHeight` equal the SVG's intrinsic size.

| Asset       | Ids                                                | Frame px | Display    | Pivot           |
| ----------- | -------------------------------------------------- | -------- | ---------- | --------------- |
| Hub, worn   | `outpost-hub-a`, `outpost-hub-b`                   | 240, 240 | 105 by 105 | `(0.5, 0.5625)` |
| Hub repairs | `outpost-hub-repaired-a`, `-b`                     | 240, 240 | 105 by 105 | `(0.5, 0.5625)` |
| Second bay  | `outpost-hub-bay-a`, `-b` (overlay)                | 240, 240 | 105 by 105 | `(0.5, 0.5625)` |
| Buoy        | `mooring-buoy-a`, `mooring-buoy-b`                 | 96, 80   | 42 by 35   | `(0.5, 0.5625)` |
| Miner       | `craft-miner-{0..15}`                              | 128      | 56         | `(0.5, 0.5)`    |
| Visitors    | `craft-visitor1-{0..15}`, `craft-visitor2-{0..15}` | 80       | 35         | `(0.5, 0.5)`    |
| Blocker     | `craft-blocker-{0..15}`                            | 96       | 42         | `(0.5, 0.5)`    |

## Hub

A slate collection tower with an open ore hopper on a round cream deck, two
banded silos behind and three docking piers fanned toward the viewer: the live
dock facing screen-down and a free berth on each side.

- Fixed orientation in the station schema: `facing` `fixed`, `frameMs` 700,
  `dock` and the station's blink (A lights the dock corner lights and the mast
  beacon, B the approach lights; unlit blue `#3f5878`). Reduced motion shows A.
- The pivot is the deck centre on the world plane. Entries carry
  `destination` `hub` and `variant` (`worn` or `repaired`), not `outpost`, so
  the sector one outpost reader does not pick them up.
- `dock` is the live dock: `(120, 216.317)`, width 48.99, outward `[0, 1]`.
- `berths` lists the free berths left then right on screen, each in the dock
  schema with its own outward screen direction: `(21.374, 175.72)` outward
  `[-0.924, 0.382]` and `(218.626, 175.72)` outward `[0.924, 0.382]`, width
  28.169. A craft docks moving opposite `outward`.
- A docked craft holds just outside its dock: its pivot sits on the dock or
  berth point moved along `outward` by the craft's
  [`nose[k].distance`](#nose) for its docking heading `k`, so the nose meets
  the dock face and the pier stays visible. The same rule holds at the second
  bay's berth.

### Worn and repaired

The hub looks worn but working until the Hub repairs project is funded.

| Detail      | Worn (`outpost-hub-a`, `-b`)                              | Repaired (`outpost-hub-repaired-a`, `-b`)               |
| ----------- | --------------------------------------------------------- | ------------------------------------------------------- |
| Hopper cap  | Two front segments broken to dark stubs, notching the rim | Whole cap ring                                          |
| Tower       | Half the windows dark; tan patch plates; rust streaks     | Every window lit; ore teal band under the cap, lit in A |
| Deck        | Three scorched plates on the deck top; one patched wall   | Eight blue rim lights alternating with the blink        |
| Right berth | Corner lights out in both frames                          | Corner lights blink with the others                     |
| Ore crates  | One crate knocked flat                                    | Both upright with ore tops                              |

## World changes

Both project changes keep the hub's frame, pivot, live dock and berths.

- Hub repairs (`project` `hub-repairs`): a replacement pair. Draw
  `outpost-hub-repaired-a` and `-b` in place of `outpost-hub-a` and `-b`.
- Second docking bay (`project` `second-docking-bay`): an overlay pair. Draw
  `outpost-hub-bay-a` over the current hub frame A and `-b` over B, at the hub's
  position with the same pivot, over either the worn or the repaired hub. The
  overlay is a new pier off the deck's front left with a fresh cap-slate collar
  and an ore teal sign band (lit in A). The generator fails if any hub face
  drawn after the bay in a full render would overlap it, so overlay and full
  render match.
- The overlay entry has `overlay` `true` and `berths` with the new bay:
  `(50.084, 225.391)`, outward `[-0.612, 0.791]`, width 36.742.

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
  outward screen direction: left `(10.033, 45)` `[-1, 0]`, right
  `(85.967, 45)` `[1, 0]`, back `(61.019, 24.409)` `[0.534, -0.845]`. No tether
  is drawn; a moored craft holds just beyond a tip.

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

| Craft      | Length, span (model units) | Shape                                                                        |
| ---------- | -------------------------- | ---------------------------------------------------------------------------- |
| `miner`    | 82.5, 31.6                 | Sand hauler: forward cab, dark cradle rails, two open bins of ore teal       |
| `visitor1` | 40.1, 32                   | Sage shuttle with swept wings, a cab and tail lights                         |
| `visitor2` | 40.1, 32                   | The same shuttle in periwinkle                                               |
| `blocker`  | 53, 38.6                   | Chartreuse wedge, oversized graphite engine pods, a wide ram bar, high beams |

Ada's wingspan is 42.88 model units. The blocking pilot reads as pushy (a loud
hot rod with a ram bar and white high beams) without General Gadget's coral,
forward pincers, dark visor or insignia. Its chartreuse stays clear of the
holodisk magenta `#E868C8`, the coral drones and the
[claim jumpers](heavies.md#cartwheel-claim-jumpers)' rust and ember.

### Speed jets

`{craft}-jets.json` beside the frames uses the [enemy speed jets](enemies.md#speed-jets)
schema (version 1, outer and core layers, no halo, length
`(6 + 24 f²) * sqrt(frame / 96)`) in one civil palette for every story craft:
outer `#c9a978` to `#ffe9b8` and core `#efe4cf` to `#ffffff`.

| Craft      | Mouths | Mouth width | Mouth (u, v, z), u forward |
| ---------- | -----: | ----------: | -------------------------- |
| `miner`    |      2 |           6 | `(-48, ±5.5, 10)`          |
| `visitor1` |      2 |           4 | `(-21, ±3.2, 7.8)`         |
| `visitor2` |      2 |           4 | `(-21, ±3.2, 7.8)`         |
| `blocker`  |      2 |           6 | `(-26, ±15, 7)`            |

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
| `miner`    |      34.5 | Hull front                |              15.094 |         14.119 |   13.072 |
| `visitor1` |      18.9 | Hull nose                 |               8.269 |          7.735 |    7.161 |
| `visitor2` |      18.9 | Hull nose                 |               8.269 |          7.735 |    7.161 |
| `blocker`  |        27 | High beams (tip: v = -13) |              11.813 |          11.05 |    10.23 |

## Palettes

Contrast is WCAG against Cartwheel's field background `#39221E`; the table
lists top colours, which carry each silhouette.

| Asset     | Role                 | Colour    | Contrast |
| --------- | -------------------- | --------- | -------: |
| Hub, buoy | Cream structure      | `#efe4cf` |  11.73:1 |
| Hub       | Slate tower, collars | `#9aaccb` |   6.43:1 |
| Hub       | Slate cap            | `#c3cfe2` |   9.39:1 |
| Hub       | Ore teal             | `#65c9bf` |   7.50:1 |
| Hub       | Worn patch plate     | `#b3a68a` |   6.15:1 |
| Hub       | Worn rust streak     | `#9a5f48` |   2.89:1 |
| Hub       | Worn scorch          | `#a39784` |   5.15:1 |
| All       | Blue lights          | `#70ace8` |   6.16:1 |
| All       | Warm windows         | `#ffe9b8` |  12.38:1 |
| Miner     | Sand hull            | `#dcc49a` |   8.73:1 |
| Miner     | Bins, rails          | `#6e7482` |   3.15:1 |
| Visitor 1 | Sage hull            | `#a7c49a` |   7.74:1 |
| Visitor 2 | Periwinkle hull      | `#aab0e6` |   7.08:1 |
| Blocker   | Chartreuse hull      | `#b6dd30` |   9.41:1 |
| Blocker   | Graphite pods, ram   | `#7d7a92` |   3.57:1 |
| Blocker   | High beams           | `#fffbea` |  14.24:1 |

Sides use the darker partner of each top: slate `#6a7c9e`, sand `#a8916a`
(rear `#8a7656`), sage `#728f66` (rear `#5a7351`), periwinkle `#7379b4` (rear
`#5b6093`), chartreuse `#84a41e` (rear `#617c18`), graphite `#5e5b72`. No craft is
coral, amber or Ada's blue.
