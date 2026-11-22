# Achievements navigation icon

The trophy uses the same form as the [vector gear](settings-icon.md#vector-gear).
Ada retains the trophy and gear disc styles from the retired standalone
Achievements and Settings buttons. Menu now opens from the top left.
[Layout](layout.md#start-screen) covers active Start controls.

## Source

Chibi's `icon-achievements` nav icon: a trophy cup with two handles, a stem and
a stepped foot, 20x20, cream `#ead4aa` with tan `#e4a672` on its lower-right
edges and no outline (Chibi `art/style-guide.md`, "Achievements").

- Source: `andornaut/chibis-way-home`, commit `7e903387e7f6e310fccf90a1997e8c8dbc6d2711`.
- Source path: `public/art/sprites/icon-achievements.png`, SHA-256
  `ccb6f526859e3aa892d330e1c92b2bf2e6371538cccdd7625f4d04002b9bd260`.
- Source files remain untouched. Reuse is explicitly authorized by the project owner.

## Vector trophy

`public/art/ui/icons/achievements.svg` is the retained glyph from the retired
standalone Achievements control on the Start screen. It is a 20x20
single-colour vector based on the outline of Chibi's trophy, cream `#ead4aa`.
The retained CSS draws it as a mask in the HUD button's glyph colour with
smooth sampling, so it stays sharp at fractional scales.

- Cup: a 12-wide rim from y 2 to 4, a 10-wide cup to y 7 that curves into a
  4-wide stem from y 10.5 to 13, a 7-wide collar to y 15 and a 10-wide base to
  y 17, centred on x 10.
- Handles: a loop each side, a 1.25-wide stroke from the rim out to x 2 and
  back into the cup at y 7.375, around an open hole, as Chibi's 1-pixel handles.
- At 20 px it differs from `icon-achievements` only in edge pixels: the
  rounded handle corners and one pixel of the cup's taper and the collar.

## Pixel sheet

`icon-achievements` is Chibi's trophy alpha in one colour, cream `#ead4aa`,
published beside `icon-settings-nav` for pixel references. Its alpha equals the
source PNG's exactly. One untrimmed, unrotated 20x20 frame, `rest` index 0,
duration 100 ms, at `/art/ui/sprites/icon-achievements.png` and matching
`.json`; the UI manifest key is `icon-achievements`, with paths relative to
`/art/ui/`. JSON data equals the source's; whitespace follows Ada's formatter.

| File | SHA-256                                                            |
| ---- | ------------------------------------------------------------------ |
| PNG  | `05c1de65a6c98639e95ce7a83228197e2041dd47b5a6dc5978633782e8ac1711` |

`art/tools/settings-icons.ts` writes the sheet, `achievements.svg` and
`settings.svg` (three-decimal coordinates, the authored handle values, per
[SVG output](README.md#svg-output)), and the sheet's UI manifest entry. Rebuild with
`node art/tools/settings-icons.ts`, then run Prettier on the written JSON.

## States

The retained trophy and gear styles share these states. Each is a
`HUD_BUTTON` disc: a 33 disc with a 1 ink `#181425` edge in a 48 target, the
20 glyph centred on it.

| State   | Face           | Glyph           | Glyph contrast | Notes                                                                         |
| ------- | -------------- | --------------- | -------------- | ----------------------------------------------------------------------------- |
| Normal  | Navy `#262b44` | `#b8b3c9`       | 6.83:1         | The weapons' idle state                                                       |
| Hover   | As normal      | As normal       | 6.83:1         | No hover-only styling ([Controls](controls.md))                               |
| Focus   |                |                 |                | Use a visible face or glyph cue, including while pressed and in forced colors |
| Pressed | `#3a4466`      | White `#ffffff` | 9.55:1         | The pause disc's held colours, while the press holds                          |

- The disc and glyph never move or resize between states. Focus combines with
  pressed.
- The retained CSS draws an exterior focus ring with a cream band at 10.11:1
  on the space background `#292734`. Migrate this focus cue before reusing
  these styles on a game button. Keep the ink edge and pressed colours.
- If a future button reuses the trophy to open the Achievements card, use
  Gameplay's `achievements` string, "Achievements", for `aria-label` and
  `title`. Set `aria-hidden` on the glyph and `aria-haspopup="dialog"` on the
  button.
