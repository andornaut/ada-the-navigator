# Station

- Rebuild with `node art/tools/station.ts`. It writes `public/art/station-a.svg`
  and `public/art/station-b.svg` and replaces the `station-*` manifest entries,
  which sit before the `enemy-*` entries. The frames carry two-decimal
  coordinates ([SVG output](README.md#svg-output)).
- Solid model in the [ship geometry](ship.md) projection and culling, with a
  fixed orientation: no headings and no screen rotation.
- The shared station for every galaxy without its own station art. Cartwheel's
  [hub](cartwheel.md), Andromeda's [settlers' station](andromeda.md),
  Needle's [Weavers' station](needle.md#weavers-station), Whirlpool's
  [Eddy](whirlpool.md#station) and Phantom's [station](phantom.md#station)
  take its place in their galaxies, so Sunflower is the only galaxy on it.

## Design

A blue-steel orbital station with two offset habitat arcs. The gaps show the
structural ribs connecting the arcs to the hexagonal command core. Violet-gray
radiator pylons break the skyline and cyan panels mark their ends. Dark
radiator runs and raised clamps sit along the habitat arcs. A utility module
sits outboard on a narrow truss.

The tapered service module faces the viewer. Its small windows sit in sealed
plating. Ada enters by Use ([Destinations](destinations.md#use-callout)).

## Frames and manifest

| Field     | Value                                                                                                 |
| --------- | ----------------------------------------------------------------------------------------------------- |
| Ids       | `station-a`, `station-b`                                                                              |
| Frame     | 280 by 220 frame px, transparent                                                                      |
| Display   | 183.75 by 144.375 logical px (`frame * 0.4375 * 1.5`, the [destination scale](destinations.md#scale)) |
| Pivot     | `(0.5, 0.45)`: the hub base on the world plane                                                        |
| `facing`  | `fixed`                                                                                               |
| `frameMs` | 700                                                                                                   |

- Idle blink alternates frame A and frame B, 700 ms each. A lights the mast
  beacon `#70ace8` and the service module windows. B shows the dim beacon
  `#3f5878` and windows `#bfae94`.
- Reduced motion shows frame A only.

## Keepers

In galaxies 1 to 5, stations are kept by three keepers of their people (Gameplay
`gameplay/rules.md`): a station's keeper follows its rank by distance from
the galaxy's origin, cycling through the three, and Cartwheel's mining hub is
always Quartz's, its other stations cycling through Slate and Garnet.

The [Station welcome](shop.md#station-pages) shows the keeper's name tab and
framed portrait beside a single greeting paragraph. The generic welcome
shows the station title and available services. Phantom uses the generic
welcome until the completed chapter and aftermath unlock Admiral Archie as
keeper at its stations.

Keeper portraits use the 32 px [conversation portrait](conversation.md) sheets,
`public/art/{galaxy}/portraits/{key}.png`, manifest id
`{key}-portrait`, frame `neutral` 0, drawn at 2x. Tab colours are in
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
