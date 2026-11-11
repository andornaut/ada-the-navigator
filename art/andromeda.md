# Andromeda

Andromeda's art: the settlers' station, the settlements, the guide beacons,
Pip's mail scooter and the two project world changes.

- Rebuild with `node art/tools/andromeda.ts`. It writes
  `public/art/andromeda/` and replaces its own entries in place in
  [Andromeda's manifest](../public/art/andromeda/manifest.json).
- [art/tools/andromeda-models.ts](tools/andromeda-models.ts) holds the solid
  models in the [station](station.md) projection, culling and family: the
  station's dock collar, mouth, lit floor strip, blue corner lights and
  approach lights, and warm lit windows `#ffe9b8`.
- Nothing is labelled: no text, signs or letters are drawn on or beside any
  asset.

## Sizes and frames

As for [Cartwheel](cartwheel.md#sizes-and-frames): frames are multiples of
16 px with the pivot on the vertical centre line at an exact five-decimal
fraction; each SVG's intrinsic `width` and `height` are its display size
(`frame * 0.4375`) and its `viewBox` is the frame in frame px. Manifest `width`
and `height` are the frame, so pivots and docks are frame px; `displayWidth`
and `displayHeight` equal the SVG's intrinsic size.

| Asset             | Ids                                                                         | Frame px | Display  | Pivot           |
| ----------------- | --------------------------------------------------------------------------- | -------- | -------- | --------------- |
| Settlers' station | `station-settlers-a`, `station-settlers-b`                                  | 144, 176 | 63 by 77 | `(0.5, 0.5)`    |
| Hamlet            | `outpost-hamlet-a`, `outpost-hamlet-b`                                      | 80, 80   | 35 by 35 | `(0.5, 0.4375)` |
| Lamp house        | `outpost-lamphouse-a`, `outpost-lamphouse-b`                                | 64, 80   | 28 by 35 | `(0.5, 0.6)`    |
| Guide beacon      | `beacon-guide-lit-{a,b}`, `beacon-guide-dented`, `beacon-guide-relit-{a,b}` | 48, 64   | 21 by 28 | `(0.5, 0.75)`   |

## Settlers' station

Every Andromeda station is a settlers' station: Tech draws
`station-settlers-a` and `-b` in place of the trading station's `station-a`
and `-b` for every station in Andromeda, with the trading station's dock,
shop and blink. Entries carry `station` `settlers`.

A lantern station on a pearl deck 104 units across (2.4 Ada wingspans):

- Pearl deck `#e4e2ef` (sides `#a9a6c2`) with a lighter inset top `#d6d3e6`
  and warm rim lamps on the facing rim.
- Six cottages around the deck, clear of the dock axis: cream walls `#efe4cf`
  (sides `#bfae94`) with warm windows and two-step slate-blue roofs `#8d94c4`
  (sides `#5f6594`).
- A striped lighthouse at the centre: a pearl tower with two marker-dark bands
  `#6f78b8` (sides `#4a5080`), a cream gallery, the marker lantern `#b8c1ff`
  with a white core, a slate-blue cap and a mast with the blue beacon.
- A cream post depot with a periwinkle sign band, and two slate tanks
  `#8d9bb0` behind.
- The family dock arm toward the viewer ending in a cream collar, as on the
  trading station.

### Dock and blink

| Field              | Value                                       |
| ------------------ | ------------------------------------------- |
| `facing`           | `fixed`                                     |
| `frameMs`          | 700                                         |
| `dock.x`, `dock.y` | Dock entrance in frame px: `(72, 151.64)`   |
| `dock.outward`     | `[0, 1]`: the dock opens toward screen-down |
| `dock.width`       | Mouth width in frame px: 36.742             |

- The dock is live, in the trading station's schema: the mouth's centre on
  the world plane, 90 units along the dock axis, 63.64 frame px (27.84
  display px) below the pivot. Ada enters moving screen-up, opposite
  `dock.outward`. Scale frame px by the display size like any other manifest
  value.
- Frame A lights the dock corner lights, the mast beacon and the rim lamps, and
  the lantern shows `#b8c1ff` with its white core; frame B lights the
  approach-light pairs, dims the lantern to `#8f9cf0` and the rim lamps to
  `#a08f78`. Unlit blue lights use `#3f5878`. Reduced motion shows frame A.

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
- Frame A lights the dock corner lights and the marker lamps; frame B the
  approach lights, with the lamps at `#4a5080`.

| Variant     | Dock `(x, y)`  | Dock width | Below the pivot |
| ----------- | -------------- | ---------: | --------------: |
| `hamlet`    | `(40, 59.042)` |     22.045 |          24.042 |
| `lamphouse` | `(32, 69.213)` |     19.596 |          21.213 |

Dock values are frame px with `outward` `[0, 1]`, in the station's dock
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
  beacons (8.75 by 17.5 display px).
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
| All     | Warm windows        | `#ffe9b8` |  12.35:1 |
| All     | Blue lights         | `#70ace8` |   6.14:1 |

The lantern takes the galaxy's marker `#b8c1ff`
([Markers](galaxies.md#markers)), the field's own hue at Oklab L 0.83, so
Andromeda's lights read as its own; it sits 1.17:1 from the
`pointOfInterest` lavender.
