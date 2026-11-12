# Settings row icons

Each Settings row draws a 16 by 16 icon at its left and Chibi's `ui-switch`
sheet at its right, as Chibi's Settings card does. Ada's `ui-switch.png` is
Chibi's, recoloured (see [UI assets](ui.md)); use it for every row's switch, with
its `on` and `off` tags. Row layout follows [Controls](controls.md).

| Settings row   | UI manifest key       | Origin            |
| -------------- | --------------------- | ----------------- |
| Move controls  | `icon-move-controls`  | Authored for Ada  |
| Aim controls   | `icon-aim-controls`   | Authored for Ada  |
| Sound          | `icon-sound`          | Authored for Ada  |
| Reduced motion | `icon-reduced-motion` | Authored for Ada  |
| Install        | `icon-install`        | Chibi, recoloured |

`icon-use-control` is not a Settings row: it is the Use disc's
[inline drawing](#inline-controls), authored with the other grids.

Chibi's install steps card shows the browser's own button glyph beside the
first step, `icon-ios-share` on iOS and `icon-browser-menu` on Firefox for
Android, and `icon-install` beside the second. Both glyphs are Chibi's, recoloured.

## Geometry

- Public paths: `/art/ui/sprites/<key>.png` and matching `.json`; manifest
  entries use paths relative to `/art/ui/` and the existing sprite schema.
- Every sheet is one untrimmed, unrotated 16 by 16 frame named
  `<key>.aseprite`, tag `rest` index 0, duration 100 ms. No nine-slice margins.
- One colour, cream `#ead4aa`, fully opaque on a clear ground, in 2-pixel
  strokes (the control icons' chevrons and Use symbol ring are 1 pixel),
  replacing Chibi's card ink `#3a4466`. The icons are drawn for the
  dark lavender card `#3b3850` (7.76:1); they are not tinted at runtime.

## Reused Chibi icons

- Source: `andornaut/chibis-way-home`, commit `04720cc115c6db655e4b25a9cfa6630e54ce10c7`.
- Source paths: `public/art/sprites/<key>.png` and matching `.json`.
- `art/tools/controls.ts` recolours each PNG from `#3a4466` to `#ead4aa`, keeping
  alpha and geometry (see [UI assets](ui.md#dark-lavender-recolour)). JSON data
  is unchanged; whitespace follows Ada's formatter.
- Source files remain untouched. Reuse is explicitly authorized by the project owner.

| File                     | Source SHA-256                                                     | Destination SHA-256                                                |
| ------------------------ | ------------------------------------------------------------------ | ------------------------------------------------------------------ |
| `icon-install.png`       | `3c4bb94cdaeaf240a3b7227ef70c659b77292c0bd54ef33cae20a2b2272b0994` | `edcf85680e3d2328062f551022fe0bc7987da7274e1f74e8d441984868a0488c` |
| `icon-install.json`      | `5328d20052eb00353bf94a5648005b5b42ab2fc3c52d8c6c949cc76cded11416` | `fa1f028a391fe0180dea7fc4bc3aecccbd4c8e5084d00e82a8630d123402f5cc` |
| `icon-ios-share.png`     | `58031edd743823114f85d5ef8382a13165fb16458c1b99f8d3143cab403d184c` | `e29f0d832b033f89dbdd40ed46e989562ed4625919cc01435852b17c98731e9c` |
| `icon-ios-share.json`    | `c5990ced9a49b59df8a49fc34d6a1fcb5d19cb19e4ce8d1316d73515417a6c69` | `c02f5e02ee103fdc70093c5527ac19a5e896a6bcbce106913ace7647ebc04555` |
| `icon-browser-menu.png`  | `ba45788960096b0551b0b3ff0bbaa561373eed1f3c3b8a1caece4547816fe094` | `8e562dde7fe224618e8047b3f284326124dc9d9d6894e1659943c10fbd5fdbe6` |
| `icon-browser-menu.json` | `ae9c969f26ac55fb6e8df6ad61cbf88546d8ab6e8518eba723d8177a198a1d39` | `374e32b88affc8057ebe911c5f6f61be1cf2507e22348070249ee9a8444b46e1` |

## Authored icons

`art/tools/settings-icons.ts` holds the authored icons as pixel grids and
writes them with art-kit's `writeSpriteSheet`, which emits the same PNG and
JSON bytes as Chibi's Aseprite exports (it reproduces the three reused icons
exactly). The grids emit cream directly. Rebuild with
`node art/tools/settings-icons.ts`, then run Prettier on the written JSON.

| PNG                       | SHA-256                                                            |
| ------------------------- | ------------------------------------------------------------------ |
| `icon-move-controls.png`  | `d26eeba831bb29c0fd6c166618bd54ded807cd833354eaaf9cfaa47c950f3f93` |
| `icon-aim-controls.png`   | `4e18d23e3f2453fa9a12f0db7adecff397979839e3b80a86fc29dc12b869b050` |
| `icon-use-control.png`    | `f91554dcbebd881d32b181d32bb40685d3396468956a7b8813d9f8476b4fb91f` |
| `icon-sound.png`          | `39581b60d8fb7a6fd3954a64a38909384da42126381c86bf46c2061b1a858b91` |
| `icon-reduced-motion.png` | `3b45c9a4e7325cc703ebffd8917417581ef329b5a9fdeeb422d157a875c1a8d5` |

- `icon-move-controls`: the move stick, the aim stick's ring and knob with a
  1-pixel chevron each side between them, as the move ring's chevrons.
- `icon-aim-controls`: the aim stick, the touch ring as a 2-pixel ring (pixel
  centres 6.1 to 8.2 from the frame centre) around the knob, a 4 by 4 disc with
  its corners clear.
- `icon-use-control`: the Use disc with the generic Use symbol, the 2-pixel
  ring around a 1-pixel symbol ring (pixel centres 3.0 to 4.1 from the centre)
  and a 2 by 2 centre dot.
- `icon-sound`: a filled speaker with two concentric sound waves.
- `icon-reduced-motion`: a wave over a down chevron over a flat line, read as
  motion settling.

The three control icons span the whole frame and mirror on both axes, so their
drawn bounds centre on the frame exactly. Each draws from the live control's
shapes (the ring, the knob, the move ring's chevrons, the Use symbol) on whole
pixels, because the live drawing scaled to 16 leaves its ink edges and 3-pixel
band under 1 device pixel.

## Inline controls

Wherever player text names an on-screen control (the first-flight lessons, the
landing page's mobile line), its icon follows the name: `icon-move-controls`
after "left stick", `icon-aim-controls` after "right stick", `icon-use-control`
after "Use".

- The icon's left edge is 4 px after the name's last glyph; the following text
  keeps its own space advance.
- 16 by 16, centred on the line box: 2 px above and below on the 20 line
  (`TYPE.body` and `TYPE.label`), 3.2 on the landing page's 22.4 line.
- Full opacity, unlike the live controls' 85%; cream on the conversation panel,
  the card and the landing page's `#292734`.
- Nearest-neighbour scaling (`image-rendering: pixelated`) at every density, 2x
  and above included. The landing page loads the same sheets: each PNG is its
  one 16 by 16 frame, so `/art/ui/sprites/<key>.png` serves as the image.
- The icon is decorative (`alt=""`, `aria-hidden`); the name stays in the text.
  Keep the name and its icon on one line when wrapping.
