# Art

Art owns `art/` and `public/art/`. Tech owns adapters and runtime integration.
Gameplay supplies semantic requirements. Prototype art covers Ada's ship,
sector one enemy ships and character portraits. Other space objects use simple
runtime shapes with the [space palette](space-palette.md): muted surroundings and
stronger active signals.

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

The runtime contract is [the manifest](../public/art/manifest.json), version 1.
Each asset has a stable semantic `id`, public `path`, intrinsic `width` and `height`,
`facing`, and normalized `pivot`. Portrait sheets also define `frameWidth`,
`frameHeight`, and zero-based named `frames`. Portrait dimensions describe the
whole sheet; the pivot applies to each frame. Tech owns loading and rotation.

The `ui` entry points to the [Chibi UI subset manifest](../public/art/ui/manifest.json)
and its public base path. That subset preserves the source `fonts` and `sprites`
schema, with paths relative to `/art/ui/`; it is separate from the prototype
`assets` list. [UI provenance](ui.md) records fonts, slices and licences.

Ship textures use sixteen isometric headings with a centered pivot and a 96 by 96
transparent canvas. The manifest recommends 42 by 42 logical pixels for display.
Choose the projected heading without rotating the image; draw speed jets from
`ship-jets.json` behind the idle texture. Thrust textures remain a fallback when
the jets file is unavailable. [Ship geometry](ship.md),
[sector one enemies](enemies.md) and [portrait provenance](portraits.md) describe
the authored and reused assets.

Ship and enemy SVGs are deterministic exports from `art/tools/ship.ts` and
`art/tools/enemies.ts`; edit the generators and regenerate the matching outputs.
Portrait PNGs remain byte-identical to their documented source exports. Sprite
metadata changes only the local image filename. No generated kit source or assets
from another game's build pipeline are required.

The toolkit's `buildCommand(options, argv)` supports `check.paths`, optional
`index: true`, and strict ordering and module checks. A future art build entry
should expose `buildCommand` validation through `--check` and join the integrated
gate. No executable art validation entry exists yet. Integration validation must
check manifest paths, dimensions, named frame indices and idle/thrust geometry,
then inspect both ship states at their actual display size. Run the project tests
and build through the integrated gate before delivery.
