# Galaxies

- Rebuild with `node art/tools/galaxies.ts`. It writes
  [galaxies.json](../public/art/galaxies.json) from the base field roles in
  [space-palette.json](../public/art/space-palette.json) and links it from the
  root manifest as `galaxies`. The build fails if any space signal falls below
  5:1 on a galaxy's background.
- `galaxies` lists galaxy 1 to 4 in selector order with `number`, `id`,
  `tint` and `colors`. Ids are not display strings; Gameplay owns names and
  flavour lines.

## Field hues

Each galaxy retints the space field to one Oklab hue. `colors` holds the
results under the space palette's role names; they replace `background`,
`environment` and `environmentDetail` while Ada is in that galaxy. Signals
(`pointOfInterest`, `obstacle`, `active`, `weapon`, `shipHardpoint`), the ship
and the in-between colours never change.

| Number | Id          | `background` | `environment` | `environmentDetail` | Lowest signal contrast |
| ------ | ----------- | ------------ | ------------- | ------------------- | ---------------------- |
| 1      | `sunflower` | `#332712`    | `#3F331E`     | `#4C3F29`           | `obstacle` 5.41:1      |
| 2      | `cartwheel` | `#39221E`    | `#452E2A`     | `#523A36`           | `obstacle` 5.48:1      |
| 3      | `whirlpool` | `#132D33`    | `#1F3940`     | `#2B464C`           | `obstacle` 5.37:1      |
| 4      | `black-eye` | `#271423`    | `#331F2F`     | `#3F2B3B`           | `obstacle` 6.44:1      |

Every other signal is above 6:1 on every background.

## Tint rule

`tint` is `lightness` (Oklab L offset), `chroma` and `hue` (degrees). A field
colour keeps its own Oklab L plus `lightness` and takes `chroma` at `hue`:
`(L + lightness, chroma cos hue, chroma sin hue)`, converted back to sRGB and
clamped. The four base roles keep their lightness steps, so the field reads the
same in every galaxy, only in another hue; Black Eye is also 0.055 darker.

The same rule retints raster space art and captures: a pixel is field paint
when its Oklab L is below `fieldPaint.lightness` (0.45) and its chroma below
`fieldPaint.chroma` (0.06). Other pixels are signals and stay as they are.

## Selector preview

The [galaxy selector](layout.md#galaxy-selector) card shows one preview per
galaxy, `preview` in the data. Tech captures each one; Art owns this spec.

- Capture the galaxy's space view with the base field from
  `space-palette.json`, with no HUD, touch controls, notices, panels or cards,
  at 1 px per logical px.
- Crop a 360 by 180 logical px window (`preview.crop`) framed on a point of
  interest: the galaxy's station or landmark near the centre, with some field
  mass and environment detail in frame. Ada's ship may appear off centre.
- Halve it to 180 by 90 (`preview.width`, `preview.height`) by nearest
  neighbour and draw it at that size in a 1 px `#181425` frame.
- Unlocked: the galaxy's [tint rule](#tint-rule) applied to that preview.
- Locked: the untinted preview in greyscale, each pixel `30 + 0.6 Y`
  (`preview.locked`), with `Y` the ITU-R 601 luma, truncated. Every locked
  galaxy shares one grey range, so a locked preview gives away no hue.

## Space palette

`space-palette.json` keeps the base field (`#292734`, `#34333F`, `#403F4D`):
the tint origin, and the fallback until a galaxy is set. In play the
field comes from the current galaxy, so Sunflower, galaxy 1, replaces the
current `#292734` background with `#332712`.
