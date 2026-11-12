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
  view; wider or taller screens show bands outside it. Every control (pause,
  the status pill, weapons, Skip, Settings, the sticks and Use) is placed
  relative to the game area, clamped by the safe insets: the top controls
  through `hudRect`, the sticks and Use by their own offsets
  ([HUD and overlays](#hud-and-overlays)). Both sides use the left game-area
  gap and the larger side inset, so the HUD and the sticks mirror exactly,
  notches included. Cards and page content keep the available rect.
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

| Token            | Value | Rule                                                                                                   | Constant                                                                           |
| ---------------- | ----- | ------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| Row gap          | 4     | Between rows of one list that are not buttons: item rows, text rows                                    | `SPACING.rowGap`, `tokens.ts`, to implement; now `CARD.rowGap`                     |
| Group gap        | 8     | Between card groups and row parts                                                                      | `SPACING.gap`, `tokens.ts`, to implement; now `CARD.gap`                           |
| Column gap       | 8     | Between columns that are not buttons                                                                   | `SPACING.columnGap`, `tokens.ts`, to implement                                     |
| Mark gap         | 6     | From an inline icon to its label inside one control or pill                                            | `SPACING.markGap`, `tokens.ts`, to implement                                       |
| Button gap       | 16    | Between standard button faces side by side: action rows and grid columns                               | `BUTTON_GAP`, `tokens.ts` (game-kit `BUTTON_GAP`), to implement                    |
| Small button gap | 24    | Between faces when either is a small button (face under 48 high), in any direction                     | `SMALL_BUTTON_GAP`, `tokens.ts` (game-kit `SMALL_BUTTON_GAP`), to implement        |
| Stack button gap | 8     | Between standard button faces stacked vertically: action stacks, control rows, grid rows, line buttons | `STACK_BUTTON_GAP`, `tokens.ts` (game-kit 0.27.0 `STACK_BUTTON_GAP`), to implement |
| HUD edge         | 12    | Game area edge to the drawn art of the HUD's outermost elements                                        | `HUD_EDGE`, `playView.ts` (Chibi's value)                                          |
| Control edge     | 8     | The HUD safe-rect margin                                                                               | `CONTROL_EDGE`, `playView.ts` (Chibi `CONTROL_EDGE`)                               |
| Page inset       | 16    | Modals and page content from the view edge                                                             | `SPACING.pageInset`, `tokens.ts`, to implement; now `.ada-modal` padding           |
| Panel padding    | 16    | Inside cards and the story panel, including the 2 px frame                                             | `SPACING.panelPadding` = game-kit `MODAL_CONTENT.padding`; now `CARD.padding`      |
| Body line box    | 20    | 16 px text (body, labels, supporting)                                                                  | `TYPE.body.lineHeight`, `tokens.ts`, to implement                                  |
| Heading line box | 28    | 24 px bold titles                                                                                      | `TYPE.heading.lineHeight`, `tokens.ts`, to implement                               |
| Count line box   | 14    | 12 px bold HUD weapon counts                                                                           | `TYPE.count.lineHeight`, `tokens.ts`, to implement                                 |
| Story line box   | 26    | 18 px storybook text column                                                                            | `TYPE.story.lineHeight`, `tokens.ts`, to implement                                 |

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
  text button and control row, including Quests and Return to Earth.
- Prose groups (wrapping body or supporting text) never widen a card: they
  wrap to the inner width that the other groups and the 50% floor set.
  Single-line labels inside rows and buttons count at their full width.
- Action row: buttons share one width, the widest label plus
  `2 * TEXT_BUTTON.inset`, `BUTTON_GAP` apart; the group centres.
  Paired actions put the secondary left and the primary right.
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
safe-rect clamp still keeps them out of every inset. The sticks and Use are
placed relative to the same game area (see their rows), in Ada and Chibi alike.

Symmetry: one `HUD_EDGE` (12, as in Chibi) runs from the game area's side to
the drawn art of the outermost visible element in each top corner, and from
the top edge to both rows' drawn tops. It measures drawn art, never a press
area. The leftmost visible element sits at `HUD_EDGE` whether or not the pause
button shows. Each side is `ceil(max(left game-area gap + offset, max(inset
left, inset right)))` from its view edge (`mirroredSide`), so a one-sided notch
moves both sides in alike and the HUD and the sticks mirror exactly.

| Token      | Value                                                                                                                                                             | Rule                                                                                                                                                                            | Constant                                                                                      |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Play view  | 720x360 at `x = floor((floor(view.width) - 720) / 2)`, `y = 0`                                                                                                    | The game area: the base view centred across the logical view, at its top; bands outside it                                                                                      | `playView(view)`, `playView.ts`, to implement (Chibi `playView`)                              |
| HUD rect   | Sides `mirroredSide(insets, HUD_EDGE, view)` in from each view edge; top `ceil(max(12, inset top))`; bottom `min(348, view bottom - ceil(max(12, inset bottom)))` | The lines the top controls' drawn art meets (its top corners); the sticks and Use anchor to the same game area with their own offsets                                           | `hudRect(insets, view)`, `HUD_EDGE`, `playView.ts` (Chibi `topShift`)                         |
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

| Element      | Geometry                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Constant                                                                            |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Pause        | Touch only (desktop pauses with Escape): 35x35 frame, 33 disc, drawn edge on the HUD rect's top-left corner (frame 1 outside it), so the disc spans 12 to 45 on both axes at the 720 base; vector art in [Controls](controls.md#pause); press `hitAround(frame)` = 52.5, HUD rect left and top - 9.75 to + 42.75                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | `PAUSE_BUTTON`, `playView.ts`                                                       |
| Weapons      | One `HUD_ROW` of `HUD_BUTTON` targets, `HUD_BUTTON.gap` apart: target `i` from the right at `x = right + 7.5 - 48 - 57 * i`, `y = top - 7.5`; disc and glyph centred in it (disc at 7.5, glyph at 14), so the rightmost disc's drawn right edge and every disc's drawn top sit on the HUD rect (disc 675 to 708, 12 to 45 at the 720 base); the target is the press area (48, `HIT_RULE.minTarget`), 4.5 to 52.5 at a top of 12; each non-Basic weapon carries its [count pill](#weapon-count-pill) under the disc                                                                                                                                                                                                                                                                                                                           | `HUD_BUTTON`, `hudButtonTarget(index)`, `playView.ts`                               |
| Status pill  | One `PILL` holding the shield bar and the Stardust count: left edge `SPACING.gap` right of the pause press area (`PAUSE_BUTTON.hit` right + `SPACING.gap` = HUD rect left + 50.75, 62.75 at the 720 base) while the pause button shows, and on the HUD rect's left edge (`STATUS_PILL.xAlone` 0, so 12) while it is hidden; centred on the HUD row's centre line (HUD rect top + 16.5, so the pill spans HUD rect top + 2.5 to + 30.5, 14.5 to 42.5); grows rightward with the count. Parts and states in [Status pill](#status-pill)                                                                                                                                                                                                                                                                                                        | `STATUS_PILL`, `playView.ts`, to implement                                          |
| Sticks       | 75 frames; ring drawn edges 40 in from the game area's side (`TOUCH_STICK.side`), `mirroredSide(insets, 40, view)` from each view edge (the larger side inset replaces the 40 on both sides), measured from the view's whole-pixel width, and 30 above the game area's bottom (`TOUCH_STICK.bottom`), `min(playView bottom - 30, view bottom - inset - 30)` (the bottom inset adds to the 30, clearing the home bar), so the two sticks mirror each other: rings 40 to 113 and 607 to 680, 257 to 330, at the 720 base; 43 to 116 and 604 to 677, 238 to 311, with phone insets (43, 43, 19); 69 to 142 and 637 to 710 at 844x390; drawn knob reach 12 inside the ring; move input reach 40 and deadzone 2.4 (logical); the move stick draws a speed line from the origin to the thumb, not clamped to the ring; the aim stick draws no line | `TOUCH_STICK`, `touchControls.ts`, to implement; now `sticks.ts`                    |
| Use          | Context action: a `TEXT_BUTTON.height` face with a 2 ink border and radius 8, label in `TYPE.label`, width from the label plus `TEXT_BUTTON.inset`; centred horizontally on the HUD rect (the view's centre, as the rect mirrors), bottom level with the sticks' drawn bottom, `USE_BUTTON.bottom` = `TOUCH_STICK.bottom` 30 above the game area's bottom (face 282 to 330 at the 720 base, 263 to 311 with phone insets); press `hitAround(face)`; shown only while an interaction is available                                                                                                                                                                                                                                                                                                                                             | `USE_BUTTON`, `touchControls.ts`, to implement                                      |
| Settings     | Start screen only: a `HUD_BUTTON` in the [nav disc states](achievements-icon.md#states) with `settings.svg` (20, vector) as its glyph mask, drawn with smooth sampling; target `hudButtonTarget(0)`, its disc's drawn right edge and top on the HUD rect's top-right corner                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | `HUD_BUTTON`, `playView.ts`                                                         |
| Achievements | Start screen only: the same `HUD_BUTTON` with `achievements.svg`; target `hudButtonTarget(1)`, one pitch (57) left of Settings's at the same top, so the targets are `HUD_BUTTON.gap` apart; the target is the press area. See [Start screen](#start-screen)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | `HUD_BUTTON`, `hudButtonTarget(1)`, `playView.ts`, to implement on the start screen |
| Notice       | The conversation box's slot and panel: same rect and ink panel at 0.65, one or two `TYPE.body` cream lines centred in the box, no portrait or name tab, a tap on the box dismisses it; shows at once and holds the slot ahead of a conversation line, which resumes after; a newer notice replaces the current one in place. See [Conversation box](#conversation-box)                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | `CONVERSATION_BOX`, `conversationBox.ts`, to implement; drawn by `notice.ts`        |
| Conversation | In-flight dialogue box below the weapon row: box top `HUD_AMMO_COUNT.clearance` (5) below the count pills' bottom, HUD rect top + 51.5 (63.5 at a top of 12), name tab top 10 higher (53.5), centred, `min(availableWidth, 480)` wide, 60 high, one 48 portrait slot, a name tab overhanging the top edge and up to two lines; the whole box is one press area; non-modal, no dim. See [Conversation box](#conversation-box)                                                                                                                                                                                                                                                                                                                                                                                                                 | `CONVERSATION_BOX`, `conversationBox.ts`, to implement                              |

Overlap rules:

- The top-left cluster is the pause button and the status pill; the top-right
  cluster is the weapons only. The pill's drawn rect and the pause press area
  keep at least `SPACING.pageInset` from the weapon press areas at the smallest
  view (720 logical, with phone insets 43/43/19): the leftmost of four weapon
  targets starts at `677 + 7.5 - 48 - 171` = 465.5 and the pill at 93.75. The
  `+N` label rides the pill's row 6 beyond it, so the pill keeps room for a
  `+9,999` label (51.38 with its outline): the pill may reach
  `465.5 - 16 - 51.38 - 6 - 93.75` = 298.37 wide, a count up to 109.37 wide
  ("999,999,999" is 88.98, "1,234,567" 71.18). With the pause button hidden
  the pill starts at 43 and may reach 349.12, a count up to 160.12.
- The weapon count pills end at HUD rect top + 46.5 (58.5), 5 above the
  conversation box top; they stay inside their targets' columns (the widest,
  "999m", is 38.69 of 48), so they add nothing to the clusters' horizontal
  clearance.
- The Stardust `+N` label sits on the pill's row: its 20 line spans HUD rect
  top + 6.5 to + 26.5 (+ 2.5 at the top of its rise), 15 above the name tab
  top (+ 41.5); see [Tab clearance](#tab-clearance).
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

| Part          | Geometry                                                                                                |
| ------------- | ------------------------------------------------------------------------------------------------------- |
| Panel         | `PILL`: 28 high, radius 4, `PILL.padding` 8 at each end; ink at 0.65, as the conversation panel         |
| Shield icon   | `public/art/ui/icons/shield.svg`, 20 (`HUD_BUTTON.glyph`), a mask in the state's icon colour            |
| Mark gap      | `SPACING.markGap`                                                                                       |
| Shield bar    | `STATUS_PILL.bar` 96x12: 1 rim around the track (ink at 0.65 over the panel), fill area 92x8 at inset 2 |
| Divider       | `STATUS_PILL.dividerGap` 12, a 1x16 divider, 12                                                         |
| Stardust icon | `icon-stardust-20`, nearest neighbour                                                                   |
| Mark gap      | `SPACING.markGap`                                                                                       |
| Count         | Gameplay's count string in `TYPE.label`, on its 20 line                                                 |
| Width         | 189 plus the count width: 215.70 at "125", 237.94 at "12,500"; grows rightward, never shrinks text      |

The fill area maps the current capacity (Gameplay: 100 plus 20% per level) to
92, so a full bar has one length at every level. Fill width is
`92 * shield / capacity`. Two marks extend it to the right: the delay part,
from the fill end to the delay mark (the shield value just before the first
hit since the delay part was last clear), and the flash, over one hit's lost
part. The bar draws in CSS at logical units, like the HUD buttons,
with fractional widths.

| State  | Trigger                                   | Draw                                                                                                                                                               | Timing                                                                                                                                                                                                                                     | Reduced motion                                                |
| ------ | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------- |
| Normal | 25% of capacity or more, not regenerating | Fill, rim and icon in their normal colours                                                                                                                         | Static                                                                                                                                                                                                                                     | Same                                                          |
| Hit    | The shield drops                          | The lost part (new value to old) in the flash colour                                                                                                               | One flash, 100 ms, then the part joins the delay part. A flash starts at most once per 334 ms; a hit inside that window does not flash                                                                                                     | No flash; the part joins at once                              |
| Delay  | From a hit until regeneration starts      | The delay part in the delay colour                                                                                                                                 | Gameplay's recharge delay, 3 s after the last hit                                                                                                                                                                                          | Same                                                          |
| Regen  | The delay ends, until the shield is full  | The delay part clears at once; the fill grows (Gameplay: 18 per s) with a 2 px leading edge inside the fill's right end                                            | The edge shows while regenerating and is removed at capacity                                                                                                                                                                               | Same                                                          |
| Low    | Above 0 and below 25% of capacity         | Fill in the low colour; icon and rim pulse; a delay part keeps the delay colour                                                                                    | Pulse: low colour to the pulse peak and back, sine, 1000 ms per cycle, while low; ends at once at 25%                                                                                                                                      | Icon and rim hold the low colour                              |
| Empty  | The shield reaches 0                      | Empty track; icon and rim in the low colour, no pulse                                                                                                              | Held until the depletion outcome: Astra's jump home, or (upgrade selected) the refill, which draws full at once with no flash or edge                                                                                                      | Same                                                          |
| Pickup | The Stardust count increases              | The count shows the new total at once and bumps; a `+N` label in `TYPE.label` with a 1 px ink outline shows on the pill's row, `SPACING.markGap` right of the pill | Bump: scale 1 to 1.12 to 1, 200 ms ease-out, origin left centre, at most once per 200 ms. Label: holds 300 ms, then rises 4 and fades out over 300 ms ease-out; removed at 600 ms. A pickup while it shows adds to N and restarts the hold | No bump or rise; the label holds 450 ms and fades over 150 ms |

- The `+N` label's left edge, its outline included, is `SPACING.markGap` (6)
  right of the pill's right edge, and its 20 line box centres on the pill's
  row (HUD rect top + 6.5 to + 26.5, so 18.5 to 38.5); it follows the pill as
  the count grows. The bump is a transform: it never reflows the pill.
- The pill shows during flight. It hides with the pause button while a modal
  card or storybook page shows. On desktop, where the pause button is hidden,
  the pill is the leftmost art and moves to the HUD rect's left edge, so the
  left side keeps `HUD_EDGE` in both input modes.
- The pill takes no input. The shield bar is a meter (Gameplay's shield label,
  value and capacity) and the count a status; both icons are decorative.

### Weapon count pill

Constants: `HUD_AMMO_COUNT`, `playView.ts`, to implement; it replaces the
placeholder count label (idle lavender, 38 to 58 below the target top).
Colours, states and contrast are in [Controls](controls.md#ammunition-count).
Each owned non-Basic weapon's `HUD_BUTTON` carries one pill showing Gameplay's
ammunition count string; Basic shows none.

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

### Loading bar

A thin status line for loading, shared by every game through game-kit (the
progress state and its DOM progress bar). Constants: `LOADING_BAR`,
`loadingBar.ts`, to implement.

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
- Kit support: the DOM progress bar takes an RGB track colour, draws its
  frame border on every side and hides a complete bar at once after its hold.
  The 0.6 track alpha, the bottom-only rule and the 150 ms fade need either kit
  options or Ada CSS on the bar's track, its bottom edge and its
  `data-state="complete"`.

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
| Paused        | Header, close. Action stack: Resume (primary), Map, Settings, Back to title                                                                                                                                                                    | None         |
| Paused (room) | Header, close. Action stack: Settings, Back to title                                                                                                                                                                                           | None         |
| Station card  | Header, close. Balance. Welcome (supporting prose, centred). Action row: Undock, Shop                                                                                                                                                          | None         |
| Shop          | Header, close. Balance. Tabs (action row). Item list (control grid)                                                                                                                                                                            | Item list    |
| Buy confirm   | Header, close. Item well. Description (weapons). Price. Remaining (supporting). Action row: Cancel, Buy                                                                                                                                        | None         |

The Paused card shows no objective or job lines. At 720x360 with phone insets
the flight card is `58 + 216 + 16` = 290 high (four buttons, `4 * 48 + 3 *
8`), y 33.5 to 323.5, and the room card `58 + 104 + 16` = 178, y 89.5 to
267.5, both 360 wide, inside the 325 available. Ada's room page opens the room card from its pause button
([Storybook page](#storybook-page)).

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
[nav disc states](achievements-icon.md#states). Nothing moves with the saved
state except the action row's contents.

Every part except the field and the nav discs is placed in play-view px, from
`playView(view)`'s top-left (`x0`, 0), so it stays centred on the game area at
every aspect.

| Token             | Value                                               | Rule                                                                                                                | Constant                                                |
| ----------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| Field             | `title-field`, 960x540, top-left (-120, 0)          | Under everything; the space background fills beyond it                                                              | `titleScreen.field.at`, `title-screen.json`             |
| Ship              | 280 square frame centred on (378, 84)               | The selected paint's `ship-26` with speed jets at `titleScreen.ship.jetSpeed` (0.8)                                 | `START_SCREEN.ship`, `startScreen.ts`, to implement     |
| Wordmark          | `title-wordmark`, 270x102, top-left (225, 148)      | Centred on the play view (`360 - 270 / 2`); Chibi's logo top is 60 under its nav bar                                | `START_SCREEN.wordmark`, `startScreen.ts`, to implement |
| Action row        | Top 264, buttons 192 wide, `TEXT_BUTTON.height`     | 14 below the wordmark (Chibi's 15 from logo to actions); Chibi's row is at 268                                      | `START_SCREEN.actions`, `startScreen.ts`, to implement  |
| Start             | x 264 (`360 - 192 / 2`)                             | Primary, `ui-button-primary`; first run only                                                                        | `START_SCREEN.actions`                                  |
| Restart, Continue | x 160 and 368 (`360 - 192 - 8`, `360 + 8`)          | With saved progress: Restart secondary (`ui-button`) on the left, Continue primary on the right, `BUTTON_GAP` apart | `START_SCREEN.actions`                                  |
| Note              | One `TYPE.body` line box, top 320, centred on x 360 | Cream `#ead4aa`, no panel or shadow; `SPACING.gap` below the action row                                             | `START_SCREEN.note`, `startScreen.ts`, to implement     |

- Labels and actions are Gameplay's: Start, Continue, Restart and the
  `deferred` note; the wordmark's accessible name is the `home` string.
- Continue (or Start) is the default Enter and Space action and the first Tab
  stop, then Restart, Achievements and Settings, as in Chibi. Each button's
  face box is its press area (at least 48 per axis); the 16 gap separates
  Restart and Continue.
- Draw order: field, jets, ship frame, wordmark, actions, note, nav discs.
- Taller views (1280x720 is 720x405) keep every part at its play-view place
  from the top and show more field below; the field covers to 540.

Rects in logical px. Insets are left and right 43, bottom 19, top 0; at 844x390
the logical view is 779.08x360 and `x0` is 29.

| Part           | 720x360                     | 720x360, insets             | 844x390                       | 844x390, insets               |
| -------------- | --------------------------- | --------------------------- | ----------------------------- | ----------------------------- |
| HUD rect       | 12 to 708, top 12           | 43 to 677, top 12           | 41 to 738.08, top 12          | 43 to 736.08, top 12          |
| Available rect | 16 to 704, 16 to 344        | 43 to 677, 16 to 341        | 16 to 763.08, 16 to 344       | 43 to 736.08, 16 to 341       |
| Field          | -120 to 840, 0 to 540       | -120 to 840, 0 to 540       | -91 to 869, 0 to 540          | -91 to 869, 0 to 540          |
| Ship frame     | 238 to 518, -56 to 224      | 238 to 518, -56 to 224      | 267 to 547, -56 to 224        | 267 to 547, -56 to 224        |
| Ship ink       | 226.3 to 484, 48 to 141     | 226.3 to 484, 48 to 141     | 255.3 to 513, 48 to 141       | 255.3 to 513, 48 to 141       |
| Wordmark       | 225 to 495, 148 to 250      | 225 to 495, 148 to 250      | 254 to 524, 148 to 250        | 254 to 524, 148 to 250        |
| Start          | 264 to 456, 264 to 312      | 264 to 456, 264 to 312      | 293 to 485, 264 to 312        | 293 to 485, 264 to 312        |
| Restart        | 160 to 352, 264 to 312      | 160 to 352, 264 to 312      | 189 to 381, 264 to 312        | 189 to 381, 264 to 312        |
| Continue       | 368 to 560, 264 to 312      | 368 to 560, 264 to 312      | 397 to 589, 264 to 312        | 397 to 589, 264 to 312        |
| Note line box  | Centre 360, 320 to 340      | Centre 360, 320 to 340      | Centre 389, 320 to 340        | Centre 389, 320 to 340        |
| Achievements   | 610.5 to 658.5, 4.5 to 52.5 | 579.5 to 627.5, 4.5 to 52.5 | 640.58 to 688.58, 4.5 to 52.5 | 638.58 to 686.58, 4.5 to 52.5 |
| Settings       | 667.5 to 715.5, 4.5 to 52.5 | 636.5 to 684.5, 4.5 to 52.5 | 697.58 to 745.58, 4.5 to 52.5 | 695.58 to 743.58, 4.5 to 52.5 |

Clearances, smallest at 720x360 with insets:

| Pair                              | Arithmetic    | Result                                   |
| --------------------------------- | ------------- | ---------------------------------------- |
| Ship ink to Achievements          | `579.5 - 484` | 95.5, beside the HUD row, never under it |
| Wordmark to Achievements          | `579.5 - 495` | 84.5 (114.58 at 844x390 with insets)     |
| Ship ink to wordmark              | `148 - 141`   | 7                                        |
| Wordmark to the action row        | `264 - 250`   | 14                                       |
| Action row to the note            | `320 - 312`   | 8, `SPACING.gap`                         |
| Note to the available rect bottom | `341 - 340`   | 1 (4 without a bottom inset)             |
| Restart to the available rect     | `160 - 43`    | 117                                      |

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
| Choice content | The choices, `SMALL_BUTTON_GAP` 24, then the page-control row; a page without choices holds the page-control row alone                                                                                                                                                                                                                                                                | A named action on its own row adds 36 + 24                                                                                                                                                                                                                                                                     |
| Story text     | `TYPE.story` 18 regular on 26, cream `#ead4aa` on the card `#3b3850` (7.76:1), left-aligned, top of the column                                                                                                                                                                                                                                                                        | Liberation Sans averages 8.02 per character at 18; never shrinks                                                                                                                                                                                                                                               |
| Heading        | The chapter's panel title (Gameplay's copy) on opening, resolution and closing pages: `TYPE.heading` 24 bold on 28, white `#ffffff` on the card (11.25:1), left-aligned, the column's first line                                                                                                                                                                                      | `SPACING.gap` above the paragraph, so it adds 36 to the text column; the widest title ("The Glowing Rock.", 216) fits every measure on one line                                                                                                                                                                |
| Name tab       | `CONVERSATION_BOX.tab`: 20 high, label width + `2 * SPACING.markGap`, 1 ink edge, radius 2, `TYPE.label` in ink                                                                                                                                                                                                                                                                       | The speaker's tab colour ([Controls](controls.md#conversation-box)); the column's first line, `SPACING.gap` above the paragraph                                                                                                                                                                                |
| Portrait       | `STORY_PANEL.portrait`: the 32 storybook frame at 2x (64), nearest neighbour, in a 68 frame (2 ink edge, navy `#262b44` face)                                                                                                                                                                                                                                                         | Floated on the column top: at the inner right for every speaker but Ada, at the inner left for Ada; never mirrored                                                                                                                                                                                             |
| Portrait gap   | `SPACING.gap` to the text, `SPACING.rowGap` below                                                                                                                                                                                                                                                                                                                                     | The name tab and the paragraph wrap beside the frame, then take the full measure below it                                                                                                                                                                                                                      |
| Choices        | `STORY_BUTTON` secondary, filling the choice column, stacked from its top, faces `SMALL_BUTTON_GAP` 24 apart (a 60 pitch)                                                                                                                                                                                                                                                             | `hitAround` grows a 36 face 9 per side (54), so neighbouring press areas stay 6 apart, each at least `HIT_RULE.minTarget` 48                                                                                                                                                                                   |
| Page controls  | One row on the choice column's bottom: Previous (secondary) at the left, Next (primary) at the right, each `(choice column - 24) / 2` wide, `SMALL_BUTTON_GAP` 24 apart                                                                                                                                                                                                               | 102 to 119 wide; Next, Continue and Previous fit on one line                                                                                                                                                                                                                                                   |
| Named action   | A page's named action ("Pick up the rock.") in Next's place; when its label + 32 exceeds the half width it fills the choice column on its own row, `SMALL_BUTTON_GAP` 24 above the Previous row                                                                                                                                                                                       | "Touch the glow.", "Pick up the rock." and "Let's find your holodisk." take the full row                                                                                                                                                                                                                       |
| Scroll         | The text column scrolls when the panel reaches its top cap; the choices scroll only past the choice limits below. Each scrolling region reserves `SCROLL` 14 on its right (6 gap, 8 track, thumb inset 1)                                                                                                                                                                             | Text never shrinks and never paginates; the page-control row stays fixed                                                                                                                                                                                                                                       |
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

| Page                                                       | 720x360, insets | 844x390, insets | 844x390  | 1280x720 |
| ---------------------------------------------------------- | --------------- | --------------- | -------- | -------- |
| One line, Next only                                        | 68, top 273     | 68, top 273     | 68, 276  | 68, 321  |
| Three-line narration (78 text over a 36 control row)       | 110, top 231    | 110, top 231    | 110, 234 | 110, 279 |
| Two choices: the garden opening with its heading (205)     | 228, top 113    | 228, top 113    | 208, 136 | 228, 161 |
| Gameplay's limit case: 218 characters, heading and choices | 228, top 113    | 228, top 113    | 208, 136 | 228, 161 |
| Astra's three questions with Continue (the tallest)        | 248, top 93     | 248, top 93     | 248, 96  | 248, 141 |

Story buttons follow the button gap rule (to implement): buttons smaller than
the 48 standard keep `SMALL_BUTTON_GAP` 24 between faces in any direction,
standard buttons `BUTTON_GAP` 16 side by side and `STACK_BUTTON_GAP` 8 stacked.
The 36 story buttons are small, so the choices, a full-row named action and the
page-control row stack 24 apart, and Previous and Next sit 24 apart. The garden
opening's choice column is 56 + 24 + 56 + 24 + 36 = 196 (both labels wrap; 176
at 844x390 without insets, where the first fits one line) beside its text
column: the 36 heading and six lines in the 349 column (192), or five in the
wider ones (166). Gameplay's copy builds 56 story pages: 53 from the
prologue, room, boarding and chapter scenes, and the overnight recharge's 3
(night, the textless sleep scene and morning, from rules text). The longest is
chapter one's opening at 205 characters; 218 characters, six lines in the 349
column and five in the wider ones, is Gameplay's limit case. Astra's three
questions with Continue need 3 * 36 + 2 * 24 + 24 + 36 = 216, so 248 with the
padding, the tallest page, under the 280.5 cap at 360-high views: every page
fits without scrolling.

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
own region reserving `SCROLL` 14, with the page-control row (and a named
action's row) fixed below.

Page structure:

1. Text column: the heading (opening, resolution and closing pages only), the
   name tab and the portrait (dialogue only), then the paragraph. Narration
   shows no tab and no portrait; the paragraph fills the measure. Other pages
   show no heading.
2. Choice column: the choices (choice page only, two or three), then 24, then
   the page controls. A choice page has no Next; Previous keeps its left half.
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
  incoming page's; the overnight sleep scene uses the night page's placement,
  and its cross-fade to the morning draws each image at its own page's
  placement. A backdrop without a panel (galaxy selection) keeps the centred
  placement.
- Speaker portraits follow [Conversation portraits](conversation.md): Astra
  plays her speaking loop while her page shows; Ada and Penny show the mood
  Gameplay marks. The tab and portrait carry the speaker.
- Focus order: the text column (focusable only while it scrolls; arrow keys
  scroll it), the choices top to bottom, a full-row named action, Previous,
  then Next or Continue in the row, then the HUD row (the room's pause button,
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
clears the status pill (bottom + 30.5) by 11, the `+N` line (bottom + 26.5) by
15, the weapon discs (bottom + 33) by 8.5 and the weapon targets (bottom +
40.5) by 1; it shares rows only with the count pills (+ 32.5 to + 46.5) and
the pause press area (to + 42.75). Across, the box is centred and 480 wide;
Ada's tab ("Ada", 42.23) starts 64 in and every other tab 8 in, the widest
"General Gadget" (131.15). With six weapons the leftmost target is Basic's
(target 5, no count pill) and the leftmost count pill is target 4's.

| View                  | Box              | Ada's tab        | Widest other tab | Pause press right | Target 5 left | Target 4 (pill centre) | Nearest across                     |
| --------------------- | ---------------- | ---------------- | ---------------- | ----------------- | ------------- | ---------------------- | ---------------------------------- |
| 720x360, 1280x720     | 120 to 600       | 184 to 226.23    | 128 to 259.15    | 54.75             | 382.5         | 439.5 (463.5)          | 73.25 to pause, 123.35 to target 5 |
| 720x360, phone insets | 120 to 600       | 184 to 226.23    | 128 to 259.15    | 85.75             | 351.5         | 408.5 (432.5)          | 42.25 to pause, 92.35 to target 5  |
| 844x390               | 149.54 to 629.54 | 213.54 to 255.77 | 157.54 to 288.69 | 83.75             | 412.58        | 469.58 (493.58)        | 73.79 to pause, 123.89 to target 5 |
| 844x390, insets 43    | 149.54 to 629.54 | 213.54 to 255.77 | 157.54 to 288.69 | 85.75             | 410.58        | 467.58 (491.58)        | 71.79 to pause, 121.89 to target 5 |

- No overlaps: every tab ends at least 92.35 left of any weapon column and
  starts at least 42.25 right of the pause press area, the two it shares rows
  with; the status pill and the `+N` line end above the tab.
- Ada's tab starts 8 right of her portrait frame (`4 + 52`); the 10 of every
  tab inside the panel stay above the text block's first line box.
- The `+N` label clears the box (top + 51.5) by 25 and the weapon press areas
  by at least `SPACING.pageInset` through the pill's maximum width above.

### Galaxy selector

A modal card over the cockpit, one galaxy per page, after Chibi's stage cards.
Constants: `GALAXY_CARD`, `galaxySelectCard.ts`.

1. Header: `Galaxy {number}`.
2. Galaxy group, rows `SPACING.rowGap` apart: the 180x90 screenshot (a half-scale
   360x180 crop, [selector preview](galaxies.md#selector-preview)), the name (`TYPE.label`), the
   flavour line (`TYPE.body` prose).
3. Action row (`GALAXY_CARD.actions`): Previous (secondary), Earth
   (secondary), Jump (primary), Next (secondary), one shared width (99.6, set
   by Previous), `BUTTON_GAP` apart. Earth returns Ada to her room without a jump. Previous uses the disabled face on
   the first page, Next on the last.
4. Exits: the close X, an outside tap, back and Escape leave the cockpit and
   return Ada to her room without a jump.

Locked: the number shows, the screenshot is greyscale, the name and flavour
are "..." in disabled text, and Jump is unavailable (disabled face, refusal
cue). The card keeps the largest width and height of all pages. At 720x360 the
card is `4 * 99.6 + 3 * 16 + 32` = 478.4 wide and `58 + 160 + 8 + 48 + 16` = 290 high, inside the 325
available with phone insets: the galaxy group is the 92 framed screenshot, 4,
the 20 name, 4 and the flavour's two 20 lines.

## Changes from current values

| Change                                                                                                                                                                                        | Was                                                                                                                           |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| ------------------------------------------------------------------------------------------------------------------------------                                                                | -----------------------------------------------------------------------------------                                           |
| UI is logical px scaled by `s`: about 8% larger on an 844x390 phone, 1.78x at 1280x720, 2.67x at 1920x1080                                                                                    | CSS px at 1x, independent of the canvas                                                                                       |
| Safe insets clamp HUD controls, cards and page content                                                                                                                                        | Insets not read                                                                                                               |
| Sticks and Use anchor to the game area: 40 from its sides (the larger side inset replaces it on both sides) and 30 above its bottom (a bottom inset adds)                                     | 24 from its sides, each side's own inset replacing it, and 20 above its bottom                                                |
| Every action stack fills the inner width with `STACK_BUTTON_GAP`                                                                                                                              | Generic stacks 4 apart                                                                                                        |
| Status pill beside pause: the shield bar (96x12) and the Stardust count in one `PILL`                                                                                                         | Shield bar 3 high across the bottom; Stardust count a 14 px plate under the weapons                                           |
| Conversation, notice and status pill panels and the shield track are ink at 0.65 in every galaxy                                                                                              | Panels at 0.70; opaque ink track                                                                                              |
| HUD top controls anchor to `hudRect`: drawn art `HUD_EDGE` 12 in from the game area's top and sides, mirrored with the larger side inset; the pill takes the left edge while pause is hidden  | Press targets `CONTROL_EDGE` 8 in, each side clamped by its own inset; the pill kept its place beside the hidden pause button |
| Weapon buttons: 48 targets 9 apart (discs 24), 33 disc, 20 glyph, ink selection annulus; target is the press area                                                                             | 48 squares, 24 glyph, cream ring                                                                                              |
| Ammunition counts: an ink count pill under each non-Basic weapon disc                                                                                                                         | No counts; ammunition was unlimited                                                                                           |
| Pause draws `pause.svg` with smooth sampling                                                                                                                                                  | `ui-pause` PNG, nearest neighbour                                                                                             |
| Settings draws `settings.svg` as a mask with smooth sampling                                                                                                                                  | `icon-settings-nav` PNG mask                                                                                                  |
| Start screen Achievements: a `HUD_BUTTON` with `achievements.svg`, one pitch left of Settings; the action row keeps only Start, or Restart and Continue                                       | A secondary button at the end of the start card's action stack                                                                |
| Start screen: ship, wordmark and an action row of 192-wide buttons over the title field, Start and Continue primary (`START_SCREEN`)                                                          | A page card with a heading, the Ada and Penny portraits and a secondary action stack                                          |
| Start screen nav discs show a pressed state: white glyph on a `#3a4466` face                                                                                                                  | Idle in every state                                                                                                           |
| Cards scroll one scroll group with the header and close fixed                                                                                                                                 | The whole card scrolls                                                                                                        |
| Prose never widens a card; cheats headings and notes use group and row gaps                                                                                                                   | 36em prose cap; 16 and 4 margins                                                                                              |
| Notices show in the conversation box's slot (`CONVERSATION_BOX`)                                                                                                                              | A `NOTICE` strip on the HUD rect's top                                                                                        |
| Conversation box 480x60: 48 portrait slot in a 52 frame, overhanging name tab, up to two wrapped lines                                                                                        | 640x64, 48 frame, name tab inside over one line                                                                               |
| Story pages use `STORY_PANEL`                                                                                                                                                                 | `.story-panel` clamp and rem sizes                                                                                            |
| Story panel: content-fitted per page, a `TYPE.story` text column beside a column of 36 `STORY_BUTTON` choices and page controls, over a background anchored per story run by its subject band | A bottom panel up to 640 wide over a centred background, `TYPE.body` prose, 48 stacked choices                                |
| Story page HUD row on the 12 edge rect (the HUD symmetry rule)                                                                                                                                | Skip and Settings on the `CONTROL_EDGE` 8 HUD rect                                                                            |
| Shop row: name to trailing slot is `SPACING.gap`; the paint heading sits on a 20 line                                                                                                         | 16; a 24 line                                                                                                                 |
| Pause offers Map: a full-screen map (`MAP_SCREEN`, [Map](map.md)) with symbol chips, fog and a place panel                                                                                    | A 288x160 chart in a Map card (`MAP_CARD`)                                                                                    |

## Exceptions

| Exception         | Reason                                                 | Retained rules                                                     |
| ----------------- | ------------------------------------------------------ | ------------------------------------------------------------------ |
| Card press areas  | DOM hit-tests element boxes                            | Each control box is at least 48 per axis; close uses `hitAround`   |
| Touch sticks      | Continuous input with floating origins                 | `TOUCH_STICK` anchors, the safe clamp, 85% opacity                 |
| Landing page      | Responsive HTML outside the game canvas                | Same token numbers in CSS px, CSS safe insets                      |
| Procedural chrome | Stick rings, knobs and the speed line draw in frame px | Frames and opacity from [touch joystick sheets](touch-joystick.md) |

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
  `src/ui/touch-chrome.ts` (procedural chrome). Each entry names its reason.
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
  disc share one drawn top; the stick rings mirror across the view at one
  height.
- `STATUS_PILL`'s left edge equals the pause press area's right plus
  `SPACING.gap` while the pause button shows and the HUD rect's left while it
  is hidden; its centre is the HUD row's centre line; with four weapons at
  720x360 and phone insets, the pill at a 109.37-wide count, with a `+9,999`
  label 6 beyond it, keeps
  `SPACING.pageInset` from the leftmost weapon target.
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
- The galaxy card keeps one size across pages. The story panel matches the
  storybook rect and height tables at each screen, keeps its width and bottom
  edge across pages, and fits every Gameplay page without scrolling; each
  story run's background placement matches the run anchor for its tallest
  page on that background; a test page longer than the
  column scrolls only the text column, with the choices and page controls in
  place.
- Every story choice and page control is 36 drawn on one line (56 on two),
  `SMALL_BUTTON_GAP` 24 from its neighbours in every direction, with
  a press area of at least 48 per axis; the story text is 18 on 26.
