# UI assets

Source: Chibi, repository `andornaut/chibis-way-home`, commit
`55ecc2eedd3761fc2c7c9a91fd63f56f0202ef03`. Source exports match that commit's tracked bytes.
Source files remain unchanged.

## Consumer contract

Serve these outputs under `/art/ui/`. The nested `manifest.json` retains only
`font-body`, `font-title`, `ui-settings-card`, `ui-close`, `ui-switch` and
`ui-focus`, preserving their exact entries, ordering, slices and relative paths.
The [settings navigation icon](settings-icon.md) supplies `icon-settings-nav`
from its separately pinned source. Its entry uses the same sprite schema.
Resolve those paths against `/art/ui/` instead of `/art/`; no entry rewrite is needed.
The root manifest is owned by integration. Sprite JSON data and palette schema are unchanged. JSON whitespace is normalized.

| Sprite           | Sheet | Frame | Tags (inclusive indices) | Nine-slice margins |
| ---------------- | ----- | ----- | ------------------------ | ------------------ |
| ui-settings-card | 16x16 | 16x16 | rest 0                   | 2 on each side     |
| ui-close         | 48x24 | 24x24 | normal 0, pressed 1      | none               |
| ui-switch        | 64x16 | 32x16 | on 0, off 1              | none               |
| ui-focus         | 16x16 | 16x16 | rest 0                   | 4 on each side     |

All frames last 100 ms, are unrotated and untrimmed, and retain Aseprite
json-hash frame names and forward tags. Card slice centre is (2,2,12,12);
focus slice centre is (4,4,8,8), both within (0,0,16,16) bounds.

BMFont XML names are Liberation Sans Regular (body) and Liberation Sans Bold
(title), both size 16, lineHeight 20 and base 15. Their single PNG pages are
256x64 and 256x128 respectively; page filenames stay relative to the FNT.
For DOM text, use family Liberation Sans with weight 400 from
`/art/ui/fonts/liberation/LiberationSans-Regular.ttf` and weight 700 from
`/art/ui/fonts/liberation/LiberationSans-Bold.ttf`. Ring and knob are procedural
and require no raster asset.

## Licensing

`fonts/liberation/OFL.txt` preserves the SIL OFL 1.1 and Google/Red Hat
copyright notices. No separate font copyright file is present. The source
checkout and tracked tree contain no project LICENSE file. Project sprites are
reused with the project owner's explicit authorization.

## SHA-256 provenance

Paths below are relative to source `public/art/` and destination
`public/art/ui/`. The table records source checksums, except the destination manifest row.
PNG, FNT, TTF, OFL and palette files are byte-identical; sprite JSON data is unchanged
with normalized formatting. The source manifest hash
pins the full input; the destination manifest is the documented subset.

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
| manifest.json (destination subset)          | `72dccf453ffc547a81c83dbee9a149aa4b5e4687e93fc6425ae3f9705ee2a836` |

## Formatted destination metadata SHA-256

| Path                          | SHA-256                                                            |
| ----------------------------- | ------------------------------------------------------------------ |
| sprites/ui-close.json         | `50a005e8180e0cff1a99b3560b1c42fd1388762b1c3c83dad141e21497a22241` |
| sprites/ui-focus.json         | `7834056c978e42e737ff6949ca6a694e0e9d76c56852bcac84c75a8b24547f89` |
| sprites/ui-settings-card.json | `b69c50ac204b47a975ba378ddce7aa803e33f92ca86698d20fe12a6ac0b2cd01` |
| sprites/ui-switch.json        | `9bb0d78f992760f4b10422596db4f3142e318b3883efbadf9803e28c990c6079` |
