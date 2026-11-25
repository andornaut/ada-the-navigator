# Layout

Every Ada UI positions and sizes from the tokens and rules on this page:
buttons, menus, cards, storybook pages, the galaxy selector, the HUD and
modals. Similar elements use the same token everywhere. A screen is data
(anchors, groups and tokens), never coordinates. [Controls](controls.md) owns
control states, colours and the refusal cue; [Station and shop](shop.md) owns
the shop's groups, states and item art; this page owns every distance and size.

Shared logical values live in `src/data/layout.ts` and are exposed through
`src/ui/layout/`. Token rows may also cite earlier implementation names from
the layout proposal. The layout and button-state requirements describe the
design, including pending state migration in [Controls](controls.md#buttons).

## Coordinates and scale

| Token          | Value                            | Rule                                                                               | Constant                                   |
| -------------- | -------------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------ |
| Base view      | 720x360                          | Smallest logical view; Chibi's base view                                           | Verified `SCREEN`, `src/data/screen.ts`    |
| View scale `s` | `min(cssW / 720, cssH / 360)`    | Logical px to CSS px, for the canvas and the DOM overlay alike                     | `viewScale(cssSize)`, `playView.ts`        |
| Logical view   | `cssW / s` by `cssH / s`         | At least 720x360; one axis widens past the base with the screen aspect             | `logicalView(cssSize)`, `playView.ts`      |
| Safe insets    | `env(safe-area-inset-*) / s`     | Per edge, in logical px, in the turned frame's orientation                         | `safeInsets(cssInsets, s)`, `playView.ts`  |
| Safe rect      | Edge moved in by `max(m, inset)` | The shared safe-margin clamp: margin `m` from the view edge, never inside an inset | `safeRect(insets, m, view)`, `playView.ts` |

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
  844x390 phone), as `Scale.EXPAND` did. The game area is the 2:1 play view,
  centred on both axes on whole logical px. The top controls (pause,
  the status pill, weapons, Skip and Settings) anchor through `hudRect`. Its
  left and right edges use the same clearance from their respective play-area
  edges. The sticks are placed in the game area and ignore safe-area
  insets: each sits from its outer screen side and the screen bottom, mirrored
  as in Chibi, moved inward only to stay inside the game area, and Use follows
  the aim stick ([HUD and overlays](#hud-and-overlays)). Under the
  [full-viewport layout](../docs/work/ada-0106.md) the game's layout insets are
  zero (`playLayout`, `viewScale.ts`). Cards and page content keep the available rect.
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

Padding and margins are measured to drawn pixels, counting an icon's side
bearings: a gap given to an icon is to its drawn pixels, not its box, so an
icon whose drawn pixels sit 3 inside its 20 box takes 3 less on that side.

| Token             | Value | Rule                                                                                                   | Constant                                                      |
| ----------------- | ----- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------- |
| Row gap           | 4     | Between rows of one list that are not buttons: item rows, text rows                                    | `SPACING.rowGap`, `tokens.ts`                                 |
| Group gap         | 8     | Between card groups and row parts                                                                      | `SPACING.gap`, `tokens.ts`                                    |
| Column gap        | 8     | Between columns that are not buttons                                                                   | `SPACING.columnGap`, `tokens.ts`                              |
| Mark gap          | 6     | From an inline icon to its label inside one control or pill                                            | `SPACING.markGap`, `tokens.ts`                                |
| Button gap        | 16    | Between standard button faces side by side: action rows, footers and grid columns                      | `BUTTON_GAP`, `tokens.ts` (game-kit `BUTTON_GAP`)             |
| Small button gap  | 24    | Between faces when either is a small button (face under 48 high), in any direction                     | `SMALL_BUTTON_GAP`, `tokens.ts` (game-kit `SMALL_BUTTON_GAP`) |
| Stack button gap  | 8     | Between standard button faces stacked vertically: action stacks, control rows, grid rows, line buttons | `STACK_BUTTON_GAP`, `tokens.ts` (game-kit `STACK_BUTTON_GAP`) |
| HUD edge          | 12    | Game area edge to the drawn art of the HUD's outermost elements                                        | `HUD_EDGE`, `playView.ts` (Chibi's value)                     |
| Control edge      | 8     | The HUD safe-rect margin                                                                               | `CONTROL_EDGE`, `playView.ts` (Chibi `CONTROL_EDGE`)          |
| Stick area margin | 8     | Least gap from each stick's drawn ring to the game area's edge                                         | `STICK_AREA_MARGIN`, `src/data/layout.ts`                     |
| Page inset        | 16    | Page content from the view edge; preset modal margins are defined below                                | `SPACING.pageInset`, `tokens.ts`                              |
| Panel padding     | 16    | Inside cards and the story panel, including the 2 px frame                                             | `SPACING.panelPadding` = game-kit `MODAL_CONTENT.padding`     |
| Body line box     | 20    | 16 px text (body, labels, supporting)                                                                  | `TYPE.body.lineHeight`, `tokens.ts`                           |
| Heading line box  | 28    | 24 px bold titles                                                                                      | `TYPE.heading.lineHeight`, `tokens.ts`                        |
| Count line box    | 14    | 12 px bold HUD weapon counts                                                                           | `TYPE.count.lineHeight`, `tokens.ts`                          |
| Story line box    | 26    | 18 px storybook text column                                                                            | `TYPE.story.lineHeight`, `tokens.ts`                          |

Type roles: `TYPE.heading` 24 bold on 28; `TYPE.body` 16 regular on 20;
`TYPE.label` 16 bold on 20; `TYPE.story` 18 regular on 26, for the storybook
text column only; `TYPE.count` 12 bold on 14, for the HUD weapon
counts only. The [Quest detail](#quest-detail) route labels use 14 on 18.
Text never shrinks to fit. Wrap, grow the region, reflow or scroll. Colours
per role are in [Controls](controls.md#colour-tokens).

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
  (28, such as the Install row action) and the close X (24). Standard: every
  48 text button and control row, including Storybook Skip and the Map's
  Quests, Galaxies and Close.
- Prose groups (wrapping body or supporting text) never widen a card: they
  wrap to the inner width that the other groups and the 50% floor set.
  Single-line labels inside rows and buttons count at their full width.
- Action row: each button fits its own content plus `2 * TEXT_BUTTON.inset`,
  with `BUTTON_GAP` between faces. The same sizing applies on each line of a
  wrapping row. Keep the primary last in visual order and rightmost on its
  line. Centre a row's sole visible action, including a dismissal footer.
  Count visible buttons inside their wrappers and skip hidden controls.
- Footer: the second row pattern, beside the centred or right-aligned action
  row, for a page or card footer that spans the inner width. Pin the
  secondary actions to the left edge and the primary to the right edge; the
  spare width falls between the two ends. Neighbouring faces at either end
  stay `BUTTON_GAP` apart.
- Action stack: buttons stretch to the group's shared inner width,
  `STACK_BUTTON_GAP` apart, with the primary at the bottom.
- Control grid: non-action tiles keep equal widths in up to two columns,
  `BUTTON_GAP` apart, with rows `STACK_BUTTON_GAP` apart. Use one column
  when two plus the panel padding exceed the available width. Keep command
  groups distinct and preserve their existing roles and secondary order.
- Paged and tabbed cards measure every page or tab and keep the largest width
  and height, so paging never resizes the card.

In `src/ui/modal.ts`, ordinary `.ada-actions` rows use
`minmax(0,max-content)` tracks and `.ada-wrap > .ada-button` uses
`flex: 0 1 auto` so buttons can shrink without growing to share spare
width. Vertical stacks stretch. A selector for one visible direct button
or button presentation centres matching rows and footers.

`actionsWidth` in `src/ui/layout/contentCard.ts` is used by tests and
the layout dump tool. It adds each action's padded width, with the standard
minimum, and the intervening gaps for a row. For a stack it returns the
largest padded width. The runtime rows size through CSS.

## Controls and targets

| Token                 | Value                                                                   | Rule                                                                                                                                                             | Constant                                                            |
| --------------------- | ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Action height         | 48                                                                      | 44 face over a 4 lip                                                                                                                                             | `TEXT_BUTTON.height`, `controls.ts`                                 |
| Lip, pressed sink     | 4, 2                                                                    | Face geometry per state, in [Controls](controls.md)                                                                                                              | `TEXT_BUTTON.lipHeight`, `TEXT_BUTTON.pressedSink`                  |
| Action inset          | 16 horizontal, 12 vertical                                              | Content inset per side; a wrapped label grows the face by 20 per line                                                                                            | `TEXT_BUTTON.inset`, `TEXT_BUTTON.verticalInset`                    |
| Compact height        | 28                                                                      | Row actions and pills: the native 16x28 nine-slice frame                                                                                                         | `TEXT_BUTTON.compactHeight`, `controls.ts`                          |
| Story action          | 36: a 32 face over the 4 lip, pressed sink 2                            | Storybook choices and page controls; label inset 16 across and 6 down; a wrapped label grows the face by 20 per line (56 for two lines); press `hitAround(face)` | `STORY_BUTTON`, `controls.ts`                                       |
| Compact width         | 72, or the label plus 8 px insets when that is wider                    | Compact button face                                                                                                                                              | `cardActionsSize`, `contentCard.ts`                                 |
| Control row           | 48 high, 16 icon, 8, label, 8, action                                   | Whole row is one control; action at the row's right end                                                                                                          | `CONTROL_ROW`, `controls.ts`                                        |
| Row growth            | `max(48, text + 2 * SPACING.rowGap)`                                    | A row with a wrapped note grows by 20 per line                                                                                                                   | `CONTROL_ROW`, `controls.ts`                                        |
| Switch                | 32x16                                                                   | `ui-switch` frame                                                                                                                                                | `CONTROL_ROW.switch`                                                |
| Row icon              | 16x16                                                                   | Settings and install-step icons                                                                                                                                  | `CONTROL_ROW.icon`                                                  |
| Minimum press target  | 48x48                                                                   | Every discrete control                                                                                                                                           | `HIT_RULE.minTarget`, `hitAreas.ts`, to implement                   |
| Press-area growth     | `clamp(6, 16, 0.25 * shorter side)` per side, then grown to 48 per axis | Pause, Use and the close X; nearest drawn centre wins an overlap                                                                                                 | `hitAround`, `pressedArea`, `HIT_RULE`, `hitAreas.ts`, to implement |
| Authored focus outset | 4                                                                       | For controls with the `ui-focus` treatment. Game button states follow [Controls](controls.md#buttons). Retain existing layout reserves during migration.         | `FOCUS_RING.outset`                                                 |
| Pill                  | 28 high, radius 4, 8 side padding                                       | Price pills and the HUD status pill                                                                                                                              | `PILL`, `controls.ts`                                               |

Faces, content insets, nine-slice margins and press areas are separate
measurements; place neighbours against the full press area. Centre labels by
the face of each state, never the press area.

## Modals

| Token           | Value                                                                | Rule                                                                                     | Constant                                                           |
| --------------- | -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Card width      | `min(presetWidth, availableGameWidth)`                               | Fixed Large 688, Medium 500 and Small 400 logical px, clamped to the safe game-area rect | `CARD_WIDTH_CAPS`, `cardWidth`, `contentCard.ts`                   |
| Card height     | Content-fitted, capped by the available height                       | No minimum, no reserved space                                                            | `contentCardLayout`, `contentCard.ts`, to implement                |
| Frame border    | 2                                                                    | Counts inside the 16 padding                                                             | `CARD_CONTENT.frameBorder`, `cardFrame.ts`; now `CARD.frameBorder` |
| Close face      | 24x24 base art in a centred 48x48 hit area, up to 6 past the card    | `ui-close` paint shifts independently. Hit and title clearance stay fixed.               | `CARD_CLOSE.art`, `CARD_CLOSE.hit`                                 |
| Close inset     | Visible X ink 6 logical px from the frame's top and right            | Framed cards only. Full-screen Map and conversation use separate anchors.                | `CARD_CONTENT.closeInset`, `CARD_CLOSE.framedPaintShift`           |
| Title clearance | `max(padding, closeHitRight + SPACING.gap)` = `max(16, 42 + 8)` = 50 | Mirrored on both sides of the title                                                      | `cardTitleReserve(close)`, `cardFrame.ts`; now `card-layout.ts`    |
| Header balance  | Frame inner edge to title equals title to first group                | Measured on line boxes in DOM                                                            | `cardHeaderLayout`, `cardFrame.ts`; now `card-layout.ts`           |
| Scroll reserve  | 6 gap plus an 8 track, thumb inset 1                                 | A scrolling region reserves 14 on its right, inside the padding                          | `SCROLL`, `contentCard.ts`                                         |
| Scroll end pad  | 16                                                                   | Below the last control at the scroll end                                                 | `SCROLL.endPad` = `SPACING.panelPadding`                           |
| Drag threshold  | 8                                                                    | A pointer moving further scrolls and does not activate                                   | `SCROLL.dragThreshold`                                             |

- Shared preset cards have fixed widths by width family: Large 688, Medium 500
  and Small 400 logical pixels. Their available rect is the actual game area,
  excluding letterboxing, inset by the 16 logical pixel screen margin on each
  side and further constrained by applicable safe-area insets.
- Cards centre in that rect. Height follows content up to the rect's height: at
  most game height minus 32. Taller content uses the existing scroll region.
  Cards keep the full type sizes; no font scales down to fit. A title wider than
  its slot wraps and grows the header. Large fills the 720-pixel game area to
  its 16-pixel margins when no larger safe-area inset applies.
- Families: every modal takes one family's width, never a content-fitted
  width. Large: Settings in two columns, Ship, Achievements, Cheats, Quests,
  Map Quests and the Station pages. Medium: Paused, Settings in one column,
  install steps. Small: Menu, Restart, the Cheats selective reset confirmation,
  Update offer, resource and weapon details and Station decision dialogs. A
  card created without a family is Medium. Settings is Large when its rows fit
  two columns and Medium when they take one.
- Header balance: with line boxes, the title starts at 16 and the first group
  at `2 * 16 - 2 + 28 = 58`. DOM measures line boxes, not ink; canvas-drawn
  text measures ink. The close target's bottom (42) plus 8 never exceeds 58.
- Scrolling: a card taller than the available rect caps there and scrolls one
  region, its scroll group (by default every group below the header). The
  header and close X stay fixed. Keyboard focus scrolls the focused control
  fully into view, including any authored non-button focus treatment.
- Every modal dims the whole view and takes input exclusively; outside taps
  never activate controls underneath. One card shows at a time over one dim,
  except a Station decision dialog over the dimmed Station page.
- Keep the top-right X in every modal. Where cancellation is allowed, the
  X invokes the existing Cancel, Back or Close action exactly once, dismisses
  one layer and restores focus to the invoking control or a logical control
  in the restored view. When each decision action closes its modal, keep
  its existing action-area dismissal and remove only extra dismissal
  buttons in that area. Keep the established action order.
- Back returns to the opener's view, with its state and pause status.
  Close dismisses one dialog and restores the immediate view underneath.
  Resume leaves Pause and returns to active play.
- Where dismissal is allowed, existing Escape, back and backdrop inputs
  use the same one-layer dismissal. Preserve confirmation and mandatory-choice
  guards. A close input never accepts a decision or advances a story choice.
  Flag a modal without a valid cancellation path for an explicit user
  decision and preserve its existing behavior until resolved. Mandatory
  choices remain nondismissible until the user approves a valid path.

## HUD and overlays

The HUD's top controls (pause, the status pill, weapons and the start screen's
Achievements and Settings) anchor to the HUD rect, as Chibi anchors its pause button
and skill row (`chibis-way-home` `src/ui/layout/playView.ts` `playView`,
`topShift` and `CONTROL_EDGE`; `src/ui/layout/skillHud.ts`). The rect moves
with the centred base view, so on screens wider than 2:1 the controls sit
inside the game area, clear of curved screen corners and the bands; the
safe-rect clamp still keeps them out of every inset. The sticks are placed in
the game area and ignore safe-area insets, since the game's layout insets are
zero under the [full-viewport layout](../docs/work/ada-0106.md): each ring's
drawn edge sits 80 from its outer screen side and 50 above the screen bottom,
moved inward only to stay
`STICK_AREA_MARGIN` (8) inside the game area; Use follows the aim stick (see
their rows).

The outside drawn edges of Pause and the rightmost weapon mirror across
the centre of the visible play area. They share the same drawn top offset.
The default side clearance is `HUD_EDGE` (12 logical px). If either safe
inset requires more clearance, both sides move inward by the same amount.
When Pause is hidden, the status pill takes the left HUD edge.

`hudRect` uses
`side = ceil(max(HUD_EDGE, insetLeft - playLeft, playRight - (viewWidth - insetRight)))`.
Its left edge is `playLeft + side` and its right edge is `playRight - side`.
View-based callers keep `mirroredSide`. The HUD top and bottom still use
their own clamps. At fractional scales, device pixel rounding can shift a
painted edge by one pixel.

| Token      | Value                                                                                                                                                                                         | Rule                                                                                                                                                                             | Constant                                                                                      |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Play view  | 720x360 at `x = floor((floor(view.width) - 720) / 2)`, `y = floor((floor(view.height) - 360) / 2)`                                                                                            | The game area: the base view centred in the logical view on both axes, on whole logical px; the bands outside it split evenly (one 1 wider where the spare is odd or fractional) | `playView(view)`, `playView.ts` (Chibi `playView`)                                            |
| HUD rect   | Side offsets are `side` logical px inward from both play-area edges; top `ceil(max(play view y + 12, inset top))`; bottom `min(play view y + 348, view bottom - ceil(max(12, inset bottom)))` | The lines the HUD's drawn art meets: the top controls at its top corners, the shield pill's drawn bottom on its bottom edge; the sticks and Use follow their own rule            | `hudRect(insets, view)`, `HUD_EDGE`, `playView.ts` (Chibi `topShift`)                         |
| HUD button | Target 48, disc 33, common weapon annulus 4, glyph 20, gap 9; pitch 57                                                                                                                        | Chibi's `SKILL_BUTTON`; the disc equals the pause disc; small, so discs sit `SMALL_BUTTON_GAP` (24) apart face to face: gap = 24 - 15 = 9 between targets; pitch = target + gap  | `HUD_BUTTON` = `{ target, disc, annulus, glyph, gap }`, `playView.ts`                         |
| HUD row    | Targets reach 7.5 (the disc inset) past the HUD rect's top and right; centre line HUD rect top + 16.5; targets' bottom HUD rect top + 40.5                                                    | The outermost disc's drawn edge and every disc's drawn top sit on the rect; the pause disc, the discs, the pill and Skip share the centre line                                   | `HUD_ROW` = `{ reach, centre, bottom }`, `playView.ts`                                        |
| Count pill | 14 high, radius 4, padding 4, top 42 below the target top, clearance 5                                                                                                                        | Opaque navy pill with a 1 px inset ink rim on the disc's lower edge; the conversation box top sits the clearance below its bottom                                                | `HUD_AMMO_COUNT` = `{ height, radius, padding, top, clearance }`, `playView.ts`, to implement |

| Screen, CSS px | Insets, logical   | Logical view | Play view x | Play view y | HUD rect left, right, top, bottom |
| -------------- | ----------------- | ------------ | ----------- | ----------- | --------------------------------- |
| 720x360        | None              | 720x360      | 0           | 0           | 12, 708, 12, 348                  |
| 720x360        | Left and right 43 | 720x360      | 0           | 0           | 43, 677, 12, 348                  |
| 744x396        | None              | 720x383.23   | 0           | 11          | 12, 708, 23, 359                  |
| 844x390        | None              | 779x360      | 29          | 0           | 41, 737, 12, 348                  |
| 844x390        | Left and right 43 | 779x360      | 29          | 0           | 43, 735, 12, 348                  |
| 844x390        | Left 47, right 0  | 779x360      | 29          | 0           | 47, 731, 12, 348                  |
| 1280x720       | None              | 720x405      | 0           | 22          | 12, 708, 34, 370                  |
| 1920x1080      | None              | 720x405      | 0           | 22          | 12, 708, 34, 370                  |

At 844x390 the play area runs from x 29 to x 749. The default HUD edges
are x 41 and x 737, even though the viewport bands differ in width.
Vertically, the bands are 22 above and 23 below the game area at 1280x720,
and 11 above and 12.23 below at 744x396.

| Element      | Geometry                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Constant                                                                                                                    |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Pause        | Touch only (desktop pauses with Escape): 35x35 frame, 33 disc, drawn edge on the HUD rect's top-left corner (frame 1 outside it), so the disc spans 12 to 45 on both axes at the 720 base; vector art in [Controls](controls.md#pause); press `hitAround(frame)` = 52.5, HUD rect left and top - 9.75 to + 42.75                                                                                                                                                                                                                                                                                                                                                                       | `PAUSE_BUTTON`, `playView.ts`                                                                                               |
| Weapons      | One `HUD_ROW` of `HUD_BUTTON` targets, `HUD_BUTTON.gap` apart: target `i` from the right at `x = right + 7.5 - 48 - 57 * i`, `y = top - 7.5`; disc and glyph centred in it (disc at 7.5, glyph at 14), so the rightmost disc's drawn right edge and every disc's drawn top sit on the HUD rect (disc 675 to 708, 12 to 45 at the 720 base); the target is the press area (48, `HIT_RULE.minTarget`), 4.5 to 52.5 at a top of 12; each non-Laser weapon carries its [count pill](#weapon-count-pill) under the disc                                                                                                                                                                     | `HUD_BUTTON`, `hudButtonTarget(index)`, `playView.ts`                                                                       |
| Status pill  | One `PILL` always holding the Stardust and ore counts, including zero, followed by any carried job or story item or towed craft: left edge `SPACING.gap` right of the pause press area (`PAUSE_BUTTON.hit` right + `SPACING.gap` = HUD rect left + 50.75, 62.75 at the 720 base) while the pause button shows, and on the HUD rect's left edge (`STATUS_PILL.xAlone` 0, so 12) while it is hidden; centred on the HUD row's centre line (HUD rect top + 16.5, so the pill spans HUD rect top + 2.5 to + 30.5, 14.5 to 42.5). Parts and states in [Status pill](#status-pill)                                                                                                           | `STATUS_PILL`, `playView.ts`, to implement                                                                                  |
| Shield pill  | Bottom centre: one `PILL` with the shield icon and a bar whose length follows Shield level (120, 180 or 240, so the pill is 156, 216 or 276 wide), centred on the HUD rect (the play midpoint), its drawn bottom on the HUD rect's bottom edge, `HUD_EDGE` (12) above the game area's bottom as the pause disc's drawn top sits 12 below its top (see [Shield pill](#shield-pill)), independent of the sticks: x 282 to 438, 252 to 468 or 222 to 498 and y 320 to 348 at the 720 base, 313 to 341 with phone insets, 342 to 370 at 1280x720. The same place on touch and desktop; [Touch controls by view](#touch-controls-by-view) lists every view. See [Shield pill](#shield-pill) | `SHIELD_PILL`, `playView.ts`, to implement                                                                                  |
| Item notice  | A 24-high chip under the status pill, top HUD rect top + 34.5 (46.5), centred under where the gain lands and clamped between the pill's left edge and `SPACING.pageInset` left of the leftmost weapon target; draws over the conversation box and under the HUD controls; takes no input. See [Item notice](#item-notice)                                                                                                                                                                                                                                                                                                                                                              | `ITEM_NOTICE`, `itemNotice.ts`, to implement                                                                                |
| Sticks       | Drawn ring edges 80 logical px from each outer screen side and 50 above the screen bottom, ignoring safe insets, moved inward only to stay at least 8 inside the game area. Both sticks use canonical TOUCH_STICK; Use sits (-80, -80) from the aim stick.                                                                                                                                                                                                                                                                                                                                                                                                                             | `TOUCH_STICK`, `touchControls.ts`, to implement, now `sticks.ts`; `STICK_AREA_MARGIN` and `controlsBottom()`, `playView.ts` |
| Use          | Touch only: Chibi's touch disc (`USE_DISC`), a 75 frame with an open ring 73 across and the action's symbol, at the sticks' 85% opacity ([Controls](controls.md#use-disc)); its centre is the aim stick's rest centre plus `USE_DISC.fromAim` (-80, -80), as Chibi places Use from Jump: (523, 193) at the 720 base and (582, 193) at 844x390, the same with phone insets because the sticks ignore them; press shape a circle of radius 100 (`TOUCH_CIRCLE_RADIUS` 63 plus the 37 hint radius) about the centre, cut on the line midway to the aim stick's centre; shown only while an interaction is available, on a touch screen, outside modals                                    | `USE_DISC`, `touchControls.ts`, to implement; replaces `USE_BUTTON`                                                         |
| Menu         | Start screen and Ada's room: the pause button's frame, disc and press area (`PAUSE_BUTTON`) with the three-bar menu glyph (`menu.svg`, `menu-press.svg`, `menu-held.svg`); opens the Menu card. See [Cards](#cards)                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | `PAUSE_BUTTON`, `navigationButton.ts`                                                                                       |
| Exit         | Start screen only, and only in an installed app window that can close the app (Chromium on Android and desktop), never in a plain browser tab: a `HUD_BUTTON` with the authored Exit disc poses (`exit-disc.svg`, `exit-disc-press.svg`, `exit-disc-held.svg`, with Archie's door and arrow glyph); target `hudButtonTarget(0)`, its disc's drawn right edge and top on the HUD rect's top-right corner. See [Start screen](#start-screen)                                                                                                                                                                                                                                             | `HUD_BUTTON`, `hudButtonTarget(0)`, `playView.ts`                                                                           |
| Notice       | The conversation box's slot and panel: same rect and ink panel at 0.65, one or two `TYPE.body` cream lines centred in the box, no portrait or name tab, a tap on the box dismisses it; shows at once and holds the slot ahead of a conversation line, which resumes after; a newer notice replaces the current one in place. See [Conversation box](#conversation-box)                                                                                                                                                                                                                                                                                                                 | `CONVERSATION_BOX`, `conversationBox.ts`, to implement; drawn by `notice.ts`                                                |
| Conversation | In-flight dialogue box below the weapon row: box top `HUD_AMMO_COUNT.clearance` (5) below the count pills' bottom, HUD rect top + 53.5 (65.5 at a top of 12), name tab top 10 higher (55.5), centred, `min(availableWidth, 480)` wide, 60 high, one 48 portrait slot, a name tab overhanging the top edge and up to two lines; the whole box is one press area; non-modal, no dim. See [Conversation box](#conversation-box)                                                                                                                                                                                                                                                           | `CONVERSATION_BOX`, `conversationBox.ts`, to implement                                                                      |

### Touch controls by view

Rings are drawn edges and centres are rest centres. Both sticks ignore safe
insets: each ring's drawn edge sits 80 from its outer screen side and 50 above
the screen bottom, moved inward only as far as needed to stay at least 8 inside
the game area. The shield is independent of them: centred on the HUD rect, its
drawn bottom on that rect's bottom edge, 12 above the game area's bottom, or
`ceil(max(12, inset bottom))` above the view's bottom where that is higher.
Phone insets in this table are
left 43, right 43, top 0 and bottom 19 logical px.

| Screen, insets              | Logical view, play view x, y | Move ring, x and y | Aim ring, x and y | Rest centres           | Shield pill x at levels 1, 2, 3; y                   | Use centre |
| --------------------------- | ---------------------------- | ------------------ | ----------------- | ---------------------- | ---------------------------------------------------- | ---------- |
| 720x360                     | 720x360, 0, 0                | 80-153, 237-310    | 567-640, 237-310  | (116, 273), (603, 273) | 282-438, 252-468, 222-498; 320-348                   | (523, 193) |
| 720x360, phone insets       | 720x360, 0, 0                | 80-153, 237-310    | 567-640, 237-310  | (116, 273), (603, 273) | 282-438, 252-468, 222-498; 313-341                   | (523, 193) |
| 844x390                     | 779.08x360, 29, 0            | 80-153, 237-310    | 626-699, 237-310  | (116, 273), (662, 273) | 311-467, 281-497, 251-527; 320-348                   | (582, 193) |
| 844x390, phone insets       | 779.08x360, 29, 0            | 80-153, 237-310    | 626-699, 237-310  | (116, 273), (662, 273) | 311-467, 281-497, 251-527; 313-341                   | (582, 193) |
| 844x390, bottom 19          | 779.08x360, 29, 0            | 80-153, 237-310    | 626-699, 237-310  | (116, 273), (662, 273) | 311-467, 281-497, 251-527; 313-341                   | (582, 193) |
| 720x360, left 43, bottom 19 | 720x360, 0, 0                | 80-153, 237-310    | 567-640, 237-310  | (116, 273), (603, 273) | 282-438, 252-468, 222-498; 313-341                   | (523, 193) |
| 844x390, left 47            | 779.08x360, 29, 0            | 80-153, 237-310    | 626-699, 237-310  | (116, 273), (662, 273) | 311-467, 281-497, 251-527; 320-348                   | (582, 193) |
| 1280x720                    | 720x405, 0, 22               | 80-153, 282-355    | 567-640, 282-355  | (116, 318), (603, 318) | 282-438, 252-468, 222-498; 342-370                   | (533, 248) |
| 2400x1080                   | 800x360, 40, 0               | 80-153, 237-310    | 647-720, 237-310  | (116, 273), (683, 273) | 322-478, 292-508, 262-538; 320-348                   | (613, 203) |
| 2404x1080 at dpr 2.5        | 801.33x360, 40, 0            | 80-153, 237-310    | 648-721, 237-310  | (116, 273), (684, 273) | 322.67-478.67, 292.67-508.67, 262.67-538.67; 320-348 | (614, 203) |
| 2560x1080                   | 853.33x360, 66, 0            | 80-153, 237-310    | 700-773, 237-310  | (116, 273), (736, 273) | 348.67-504.67, 318.67-534.67, 288.67-564.67; 320-348 | (666, 203) |
| 3000x1080                   | 1000x360, 140, 0             | 148-221, 237-310   | 779-852, 237-310  | (184, 273), (815, 273) | 422-578, 392-608, 362-638; 320-348                   | (745, 203) |

The joystick ring offsets are independent of the shield's bottom margin.
`USE_DISC.fromAim` (-80, -80) places Use relative to the aim stick's
rest centre. Its press circle remains cut away from the aim ring; the
conversation box consumes any overlapping press. Shield notice destinations
follow the shield icon's current HUD-relative centre.

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
  | 844x390, phone insets       |     93.75 |                   409.5 |         299.75 |               94.11 |
  | Desktop, no pause, 720 wide |        12 |                   382.5 |          354.5 |              148.86 |

  "Pill may reach" is the leftmost target less `SPACING.pageInset` less the
  pill's left; the widest pill clears at every view with six weapons, so every
  narrower one does.

- The weapon count pills end at HUD rect top + 48.5 (60.5), 5 above the
  conversation box top; they stay inside their targets' columns (the widest,
  "999m", is 38.69 of 48), so they add nothing to the clusters' horizontal
  clearance.
- The `+N` labels sit just under their counts (line boxes HUD rect top + 33.5
  to + 53.5, over the item notice's row, + 34.5 to + 58.5) and draw over the
  conversation box and its name tab, in the item notice's layer
  ([Status pill](#status-pill)).
- Use's press circle reaches the conversation box's lower right (to + 113.5,
  125.5 at a top of 12) by 32.5 at every 360-high view, with or without phone
  insets (32.4 at 3000x1080, where the box ends 5 left of Use's centre); at
  1280x720 its top sits 9.5 inside the box (137.5). The conversation box always
  wins a press in the overlap. The 360-high views are the tightest: Use's
  drawn ring stays 31.5 below the box, and its press circle 32.5 below the
  weapon count pills' bottom (HUD rect top + 48.5, so 60.5) and 40.5 below the
  weapon targets (52.5); every view is in
  [Touch controls by view](#touch-controls-by-view).
- Use's drawn ring clears the aim ring by about 40 along the diagonal (centres
  113.14 apart, each ring 73 across). Their 75 frames stay 5 apart on each
  axis.
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
- The conversation box's bottom (125.5) sits at least 24 above the ship's drawn
  top at the 360-high view (42.67).

### Status pill

Constants: `STATUS_PILL`, `playView.ts`. Colours and contrast
are in [Controls](controls.md#status-pill). Parts, left to right, each centred
on the pill's row:

Stardust and ore stay visible while carrying an item and after pickup or debit
feedback finishes. Pressing either resource icon or count opens its description
in a shared modal card and pauses the game. Closing the description resumes the
flight. Pressing the carried item or towed craft opens the existing Quests list
for the current game state, without inferring a quest from its display name.
Quests closes back to the paused map through its existing navigation.

| Part          | Geometry                                                                                                                                                                                                                                                 |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Panel         | `PILL`'s 28 height and radius 4, with `STATUS_PILL.padding` 6 at the left and a 6 logical px end inset adjusted for the final icon's right bearing; ink at 0.65, as the conversation panel                                                               |
| Stardust icon | `icon-stardust-20`, nearest neighbour                                                                                                                                                                                                                    |
| Icon gap      | `STATUS_PILL.iconGap` 4 (`SPACING.rowGap`), from each icon to its count                                                                                                                                                                                  |
| Count         | Gameplay's count, at most five characters ("9999", "44.4k", "100k" to "9999k", "10m" and up), in `TYPE.label` on its 20 line with tabular figures, in a slot as wide as the count's own rendered width, at least one digit (`STATUS_PILL.minCount` 8.90) |
| Ore segment   | Always visible, including zero: a divider (`STATUS_PILL.dividerGap` 6, a 1x16 divider, 6), `icon-ore-20`, `STATUS_PILL.iconGap`, the ore count in its own slot                                                                                           |
| Cargo segment | A divider and `icon-cargo-20` or `icon-tow-20`. `statusEndPadding` is 6 less the icon's right bearing, leaving 4 to the cargo box (bearing 2) or 1 to the tow box (bearing 5) and targeting 6 to the drawn edge.                                         |
| Width         | `statusPillWidth`: 36 plus the Stardust slot (6 + 20 + 4, the slot, 6); add 37 plus the ore slot when shown (13 + 20 + 4), then 31 for cargo or 28 for tow (13 + 20 less the right bearing). The left edge stays put.                                    |

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
  item notice's row (+ 34.5 to + 58.5) and the name tab's (+ 43.5 to + 63.5)
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
  The label font, AdaUI Bold (subset from Liberation Sans Bold), has no `tnum`
  feature, but its default digits are already tabular (each 1139/2048 em, 8.90
  at 16 px); the property keeps fallback fonts tabular too.
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

Constants: `SHIELD_PILL`, `playView.ts`. Colours, the light-field
outline and contrast are in [Controls](controls.md#status-pill). Parts, left to
right, each centred on the pill's row; placement is in
[HUD and overlays](#hud-and-overlays):

| Part        | Geometry                                                                                                                                                                                                                                                                                  |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Panel       | 28 high, radius 4, ink at 0.65; padding measured to drawn pixels: `SHIELD_PILL.padding.left` 5 from the pill's left edge to the icon's 20 box, which with the glyph's 3 px side bearing is 8 to its drawn pixels, and `SHIELD_PILL.padding.right` 8 from the bar to the pill's right edge |
| Shield icon | `public/art/ui/icons/shield.svg`, 20 (`HUD_BUTTON.glyph`), a mask in the state's icon colour; its drawn pixels span x 3 to 17, side bearings 3 and 3                                                                                                                                      |
| Icon gap    | `SHIELD_PILL.iconGap` 3 from the icon's box to the bar, so 6 from its drawn pixels                                                                                                                                                                                                        |
| Shield bar  | `SHIELD_PILL.bar[level]` by 12: 1 rim around the track (ink at 0.65 over the panel), fill area `bar - 4` by 8 at inset 2                                                                                                                                                                  |
| Delay strip | Separate 3 high track inside the pill, 1 below the main bar: a 1 high fill inside a 1 px ink border, aligned to the main fill area; track stays visible at zero progress                                                                                                                  |
| Width       | `5 + 20 + 3 + bar + 8` = `bar + 36`                                                                                                                                                                                                                                                       |

The bar's length follows Shield level, so each upgrade visibly lengthens it
(Gameplay: capacity 10, 15 and 20):

| Shield level | `SHIELD_PILL.bar` | Fill area | Pill width |
| -----------: | ----------------: | --------: | ---------: |
|            1 |               120 |     116x8 |        156 |
|            2 |               180 |     176x8 |        216 |
|            3 |               240 |     236x8 |        276 |

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

The shield pill's drawn bottom sits on the HUD rect's bottom edge, `HUD_EDGE`
(12) above the game area's bottom, as the pause disc's drawn top sits
`HUD_EDGE` below its top, at every Shield level on desktop and touch. Where
`ceil(max(12, inset bottom))` above the view's bottom is higher, the rect's
bottom, and the pill with it, sits there instead, clear of the inset. CSS anchors the pill's bottom
with `fromHudEdge("bottom")`; layout geometry uses
`shieldPillRect(insets, view, level)`, whose bottom is the bottom of
`hudRect(insets, view)`. This anchor is independent of the sticks' drawn edges
and clamp.

Delay strip (`SHIELD_PILL.delayStrip`), Gameplay's recharge timer:

Rects relative to the bar's top-left corner (the rim's outer edge), at full
length; `p` is `elapsed / delay`:

| Shield level | Main bar | Timer track, x y w h | Timer fill, x y w h |
| -----------: | -------- | -------------------- | ------------------- |
|            1 | 120x12   | 1, 13, 118, 3        | 2, 14, `116 p`, 1   |
|            2 | 180x12   | 1, 13, 178, 3        | 2, 14, `176 p`, 1   |
|            3 | 240x12   | 1, 13, 238, 3        | 2, 14, `236 p`, 1   |

The timer is a separate enclosed track inside the existing pill, below the
main shield bar. `SHIELD_PILL.delayStrip` defines the 1 px gap, 1 px fill height and
1 px ink border. The fill spans the same 116, 176 or 236 as the main fill
area at full progress. The dark track keeps its full width at zero progress,
with no cream fill. Within the existing 28 high panel, the main bar spans y 8
to 20. Its fill keeps equal inner padding above, below and at its left origin.
The timer track sits inside the panel at y 21 to 24. Its complete ink rectangle
encloses both cream fill and empty track, including both end caps. Both tracks
use canonical inset rim shadows, avoiding
fractional CSS border rounding that would shift the fill. The main bar, icon,
panel size, anchor and hit areas stay unchanged.

- It shows only while the recharge delay runs: the shield is below capacity and
  not regenerating. It is hidden while the shield is full or regenerating.
- It grows linearly with Gameplay's delay timer, `elapsed / delay` of the fill
  area's width, so `(bar - 4) / 30` px/s over Gameplay's 30 s delay, with
  fractional widths: 3.87, 5.87 and 7.87 px/s at Shield levels 1 to 3.
- At full, recharge starts: the strip hides at once, with no fade, and the
  regeneration edge takes over.
- Damage restarts the delay and empties the strip at once, the same frame as
  the hit flash; it grows again from 0. Nothing else resets it.
- The timer has its own enclosed track and fill below the main bar, with no overlap or
  clipping. The main shield's fill, damage-delay part and flash keep their
  existing layering and colours. Low-shield pulsing changes only the main
  icon and rim, leaving the timer's cream fill and complete ink border unchanged.
- Light field: the timer's own ink border outlines it independently of the
  main bar's light-field outline.
- Reduced motion: unchanged, a steady fill with no pulse or easing.
- It is a meter detail: the bar's accessible value is unchanged, and the strip
  is decorative.

- The pill shows during flight on touch and desktop alike, and hides while a
  modal card or storybook page shows.
- The pill takes no input. The bar is a meter (Gameplay's shield label, value
  and capacity); the icon is decorative.

### Hit flash

Each time Ada's shield takes damage, from any source, one thin red line flashes
around the game area's perimeter while the view gives its small shake
(Gameplay owns the shake).

- Colour `threat` `#FF6B6B` ([Space palette](space-palette.md)), the one red in
  space.
- A 3 logical px band drawn just inside the game area's edge (the play view
  rect, not the safe area), square corners.
- Opacity 1 at the hit, fading linearly to 0 over 200 ms; a new hit restarts it
  at 1.
- It stays fixed on the play view edge while the view shakes, so the band never
  leaves the edge or uncovers a strip.
- Draws above the backdrop and the world and below the HUD, the sticks and the
  [edge markers](#edge-markers), so the markers stay readable over it.
- Reduced motion: not drawn.
- Constants: `HIT_FLASH` (colour, width 3, duration 200) in `src/data/layout.ts`.

### Item notice

Constants: `ITEM_NOTICE`, `itemNotice.ts`. Colours, icons and
contrast are in [Controls](controls.md#item-notice). Gameplay's rule: every
gain but Stardust and ore shows one, queued one at a time.

| Part     | Geometry                                                                                                                                                                 |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Chip     | `ITEM_NOTICE.height` 24, radius 4, opaque ink, a 1 rim inside the edge                                                                                                   |
| Contents | 8 to the visible 20 px icon, then 6 from its visible right edge to the first glyph. The icon stays centred vertically. Leave 8 after the label.                          |
| Label    | `TYPE.label` on its 20 line. Chip width is label width + 42 less the two effective horizontal icon bearings.                                                             |
| Top      | `ITEM_NOTICE.top`: HUD rect top + 34.5 (46.5), `SPACING.rowGap` (4) below the pill's bottom; bottom + 58.5 (70.5)                                                        |
| Across   | Centred on the destination's centre x, then clamped: left edge at least the pill's left edge, right edge at most the leftmost weapon target's left - `SPACING.pageInset` |
| Layer    | Over the field and the conversation box, under the pause button, the pill, the `+N` labels and the weapon buttons; `pointer-events: none`                                |

Destinations, at HUD rect top + 16.5 (the HUD row's centre line) on the y axis:

| Gain                                           | Destination centre x                                                                                                                                                                           |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Job, story or lost item, a tow                 | The cargo segment's icon: pill left + pill width - 16                                                                                                                                          |
| New weapon, a weapon's ammo                    | That weapon's disc: its target's left + 24                                                                                                                                                     |
| Holodisk                                       | None; the chip centres on the pill and fades in place                                                                                                                                          |
| Weapon level                                   | That weapon's disc: its target's left + 24                                                                                                                                                     |
| Shield level                                   | The shield pill's shield icon: the shield pill's left + 15 (the icon box's centre), on the pill's centre line (y 334 at the 720 base, 327 with phone insets, 356 at 1280x720), not the HUD row |
| Engine level, Tractor beam level, paint scheme | None; the chip centres on the pill and fades in place, as a holodisk's                                                                                                                         |

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
  top 5 (65.5 to 70.5) and, when it sits over one, part of a name tab (55.5
  to 75.5); a two-line text block's first line box starts 5 below it.
- Across, the chip shares rows with the weapon count pills (to + 48.5) and
  the pause press area (to + 42.75); the clamp keeps it 16 from every weapon
  target, and its left edge is the pill's, 8 right of the pause press area.

Label room (the clamp's width less 42), with the pause button showing; with
it hidden the pill starts 50.75 further left and the room grows by as much:

| View                  | Pill left | Four weapons |   Five |    Six |
| --------------------- | --------: | -----------: | -----: | -----: |
| 720x360, 1280x720     |     62.75 |       375.75 | 318.75 | 261.75 |
| 720x360, phone insets |     93.75 |       313.75 | 256.75 | 199.75 |
| 844x390               |     91.75 |       375.75 | 318.75 | 261.75 |
| 844x390, insets 43    |     93.75 |       371.75 | 314.75 | 257.75 |

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

Weapon level dots use `HUD_WEAPON_LEVEL.below`, derived from the containing
ring's stroke centre: 14.5 below the disc centre. Level 1 shows no dot; levels
2 and 3 show two or three, horizontally centred. Their ink ends at target
41.5, 0.5 above the ammo pill's top at 42. Ring dimensions and press targets
stay unchanged. Selected weapon faces are opaque navy; inactive faces keep
their distinct dark palette colours. Ammo numbers match the cream selected
ring when active and are grey when inactive, including zero; navy count
pills and their geometry stay unchanged. See [Controls](controls.md#top-right-hud-icon-buttons).

### Weapon count pill

Constants: `HUD_AMMO_COUNT`, `playView.ts`. It replaces the
placeholder count label (idle lavender, 38 to 58 below the target top).
Colours, states and contrast are in [Controls](controls.md#ammunition-count).
Each owned non-Laser weapon's `HUD_BUTTON` carries one pill showing Gameplay's
ammunition count string; Laser shows none.

| Part     | Geometry                                                                                                                                                            |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Panel    | Opaque navy `#262b44` with a 1 px inset ink rim, `HUD_AMMO_COUNT.height` 14, radius 4, `HUD_AMMO_COUNT.padding` 4 at each end; no geometry change                   |
| Width    | The count's width plus 8, sized to its text: 14.67 at "0", 34.70 at "9999", 38.69 at "999m" (the widest)                                                            |
| Text     | The count in `TYPE.count` (12 bold) on its 14 line, centred in the pill                                                                                             |
| Position | Centred on the disc horizontally; top `HUD_AMMO_COUNT.top` 42 below the target top (HUD rect top + 34.5, so 46.5)                                                   |
| Box      | Relative to the target's top-left: `x = 24 - w / 2`, `y = 42`, `w` = count width + 8, `h = 14`; so `x` 16.66 and `w` 14.67 at "0", `x` 4.65 and `w` 38.69 at "999m" |
| Vertical | Spans HUD rect top + 34.5 to + 48.5 (46.5 to 60.5); clears the disc's lower edge (+ 33) by 1.5; digit ink from + 37.3 to + 45.8, wholly below the disc              |
| Layer    | A child of the weapon button, drawn over the disc; it takes no input and moves with the button's shake                                                              |

- Position rule: the pill clears the disc's lower edge by 1.5. Its bottom
  is HUD rect top + 48.5, and the conversation box top sits
  `HUD_AMMO_COUNT.clearance` (5) below it. Its lower 8 lie below the target,
  outside the press area.
- Count strings fit one line at every value: the widest pill (38.69) leaves
  9.31 inside the 48 target and 18.31 between neighbouring pills.

### Edge markers

[Gameplay's marker contract](../gameplay/marker-design.md#contract) owns
eligibility, range, lifetime and identification. Its
[placement rule](../gameplay/marker-design.md#state-and-presentation) keeps
each marker on the projected Ada-to-target bearing. HUD and dialogue overlap
is diagnostic and does not shift or discard the marker.

The shared DOM layer measures visible glyph extents, including applicable
light-field outlines, in `src/ui/pennyMarkers.ts`.
`layoutTargetMarkers` in `src/ui/layout/targetMarkers.ts` insets the safe game
area by `EDGE_MARKERS.gap` (1), snaps the edges inward on the device grid in
the frame's axes, and intersects the bearing with the rect reduced by the
glyph extents. The visible inset is ordinarily about 1 to 2 logical px, with
the retained 3 px small-marker half-scale corner case.

The tables below are nominal geometry for the original enemy, heavy, guard
and station glyphs at the stated views, before raster rounding. See
[Space palette](space-palette.md#edge-markers) for their art and colours.

| Kind                     | Half extent | Inset, dark | Inset, light |
| ------------------------ | ----------: | ----------: | -----------: |
| Enemy                    |           3 |           4 |            5 |
| Heavy, guard and station |           5 |           6 |            7 |

Safe game area and the centre lines of the 10-across kinds (dark field; on a light
field each line moves 1 further in, and an enemy's lines sit 2 further out):

| View                  | Safe game area, x and y | Left, right centres | Top, bottom centres | Corners                                        |
| --------------------- | ----------------------- | ------------------- | ------------------- | ---------------------------------------------- |
| 720x360               | 0 to 720, 0 to 360      | 6, 714              | 6, 354              | (6, 6), (714, 6), (6, 354), (714, 354)         |
| 1280x720              | 0 to 720, 22 to 382     | 6, 714              | 28, 376             | (6, 28), (714, 28), (6, 376), (714, 376)       |
| 720x360, phone insets | 43 to 677, 0 to 341     | 49, 671             | 6, 335              | (49, 6), (671, 6), (49, 335), (671, 335)       |
| 844x390               | 29 to 749, 0 to 360     | 35, 743             | 6, 354              | (35, 6), (743, 6), (35, 354), (743, 354)       |
| 844x390, insets 43    | 43 to 736.08, 0 to 341  | 49, 730.08          | 6, 335              | (49, 6), (730.08, 6), (49, 335), (730.08, 335) |

Phone insets are 43 left and right, 0 top and 19 bottom. The marker rect takes
each edge's own inset, so a one-sided notch moves only its side.

Nominal clearances from the 10-across marker band (dark field, with the
light-field band 2 deeper):

| Edge and control                        | 720x360 | Phone insets | 844x390 | 844x390, insets 43 |
| --------------------------------------- | ------: | -----------: | ------: | -----------------: |
| Top band to the pause and weapon discs  |       1 |            1 |       1 |                  1 |
| Side band to the pause and weapon discs |       1 |      11 over |       1 |            11 over |
| Side band to the stick rings            |      69 |           26 |      39 |                 26 |
| Bottom band to the stick rings          |      39 |           20 |      39 |                 20 |
| Bottom band to the shield pill bottom   |       1 |      11 over |       1 |            11 over |

- The original canvas markers drew below the sticks (`STICK_DEPTHS`).
  The current DOM marker layer is pointer-transparent. Treat these overlap
  examples as clearance measurements.
- Top band: 1 to 11 on a dark field and 1 to 13 on a light one; the discs start
  at 12, so a light-field marker directly behind a disc loses 1 row to it.
- With phone insets the side bands (44 to 54, or 44 to 56 lit) share their
  columns with the pause disc and the outermost weapon disc, which start at
  the same 43 inset: a side marker in the HUD row's span (12 to 60.5, count
  pills included) sits under that disc. With these insets, the side marker
  bands clear the stick rings by at least 24 logical px in both fields.
- Bottom markers draw under the shield pill like other controls: they keep
  their place on the edge. Without a bottom inset the dark band clears the
  pill's drawn bottom by 1 and a light band reaches 1 under it; with the 19
  inset the pill's bottom (341) is the safe bottom, so the band lies under the
  pill across its width.
- The Use disc's drawn ring sits at least 90 from every dark band and 88 from
  every light band at these views, nearest the bottom band with a 19 bottom
  inset (band top 330, ring bottom 240). Across
  [Touch controls by view](#touch-controls-by-view) the nearest is the right
  band at 3000x1080: 67 dark and 65 light (band 849, ring right 782).

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
- Startup failures use Game Kit's loading-safe Retry. Centre the button and
  size it to its label plus `2 * TEXT_BUTTON.inset` (16 logical px per side).
  Keep `TEXT_BUTTON.height` (48), the Start button's label colour,
  ink `#181425` (7.27:1 on `#bfa06f`), and the existing recovery path.

## Screens

Each screen lists its anchor and groups in order. Every distance comes from a
token above; strings are Gameplay's.

### Cards

| Screen        | Groups (top to bottom)                                                                                                                                                                                     | Scroll group |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| Settings      | Header and close X. Control columns ([Settings card](#settings-card)), supporting build label, centred primary Back                                                                                        | Rows         |
| Install steps | Header and close X. Browser and Install glyphs where applicable, wrapped instructions, centred secondary Back                                                                                              | Instructions |
| Update offer  | Header, close. Action row: decline (secondary), accept (primary)                                                                                                                                           | None         |
| Cheats        | Header and close X. Two headingless columns of three aligned rows ([Cheats card](#cheats-card)), centred primary Back                                                                                      | None         |
| Menu          | Header, close. Equal-size action stack, alphabetical: Achievements, Cheats, Settings; then Back to title (not on the Start screen); then primary Close                                                     | None         |
| Paused        | Header, close. Two top-aligned action columns of equal width, ending with primary Resume                                                                                                                   | None         |
| Ship          | Header, close. Cargo, Equipment and Weapons columns. Centred Back ([Ship card](#ship-card))                                                                                                                | None         |
| Conversation  | Speaker tab, portrait and line. Topic choices and page controls. Skip and close X on the HUD row ([Conversation card](#conversation-card))                                                                 | Text column  |
| Station       | Header and close X, shared balances, single keeper greeting when authored, shared footer ([Station pages](#station-pages))                                                                                 | None         |
| Shop          | Header and close X, shared balances, two fixed stock panes, shared footer                                                                                                                                  | None         |
| Job board     | Jobs & Projects title and close X, shared balances, fixed Jobs and Community projects panes, shared footer                                                                                                 | None         |
| Exchange      | Header and close X, shared balances, two rate and quantity rows, shared footer                                                                                                                             | None         |
| Buy confirm   | Header with top-right X. Item well. Description (weapons). Offered price. Action row with Cancel (secondary, left) and Buy (primary, right). The X invokes Cancel. See [Buy confirm](shop.md#buy-confirm). | None         |
| Achievements  | Header, close. Entry list, two columns ([Achievements card](#achievements-card)). Pager: Previous, the page count, Next                                                                                    | None         |

The Paused card shows no objective or job lines. Both columns start at the same
height, with `BUTTON_GAP` between columns and `STACK_BUTTON_GAP` between
buttons. Each button is one column wide and uses the standard 48 logical px
height. Reading and keyboard order run down the left column, then down the
right.

| Column | Order from top to bottom                                                         |
| ------ | -------------------------------------------------------------------------------- |
| Left   | Sort by displayed label. In English, Cheats, Map when available, Quests, Ship    |
| Right  | Achievements, Settings, Back to title, then Resume (primary) when Map is visible |

Map opens the local map when permitted. When Map is hidden, Quests and Ship
move up and primary Resume sits alone in a centred final row, one column wide.
Both columns keep their positions and widths. The Map and Resume buttons
have a 44 logical px face over a 4 px lip. At viewport widths of 720 CSS px
or less or heights of 360 CSS px or less, their labels move down 1 logical px
to centre the cap bands on those faces.

Achievements opens the shared [Achievements card](#achievements-card). Its
Back button, close X and Escape return to the Paused card and restore focus to
the Achievements button. The Start screen keeps its own Achievements
dismissal.

The Start screen and Ada's room open the Menu card. Its stack starts with
Achievements, Cheats and Settings, then Back to title away from the Start
screen, then primary Close.
Ship has one centred primary Back, returning to Paused with the same action
as its X, Escape and back. Quests list Close restores its actual opener; detail Back returns to
the list, while a directly opened HUD detail Close returns to gameplay. The X,
Escape and back match the primary footer action.

### Settings card

Settings uses two columns when the labels fit the Large card and stacks the
left column above the right in the Medium card. Only the two-column layout
shows the centre divider. The build label and centred primary **Back** follow
the controls.

| Column | Rows in order                                     |
| ------ | ------------------------------------------------- |
| Left   | Move controls, Aim controls, Sound effects        |
| Right  | FPS counter, Reduced motion, Install when offered |

Switch rows show a 16 px [icon](settings-icons.md), label and any supporting
note, then a 32 by 16 switch above its state label. Move and Aim use Shown
and Hidden. Other switches use On and Off. FPS defaults to Off when no
device preference is saved. The choice persists with the other device
settings, independently of saved progress. FPS uses the bottom-right
readout. Install is a right-aligned standard 48 px
secondary action with a decorative down-arrow and tray. Closing Install
Steps returns to Settings and restores focus to Install.

### Cheats card

Offer **Cheats** directly in the active Menu or Pause in browser tabs and
installed apps. The Large card uses two columns without headings, with three
aligned rows in each, fitted without scrolling. The top-right X and centred
primary **Back** dismiss
one layer, restore focus to Cheats in the invoking Menu or Pause, and preserve
the parent's pause state. Escape, back and backdrop dismissal follow that path.

| Row    | Left                 | Right                         |
| ------ | -------------------- | ----------------------------- |
| Top    | Unlock all equipment | Stardust and Ore grants       |
| Middle | Unlock all galaxies  | Maximize weapon levels        |
| Bottom | Unlock all weapons   | Reset jobs, projects & quests |

`cheatsTree` in `src/ui/cheatsTree.ts` sets the order and `createCheats`
in `src/ui/cheats.ts` mounts the card. The equal-width +1,000 grants put
Stardust before Ore in visual and keyboard order. Each grant draws its 20 px
resource SVG beside the amount. The spoken labels are “Add 1,000 Stardust”
and “Add 1,000 ore”.

| Part            | Rule                                                                                                                                                   |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Padding         | `SPACING.panelPadding` (16), with the 2 px frame inside it                                                                                             |
| Ordinary action | `TEXT_BUTTON` at 48 high, with a 44 face over the 4 px lip. Preserve action availability and the disabled face when a cheat has nothing left to grant. |
| Back            | Centre at label width plus `2 * TEXT_BUTTON.inset`.                                                                                                    |

**Reset jobs, projects & quests** opens a Small “Reset jobs, projects &
quests?” confirmation with an explanatory body, top-right X, secondary
**Cancel** on the left and primary **Reset** on the right. X, back, Escape and backdrop use Cancel's one-layer
path where allowed. On cancellation, restore focus to the invoking action or
a logical control in Cheats. Keep the dismissal guard during the write.

The reset rewinds the stored campaign to Earth's opening in Sunflower,
relocks later galaxies and clears jobs, project funding and reveals,
holodisks and story progress. Ada keeps her ship, equipment, resources,
map discoveries and achievements. Past contributions stay spent and earned
one-time rewards stay recorded. Repeatable jobs and activities still pay
their usual rewards. Preserve the save and current view when the write
fails, and keep the live action and save guards.

[Gameplay's Cheats guide](../gameplay/cheats.md) covers cheat effects.
[Reset and save details](../docs/design/cheats.md#other-actions) cover the
stored campaign and reward rules.

The Start screen owns the full-save **Restart** action. Its Small “Restart?”
confirmation keeps secondary **Cancel** on the left and primary **Restart**
on the right. Cancel and the top-right X return to Start with the save intact.

### Conversation card

Talk and Astra's Salvage, Deposit and Tow briefs share the
[storybook panel](#storybook-page)'s bottom anchor, safe insets, two columns,
portrait frame and text roles over paused, dimmed space. Each spoken line
shows its actual speaker and portrait. The speaker tab stays on one line.
Narration has no portrait or tab. The close X is the only Close control. Mom and Dad keep their authored family
addresses in text; their tabs and portraits identify Trista and Bin.

| Page   | Choice column                                                                                                             |
| ------ | ------------------------------------------------------------------------------------------------------------------------- |
| Line   | Ask more (secondary) and Continue (primary) when topics remain. Otherwise Continue alone.                                 |
| Topics | Remaining topics as neutral choices above Continue alone. Continue advances without selecting a topic.                    |
| Brief  | Continue alone when the page has no optional topics. When topics remain, use Ask more (secondary) and Continue (primary). |

The card fits the visible groups. Choices and page controls are separate
groups with a 24 logical px gap when both show. The page-control row has at
most one primary and fills the choice column when two controls are visible.
Use equal halves if both labels fit with their padding. Otherwise give the
wider control its required width and the other the remaining width. Keep 24
between the controls and the primary on the right. If both widths plus the
gap exceed the column, put the secondary at the left in the upper row at
the greater of its required width or half the available button space. The
primary fills the row below it, 24 apart. A lone primary sits at the right
edge and takes the greater of half the available button space or its
required width, capped at the column width. Half the available button space
is `(column width - 24) / 2`.

At 720×360 with phone insets, Ask more and Continue stack in the 228 logical
px choice column, with both labels on one line. They sit side by side at
844×390 with phone insets and at 1280×720.

Talk puts the close X in the Settings slot of the HUD row. Its 48
press area is `hudButtonTarget(0)`, with the 24 face centred in it. Skip uses
the compact style at `STORY_SKIP.right.besideSettings` (57 from the HUD rect's
right). In Talk, Skip can omit optional background topics and leaves
material decisions pending.

The Interaction material-choice path includes the non-Dock `activityDrop`
confirmation. Its Cancel and Drop choices require a selection and hide
Skip. Station job-board drop confirmations and the existing Small
confirmation and detail cards use their own layouts. The ambient in-flight
[conversation box](#conversation-box) has no Skip.

### Station pages

The welcome, Shop, Jobs & Projects and Exchange use the Large width cap and
fill the available modal height. Dock shows the station title and a single
keeper paragraph with name and portrait when authored. The ordinary welcome
shows services immediately with no Continue or Skip.

The shared Stardust and Ore balances sit at `SPACING.panelPadding` (16) from
the top and left. Each 20 px resource icon is `BALANCE.markGap` (6) from its
amount, and the two balances are `SPACING.gap` (8) apart. The footer anchors
at the bottom with a 1 px separator and `SPACING.gap` (8) vertical padding.
It follows the [footer pattern](#groups): service buttons from the left edge,
`BUTTON_GAP` (16) apart, and primary Undock on the right edge. See
[Station and shop](shop.md#station-pages) for service order and dismissal.

### Achievements card

The start screen's Achievements opens a Large card titled
"Achievements" with the close X, spaced as Chibi's (`chibis-way-home`
`src/data/layout.ts` `ACHIEVEMENTS_CARD`, `src/ui/layout/achievementsCard.ts`).
Constants: `ACHIEVEMENTS_CARD`, `achievements-card.ts`.

| Part       | Geometry                                                                                                                                                                                                                                        |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Card       | Large, `min(688, availableWidth)`, centred in the available rect                                                                                                                                                                                |
| Header     | The list's top 50 below the card's top: the close X's press area bottom (42) plus `SPACING.gap`. The title's cap height sits midway between the frame's inner top (2) and the first name's cap top (54.54), so its 28 line box starts 14.2 down |
| Columns    | Two, filled down each column then across; each `(cardWidth - 2 * CARD_CONTENT.padding - columnGap) / 2` wide, badge included: 320 at 688                                                                                                        |
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
| 720x360               | 688x328    | 688x318, x 16 |    320 |    3 |       21 |
| 720x360, phone insets | 634x325    | 634x318, x 43 |    293 |    3 |     19.5 |
| 844x390, insets 43    | 693.08x325 | 688x318       |    320 |    3 |     19.5 |
| 1280x720 (720x405)    | 688x328    | 688x318, x 16 |    320 |    3 |       43 |

Card height at three rows: `50 + 3 * 60 + 2 * 8 + 8 + 48 + 16` = 318, inside
every available height, so the card never scrolls.

- Where the available rect is narrower than 688, the columns narrow; the card
  never scales, as a label never shrinks to fit. At 688 each column is 320 and
  its text column 296. At 634 each column
  is 293 and its text column 269: the widest name with a count, "Friends
  Everywhere" with "99/99", is 200.11, and the longest condition, "Make every
  optional ally: quest and project allies." (348.60), wraps to two lines, so
  every entry keeps its three lines.
- Every condition fits two lines at both column widths; a condition that
  needed a third would be a copy change for Gameplay, not a taller entry.

### Quest detail

Inside the Quest detail card, the route panel's From and To labels and endpoint
text use 14 px type on an 18 px line (`QUEST_ROUTE_TYPE`, logical px). Quest
body copy keeps `TYPE.body` at 16 px on a 20 px line.

When wrapped detail exceeds the available height, the body scrolls in one
group. The title and close X stay above it. The footer, including Back when
opened from the list, stays fixed below the scroll group. The Quests list and
detail footers follow the [footer pattern](#groups): secondary actions from
the left edge, the primary dismissal on the right edge, and neighbouring
faces `BUTTON_GAP` (16) apart.

### Ship card

The Paused card's Ship opens the shared `large` card (`CARD_WIDTH_CAPS.large`
700, clamped to the available rect) titled "Ship", with the close X and one
centred primary Back button in its footer. Back, the close X, Escape and back
return to Paused. Strings and row content are Gameplay's
([Player copy](../gameplay/player-copy.md)). Constants: `SHIP_CARD` and
`SHIP_CARD_STYLE` in `src/ui/layout/shipCard.ts`; the column tree is `shipTree`
in `src/ui/shipTree.ts`.

The body is three top-aligned columns, Cargo, Equipment and Weapons from left
to right, at every width and with phone insets. The three content tracks are
equal (`minmax(0, 1fr)`), so content never sizes a column; a page divider sits
in its own intrinsic track between each pair. Each section is one list under
its heading, never a nested grid.

| Part                | Token or derivation                                                                 | Rule                                                                                      |
| ------------------- | ----------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Outer padding       | `CARD_CONTENT.padding` (16)                                                         | The shared content-card padding on every edge                                             |
| Divider             | `PAGE_DIVIDER_STYLE`, from `STORY_PANEL.rule`: 1 wide, `#6b6685`                    | One vertical rule between neighbouring columns, spanning the body                         |
| Divider clearance   | `SPACING.panelPadding` (16) on each side                                            | Each gutter is `2 * SPACING.panelPadding + 1` (33)                                        |
| Column              | `(inner width - 2 * 33) / 3`                                                        | 200.67 in the full 700 card (inner width 668)                                             |
| Section heading     | `TYPE.label` on a 20 line, `TEXT_TOKENS.supporting`                                 | Cargo, Equipment and Weapons only, the same role and top in every column                  |
| Heading-to-list gap | `SPACING.gap` (8)                                                                   | Between a heading and its first row                                                       |
| List row gap        | `SPACING.rowGap` (4)                                                                | Between rows in a list                                                                    |
| Row                 | `SHIP_CARD.row`, `TYPE.body.lineHeight` (20), minimum height                        | `TYPE.body`, `TEXT_TOKENS.label`; each wrapped line adds 20                               |
| Row icon            | `SHIP_CARD.icon` (20), then `SPACING.markGap` (6)                                   | A sprite sheet's first frame, or a weapon glyph masked in `TEXT_TOKENS.label`             |
| Value               | `TYPE.label` on a 20 line, `SPACING.markGap` (6) after the name                     | A count or ammunition at the row's right end; it wraps under the name when space runs out |
| Footer              | `SPACING.gap` (8) above Back, `SCROLL.endPad - CARD_CONTENT.frameBorder` (14) below | Back is centred, outside the scrolling body                                               |

A level-one item shows only its name. Higher levels append `[2]` or `[3]`
(`compactLevelName`), without "Level", "LVL" or "of 3". Each row's accessible
name keeps the full label, "Level {n} of {max}", the count and the ammunition.
Labels and values wrap, including within long unbroken words, without
shrinking type.

1. Cargo: Stardust (`icon-stardust-20`) and Ore (`icon-ore-20`) with exact
   grouped counts, "Holodisks: {n} of 6" (`icon-holodisk-20`), one
   "Carrying: {item}" row per carried item or "Carrying: Nothing"
   (`icon-cargo-20`), then "Towing: {craft}" or "Towing: Nothing"
   (`icon-tow-20`). Carrying and Towing rows are always present and
   independent: each carried item keeps its own row, and a towed craft never
   hides them. A "Nothing" row is a disabled button out of the Tab order
   (`tabIndex` -1) and opens nothing.
2. Equipment: Engine (`icon-shop-engine-tuning`), Shield (`icon-shop-shield`),
   Tractor beam (`icon-shop-tractor-beam`), then "Paint: {paint}"
   (`icon-shop-ship-paint`), each with its compact level suffix where it has
   a level.
3. Weapons: every owned weapon in HUD order, with its weapon glyph, compact
   level suffix and ammunition as a grouped count; the Laser's ammunition is
   blank. With no owned weapons the heading remains and no empty-state copy is
   added. There is no "Ammo" heading.

Height follows the content up to the available rect. Past that the body
scrolls vertically with all three columns and both dividers together, while
the title, close X and Back stay fixed.

Map, from the Paused card, is a full-screen map rather than a card: the
galaxy's field under the insets, with every part on the page rect
(`safeRect(insets, SPACING.pageInset, view)`): a header panel on its top-left
(the name, the percent, then ten survey pips), a row of three `HUD_BUTTON` tools
(zoom out, zoom in, recentre) on its top-right, the place panel on its
bottom-left, and the footer of Quests, Galaxies and Close (primary) on its
bottom-right. Quests opens a Quests modal card over it. Its tokens
(`MAP_SCREEN`, `MAP_PANEL`, `MAP_SYMBOL`), fit, press areas and states are in
[Map](map.md). Close (labelled Back from the Paused card), back and Escape
return to Paused. The modal's top-right X uses that same one-layer path
exactly once and preserves focus restoration. The current Map has the footer
dismissal but lacks the header X. Its informational Place panel is part of
the Map, with no separate X or dim.

The balance is one centred group: `icon-stardust-20`, `SPACING.markGap`, the
amount in `TYPE.label`, on a 20 line. The shop's row and well geometry is in
[Shop item row](#shop-item-row).

### Start screen

A full screen modelled on Chibi's start screen (`chibis-way-home`
`src/ui/layout/startScreen.ts`, `START_SCREEN`): Ada's ship in flight above the
two-line wordmark, the action row under it, then the note. There is no card,
header, dim or portrait; the Ada and Penny portraits and the start card are
removed. Art, colours and contrast are in [Title screen art](title-screen.md).
The HUD row's top left holds the Menu button in the pause button's place; it
opens the Menu card (Achievements, Cheats, Settings, Close). In an
installed app window that can close the app, Exit shows at the top right at
`hudButtonTarget(0)` with the authored Exit poses.
Nothing moves with the saved state except the action row's contents.
The Start row follows the [action sizing rule](#groups). Keep Start centred
when it is the sole action, and keep Continue to the right of Restart.
`src/ui/startScreen.ts` centres the row on the game area. Its buttons
have intrinsic widths. `START_SCREEN.actions.width` caps each at 192
logical px, and the row cap is two such widths plus `BUTTON_GAP`.

Every part except the field and the nav discs is placed in play-view px, from
`playView(view)`'s top-left (`x0`, `y0`), so it stays centred on the game area
at every aspect.

| Token             | Value                                               | Rule                                                                                                | Constant                                    |
| ----------------- | --------------------------------------------------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| Field             | `title-field`, 960x660, top-left (-120, -120)       | Under everything; the space background fills beyond it                                              | `titleScreen.field.at`, `title-screen.json` |
| Ship              | 280 square frame centred on (378, 84)               | The selected paint's `ship-52` with speed jets at `titleScreen.ship.jetSpeed` (0.8)                 | `START_SCREEN.ship`, `startScreen.ts`       |
| Wordmark          | `title-wordmark`, 270x102, top-left (225, 148)      | Centred on the play view (`360 - 270 / 2`); Chibi's logo top is 60 under its nav bar                | `START_SCREEN.wordmark`, `startScreen.ts`   |
| Action row        | Top 264, `TEXT_BUTTON.height`                       | Centred, 14 below the wordmark (Chibi's 15 from logo to actions). Chibi's row is at 268.            | `START_SCREEN.actions`, `startScreen.ts`    |
| Start             | Content width, centred on the game area             | Primary, `ui-button-primary`. First run only.                                                       | `START_SCREEN.actions`                      |
| Restart, Continue | Content widths, `BUTTON_GAP` apart                  | With saved progress, Restart secondary (`ui-button`) on the left and Continue primary on the right. | `START_SCREEN.actions`                      |
| Note              | One `TYPE.body` line box, top 320, centred on x 360 | Cream `#ead4aa`, no panel or shadow; `SPACING.gap` below the action row                             | `START_SCREEN.note`, `startScreen.ts`       |

- Labels and actions are Gameplay's: Start, Continue, Restart and the
  `deferred` note; the wordmark's accessible name is the `home` string.
- Continue (or Start) is the default Enter and Space action and the first Tab
  stop, then Restart, Menu and Exit (when shown). Each button's
  face box is its press area (at least 48 per axis); the 16 gap separates
  Restart and Continue.
- Draw order: field, jets, ship frame, wordmark, actions, note, nav discs.
- Taller views (1280x720 is 720x405, `y0` 22) keep every part at its
  play-view place, so the parts move down with the centred game area, and show
  more field below. The field's top-left is also from (`x0`, `y0`): at
  1280x720 it spans view y -98 to 562, so it covers the game area and the
  bands above and below it.

Native Start measurements at 720x360 with left and right insets of 43,
bottom 19 and top 0 recorded face widths of 73.02 for Start, 94.03 for
Restart and 110 for Continue, each 48 logical px high.

Anchor rects in logical px. Insets are left and right 43, bottom 19, top 0;
at 844x390 the logical view is 779.08x360 and `x0` is 29.

| Part             | 720x360                      | 720x360, insets               | 844x390                       | 844x390, insets               |
| ---------------- | ---------------------------- | ----------------------------- | ----------------------------- | ----------------------------- |
| HUD rect         | 12 to 708, top 12            | 43 to 677, top 12             | 41 to 737, top 12             | 43 to 735, top 12             |
| Available rect   | 16 to 704, 16 to 344         | 43 to 677, 16 to 341          | 16 to 763.08, 16 to 344       | 43 to 736.08, 16 to 341       |
| Field            | -120 to 840, -120 to 540     | -120 to 840, -120 to 540      | -91 to 869, -120 to 540       | -91 to 869, -120 to 540       |
| Ship frame       | 238 to 518, -56 to 224       | 238 to 518, -56 to 224        | 267 to 547, -56 to 224        | 267 to 547, -56 to 224        |
| Ship ink         | 225.7 to 484, 42 to 141      | 225.7 to 484, 42 to 141       | 254.7 to 513, 42 to 141       | 254.7 to 513, 42 to 141       |
| Wordmark         | 225 to 495, 148 to 250       | 225 to 495, 148 to 250        | 254 to 524, 148 to 250        | 254 to 524, 148 to 250        |
| Note line box    | Centre 360, 320 to 340       | Centre 360, 320 to 340        | Centre 389, 320 to 340        | Centre 389, 320 to 340        |
| Menu             | 2.25 to 54.75, 2.25 to 54.75 | 33.25 to 85.75, 2.25 to 54.75 | 31.25 to 83.75, 2.25 to 54.75 | 33.25 to 85.75, 2.25 to 54.75 |
| Exit, when shown | 667.5 to 715.5, 4.5 to 52.5  | 636.5 to 684.5, 4.5 to 52.5   | 696.5 to 744.5, 4.5 to 52.5   | 694.5 to 742.5, 4.5 to 52.5   |

Clearances, smallest at 720x360 with insets:

| Pair                              | Arithmetic      | Result                                    |
| --------------------------------- | --------------- | ----------------------------------------- |
| Menu to ship ink                  | `225.7 - 85.75` | 139.95                                    |
| Menu to wordmark                  | `225 - 85.75`   | 139.25                                    |
| Ship ink to Exit, shown           | `636.5 - 484`   | 152.5, beside the HUD row, never under it |
| Wordmark to Exit, shown           | `636.5 - 495`   | 141.5 (170.5 at 844x390 with insets)      |
| Ship ink to wordmark              | `148 - 141`     | 7                                         |
| Wordmark to the action row        | `264 - 250`     | 14                                        |
| Action row to the note            | `320 - 312`     | 8, `SPACING.gap`                          |
| Note to the available rect bottom | `341 - 340`     | 1 (4 without a bottom inset)              |

- Keep the 16 gap and the 14 above the row. The current 4 px button focus
  outset fits inside these gaps pending migration to the
  [button state cues](controls.md#buttons). Exit currently puts its ring on
  the disc artwork and switches the outline to `Highlight` in forced colors.
  Each nav disc's target is its press area.
- Menu takes the pause button's place and press area on the HUD rect's top-left
  corner. Exit's target is `hudButtonTarget(0)`: its disc has its drawn right
  edge and top on the HUD rect's corner, and its target reaches 7.5 past it
  (into the 43 inset with phone insets).

### Shop item row

Shop uses two fixed equal-width panes with an 8 px gap. The second pane
has a 1 px left separator and 8 px left padding. Each `TYPE.label` heading
sits 8 px above its list. Rows fill the pane's inner width, with up to four
offers and a `SPACING.rowGap` (4) between rows.

Each `ui-button-tile` is one control. Geometry uses `SHOP_ROW` and the
Station pane rules in `src/ui/layout/stationStyle.ts`.

| Part          | Geometry                                                                                              |
| ------------- | ----------------------------------------------------------------------------------------------------- |
| Row           | `SHOP_ROW.height - SPACING.gap` (40), with 8 px side insets                                           |
| Item well     | `SHOP_ROW.well - SPACING.rowGap` (32 square). Centre the 20 px glyph, 24 px composite or 32 px swatch |
| Text          | 8 px from the well, on 16 px line boxes. The flexible column truncates long lines                     |
| Trailing slot | Content-width price or status, 8 px from the text and aligned to the right inset                      |
| Price pill    | 28 px high, with 8 px side padding and a 16 px icon 6 px from the price                               |
| Status        | 12x8 check with a 6 px gap to its label                                                               |
| Confirm well  | 56 square. Centre the glyph at 2x (40, or 48 for the composite) or a 48 px swatch                     |
| Confirm price | 20 px Stardust icon, 6 px gap and price in `TYPE.heading`                                             |

See [Station and shop](shop.md#shop) for stock, row states and icon sources.

### Job board row

Jobs & Projects uses the same fixed panes and compact tile geometry. Jobs
occupy the left pane and Community projects the right where offered.
Each tile keeps the glyph and text beside a trailing reward, contribution or
status. Decisions use a separate detail dialog. The board has no pager or
scrolling list. See [Jobs & Projects](shop.md#job-board) and
[Donation confirm](projects.md#donation-confirm) for row and detail behaviour.

### Storybook page

Earth scenes, and space story pages that pause flight. One panel holds a text
column and a choice column side by side, bottom-anchored over the scene and
only as tall as its page needs; the scene shows in the strip above it.

A mandatory Earth Storybook choice in the live story, such as a chapter's
`opening` page, has no Cancel path. Storybook renders a region and requires
an explicit choice to advance. Skip and Next are guarded, and Previous only
retraces the story when a prior page exists. Preserve those guards and
keep replay's existing navigation.

Constants: `STORY_PANEL` and `STORY_BACKGROUND`, `storyPage.ts`;
`STORY_BUTTON`, `controls.ts`; `STORY_SKIP` and `STORY_PANEL_TOP`,
`playView.ts`.

| Token          | Value                                                                                                                                                                                                                                                                                                                                                                                 | Rule                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Background     | 960x540 logical canvas at 2x ([storybook](storybook.md)), scale `k = max(1, viewW / 960, viewH / 540)`, nearest neighbour, under the insets, centred across                                                                                                                                                                                                                           | Offset down by the run anchor below, so the subject shows in the strip                                                                                                                                                                                                                                                                                                                                                                                      |
| Run anchor     | Canvas top `y = clamp(viewH - 540 * k, stripTop / 2 - k * (subject.top + subject.bottom) / 2, 0)`, `stripTop` the panel top of the tallest page in the story run on that background                                                                                                                                                                                                   | The subject band's centre sits at the centre of the strip above that panel; the clamp keeps the canvas covering the view. One placement per story run and background, so the background never moves between its pages, Previous across a scene boundary included; a shorter page shows more of the scene below                                                                                                                                              |
| Subject band   | `subject: { top, bottom }` in canvas logical px, on each background's manifest entry ([storybook](storybook.md#subject-bands))                                                                                                                                                                                                                                                        | The rows the scene's key objects span                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Panel rect     | The available rect's width, at most `STORY_PANEL.maxWidth` 760, centred; bottom on the available rect's bottom                                                                                                                                                                                                                                                                        | `ui-settings-card` face, no dim behind it                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Panel height   | `2 * padding + max(text column content, choice column content)`                                                                                                                                                                                                                                                                                                                       | The width and bottom edge stay fixed; the top moves with each page's content                                                                                                                                                                                                                                                                                                                                                                                |
| Panel top cap  | `STORY_PANEL_TOP` is the HUD rect top plus the larger of `HUD_ROW.bottom` and Skip's bottom offset, then `SPACING.gap`. At 720x360 it is y 68 (Skip ends at 60). Ada's room uses `STORY_ROOM_PANEL_TOP`, y 62.75 (Menu target ends at 54.75).                                                                                                                                         | Past it the panel stops growing and only the text column scrolls                                                                                                                                                                                                                                                                                                                                                                                            |
| Padding        | `STORY_PANEL.padding` = `SPACING.panelPadding` 16, including the 2 frame                                                                                                                                                                                                                                                                                                              | Inner width = panel width - 32                                                                                                                                                                                                                                                                                                                                                                                                                              |
| Columns        | Text column, `STORY_PANEL.columnGap` 25, choice column                                                                                                                                                                                                                                                                                                                                | The gap holds a 1 rule in card rim `#6b6685`, 12 from each column, over the full inner height                                                                                                                                                                                                                                                                                                                                                               |
| Choice column  | `clamp(228, 0.38 * (inner width - 25), 300)` (`STORY_PANEL.choiceColumn` share, min, max)                                                                                                                                                                                                                                                                                             | The text column takes the rest: 349 to 428, about 43 to 53 characters of `TYPE.story` per line; the 228 floor seats Previous and Continue side by side                                                                                                                                                                                                                                                                                                      |
| Text content   | The heading if present, the name tab and portrait if present, then the paragraph                                                                                                                                                                                                                                                                                                      | Its height includes the portrait frame where the frame is taller                                                                                                                                                                                                                                                                                                                                                                                            |
| Choice content | The choices, `SMALL_BUTTON_GAP` 24, then the page controls; a page without choices holds the page controls alone                                                                                                                                                                                                                                                                      | The page controls are one 36 row; a named action that does not fit beside Previous takes its own row 24 below it (36 + 24 + 36 = 96)                                                                                                                                                                                                                                                                                                                        |
| Story text     | `TYPE.story` 18 regular on 26, cream `#ead4aa` on the card `#3b3850` (7.76:1), left-aligned, top of the column                                                                                                                                                                                                                                                                        | Liberation Sans averages 8.02 per character at 18; never shrinks                                                                                                                                                                                                                                                                                                                                                                                            |
| Heading        | The chapter's panel title (Gameplay's copy) on opening, resolution and closing pages: `TYPE.heading` 24 bold on 28, white `#ffffff` on the card (11.25:1), left-aligned, the column's first line                                                                                                                                                                                      | `SPACING.gap` above the paragraph, so it adds 36 to the text column; the widest title ("The Glowing Rock.", 216) fits every measure on one line                                                                                                                                                                                                                                                                                                             |
| Name tab       | `CONVERSATION_BOX.tab`: 20 high, label width + `2 * SPACING.markGap`, 1 ink edge, radius 2, `TYPE.label` in ink                                                                                                                                                                                                                                                                       | The speaker's tab colour ([Controls](controls.md#conversation-box)); the column's first line, `SPACING.gap` above the paragraph                                                                                                                                                                                                                                                                                                                             |
| Portrait       | `STORY_PANEL.portrait`: the 32 storybook frame at 2x (64), nearest neighbour, in a 68 frame (2 ink edge, navy `#262b44` face)                                                                                                                                                                                                                                                         | Floated on the column top: at the inner right for every speaker but Ada, at the inner left for Ada; never mirrored                                                                                                                                                                                                                                                                                                                                          |
| Portrait gap   | `SPACING.gap` to the text, `SPACING.rowGap` below                                                                                                                                                                                                                                                                                                                                     | The name tab and the paragraph wrap beside the frame, then take the full measure below it                                                                                                                                                                                                                                                                                                                                                                   |
| Choices        | `STORY_BUTTON` secondary, filling the choice column, stacked from its top, faces `SMALL_BUTTON_GAP` 24 apart (a 60 pitch)                                                                                                                                                                                                                                                             | `hitAround` grows a 36 face 9 per side (54), so neighbouring press areas stay 6 apart, each at least `HIT_RULE.minTarget` 48                                                                                                                                                                                                                                                                                                                                |
| Page controls  | One row at the bottom: Previous (secondary) left, Next or Continue (primary) right, sized to their own labels with the story insets and `SMALL_BUTTON_GAP` 24 between them. Centre a sole visible action.                                                                                                                                                                             | At label width + 32, Previous is 99.59, Next 66.68 and Continue 101.32, so Previous and Continue need 224.91 of the 228 floor. Current equal halves are 102 to 119 wide and pending sizing migration.                                                                                                                                                                                                                                                       |
| Named action   | A page's named action in Next's place: size each button to its content plus the story insets when both fit with the 24 gap. When they exceed the column, stack them 24 apart at a shared width.                                                                                                                                                                                       | At their own widths "Touch the glow." (151.98), "Pick up the rock." (160.04) and "Let's find your holodisk." (216.26) need 275.57, 283.63 and 339.85 beside Previous, past every choice column (228 to 262.23), so all three go below Previous at all four screens. Currently a beside action can grow in its track. In the two-line layout the lower action fills the column while Previous keeps its half-width track. Both are pending sizing migration. |
| Scroll         | The text column scrolls when the panel reaches its top cap; the choices scroll only past the choice limits below. Each scrolling region reserves `SCROLL` 14 on its right (6 gap, 8 track, thumb inset 1)                                                                                                                                                                             | Text never shrinks and never paginates; the page controls stay fixed                                                                                                                                                                                                                                                                                                                                                                                        |
| Skip           | `STORY_SKIP` in `playView.ts` anchors the outer box at the HUD rect top (`top = 0`). The right offset is 0 with Settings hidden or 57 px with Settings shown (`HUD_BUTTON.disc` 33 plus `SMALL_BUTTON_GAP` 24). The standard secondary button has a 48 px single-line outer height, a 44 px resting face and a 4 px lip. Its outer width follows the label plus standard side insets. | Shown when the page allows Skip (`canSkip`), separately from the panel's page controls                                                                                                                                                                                                                                                                                                                                                                      |
| Settings       | The `HUD_BUTTON` disc with its drawn edges on the top-right corner of the edge rect; the 48 target centred on it (7.5 outside the disc)                                                                                                                                                                                                                                               | The start screen's Settings disc, at the same place on every story page                                                                                                                                                                                                                                                                                                                                                                                     |
| Pause          | Ada's room page only: `PAUSE_BUTTON`, its disc's drawn edges on the top-left corner of the edge rect (frame 1 outside), press `hitAround(frame)` 52.5; it opens the room's Menu card, including Cheats                                                                                                                                                                                | The top-left of the HUD row; Skip and Settings keep the top-right                                                                                                                                                                                                                                                                                                                                                                                           |

The edge rect for Pause, Settings and Skip is the shared `hudRect`.
The top-corner controls use the common side clearance from the play-area
edges, with `HUD_EDGE` (12 logical px) as the default. Settings and Skip
use `fromHudEdge("right")` for their right anchor.

Rects in logical px, as x range by y range. Phone insets are left and right
43 and bottom 19 logical; the 844x390 row with insets is an iPhone. The panel's
top is its bottom minus its height. The Skip column gives its top and its right
edge with Settings shown and hidden, in that order.

| Screen   | Logical view | Insets     | Panel x, bottom          | Text column         | Rule x | Choice column           | Settings disc, target                        | Skip top / right (on / off) |
| -------- | ------------ | ---------- | ------------------------ | ------------------- | ------ | ----------------------- | -------------------------------------------- | --------------------------- |
| 720x360  | 720x360      | 43, 43, 19 | 43..677 (634), 341       | 59..408 (349)       | 420    | 433..661 (228)          | 644..677 x 12..45; 636.5..684.5 x 4.5..52.5  | 12 / 620 / 677              |
| 844x390  | 779.08x360   | 43, 43, 19 | 43..736.08 (693.08), 341 | 59..453.37 (394.37) | 465.37 | 478.37..720.08 (241.71) | 702..735 x 12..45; 694.5..742.5 x 4.5..52.5  | 12 / 678 / 735              |
| 844x390  | 779.08x360   | None       | 16..763.08 (747.08), 344 | 32..459.85 (427.85) | 471.85 | 484.85..747.08 (262.23) | 704..737 x 12..45; 696.5..744.5 x 4.5..52.5  | 12 / 680 / 737              |
| 1280x720 | 720x405      | None       | 16..704 (688), 389       | 32..423.22 (391.22) | 435.22 | 448.22..688 (239.78)    | 675..708 x 34..67; 667.5..715.5 x 26.5..74.5 | 34 / 651 / 708              |

At 720x360 with phone insets and Settings hidden, the measured Skip bounds are
x 606.98..677 and y 12..60. The resting face ends at y 56. The label ink leaves
17 / 17 / 15 / 16 logical px at the left, right, top and bottom of the face.

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
24 + 36 = 216, so 248 with the padding. These examples fit without scrolling
under the 273 cap for the 720x360 inset layout.

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
above, under the ordinary panel caps of 273, 273, 276 and 299.

The limits give, not the layout. A wrapped label adds 20 to its face (56). At
720x360 with insets the ordinary cap is 341 - 68 = 273, so the choice column
may hold 273 - 32 = 241:

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
  dimmed space view, without a background, as the [conversation card](#conversation-card)
  does. In-flight lines use the
  [conversation box](#conversation-box), which neither pauses nor dims.

### Conversation box

In-flight dialogue: one line at a time from one speaker, over live flight.
Constants: `CONVERSATION_BOX`, `conversationBox.ts`. Colours are in
[Controls](controls.md#conversation-box); portraits are in
[Conversation portraits](conversation.md). Chibi's dialogue panel uses the same
values with its own sprites and fonts, and the same vertical rule: the box top
sits 5 below the lowest drawn art of the top-right HUD row (Ada's count pills)
and the name tab overhangs it by 10.

| Token          | Value                                                                                          | Rule                                                                                                                                                                                                                           |
| -------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Width          | `min(availableWidth, CONVERSATION_BOX.maxWidth)`, max 480                                      | Centred on the available rect; 480 at every supported view (the page rect is at least 634 wide)                                                                                                                                |
| Top            | The count pills' bottom plus `HUD_AMMO_COUNT.clearance` (5) (`CONVERSATION_BOX.top`)           | HUD rect top `- 7.5 + 42 + 14 + 5` = + 53.5, so 65.5 without a top inset; the same rule in both games                                                                                                                          |
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
- Clearance at the 360-high view: the box spans 65.5 to 125.5. The ship's
  pivot sits at the play view's centre (180) with a 42 display frame; its highest
  drawn hull point across the 32 headings is 168.17 (heading 4, the apex),
  42.67 below the box. The rule is at least 24.
- At the 1280x720 view (720x405 logical) the HUD rect and the ship's pivot
  move down 22 with the game area: the box spans 87.5 to 147.5 and the hull top
  is 190.17, 42.67 below, as at the 360-high view.

#### Tab clearance

The tab spans HUD rect top + 43.5 to + 63.5 (55.5 to 75.5). Vertically it
clears the status pill (bottom + 30.5) by 13, the weapon discs (bottom + 33)
by 10.5 and the weapon targets (bottom + 40.5) by 3. It shares rows with the
count pills (+ 34.5 to + 48.5), and clears the pause press area's bottom
(+ 42.75) by 0.75. Across, the box is centred and 480 wide;
Ada's tab ("Ada", 42.23) starts 64 in and every other tab 8 in, the widest
"General Gadget" (131.15). With six weapons the leftmost target is Laser's
(target 5, no count pill) and the leftmost count pill is target 4's.

| View                  | Box              | Ada's tab        | Widest other tab | Pause press right | Target 5 left | Target 4 (pill centre) | Nearest across                     |
| --------------------- | ---------------- | ---------------- | ---------------- | ----------------- | ------------- | ---------------------- | ---------------------------------- |
| 720x360, 1280x720     | 120 to 600       | 184 to 226.23    | 128 to 259.15    | 54.75             | 382.5         | 439.5 (463.5)          | 73.25 to pause, 123.35 to target 5 |
| 720x360, phone insets | 120 to 600       | 184 to 226.23    | 128 to 259.15    | 85.75             | 351.5         | 408.5 (432.5)          | 42.25 to pause, 92.35 to target 5  |
| 844x390               | 149.54 to 629.54 | 213.54 to 255.77 | 157.54 to 288.69 | 83.75             | 412.58        | 469.58 (493.58)        | 73.79 to pause, 123.89 to target 5 |
| 844x390, insets 43    | 149.54 to 629.54 | 213.54 to 255.77 | 157.54 to 288.69 | 85.75             | 410.58        | 467.58 (491.58)        | 71.79 to pause, 121.89 to target 5 |

- No overlaps: every tab ends at least 92.35 left of any weapon column and
  starts at least 42.25 right of the pause press area, the two it shares rows
  with; the status pill ends above the tab. The `+N` labels and the item notice
  draw over it.
- Ada's tab starts 8 right of her portrait frame (`4 + 52`); the 10 of every
  tab inside the panel stay above the text block's first line box.
- The status pill keeps `SPACING.pageInset` from the weapon press areas at
  every width above.

### Galaxy selector

The Galaxy selector is a standalone full-screen modal over the
[route sky](route-sky.md), after Chibi's zone map. Six galaxy markers run
left to right along one arc over the night sky, with Earth inside the arc.
The selected destination has a panel and one centred destination action
below it. Use the top-right X for the existing one-layer Back action exactly
once, with no extra Back button in the action area. The current selector
offers Back and Escape input and lacks the header X.

Constants: `GALAXY_MAP`, `GALAXY_MAP_PANEL`, `GALAXY_MAP_ACTIONS` and `GALAXY_MAP_MOVE`,
`src/ui/layout/galaxyMap.ts`. Positions are logical px from the play view's
top-left (add `playView.x` and `playView.y`: 29 and 0 at 779 wide, 0 and 22
at 720x405); "insets" means the phone insets 43
left and right and 19 bottom at 720x360. Route order, numbers, names and
flavour lines are Gameplay's; marker colours and previews are in
[Galaxies](galaxies.md#markers).

Chart (`GALAXY_MAP`):

| Part                  | Geometry                                                                                                                                                                                                                                                                                                                                                                                      |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Backdrop              | `route-sky`, top-centre on the play view's top-centre, and `route-ground` with Ada and Penny, bottom on the view's bottom, at 1x under the insets ([route sky](route-sky.md)); no ink layer: the sky's guard holds it at relative luminance 0.028 or less behind the six galaxy markers, their labels and every leg; the Earth marker and its label are outside the guard's footprint         |
| Rules                 | 1 px `#6B6685` on the available rect, and 1 px `#4A4660` 3 inside it, as Chibi's paper's inset rules (`GALAXY_MAP.rules`), over the sky and under the ground                                                                                                                                                                                                                                  |
| Marker centres        | On one circular arc through route positions 1 (96, 122) and 6 (624, 122) whose top is (360, 46): radius `(264² + 76²) / 152` = 496.53 about (360, 542.53), the six centres at equal angles from -32.12° to 32.12° off vertical, 12.85° apart: 1 (96, 122), 2 (196.12, 73.82), 3 (304.45, 49.12), 4 (415.55, 49.12), 5 (523.88, 73.82), 6 (624, 122), left to right in route order (`centres`) |
| Marker                | 36 frame: disc radius 12 with a 1.5 ink edge, the route number in `TYPE.label` ink centred on it, over an ink backing disc radius 15 at 0.85 (`marker`)                                                                                                                                                                                                                                       |
| Current selected ring | 2 px cream `#EAD4AA` at radius 17 (band 16 to 18) on the marker whose panel shows, Earth's included (`marker.ring`). Pending button-state migration                                                                                                                                                                                                                                           |
| Route line            | The arc itself between consecutive markers, each leg 111.34 of arc; stamped every 0.5; stops 15 from each centre (`path`)                                                                                                                                                                                                                                                                     |
| Line looks            | By the leg's destination: open 4 px solid cream; locked 2 px `#B8B3C9` dashes, 6 on and 4 off                                                                                                                                                                                                                                                                                                 |
| Label                 | Name in `TYPE.label` on an ink pill at 0.85: 20 high, label + 8 wide, radius 4, top at centre + 19 (`label`); the pill covers the 3 to 4 leg under it                                                                                                                                                                                                                                         |
| Ship                  | Selected ship frame (`ship-N`) at 42 display, the game area's in-flight size, pivot at (centre x, centre y - 33) (`ship`)                                                                                                                                                                                                                                                                     |
| Ship heading          | Of the 32 headings, the one whose nose angle (`ship-nose.json`) is nearest the arc's tangent at the marker, toward the next galaxy; at galaxy 6, the incoming leg's at its end. Rest headings 24, 25, 27, 29, 31 and 0 for galaxies 1 to 6                                                                                                                                                    |
| Earth marker          | A seventh marker centred at (360, 122), midway between markers 1 and 6, inside the arc: the galaxy marker's frame, backing, its disc blue `#65AEDD` with two green `#8AB86B` patches and no number; label "Earth" on the same pill, top at 141                                                                                                                                                |
| Press area            | 48x48 centred on each marker (`HIT_RULE.minTarget`); galaxy centres are 111.1 apart and Earth's is 91.64 or more from each (markers 3 and 4), so press areas never overlap                                                                                                                                                                                                                    |
| Current focus ring    | 44x44 centred on the marker (36 frame + `FOCUS_RING.outset` 4 a side). Pending button-state migration                                                                                                                                                                                                                                                                                         |

At viewport widths of 720 CSS px or less or heights of 360 CSS px or less,
named destination labels, including Earth, use a 22 logical px line height
to lower their cap bands by 1 within the 20 px pill. Locked labels centre
the visible dots optically within the same 20 px height. Their line height
is 12.2 logical px by default and 11.2 under the same viewport rule,
derived from `GALAXY_MAP_LAYOUT.label.lockedInkLift` (4.4).

Route order runs left to right on screen, so Left and Right follow screen
order.

Panel and action (`GALAXY_MAP_PANEL`, `GALAXY_MAP_ACTIONS`):

| Part        | Geometry                                                                                                                                                                                                                                         |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Panel       | `ui-settings-card` face, 614x112, centred on the play view (x 53), bottom `SPACING.gap` above the action; padding 8, the 2 px frame inside it (see Exceptions)                                                                                   |
| Capture     | The 180x90 [selector preview](galaxies.md#selector-preview) in a 1 px ink frame (182x92) at the inner top-left                                                                                                                                   |
| Text column | 12 right of the capture frame, 404 wide, top-aligned: `Galaxy {number}` (`TYPE.body`), `SPACING.rowGap`, the name (`TYPE.heading`), `SPACING.rowGap`, flavour                                                                                    |
| Flavour     | `TYPE.body`, wrapped to at most 2 lines (every Gameplay line fits 404 in 2); inner height `20 + 4 + 28 + 4 + 40 = 96`. A placeholder galaxy's line fits 404 in 1 (Needle 387.77, Andromeda 402.04), and "Story in development." takes the second |
| Action      | One centred primary `TEXT_BUTTON` (`galaxy-jump`), 48 high. Fit the width to the single-line label with standard insets, up to the 614 px panel width.                                                                                           |
| Action top  | Available rect bottom - 48                                                                                                                                                                                                                       |

The chart anchors to the play view's top; the panel and action anchor to the
available rect's bottom, so a taller view opens the gap between them.

| At 720x360     | No insets              | Phone insets           |
| -------------- | ---------------------- | ---------------------- |
| Available rect | (16, 16) to (704, 344) | (43, 16) to (677, 341) |
| Panel          | (53, 176) 614x112      | (53, 173) 614x112      |
| Capture frame  | (61, 184) 182x92       | (61, 181) 182x92       |
| Text column    | x 255, top 184, w 404  | x 255, top 181, w 404  |
| Action         | Centred, y 296, h 48   | Centred, y 293, h 48   |
| End label gap  | 161 to 176: 15         | 161 to 173: 12         |

Markers, labels, rules inside the frame and the ship are the same in both;
the label pills of markers 1 and 6 and of Earth end at 161, the chart's lowest
mark. Across the
32 headings the ship's hull spans 11.8 above to 9.8 below its pivot at 42, so
a resting hull ends 23.2 or more above its marker's centre, clear of the
selected ring (radius 18) and the focus ring (22). Resting and in flight, the
hull keeps 23.5 from every label pill, 18.8 from every leg's stroke and 6.1
from the play view's top. At markers 3 and 4 the resting hull starts at 10.3 and
7.8 at 360-high views, over the rules at 16 and 19, which draw under it.

Galaxy and Earth markers use native buttons. The state table records the
current button visuals pending migration. Use a visible face or ink change
for focus, press and selection per [Controls](controls.md#buttons). Keep the
authored marker art, persistent edges, route and ship clearance.

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

Panel states (the panel shows the ship's galaxy, the locked galaxy last
tapped or focused, or Earth while its marker is tapped or focused):

| State       | `Galaxy {number}` | Name             | Flavour                                                                           | Capture                                                     | Action                                                                         |
| ----------- | ----------------- | ---------------- | --------------------------------------------------------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Open        | `#B8B3C9`         | White, the name  | Cream, the flavour line                                                           | Its own field                                               | Live: "Jump to {galaxy}", or "Stay in {galaxy}" on the galaxy Ada is flying in |
| Placeholder | `#B8B3C9`         | White, the name  | Cream, the flavour line, then "Story in development." in `#B8B3C9`                | Its [placeholder preview](galaxies.md#placeholder-previews) | As Open                                                                        |
| Locked      | `#B8B3C9`         | "...", `#B8B3C9` | "...", `#B8B3C9`                                                                  | The locked greyscale                                        | Unavailable: "Progress the story to unlock", disabled face, refusal cue        |
| Earth       | "Home", `#B8B3C9` | White, "Earth"   | Cream, "Ada’s life on Earth. Time here stands still while she’s aboard the ship." | Ada's room picture                                          | Live: "Jump to Earth", or "Stay on Earth" at boarding                          |

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
  marker shows its panel face while the ship stays on its open galaxy; the
  action is then unavailable and refuses. Tapping Earth shows Earth's panel.
- In the current selector, Tab focuses every galaxy marker in route
  order, then Earth and the destination action, and wraps. Focus starts on the action, the default. A
  focused locked marker or Earth shows its panel as a tap does; a focused open
  marker moves the ship there. Enter, Space and the gamepad's confirm activate
  the focused control; on a marker they act as a tap.
- The destination action leaves galaxy selection: "Jump to {galaxy}" quantum
  jumps there, "Jump to Earth" jumps Ada home to her room, "Stay in {galaxy}"
  returns to the local map and "Stay on Earth" returns her to her room, both
  without a jump.
- The top-right X follows the same one-layer return as Back and Escape
  without jumping. In flight, restore the Local Map with focus on Galaxies.
  At boarding, restore the "Welcome back, Navigator." page and its existing
  focus target. Preserve the authored unlock and jump input guards. An input
  that finishes the unlock animation must not also dismiss the selector.

Moves (`GALAXY_MAP_MOVE`):

| Move           | Rule                                                                                                                                                                                                                                                                |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Selection      | The ship travels the legs between the two galaxies at 360 px/s, clamped to 0.3 to 0.9 s, easeInOutSine on arc length; the panel switches at the input; a new input retargets from the ship's position                                                               |
| Unlock         | The first boarding after an unlock opens with the ship on the galaxy it flew from and every newly unlocked galaxy still locked, plays the steps below, then waits for the player's choice                                                                           |
| 0 to 300 ms    | Every newly unlocked marker crossfades from its locked face to its hue (ease-out quad); the legs to them turn from dashes to the open line, drawn along the route from the ship's marker                                                                            |
| 0 to 400 ms    | A 2 px ring in the farthest new marker's hue grows from radius 13 to 26, alpha 0.8 to 0                                                                                                                                                                             |
| 400 ms         | The ship departs on its heading frame, selected each frame from the path tangent; it flies the legs to the farthest newly unlocked galaxy as one path at clamp(length / 180 px/s, 0.8, 2.0) s, easeInOutSine on arc length, so the whole unlock takes at most 2.4 s |
| Timeline       | Sunflower to Whirlpool, one 111.34 leg: 800 ms of flight (the 0.8 s floor), arrival at 1200 ms. Whirlpool to Cartwheel, 334.02 over three legs: 1856 ms of flight, arrival at 2256 ms                                                                               |
| Arrival        | The idle frame. The current selected ring fades in over 120 ms pending button-state migration. The panel crossfades to the new galaxy over 160 ms and focus moves to the action                                                                                     |
| Skip           | A tap, key or button press during the unlock jumps to the arrived state                                                                                                                                                                                             |
| Reduced motion | No travel or pulse. Selection moves cut. The unlock fades the ship out over 150 ms, switches the markers and legs at 150 ms, then fades the ship in at the new galaxy over 150 ms: 300 ms in all                                                                    |

The ship's path is the route curve offset by the ship pivot (0, -25), so it
leaves and lands standing above the markers.

## Changes from current values

This table records the layout rollout against its earlier baseline. The
screen sections above specify the design, and source-specific observations
identify pending runtime changes.

| Change                                                                                                                                                                                                                       | Was                                                                                                                           |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| ------------------------------------------------------------------------------------------------------------------------------                                                                                               | -----------------------------------------------------------------------------------                                           |
| UI is logical px scaled by `s`: about 8% larger on an 844x390 phone, 1.78x at 1280x720, 2.67x at 1920x1080                                                                                                                   | CSS px at 1x, independent of the canvas                                                                                       |
| Safe insets clamp HUD controls, cards and page content                                                                                                                                                                       | Insets not read                                                                                                               |
| Sticks sit 80 from the outer sides and 50 above the screen bottom, ignoring safe insets, moved inward to stay `STICK_AREA_MARGIN` 8 inside the game area; Use follows the aim stick                                          | 24 from its sides, each side's own inset replacing it, and 20 above its bottom                                                |
| Every action stack fills the inner width with `STACK_BUTTON_GAP`                                                                                                                                                             | Generic stacks 4 apart                                                                                                        |
| Status pill beside pause: the shield bar (96x12) and the Stardust count in one `PILL`                                                                                                                                        | Shield bar 3 high across the bottom; Stardust count a 14 px plate under the weapons                                           |
| Shield pill at the bottom centre: the shield icon and a 120, 180 or 240 by 12 bar by Shield level; the status pill keeps Stardust, ore and cargo                                                                             | The shield bar (96x12) in the status pill beside pause                                                                        |
| Use is Chibi's touch disc with an action symbol, (-80, -80) from the aim stick; sticks and Use are touch only                                                                                                                | A labelled `TEXT_BUTTON` at the bottom centre                                                                                 |
| `+N` labels under their counts, over the conversation box, in the item notice's layer                                                                                                                                        | Beside the pill on its row                                                                                                    |
| Conversation, notice and status pill panels and the shield track are ink at 0.65 in every galaxy                                                                                                                             | Panels at 0.70; opaque ink track                                                                                              |
| HUD top controls anchor to `hudRect`: drawn art `HUD_EDGE` 12 in from the game area's top and sides, mirrored with the larger side inset; the pill takes the left edge while pause is hidden                                 | Press targets `CONTROL_EDGE` 8 in, each side clamped by its own inset; the pill kept its place beside the hidden pause button |
| Weapon buttons: 48 targets 9 apart (discs 24), 33 disc, 20 glyph, common ink annulus; target is the press area                                                                                                               | 48 squares, 24 glyph, cream ring                                                                                              |
| Ammunition counts: an ink count pill under each non-Laser weapon disc                                                                                                                                                        | No counts; ammunition was unlimited                                                                                           |
| Pause draws `pause.svg` with smooth sampling                                                                                                                                                                                 | `ui-pause` PNG, nearest neighbour                                                                                             |
| Settings draws `settings.svg` as a mask with smooth sampling                                                                                                                                                                 | `icon-settings-nav` PNG mask                                                                                                  |
| Start screen Menu in the pause button's place opens the Menu card; Exit, only in an installed app window that can close, is a `HUD_BUTTON` at `hudButtonTarget(0)`; the action row keeps only Start, or Restart and Continue | A secondary button at the end of the start card's action stack                                                                |
| Start screen: ship, wordmark and an action row over the title field, Start and Continue primary (`START_SCREEN`). Buttons fit their own labels                                                                               | A page card with a heading, the Ada and Penny portraits and a secondary action stack                                          |
| Start screen nav discs show a pressed state: white glyph on a `#3a4466` face                                                                                                                                                 | Idle in every state                                                                                                           |
| Cards scroll one scroll group with the header and close fixed                                                                                                                                                                | The whole card scrolls                                                                                                        |
| Prose never widens a card                                                                                                                                                                                                    | 36em prose cap                                                                                                                |
| Notices show in the conversation box's slot (`CONVERSATION_BOX`)                                                                                                                                                             | A `NOTICE` strip on the HUD rect's top                                                                                        |
| Conversation box 480x60: 48 portrait slot in a 52 frame, overhanging name tab, up to two wrapped lines                                                                                                                       | 640x64, 48 frame, name tab inside over one line                                                                               |
| Story pages use `STORY_PANEL`                                                                                                                                                                                                | `.story-panel` clamp and rem sizes                                                                                            |
| Story panel: content-fitted per page, a `TYPE.story` text column beside a column of 36 `STORY_BUTTON` choices and page controls, over a background anchored per story run by its subject band                                | A bottom panel up to 640 wide over a centred background, `TYPE.body` prose, 48 stacked choices                                |
| Story page HUD row on the 12 edge rect (the HUD symmetry rule)                                                                                                                                                               | Skip and Settings on the `CONTROL_EDGE` 8 HUD rect                                                                            |
| Shop row: name to trailing slot is `SPACING.gap`; the paint heading sits on a 20 line                                                                                                                                        | 16; a 24 line                                                                                                                 |
| Galaxy selection is a route map (`GALAXY_MAP`): six galaxy markers on an arc, a panel, Earth and Jump                                                                                                                        | A modal card per galaxy with Previous, Home, Jump and Next (`GALAXY_CARD`)                                                    |
| Pause offers Map: a full-screen map (`MAP_SCREEN`, [Map](map.md)) with symbol chips, fog and a place panel                                                                                                                   | A 288x160 chart in a Map card (`MAP_CARD`)                                                                                    |

## Exceptions

| Exception           | Reason                                                                                                                                                                                               | Retained rules                                                                                         |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Card press areas    | DOM hit-tests element boxes                                                                                                                                                                          | Each control box is at least 48 per axis; close uses `hitAround`                                       |
| Touch sticks        | Continuous input with floating origins                                                                                                                                                               | `TOUCH_STICK` anchors, the `STICK_AREA_MARGIN` clamp, 85% opacity                                      |
| Landing page        | Responsive HTML outside the game canvas                                                                                                                                                              | Same token numbers in CSS px, CSS safe insets                                                          |
| Procedural chrome   | Stick rings, knobs and the speed line draw in frame px                                                                                                                                               | Frames and opacity from [touch joystick sheets](touch-joystick.md)                                     |
| Route panel padding | The historical two-row chart ended at 164. Padding 16 made the panel 128 and overlapped the labels by 7. On the arc, the labels end at 161 and the 112 panel starts at 176, or 173 with phone insets | `SPACING.gap` (8) as padding, the 2 px frame inside it; type roles, row gaps and the capture unchanged |
| Ship card sections  | Cargo, Equipment and Weapons remain side by side at every width, with decorative dividers                                                                                                            | Panel padding on both sides of each 1 px page divider; list row and heading gaps remain distinct       |

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
- Card width equals its family's width (Large 688, Medium 500, Small 400)
  capped at the available width, at 720 and 779 logical wide, whatever the
  content width.
- Verify horizontal and wrapping rows with unequal labels. Every standard
  button keeps `TYPE.label`, `TEXT_BUTTON.height` and the standard insets,
  and each row button fits its own content. Check that one visible action
  centres with hidden siblings or native wrappers present, including in
  dismissal footers. Verify stretched stack widths and primary order in each
  group. Keep neighbouring standard faces `STACK_BUTTON_GAP` apart stacked
  and `BUTTON_GAP` apart side by side, footers included, with
  `SMALL_BUTTON_GAP` in any direction when either is small. Verify that each
  pinned footer keeps its secondary actions on the left edge and its primary
  on the right edge.
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
  80 from its outer side and 50 above the screen bottom, ignoring safe
  insets, no ring nearer
  than `STICK_AREA_MARGIN` to the game area's edge, both rings at one height,
  and Use at the aim stick's rest centre plus (-80, -80).
- `STATUS_PILL`'s left edge equals the pause press area's right plus
  `SPACING.gap` while the pause button shows and the HUD rect's left while it
  is hidden; its centre is the HUD row's centre line; with six weapons at
  720x360 and phone insets, the widest pill (205.64) keeps `SPACING.pageInset`
  from the leftmost weapon target.
- `SHIELD_PILL` is 156, 216 or 276 wide by Shield level, centred on the HUD
  rect, its drawn bottom on the HUD rect's bottom edge (`HUD_EDGE` above the
  game area's bottom, clear of the bottom inset), at least 45 across from both
  ring frames.
- `USE_DISC`'s centre is the aim stick's rest centre plus (-80, -80); its
  press circle never takes a press inside the conversation box; the sticks
  and Use are absent on desktop and under modals.
- The conversation box top equals `HUD_AMMO_COUNT`'s bottom plus
  `HUD_AMMO_COUNT.clearance` (5) at every HUD rect top, and the name tab top
  is 10 above it; the "999m" pill is narrower than the target and centred on
  the disc.
- `hudRect` matches the HUD rect table at 720x360, 844x390 (without insets,
  with both insets and with a left notch), 1280x720 and 1920x1080; the pause
  disc and every weapon disc lie inside `playView` inset by `HUD_EDGE`.
- On the start screen at 720x360 with phone insets, the Menu target is the
  pause press area (33.25 to 85.75, top 2.25) and the Exit target, when shown,
  is `hudButtonTarget(0)` (636.5 to 684.5, top 4.5), 141.5 from the wordmark
  and 152.5 from the ship's ink. Keep the row top at 264 and the note at
  320 to 340 at 720x360 and 844x390, with and without insets.
  Check the centred, content-sized row against the
  [Start screen](#start-screen) sizing rule and measure Start on its own.
- Each card, filled with Gameplay's longest strings at 720x360, fits the
  available rect or scrolls only its scroll group. Card text stays at 16 px
  or above except for the 14 px route labels in [Quest detail](#quest-detail).
  Check that the full route can scroll into view above the fixed footer.
- The route panel keeps one size for every galaxy and state. At 720x360 with
  and without phone insets, every route map rect lies in the available rect,
  the lowest labels end at least `SPACING.gap` above the panel, and the
  marker press areas remain disjoint. The story panel matches the
  storybook rect and height tables at each screen, keeps its width and bottom
  edge across pages, and fits every Gameplay page without scrolling; each
  story run's background placement matches the run anchor for its tallest
  page on that background; a test page longer than the
  column scrolls only the text column, with the choices and page controls in
  place.
- Every story choice and page control is 36 drawn on one line (56 on two),
  `SMALL_BUTTON_GAP` 24 from its neighbours in every direction, with
  a press area of at least 48 per axis; the story text is 18 on 26.
