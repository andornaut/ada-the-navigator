# Settings row icons

Each Settings row draws a 16 by 16 icon at its left and Chibi's `ui-switch`
sheet at its right, as Chibi's Settings card does. Ada's `ui-switch.png` is
byte-identical to Chibi's (see [UI assets](ui.md)); use it unchanged for every
row's switch, with its `on` and `off` tags.

| Settings row   | UI manifest key       | Origin           |
| -------------- | --------------------- | ---------------- |
| Move controls  | `icon-move-controls`  | Chibi, unchanged |
| Aim controls   | `icon-aim-controls`   | Authored for Ada |
| Sound          | `icon-sound`          | Authored for Ada |
| Reduced motion | `icon-reduced-motion` | Authored for Ada |
| Install        | `icon-install`        | Chibi, unchanged |

Chibi's install steps card shows the browser's own button glyph beside the
first step, `icon-ios-share` on iOS and `icon-browser-menu` on Firefox for
Android, and `icon-install` beside the second. Both glyphs are Chibi's, unchanged.

## Geometry

- Public paths: `/art/ui/sprites/<key>.png` and matching `.json`; manifest
  entries use paths relative to `/art/ui/` and the existing sprite schema.
- Every sheet is one untrimmed, unrotated 16 by 16 frame named
  `<key>.aseprite`, tag `rest` index 0, duration 100 ms. No nine-slice margins.
- One colour, Chibi's card ink `#3a4466`, fully opaque on a clear ground, in
  2-pixel strokes. The icons are drawn for the light Settings card; they are
  not tinted at runtime.

## Reused Chibi icons

- Source: `andornaut/chibis-way-home`, commit `04720cc115c6db655e4b25a9cfa6630e54ce10c7`.
- Source paths: `public/art/sprites/<key>.png` and matching `.json`.
- PNG bytes are unchanged. JSON data is unchanged; whitespace follows Ada's formatter.
- Source files remain untouched. Reuse is explicitly authorized by the project owner.

| File                      | Source SHA-256                                                     | Destination SHA-256                                                |
| ------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------ |
| `icon-move-controls.png`  | `5869cb8891bb01380d7ef0cd78a0d51c301963f342b2c0119847c3fb04780641` | same                                                               |
| `icon-move-controls.json` | `72a16ad7e639de1e2c7ef8c96b1b5199ea3ca266631f744a9e7741875aecbcc5` | `c030698bd4fa2eb043cbb8eacf3f2ddec39c4748e0c27c56dfd9dffb73214555` |
| `icon-install.png`        | `3c4bb94cdaeaf240a3b7227ef70c659b77292c0bd54ef33cae20a2b2272b0994` | same                                                               |
| `icon-install.json`       | `5328d20052eb00353bf94a5648005b5b42ab2fc3c52d8c6c949cc76cded11416` | `fa1f028a391fe0180dea7fc4bc3aecccbd4c8e5084d00e82a8630d123402f5cc` |
| `icon-ios-share.png`      | `58031edd743823114f85d5ef8382a13165fb16458c1b99f8d3143cab403d184c` | same                                                               |
| `icon-ios-share.json`     | `c5990ced9a49b59df8a49fc34d6a1fcb5d19cb19e4ce8d1316d73515417a6c69` | `c02f5e02ee103fdc70093c5527ac19a5e896a6bcbce106913ace7647ebc04555` |
| `icon-browser-menu.png`   | `ba45788960096b0551b0b3ff0bbaa561373eed1f3c3b8a1caece4547816fe094` | same                                                               |
| `icon-browser-menu.json`  | `ae9c969f26ac55fb6e8df6ad61cbf88546d8ab6e8518eba723d8177a198a1d39` | `374e32b88affc8057ebe911c5f6f61be1cf2507e22348070249ee9a8444b46e1` |

## Authored icons

`art/tools/settings-icons.ts` holds the authored icons as pixel grids and
writes them with art-kit's `writeSpriteSheet`, which emits the same PNG and
JSON bytes as Chibi's Aseprite exports (it reproduces the four reused icons
exactly). Rebuild with `node art/tools/settings-icons.ts`, then run Prettier on
the written JSON.

- `icon-aim-controls`: a reticle, a 12-pixel ring crossed by four ticks that
  reach the frame edges, around a 2 by 2 centre dot.
- `icon-sound`: a filled speaker with two concentric sound waves.
- `icon-reduced-motion`: a wave over a down chevron over a flat line, read as
  motion settling.
