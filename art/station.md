# Station

- Rebuild with `node art/tools/station.ts`. It writes `public/art/station-a.svg`
  and `public/art/station-b.svg` and replaces the `station-*` manifest entries,
  which sit before the `enemy-*` entries.
- Solid model in the [ship geometry](ship.md) projection and culling, with a
  fixed orientation: no headings and no screen rotation.

## Design

A sector one cooperating outpost:

- Lavender ring `#c4afcc` (sides `#8f7c9c`) with four spokes `#b5a2c0` (sides
  `#6f5f7d`) on the screen diagonals.
- Tall octagonal hub `#dccfe2` (sides `#a08cad`) with a cream cap `#efe4cf`
  (sides `#bfae94`), a mast and a blue beacon.
- Three stepped teal greenhouse domes: glass `#7fd6cc` (sides `#4fa59d`), cap
  `#c4efe8`.
- Cream workshop block with a crane rail `#d9cbb1`.
- Warm lit windows `#ffe9b8` on the ring, hub, workshop and dock arm.
- Dock arm toward the viewer ending in a cream collar with a dark mouth
  `#1e1a26`, inner opening `#35304a`, a lit floor strip `#ffe9b8` and four blue
  corner lights. Two approach-light pairs float in front of the mouth.
- Model extent: ring 130 units across (about 3.0 Ada wingspans of 42.88 units),
  dock face 88 units from the hub.

## Frames and manifest

| Field              | Value                                                                                              |
| ------------------ | -------------------------------------------------------------------------------------------------- |
| Ids                | `station-a`, `station-b`                                                                           |
| Frame              | 180 by 160 frame px, transparent                                                                   |
| Display            | 118.125 by 105 logical px (`frame * 0.4375 * 1.5`, the [destination scale](destinations.md#scale)) |
| Pivot              | `(0.5, 0.43125)`: the hub base on the world plane                                                  |
| `facing`           | `fixed`                                                                                            |
| `frameMs`          | 700                                                                                                |
| `dock.x`, `dock.y` | Dock entrance in frame px: `(90, 131.225)`                                                         |
| `dock.outward`     | `[0, 1]`: the dock opens toward screen-down                                                        |
| `dock.width`       | Mouth width in frame px: 37.967                                                                    |

- Idle blink alternates frame A and frame B, 700 ms each. A lights the dock
  corner lights and the mast beacon `#70ace8`; B lights the two approach-light
  pairs. Unlit lights use `#3f5878`.
- Reduced motion shows frame A only.
- The dock entrance is the mouth's centre on the world plane (z = 0), 62.225
  frame px (40.8 display px) below the pivot. Ada enters moving screen-up,
  opposite `dock.outward`. Scale frame px by the display size like any other
  manifest value.
