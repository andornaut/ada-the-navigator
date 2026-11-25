# Art

Art owns `art/` and `public/art/`. Tech owns adapters and runtime integration.
Gameplay supplies semantic requirements.

## UI

- [Layout](layout.md) defines coordinates, spacing, sizes and screen groups.
  [Controls](controls.md) defines button, switch, focus and refusal states.
- [UI provenance](ui.md) covers fonts, slices and licences.
  [Title screen art](title-screen.md) and [route sky](route-sky.md) cover the
  Start and galaxy-selector backgrounds.
- [Station and shop](shop.md) covers station pages, shop and buy confirmation.
  [Map](map.md) covers the pause map, symbols, fog and interactions.
- [Community projects](projects.md) covers the Projects shop tab and the
  world changes from funding projects.

## Environments

- [Galaxies](galaxies.md) supplies field tones, including Andromeda's
  [backdrop haze](galaxies.md#backdrop-haze). [Backdrop layers](backdrop.md)
  defines galaxy parallax. The [space palette](space-palette.md) keeps
  surroundings muted and active signals stronger.
- [Destinations](destinations.md) defines scale, light-field keylines and Use
  callouts. See the [station](station.md), [outposts and discovery cache](outposts.md),
  and space-facing [job art](jobs.md) for landmarks, the search area and lost
  item glint. Jobs also have board row icons and Map marks.
- [Asteroids, resource rocks and backdrop rocks](asteroids.md), [the rock](rock.md)
  and the [aboard backdrop](aboard.md) cover scenery and the ship interior.
- [Cartwheel](cartwheel.md) covers the hub, mooring buoy and story craft.
  [Cartwheel props](cartwheel-props.md) covers traveling debris, the ore nugget,
  stranded craft, the tow line and ore field layouts.
- [Whirlpool](whirlpool.md) covers current streaks, river debris and project
  world changes. [Andromeda](andromeda.md) covers the settlers' station,
  settlements, guide beacons, Pip's mail scooter, project world changes and
  Munix portraits.
- [Needle](needle.md) covers the Weavers' station, ring gates, channels, the
  Eye, Elder Loom's saucer and portrait, and the crimson drones. [Phantom](phantom.md)
  covers its station and Blurb settlements.
- [Storybook](storybook.md) covers Earth backgrounds and sprites for Ada
  and her family.

## Actors

- [Ship geometry](ship.md), [sector one enemies](enemies.md) and
  [heavies](heavies.md) cover spacecraft. The heavies include General Gadget's
  capital, destructible hardpoints, aimed turrets and capped weapon mounts.
- [Cartwheel claim jumpers and turret platform](heavies.md#cartwheel-claim-jumpers)
  and [Andromeda garnet drones](andromeda.md#garnet-drones) cover regional enemies.
- The [enemy fleet redesign](enemy-redesign.md) plans the replacement fleet and
  documents its producer.
- The [friendly object redesign](friendly-redesign.md) plans the replacement
  pickups, beacons, gate, friendly craft and whales and documents their
  producer.
- The [station redesign](station-redesign.md) plans the replacement stations,
  outposts and hostile stations and documents their producer.
- [Whirlpool whales](whales.md), [portrait provenance](portraits.md) and
  [conversation portraits](conversation.md) cover the cast.
- [Finale allies](allies.md) covers the Phantom battle's allies, Marlo's song
  and the ally jump.

## Effects

- [Destruction](destruction.md) and [weapon effects](weapons.md) cover combat.
- The [polish set](polish-production.md) lists its groups, staging and the
  [Tech handoff](polish-handoff.md).
- [Stardust](stardust.md), the [holodisk](holodisk.md) and
  [quantum jump](quantum-jump.md) cover pickups and travel.

## Spacecraft design

Mirror intact hulls across their longitudinal centerline by default. Give
asymmetric modules a specific role, such as a fixed weapon mount or a piece of
working equipment. Render damage and independently aimed parts in their
appropriate states. Check front, rear and paired oblique views at game size.

Use the silhouette to communicate a ship's role. Fit cockpits, drives and cargo
or working equipment into the hull. Color follows hull facets and recesses.
Use cool greens, blues and violets with near-black shadows and selective white
highlights. Reserve warmer accents for functional signals.

## Published toolkit

Use the published `@andornaut/art-kit` tarball and Node.js range in
[`package.json`](../package.json). [`package-lock.json`](../package-lock.json)
records the resolved release, integrity, and image and font dependencies.

The tarball supplies compiled ESM and declarations. Ada owns the art manifest
schema. Follow the explicit build subpaths used by the generators, such as
`@andornaut/art-kit/build/png`, `@andornaut/art-kit/build/spriteSheet` and
`@andornaut/art-kit/build/woff2`.

## Ada contract and validation

The runtime contract is the art manifest set, version 1: the
[core manifest](../public/art/manifest.json) and one manifest per galaxy. The
core manifest's `galaxies` maps each stable galaxy id to its galaxy's manifest; the
route order is the game's and needs no manifest change:

| Galaxy id   | Manifest                                                                |
| ----------- | ----------------------------------------------------------------------- |
| `sunflower` | [`/art/sunflower/manifest.json`](../public/art/sunflower/manifest.json) |
| `cartwheel` | [`/art/cartwheel/manifest.json`](../public/art/cartwheel/manifest.json) |
| `whirlpool` | [`/art/whirlpool/manifest.json`](../public/art/whirlpool/manifest.json) |
| `andromeda` | [`/art/andromeda/manifest.json`](../public/art/andromeda/manifest.json) |
| `needle`    | [`/art/needle/manifest.json`](../public/art/needle/manifest.json)       |
| `phantom`   | [`/art/phantom/manifest.json`](../public/art/phantom/manifest.json)     |

Every manifest has `version`, `assets` and data links in the same schema. An
entry or data link that exactly one galaxy uses is in that galaxy's manifest,
generic art included; one that several galaxies or none use (boot, HUD, UI,
Ada, story) is in core. Usage follows the game's content data: Sunflower holds
its outposts and their project frames; Cartwheel the hub, mooring buoy, claim
jumpers, story craft other than the miner, stranded craft, traveling debris
and the `cartwheelDebris` and `oreField` links; Whirlpool the whale calves,
river debris, project frames, the nebula banks and the `whales`, `whirlpoolCurrents`,
`whirlpoolDebris` and `whirlpoolProjects` links; Andromeda the settlers'
station, the settlements, the guide beacons, their project frames, the garnet
drones, the Munix portraits, the backdrop haze and the `backdropHaze` link;
Needle the Weavers' station and its Loom hall, the ring gates, channel debris,
Channel lights, Elder Loom's saucer and portrait, the crimson drones and the
`needleGates`, `needleChannels`, `needleEye` and `needleBand` links;
Phantom its station, the Blurb settlements, its smoke-bank nebulae, the finale
ally craft and the `allies` link.
Sunflower, Whirlpool and Cartwheel each also hold their cast's portraits;
General Gadget's and Grandma's are in core. The station, discovery cache, coral
family, ore nugget, `tow`, the landmarks, the lost item's glint and `jobs` serve every
galaxy and stay in core, as do the
miner, the whale, the smaller adult and Pip's mail scooter, which the Phantom
finale also draws. Core entries keep their files' paths, so a galaxy's art
stays in its folder wherever its entries are listed. Every galaxy's manifest
also links its own `backdrop` and its stranded craft's `tow` data (Cartwheel's `tow`
is the same file as core's, which also holds the tow line); the shared `backdropLayers` rules are in core.
Tech loads core at boot and a galaxy's manifest with its set.

Generators write through `art/tools/manifest.ts`, naming the target manifest;
a write fails, leaving the files unchanged, when an id is in two manifests or
the `galaxies` map lacks a galaxy. Generators that share an id prefix each own
only their own crafts' ids. Reruns are byte-identical.

A manifest that lists enemy or story craft frames has a top-level `sidecars`
map from each craft to the public paths of its `jets`, `hardpoints` and
`shards` data files. The key is the enemy frame key (the `archetype`, or the
industrial stem such as `retaliatorCargoHauler`) or the story craft's name. A
kind is present only when its file exists:

```json
"sidecars": {
  "capital": {
    "jets": "/art/needle/enemies/capital-jets.json",
    "hardpoints": "/art/enemies/capital-hardpoints.json"
  }
}
```

A craft's own file is `{craft}-{kind}.json` beside its frames; Pip's scooter
and the miner are in core with their files in their galaxies' folders.
Generators write the map with `mergeSidecars` in `art/tools/manifest.ts`, each
owning only its own crafts' kinds, so a rerun updates them in place and keeps
every other generator's. Crafts sort by name and kinds follow `jets`,
`hardpoints`, `shards`.

`public/art/` holds each distinct file once. Generators write through
`writeOnce` in `art/tools/manifest.ts`: a file identical to one the same
generator already wrote is not written, and its entries and sidecars name the
first file's path. A recoloured family's hardpoints carry no colour, so its
`hardpoints` paths name the coral files in `/art/enemies/`, which its generator
checks byte for byte against its own output and which must be generated first.
Shared files are:

- `retaliatorCargoHauler` frames, turret parts, `jets` and `hardpoints`: the
  `retaliator` files in the same folder (the retaliator hull is the cargo
  hauler). Its `shards` are its own.
- Every recoloured family's frigate, capital, hostile station, retaliator and
  industrial stem `hardpoints`: `/art/enemies/{craft}-hardpoints.json`, the
  cargo hauler's being `retaliator-hardpoints.json`. Only the claim platform's
  layout is its family's own.
- Cartwheel's `visitor2` jets: `/art/cartwheel/visitor1-jets.json`.

### SVG output

Every generated SVG passes through `svgText` in `art/tools/svg-text.ts` before
it is written or compared. It rounds the numbers of coordinate and length
attributes (`d`, `points`, `x`, `y`, `x1` to `y2`, `cx`, `cy`, `r`, `rx`,
`ry`, `width`, `height`, `stroke-width`, `stdDeviation`) to one decimal,
dropping trailing zeros and leading zeros (`.5`), and minifies the markup: no
whitespace between elements, single spaces between attributes, no spaces
around path commands or commas. The root `<svg>` keeps its `width`, `height`
and `viewBox` exactly, `transform` keeps its angles and factors, and every
other attribute keeps its value and order.

A set keeps more decimals when one decimal moves its edges past the budget:
more than 2 levels (of 255) at the 99th percentile of frame pixels at display
size, or a visible shift along a whole edge. `SVG_DECIMALS` in the same file
names each exception:

| Set                                                          | Decimals | Reason at one decimal                                                |
| ------------------------------------------------------------ | -------: | -------------------------------------------------------------------- |
| Classic landing, boot, Local Map and Shop                    |        2 | 99th percentile 4 levels at display size, 6 at 2x                    |
| Job landmarks                                                |        3 | The beacon arcs, authored to 3 decimals, shift along their length    |
| Start screen nav glyphs (`achievements`, `exit`, `settings`) |        3 | The trophy handles, authored to 3 decimals, shift along their length |

Hand-authored SVGs that no generator writes (the Pause poses, `shield.svg` and
`weapon-scattershot.svg`) keep their own text.

Each asset has a stable semantic `id`, public `path`, intrinsic `width` and `height`,
`facing`, and normalized `pivot`. Portrait sheets also define `frameWidth`,
`frameHeight`, and zero-based named `frames`. Portrait dimensions describe the
whole sheet; the pivot applies to each frame. Tech owns loading and rotation.

The `ui` entry points to the [Chibi UI subset manifest](../public/art/ui/manifest.json)
and its public base path. That subset preserves the source `fonts` and `sprites`
schema, with paths relative to `/art/ui/`; it is separate from the prototype
`assets` list.

Ship textures use 64 isometric headings (enemy craft use 16) with a centered
pivot and a 96 by 96 transparent canvas. The manifest recommends 42 by 42 logical pixels for display.
Choose the projected heading without rotating the image. Draw procedural
normal and reverse jets from `ship-jets.json` and `ship-retro-jets.json`.
Resolve Classic and paid hulls from `ship-materials.json` and `ship-paint.json`;
the core manifest's ship frame paths are logical references.

Ship material and geometry data are deterministic exports from `art/tools/ship.ts`.
The stations, outposts, settlements, hostile stations and their project frames
come from `art/tools/stations.ts` and `art/tools/hostile-stations.ts`
([Station redesign](station-redesign.md)); the pickups, caches, landmarks,
galaxy beacons, ring gates, friendly craft and the project sprites' placements
from `art/tools/friendly.ts` ([Friendly object redesign](friendly-redesign.md));
and the small enemy craft from `art/tools/fleet.ts`
([Enemy fleet redesign](enemy-redesign.md)). Enemy, asteroid, whale and debris
SVGs are deterministic exports from `art/tools/enemies.ts`,
`art/tools/asteroids.ts`, `art/tools/whales.ts`, `art/tools/cartwheel-props.ts`
and `art/tools/whirlpool.ts`, with the heavies' layered sprites from
`art/tools/heavies.ts`, Cartwheel's claim jumpers from
`art/tools/claim-jumpers.ts` and Andromeda's garnet drones from
`art/tools/garnet-drones.ts`. Needle's channels, sky, portraits and drones come
from `art/tools/needle-channels.ts`, `needle-sky.ts`, `needle-portraits.ts` and
`needle-drones.ts`, and the finale allies' data from `art/tools/allies.ts`. The
[backdrop layers](backdrop.md)' data and the nebula textures of Whirlpool and
Phantom come from `art/tools/backdrop.ts`; edit the generators and regenerate
the matching outputs. `art/tools/silhouette.ts` is the shared
[tracer](ship.md#shared-tracer) that turns a frame's drawn alpha into convex
collision parts, for [the ship](ship.md#collision), the
[sector one enemies](enemies.md#collision), the
[heavies](heavies.md#collision), the traveling debris
([Cartwheel](cartwheel-props.md#collision), [Whirlpool](whirlpool.md#collision)),
the pickups ([Stardust](stardust.md#pickup), the
[discovery cache](outposts.md#discovery-cache),
[ore nugget](cartwheel-props.md#ore-nugget), [the upgrade pickup](weapons.md#pickups))
and the [asteroids](asteroids.md#collision). Reused portrait PNGs remain byte-identical to their documented source exports.
Portrait and holodisk sheets ship as PNG only: the manifest gives their frames and loops.
`art/tools/andromeda-portraits.ts` draws Andromeda's Munix portraits, `needle-portraits.ts`
Needle's Avi portraits, `phantom-portraits.ts` Phantom's Blurb portraits, and
`art/tools/sunflower-portraits.ts`, `whirlpool-portraits.ts` and
`cartwheel-portraits.ts` each galaxy's cast, from the bust parts in `art/tools/bust.ts`.
`art/tools/portraits.ts` draws the Astra, General Gadget and Grandma portraits and the compact
conversation sheets. No generated kit source or assets
from another game's build pipeline are required.

The toolkit's `buildCommand(options, argv)` supports `check.paths`, optional
`index: true`, and strict ordering and module checks. A future art build entry
should expose `buildCommand` validation through `--check` and join the integrated
gate. No executable art validation entry exists yet. Integration validation must
check manifest paths, dimensions, named frame indices and idle/thrust geometry,
then inspect both ship states at their actual display size. Run the project tests
and build through the integrated gate before delivery.
