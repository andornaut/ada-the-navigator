# Station

- Rebuild with `node art/tools/station.ts`. It writes `public/art/station-a.svg`
  and `public/art/station-b.svg` and replaces the `station-*` manifest entries,
  which sit before the `enemy-*` entries.
- Solid model in the [ship geometry](ship.md) projection and culling, with a
  fixed orientation: no headings and no screen rotation.
- The shared station for every galaxy without its own station art. Cartwheel's
  [hub](cartwheel.md), Andromeda's [settlers' station](andromeda.md),
  Needle's [Weavers' station](needle.md#weavers-station), Whirlpool's
  [Eddy](whirlpool.md#station) and Black Eye's [station](black-eye.md#station)
  take its place in their galaxies, so Sunflower is the only galaxy on it.

## Design

A sector one cooperating outpost:

- Lavender ring `#c4afcc` (sides `#8f7c9c`) with four spokes `#b5a2c0` (sides
  `#6f5f7d`) on the screen diagonals.
- Tall octagonal hub `#dccfe2` (sides `#a08cad`) with a cream cap `#efe4cf`
  (sides `#bfae94`), a mast and a blue beacon.
- Three stepped teal greenhouse domes: glass `#7fd6cc` (sides `#4fa59d`), cap
  `#c4efe8`.
- Cream workshop block with a crane rail `#d9cbb1`.
- Warm lit windows `#ffe9b8` on the ring, hub, workshop and arm.
- An arm toward the viewer ending in a closed cream collar with two warm
  windows on its face, a finished hull with no mouth. Ada enters the station
  by Use ([Destinations](destinations.md#use-callout)), so it has no dock.
- Model extent: ring 130 units across (about 3.0 Ada wingspans of 42.88 units),
  collar face 88 units from the hub.

## Frames and manifest

| Field     | Value                                                                                                 |
| --------- | ----------------------------------------------------------------------------------------------------- |
| Ids       | `station-a`, `station-b`                                                                              |
| Frame     | 180 by 150 frame px, transparent                                                                      |
| Display   | 118.125 by 98.438 logical px (`frame * 0.4375 * 1.5`, the [destination scale](destinations.md#scale)) |
| Pivot     | `(0.5, 0.46)`: the hub base on the world plane                                                        |
| `facing`  | `fixed`                                                                                               |
| `frameMs` | 700                                                                                                   |

- Idle blink alternates frame A and frame B, 700 ms each. A lights the mast
  beacon `#70ace8` and the collar windows; B shows the beacon unlit `#3f5878`
  and the windows dim `#a08f78`.
- Reduced motion shows frame A only.

## Keepers

Each galaxy's stations are kept by three keepers of its people (Gameplay
`gameplay/rules.md`): a station's keeper follows its rank by distance from
the galaxy's origin, cycling through the three, and Cartwheel's mining hub is
always Quartz's, its other stations cycling through Slate and Garnet. The
station card shows the keeper in its [keeper block](layout.md#station-card).
Black Eye's stations have no keeper and keep the generic welcome.

Portraits are the [conversation portraits](conversation.md)' compact sheets,
`public/art/{galaxy}/portraits/{key}-compact.png`, manifest id
`{key}-portrait-compact`, frame `neutral` 0. Tab colours are in
[Controls](controls.md#conversation-box).

| Galaxy    | Keeper  | Key       | Tab       | Ink on tab |
| --------- | ------- | --------- | --------- | ---------: |
| Sunflower | Saffron | `saffron` | `#ffcf8f` |    12.50:1 |
| Sunflower | Bramble | `bramble` | `#d6e88a` |    13.53:1 |
| Sunflower | Nectar  | `nectar`  | `#ffc2d6` |    11.96:1 |
| Whirlpool | Ripple  | `ripple`  | `#a8f0c8` |    13.69:1 |
| Whirlpool | Coral   | `coral`   | `#f7b0c4` |    10.26:1 |
| Whirlpool | Brine   | `brine`   | `#7fc0f0` |     9.18:1 |
| Needle    | Sedge   | `sedge`   | `#9fcf9f` |    10.21:1 |
| Needle    | Willow  | `willow`  | `#d0a8e8` |     8.96:1 |
| Needle    | Marsh   | `marsh`   | `#e0c79a` |    10.99:1 |
| Andromeda | Lumen   | `lumen`   | `#fde58a` |    14.37:1 |
| Andromeda | Dial    | `dial`    | `#d0d8ff` |    12.82:1 |
| Andromeda | Cog     | `cog`     | `#a8f0c0` |    13.63:1 |
| Cartwheel | Quartz  | `quartz`  | `#d8ccf4` |    11.89:1 |
| Cartwheel | Slate   | `slate`   | `#a8c8b8` |     9.97:1 |
| Cartwheel | Garnet  | `garnet`  | `#ec8f9e` |     7.71:1 |
