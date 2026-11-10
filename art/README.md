# Art infrastructure

Art owns `art/` and `public/art/`. Tech owns adapters and runtime integration.
Gameplay supplies semantic requirements. No assets or runtime consumer exist yet;
this scope defines no visual style, story or gameplay.

## Published toolkit

Use `@andornaut/art-kit` version `0.22.0` from the verified published
[tarball](https://github.com/andornaut/art-kit/releases/download/v0.22.0/art-kit-0.22.0.tgz).

- SHA256: `8d6f7433af167ca70c64513b8e42b67383dd1dc9b1814ea1e2d4f68e496092d3`
- `SOURCE_COMMIT`: `30ccd1fa13f677d09190a2fd2582c3baf2fa1309`
- Node.js: `>=24.21.0`
- Image dependencies: `pngjs` `7.0.0`, `@jsquash/webp` `1.5.0`
- Optional font support: `skia-canvas` `4.0.0`

The tarball contains compiled ESM and declarations, with no manifest schema.
Use explicit subpath imports such as `@andornaut/art-kit/build`,
`@andornaut/art-kit/png` and `@andornaut/art-kit/spriteSheet`.

## Ada contract and validation

Art and Tech own the Ada manifest contract: its shape, path and export grouping
remain undefined. Semantic IDs must be stable and independent of filenames, with
meaning supplied by Gameplay requirements.

The toolkit's `buildCommand(options, argv)` supports `check.paths`, optional
`index: true`, and strict ordering and module checks. A future art build entry
should expose `buildCommand` validation through `--check` and join the integrated
gate. No executable art validation entry exists yet.
