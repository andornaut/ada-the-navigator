# Settings navigation icon

Reuse Chibi's published `icon-settings-nav` without visual changes.

- Source: `andornaut/chibis-way-home`, commit `e19aded731ec80daeadcb3012355ed397e3d2f5b`.
- Source paths: `public/art/sprites/icon-settings-nav.png` and matching `.json`.
- Public paths: `/art/ui/sprites/icon-settings-nav.png` and matching `.json`.
- UI manifest key: `icon-settings-nav`, with paths relative to `/art/ui/`.
- Geometry: one untrimmed, unrotated 20 by 20 frame, `rest` index 0, duration 100 ms.
- No nine-slice margins. Preserve the caller's accessible settings label.

PNG bytes are unchanged. JSON data is unchanged; whitespace follows Ada's formatter.
Source files remain untouched. Reuse is explicitly authorized by the project owner.

| File                       | SHA-256                                                            |
| -------------------------- | ------------------------------------------------------------------ |
| Source and destination PNG | `67c251da96729cb5b0f7c972bed8395720158809b3f75b6ff95ec3fcc97f74f3` |
| Source JSON                | `fa0c821cabebca75550cf3a894ea29d4de31219f64cfd18ad7e25f6c1ac2e496` |
| Formatted destination JSON | `ae49b543054fed9032d1845e4d7f5cb2ade0d5084176619dcce70f9b5ade51a4` |

## Vector gear

`public/art/ui/icons/settings.svg` is the start screen's Settings glyph: a
20x20 single-colour vector of the same gear (eight teeth, four orthogonal
teeth 4 wide to the frame edges and four 3x3 diagonal teeth, around a body of
radius 7.5 with a centre hole of radius 4), cream `#ead4aa`, drawn as a CSS
mask in the HUD button's glyph colour with smooth sampling, so it stays sharp
at fractional scales. At 20 px it differs from `icon-settings-nav` only in edge
pixels. The PNG stays published for existing references.

## 24px gear

`icon-settings-nav-24` is a 24 by 24 redraw of the same gear, published for
existing references (the start screen's Settings button draws the
[vector gear](#vector-gear)): a ring around an 8-pixel centre
hole, with four 4-pixel-wide orthogonal teeth reaching the frame edges and four
diagonal teeth, in cream `#ead4aa`. This sheet is authored for Ada and is not
pinned to Chibi. One untrimmed, unrotated frame, `rest` index 0, duration
100 ms, at `/art/ui/sprites/icon-settings-nav-24.png` and matching `.json`.
`art/tools/settings-icons.ts` writes it with the Settings row icons.

| File | SHA-256                                                            |
| ---- | ------------------------------------------------------------------ |
| PNG  | `258de4f8be902e281069b446fdeeb22c4904c35609a9c6e02cd0a5b159ebdced` |
