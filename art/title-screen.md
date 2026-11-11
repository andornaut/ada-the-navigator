# Title screen art

The start screen follows Chibi's: a static screen with the protagonist above a
two-line block wordmark and the actions under it. Ada's ship takes the place of
Chibi's bird, in flight over a quiet space field. There are no character
portraits. Placement and press areas are in [Layout](layout.md#start-screen).

- Rebuild with `node art/tools/title-screen.ts` (under a second). It writes
  `public/art/ui/title-wordmark.svg`, `public/art/title-field.png` and
  `public/art/title-screen.json`, the core manifest's `title-field` and
  `title-wordmark` entries and its `titleScreen` link. Reruns are
  byte-identical.
- Source: `andornaut/chibis-way-home` `art/tools/logo.ts` (`GLYPHS`, `word()`
  and the stacked lockup). Source files remain untouched. Reuse is explicitly
  authorized by the project owner.
- Nothing animates, as in Chibi. Reduced motion changes nothing.

## Wordmark

`title-wordmark.svg` is 270 by 102, drawn at 1 logical px per SVG unit with
`shape-rendering="crispEdges"`, so it stays sharp at every view scale.

| Line        | Cell (`b`) | Ink box | Indent | Top |
| ----------- | ---------- | ------- | ------ | --- |
| "Ada the"   | 6          | 250x46  | 10     | 0   |
| "Navigator" | 5          | 269x49  | 0      | 53  |

- Lettering: Chibi's 5x7 alphabet, each `#` a `b` by `b` block, glyphs `6b`
  apart. Ada adds d, r, t, v and N on the same 5x7 grid, and a nine-row g whose
  tail drops two rows below the baseline so it never reads as a.
- Colours: face `#d4dfe9` and the hull's white `#ffffff` as a rim on each
  block run's top and left edges (Chibi's light edge), inside a 2 px ink
  `#181425` outline (square dilation). No sign, extrusion or drop shadow.
- The lines are 7 apart. Line 1's 10 px indent keeps the lockup 270 wide, so it
  centres on whole pixels.
- Accessible name: Gameplay's `home` string, "Ada the Navigator".

## Ship

The title ship is the in-game ship art, not a separate drawing.

- Frame: the selected paint's `ship-26` (Classic `ship-26` before a paint is
  chosen), nose right with a slight climb, its 96 frame drawn 280 by 280.
- Speed jets from `ship-jets.json` at `f = 0.8` (`title-screen.json`
  `ship.jetSpeed`): 21.36 ship units long, the halo at alpha 0.25, drawn behind
  the frame at the frame's scale (280 / 96), as in flight.
- Held still: no bob, flicker or jet change (`ship.animated` is false).
- Ink extents at the [layout](layout.md#start-screen) position: hull 281 to
  484 by 48 to 141 in play-view px, jets reaching 226.3.

## Field

`title-field.png` is 1920 by 1080, opaque, at 2 image px per logical px
(960 by 540). Its top-left sits at play-view (-120, 0) (`title-screen.json`
`field.at`), so it fills every logical view up to 960 wide and 540 tall; the
camera's space background `#292734` fills beyond it.

| Part        | Rule                                                                                         |
| ----------- | -------------------------------------------------------------------------------------------- |
| Ground      | Space background `#292734`                                                                   |
| Mass 1      | Environment `#34333f`, centre (150, 290), radius 240, alpha 1 falling linearly to 0          |
| Mass 2      | Environment detail `#403f4d`, centre (600, 80), radius 220, alpha 0.8 to 0                   |
| Mass 3      | In-between `#5f4fa3`, centre (520, 250), radius 160, alpha 0.16 to 0                         |
| Dust        | 1 px squares, `#403f4d` or `#57536e`, opaque                                                 |
| Points      | 2 px squares, `#c4afcc` at 0.7, 12% of the stars                                             |
| Star layout | Seed 7, 270 drawn over the canvas; none in (215, 142, 290x114) or (220, 312, 280x34)         |
| Shade       | Ink `#181425` from alpha 0 at y 290 to 0.45 at y 360, held below, under the actions and note |

Centres and rects are play-view px. Every mass fades out inside the canvas, so
no edge shows at any view size. The star-free rects hold the wordmark and the
note with a margin.

## Contrast

| Text or mark                | Ground                     | Contrast                     |
| --------------------------- | -------------------------- | ---------------------------- |
| Wordmark face `#d4dfe9`     | Field under the wordmark   | 9.32:1 least, 10.34:1 median |
| Wordmark face               | Its ink outline            | 13.32:1                      |
| Wordmark rim `#ffffff`      | Its ink outline            | 18.02:1                      |
| Note `#ead4aa`, `TYPE.body` | Field under the note       | 9.83:1 least, 10.47:1 median |
| Primary label `#181425`     | `#bfa06f`                  | 7.27:1                       |
| Secondary label `#181425`   | `#9690b4`                  | 5.96:1                       |
| Nav glyph `#b8b3c9`         | Disc `#262b44`             | 6.83:1                       |
| Primary face `#bfa06f`      | Field under the action row | 5.60:1 median                |
| Secondary face `#9690b4`    | Field under the action row | 4.48:1 median                |

The nav discs' navy face sits close to the field (about 1.1:1), as it does on
the plain space background; the glyph identifies each control.
