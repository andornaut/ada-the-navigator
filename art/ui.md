# UI assets

Source: Chibi, repository `andornaut/chibis-way-home`, commit
`55ecc2eedd3761fc2c7c9a91fd63f56f0202ef03` for fonts and palette, and commit
`04720cc115c6db655e4b25a9cfa6630e54ce10c7` for the control sheets. Fonts and palette
match their commit's tracked bytes. Source files remain unchanged.
[Controls](controls.md) defines how the sheets are used.

## Consumer contract

Serve these outputs under `/art/ui/`. The nested `manifest.json` retains only
`font-body`, `font-title`, `ui-button`, `ui-button-primary`, `ui-settings-card`,
`ui-close`, `ui-switch` and `ui-focus`, preserving their exact entries, slices and
relative paths, sorted by key.
The [settings navigation icon](settings-icon.md) supplies `icon-settings-nav`
from its separately pinned source. Its entry uses the same sprite schema.
The [touch joystick sheets](touch-joystick.md) supply `ui-move-hint` and
`ui-move-knob` the same way. The [Settings row icons](settings-icons.md) supply
one `icon-*` sheet per Settings row and the install steps glyphs the same way.
Resolve those paths against `/art/ui/` instead of `/art/`; no entry rewrite is needed.
The root manifest is owned by integration. Sprite JSON data and palette schema are unchanged. JSON whitespace is normalized.

| Sprite            | Sheet | Frame | Tags (inclusive indices)        | Nine-slice margins |
| ----------------- | ----- | ----- | ------------------------------- | ------------------ |
| ui-button         | 48x28 | 16x28 | normal 0, pressed 1, disabled 2 | 2/4/2/6 (l/t/r/b)  |
| ui-button-primary | 48x28 | 16x28 | normal 0, pressed 1, disabled 2 | 2/4/2/6 (l/t/r/b)  |
| ui-settings-card  | 16x16 | 16x16 | rest 0                          | 2 on each side     |
| ui-close          | 48x24 | 24x24 | normal 0, pressed 1             | none               |
| ui-switch         | 64x16 | 32x16 | on 0, off 1                     | none               |
| ui-focus          | 16x16 | 16x16 | rest 0                          | 4 on each side     |

All frames last 100 ms, are unrotated and untrimmed, and retain Aseprite
json-hash frame names and forward tags. Card slice centre is (2,2,12,12);
focus slice centre is (4,4,8,8), both within (0,0,16,16) bounds. Button slice
centre is (2,4,12,18) within (0,0,16,28).

BMFont XML names are Liberation Sans Regular (body) and Liberation Sans Bold
(title), both size 16, lineHeight 20 and base 15. Their single PNG pages are
256x64 and 256x128 respectively; page filenames stay relative to the FNT.
For DOM text, use family Liberation Sans with weight 400 from
`/art/ui/fonts/liberation/LiberationSans-Regular.ttf` and weight 700 from
`/art/ui/fonts/liberation/LiberationSans-Bold.ttf`. Ring and knob are procedural
and require no raster asset.

## Dark lavender recolour

`art/tools/controls.ts` reads Chibi's sheets from a checkout of the control-sheet
commit and writes Ada's sheets with art-kit's `writeSpriteSheet`, which reproduces
Chibi's PNG and JSON bytes exactly when no colour changes. Only the colours below
change; alpha, geometry, frames, tags and slices are identical. JSON data is
unchanged. Rebuild with
`node art/tools/controls.ts <chibis-way-home>/public/art/sprites`, then run
Prettier on the written JSON.

| Sheet               | Source colour | Ada colour | Role                    |
| ------------------- | ------------- | ---------- | ----------------------- |
| `ui-settings-card`  | `#c0cbdc`     | `#3b3850`  | Face                    |
| `ui-settings-card`  | `#8b9bb4`     | `#2f2d3d`  | Lower-right shade       |
| `ui-settings-card`  | `#ffffff`     | `#6b6685`  | Upper-left rim          |
| `ui-button`         | `#8b9bb4`     | `#9690b4`  | Face                    |
| `ui-button`         | `#5a6988`     | `#5f5980`  | Lip and edge            |
| `ui-button`         | `#c0cbdc`     | per frame  | See the per-frame table |
| `ui-button-primary` | `#3a4466`     | `#bfa06f`  | Face                    |
| `ui-button-primary` | `#262b44`     | `#8a7148`  | Lip                     |
| `ui-button-primary` | `#5a6988`     | `#d2b886`  | Top highlight           |
| `ui-button-primary` | `#c0cbdc`     | `#2f2d3d`  | Disabled face           |
| `ui-switch`         | `#3e8948`     | `#2f7d76`  | On track                |
| `ui-switch`         | `#265c42`     | `#1f5a55`  | On track edge           |
| `ui-switch`         | `#5a6988`     | `#57536e`  | Off track               |
| `ui-switch`         | `#3a4466`     | `#403d55`  | Off track edge          |
| `ui-switch`         | `#c0cbdc`     | `#c9c4d8`  | Knob shade              |
| `ui-focus`          | `#fee761`     | `#ead4aa`  | Ring band               |
| `ui-close`          | `#181425`     | `#ead4aa`  | Normal X                |
| `ui-close`          | `#3a4466`     | `#403d55`  | Pressed face            |
| Card icons (seven)  | `#3a4466`     | `#ead4aa`  | Icon ink                |

Chibi's `ui-button` uses `#c0cbdc` for both the enabled top highlight and the
disabled face, so that colour maps per frame:

| Sheet       | Frames (tags)         | Source colour | Ada colour | Role          |
| ----------- | --------------------- | ------------- | ---------- | ------------- |
| `ui-button` | 0-1 (normal, pressed) | `#c0cbdc`     | `#aaa4c6`  | Top highlight |
| `ui-button` | 2 (disabled)          | `#c0cbdc`     | `#2f2d3d`  | Disabled face |

`ui-button-primary` has a separate highlight colour; its `#c0cbdc` appears only
in the disabled frame. Ink `#181425` and white `#ffffff` stay unchanged except
where listed. The card icons are in [Settings row icons](settings-icons.md).

| PNG                   | Source SHA-256                                                     | Destination SHA-256                                                |
| --------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------ |
| ui-button.png         | `4a682b1bbd3031940b8edd1ee5456a89c1caacd673235e5661a48bae861cfa79` | `8405b0d32c04951a45f64c483edf8dcceed9e6ddf5ddd1ab77337c0d0c0d402a` |
| ui-button-primary.png | `6e43d89b48641b1f25d1b0da9d29726d630ba1a741f65dc51945bf4a385837a0` | `1f02dc0fcd4740333fb94eed4e0e62106e88f5f642956691e42f2c1f5656b87b` |
| ui-settings-card.png  | `ef8c2722fab1aae15b042f8dd564b3831a8c1cc68c1a3882ed5dd4ccb70f040a` | `e913c7a895aa3beaa147af8498e2e036d737de1cfcce982c679c832ac8ffaebc` |
| ui-close.png          | `a975b987ab52cd43f987e4dffa84c94b2efe8b4406694dac70a935202aafb463` | `a618457379439fea7de000b03af82bf149b4e7ae1c2ef4eb210962ff0ede3ea0` |
| ui-switch.png         | `b12161896816f9c7f62d0526bb224a4850253db7cfd6d4bb1e41cf93a69316c7` | `67e8137f4e1774ce8561797bd1e0c798adc4de782657be69435f109f392e40be` |
| ui-focus.png          | `890594014cd3c7bd2b5b43a726cc0d816ff1614362a3c6cbfa1f97f9bdf95af9` | `34773bdb51ed6918464b2a19d094e6bf364534a2036b03a4f1ce1261b3e12aae` |

| JSON                   | Source SHA-256                                                     | Formatted destination SHA-256                                      |
| ---------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------ |
| ui-button.json         | `9e1f2de00f2d281852399f93e82eabdbf0b4310de6114d71d1d5d7e2120a8edd` | `3d966361993c51f0b86e2250d3c62b6e837e4c04870864977b1920e18efaddfe` |
| ui-button-primary.json | `88f3e07931a03dae1ba10b434bcd2e19d85e64cfffc29f73c612eae709558cbb` | `0c0a0463c8f68e5793a177d929689ef1beb64f01eb25a2dfc668811b2c0feb5a` |

## Licensing

`fonts/liberation/OFL.txt` preserves the SIL OFL 1.1 and Google/Red Hat
copyright notices. No separate font copyright file is present. The source
checkout and tracked tree contain no project LICENSE file. Project sprites are
reused with the project owner's explicit authorization.

## SHA-256 provenance

Paths below are relative to source `public/art/` and destination
`public/art/ui/`. The table records source checksums, except the destination manifest row.
Font PNG, FNT, TTF, OFL and palette files are byte-identical; sprite PNGs are the
recolours above and sprite JSON data is unchanged with normalized formatting. The source manifest hash
pins the full input; the destination manifest is the documented subset. The
control-sheet commit has the same manifest, sprite PNG and sprite JSON bytes.

| Path                                        | SHA-256                                                            |
| ------------------------------------------- | ------------------------------------------------------------------ |
| fonts/font-body.png                         | `8dc6ca532160a47fd9d217bbe0497d5754b1b22d3d31c258162f37d9ebcf98a0` |
| fonts/font-body.fnt                         | `c1104d54651383c8b49628a85d1d6e09098e743401c38d93fc2e4abbabb805d4` |
| fonts/font-title.png                        | `facca5dc6d72d74733affc5f26e1efe60169051bd9118f3b41b1d6ec0f98a160` |
| fonts/font-title.fnt                        | `4c7461475e59e92104b4448e8c57683a9ee9bf3af29a5c5be6c352ecb87b339e` |
| fonts/liberation/LiberationSans-Regular.ttf | `4659bc0c58c5028dd488ec928d41d9265db43d9b669fc14ca8b0832daca7b144` |
| fonts/liberation/LiberationSans-Bold.ttf    | `3973aa5054fb467dd5627245d3dc82e37bf16fe075756156a570455871351582` |
| fonts/liberation/OFL.txt                    | `6a7cb0ddb78fd8ab7d6991261b9686d649556ac4c74a50ebed14837ed0943fdd` |
| sprites/ui-settings-card.png                | `ef8c2722fab1aae15b042f8dd564b3831a8c1cc68c1a3882ed5dd4ccb70f040a` |
| sprites/ui-settings-card.json               | `ef21eecc9941e48665b7bbb7a3c0c612e61b52b44e8238e7685eda0a49ff9576` |
| sprites/ui-close.png                        | `a975b987ab52cd43f987e4dffa84c94b2efe8b4406694dac70a935202aafb463` |
| sprites/ui-close.json                       | `5bd076cbc7e97afd69ab64de12fbcf6b45f65709e75e60aa4fedf1d74dc47494` |
| sprites/ui-switch.png                       | `b12161896816f9c7f62d0526bb224a4850253db7cfd6d4bb1e41cf93a69316c7` |
| sprites/ui-switch.json                      | `aee970b95df9f4096353d3ae5908e9bb62267845ac0be78d95279f6708ed9770` |
| sprites/ui-focus.png                        | `890594014cd3c7bd2b5b43a726cc0d816ff1614362a3c6cbfa1f97f9bdf95af9` |
| sprites/ui-focus.json                       | `1ab8a4c81c35ab038530df74ae6be1f696a5dd766f4688f22dc6411ae521390c` |
| palette.json                                | `083925bef07449205f067a6826adab748fa8e3d33658d111d6259f77292c9928` |
| manifest.json (source full)                 | `17f5bb498704ebba47b3faf5f7e71cbe343b91a95f4e21ba4f7522a1c2fe2ebd` |
| manifest.json (destination subset)          | `5fdda5ae8452843f3607c375bcfb29fd9fd285a37d1a19e5829a54e00f7fc5e7` |

## Formatted destination metadata SHA-256

| Path                          | SHA-256                                                            |
| ----------------------------- | ------------------------------------------------------------------ |
| sprites/ui-close.json         | `50a005e8180e0cff1a99b3560b1c42fd1388762b1c3c83dad141e21497a22241` |
| sprites/ui-focus.json         | `7834056c978e42e737ff6949ca6a694e0e9d76c56852bcac84c75a8b24547f89` |
| sprites/ui-settings-card.json | `b69c50ac204b47a975ba378ddce7aa803e33f92ca86698d20fe12a6ac0b2cd01` |
| sprites/ui-switch.json        | `9bb0d78f992760f4b10422596db4f3142e318b3883efbadf9803e28c990c6079` |
