# Art

Art owns `art/` and `public/art/`. Tech owns adapters and runtime integration.
Gameplay supplies semantic requirements. Prototype art covers Ada's ship,
sector one enemy ships and their [destruction](destruction.md), the galaxy one
[heavies](heavies.md) with destructible hardpoints and aimed turrets, the
[station](station.md), the [outposts and discovery cache](outposts.md),
Cartwheel's [hub, mooring buoy and story craft](cartwheel.md) and its
[claim jumpers and turret platform](heavies.md#cartwheel-claim-jumpers),
[asteroids, resource rocks and backdrop rocks](asteroids.md), the
[Cartwheel props](cartwheel-props.md) (traveling debris, the ore nugget,
stranded craft, the tow line and the ore field layouts), [Stardust](stardust.md),
[the rock](rock.md), the
[cockpit background](cockpit.md), the galaxy selector's [route sky](route-sky.md),
the [title screen art](title-screen.md),
the [holodisk](holodisk.md), the
[quantum jump](quantum-jump.md), the [weapon effects](weapons.md), the
[Whirlpool whales](whales.md), the
[Whirlpool current streaks, river debris and project world changes](whirlpool.md),
Andromeda's [settlers' station, settlements, guide beacons, Pip's mail scooter, project world changes and Munix portraits](andromeda.md),
its [garnet drones](andromeda.md#garnet-drones) and [backdrop haze](galaxies.md#backdrop-haze),
[Needle](needle.md)'s Weavers' station, ring gates, channels, the Eye, Elder
Loom's saucer and portrait and the crimson drones, Black Eye's
[station and Blurb settlements](black-eye.md), character portraits, and the
[storybook](storybook.md) Earth backgrounds with Ada's and her family's storybook sprites.
The station jobs have [job art in space](jobs.md) (landmarks, the search area
and the lost item's glint), the job board's row icons and Map marks.
[Destinations](destinations.md) set the scale, light-field keyline and Use
callout of every place Ada visits. [Community projects](projects.md) add the Projects shop tab and the world
changes that funding them shows. [Galaxies](galaxies.md) retint the space field per galaxy,
and the [backdrop layers](backdrop.md) give every galaxy a parallax sky in its own field tones. Other space objects
use simple runtime shapes with the [space palette](space-palette.md): muted
surroundings and stronger active signals.

## Published toolkit

Use `@andornaut/art-kit` version `0.22.0` from the verified published
[tarball](https://github.com/andornaut/art-kit/releases/download/v0.22.0/art-kit-0.22.0.tgz).

- SHA256: `8d6f7433af167ca70c64513b8e42b67383dd1dc9b1814ea1e2d4f68e496092d3`
- `SOURCE_COMMIT`: `30ccd1fa13f677d09190a2fd2582c3baf2fa1309`
- Node.js: `^24.22.2 || ^26.12.0` (project `engines`; art-kit itself
  requires `>=24.21.0`)
- Image dependencies: `pngjs` `7.0.0`, `@jsquash/webp` `1.5.0`
- Optional font support: `skia-canvas` `4.0.0`

The tarball contains compiled ESM and declarations, with no manifest schema.
Use explicit subpath imports such as `@andornaut/art-kit/build`,
`@andornaut/art-kit/png` and `@andornaut/art-kit/spriteSheet`.

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
| `black-eye` | [`/art/black-eye/manifest.json`](../public/art/black-eye/manifest.json) |

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
Black Eye its station, the Blurb settlements and its smoke-bank nebulae.
Sunflower, Whirlpool and Cartwheel each also hold their cast's portraits;
General Gadget's and Grandma's are in core. The station, discovery cache, coral
family, ore nugget, `tow`, the landmarks, the lost item's glint and `jobs` serve every
galaxy and stay in core, as do the
miner, the whale, the smaller adult and Pip's mail scooter, which the Black Eye
finale also draws. Core entries keep their files' paths, so a galaxy's art
stays in its folder wherever its entries are listed. Every galaxy's manifest
also links its own `backdrop`; the shared `backdropLayers` rules are in core.
Tech loads core at boot and a galaxy's manifest with its set.

Generators write through `art/tools/manifest.ts`, naming the target manifest;
a write fails, leaving the files unchanged, when an id is in two manifests or
the `galaxies` map lacks a galaxy. Reruns are byte-identical.

Each asset has a stable semantic `id`, public `path`, intrinsic `width` and `height`,
`facing`, and normalized `pivot`. Portrait sheets also define `frameWidth`,
`frameHeight`, and zero-based named `frames`. Portrait dimensions describe the
whole sheet; the pivot applies to each frame. Tech owns loading and rotation.

The `ui` entry points to the [Chibi UI subset manifest](../public/art/ui/manifest.json)
and its public base path. That subset preserves the source `fonts` and `sprites`
schema, with paths relative to `/art/ui/`; it is separate from the prototype
`assets` list. [UI provenance](ui.md) records fonts, slices and licences.
[Layout](layout.md) is the coordinate system, spacing and size tokens, and
every screen's groups. [Controls](controls.md) is the button, switch, focus
and refusal contract.
[Station and shop](shop.md) lays out the station card, shop and buy confirm.
[Map](map.md) is the pause map: its screen, symbols and glyphs, fog and
interaction.

Ship textures use 32 isometric headings (enemy craft use 16) with a centered
pivot and a 96 by 96 transparent canvas. The manifest recommends 42 by 42 logical pixels for display.
Choose the projected heading without rotating the image; draw speed jets from
`ship-jets.json` behind the idle texture. Thrust textures remain a fallback when
the jets file is unavailable. [Ship geometry](ship.md),
[sector one enemies](enemies.md) and [portrait provenance](portraits.md) describe
the authored and reused assets.

Ship, enemy, station, outpost, Cartwheel, Cartwheel prop, asteroid, whale, Whirlpool
debris, project and Andromeda SVGs are deterministic exports from `art/tools/ship.ts`,
`art/tools/enemies.ts`, `art/tools/station.ts`, `art/tools/outposts.ts`,
`art/tools/cartwheel.ts`, `art/tools/cartwheel-props.ts`, `art/tools/asteroids.ts`,
`art/tools/whales.ts`, `art/tools/whirlpool.ts` and `art/tools/andromeda.ts`, with the
heavies' layered sprites from `art/tools/heavies.ts`, Cartwheel's claim jumpers from
`art/tools/claim-jumpers.ts` and Andromeda's garnet drones from
`art/tools/garnet-drones.ts`. Needle's art comes from `art/tools/needle-station.ts`,
`needle-gates.ts`, `needle-channels.ts`, `needle-sky.ts`, `needle-craft.ts`,
`needle-portraits.ts`, `needle-drones.ts` and `needle-projects.ts`. The
[backdrop layers](backdrop.md)' data and the nebula textures of Whirlpool and
Black Eye come from `art/tools/backdrop.ts`; edit the generators and
regenerate the matching outputs. `art/tools/silhouette.ts` is the shared
[tracer](ship.md#shared-tracer) that turns a frame's drawn alpha into convex
collision parts, for [the ship](ship.md#collision), the
[sector one enemies](enemies.md#collision), the
[heavies](heavies.md#collision), the traveling debris
([Cartwheel](cartwheel-props.md#collision), [Whirlpool](whirlpool.md#collision)),
the pickups ([Stardust](stardust.md#pickup), the
[discovery cache](outposts.md#discovery-cache),
[ore nugget](cartwheel-props.md#ore-nugget), [weapon pickups](weapons.md#pickups))
and the [asteroids](asteroids.md#collision). Reused portrait PNGs remain byte-identical to their documented source exports,
and their sprite metadata changes only the local image filename.
`art/tools/andromeda-portraits.ts` draws Andromeda's Munix portraits, `needle-portraits.ts`
Needle's Avi portraits, `black-eye-portraits.ts` Black Eye's Blurb portraits, and
`art/tools/sunflower-portraits.ts`, `whirlpool-portraits.ts` and
`cartwheel-portraits.ts` each galaxy's cast, from the bust parts in `art/tools/bust.ts`.
`art/tools/portraits.ts` draws the Astra, General Gadget and Grandma portraits and the compact
conversation sheets ([Conversation portraits](conversation.md)). No generated kit source or assets
from another game's build pipeline are required.

The toolkit's `buildCommand(options, argv)` supports `check.paths`, optional
`index: true`, and strict ordering and module checks. A future art build entry
should expose `buildCommand` validation through `--check` and join the integrated
gate. No executable art validation entry exists yet. Integration validation must
check manifest paths, dimensions, named frame indices and idle/thrust geometry,
then inspect both ship states at their actual display size. Run the project tests
and build through the integrated gate before delivery.
