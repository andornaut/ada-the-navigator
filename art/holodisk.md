# Holodisk

A black disc with a pink hologram ring and a dark hub: round where Stardust is
a crystal, black and pink where weapon signals are amber, so shape, size and
hue all differ.

- `node art/tools/friendly.ts` draws the pickup and the waypoint beacon: the
  core manifest's `holodisk` strip row and `holodisk-beacon-a` and `-b`
  ([Friendly object redesign](friendly-redesign.md)).
- `icon-holodisk` and `icon-holodisk-20` are vector UI icons from
  [shared-resource-svg.ts](tools/shared-resource-svg.ts).
- `icon-holodisk-24` is a UI subset sprite with its Aseprite data in
  `public/art/ui/sprites/`, written by `node art/tools/friendly.ts` with its
  [UI manifest](../public/art/ui/manifest.json) entry.

## Colour

Flat tones under one light from the upper left: top lightest, left faces mid,
right faces darkest.

| Role                         | Colour                          |
| ---------------------------- | ------------------------------- |
| Disc, hub, beacon dish       | `#3a3448`, `#2a2536`, `#181425` |
| Beacon keel and collar       | `#4a4358`, `#352f41`, `#25202e` |
| Hologram ring, lit lamp, rim | `#e868c8`                       |
| Dim lamp                     | `#a83a96`                       |

On light fields the body merges with the ink keyline and the pink ring carries
the read; on Phantom's field the white edge outlines the body.

## Item icon

| Key                | Size     | Source                   |
| ------------------ | -------- | ------------------------ |
| `icon-holodisk`    | 16 by 16 | `shared-resource-svg.ts` |
| `icon-holodisk-20` | 20 by 20 | `shared-resource-svg.ts` |
| `icon-holodisk-24` | 24 by 24 | `friendly.ts`            |

One design on a 20 unit grid: a `#2a2536` disc of radius 8.3 with a 1.5 unit
`#e868c8` rim in place of an ink outline, the pink hologram ring to radius 4.9,
an ink `#181425` hub of radius 2 and a `#4a4358` lit arc at the upper left.
The 20 and 24 px icons add an ink shade on the lower right of the rim. The pink
rim lets the disc read on the item notice's ink chip.

`icon-holodisk-24` rasterises that design at 24 px with a single `rest` frame:
each pixel takes the colour covering most of it, every pixel opaque or clear,
drawn with nearest-neighbour filtering. Its hub radius is 1.7 units so the hub
draws round at that size.

## Pickup

- Row `holodisk`: a strip of four 40 by 40 frames, displayed at 17.5 by 17.5
  logical px with the pivot at the centre. `frames` names `rest` (0), `turn1`
  (1), `edge` (2) and `turn2` (3).
- One thick disc on edge: black rim, pink hologram face and dark hub. It
  faces the viewer at rest and turns about its upright diameter: face on, 50,
  90 and 130 degrees.
- Turn (`loop`): rest 600 ms, then turn1, edge and turn2 at 70 ms each; 810 ms
  in all. Each pickup starts at a random phase.
- Reduced motion: the rest frame only.
- Collision: the rest frame's convex parts in
  [pickups.json](../public/art/pickups/pickups.json), held through the loop.

## Beacon

- Rows `holodisk-beacon-a` (lamp lit) and `holodisk-beacon-b` (lamp dim): 72
  by 64 frames, displayed at 31.5 by 28 logical px with the pivot at the
  centre, each shown for 600 ms in turn (`frameMs`).
- A keel, a black dish tier, a dark collar and one pink hologram lamp.
- Show it only while the holodisk's location is known, centred on the
  holodisk's waypoint under the pickup, at any range until the holodisk is
  recovered. A holodisk whose location is unknown shows no beacon.
- It is always paired with a direction indicator: the existing discovery
  indicator arrow, drawn in `#e868c8` for the holodisk waypoint.

## Inserting

Inserting a holodisk plays on the ship from outside: a magenta pulse at Astra's
drive on the hull, a ring of magenta dots and Astra's light in the canopy. See
the [holodisk moment](aboard.md#holodisk-moment).
