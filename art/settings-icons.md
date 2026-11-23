# Settings row icons

Settings uses a decorative 16 by 16 SVG at the start of each row. Switch rows
use Chibi's recoloured `ui-switch` sheet with its `on` and `off` tags at the
trailing edge, above the visible state label. The Install row uses its action
button in that slot. See the [Settings card](layout.md#settings-card) and
[UI assets](ui.md).

| Settings row   | Icon key              |
| -------------- | --------------------- |
| Move controls  | `icon-move-controls`  |
| Aim controls   | `icon-aim-controls`   |
| Sound effects  | `icon-sound`          |
| FPS counter    | `icon-fps-counter`    |
| Reduced motion | `icon-reduced-motion` |
| Install        | `icon-install`        |

The Install Steps card places the browser glyph and `icon-install` before
its instructions. Apple browsers use `icon-ios-share`. Other browsers use
`icon-browser-menu`, with a text-only exception for Firefox on desktop.

## Geometry

- Settings and Install Steps load `/art/ui/icons/<key>.svg` by URL. These
  decorative images draw at 16 by 16 logical px with smooth sampling from a
  20 by 20 viewBox.
- The SVGs carry cream ink `#ead4aa` on a clear ground. The switch rows align
  the icon's visible top edge with the label ink on the dark lavender
  `#3b3850` card (7.76:1). The offset comes from `SETTING_ICON_INK_TOP` and
  the measured title ink top in `src/ui/settingsIcons.ts` and `src/ui/settings.ts`.
- Move uses a ring and paired chevrons. Aim uses a ring and centre dot. Use
  uses two concentric rings. Sound uses a speaker with two waves, Reduced
  motion a wave over a straight line, and FPS counter a display with three
  bars.

## Inline controls

In first-flight and landing-page help, `icon-move-controls` follows “left
stick”, `icon-aim-controls` follows “right stick”, and `icon-use-control`
follows “Use”.

- The 16 by 16 icon starts 4 px after the name and sits centred on the line
  box, with 2 px above and below on the game's 20 px line and 3.2 px above
  and below on the landing page's 22.4 px line. The name and icon wrap as one.
- Game help and landing markup load the same smoothly sampled SVGs. When the
  name is already written, the image is decorative. Standalone Use icons
  carry the control name as alternative text.

## Archived raster references

The retired Ada PNG and JSON files are preserved at
`587b8e1d08375975e488af5647b8199307c96b32` under
`public/art/ui/sprites/`. The tables identify those archived bytes.

Install, Share and browser menu were reused with the project owner's
authorization from `andornaut/chibis-way-home` at
`04720cc115c6db655e4b25a9cfa6630e54ce10c7`, under
`public/art/sprites/`. The Ada recolour replaced `#3a4466` with `#ead4aa`
and kept alpha and frame geometry.

| File                     | Source SHA-256                                                     | Destination SHA-256                                                |
| ------------------------ | ------------------------------------------------------------------ | ------------------------------------------------------------------ |
| `icon-install.png`       | `3c4bb94cdaeaf240a3b7227ef70c659b77292c0bd54ef33cae20a2b2272b0994` | `edcf85680e3d2328062f551022fe0bc7987da7274e1f74e8d441984868a0488c` |
| `icon-install.json`      | `5328d20052eb00353bf94a5648005b5b42ab2fc3c52d8c6c949cc76cded11416` | `fa1f028a391fe0180dea7fc4bc3aecccbd4c8e5084d00e82a8630d123402f5cc` |
| `icon-ios-share.png`     | `58031edd743823114f85d5ef8382a13165fb16458c1b99f8d3143cab403d184c` | `e29f0d832b033f89dbdd40ed46e989562ed4625919cc01435852b17c98731e9c` |
| `icon-ios-share.json`    | `c5990ced9a49b59df8a49fc34d6a1fcb5d19cb19e4ce8d1316d73515417a6c69` | `c02f5e02ee103fdc70093c5527ac19a5e896a6bcbce106913ace7647ebc04555` |
| `icon-browser-menu.png`  | `ba45788960096b0551b0b3ff0bbaa561373eed1f3c3b8a1caece4547816fe094` | `8e562dde7fe224618e8047b3f284326124dc9d9d6894e1659943c10fbd5fdbe6` |
| `icon-browser-menu.json` | `ae9c969f26ac55fb6e8df6ad61cbf88546d8ab6e8518eba723d8177a198a1d39` | `374e32b88affc8057ebe911c5f6f61be1cf2507e22348070249ee9a8444b46e1` |

### Authored Ada raster references

| PNG                       | SHA-256                                                            |
| ------------------------- | ------------------------------------------------------------------ |
| `icon-move-controls.png`  | `d26eeba831bb29c0fd6c166618bd54ded807cd833354eaaf9cfaa47c950f3f93` |
| `icon-aim-controls.png`   | `4e18d23e3f2453fa9a12f0db7adecff397979839e3b80a86fc29dc12b869b050` |
| `icon-use-control.png`    | `f91554dcbebd881d32b181d32bb40685d3396468956a7b8813d9f8476b4fb91f` |
| `icon-sound.png`          | `39581b60d8fb7a6fd3954a64a38909384da42126381c86bf46c2061b1a858b91` |
| `icon-reduced-motion.png` | `3b45c9a4e7325cc703ebffd8917417581ef329b5a9fdeeb422d157a875c1a8d5` |
| `icon-fps-counter.png`    | `b2a318e4297fd772f3c5aa83dc15e59a101a3acf3e4a78998589597c221137ab` |
