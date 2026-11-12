# Layout

Every Ada UI positions and sizes from the tokens and rules on this page:
buttons, menus, cards, storybook pages, the galaxy selector, the HUD and
modals. Similar elements use the same token everywhere. A screen is data
(anchors, groups and tokens), never coordinates. [Controls](controls.md) owns
control states, colours and the refusal cue; [Station and shop](shop.md) owns
the shop's groups, states and item art; this page owns every distance and size.

Each token row names the constant that implements it in `src/ui/layout/`.
"To implement" marks a constant Tech has not created yet; "now" names where
the value currently lives, in CSS px.

## Coordinates and scale

| Token          | Value                            | Rule                                                                               | Constant                                                 |
| -------------- | -------------------------------- | ---------------------------------------------------------------------------------- | -------------------------------------------------------- |
| Base view      | 720x360                          | Smallest logical view; Chibi's base view                                           | Verified `SCREEN`, `src/data/screen.ts`                  |
| View scale `s` | `min(cssW / 720, cssH / 360)`    | Logical px to CSS px, for the canvas and the DOM overlay alike                     | `viewScale(cssSize)`, `playView.ts`, to implement        |
| Logical view   | `cssW / s` by `cssH / s`         | At least 720x360; one axis widens past the base with the screen aspect             | `logicalView(cssSize)`, `playView.ts`, to implement      |
| Safe insets    | `env(safe-area-inset-*) / s`     | Per edge, in logical px, in the turned frame's orientation                         | `safeInsets()`, `playView.ts`, to implement              |
| Safe rect      | Edge moved in by `max(m, inset)` | The shared safe-margin clamp: margin `m` from the view edge, never inside an inset | `safeRect(insets, m, view)`, `playView.ts`, to implement |

- Measure all UI in logical px. The Phaser canvas draws the logical view
  through game-kit's `followFrameTurn` with `Scale.NONE` and a device-pixel
  backing (`deviceResolution`); every camera zooms the 720x360 base to fit, so
  world and scroll coordinates are logical px. The DOM overlay root carries
  the same factor `s` as the CSS variable `--ada-unit` (one logical px in CSS
  px), updated on resize and orientation change; every size is
  `calc(var(--ada-unit) * N)` through the layout helpers. The root is not
  transform-scaled, so text stays crisp and hit testing stays native. Layout
  code reads and writes logical px only.
- Sampling follows the asset kind:
  - The WebGL backing is `r = min(devicePixelRatio, 2)` times the canvas's CSS
    size; above a ratio of 2 the canvas upscales with CSS
    `image-rendering: pixelated`.
  - The camera zoom is `r` times the fit scale and may be fractional; there is
    no integer world zoom or letterbox.
  - SVG and other vector textures rasterize at their on-screen device size:
    logical display size times the camera's fit scale times `r`, never at
    logical size times `devicePixelRatio`. Each axis is capped at 4 texels per
    logical px for memory, and every SVG rasterizes again when a resize moves
    that scale more than 1.25 times either way. They draw with linear
    filtering. At 1280x720 with a ratio of 1 the scale is 1.78, so desktop
    vectors stay sharp; 844x390 at a ratio of 3 gives `1.083 * 2` = 2.17;
    1440x900 at 2 reaches the cap (`2 * 2` = 4).
  - Authored pixel sprites, world and UI alike (portraits, icons, HUD glyphs),
    draw with nearest-neighbour filtering at their fractional scale.
  - UI text and chrome are HTML over the canvas, at device resolution; the
    browser rasterizes DOM SVGs (pause, the HUD glyph masks) at device
    resolution itself.
  - Line widths, keylines and outlines stay in logical px at every ratio.
- The logical width varies with aspect (720 at 2:1 or narrower, 779 on an
  844x390 phone), as `Scale.EXPAND` did. The game area is the centred 2:1 play
  view; wider or taller screens show bands outside it. The top controls (pause,
  the status pill, weapons, Skip and Settings) are placed relative to the game
  area through `hudRect`, clamped by the safe insets; both sides use the left
  game-area gap and the larger side inset, so the HUD mirrors exactly, notches
  included. The sticks sit from the screen's edges inside the larger side
  inset, mirrored as in Chibi, clamped into the game area, and Use follows the
  aim stick
  ([HUD and overlays](#hud-and-overlays)). Cards and page content keep the available rect.
- Nine-slice edges are whole CSS px: each slice edge is `round(edge * s)`, set
  as a variable for `border-image-width` and outset, so edges never blur while
  the body scales freely. Review at native and fractional scales (1.083 and
  1.778).

All current Ada specs give CSS px at 1x. Every token keeps its number and
becomes logical px, so UI now grows with the canvas:

| Screen, CSS px | `s`   | Logical view | 48 button, CSS px |
| -------------- | ----- | ------------ | ----------------- |
| 844x390 phone  | 1.083 | 779x360      | 52                |
| 1280x720       | 1.778 | 720x405      | 85                |
| 1440x900       | 2     | 720x450      | 96                |
| 1920x1080      | 2.667 | 720x405      | 128               |

## Spacing tokens

| Token             | Value | Rule                                                                                                   | Constant                                                                      |
| ----------------- | ----- | ------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------- |
| Row gap           | 4     | Between rows of one list that are not buttons: item rows, text rows                                    | `SPACING.rowGap`, `tokens.ts`, to implement; now `CARD.rowGap`                |
| Group gap         | 8     | Between card groups and row parts                                                                      | `SPACING.gap`, `tokens.ts`, to implement; now `CARD.gap`                      |
| Column gap        | 8     | Between columns that are not buttons                                                                   | `SPACING.columnGap`, `tokens.ts`, to implement                                |
| Mark gap          | 6     | From an inline icon to its label inside one control or pill                                            | `SPACING.markGap`, `tokens.ts`, to implement                                  |
| Button gap        | 16    | Between standard button faces side by side: action rows and grid columns                               | `BUTTON_GAP`, `tokens.ts` (game-kit `BUTTON_GAP`)                             |
| Small button gap  | 24    | Between faces when either is a small button (face under 48 high), in any direction                     | `SMALL_BUTTON_GAP`, `tokens.ts` (game-kit `SMALL_BUTTON_GAP`)                 |
| Stack button gap  | 8     | Between standard button faces stacked vertically: action stacks, control rows, grid rows, line buttons | `STACK_BUTTON_GAP`, `tokens.ts` (game-kit `STACK_BUTTON_GAP`)                 |
| HUD edge          | 12    | Game area edge to the drawn art of the HUD's outermost elements                                        | `HUD_EDGE`, `playView.ts` (Chibi's value)                                     |
| Control edge      | 8     | The HUD safe-rect margin                                                                               | `CONTROL_EDGE`, `playView.ts` (Chibi `CONTROL_EDGE`)                          |
| Stick area margin | 8     | Least gap from each stick's drawn ring to the game area's edge                                         | `STICK_AREA_MARGIN`, `playView.ts`, to implement                              |
| Page inset        | 16    | Modals and page content from the view edge                                                             | `SPACING.pageInset`, `tokens.ts`, to implement; now `.ada-modal` padding      |
| Panel padding     | 16    | Inside cards and the story panel, including the 2 px frame                                             | `SPACING.panelPadding` = game-kit `MODAL_CONTENT.padding`; now `CARD.padding` |
| Body line box     | 20    | 16 px text (body, labels, supporting)                                                                  | `TYPE.body.lineHeight`, `tokens.ts`, to implement                             |
| Heading line box  | 28    | 24 px bold titles                                                                                      | `TYPE.heading.lineHeight`, `tokens.ts`, to implement                          |
| Count line box    | 14    | 12 px bold HUD weapon counts                                                                           | `TYPE.count.lineHeight`, `tokens.ts`, to implement                            |
| Story line box    | 26    | 18 px storybook text column                                                                            | `TYPE.story.lineHeight`, `tokens.ts`, to implement                            |

Type roles: `TYPE.heading` 24 bold on 28; `TYPE.body` 16 regular on 20;
`TYPE.label` 16 bold on 20; `TYPE.story` 18 regular on 26, for the storybook
text column only; `TYPE.count` 12 bold on 14, for the HUD weapon
counts only (the one role below 16). Text never shrinks: wrap, grow the region,
reflow or scroll. Colours per role are in
[Controls](controls.md#colour-tokens).

## Page bounds

- HUD top controls sit in `hudRect(insets, view)`; the other HUD controls sit
  in `safeRect(insets, CONTROL_EDGE, view)`.
- Modals and page content (story panel) fit in
  `safeRect(insets, SPACING.pageInset, view)`, the available rect.
- Backgrounds and the modal dim cover the whole logical view, under the insets.

## Groups

A card or panel is a vertical stack of groups. Absent groups take neither
space nor a gap.

- Groups stack top to bottom `SPACING.gap` apart; each keeps its measured
  width and centres in the inner width.
- Rows of one list stack `SPACING.rowGap` apart; rows that are buttons
  (control rows, shop tiles, line buttons) stack `STACK_BUTTON_GAP` apart.
- Button gaps, between neighbouring button faces with nothing between them,
  across groups too (a card's last control row and the action below it):
  standard faces stacked vertically, `STACK_BUTTON_GAP` (8); standard faces
  side by side, `BUTTON_GAP` (16); and `SMALL_BUTTON_GAP` (24) in any
  direction, stacks included, when either face is small, under the standard
  48 (`TEXT_BUTTON.height`, face and lip). Small: the 33 HUD and Map discs
  (weapons, pause, Settings, Achievements, the Map tools), compact buttons
  (28: Skip, the Install row action) and the close X (24). Standard: every 48
  text button and control row, including Quests and Galaxies.
- Prose groups (wrapping body or supporting text) never widen a card: they
  wrap to the inner width that the other groups and the 50% floor set.
  Single-line labels inside rows and buttons count at their full width.
- Action row: buttons share one width, the widest label plus
  `2 * TEXT_BUTTON.inset`, `BUTTON_GAP` apart; the group centres. Every
  group places its primary down and to the right
  ([Controls](controls.md#buttons)).
- Action stack: buttons fill the inner width, `STACK_BUTTON_GAP` apart.
- Control grid: equal-width tiles in up to two columns `BUTTON_GAP` apart and
  rows `STACK_BUTTON_GAP` apart; one column when two plus the panel
  padding exceed the available width.
- Paged and tabbed cards measure every page or tab and keep the largest width
  and height, so paging never resizes the card.

## Controls and targets

| Token                | Value                                                                   | Rule                                                                                                                                                             | Constant                                                              |
| -------------------- | ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Action height        | 48                                                                      | 44 face over a 4 lip                                                                                                                                             | `TEXT_BUTTON.height`, `controls.ts`, to implement                     |
| Lip, pressed sink    | 4, 2                                                                    | Face geometry per state, in [Controls](controls.md)                                                                                                              | `TEXT_BUTTON.lipHeight`, `TEXT_BUTTON.pressedSink`                    |
| Action inset         | 16 horizontal, 12 vertical                                              | Content inset per side; a wrapped label grows the face by 20 per line                                                                                            | `TEXT_BUTTON.inset`, `TEXT_BUTTON.verticalInset`; now `BUTTON_INSET`  |
| Compact height       | 28                                                                      | Row actions and pills: the native 16x28 nine-slice frame                                                                                                         | `TEXT_BUTTON.compactHeight`, `controls.ts`, to implement              |
| Story action         | 36: a 32 face over the 4 lip, pressed sink 2                            | Storybook choices and page controls; label inset 16 across and 6 down; a wrapped label grows the face by 20 per line (56 for two lines); press `hitAround(face)` | `STORY_BUTTON`, `controls.ts`, to implement                           |
| Compact width        | 72, or the label plus 8 px insets when that is wider                    | Install row action (Chibi's 72x28 face)                                                                                                                          | `cardActionsSize`, `contentCard.ts`; now fixed `ROW.action.button` 72 |
| Control row          | 48 high, 16 icon, 8, label, 8, action                                   | Whole row is one control; action at the row's right end                                                                                                          | `CONTROL_ROW`, `controls.ts`, to implement; now `ROW`                 |
| Row growth           | `max(48, text + 2 * SPACING.rowGap)`                                    | A row with a wrapped note grows by 20 per line                                                                                                                   | `CONTROL_ROW`, `controls.ts`, to implement                            |
| Switch               | 32x16                                                                   | `ui-switch` frame                                                                                                                                                | `CONTROL_ROW.switch`; now `ROW.action.switch`                         |
| Row icon             | 16x16                                                                   | Settings and install-step icons                                                                                                                                  | `CONTROL_ROW.icon`; now `ROW.icon`                                    |
| Minimum press target | 48x48                                                                   | Every discrete control                                                                                                                                           | `HIT_RULE.minTarget`, `hitAreas.ts`, to implement                     |
| Press-area growth    | `clamp(6, 16, 0.25 * shorter side)` per side, then grown to 48 per axis | Pause, Use and the close X; nearest drawn centre wins an overlap                                                                                                 | `hitAround`, `pressedArea`, `HIT_RULE`, `hitAreas.ts`, to implement   |
| Focus ring outset    | 4                                                                       | `ui-focus` outside the drawn face, every state                                                                                                                   | `FOCUS_RING.outset`, `controls.ts`, to implement                      |
| Selection ring       | 2 band, 2 outside the face                                              | Shares the focus outset; focus may overlap it                                                                                                                    | `FOCUS_RING`, `controls.ts`, to implement                             |
| Pill                 | 28 high, radius 4, 8 side padding                                       | Price pills and the HUD status pill                                                                                                                              | `PILL`, `controls.ts`, to implement                                   |

Faces, content insets, nine-slice margins and press areas are separate
measurements; place neighbours against the full press area. Centre labels by
the face of each state, never the press area.

## Modals

| Token           | Value                                                                | Rule                                                                                                   | Constant                                                                      |
| --------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------- |
| Card width      | `min(availableWidth, max(contentWidth + 32, viewportWidth * 0.5))`   | Content-fitted; 50% floor of the fixed 720 base width (360), as in Chibi; capped by the available rect | game-kit `modalWidth`, `MODAL_CONTENT`; `contentCardLayout`, `contentCard.ts` |
| Card height     | Content-fitted, capped by the available height                       | No minimum, no reserved space                                                                          | `contentCardLayout`, `contentCard.ts`, to implement                           |
| Frame border    | 2                                                                    | Counts inside the 16 padding                                                                           | `CARD_CONTENT.frameBorder`, `cardFrame.ts`; now `CARD.frameBorder`            |
| Close face      | 24x24                                                                | `ui-close`                                                                                             | `CARD_CONTENT.closeSize`, `cardFrame.ts`; now `CARD.closeSize`                |
| Close inset     | 6 from the top and right edges                                       | Press area `hitAround(face)` = 48x48, may extend 6 past the card                                       | `CARD_CONTENT.closeInset`; now `CARD.closeInset`                              |
| Title clearance | `max(padding, closeHitRight + SPACING.gap)` = `max(16, 42 + 8)` = 50 | Mirrored on both sides of the title                                                                    | `cardTitleReserve(close)`, `cardFrame.ts`; now `card-layout.ts`               |
| Header balance  | Frame inner edge to title equals title to first group                | Measured on line boxes in DOM                                                                          | `cardHeaderLayout`, `cardFrame.ts`; now `card-layout.ts`                      |
| Scroll reserve  | 6 gap plus an 8 track, thumb inset 1                                 | A scrolling region reserves 14 on its right, inside the padding                                        | `SCROLL`, `contentCard.ts`, to implement                                      |
| Scroll end pad  | 16                                                                   | Below the last control at the scroll end                                                               | `SCROLL.endPad` = `SPACING.panelPadding`                                      |
| Drag threshold  | 8                                                                    | A pointer moving further scrolls and does not activate                                                 | `SCROLL.dragThreshold`, to implement                                          |

- `contentWidth` is the widest group, or the title's single-line width plus
  `2 * (titleClearance - padding)`. `viewportWidth` is the full logical view
  width before insets; `availableWidth` is the available rect's width.
- The card centres in the available rect. A title wider than its slot wraps
  and grows the header.
- Header balance: with line boxes, the title starts at 16 and the first group
  at `2 * 16 - 2 + 28 = 58`. DOM measures line boxes, not ink; canvas-drawn
  text measures ink. The close target's bottom (42) plus 8 never exceeds 58.
- Scrolling: a card taller than the available rect caps there and scrolls one
  region, its scroll group (by default every group below the header). The
  header and close X stay fixed. Keyboard focus scrolls the focused control
  fully into view, including its focus ring.
- Every modal dims the whole view and takes input exclusively; outside taps
  never activate controls underneath. One card shows at a time over one dim,
  except the buy confirm over the dimmed shop.

## HUD and overlays

The HUD's top controls (pause, the status pill, weapons and the start screen's
Achievements and Settings) anchor to the HUD rect, as Chibi anchors its pause button
and skill row (`chibis-way-home` `src/ui/layout/playView.ts` `playView`,
`topShift` and `CONTROL_EDGE`; `src/ui/layout/skillHud.ts`). The rect moves
with the centred base view, so on screens wider than 2:1 the controls sit
inside the game area, clear of curved screen corners and the bands; the
safe-rect clamp still keeps them out of every inset. The sticks are placed from
the screen's edges inside the larger side inset and the bottom inset, mirrored
as Chibi places its touch controls, then clamped into the game area; Use
follows the aim stick (see their rows).

Symmetry: one `HUD_EDGE` (12, as in Chibi) runs from the game area's side to
the drawn art of the outermost visible element in each top corner, and from
the top edge to both rows' drawn tops. It measures drawn art, never a press
area. The leftmost visible element sits at `HUD_EDGE` whether or not the pause
button shows. Each side is `ceil(max(left game-area gap + offset, max(inset
left, inset right)))` from its view edge (`mirroredSide`), so a one-sided notch
moves both sides in alike and the HUD mirrors exactly.

| Token      | Value                                                                                                                                                             | Rule                                                                                                                                                                            | Constant                                                                                      |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Play view  | 720x360 at `x = floor((floor(view.width) - 720) / 2)`, `y = 0`                                                                                                    | The game area: the base view centred across the logical view, at its top; bands outside it                                                                                      | `playView(view)`, `playView.ts`, to implement (Chibi `playView`)                              |
| HUD rect   | Sides `mirroredSide(insets, HUD_EDGE, view)` in from each view edge; top `ceil(max(12, inset top))`; bottom `min(348, view bottom - ceil(max(12, inset bottom)))` | The lines the top controls' drawn art meets (its top corners); the sticks and Use follow their own rule                                                                         | `hudRect(insets, view)`, `HUD_EDGE`, `playView.ts` (Chibi `topShift`)                         |
| HUD button | Target 48, disc 33, selected annulus 4, glyph 20, gap 9; pitch 57                                                                                                 | Chibi's `SKILL_BUTTON`; the disc equals the pause disc; small, so discs sit `SMALL_BUTTON_GAP` (24) apart face to face: gap = 24 - 15 = 9 between targets; pitch = target + gap | `HUD_BUTTON` = `{ target, disc, annulus, glyph, gap }`, `playView.ts`                         |
| HUD row    | Targets reach 7.5 (the disc inset) past the HUD rect's top and right; centre line HUD rect top + 16.5; targets' bottom HUD rect top + 40.5                        | The outermost disc's drawn edge and every disc's drawn top sit on the rect; the pause disc, the discs, the pill and Skip share the centre line                                  | `HUD_ROW` = `{ reach, centre, bottom }`, `playView.ts`                                        |
| Count pill | 14 high, radius 4, padding 4, top 40 below the target top, clearance 5                                                                                            | Opaque ink pill on the disc's lower edge; the conversation box top sits the clearance below its bottom                                                                          | `HUD_AMMO_COUNT` = `{ height, radius, padding, top, clearance }`, `playView.ts`, to implement |

| Screen, CSS px | Insets, logical   | Logical view | Play view x | HUD rect left, right, top |
| -------------- | ----------------- | ------------ | ----------- | ------------------------- |
| 720x360        | None              | 720x360      | 0           | 12, 708, 12               |
| 720x360        | Left and right 43 | 720x360      | 0           | 43, 677, 12               |
| 844x390        | None              | 779x360      | 29          | 41, 738.08, 12            |
| 844x390        | Left and right 43 | 779x360      | 29          | 43, 736.08, 12            |
| 844x390        | Left 47, right 0  | 779x360      | 29          | 47, 732.08, 12            |
| 1280x720       | None              | 720x405      | 0           | 12, 708, 12               |
| 1920x1080      | None              | 720x405      | 0           | 12, 708, 12               |

The right side is measured from the exact view width (779.08 at 844x390), so
the right edge sits as far from the view's right as the left edge from its
left: 41 at 844x390 without insets, 10.92 inside the game area's right edge
(749) because the right band is 30.08 and the left 29.

| Element      | Geometry                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Constant                                                                                                                    |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| Pause        | Touch only (desktop pauses with Escape): 35x35 frame, 33 disc, drawn edge on the HUD rect's top-left corner (frame 1 outside it), so the disc spans 12 to 45 on both axes at the 720 base; vector art in [Controls](controls.md#pause); press `hitAround(frame)` = 52.5, HUD rect left and top - 9.75 to + 42.75                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | `PAUSE_BUTTON`, `playView.ts`                                                                                               |
| Weapons      | One `HUD_ROW` of `HUD_BUTTON` targets, `HUD_BUTTON.gap` apart: target `i` from the right at `x = right + 7.5 - 48 - 57 * i`, `y = top - 7.5`; disc and glyph centred in it (disc at 7.5, glyph at 14), so the rightmost disc's drawn right edge and every disc's drawn top sit on the HUD rect (disc 675 to 708, 12 to 45 at the 720 base); the target is the press area (48, `HIT_RULE.minTarget`), 4.5 to 52.5 at a top of 12; each non-Laser weapon carries its [count pill](#weapon-count-pill) under the disc                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | `HUD_BUTTON`, `hudButtonTarget(index)`, `playView.ts`                                                                       |
| Status pill  | One `PILL` holding the Stardust count and, while Ada carries them, her ore and her job or story item or towed craft: left edge `SPACING.gap` right of the pause press area (`PAUSE_BUTTON.hit` right + `SPACING.gap` = HUD rect left + 50.75, 62.75 at the 720 base) while the pause button shows, and on the HUD rect's left edge (`STATUS_PILL.xAlone` 0, so 12) while it is hidden; centred on the HUD row's centre line (HUD rect top + 16.5, so the pill spans HUD rect top + 2.5 to + 30.5, 14.5 to 42.5). Parts and states in [Status pill](#status-pill)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | `STATUS_PILL`, `playView.ts`, to implement                                                                                  |
| Shield pill  | Bottom centre: one `PILL` with the shield icon and a bar whose length follows Shield level (120, 180 or 240, so the pill is 162, 222 or 282 wide), centred on the HUD rect (the view's centre), its bottom level with the sticks' drawn bottom, `controlsBottom()` (see Sticks): x 279 to 441, 249 to 471 or 219 to 501 and y 292 to 320 at the 720 base, y 273 to 301 with phone insets, y 324 to 352 at 1280x720 where the sticks' clamp lowers it. The same place on touch and desktop; [Touch controls by view](#touch-controls-by-view) lists every view. See [Shield pill](#shield-pill)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | `SHIELD_PILL`, `playView.ts`, to implement                                                                                  |
| Item notice  | A 24-high chip under the status pill, top HUD rect top + 34.5 (46.5), centred under where the gain lands and clamped between the pill's left edge and `SPACING.pageInset` left of the leftmost weapon target; draws over the conversation box and under the HUD controls; takes no input. See [Item notice](#item-notice)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | `ITEM_NOTICE`, `itemNotice.ts`, to implement                                                                                |
| Sticks       | 75 frames; each ring's drawn edge sits 60 from the screen's outer side (`TOUCH_STICK.side`) and 40 from its bottom (`TOUCH_STICK.bottom`), inside the safe insets, mirrored as in Chibi: with `side = ceil(max(inset left, inset right) + 60)`, the move ring's left at `side` and the aim ring's right at `floor(view width) - side`, so a one-sided notch moves both rings in alike; both bottoms at `view bottom - inset bottom - 40` (`controlsBottom()`). Each ring is then clamped so the whole stick draws inside the game area with `STICK_AREA_MARGIN` (8) to spare: left at least `playView x + 8`, right at most `playView right - 8`, bottom at most `playView bottom - 8`. The two sticks share one bottom. Rings 60 to 133 and 587 to 660, 247 to 320, at the 720 base (rest centres (96, 283) and (623, 283)); 103 to 176 and 544 to 617, 228 to 301, with phone insets (43, 43, 0, 19); 60 to 133 and 646 to 719 at 844x390; the clamp applies at 1280x720 (bottom) and from 2560x1080 (both sides). A rest centre is the ring's left and top plus 36. Every view is in [Touch controls by view](#touch-controls-by-view). Drawn knob reach 12 inside the ring; move input reach 40 (`TOUCH_STICK.moveReach`) and deadzone 2.4 (logical); the move stick draws a speed line from the origin to the thumb, not clamped to the ring; the aim stick draws no line; shown only on a touch screen (a coarse primary pointer) outside modals, as in Chibi, and hidden on desktop | `TOUCH_STICK`, `touchControls.ts`, to implement, now `sticks.ts`; `STICK_AREA_MARGIN` and `controlsBottom()`, `playView.ts` |
| Use          | Touch only: Chibi's touch disc (`USE_DISC`), a 75 frame with an open ring 73 across and the action's symbol, at the sticks' 85% opacity ([Controls](controls.md#use-disc)); its centre the aim stick's rest centre plus `USE_DISC.fromAim` (-77, -100), as Chibi places Use from Jump: (546, 183) at the 720 base, (503, 164) with phone insets, (605, 183) at 844x390 and (562, 164) with its insets; press shape a circle of radius 100 (`TOUCH_CIRCLE_RADIUS` 63 plus the 37 hint radius) about the centre, cut on the line midway to the aim stick's centre; shown only while an interaction is available, on a touch screen, outside modals                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | `USE_DISC`, `touchControls.ts`, to implement; replaces `USE_BUTTON`                                                         |
| Settings     | Start screen only: a `HUD_BUTTON` in the [nav disc states](achievements-icon.md#states) with `settings.svg` (20, vector) as its glyph mask, drawn with smooth sampling; target `hudButtonTarget(0)`, its disc's drawn right edge and top on the HUD rect's top-right corner                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | `HUD_BUTTON`, `playView.ts`                                                                                                 |
| Achievements | Start screen only: the same `HUD_BUTTON` with `achievements.svg`; target `hudButtonTarget(1)` (`hudButtonTarget(2)` while Exit shows), one pitch (57) left of Settings's at the same top, so the targets are `HUD_BUTTON.gap` apart; the target is the press area. See [Start screen](#start-screen)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | `HUD_BUTTON`, `hudButtonTarget(1)`, `playView.ts`, to implement on the start screen                                         |
| Exit         | Start screen only, and only where the platform can close the app: the same `HUD_BUTTON` with `exit.svg` (20, vector, after Archie's `icon-exit`: a door frame open on the right with an arrow leaving it); target `hudButtonTarget(0)`, the rightmost disc, so Settings and Achievements each move one pitch left. See [Start screen](#start-screen)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | `HUD_BUTTON`, `hudButtonTarget(0)`, `playView.ts`, to implement on the start screen                                         |
| Notice       | The conversation box's slot and panel: same rect and ink panel at 0.65, one or two `TYPE.body` cream lines centred in the box, no portrait or name tab, a tap on the box dismisses it; shows at once and holds the slot ahead of a conversation line, which resumes after; a newer notice replaces the current one in place. See [Conversation box](#conversation-box)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | `CONVERSATION_BOX`, `conversationBox.ts`, to implement; drawn by `notice.ts`                                                |
| Conversation | In-flight dialogue box below the weapon row: box top `HUD_AMMO_COUNT.clearance` (5) below the count pills' bottom, HUD rect top + 51.5 (63.5 at a top of 12), name tab top 10 higher (53.5), centred, `min(availableWidth, 480)` wide, 60 high, one 48 portrait slot, a name tab overhanging the top edge and up to two lines; the whole box is one press area; non-modal, no dim. See [Conversation box](#conversation-box)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | `CONVERSATION_BOX`, `conversationBox.ts`, to implement                                                                      |

### Touch controls by view

Rings are drawn edges; centres are rest centres; the shield pill sits on the
sticks' bottom, centred, at its three widths (162, 222 and 282 at Shield levels 1
to 3). Phone insets are left 43, right 43, top 0, bottom 19; the two
one-sided rows have no right inset, and their rings mirror on the larger
inset. "Clamped" names the edges the game-area clamp moved.

| Screen, insets              | Logical view, play view x | Move ring, x and y | Aim ring, x and y | Rest centres           | Clamped    | Shield pill x at levels 1, 2, 3; y                   | Use centre |
| --------------------------- | ------------------------- | ------------------ | ----------------- | ---------------------- | ---------- | ---------------------------------------------------- | ---------- |
| 720x360                     | 720x360, 0                | 60-133, 247-320    | 587-660, 247-320  | (96, 283), (623, 283)  | None       | 279-441, 249-471, 219-501; 292-320                   | (546, 183) |
| 720x360, phone insets       | 720x360, 0                | 103-176, 228-301   | 544-617, 228-301  | (139, 264), (580, 264) | None       | 279-441, 249-471, 219-501; 273-301                   | (503, 164) |
| 844x390                     | 779.08x360, 29            | 60-133, 247-320    | 646-719, 247-320  | (96, 283), (682, 283)  | None       | 308.54-470.54, 278.54-500.54, 248.54-530.54; 292-320 | (605, 183) |
| 844x390, phone insets       | 779.08x360, 29            | 103-176, 228-301   | 603-676, 228-301  | (139, 264), (639, 264) | None       | 308.54-470.54, 278.54-500.54, 248.54-530.54; 273-301 | (562, 164) |
| 844x390, bottom 19          | 779.08x360, 29            | 60-133, 228-301    | 646-719, 228-301  | (96, 264), (682, 264)  | None       | 308.54-470.54, 278.54-500.54, 248.54-530.54; 273-301 | (605, 164) |
| 720x360, left 43, bottom 19 | 720x360, 0                | 103-176, 228-301   | 544-617, 228-301  | (139, 264), (580, 264) | None       | 279-441, 249-471, 219-501; 273-301                   | (503, 164) |
| 844x390, left 47            | 779.08x360, 29            | 107-180, 247-320   | 599-672, 247-320  | (143, 283), (635, 283) | None       | 308.54-470.54, 278.54-500.54, 248.54-530.54; 292-320 | (558, 183) |
| 1280x720                    | 720x405, 0                | 60-133, 279-352    | 587-660, 279-352  | (96, 315), (623, 315)  | Bottom     | 279-441, 249-471, 219-501; 324-352                   | (546, 215) |
| 2400x1080                   | 800x360, 40               | 60-133, 247-320    | 667-740, 247-320  | (96, 283), (703, 283)  | None       | 319-481, 289-511, 259-541; 292-320                   | (626, 183) |
| 2404x1080 at dpr 2.5        | 801.33x360, 40            | 60-133, 247-320    | 668-741, 247-320  | (96, 283), (704, 283)  | None       | 319.67-481.67, 289.67-511.67, 259.67-541.67; 292-320 | (627, 183) |
| 2560x1080                   | 853.33x360, 66            | 74-147, 247-320    | 705-778, 247-320  | (110, 283), (741, 283) | Both sides | 345.67-507.67, 315.67-537.67, 285.67-567.67; 292-320 | (664, 183) |

Clearances that follow. "Below box" is Use's drawn ring top under the
conversation box's bottom (HUD rect top + 111.5, 123.5); the press circle
reaches into the box (the box wins the press) and stays clear of the weapon
count pills (bottom 58.5) and targets (bottom 52.5), six weapons; the pill gap
is from each stick ring's frame across (left/right where they differ), at Shield
levels 1, 2 and 3.

| Screen, insets              | Ring to game area, left, right, bottom |     Pill gap to ring frames, levels 1, 2, 3 | Pill above view bottom | Use below box | Press into box | Press to counts | Press to targets | Press to pill, levels 1, 2, 3 | Use to game area right |
| --------------------------- | -------------------------------------- | ------------------------------------------: | ---------------------: | ------------: | -------------: | --------------: | ---------------: | ----------------------------: | ---------------------: |
| 720x360                     | 60, 60, 40                             |                                145, 115, 85 |                     40 |          23.5 |           40.5 |            24.5 |             30.5 |           51.35, 32.31, 17.92 |                    137 |
| 720x360, phone insets       | 103, 103, 59                           |                                 102, 72, 42 |                     59 |           4.5 |           59.5 |             5.5 |             11.5 |            25.40, 13.60, 9.02 |                    180 |
| 844x390                     | 31, 30, 40                             | 174.54/174.46, 144.54/144.46, 114.54/114.46 |                     40 |          23.5 |           40.5 |            24.5 |             30.5 |           73.09, 50.97, 32.00 |                    107 |
| 844x390, phone insets       | 74, 73, 59                             |   131.54/131.46, 101.54/101.46, 71.54/71.46 |                     59 |           4.5 |           59.5 |             5.5 |             11.5 |           42.29, 25.13, 13.45 |                    150 |
| 844x390, bottom 19          | 31, 30, 59                             | 174.54/174.46, 144.54/144.46, 114.54/114.46 |                     59 |           4.5 |           59.5 |             5.5 |             11.5 |           73.09, 50.97, 32.00 |                    107 |
| 720x360, left 43, bottom 19 | 103, 103, 59                           |                                 102, 72, 42 |                     59 |           4.5 |           59.5 |             5.5 |             11.5 |            25.40, 13.60, 9.02 |                    180 |
| 844x390, left 47            | 78, 77, 40                             |     127.54/127.46, 97.54/97.46, 67.54/67.46 |                     40 |          23.5 |           40.5 |            24.5 |             30.5 |           39.75, 23.22, 12.41 |                    154 |
| 1280x720                    | 60, 60, 8                              |                                145, 115, 85 |                     53 |          55.5 |            8.5 |            56.5 |             62.5 |           51.35, 32.31, 17.92 |                    137 |
| 2400x1080                   | 20, 20, 40                             |                               185, 155, 125 |                     40 |          23.5 |           40.5 |            24.5 |             30.5 |           81.40, 58.45, 38.22 |                     97 |
| 2404x1080 at dpr 2.5        | 20, 19, 40                             | 185.67/185.33, 155.67/155.33, 125.67/125.33 |                     40 |          23.5 |           40.5 |            24.5 |             30.5 |           81.66, 58.69, 38.43 |                     96 |
| 2560x1080                   | 8, 8, 40                               | 197.67/196.33, 167.67/166.33, 137.67/136.33 |                     40 |          23.5 |           40.5 |            24.5 |             30.5 |           90.58, 66.85, 45.47 |                     85 |

`USE_DISC.fromAim` (-77, -100) clears at every view: the drawn ring stays under
the box and the press circle off the weapon counts and targets. Phone insets
are the tightest (4.5 and 5.5), because the bottom inset lifts the sticks and
Use by 19 while the box and weapons stay put; that margin is unchanged from the
previous rule.

Overlap rules:

- The top-left cluster is the pause button and the status pill; the top-right
  cluster is the weapons only. The pill's drawn rect and the pause press area
  keep at least `SPACING.pageInset` from the weapon press areas. The `+N`
  labels sit under their counts ([Status pill](#status-pill)), so they add
  nothing across. The pill's width follows its counts and segments
  ([Status pill](#status-pill)), from 44.90 ("0" alone) to 205.64 ("9999m"
  Stardust and ore, and cargo), the widest. The leftmost of six weapon targets
  starts at
  `hudRect.right + 7.5 - 48 - 57 * 5`:

  | View                        | Pill left | Leftmost of six targets | Pill may reach | Clearance at 205.64 |
  | --------------------------- | --------: | ----------------------: | -------------: | ------------------: |
  | 720x360, 1280x720           |     62.75 |                   382.5 |         303.75 |               98.11 |
  | 720x360, phone insets       |     93.75 |                   351.5 |         241.75 |               36.11 |
  | 844x390, phone insets       |     93.75 |                  410.58 |         300.83 |               95.19 |
  | Desktop, no pause, 720 wide |        12 |                   382.5 |          354.5 |              148.86 |

  "Pill may reach" is the leftmost target less `SPACING.pageInset` less the
  pill's left; the widest pill clears at every view with six weapons, so every
  narrower one does.

- The weapon count pills end at HUD rect top + 46.5 (58.5), 5 above the
  conversation box top; they stay inside their targets' columns (the widest,
  "999m", is 38.69 of 48), so they add nothing to the clusters' horizontal
  clearance.
- The `+N` labels sit just under their counts (line boxes HUD rect top + 33.5
  to + 53.5, over the item notice's row, + 34.5 to + 58.5) and draw over the
  conversation box and its name tab, in the item notice's layer
  ([Status pill](#status-pill)).
- Use's press circle reaches the conversation box's lower right (to + 111.5,
  123.5 at a top of 12): by 40.5 at the 720 base and 59.5 with phone insets.
  The conversation box always wins a press in the overlap. Use's drawn ring
  stays 23.5 below the box (4.5 with phone insets), and its press circle 24.5
  below the weapon count pills' bottom (HUD rect top + 46.5, so 58.5) and 30.5
  below the weapon targets (5.5 and 11.5 with phone insets, the tightest
  view); every view is in [Touch controls by view](#touch-controls-by-view).
- The sticks and Use show only on a touch screen, outside modals, as in Chibi.
  Desktop hides them with no hint; Space still activates Use.
- Press areas may reach past the HUD rect into a side inset (the pause press
  area 9.75, the outermost weapon target 7.5); drawn art never does.
- Sticks sit below the HUD row at every view; the view is at least 360 high.
- Press areas inside one cluster may overlap; `pressedArea` gives the press to
  the nearest drawn centre.
- The pause buttons, in flight and on Ada's room page
  ([Storybook page](#storybook-page)), are touch only; desktop pauses with
  Escape. While a modal card or storybook page shows, the flight pause button
  hides and the HUD takes no input under the dim. The conversation box is not modal: the
  pause button, weapons and sticks stay visible and live beside it.
- The conversation box's bottom (123.5) sits at least 24 above the ship's drawn
  top at the 360-high view (44.67).

### Status pill

Constants: `STATUS_PILL`, `playView.ts`, to implement. Colours and contrast
are in [Controls](controls.md#status-pill). Parts, left to right, each centred
on the pill's row:

| Part          | Geometry                                                                                                                                                                                                                                                 |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Panel         | `PILL`'s 28 height and radius 4, with `STATUS_PILL.padding` 6 at each end, tighter than `PILL.padding`; ink at 0.65, as the conversation panel                                                                                                           |
| Stardust icon | `icon-stardust-20`, nearest neighbour                                                                                                                                                                                                                    |
| Icon gap      | `STATUS_PILL.iconGap` 4 (`SPACING.rowGap`), from each icon to its count                                                                                                                                                                                  |
| Count         | Gameplay's count, at most five characters ("9999", "44.4k", "100k" to "9999k", "10m" and up), in `TYPE.label` on its 20 line with tabular figures, in a slot as wide as the count's own rendered width, at least one digit (`STATUS_PILL.minCount` 8.90) |
| Ore segment   | While Ada carries ore: a divider (`STATUS_PILL.dividerGap` 6, a 1x16 divider, 6), `icon-ore-20`, `STATUS_PILL.iconGap`, the ore count in its own slot                                                                                                    |
| Cargo segment | While she carries a job or story item or tows a craft, last: a divider and `icon-cargo-20` or `icon-tow-20`                                                                                                                                              |
| Width         | 36 plus the Stardust slot (6 + 20 + 4, the slot, 6); the ore segment adds 37 plus its slot (13 + 20 + 4), the cargo segment 33 (13 + 20). The left edge stays put and the right edge moves with the content                                              |

| State  | Trigger                      | Draw                                                                                                           | Timing                                                                                                                                                                            |
| ------ | ---------------------------- | -------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pickup | The Stardust count increases | The count shows the new total at once and bumps; a `+N` label in `TYPE.label` with a 1 px ink outline under it | Bump: scale 1 to 1.12 to 1, 200 ms ease-out, origin left centre, at most once per 200 ms. Label: holds 300 ms, then rises 4 and fades out over 300 ms ease-out; removed at 600 ms |
| Ore    | The ore count increases      | As Pickup, for the ore count and an ore `+N` label in the ore tick colour                                      | As Pickup                                                                                                                                                                         |

- Each `+N` label sits under its own count: its 20 line box top
  `STATUS_PILL.tick.top` 27 below the count's line box top, which is
  `(PILL.height + TYPE.label.lineHeight) / 2 + STATUS_PILL.tick.gap` with the
  gap 3 below the pill's bottom edge: HUD rect top + 33.5 (45.5), and centred
  across on its count's slot as it is in that frame: pill left + 30 +
  half the Stardust slot, and pill left + 67 + the Stardust slot + half the ore
  slot. It holds, rises 4 and fades as above, and follows its slot's centre
  when the slot changes. The two labels' centres are at least 45.90 apart (37
  plus half of each slot, both at the one-digit minimum). A label is never
  wider than "+" and its own count with the outline (11.34 plus the slot, as N
  is at most the count), so the two stay at least 25.66 apart. The bump is a
  transform: it never reflows the pill.
- Visible gap below the pill's bottom edge, to the glyphs' top (the round
  digits, 1430/2048 em above the baseline, 4.38 below the line box top) and to
  the 1 px ink outline above them: 7.38 and 6.38 at the start of the rise,
  3.38 and 2.38 at its end, 4 higher. The rise never carries the tick into the
  pill.
- The line box (+ 33.5 to + 53.5, rising to + 29.5 to + 49.5) overlaps the
  item notice's row (+ 34.5 to + 58.5) and the name tab's (+ 41.5 to + 61.5)
  as before; the labels still draw above the chip, the conversation box and
  the tab, their outline keeping them readable on each.
- The labels draw in the [item notice](#item-notice)'s layer, above its chip,
  over the field, the conversation box and its name tab, and under the pause
  button, the pill and the weapon buttons. A label shows at once: labels never
  join the notice queue, and a chip never waits for or moves round a label.
  Over a holding or flying chip the label's 1 px ink outline keeps it readable
  on the chip's opaque ink (gold 12.99:1, the ore tick 8.37:1).
- The pill shows during flight. It hides with the pause button while a modal
  card or storybook page shows. On desktop, where the pause button is hidden,
  the pill is the leftmost art and moves to the HUD rect's left edge, so the
  left side keeps `HUD_EDGE` in both input modes.
- A segment shows while it has something to show and leaves when empty, at
  once.
- The right edge snaps: a count change or a segment's arrival or departure
  resizes the pill in the same frame, with no width transition, and reduced
  motion changes nothing. Counts change often, and an animated edge would add
  motion to every pickup.
- Tabular figures (`font-variant-numeric: tabular-nums`) keep every digit one
  advance, so a count changes width only when its digit count or suffix does.
  The label font, Liberation Sans Bold, has no `tnum` feature, but its default
  digits are already tabular (each 1139/2048 em, 8.90 at 16 px); the property
  keeps fallback fonts tabular too.
- The minimum slot is one digit wide, so "0" keeps its icon and gap.

| Stardust | Ore     | Cargo or tow |  Width |
| -------- | ------- | ------------ | -----: |
| "0"      | None    | None         |  44.90 |
| "42"     | None    | None         |  53.80 |
| "9999"   | None    | None         |  71.59 |
| "44.4k"  | None    | None         |  76.04 |
| "100k"   | None    | None         |  71.59 |
| "9999m"  | None    | None         |  85.82 |
| "42"     | "18"    | None         | 108.59 |
| "9999"   | "18"    | Cargo        | 159.39 |
| "42"     | None    | Tow          |  86.80 |
| "44.4k"  | "100k"  | Cargo        | 181.63 |
| "9999m"  | "9999m" | None         | 172.64 |
| "9999m"  | "9999m" | Cargo or tow | 205.64 |

Slot widths: one digit 8.90, "k" 8.90, "m" 14.23, "." 4.45; the widest
count is "9999m" (49.82). The widest pill, 205.64, keeps 36.11 to the leftmost
of six weapon targets less `SPACING.pageInset` at 720x360 with phone insets
(it may reach 241.75), the tightest view. The ore segment holds ore
carried this flight; the cargo segment the carried job or story item or the
towed craft, one at a time.

- The pill takes no input. The counts are a status (Gameplay's Stardust and
  Ore labels, and the item or craft name for the cargo segment); the icons are
  decorative.

### Shield pill

Constants: `SHIELD_PILL`, `playView.ts`, to implement. Colours, the light-field
outline and contrast are in [Controls](controls.md#status-pill). Parts, left to
right, each centred on the pill's row; placement is in
[HUD and overlays](#hud-and-overlays):

| Part        | Geometry                                                                                                                                                                                                                                                                              |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Panel       | `PILL`: 28 high, radius 4, `PILL.padding` 8 at each end; ink at 0.65                                                                                                                                                                                                                  |
| Shield icon | `public/art/ui/icons/shield.svg`, 20 (`HUD_BUTTON.glyph`), a mask in the state's icon colour                                                                                                                                                                                          |
| Mark gap    | `SPACING.markGap`                                                                                                                                                                                                                                                                     |
| Shield bar  | `SHIELD_PILL.bar[level]` by 12: 1 rim around the track (ink at 0.65 over the panel), fill area `bar - 4` by 8 at inset 2                                                                                                                                                              |
| Delay strip | While the recharge delay runs: 2 high on the fill area's bottom 2 rows (bar y 8 to 10), from the fill area's left (x 2) for `(bar - 4) * elapsed / delay`, so it reaches the full 116, 176 or 236 when recharge starts; a 1 px ink edge (bar y 7 to 8) along its top, the same length |
| Width       | `bar + 42`                                                                                                                                                                                                                                                                            |

The bar's length follows Shield level, so each upgrade visibly lengthens it
(Gameplay: capacity 10, 15 and 20):

| Shield level | `SHIELD_PILL.bar` | Fill area | Pill width |
| -----------: | ----------------: | --------: | ---------: |
|            1 |               120 |     116x8 |        162 |
|            2 |               180 |     176x8 |        222 |
|            3 |               240 |     236x8 |        282 |

The fill area maps the current capacity to its length, so a full bar fills it
at every level. Fill width is `(bar - 4) * shield / capacity`. Two marks extend it to the right: the delay part,
from the fill end to the delay mark (the shield value just before the first
hit since the delay part was last clear), and the flash, over one hit's lost
part. The bar draws in CSS at logical units, like the HUD buttons,
with fractional widths.

| State  | Trigger                                   | Draw                                                                                                                    | Timing                                                                                                                                 |
| ------ | ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Normal | 25% of capacity or more, not regenerating | Fill, rim and icon in their normal colours                                                                              | Static                                                                                                                                 |
| Hit    | The shield drops                          | The lost part (new value to old) in the flash colour                                                                    | One flash, 100 ms, then the part joins the delay part. A flash starts at most once per 334 ms; a hit inside that window does not flash |
| Delay  | From a hit until regeneration starts      | The delay part in the delay colour, and the delay strip filling left to right                                           | Gameplay's recharge delay, 30 s after the last hit at every Shield level                                                               |
| Regen  | The delay ends, until the shield is full  | The delay part clears at once; the fill grows (Gameplay: 18 per s) with a 2 px leading edge inside the fill's right end | The edge shows while regenerating and is removed at capacity                                                                           |
| Low    | Above 0 and below 25% of capacity         | Fill in the low colour; icon and rim pulse; a delay part keeps the delay colour                                         | Pulse: low colour to the pulse peak and back, sine, 1000 ms per cycle, while low; ends at once at 25%                                  |
| Empty  | The shield reaches 0                      | Empty track; icon and rim in the low colour, no pulse                                                                   | Held until the depletion outcome: Astra's jump home, or (upgrade selected) the refill, which draws full at once with no flash or edge  |

Clearances, at every Shield level and view: at least 42 from each stick ring's
frame across. The tightest is level 3 at the 720 base with phone insets (and
with a left 43 and bottom 19 inset), 42; level 3 gives 85 at the 720 base and
71.46 at 844x390 with phone insets. The pill keeps 40 above the
bottom inset and home bar, or 8 above the game area's bottom where the sticks'
clamp applies (53 above the view's bottom at 1280x720). Use's press circle stays
9.02 or more clear of it (17.92 at the 720 base and 9.02 with phone insets at
level 3). Every view and level is in
[Touch controls by view](#touch-controls-by-view).

Delay strip (`SHIELD_PILL.delayStrip`), Gameplay's recharge timer:

Rects relative to the bar's top-left corner (the rim's outer edge), at full
length; `p` is `elapsed / delay`:

| Shield level | Bar    | Ink edge, x y w h | Strip, x y w h   |
| -----------: | ------ | ----------------- | ---------------- |
|            1 | 120x12 | 2, 7, `116 p`, 1  | 2, 8, `116 p`, 2 |
|            2 | 180x12 | 2, 7, `176 p`, 1  | 2, 8, `176 p`, 2 |
|            3 | 240x12 | 2, 7, `236 p`, 1  | 2, 8, `236 p`, 2 |

The strip sits entirely inside the fill area, on its bottom 2 rows, with its
ink edge on the row above, rather than on the rim or straddling the 1 px track
gap under the fill. Inside the fill area it has a dark edge on both sides, its ink above and
the track gap below, so the white reads over the fill, the low fill, the delay
part and the track alike; it spans exactly the fill area, so 100% of the strip
means the same length as a full bar; and it stays clear of the rim, which
changes colour with the low-shield pulse. While it shows, the fill keeps its
top 5 rows (bar y 2 to 7).

- It shows only while the recharge delay runs: the shield is below capacity and
  not regenerating. It is hidden while the shield is full or regenerating.
- It grows linearly with Gameplay's delay timer, `elapsed / delay` of the fill
  area's width, so `(bar - 4) / 30` px/s over Gameplay's 30 s delay, with
  fractional widths: 3.87, 5.87 and 7.87 px/s at Shield levels 1 to 3.
- At full, recharge starts: the strip hides at once, with no fade, and the
  regeneration edge takes over.
- Damage restarts the delay and empties the strip at once, the same frame as
  the hit flash; it grows again from 0. Nothing else resets it.
- Layers, bottom to top: track, fill, delay part, hit flash, then the strip and
  its ink edge, all inside the rim. The low-shield pulse changes only the icon
  and rim, so it never covers or recolours the strip; the strip's colours are
  the same in every state.
- Light field: it sits inside the bar's ink outline, with no edge of its own
  beyond its ink top.
- Reduced motion: unchanged, a steady fill with no pulse or easing.
- It is a meter detail: the bar's accessible value is unchanged, and the strip
  is decorative.

- The pill shows during flight on touch and desktop alike, and hides while a
  modal card or storybook page shows.
- The pill takes no input. The bar is a meter (Gameplay's shield label, value
  and capacity); the icon is decorative.

### Item notice

Constants: `ITEM_NOTICE`, `itemNotice.ts`, to implement. Colours, icons and
contrast are in [Controls](controls.md#item-notice). Gameplay's rule: every
gain but Stardust and ore shows one, queued one at a time.

| Part     | Geometry                                                                                                                                                                 |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Chip     | `ITEM_NOTICE.height` 24, radius 4, opaque ink, a 1 rim inside the edge                                                                                                   |
| Contents | `PILL.padding` 8, the 20 icon centred on the chip's row (2 above and below), `SPACING.markGap` 6, the label, 8                                                           |
| Label    | `TYPE.label` on its 20 line, one line; width = 42 + the label                                                                                                            |
| Top      | `ITEM_NOTICE.top`: HUD rect top + 34.5 (46.5), `SPACING.rowGap` (4) below the pill's bottom; bottom + 58.5 (70.5)                                                        |
| Across   | Centred on the destination's centre x, then clamped: left edge at least the pill's left edge, right edge at most the leftmost weapon target's left - `SPACING.pageInset` |
| Layer    | Over the field and the conversation box, under the pause button, the pill, the `+N` labels and the weapon buttons; `pointer-events: none`                                |

Destinations, at HUD rect top + 16.5 (the HUD row's centre line) on the y axis:

| Gain                                           | Destination centre x                                                                                                                                                   |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Job, story or lost item, a tow                 | The cargo segment's icon: pill left + pill width - 16                                                                                                                  |
| New weapon, a weapon's ammo                    | That weapon's disc: its target's left + 24                                                                                                                             |
| Holodisk                                       | None; the chip centres on the pill and fades in place                                                                                                                  |
| Weapon level                                   | That weapon's disc: its target's left + 24                                                                                                                             |
| Shield level                                   | The shield pill's shield icon: the shield pill's left + 18, on the pill's centre line (y 306 at the 720 base, 287 with phone insets, 338 at 1280x720), not the HUD row |
| Engine level, Tractor beam level, paint scheme | None; the chip centres on the pill and fades in place, as a holodisk's                                                                                                 |

A Shield level's fly runs the same curve to the bottom centre: across under
the HUD row, then down to the shield pill, under the pill's icon as it lands;
the pill's icon bumps on arrival. The widest upgrade label, "+ Heavy Missile
level 3" (172.12), fits the 199.75 room of six weapons at 720x360 with phone insets.

The cargo segment and a new weapon's disc appear at pickup (Gameplay), so the
row may already have shifted; the fly reads the destination each frame and
lands where it is.

The pill's right edge moves with its counts (see [Status pill](#status-pill)).
The chip's hold position is set when it appears, from the pill's width then,
and does not follow later changes; the clamp uses only the pill's left edge and
the weapon row, so a moving right edge never pushes a chip. The fly reads the
cargo segment's centre each frame, so it lands where the segment is at arrival.

Motion, one notice at a time:

| Phase    | Duration                                | Easing                                        | Motion                                                                                                                                                                                                                                                                                   |
| -------- | --------------------------------------- | --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Appear   | 180                                     | Ease-out, `cubic-bezier(0.33, 1, 0.68, 1)`    | Opacity 0 to 1 and `translateY` -8 to 0: out from under the pill                                                                                                                                                                                                                         |
| Hold     | 1200, or 600 while another notice waits | None                                          | Still                                                                                                                                                                                                                                                                                    |
| Collapse | 140                                     | Ease-in-out, `cubic-bezier(0.65, 0, 0.35, 1)` | The label fades out over the first 84; the panel shrinks to the 24 square round the icon (left edge + 6, width to 24); the icon stays put                                                                                                                                                |
| Fly      | 300                                     | Ease-in-out, as Collapse                      | The square's centre follows a quadratic curve from the icon's centre (chip left + 18, HUD rect top + 46.5) through the control point (destination x, start y + 6) to the destination centre; the panel and rim fade 1 to 0, the icon stays opaque and passes under the destination's art |
| Arrive   | 200                                     | Ease-out                                      | The chip is removed; the cargo segment's icon or the weapon's glyph bumps, scale 1 to 1.12 to 1, origin centre, as the count's bump                                                                                                                                                      |

A holodisk's notice replaces Collapse, Fly and Arrive with one 300 ease-out
phase that rises 4 and fades out in place. A notice takes 1820 from appear to
landing, a holodisk's 1680. Under reduced motion every notice fades in over
150 linear, holds as above and fades out over 150 linear, in place, with no
collapse, fly or bump.

- Queue: notices show in gain order; the next appears `ITEM_NOTICE.gap` 120
  after the previous one lands or fades. When a gain queues during a hold,
  that hold ends at 600 if still ahead, else at once.
- Merge: a gain with the same label as a waiting or holding notice joins it;
  the label shows the total, "+ Rapid Missile ammo ×2", and a holding notice
  restarts its hold. Once a notice's Collapse starts, an identical gain queues
  a new one. The chip keeps its centring rule and moves at once to fit its
  new width.
- The chip hides with the pill while a modal card or storybook page shows,
  and its timeline pauses until play resumes. Leaving flight clears the queue.
- The chip never waits for the conversation box. It covers at most the box's
  top 7 (63.5 to 70.5) and, when it sits over one, part of a name tab (53.5
  to 73.5); a two-line text block's first line box starts 3 below it.
- Across, the chip shares rows with the weapon count pills (to + 46.5) and
  the pause press area (to + 42.75); the clamp keeps it 16 from every weapon
  target, and its left edge is the pill's, 8 right of the pause press area.

Label room (the clamp's width less 42), with the pause button showing; with
it hidden the pill starts 50.75 further left and the room grows by as much:

| View                  | Pill left | Four weapons |   Five |    Six |
| --------------------- | --------: | -----------: | -----: | -----: |
| 720x360, 1280x720     |     62.75 |       375.75 | 318.75 | 261.75 |
| 720x360, phone insets |     93.75 |       313.75 | 256.75 | 199.75 |
| 844x390               |     91.75 |       376.83 | 319.83 | 262.83 |
| 844x390, insets 43    |     93.75 |       372.83 | 315.83 | 258.83 |

The widest labels: "+ Heavy Missile ammo ×9" 193.00 (6.75 to spare in the
smallest room), "+ Drifting lamp buoy" 155.12, "+ Heavy Missile" 118.74. A
label wider than its room draws in `TYPE.body` instead ("+ Heavy Missile ammo
×99" is 201.90 bold and 192.96 regular); it never wraps or truncates.

Holds at the 720 base, with the pause button showing:

| Case                                                  | Chip           |     Destination centre | Clearance to the leftmost target |
| ----------------------------------------------------- | -------------- | ---------------------: | -------------------------------: |
| "+ Spare parts", "1200" and "18", cargo, four weapons | 134.23, 278.05 |         206.14 (cargo) |                           218.45 |
| "+ Scrap barge", "1200", tow, four weapons            | 77.21, 225.48  |           151.34 (tow) |                           271.02 |
| "+ Phaser", the fifth weapon                          | 314.34, 423.50 |        691.50 (Phaser) |                     16 (clamped) |
| "+ Holodisk", "1200" and "18", four weapons           | 64.27, 187.62  |          125.95 (pill) |                           308.88 |
| "+ Heavy Missile ammo ×9", insets, six                | 100.50, 335.50 | 546.50 (Heavy Missile) |                     16 (clamped) |

### Weapon count pill

Constants: `HUD_AMMO_COUNT`, `playView.ts`, to implement; it replaces the
placeholder count label (idle lavender, 38 to 58 below the target top).
Colours, states and contrast are in [Controls](controls.md#ammunition-count).
Each owned non-Laser weapon's `HUD_BUTTON` carries one pill showing Gameplay's
ammunition count string; Laser shows none.

| Part     | Geometry                                                                                                                                                            |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Panel    | Opaque ink, `HUD_AMMO_COUNT.height` 14, radius 4, `HUD_AMMO_COUNT.padding` 4 at each end, no border                                                                 |
| Width    | The count's width plus 8, sized to its text: 14.67 at "0", 34.70 at "9999", 38.69 at "999m" (the widest)                                                            |
| Text     | The count in `TYPE.count` (12 bold) on its 14 line, centred in the pill                                                                                             |
| Position | Centred on the disc horizontally; top `HUD_AMMO_COUNT.top` 40 below the target top (HUD rect top + 32.5, so 44.5)                                                   |
| Box      | Relative to the target's top-left: `x = 24 - w / 2`, `y = 40`, `w` = count width + 8, `h = 14`; so `x` 16.66 and `w` 14.67 at "0", `x` 4.65 and `w` 38.69 at "999m" |
| Vertical | Spans HUD rect top + 32.5 to + 46.5 (44.5 to 58.5); overlaps the disc's lower edge (+ 33) by 0.5; digit ink from + 35.3 to + 43.8, wholly below the disc            |
| Layer    | A child of the weapon button, drawn over the disc; it takes no input and moves with the button's shake                                                              |

- Position rule: the pill overlaps the disc's lower edge by 0.5. Its bottom
  is HUD rect top + 46.5, and the conversation box top sits
  `HUD_AMMO_COUNT.clearance` (5) below it. Its lower 6 lie below the target,
  outside the press area.
- Count strings fit one line at every value: the widest pill (38.69) leaves
  9.31 inside the 48 target and 18.31 between neighbouring pills.

### Edge markers

Constants: `EDGE_MARKERS`, `EDGE_MARKER_GLYPHS`, `src/data/edgeMarkers.ts`;
glyphs and colours in [Space palette](space-palette.md#edge-markers). Each
marker's centre is where the ray from the view's centre toward its object meets
the marker rect: the game area intersected with
`safeRect(insets, SAFE_MARGIN.edge, view)`, moved in on every side by
`edgeMarkerInset`, the glyph's half extent plus the light-field outline (1 on
a light field, 0 on a dark one) plus `EDGE_MARKERS.gap` 1. So every marker's
outermost drawn pixel sits 1 inside the safe game area, never under a notch,
a curved corner or the home bar.

| Kind                     | Half extent | Inset, dark | Inset, light |
| ------------------------ | ----------: | ----------: | -----------: |
| Enemy                    |           3 |           4 |            5 |
| Heavy, guard and station |           5 |           6 |            7 |

Safe game area and the centre lines of the 10-across kinds (dark field; on a light
field each line moves 1 further in, and an enemy's lines sit 2 further out):

| View                  | Safe game area, x and y | Left, right centres | Top, bottom centres | Corners                                        |
| --------------------- | ----------------------- | ------------------- | ------------------- | ---------------------------------------------- |
| 720x360, 1280x720     | 0 to 720, 0 to 360      | 6, 714              | 6, 354              | (6, 6), (714, 6), (6, 354), (714, 354)         |
| 720x360, phone insets | 43 to 677, 0 to 341     | 49, 671             | 6, 335              | (49, 6), (671, 6), (49, 335), (671, 335)       |
| 844x390               | 29 to 749, 0 to 360     | 35, 743             | 6, 354              | (35, 6), (743, 6), (35, 354), (743, 354)       |
| 844x390, insets 43    | 43 to 736.08, 0 to 341  | 49, 730.08          | 6, 335              | (49, 6), (730.08, 6), (49, 335), (730.08, 335) |

Phone insets are 43 left and right, 0 top and 19 bottom. The marker rect takes
each edge's own inset, so a one-sided notch moves only its side.

Clearance along the edges, from the band the 10-across markers can occupy
(dark field; a light field's band is 2 deeper):

| Edge and control                                 | 720x360 | Phone insets | 844x390 | 844x390, insets 43 |
| ------------------------------------------------ | ------: | -----------: | ------: | -----------------: |
| Top band to the pause and weapon discs           |       1 |            1 |       1 |                  1 |
| Side band to the pause and weapon discs          |       1 |      11 over |       1 |            11 over |
| Side band to the stick rings                     |      29 |      11 over |      29 |                 15 |
| Bottom band to the sticks and shield pill bottom |      29 |           29 |      29 |                 29 |

- Markers draw under the sticks (`STICK_DEPTHS`) and the HTML HUD, so an
  overlap hides part of a marker and never covers a control.
- Top band: 1 to 11 on a dark field and 1 to 13 on a light one; the discs start
  at 12, so a light-field marker directly behind a disc loses 1 row to it.
- With phone insets the side bands (44 to 54, or 44 to 56 lit) share their
  columns with the pause disc and the outermost weapon disc, which start at
  the same 43 inset: a side marker in the HUD row's span (12 to 58.5, count
  pills included) sits under that disc. At 720x360 with phone insets the stick
  rings start at the 43 inset too, so a side marker in the rings' span (228 to 301) sits under the open ring's band, and shows through its clear centre.
- The shield pill and the Use disc sit 29 or more from every band.

### Loading bar

A thin status line for loading, shared by every game through game-kit (the
progress state and its DOM progress bar). Constants: `LOADING_BAR`,
`src/ui/loadingBar.ts`.

It shows for startup (the boot preload), entering a galaxy (its art before the
flight) and the first-visit offline download (the precache and the service
worker's install, as unknown progress with the travelling segment). Small
downloads during play, such as on-demand art fetched ahead, show no bar.

| Token    | Value                                                                              | Rule                                                                                                 |
| -------- | ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Position | The logical view's top edge, x 0 to the view width, y 0 to 3                       | The view, not the game area: it spans the bands and ignores the safe insets                          |
| Height   | 3: the fill and track 2 high (y 0 to 2) over the rule 1 high (y 2 to 3)            | Logical px (`calc(var(--ada-unit) * N)`)                                                             |
| Rule     | Opaque ink `#181425`, the full view width, along the bar's bottom                  | In every galaxy, whenever the bar shows; it fades and goes with the bar                              |
| Layer    | Above all UI, the modal dim included                                               | Takes no input (`pointer-events: none`)                                                              |
| Fill     | The UI cream `#ead4aa`, opaque, from the left, 2 high                              | Width `value * view width` for known progress                                                        |
| Track    | Ink `#181425` at 0.6, 2 high                                                       | The unfilled part while the bar shows                                                                |
| Known    | Fills to 100%, holds 250 ms, then fades out over 150 ms                            | Then the element is removed                                                                          |
| Unknown  | game-kit's travelling segment in the 2 high band, 30% of the width (`segment` 0.3) | The kit's cycle; it ends at once when the work ends. Reduced motion keeps the segment, as in the kit |
| Idle     | Nothing shows: no element, no track                                                | A new load mounts the bar again                                                                      |

- HUD clearance: the bar ends at y 3. The HUD rows' drawn art starts at
  `HUD_EDGE` (12), 9 below it; the Map's HUD row, the highest drawn art, at
  4.5, 1.5 below. Press areas that reach above 3 (the pause press area from
  2.25) stay live, since the bar takes no input.
- Contrast: the fill is 11.55:1 on its track over the dark field `#292734` and
  10.11:1 on the field, so the bar reads by its fill there. Over Sunflower's
  `#D8C994` the fill is 1.14:1 on the field but 12.44:1 on the ink rule under
  it, and the rule 10.90:1 on the field, so a full bar still reads; the fill
  is 4.51:1 on its track and the track 3.95:1 on the field.
- Kit support: game-kit 0.29.0's DOM progress bar draws the 0.6 track, the
  250 ms hold and the 150 ms fade. Its frame border runs on every side, so the
  bottom-only ink rule needs a kit option or Ada CSS on the bar's bottom edge;
  `LOADING_BAR` does not carry it yet.

## Screens

Each screen lists its anchor and groups in order. Every distance comes from a
token above; strings are Gameplay's.

### Cards

| Screen        | Groups (top to bottom)                                                                                                                                                                                                                         | Scroll group |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| Settings      | Header, close. Control rows (switch rows, then the Install row with its compact action). Cheats launcher (single action). Build label, supporting                                                                                              | Rows         |
| Install steps | Header, close. Step rows: row icon, `SPACING.gap`, wrapped body text, rows `SPACING.rowGap` apart (not buttons), height fits text (not controls)                                                                                               | Steps        |
| Update offer  | Header, close. Action row: decline (secondary), accept (primary)                                                                                                                                                                               | None         |
| Cheats        | Header, close. Per scope a section group: heading (`TYPE.label`), persistence (supporting prose), `SPACING.rowGap`, then items `SPACING.gap` apart, each an action stack of one with its description (supporting prose) `SPACING.rowGap` below | Sections     |
| Paused        | Header, close. Control grid, two columns: Map and Ship, then Settings and Back to title. Resume (primary, full width)                                                                                                                          | None         |
| Paused (room) | Header, close. Action stack: Settings, Back to title                                                                                                                                                                                           | None         |
| Ship          | Header, close. Cargo section. Equipment section ([Ship card](#ship-card))                                                                                                                                                                      | None         |
| Station card  | Header, close. Balance. Keeper block ([Station card](#station-card)). Action row: Undock, Jobs, Shop                                                                                                                                           | None         |
| Shop          | Header, close. Balance. Tabs (action row). Item list (control grid)                                                                                                                                                                            | Item list    |
| Job board     | Header, close. Balance. Intro (supporting prose, centred). Refusal line (supporting prose, when shown). Job list (one column of job rows)                                                                                                      | Job list     |
| Buy confirm   | Header, close. Item well. Description (weapons). Price. Remaining (supporting). Action row: Cancel, Buy                                                                                                                                        | None         |
| Achievements  | Header, close. Entry list, two columns ([Achievements card](#achievements-card)). Pager: Previous, the page count, Next                                                                                                                        | None         |

The Paused card shows no objective or job lines. Its flight card puts the
four other actions in a two-column control grid, then Resume across the inner
width below it: the five do not fit one row of the 328 inner width, so they
take the grid, and Resume, the primary and the fifth, ends the group at the
bottom, full width: tiles `(360 - 32 - BUTTON_GAP) / 2` = 156 wide ("Back to title" needs
122.69), `BUTTON_GAP` across and `STACK_BUTTON_GAP` down. Five stacked
actions would be `58 + 272 + 16` = 346 high, past the 325 available. At
720x360 with phone insets the flight card is `58 + 48 + 8 + 48 + 8 + 48 + 16`
= 234 high, y 61.5 to 295.5, and the room card `58 + 104 + 16` = 178, y 89.5
to 267.5, both 360 wide, inside the 325 available. Ada's room page opens the room card from its pause button
([Storybook page](#storybook-page)).

### Station card

The station card's welcome is its keeper's block, the
[conversation box](#conversation-box)'s panel inside the card: the speaker,
lines and press behaviour players know from flight. Keepers, portraits and
tab colours are in [Station](station.md#keepers); the lines are Gameplay's
(`gameplay/player-copy.md` "Greeters").

| Part     | Geometry                                                                                                                                                         |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Card     | Content-fitted: the block's 480 plus `2 * CARD_CONTENT.padding`, 512 wide; header 58, the balance's 20 line, then the groups `SPACING.gap` apart                 |
| Block    | `CONVERSATION_BOX` geometry: 480 wide, 60 high, ink `#181425` at 0.65 over the card face, square corners; the name tab's 10 overhang above it                    |
| Portrait | The keeper's compact portrait (22) at 2x (44), nearest neighbour, in the 52 frame (2 ink edge, navy `#262b44` face), `padding` 4 from the panel's inner right    |
| Name tab | `CONVERSATION_BOX.tab`: 20 high, the name in `TYPE.label` ink, `SPACING.markGap` either side, 1 ink edge, radius 2, 8 in from the panel's left, 10 above its top |
| Lines    | `TYPE.body` cream, left-aligned, at most two 20 lines, centred on the panel as the conversation box's; text column 408, or 374 while the pips show               |
| Pips     | First docking only: three 6 discs, 4 apart (26 wide), `SPACING.gap` right of the text column, centred on the last line box                                       |
| Height   | `58 + 20 + 8 + 10 + 60 + 8 + 48 + 16` = 228                                                                                                                      |

| View                  | Available  | Card    | Card top | Scroll |
| --------------------- | ---------- | ------- | -------: | ------ |
| 720x360               | 688x328    | 512x228 |       66 | None   |
| 720x360, phone insets | 634x325    | 512x228 |     64.5 | None   |
| 844x390, insets 43    | 693.08x325 | 512x228 |     64.5 | None   |
| 1280x720 (720x405)    | 688x373    | 512x228 |     88.5 | None   |

Docking states:

| State         | Lines                                                                           | Pips                                                           | Press                                                                                   |
| ------------- | ------------------------------------------------------------------------------- | -------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| First docking | The galaxy's three greeting lines, one at a time                                | Shown lines cream `#ead4aa`, coming lines 1 px `#b8b3c9` rings | The block advances one line per tap; the third line holds and the block stops advancing |
| Later docking | One short line, the galaxy's three in turn                                      | None                                                           | None: the block is a status                                                             |
| Phantom       | Gameplay's generic welcome, centred in the panel's width less `2 * SPACING.gap` | None                                                           | None; no portrait or tab                                                                |

- A line replaces the last in place, as the conversation box's do, with no
  transition, so reduced motion changes nothing. The pips are static.
- On the third line the block stops being a button and becomes a status. If
  it had focus, focus moves to Shop, where the card's focus starts.
- Undock, Jobs and Shop stay live throughout; the block never blocks them, and
  closing the card or leaving for the shop or job board ends the greeting where
  it is (Gameplay saves greetings seen per place).
- While the block advances it is one button, the panel and its name tab, named
  by Gameplay's next-line label, with the shared focus ring; Tab reaches it
  before the action row. The pips are decorative (`aria-hidden`); the line is
  the block's text.
- Every first-docking line fits two lines in 374 (the widest, Needle's "We Avi
  stand still a long time before we move. It is how we see clearly.", 500.65,
  wraps to two), and every later line two lines in 408.
- Contrast: cream lines 10.80:1 on the block over the card face (`#242134`),
  the coming-line rings 7.70:1; tab labels 7.71:1 or more on every keeper's tab.

### Achievements card

The start screen's Achievements opens a content-fitted card titled
"Achievements" with the close X, spaced as Chibi's (`chibis-way-home`
`src/data/layout.ts` `ACHIEVEMENTS_CARD`, `src/ui/layout/achievementsCard.ts`).
Constants: `ACHIEVEMENTS_CARD`, `achievements-card.ts`.

| Part       | Geometry                                                                                                                                                                                                                                        |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Card       | `min(availableWidth, 2 * column + columnGap + 2 * CARD_CONTENT.padding)`, centred in the available rect; 672 where 688 is available                                                                                                             |
| Header     | The list's top 50 below the card's top: the close X's press area bottom (42) plus `SPACING.gap`. The title's cap height sits midway between the frame's inner top (2) and the first name's cap top (54.54), so its 28 line box starts 14.2 down |
| Columns    | Two, filled down each column then across; each `min(312, (availableWidth - 2 * CARD_CONTENT.padding - columnGap) / 2)` wide, badge included                                                                                                     |
| Column gap | `SPACING.panelPadding` 16                                                                                                                                                                                                                       |
| Entry      | 60 high, fixed: three 20 body lines, the name's and two condition lines                                                                                                                                                                         |
| Badge      | 16, centred on the name's 20 line (2 above and below), `SPACING.gap` 8 from the text column                                                                                                                                                     |
| Name       | `TYPE.label`, one line; a locked counted entry's `{have}/{need}` in `TYPE.body` at the line's right end, `SPACING.gap` 8 from the name                                                                                                          |
| Condition  | `TYPE.body`, in the text column under the name, at most two lines                                                                                                                                                                               |
| Row gap    | `SPACING.gap` 8                                                                                                                                                                                                                                 |
| Rows       | As many as fit, as in Chibi: `floor((room + 8) / 68)`, room = available height - 50 - `SPACING.gap` - `TEXT_BUTTON.height` - 16; every page keeps the first page's rows                                                                         |
| Pager      | `SPACING.gap` below the list: Previous and Next `TEXT_BUTTON` faces at the inner width's ends, the page count centred between them                                                                                                              |

| View                  | Available  | Card          | Column | Rows | Card top |
| --------------------- | ---------- | ------------- | -----: | ---: | -------: |
| 720x360               | 688x328    | 672x318, x 24 |    312 |    3 |       21 |
| 720x360, phone insets | 634x325    | 634x318, x 43 |    293 |    3 |     19.5 |
| 844x390, insets 43    | 693.08x325 | 672x318       |    312 |    3 |     19.5 |
| 1280x720 (720x405)    | 688x373    | 672x318, x 24 |    312 |    3 |     43.5 |

Card height at three rows: `50 + 3 * 60 + 2 * 8 + 8 + 48 + 16` = 318, inside
every available height, so the card never scrolls.

- Where the available rect is narrower than 688, the columns narrow; the card
  never scales, as a label never shrinks to fit (Chibi's view is a fixed
  720x360 with no card insets, so its card is always 672). At 634 each column
  is 293 and its text column 269: the widest name with a count, "Friends
  Everywhere" with "99/99", is 200.11, and the longest condition, "Make every
  optional ally: quest and project allies." (348.60), wraps to two lines, so
  every entry keeps its three lines.
- Every condition fits two lines at both column widths; a condition that
  needed a third would be a copy change for Gameplay, not a taller entry.

### Ship card

The Paused card's Ship opens a content-fitted card titled "Ship" with the
close X; the close X, back and Escape return to Paused. It lists what Ada
carries and her equipment in two sections, each a section heading
(`TYPE.label`, supporting `#b8b3c9`, on a 20 line), `SPACING.rowGap`, then
rows. Strings are Gameplay's. Constants: `SHIP_CARD`, to implement.

| Token                 | Value | Rule                                                                                   |
| --------------------- | ----- | -------------------------------------------------------------------------------------- |
| `SHIP_CARD.columnGap` | 16    | Between the two columns of both sections (see [Exceptions](#exceptions))               |
| `SHIP_CARD.column`    | 279   | Each column: the widest row, a weapon's (below)                                        |
| `SHIP_CARD.row`       | 20    | A row: a 20 icon and one 20 line; rows `SPACING.rowGap` apart                          |
| `SHIP_CARD.icon`      | 20    | The row icon at the column's left, `SPACING.markGap` to the label                      |
| `SHIP_CARD.valueGap`  | 8     | `SPACING.gap` between a label and its value, and between a level and the ammunition    |
| `SHIP_CARD.ammo`      | 55.14 | The ammunition column: "999 left" in `TYPE.label`, right-aligned at the column's right |

Rows: the label in `TYPE.body` cream `#ead4aa`; a count right-aligned at the
column's right in `TYPE.label` cream; a level ("Level {n} of 3")
right-aligned in `TYPE.body` supporting `#b8b3c9`, at the column's right or,
on a weapon row, `SHIP_CARD.valueGap` left of the ammunition column. A label
wider than its column wraps and grows its row by 20; it never shrinks.

1. Cargo: a two-column grid, left to right then down: Stardust
   (`icon-stardust-20`, count), Ore (`icon-ore-20`, the ore carried this
   flight), "Holodisks: {n} of 6" (`icon-holodisk-20`), and, when there is
   one, "Carrying: {item}" (`icon-cargo-20`) or "Towing: {craft}"
   (`icon-tow-20`).
2. Equipment, two columns. Left: Shield (`icon-shop-shield`), Engine
   (`icon-shop-engine-tuning`), Tractor beam (`icon-shop-tractor-beam`), each
   with its level, then "Paint: {paint}" (`icon-shop-ship-paint`). Right: every
   owned weapon in Ada's weapon order (Laser, Multi-Laser, Rapid Missile,
   Heavy Missile, Scattershot, Phaser), its 20 vector icon as a cream mask
   ([Weapon icons](weapon-icons.md)), its level and, apart from Laser, "{count}
   left". The shop icons draw their `normal` frame.

Widths: a weapon row is `20 + 6 + 98.69 + 8 + 82.73 + 8 + 55.14` = 278.56 at
"Heavy Missile", "Level 3 of 3" and "999 left", so a column is 279 and the
inner width `2 * 279 + 16` = 574, the card 606 wide. The widest left rows are
211.28 (Tractor beam with its level) and 189.02 ("Carrying: Watering can").

Height: `58 + 68 + 8 + (20 + 4 + rows) + 16`, with Cargo two rows (`20 + 4 +
20 + 4 + 20` = 68) and Equipment the taller column: six weapons `6 * 20 + 5 *
4` = 140, so 314 at most; Laser alone with the four left rows, 266.

| At 720x360, view px | No insets            | Phone insets             |
| ------------------- | -------------------- | ------------------------ |
| Available           | 688 by 328           | 634 by 325               |
| Card                | (57, 23) 606x314     | (57, 21.5) 606x314       |
| Cargo row tops      | 105 and 129          | 103.5 and 127.5          |
| Equipment row tops  | 181 to 301, 24 apart | 179.5 to 299.5, 24 apart |

It fits without scrolling at every supported view; at 844x390 with phone
insets the card is (86.54, 21.5) on the 779.08-wide view.

Map, from the Paused card, is a full-screen map rather than a card: the
galaxy's field under the insets, a header panel on the Map's HUD row at the
HUD rect's left (the name, then the pips over the percent), Quests and Return
to Earth on the same row, a column of `HUD_BUTTON` tools on its top-right and the place panel
on the available rect's bottom. Quests opens a Quests modal card over it. Its tokens
(`MAP_SCREEN`, `MAP_PANEL`, `MAP_SYMBOL`), fit, press areas and states are in
[Map](map.md). Close, back and Escape return
to Paused.

The balance is one centred group: `icon-stardust-20`, `SPACING.markGap`, the
amount in `TYPE.label`, on a 20 line. The shop's row and well geometry is in
[Shop item row](#shop-item-row).

### Start screen

A full screen modelled on Chibi's start screen (`chibis-way-home`
`src/ui/layout/startScreen.ts`, `START_SCREEN`): Ada's ship in flight above the
two-line wordmark, the action row under it, then the note. There is no card,
header, dim or portrait; the Ada and Penny portraits and the start card are
removed. Art, colours and contrast are in [Title screen art](title-screen.md).
The HUD row's top right holds Achievements then Settings, left to right, at
`hudButtonTarget(1)` and `hudButtonTarget(0)`, in the
[nav disc states](achievements-icon.md#states). Where the platform can close the
app, Exit takes `hudButtonTarget(0)` and the other two move one pitch left, to
`hudButtonTarget(2)` and `hudButtonTarget(1)`. Nothing moves with the saved
state except the action row's contents.

Every part except the field and the nav discs is placed in play-view px, from
`playView(view)`'s top-left (`x0`, 0), so it stays centred on the game area at
every aspect.

| Token             | Value                                               | Rule                                                                                                                | Constant                                    |
| ----------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| Field             | `title-field`, 960x540, top-left (-120, 0)          | Under everything; the space background fills beyond it                                                              | `titleScreen.field.at`, `title-screen.json` |
| Ship              | 280 square frame centred on (378, 84)               | The selected paint's `ship-26` with speed jets at `titleScreen.ship.jetSpeed` (0.8)                                 | `START_SCREEN.ship`, `startScreen.ts`       |
| Wordmark          | `title-wordmark`, 270x102, top-left (225, 148)      | Centred on the play view (`360 - 270 / 2`); Chibi's logo top is 60 under its nav bar                                | `START_SCREEN.wordmark`, `startScreen.ts`   |
| Action row        | Top 264, buttons 192 wide, `TEXT_BUTTON.height`     | 14 below the wordmark (Chibi's 15 from logo to actions); Chibi's row is at 268                                      | `START_SCREEN.actions`, `startScreen.ts`    |
| Start             | x 264 (`360 - 192 / 2`)                             | Primary, `ui-button-primary`; first run only                                                                        | `START_SCREEN.actions`                      |
| Restart, Continue | x 160 and 368 (`360 - 192 - 8`, `360 + 8`)          | With saved progress: Restart secondary (`ui-button`) on the left, Continue primary on the right, `BUTTON_GAP` apart | `START_SCREEN.actions`                      |
| Note              | One `TYPE.body` line box, top 320, centred on x 360 | Cream `#ead4aa`, no panel or shadow; `SPACING.gap` below the action row                                             | `START_SCREEN.note`, `startScreen.ts`       |

- Labels and actions are Gameplay's: Start, Continue, Restart and the
  `deferred` note; the wordmark's accessible name is the `home` string.
- Continue (or Start) is the default Enter and Space action and the first Tab
  stop, then Restart, Achievements, Settings and Exit, as in Chibi. Each button's
  face box is its press area (at least 48 per axis); the 16 gap separates
  Restart and Continue.
- Draw order: field, jets, ship frame, wordmark, actions, note, nav discs.
- Taller views (1280x720 is 720x405) keep every part at its play-view place
  from the top and show more field below; the field covers to 540.

Rects in logical px. Insets are left and right 43, bottom 19, top 0; at 844x390
the logical view is 779.08x360 and `x0` is 29.

| Part                    | 720x360                     | 720x360, insets             | 844x390                       | 844x390, insets               |
| ----------------------- | --------------------------- | --------------------------- | ----------------------------- | ----------------------------- |
| HUD rect                | 12 to 708, top 12           | 43 to 677, top 12           | 41 to 738.08, top 12          | 43 to 736.08, top 12          |
| Available rect          | 16 to 704, 16 to 344        | 43 to 677, 16 to 341        | 16 to 763.08, 16 to 344       | 43 to 736.08, 16 to 341       |
| Field                   | -120 to 840, 0 to 540       | -120 to 840, 0 to 540       | -91 to 869, 0 to 540          | -91 to 869, 0 to 540          |
| Ship frame              | 238 to 518, -56 to 224      | 238 to 518, -56 to 224      | 267 to 547, -56 to 224        | 267 to 547, -56 to 224        |
| Ship ink                | 226.3 to 484, 48 to 141     | 226.3 to 484, 48 to 141     | 255.3 to 513, 48 to 141       | 255.3 to 513, 48 to 141       |
| Wordmark                | 225 to 495, 148 to 250      | 225 to 495, 148 to 250      | 254 to 524, 148 to 250        | 254 to 524, 148 to 250        |
| Start                   | 264 to 456, 264 to 312      | 264 to 456, 264 to 312      | 293 to 485, 264 to 312        | 293 to 485, 264 to 312        |
| Restart                 | 160 to 352, 264 to 312      | 160 to 352, 264 to 312      | 189 to 381, 264 to 312        | 189 to 381, 264 to 312        |
| Continue                | 368 to 560, 264 to 312      | 368 to 560, 264 to 312      | 397 to 589, 264 to 312        | 397 to 589, 264 to 312        |
| Note line box           | Centre 360, 320 to 340      | Centre 360, 320 to 340      | Centre 389, 320 to 340        | Centre 389, 320 to 340        |
| Achievements            | 610.5 to 658.5, 4.5 to 52.5 | 579.5 to 627.5, 4.5 to 52.5 | 640.58 to 688.58, 4.5 to 52.5 | 638.58 to 686.58, 4.5 to 52.5 |
| Settings                | 667.5 to 715.5, 4.5 to 52.5 | 636.5 to 684.5, 4.5 to 52.5 | 697.58 to 745.58, 4.5 to 52.5 | 695.58 to 743.58, 4.5 to 52.5 |
| With Exit: Achievements | 553.5 to 601.5, 4.5 to 52.5 | 522.5 to 570.5, 4.5 to 52.5 | 583.58 to 631.58, 4.5 to 52.5 | 581.58 to 629.58, 4.5 to 52.5 |
| With Exit: Settings     | 610.5 to 658.5, 4.5 to 52.5 | 579.5 to 627.5, 4.5 to 52.5 | 640.58 to 688.58, 4.5 to 52.5 | 638.58 to 686.58, 4.5 to 52.5 |
| With Exit: Exit         | 667.5 to 715.5, 4.5 to 52.5 | 636.5 to 684.5, 4.5 to 52.5 | 697.58 to 745.58, 4.5 to 52.5 | 695.58 to 743.58, 4.5 to 52.5 |

Clearances, smallest at 720x360 with insets:

| Pair                                 | Arithmetic    | Result                                   |
| ------------------------------------ | ------------- | ---------------------------------------- |
| Ship ink to Achievements             | `579.5 - 484` | 95.5, beside the HUD row, never under it |
| Ship ink to Achievements, Exit shown | `522.5 - 484` | 38.5                                     |
| Wordmark to Achievements             | `579.5 - 495` | 84.5 (114.58 at 844x390 with insets)     |
| Wordmark to Achievements, Exit shown | `522.5 - 495` | 27.5 (57.58 at 844x390 with insets)      |
| Ship ink to wordmark                 | `148 - 141`   | 7                                        |
| Wordmark to the action row           | `264 - 250`   | 14                                       |
| Action row to the note               | `320 - 312`   | 8, `SPACING.gap`                         |
| Note to the available rect bottom    | `341 - 340`   | 1 (4 without a bottom inset)             |
| Restart to the available rect        | `160 - 43`    | 117                                      |

- The focus ring (4 outside a face) stays inside the 16 gap and the 14 above
  the row; the press areas of the nav discs are their targets, 9 apart (discs
  24 apart).
- The nav targets are `hudButtonTarget`s: Settings's disc has its drawn right
  edge and top on the HUD rect's corner, and its target reaches 7.5 past it
  (into the 43 inset with phone insets). The start screen has no pause button,
  so its top-left corner is empty.

### Shop item row

A `ui-button-tile` at `TEXT_BUTTON.height`, content centred on each state's
face. Constants: `SHOP_ROW`, `shopCard.ts`, to implement.

| Part          | Geometry                                                                                                       |
| ------------- | -------------------------------------------------------------------------------------------------------------- |
| Row inset     | `SPACING.gap` from both row ends                                                                               |
| Item well     | 36x36 at the left inset                                                                                        |
| Glyph offset  | 20 icons at 8, the 24 upgrade composite at 6, the 32 paint swatch at 2, inside the well                        |
| Name block    | `SPACING.gap` right of the well; one 20 line, or two with the level or pack line                               |
| Trailing slot | Right inset, centred vertically; one width for every row: the widest price pill, Owned or In use               |
| Price pill    | `PILL` with `icon-stardust`, `SPACING.markGap`, the price in `TYPE.label`; every pill one width                |
| Owned, In use | `icon-shop-check` (12x8), `SPACING.markGap`, the label in `TYPE.label`, right-aligned                          |
| Row width     | inset + well + gap + widest name, level or pack line + gap + slot + inset; one width across every tab          |
| Paint heading | `icon-shop-ship-paint` (20), `SPACING.markGap`, `TYPE.label`, on a 20 line, `SPACING.gap` above the paint rows |
| Confirm well  | 56x56; glyph at 2x by nearest neighbour (40, or 48 for the upgrade composite), swatch 48, centred              |
| Confirm price | `icon-stardust-20`, `SPACING.markGap`, the price in `TYPE.heading`                                             |

### Job board row

A `ui-button-tile` at `TEXT_BUTTON.height`, the item row's parts with a
[compact row action](controls.md#compact-row-action) in the trailing slot.
Constants: `SHOP_ROW` and the job list's style in `src/ui/station.ts`.

| Part           | Geometry                                                                                             |
| -------------- | ---------------------------------------------------------------------------------------------------- |
| Row inset      | `SPACING.gap` from both row ends                                                                     |
| Well           | 36x36 at the left inset, the 20 job glyph at 8                                                       |
| Text block     | `SPACING.gap` right of the well: the title over the detail, two 20 lines                             |
| Trailing slot  | Right inset, centred vertically: the reward pill (or Active), `SPACING.gap`, then the compact action |
| Compact action | 72 x 28, or the label plus 8 px insets when wider; every row's action one width                      |
| Row width      | inset + well + gap + widest title or detail + gap + slot + inset; one width for every row            |
| List           | One column, rows `STACK_BUTTON_GAP` apart, the focus outset around it and the scroll reserve kept    |

At 720x360 the widest Sunflower row, "Deliver spare parts to the salvagers'
yard" with a two-digit reward, is about 495 wide and the card about 550, inside
the 688 available; three offers fit without scrolling. At 844x390 with phone
insets a held job, three busy offers and the refusal line exceed the 325
available, and the job list scrolls.

### Storybook page

Earth scenes, and space story pages that pause flight. One panel holds a text
column and a choice column side by side, bottom-anchored over the scene and
only as tall as its page needs; the scene shows in the strip above it.
Constants: `STORY_PANEL` and `STORY_BACKGROUND`, `storyPage.ts`;
`STORY_BUTTON`, `controls.ts`; `STORY_SKIP` and `STORY_PANEL_TOP`,
`playView.ts`; all to implement at the values below.

| Token          | Value                                                                                                                                                                                                                                                                                                                                                                                 | Rule                                                                                                                                                                                                                                                                                                           |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Background     | 960x540 logical canvas at 2x ([storybook](storybook.md)), scale `k = max(1, viewW / 960, viewH / 540)`, nearest neighbour, under the insets, centred across                                                                                                                                                                                                                           | Offset down by the run anchor below, so the subject shows in the strip                                                                                                                                                                                                                                         |
| Run anchor     | Canvas top `y = clamp(viewH - 540 * k, stripTop / 2 - k * (subject.top + subject.bottom) / 2, 0)`, `stripTop` the panel top of the tallest page in the story run on that background                                                                                                                                                                                                   | The subject band's centre sits at the centre of the strip above that panel; the clamp keeps the canvas covering the view. One placement per story run and background, so the background never moves between its pages, Previous across a scene boundary included; a shorter page shows more of the scene below |
| Subject band   | `subject: { top, bottom }` in canvas logical px, on each background's manifest entry ([storybook](storybook.md#subject-bands))                                                                                                                                                                                                                                                        | The rows the scene's key objects span                                                                                                                                                                                                                                                                          |
| Panel rect     | The available rect's width, at most `STORY_PANEL.maxWidth` 760, centred; bottom on the available rect's bottom                                                                                                                                                                                                                                                                        | `ui-settings-card` face, no dim behind it                                                                                                                                                                                                                                                                      |
| Panel height   | `2 * padding + max(text column content, choice column content)`                                                                                                                                                                                                                                                                                                                       | The width and bottom edge stay fixed; the top moves with each page's content                                                                                                                                                                                                                                   |
| Panel top cap  | `STORY_PANEL_TOP`: the HUD row's lowest press area plus `SPACING.gap`: y 60.5 (Skip and Settings end at 52.5), y 62.75 on Ada's room page (the pause press area ends at 54.75)                                                                                                                                                                                                        | Past it the panel stops growing and only the text column scrolls                                                                                                                                                                                                                                               |
| Padding        | `STORY_PANEL.padding` = `SPACING.panelPadding` 16, including the 2 frame                                                                                                                                                                                                                                                                                                              | Inner width = panel width - 32                                                                                                                                                                                                                                                                                 |
| Columns        | Text column, `STORY_PANEL.columnGap` 25, choice column                                                                                                                                                                                                                                                                                                                                | The gap holds a 1 rule in card rim `#6b6685`, 12 from each column, over the full inner height                                                                                                                                                                                                                  |
| Choice column  | `clamp(228, 0.38 * (inner width - 25), 300)` (`STORY_PANEL.choiceColumn` share, min, max)                                                                                                                                                                                                                                                                                             | The text column takes the rest: 349 to 428, about 43 to 53 characters of `TYPE.story` per line; the 228 floor seats Previous and Continue side by side                                                                                                                                                         |
| Text content   | The heading if present, the name tab and portrait if present, then the paragraph                                                                                                                                                                                                                                                                                                      | Its height includes the portrait frame where the frame is taller                                                                                                                                                                                                                                               |
| Choice content | The choices, `SMALL_BUTTON_GAP` 24, then the page controls; a page without choices holds the page controls alone                                                                                                                                                                                                                                                                      | The page controls are one 36 row; a named action that does not fit beside Previous takes its own row 24 below it (36 + 24 + 36 = 96)                                                                                                                                                                           |
| Story text     | `TYPE.story` 18 regular on 26, cream `#ead4aa` on the card `#3b3850` (7.76:1), left-aligned, top of the column                                                                                                                                                                                                                                                                        | Liberation Sans averages 8.02 per character at 18; never shrinks                                                                                                                                                                                                                                               |
| Heading        | The chapter's panel title (Gameplay's copy) on opening, resolution and closing pages: `TYPE.heading` 24 bold on 28, white `#ffffff` on the card (11.25:1), left-aligned, the column's first line                                                                                                                                                                                      | `SPACING.gap` above the paragraph, so it adds 36 to the text column; the widest title ("The Glowing Rock.", 216) fits every measure on one line                                                                                                                                                                |
| Name tab       | `CONVERSATION_BOX.tab`: 20 high, label width + `2 * SPACING.markGap`, 1 ink edge, radius 2, `TYPE.label` in ink                                                                                                                                                                                                                                                                       | The speaker's tab colour ([Controls](controls.md#conversation-box)); the column's first line, `SPACING.gap` above the paragraph                                                                                                                                                                                |
| Portrait       | `STORY_PANEL.portrait`: the 32 storybook frame at 2x (64), nearest neighbour, in a 68 frame (2 ink edge, navy `#262b44` face)                                                                                                                                                                                                                                                         | Floated on the column top: at the inner right for every speaker but Ada, at the inner left for Ada; never mirrored                                                                                                                                                                                             |
| Portrait gap   | `SPACING.gap` to the text, `SPACING.rowGap` below                                                                                                                                                                                                                                                                                                                                     | The name tab and the paragraph wrap beside the frame, then take the full measure below it                                                                                                                                                                                                                      |
| Choices        | `STORY_BUTTON` secondary, filling the choice column, stacked from its top, faces `SMALL_BUTTON_GAP` 24 apart (a 60 pitch)                                                                                                                                                                                                                                                             | `hitAround` grows a 36 face 9 per side (54), so neighbouring press areas stay 6 apart, each at least `HIT_RULE.minTarget` 48                                                                                                                                                                                   |
| Page controls  | One row on the choice column's bottom: Previous (secondary) at the left, Next or Continue (primary) at the right, each `(choice column - 24) / 2` wide, `SMALL_BUTTON_GAP` 24 apart; a row because both fit side by side at their own widths ([Controls](controls.md#buttons))                                                                                                        | 102 to 119 wide; at their own widths (label + 32) Previous is 99.59, Next 66.68 and Continue 101.32, so Previous and Continue need 224.91 of the 228 floor                                                                                                                                                     |
| Named action   | A page's named action in Next's place: beside Previous, on its right, when both fit the choice column at their own widths with the 24 gap; otherwise on its own row 24 below Previous, filling the choice column                                                                                                                                                                      | At their own widths "Touch the glow." (151.98), "Pick up the rock." (160.04) and "Let's find your holodisk." (216.26) need 275.57, 283.63 and 339.85 beside Previous, past every choice column (228 to 262.23), so all three go below Previous at all four screens                                             |
| Scroll         | The text column scrolls when the panel reaches its top cap; the choices scroll only past the choice limits below. Each scrolling region reserves `SCROLL` 14 on its right (6 gap, 8 track, thumb inset 1)                                                                                                                                                                             | Text never shrinks and never paginates; the page controls stay fixed                                                                                                                                                                                                                                           |
| Skip           | `STORY_SKIP`, `playView.ts`: a compact secondary button (`TEXT_BUTTON.compactHeight`) in the top-right HUD row, centred on the row's centre line (top HUD rect top + 2.5, so 14.5 to 42.5); its right edge `SMALL_BUTTON_GAP` (24) left of the Settings disc (57 in from the HUD rect's right) when Settings shows, otherwise its drawn right edge on the HUD rect's top-right corner | Always visible on story pages; not one of the page controls                                                                                                                                                                                                                                                    |
| Settings       | The `HUD_BUTTON` disc with its drawn edges on the top-right corner of the edge rect; the 48 target centred on it (7.5 outside the disc)                                                                                                                                                                                                                                               | The start screen's Settings disc, at the same place on every story page                                                                                                                                                                                                                                        |
| Pause          | Ada's room page only: `PAUSE_BUTTON`, its disc's drawn edges on the top-left corner of the edge rect (frame 1 outside), press `hitAround(frame)` 52.5; it opens the room's Paused card (Settings, Back to title)                                                                                                                                                                      | The top-left of the HUD row; Skip and Settings keep the top-right                                                                                                                                                                                                                                              |

The edge rect is `playView(view)` inset by 12, intersected with
`safeRect(insets, 12, view)`: the top-corner controls' drawn edges sit 12 from
the game area's top corners, mirrored left and right, as Chibi's `HUD_EDGE`.
The 12 edge gap is the HUD symmetry rule (`HUD_EDGE`), the same at both top
corners.

Rects in logical px, as x range by y range. Phone insets are left and right
43 and bottom 19 logical; the 844x390 row with insets is an iPhone. The panel's
top is its bottom minus its height.

| Screen   | Logical view | Insets     | Panel x, bottom          | Text column         | Rule x | Choice column           | Settings disc, target                               | Skip face                   |
| -------- | ------------ | ---------- | ------------------------ | ------------------- | ------ | ----------------------- | --------------------------------------------------- | --------------------------- |
| 720x360  | 720x360      | 43, 43, 19 | 43..677 (634), 341       | 59..408 (349)       | 420    | 433..661 (228)          | 644..677 x 12..45; 636.5..684.5 x 4.5..52.5         | 556.5..628.5 x 14.5..42.5   |
| 844x390  | 779.08x360   | 43, 43, 19 | 43..736.08 (693.08), 341 | 59..453.37 (394.37) | 465.37 | 478.37..720.08 (241.71) | 703.08..736.08 x 12..45; 695.58..743.58 x 4.5..52.5 | 615.58..687.58 x 14.5..42.5 |
| 844x390  | 779.08x360   | None       | 16..763.08 (747.08), 344 | 32..459.85 (427.85) | 471.85 | 484.85..747.08 (262.23) | 704..737 x 12..45; 696.5..744.5 x 4.5..52.5         | 616.5..688.5 x 14.5..42.5   |
| 1280x720 | 720x405      | None       | 16..704 (688), 389       | 32..423.22 (391.22) | 435.22 | 448.22..688 (239.78)    | 675..708 x 12..45; 667.5..715.5 x 4.5..52.5         | 587.5..659.5 x 14.5..42.5   |

Panel height and top by page:

| Page                                                           | 720x360, insets | 844x390, insets | 844x390  | 1280x720 |
| -------------------------------------------------------------- | --------------- | --------------- | -------- | -------- |
| One line, Next only                                            | 68, top 273     | 68, top 273     | 68, 276  | 68, 321  |
| One line, a named action below Previous ("Pick up the rock.")  | 128, top 213    | 128, top 213    | 128, 216 | 128, 261 |
| Three-line narration (78 text over a 36 control row)           | 110, top 231    | 110, top 231    | 110, 234 | 110, 279 |
| The longest: chapter one's resolution (206)                    | 228, top 113    | 228, top 113    | 228, 116 | 228, 161 |
| Gameplay's limit case: 220 characters, heading and two choices | 228, top 113    | 228, top 113    | 208, 136 | 228, 161 |
| Astra's three questions with Continue (the tallest)            | 248, top 93     | 248, top 93     | 248, 96  | 248, 141 |

Story buttons follow the button gap rule (to implement): buttons smaller than
the 48 standard keep `SMALL_BUTTON_GAP` 24 between faces in any direction,
standard buttons `BUTTON_GAP` 16 side by side and `STACK_BUTTON_GAP` 8 stacked.
The 36 story buttons are small, so the choices, the page-control row and a
named action's row below Previous stack 24 apart, and Previous and Next sit 24
apart. The garden
opening's choice column is 56 + 24 + 56 + 24 + 36 = 196 (both labels wrap; 176
at 844x390 without insets, where the first fits one line) beside its text
column: the 36 heading and six lines in the 349 column (192), or five in the
wider ones (166). Astra's three questions with Continue need 3 * 36 + 2 * 24 +
24 + 36 = 216, so 248 with the padding, the tallest page, under the 280.5 cap at
360-high views: every page fits without scrolling.

Gameplay's copy, by group:

| Group      | Pages | Pages in it                                                                                    |
| ---------- | ----- | ---------------------------------------------------------------------------------------------- |
| Chapters   | 26    | Chapter one 12 (with the first launch's garden arrival and farewell), chapters two and three 7 |
| Prologue   | 26    | 23 lines, the Archie and Kiwi page among them, and Astra's 3 answers                           |
| Ada's room | 2     | The room page and the empty visit's                                                            |
| Boarding   | 3     | The room narration, Astra's line and her new-galaxy line                                       |
| Overnight  | 3     | Night, the sleep scene and morning                                                             |

That is 60 pages, 59 of them with text: the sleep scene has none. The longest is chapter
one's resolution at 206 characters, a 228 panel at all four screens. Gameplay's limit is 220 characters: with the
heading and two wrapped choices it is six lines in the 349 column and five in
the wider ones, a 192 or 166 text column beside the 196 choice column (176 at
844x390 without insets), so panels of 228, 228, 208 and 228 at the four screens
above, under their caps of 280.5, 280.5, 283.5 and 328.5.

The limits give, not the layout. A wrapped label adds 20 to its face (56). At
720x360 with insets the cap is 341 - 60.5 = 280.5, so the choice column may
hold 280.5 - 32 = 248.5:

| Choices            | Choice column                        | Panel | Fits |
| ------------------ | ------------------------------------ | ----- | ---- |
| Three on one line  | 3 * 36 + 2 * 24 + 24 + 36 = 216      | 248   | Yes  |
| Three, one wrapped | 56 + 2 * 36 + 2 * 24 + 24 + 36 = 236 | 268   | Yes  |
| Three, two wrapped | 2 * 56 + 36 + 2 * 24 + 24 + 36 = 256 | 288   | No   |
| Three, all wrapped | 3 * 56 + 2 * 24 + 24 + 36 = 276      | 308   | No   |
| Two, both wrapped  | 2 * 56 + 24 + 24 + 36 = 196          | 228   | Yes  |

So a page with three choices keeps every label on one line: at most 196 of
`TYPE.label` in the 228 column (its width less the 2 * 16 label inset), about
23 characters. Labels wrap to two lines only on pages with at most two choices.
If copy ever exceeds this, the choices scroll as the text column does, in their
own region reserving `SCROLL` 14, with the page controls fixed below.

Page structure:

1. Text column: the heading (opening, resolution and closing pages only), the
   name tab and the portrait (dialogue only), then the paragraph. Narration
   shows no tab and no portrait; the paragraph fills the measure. Other pages
   show no heading.
2. Choice column: the choices (choice page only, two or three), then 24, then
   the page controls: Previous with the page's primary on its right, or a
   named action on its own row below Previous when the two do not fit side by
   side. A choice page has no primary; Previous keeps its left half.
   Previous uses the disabled face on the story run's first page. A question
   page shows its remaining questions as choices with Continue in Next's
   place. Narration pages leave the choice column empty apart from Previous
   and Next.

Behaviour:

- The background's placement is fixed for a story run and background before
  the run's first page shows, from the tallest page in the run on it: the run's
  pages are those of every scene it chains (the chain `moveStory` follows from
  the run's start). Ada's room keeps one placement from the room page through
  boarding. A rock glow
  transition draws its frames at the outgoing page's placement and cuts to the
  incoming page's. A composite background with a `base` (a
  [story figure](storybook.md#story-figures) page or the overnight sleep
  scene) is placed as its base: the run anchor counts its pages as pages on
  the base. The sleep scene's cross-fade to the morning draws each image at
  its own page's placement.
- Speaker portraits follow [Conversation portraits](conversation.md): Astra
  plays her speaking loop while her page shows; Ada and Penny show the mood
  Gameplay marks. The tab and portrait carry the speaker.
- Focus order: the text column (focusable only while it scrolls; arrow keys
  scroll it), the choices top to bottom, Previous, then the page's primary
  (Next, Continue or the named action), then the HUD row (the room's pause button,
  Skip, Settings). Disabled Previous is skipped. Initial focus is the first
  choice, the default, or else Next or the named action. Every control is
  always in view.
- Reduced motion: the same layout and placements. Page changes are instant in
  both modes, so the panel's top moves at once; portraits hold their loop's
  first frame; the rock glow and overnight sequences play their reduced-motion
  steps with the panel hidden, as in [storybook](storybook.md).
- A space story page that pauses flight uses the same panel over the paused,
  dimmed space view, without a background. In-flight lines use the
  [conversation box](#conversation-box), which neither pauses nor dims.

### Conversation box

In-flight dialogue: one line at a time from one speaker, over live flight.
Constants: `CONVERSATION_BOX`, `conversationBox.ts`, to implement. Colours are in
[Controls](controls.md#conversation-box); portraits are in
[Conversation portraits](conversation.md). Chibi's dialogue panel uses the same
values with its own sprites and fonts, and the same vertical rule: the box top
sits 5 below the lowest drawn art of the top-right HUD row (Ada's count pills)
and the name tab overhangs it by 10.

| Token          | Value                                                                                          | Rule                                                                                                                                                                                                                           |
| -------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Width          | `min(availableWidth, CONVERSATION_BOX.maxWidth)`, max 480                                      | Centred on the available rect; 480 at every supported view (the page rect is at least 634 wide)                                                                                                                                |
| Top            | The count pills' bottom plus `HUD_AMMO_COUNT.clearance` (5) (`CONVERSATION_BOX.top`)           | HUD rect top `- 7.5 + 40 + 14 + 5` = + 51.5, so 63.5 without a top inset; the same rule in both games                                                                                                                          |
| Tab top        | Box top minus `CONVERSATION_BOX.tab.overhang` (10)                                             | HUD rect top + 41.5, so 53.5 without a top inset                                                                                                                                                                               |
| Height         | `CONVERSATION_BOX.height` = frame 52 + `2 * CONVERSATION_BOX.padding` = 60                     | Fixed; the box never grows                                                                                                                                                                                                     |
| Padding        | `CONVERSATION_BOX.padding` = 4, from the panel edge to the portrait frame                      | The text column keeps `SPACING.gap` from the frame and from the far edge                                                                                                                                                       |
| Panel          | Ink `#181425` at alpha 0.65, square corners                                                    | No border, nine-slice or dim; the tab, lines and portrait draw fully opaque over it                                                                                                                                            |
| Portrait slot  | `CONVERSATION_BOX.portrait.slot` 48x48, navy `#262b44` face                                    | The shared slot: Chibi's 48 portraits fill it at 1x                                                                                                                                                                            |
| Portrait frame | `CONVERSATION_BOX.portrait.frame` 52: a 2 ink edge around the slot, `padding` from the panel   | Ada at the inner left, every other speaker at the inner right; never mirrored                                                                                                                                                  |
| Portrait       | A 22x22 compact frame at 2x (44), nearest neighbour, centred in the slot (2 inset)             | Integer scale at every `s`                                                                                                                                                                                                     |
| Text column    | `SPACING.gap` from the frame and `SPACING.gap` from the far edge: box width - 72               | 408 at 480; 464 (box width - 16) for a speaker without a portrait                                                                                                                                                              |
| Lines          | `TYPE.body`, cream, left-aligned, wrapped at word breaks to at most `CONVERSATION_BOX.lines` 2 | Never shrinks; every Gameplay line fits one 408 line (the widest is 339)                                                                                                                                                       |
| Text block     | The lines centred on the panel                                                                 | Line box top 20 below the box top for one line, 10 for two                                                                                                                                                                     |
| Name tab       | `CONVERSATION_BOX.tab`: 20 high, label width + `2 * SPACING.markGap`; 1 ink edge, radius 2     | `TYPE.label` in ink, `SPACING.markGap` (6) from the tab's left, centred on its 20 line                                                                                                                                         |
| Tab position   | `tab.overhang` 10 above the panel top and 10 inside it                                         | Every speaker's tab at the panel's left end: `tab.inset` 8 from it when the portrait is on the right or absent, and just past the portrait frame, `padding + frame + SPACING.gap` = 64, when the portrait is on the left (Ada) |

- The tab draws over the panel's top edge. Its 10 inside the panel sit above
  the text block's top line box, so it never covers text.
- The box is one press area, the panel and the name tab together. Each line
  shows for 5 s or until tapped; a tap shows the next line, and the last tap
  closes the conversation (Gameplay's rule). The box holds no other controls.
  It shows only during flight; one box shows at a time, and the next line
  replaces the current one in place.
- Slot priority (Gameplay's rule), highest first: warning (including the
  General's broadcasts), notice, lesson, Penny, lore, save status. A
  higher-priority item takes the slot at once; a notice over an ordinary line
  shows at once, and the line resumes after it.
- Save status is persistent and lowest: it yields the slot to every other item
  and returns when they clear. It stays non-interactive.
- Notices use the same box without a portrait or tab: one or two `TYPE.body`
  lines centred in the box width minus `2 * SPACING.gap` (464). The whole box
  is its press area: a tap dismisses the notice, otherwise it clears on its own
  (Gameplay's rule).
- Both sides use the same left-aligned text column; the frame changes ends
  with the speaker, and the tab always sits at the left end, over the text
  column's top-left and above its first line box.
- A speaker without a portrait (Gameplay's Grower, Miner, Salvager, Station,
  Whale family and Workshop) gets no portrait frame or slot: the text column
  takes the slot's width, `SPACING.gap` from each end of the panel (464 at
  480), and the name tab keeps the left end. Story pages treat those speakers
  alike: no portrait, and the text fills the inner width.
- Clearance at the 360-high view: the box spans 63.5 to 123.5. The ship's
  pivot sits at the view centre (180) with a 42 display frame; its highest
  drawn hull point across the 32 headings is 168.17 (heading 4, the apex),
  44.67 below the box. The rule is at least 24.
- At the 1280x720 view (720x405 logical) the box bottom is still 123.5 and the
  hull top 190.67, 67.17 below.

#### Tab clearance

The tab spans HUD rect top + 41.5 to + 61.5 (53.5 to 73.5). Vertically it
clears the status pill (bottom + 30.5) by 11, the weapon discs (bottom + 33) by 8.5 and the weapon targets (bottom +
40.5) by 1; it shares rows only with the count pills (+ 32.5 to + 46.5) and
the pause press area (to + 42.75). Across, the box is centred and 480 wide;
Ada's tab ("Ada", 42.23) starts 64 in and every other tab 8 in, the widest
"General Gadget" (131.15). With six weapons the leftmost target is Laser's
(target 5, no count pill) and the leftmost count pill is target 4's.

| View                  | Box              | Ada's tab        | Widest other tab | Pause press right | Target 5 left | Target 4 (pill centre)                               | Nearest across                     |
| --------------------- | ---------------- | ---------------- | ---------------- | ----------------- | ------------- | ---------------------------------------------------- | ---------------------------------- |
| 720x360, 1280x720     | 120 to 600       | 184 to 226.23    | 128 to 259.15    | 54.75             | 382.5         | 439.5 (463.5)                                        | 73.25 to pause, 123.35 to target 5 |
| 720x360, phone insets | 120 to 600       | 184 to 226.23    | 128 to 259.15    | 85.75             | 351.5         | 279-441, 249-471, 219-501; 273-301                   | 42.25 to pause, 92.35 to target 5  |
| 844x390               | 149.54 to 629.54 | 213.54 to 255.77 | 157.54 to 288.69 | 83.75             | 412.58        | 308.54-470.54, 278.54-500.54, 248.54-530.54; 292-320 | 73.79 to pause, 123.89 to target 5 |
| 844x390, insets 43    | 149.54 to 629.54 | 213.54 to 255.77 | 157.54 to 288.69 | 85.75             | 410.58        | 467.58 (491.58)                                      | 71.79 to pause, 121.89 to target 5 |

- No overlaps: every tab ends at least 92.35 left of any weapon column and
  starts at least 42.25 right of the pause press area, the two it shares rows
  with; the status pill ends above the tab. The `+N` labels and the item notice
  draw over it.
- Ada's tab starts 8 right of her portrait frame (`4 + 52`); the 10 of every
  tab inside the panel stay above the text block's first line box.
- The status pill keeps `SPACING.pageInset` from the weapon press areas at
  every width above.

### Galaxy selector

A route map over the [route sky](route-sky.md), after Chibi's zone map: six
galaxy markers left to right along one arc over the night sky, a panel for the
chosen galaxy, and Earth and Jump below it.
Constants: `GALAXY_MAP`, `GALAXY_MAP_PANEL`, `GALAXY_MAP_ACTIONS` and `GALAXY_MAP_MOVE`,
`routeMap.ts`, to implement. Positions are logical px from the play view's
top-left (add `playView.x`, 29 at 779 wide); "insets" means the phone insets 43
left and right and 19 bottom at 720x360. Route order, numbers, names and
flavour lines are Gameplay's; marker colours and previews are in
[Galaxies](galaxies.md#markers).

Chart (`GALAXY_MAP`):

| Part           | Geometry                                                                                                                                                                                                                                                                                                                                                                                      |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Backdrop       | `route-sky`, top-centre on the play view's top-centre, and `route-ground` with Ada and Penny, bottom on the view's bottom, at 1x under the insets ([route sky](route-sky.md)); no ink layer: the sky's guard holds it at relative luminance 0.028 or less behind every marker, label, leg and the close X                                                                                     |
| Rules          | 1 px `#6B6685` on the available rect, and 1 px `#4A4660` 3 inside it, as Chibi's paper's inset rules (`GALAXY_MAP.rules`), over the sky and under the ground                                                                                                                                                                                                                                  |
| Marker centres | On one circular arc through route positions 1 (96, 122) and 6 (624, 122) whose top is (360, 46): radius `(264² + 76²) / 152` = 496.53 about (360, 542.53), the six centres at equal angles from -32.12° to 32.12° off vertical, 12.85° apart: 1 (96, 122), 2 (196.12, 73.82), 3 (304.45, 49.12), 4 (415.55, 49.12), 5 (523.88, 73.82), 6 (624, 122), left to right in route order (`centres`) |
| Marker         | 36 frame: disc radius 12 with a 1.5 ink edge, the route number in `TYPE.label` ink centred on it, over an ink backing disc radius 15 at 0.85 (`marker`)                                                                                                                                                                                                                                       |
| Selected ring  | 2 px cream `#EAD4AA` ring at radius 17 (band 16 to 18) on the ship's galaxy (`marker.ring`)                                                                                                                                                                                                                                                                                                   |
| Route line     | The arc itself between consecutive markers, each leg 111.34 of arc; stamped every 0.5; stops 15 from each centre (`path`)                                                                                                                                                                                                                                                                     |
| Line looks     | By the leg's destination: open 4 px solid cream; locked 2 px `#B8B3C9` dashes, 6 on and 4 off                                                                                                                                                                                                                                                                                                 |
| Label          | Name in `TYPE.label` centred on an ink pill at 0.85: 20 high, label + 12 wide, radius 4, top at centre + 19 (`label`); the pill covers the 3 to 4 leg under it                                                                                                                                                                                                                                |
| Ship           | Selected ship frame (`ship-N`) at 42 display, the game area's in-flight size, pivot at (centre x, centre y - 33) (`ship`)                                                                                                                                                                                                                                                                     |
| Ship heading   | Of the 32 headings, the one whose nose angle (`ship-nose.json`) is nearest the arc's tangent at the marker, toward the next galaxy; at galaxy 6, the incoming leg's at its end. Rest headings 24, 25, 27, 29, 31 and 0 for galaxies 1 to 6                                                                                                                                                    |
| Press area     | 48x48 centred on each marker (`HIT_RULE.minTarget`); centres are 111.1 apart, so press areas never overlap                                                                                                                                                                                                                                                                                    |
| Focus ring     | `ui-focus`, 44x44 centred on the marker (36 frame + `FOCUS_RING.outset` 4 a side)                                                                                                                                                                                                                                                                                                             |

Route order runs left to right on screen, so Left and Right follow screen
order.

Panel and actions (`GALAXY_MAP_PANEL`, `GALAXY_MAP_ACTIONS`):

| Part        | Geometry                                                                                                                                                                                                                                         |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Panel       | `ui-settings-card` face, 614x112, centred on the play view (x 53), bottom `SPACING.gap` above the actions; padding 8, the 2 px frame inside it (see Exceptions)                                                                                  |
| Capture     | The 180x90 [selector preview](galaxies.md#selector-preview) in a 1 px ink frame (182x92) at the inner top-left                                                                                                                                   |
| Text column | 12 right of the capture frame, 404 wide, top-aligned: `Galaxy {number}` (`TYPE.body`), `SPACING.rowGap`, the name (`TYPE.heading`), `SPACING.rowGap`, flavour                                                                                    |
| Flavour     | `TYPE.body`, wrapped to at most 2 lines (every Gameplay line fits 404 in 2); inner height `20 + 4 + 28 + 4 + 40 = 96`. A placeholder galaxy's line fits 404 in 1 (Needle 387.77, Andromeda 402.04), and "Story in development." takes the second |
| Earth, Jump | `TEXT_BUTTON.height` faces 192 wide (Chibi's map actions), `BUTTON_GAP` (16) apart at play view x 160 and 368, Chibi's positions, centred on the play view; Earth secondary left, Jump primary right                                             |
| Actions top | Available rect bottom - 48                                                                                                                                                                                                                       |
| Close X     | `ui-close` 24 face, drawn from `map-close.svg` as every card's, its drawn top and right edges on the HUD rect's top-right corner at every inset, as every HUD top control's; press area `hitAround(face)` = 48 centred on the face               |

The chart anchors to the play view's top; the panel and actions anchor to the
available rect's bottom, so a taller view opens the gap between them.

| At 720x360     | No insets              | Phone insets           |
| -------------- | ---------------------- | ---------------------- |
| Available rect | (16, 16) to (704, 344) | (43, 16) to (677, 341) |
| Panel          | (53, 176) 614x112      | (53, 173) 614x112      |
| Capture frame  | (61, 184) 182x92       | (61, 181) 182x92       |
| Text column    | x 255, top 184, w 404  | x 255, top 181, w 404  |
| Earth          | (160, 296) 192x48      | (160, 293) 192x48      |
| Jump           | (368, 296) 192x48      | (368, 293) 192x48      |
| Close target   | (672, 0) 48x48         | (641, 0) 48x48         |
| Close face     | (684, 12) 24x24        | (653, 12) 24x24        |
| End label gap  | 161 to 176: 15         | 161 to 173: 12         |

Markers, labels, rules inside the frame and the ship are the same in both;
markers 1 and 6's label pills end at 161, the chart's lowest mark. Across the
32 headings the ship's hull spans 11.8 above to 9.8 below its pivot at 42, so
a resting hull ends 23.2 or more above its marker's centre, clear of the
selected ring (radius 18) and the focus ring (22). Resting and in flight, the
hull keeps 23.5 from every label pill, 18.8 from every leg's stroke and 6.1
from the view's top. At markers 3 and 4 the resting hull starts at 10.3 and
7.8, over the rules at 16 and 19, which draw under it.

At 844x390 with the phone insets the HUD rect's right is 736.08, so the close
face is (712.08, 12). Resting and in flight, the ship's hull keeps 56.91 from
the close target at the 720 base and 1280x720, 35.61 with phone insets and
56.19 at 844x390 with them; the target keeps 85.54 or more from every label
pill (93 or more from markers 1 and 6's), 50 or more from every marker's
press area and 70.26 or more from every leg.

Marker faces:

| Face     | Disc                  | Edge                                                    | Number      | Label            |
| -------- | --------------------- | ------------------------------------------------------- | ----------- | ---------------- |
| Selected | The galaxy's `marker` | 1.5 ink edge and the cream selected ring; ship above it | Ink         | Name, cream      |
| Unlocked | The galaxy's `marker` | 1.5 ink edge                                            | Ink         | Name, cream      |
| Locked   | Shared grey `#8B8B8B` | 1.5 ink edge                                            | Ink, 5.29:1 | "...", `#B8B3C9` |
| Focused  | The face it has       | Plus the focus ring                                     | As the face | As the face      |

A placeholder galaxy's marker is unlocked, in its galaxy's hue. Locked is
greyscale with "..." for its name and dashes on its leg, so the state reads by
its label and line as well as its colour. On the backing disc over the guarded
sky every marker is 5.11:1 or more (the locked grey; the hues 9.97:1 or more).
On the sky the cream line is 9.29:1 or more and the `#B8B3C9` dashes 6.62:1 or
more ([route sky](route-sky.md#guard)).

Panel states (the panel shows the ship's galaxy, or the locked galaxy last
tapped or focused):

| State       | `Galaxy {number}` | Name             | Flavour                                                            | Capture                                                     | Jump                                    |
| ----------- | ----------------- | ---------------- | ------------------------------------------------------------------ | ----------------------------------------------------------- | --------------------------------------- |
| Open        | `#B8B3C9`         | White, the name  | Cream, the flavour line                                            | Its own field                                               | Primary, live                           |
| Placeholder | `#B8B3C9`         | White, the name  | Cream, the flavour line, then "Story in development." in `#B8B3C9` | Its [placeholder preview](galaxies.md#placeholder-previews) | Primary, live                           |
| Locked      | `#B8B3C9`         | "...", `#B8B3C9` | "...", `#B8B3C9`                                                   | The locked greyscale                                        | Unavailable: disabled face, refusal cue |

Greyed text is the supporting colour `#B8B3C9`, 5.53:1 on the card face; the
disabled label colour `#9A96AD` is 3.93:1 there, below 4.5:1. The panel keeps
one size for every galaxy and state.

Input and focus:

- Right moves the ship to the next open galaxy in route order and Left to the
  previous one, skipping locked galaxies, as Chibi's walk skips
  unavailable zones; at either end nothing moves. The arrows (and the gamepad
  d-pad) walk the route wherever focus is, and return the panel to the ship's
  galaxy.
- Tapping an open marker moves the ship there. Tapping a locked
  marker shows its panel face while the ship stays on its open galaxy; Jump is
  then unavailable and refuses.
- Tab focuses every marker in route order, then Earth, Jump and the close X.
  Focus starts on Jump, the default action. A focused locked
  marker shows its panel as a tap does; a focused open marker moves the ship
  there. Enter, Space and the gamepad's confirm activate the focused control;
  on a marker they act as a tap.
- Earth, the close X, back and Escape leave galaxy selection and return Ada to
  her room without a jump.

Moves (`GALAXY_MAP_MOVE`):

| Move           | Rule                                                                                                                                                                                                                                                                                              |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Selection      | The ship travels the legs between the two galaxies at 360 px/s, clamped to 0.3 to 0.9 s, easeInOutSine on arc length; the panel switches at the input; a new input retargets from the ship's position                                                                                             |
| Unlock         | The first boarding after an unlock opens with the ship on the galaxy it flew from and every newly unlocked galaxy still locked, plays the steps below, then waits for the player's choice                                                                                                         |
| 0 to 300 ms    | Every newly unlocked marker crossfades from its locked face to its hue (ease-out quad); the legs to them turn from dashes to the open line, drawn along the route from the ship's marker                                                                                                          |
| 0 to 400 ms    | A 2 px ring in the farthest new marker's hue grows from radius 13 to 26, alpha 0.8 to 0                                                                                                                                                                                                           |
| 400 ms         | The ship departs on its thrust frame (`ship-thrust-N`), the heading re-chosen each frame from the path tangent; it flies the legs to the farthest newly unlocked galaxy as one path at clamp(length / 180 px/s, 0.8, 2.0) s, easeInOutSine on arc length, so the whole unlock takes at most 2.4 s |
| Timeline       | Sunflower to Whirlpool, one 111.34 leg: 800 ms of flight (the 0.8 s floor), arrival at 1200 ms. Whirlpool to Cartwheel, 334.02 over three legs: 1856 ms of flight, arrival at 2256 ms                                                                                                             |
| Arrival        | The idle frame; the selected ring fades in over 120 ms; the panel crossfades to the new galaxy over 160 ms; focus moves to Jump                                                                                                                                                                   |
| Skip           | A tap, key or button press during the unlock jumps to the arrived state                                                                                                                                                                                                                           |
| Reduced motion | No travel or pulse. Selection moves cut. The unlock fades the ship out over 150 ms, switches the markers and legs at 150 ms, then fades the ship in at the new galaxy over 150 ms: 300 ms in all                                                                                                  |

The ship's path is the route curve offset by the ship pivot (0, -25), so it
leaves and lands standing above the markers.

## Changes from current values

| Change                                                                                                                                                                                                                         | Was                                                                                                                           |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| ------------------------------------------------------------------------------------------------------------------------------                                                                                                 | -----------------------------------------------------------------------------------                                           |
| UI is logical px scaled by `s`: about 8% larger on an 844x390 phone, 1.78x at 1280x720, 2.67x at 1920x1080                                                                                                                     | CSS px at 1x, independent of the canvas                                                                                       |
| Safe insets clamp HUD controls, cards and page content                                                                                                                                                                         | Insets not read                                                                                                               |
| Sticks sit 60 from the screen's sides past the larger side inset (`ceil(max inset + 60)`), mirrored, and 40 above the bottom inset, as in Chibi, clamped `STICK_AREA_MARGIN` 8 inside the game area; Use follows the aim stick | 24 from its sides, each side's own inset replacing it, and 20 above its bottom                                                |
| Every action stack fills the inner width with `STACK_BUTTON_GAP`                                                                                                                                                               | Generic stacks 4 apart                                                                                                        |
| Status pill beside pause: the shield bar (96x12) and the Stardust count in one `PILL`                                                                                                                                          | Shield bar 3 high across the bottom; Stardust count a 14 px plate under the weapons                                           |
| Shield pill at the bottom centre: the shield icon and a 120, 180 or 240 by 12 bar by Shield level; the status pill keeps Stardust, ore and cargo                                                                               | The shield bar (96x12) in the status pill beside pause                                                                        |
| Use is Chibi's touch disc with an action symbol, (-77, -100) from the aim stick; sticks and Use are touch only                                                                                                                 | A labelled `TEXT_BUTTON` at the bottom centre                                                                                 |
| `+N` labels under their counts, over the conversation box, in the item notice's layer                                                                                                                                          | Beside the pill on its row                                                                                                    |
| Conversation, notice and status pill panels and the shield track are ink at 0.65 in every galaxy                                                                                                                               | Panels at 0.70; opaque ink track                                                                                              |
| HUD top controls anchor to `hudRect`: drawn art `HUD_EDGE` 12 in from the game area's top and sides, mirrored with the larger side inset; the pill takes the left edge while pause is hidden                                   | Press targets `CONTROL_EDGE` 8 in, each side clamped by its own inset; the pill kept its place beside the hidden pause button |
| Weapon buttons: 48 targets 9 apart (discs 24), 33 disc, 20 glyph, ink selection annulus; target is the press area                                                                                                              | 48 squares, 24 glyph, cream ring                                                                                              |
| Ammunition counts: an ink count pill under each non-Laser weapon disc                                                                                                                                                          | No counts; ammunition was unlimited                                                                                           |
| Pause draws `pause.svg` with smooth sampling                                                                                                                                                                                   | `ui-pause` PNG, nearest neighbour                                                                                             |
| Settings draws `settings.svg` as a mask with smooth sampling                                                                                                                                                                   | `icon-settings-nav` PNG mask                                                                                                  |
| Start screen Achievements: a `HUD_BUTTON` with `achievements.svg`, one pitch left of Settings; the action row keeps only Start, or Restart and Continue                                                                        | A secondary button at the end of the start card's action stack                                                                |
| Start screen: ship, wordmark and an action row of 192-wide buttons over the title field, Start and Continue primary (`START_SCREEN`)                                                                                           | A page card with a heading, the Ada and Penny portraits and a secondary action stack                                          |
| Start screen nav discs show a pressed state: white glyph on a `#3a4466` face                                                                                                                                                   | Idle in every state                                                                                                           |
| Cards scroll one scroll group with the header and close fixed                                                                                                                                                                  | The whole card scrolls                                                                                                        |
| Prose never widens a card; cheats headings and notes use group and row gaps                                                                                                                                                    | 36em prose cap; 16 and 4 margins                                                                                              |
| Notices show in the conversation box's slot (`CONVERSATION_BOX`)                                                                                                                                                               | A `NOTICE` strip on the HUD rect's top                                                                                        |
| Conversation box 480x60: 48 portrait slot in a 52 frame, overhanging name tab, up to two wrapped lines                                                                                                                         | 640x64, 48 frame, name tab inside over one line                                                                               |
| Story pages use `STORY_PANEL`                                                                                                                                                                                                  | `.story-panel` clamp and rem sizes                                                                                            |
| Story panel: content-fitted per page, a `TYPE.story` text column beside a column of 36 `STORY_BUTTON` choices and page controls, over a background anchored per story run by its subject band                                  | A bottom panel up to 640 wide over a centred background, `TYPE.body` prose, 48 stacked choices                                |
| Story page HUD row on the 12 edge rect (the HUD symmetry rule)                                                                                                                                                                 | Skip and Settings on the `CONTROL_EDGE` 8 HUD rect                                                                            |
| Shop row: name to trailing slot is `SPACING.gap`; the paint heading sits on a 20 line                                                                                                                                          | 16; a 24 line                                                                                                                 |
| Galaxy selection is a route map (`GALAXY_MAP`): six markers on two rows, a panel, Earth and Jump                                                                                                                               | A modal card per galaxy with Previous, Home, Jump and Next (`GALAXY_CARD`)                                                    |
| Pause offers Map: a full-screen map (`MAP_SCREEN`, [Map](map.md)) with symbol chips, fog and a place panel                                                                                                                     | A 288x160 chart in a Map card (`MAP_CARD`)                                                                                    |

## Exceptions

| Exception           | Reason                                                                                                                                                                    | Retained rules                                                                                         |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Card press areas    | DOM hit-tests element boxes                                                                                                                                               | Each control box is at least 48 per axis; close uses `hitAround`                                       |
| Touch sticks        | Continuous input with floating origins                                                                                                                                    | `TOUCH_STICK` anchors, the safe insets, the `STICK_AREA_MARGIN` clamp, 85% opacity                     |
| Landing page        | Responsive HTML outside the game canvas                                                                                                                                   | Same token numbers in CSS px, CSS safe insets                                                          |
| Procedural chrome   | Stick rings, knobs and the speed line draw in frame px                                                                                                                    | Frames and opacity from [touch joystick sheets](touch-joystick.md)                                     |
| Route panel padding | At 360 high the chart (labels end at 164), the 112 panel and the 48 actions fill the available height; padding 16 makes the panel 128 and runs it 7 into the row 2 labels | `SPACING.gap` (8) as padding, the 2 px frame inside it; type roles, row gaps and the capture unchanged |
| Ship card columns   | Two tables side by side: at 8 a right-aligned level meets the next column's icon                                                                                          | `SPACING.columnGap` elsewhere; 16 is `BUTTON_GAP`'s value                                              |

## Verification

Tech implements one layout data module in `src/ui/layout/` (`tokens.ts`,
`controls.ts`, `hitAreas.ts`, `cardFrame.ts`, `contentCard.ts`, `playView.ts`,
`touchControls.ts` and the screen modules above). Every UI reads it; no UI
code outside `src/ui/layout/` writes a raw number for spacing or size. Art and
Tech both sign off on this page and the module before the storybook, the
galaxy selector or shop phase B builds on them.

Tests:

- A source test fails on a raw pixel literal in `src/ui/` outside
  `src/ui/layout/`: an `Npx` in a CSS string, or a numeric literal assigned to
  a geometry property (`width`, `height`, `x`, `y`, `left`, `top`, `right`,
  `bottom`, `gap`, `padding`, `margin`, `inset`). The allowlist is explicit
  and short: `0`, sprite frame offsets read from manifests, and
  `src/ui/touchChrome.ts` (procedural chrome). Each entry names its reason.
- `viewScale` and `logicalView` at 844x390, 1280x720 and 1920x1080 match the
  table above; a 48 button is 52 CSS px at 844x390.
- `cardTitleReserve(true)` equals 50, derived from `hitAround` of the close
  face, not stored.
- Card width equals game-kit `modalWidth` for content widths below, at and
  above the floor, at 720 and 779 logical wide; the floor stays 360 (half the
  fixed 720 base) at both widths.
- Every action in a row shares one width and sits `BUTTON_GAP` apart; every
  pair of neighbouring standard faces is `STACK_BUTTON_GAP` apart stacked and
  `BUTTON_GAP` side by side, and `SMALL_BUTTON_GAP` in any direction when
  either is small.
- With phone insets (left and right 43, bottom 19 logical) at 720x360, every
  HUD drawn rect lies in its safe rect and the top clusters' press areas keep
  `SPACING.pageInset` apart.
- At every view and inset case, one-sided notches included, the leftmost drawn
  art (the pause disc, or the pill with pause hidden) and the rightmost disc's
  drawn edge sit the same whole-pixel distance in from their view edges,
  `HUD_EDGE` from the game area without insets; the pause disc and every weapon
  disc share one drawn top.
- At every view in [Touch controls by view](#touch-controls-by-view) the rest
  centres, rings, shield pill and Use centre match the table: each ring
  `ceil(max inset + 60)` from its outer side, mirrored, and 40 above the
  bottom inset, no ring nearer
  than `STICK_AREA_MARGIN` to the game area's edge, both rings at one height,
  and Use at the aim stick's rest centre plus (-77, -100).
- `STATUS_PILL`'s left edge equals the pause press area's right plus
  `SPACING.gap` while the pause button shows and the HUD rect's left while it
  is hidden; its centre is the HUD row's centre line; with six weapons at
  720x360 and phone insets, the widest pill (205.64) keeps `SPACING.pageInset`
  from the leftmost weapon target.
- `SHIELD_PILL` is 162, 222 or 282 wide by Shield level, centred on the HUD
  rect, its bottom level with the sticks' drawn bottom, at least 42 from both
  ring frames and clear of the bottom inset.
- `USE_DISC`'s centre is the aim stick's rest centre plus (-77, -100); its
  press circle never takes a press inside the conversation box; the sticks
  and Use are absent on desktop and under modals.
- The conversation box top equals `HUD_AMMO_COUNT`'s bottom plus
  `HUD_AMMO_COUNT.clearance` (5) at every HUD rect top, and the name tab top
  is 10 above it; the "999m" pill is narrower than the target and centred on
  the disc.
- `hudRect` matches the HUD rect table at 720x360, 844x390 (without insets,
  with both insets and with a left notch), 1280x720 and 1920x1080; the pause
  disc and every weapon disc lie inside `playView` inset by `HUD_EDGE`.
- On the start screen at 720x360 with phone insets, the Achievements target
  is `hudButtonTarget(1)` (579.5 to 627.5, top 4.5), `HUD_BUTTON.gap` (9) left
  of the Settings target, and keeps 84.5 from the wordmark and 95.5 from the
  ship's ink; the action row (top 264), the note (320 to 340) and every rect in
  the [Start screen](#start-screen) table match at 720x360 and 844x390, with
  and without insets.
- Each card, filled with Gameplay's longest strings at 720x360, fits the
  available rect or scrolls only its scroll group; no text is below 16.
- The route panel keeps one size for every galaxy and state. At 720x360 with
  and without phone insets, every route map rect lies in the available rect,
  the row 2 labels end at least `SPACING.gap` above the panel, and no marker
  press area overlaps another or the
  close target. The story panel matches the
  storybook rect and height tables at each screen, keeps its width and bottom
  edge across pages, and fits every Gameplay page without scrolling; each
  story run's background placement matches the run anchor for its tallest
  page on that background; a test page longer than the
  column scrolls only the text column, with the choices and page controls in
  place.
- Every story choice and page control is 36 drawn on one line (56 on two),
  `SMALL_BUTTON_GAP` 24 from its neighbours in every direction, with
  a press area of at least 48 per axis; the story text is 18 on 26.
