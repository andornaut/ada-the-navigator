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

- Measure all UI in logical px. The Phaser canvas already draws the logical
  view (`Scale.EXPAND`, `pixelArt`). The DOM overlay root carries the same
  factor `s` as the CSS variable `--ada-unit` (one logical px in CSS px),
  updated on resize and orientation change; every size is
  `calc(var(--ada-unit) * N)` through the layout helpers. The root is not
  transform-scaled, so text stays crisp and hit testing stays native. Layout
  code reads and writes logical px only.
  CSS px reach device px through `devicePixelRatio`; the canvas backing store
  stays at the logical size with nearest-neighbour upscaling.
- `Scale.EXPAND` makes the logical width vary with aspect (720 at 2:1 or
  narrower, 779 on an 844x390 phone). Anchor every element from the safe
  rect's edges, except the HUD's top controls, which anchor to the centred base
  view through `hudRect` ([HUD and overlays](#hud-and-overlays)).
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

| Token            | Value | Rule                                                              | Constant                                                                      |
| ---------------- | ----- | ----------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Row gap          | 4     | Between rows of one list: control rows, item rows, text rows      | `SPACING.rowGap`, `tokens.ts`, to implement; now `CARD.rowGap`                |
| Group gap        | 8     | Between card groups, buttons in an action row or stack, row parts | `SPACING.gap`, `tokens.ts`, to implement; now `CARD.gap`                      |
| Column gap       | 8     | Between columns of controls (shop item columns)                   | `SPACING.columnGap`, `tokens.ts`, to implement                                |
| Mark gap         | 6     | From an inline icon to its label inside one control or pill       | `SPACING.markGap`, `tokens.ts`, to implement                                  |
| Control edge     | 8     | HUD controls from the view edge, and HUD buttons apart            | `CONTROL_EDGE`, `playView.ts` (Chibi `CONTROL_EDGE`)                          |
| Page inset       | 16    | Modals and page content from the view edge                        | `SPACING.pageInset`, `tokens.ts`, to implement; now `.ada-modal` padding      |
| Panel padding    | 16    | Inside cards and the story panel, including the 2 px frame        | `SPACING.panelPadding` = game-kit `MODAL_CONTENT.padding`; now `CARD.padding` |
| Body line box    | 20    | 16 px text (body, labels, supporting)                             | `TYPE.body.lineHeight`, `tokens.ts`, to implement                             |
| Heading line box | 28    | 24 px bold titles                                                 | `TYPE.heading.lineHeight`, `tokens.ts`, to implement                          |

Type roles: `TYPE.heading` 24 bold on 28; `TYPE.body` 16 regular on 20;
`TYPE.label` 16 bold on 20. Text never shrinks: wrap, grow the region, reflow
or scroll. Colours per role are in [Controls](controls.md#colour-tokens).

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
- Rows of one list stack `SPACING.rowGap` apart.
- Prose groups (wrapping body or supporting text) never widen a card: they
  wrap to the inner width that the other groups and the 50% floor set.
  Single-line labels inside rows and buttons count at their full width.
- Action row: buttons share one width, the widest label plus
  `2 * TEXT_BUTTON.inset`, `SPACING.gap` apart; the group centres.
  Paired actions put the secondary left and the primary right.
- Action stack: buttons fill the inner width, `SPACING.gap` apart.
- Control grid: equal-width tiles in up to two columns `SPACING.columnGap`
  apart and rows `SPACING.rowGap` apart; one column when two plus the panel
  padding exceed the available width.
- Paged and tabbed cards measure every page or tab and keep the largest width
  and height, so paging never resizes the card.

## Controls and targets

| Token                | Value                                                                   | Rule                                                                  | Constant                                                              |
| -------------------- | ----------------------------------------------------------------------- | --------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Action height        | 48                                                                      | 44 face over a 4 lip                                                  | `TEXT_BUTTON.height`, `controls.ts`, to implement                     |
| Lip, pressed sink    | 4, 2                                                                    | Face geometry per state, in [Controls](controls.md)                   | `TEXT_BUTTON.lipHeight`, `TEXT_BUTTON.pressedSink`                    |
| Action inset         | 16 horizontal, 12 vertical                                              | Content inset per side; a wrapped label grows the face by 20 per line | `TEXT_BUTTON.inset`, `TEXT_BUTTON.verticalInset`; now `BUTTON_INSET`  |
| Compact height       | 28                                                                      | Row actions and pills: the native 16x28 nine-slice frame              | `TEXT_BUTTON.compactHeight`, `controls.ts`, to implement              |
| Compact width        | 72, or the label plus 8 px insets when that is wider                    | Install row action (Chibi's 72x28 face)                               | `cardActionsSize`, `contentCard.ts`; now fixed `ROW.action.button` 72 |
| Control row          | 48 high, 16 icon, 8, label, 8, action                                   | Whole row is one control; action at the row's right end               | `CONTROL_ROW`, `controls.ts`, to implement; now `ROW`                 |
| Row growth           | `max(48, text + 2 * SPACING.rowGap)`                                    | A row with a wrapped note grows by 20 per line                        | `CONTROL_ROW`, `controls.ts`, to implement                            |
| Switch               | 32x16                                                                   | `ui-switch` frame                                                     | `CONTROL_ROW.switch`; now `ROW.action.switch`                         |
| Row icon             | 16x16                                                                   | Settings and install-step icons                                       | `CONTROL_ROW.icon`; now `ROW.icon`                                    |
| Minimum press target | 48x48                                                                   | Every discrete control                                                | `HIT_RULE.minTarget`, `hitAreas.ts`, to implement                     |
| Press-area growth    | `clamp(6, 16, 0.25 * shorter side)` per side, then grown to 48 per axis | Pause, Use and the close X; nearest drawn centre wins an overlap      | `hitAround`, `pressedArea`, `HIT_RULE`, `hitAreas.ts`, to implement   |
| Focus ring outset    | 4                                                                       | `ui-focus` outside the drawn face, every state                        | `FOCUS_RING.outset`, `controls.ts`, to implement                      |
| Selection ring       | 2 band, 2 outside the face                                              | Shares the focus outset; focus may overlap it                         | `FOCUS_RING`, `controls.ts`, to implement                             |
| Pill                 | 28 high, radius 4, 8 side padding                                       | Price pills and the HUD status pill                                   | `PILL`, `controls.ts`, to implement                                   |

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
Settings) anchor to the HUD rect, as Chibi anchors its pause button
and skill row (`chibis-way-home` `src/ui/layout/playView.ts` `playView`,
`topShift` and `CONTROL_EDGE`; `src/ui/layout/skillHud.ts`). The rect moves
with the centred base view, so on screens wider than 2:1 the controls sit
inside it, clear of curved screen corners; the safe-rect clamp still keeps them
out of every inset. Other HUD elements anchor to
`safeRect(insets, CONTROL_EDGE, view)` corners, as stated.

| Token      | Value                                                                                             | Rule                                                                         | Constant                                                                |
| ---------- | ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Play view  | 720x360 at `x = floor((floor(view.width) - 720) / 2)`, `y = 0`                                    | The base view centred across the logical view, at its top                    | `playView(view)`, `playView.ts`, to implement (Chibi `playView`)        |
| HUD rect   | `playView(view)` inset by `CONTROL_EDGE`, intersected with `safeRect(insets, CONTROL_EDGE, view)` | Corners of the top controls; only its top, left and right edges anchor       | `hudRect(insets, view)`, `playView.ts`, to implement (Chibi `topShift`) |
| HUD button | Target 48, disc 33, selected annulus 4, glyph 20, gap 8                                           | Chibi's `SKILL_BUTTON`; the disc equals the pause disc; gap = `CONTROL_EDGE` | `HUD_BUTTON` = `{ target, disc, annulus, glyph, gap }`, `playView.ts`   |

| Screen, CSS px | Insets, logical   | Logical view | Play view x | HUD rect left, right, top |
| -------------- | ----------------- | ------------ | ----------- | ------------------------- |
| 844x390        | None              | 779x360      | 29          | 37, 741, 8                |
| 844x390        | Left and right 43 | 779x360      | 29          | 43, 736.08, 8             |
| 1280x720       | None              | 720x405      | 0           | 8, 712, 8                 |
| 1920x1080      | None              | 720x405      | 0           | 8, 712, 8                 |

| Element      | Geometry                                                                                                                                                                                                                                                                                                                                                                                                                                  | Constant                                                             |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Pause        | 35x35 frame, 33 disc, drawn edge on the HUD rect's top-left corner (frame 1 outside it; Chibi's 7,7 in the 720 view); vector art in [Controls](controls.md#pause); press `hitAround(frame)` = 52.5                                                                                                                                                                                                                                        | `PAUSE_BUTTON`, `playView.ts`                                        |
| Weapons      | One row of `HUD_BUTTON` targets packed against the HUD rect's top-right corner, `HUD_BUTTON.gap` apart: target `i` from the right at `x = right - 48 - 56 * i`, `y = top`; disc and glyph centred in it (disc at 7.5, glyph at 14); the target is the press area (48, `HIT_RULE.minTarget`)                                                                                                                                               | `HUD_BUTTON`, `hudButtonTarget(index)`, `playView.ts`                |
| Status pill  | One `PILL` holding the shield bar and the Stardust count: left edge `SPACING.gap` right of the pause press area (`PAUSE_BUTTON.hit` right + `SPACING.gap` = HUD rect left + 50.75), centred on the pause disc (`PAUSE_BUTTON.art` centre = HUD rect top + 16.5, so the pill top is HUD rect top + 2.5); grows rightward with the count; keeps its place while the pause button is hidden. Parts and states in [Status pill](#status-pill) | `STATUS_PILL`, `playView.ts`, to implement                           |
| Sticks       | 75 frames; ring drawn edge `max(24, inset)` from the left (move) or right (aim) and 24 above the bottom safe edge (`inset + 24` from the view bottom); drawn knob reach 12 inside the ring; move input reach 40 and deadzone 2.4 (logical); the move stick draws a speed line from the origin to the thumb, not clamped to the ring; the aim stick draws no line                                                                          | `TOUCH_STICK`, `touchControls.ts`, to implement; now `sticks.ts`     |
| Use          | Context action: a `TEXT_BUTTON.height` face with a 2 ink border and radius 8, label in `TYPE.label`, width from the label plus `TEXT_BUTTON.inset`; centred horizontally on the safe rect, bottom level with the sticks' drawn bottom (24 above the bottom safe edge); press `hitAround(face)`; shown only while an interaction is available                                                                                              | `USE_BUTTON`, `touchControls.ts`, to implement                       |
| Settings     | Start screen only: a `HUD_BUTTON` in the idle state with `settings.svg` (20, vector) as its glyph mask, drawn with smooth sampling, on the HUD rect's top-right corner                                                                                                                                                                                                                                                                    | `HUD_BUTTON`, `playView.ts`                                          |
| Notice       | The conversation box's slot and panel: same rect and ink panel at 0.70, one `TYPE.body` cream line centred in the box, no portrait or name tab; shows at once and holds the slot ahead of a conversation line, which resumes after; a newer notice replaces the current one in place. See [Conversation box](#conversation-box)                                                                                                           | `NOTICE` (shares `CONVERSATION`), `conversationBox.ts`, to implement |
| Conversation | In-flight dialogue box below the weapon row: top `SPACING.gap` below the weapon press areas, centred, `min(availableWidth, 640)` wide, 64 high, one portrait and one line; non-modal, no dim. See [Conversation box](#conversation-box)                                                                                                                                                                                                   | `CONVERSATION`, `conversationBox.ts`, to implement                   |

Overlap rules:

- The top-left cluster is the pause button and the status pill; the top-right
  cluster is the weapons only. The pill's drawn rect and the pause press area
  keep at least `SPACING.pageInset` from the weapon press areas at the smallest
  view (720 logical, with phone insets 43/43/19): with four weapons the pill
  may reach 351.25 wide, a count up to 162.25 wide ("999,999,999" is 89), and
  "1,234,567" leaves 107.07.
- The Stardust `+N` label stays above the conversation box: its 20 line ends
  at HUD rect top + 54.5 (62.5), the box top is HUD rect top + 56 (64).
- Sticks sit below the HUD row at every view; the view is at least 360 high.
- Press areas inside one cluster may overlap; `pressedArea` gives the press to
  the nearest drawn centre.
- While a modal card or storybook page shows, the pause button hides and the
  HUD takes no input under the dim. The conversation box is not modal: the
  pause button, weapons and sticks stay visible and live.
- The conversation box's bottom sits at least 24 above the ship's drawn top at
  the 360-high view.

### Status pill

Constants: `STATUS_PILL`, `playView.ts`, to implement. Colours and contrast
are in [Controls](controls.md#status-pill). Parts, left to right, each centred
on the pill's row:

| Part          | Geometry                                                                                           |
| ------------- | -------------------------------------------------------------------------------------------------- |
| Panel         | `PILL`: 28 high, radius 4, `PILL.padding` 8 at each end; ink at 0.70, as the conversation panel    |
| Shield icon   | `public/art/ui/icons/shield.svg`, 20 (`HUD_BUTTON.glyph`), a mask in the state's icon colour       |
| Mark gap      | `SPACING.markGap`                                                                                  |
| Shield bar    | `STATUS_PILL.bar` 96x12: 1 rim, 1 ink, then the 92x8 fill area (inset 2)                           |
| Divider       | `STATUS_PILL.dividerGap` 12, a 1x16 divider, 12                                                    |
| Stardust icon | `icon-stardust-20`, nearest neighbour                                                              |
| Mark gap      | `SPACING.markGap`                                                                                  |
| Count         | Gameplay's count string in `TYPE.label`, on its 20 line                                            |
| Width         | 189 plus the count width: 215.70 at "125", 237.94 at "12,500"; grows rightward, never shrinks text |

The fill area maps the current capacity (Gameplay: 100 plus 20% per level) to
92, so a full bar has one length at every level. Fill width is
`92 * shield / capacity`. Two marks extend it to the right: the delay part,
from the fill end to the delay mark (the shield value just before the first
hit since the delay part was last clear), and the flash, over one hit's lost
part. The bar draws in CSS at logical units, like the HUD buttons,
with fractional widths.

| State  | Trigger                                   | Draw                                                                                                                        | Timing                                                                                                                                                                                                                                     | Reduced motion                                                |
| ------ | ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------- |
| Normal | 25% of capacity or more, not regenerating | Fill, rim and icon in their normal colours                                                                                  | Static                                                                                                                                                                                                                                     | Same                                                          |
| Hit    | The shield drops                          | The lost part (new value to old) in the flash colour                                                                        | One flash, 100 ms, then the part joins the delay part. A flash starts at most once per 334 ms; a hit inside that window does not flash                                                                                                     | No flash; the part joins at once                              |
| Delay  | From a hit until regeneration starts      | The delay part in the delay colour                                                                                          | Gameplay's recharge delay, 3 s after the last hit                                                                                                                                                                                          | Same                                                          |
| Regen  | The delay ends, until the shield is full  | The delay part clears at once; the fill grows (Gameplay: 18 per s) with a 2 px leading edge inside the fill's right end     | The edge shows while regenerating and is removed at capacity                                                                                                                                                                               | Same                                                          |
| Low    | Above 0 and below 25% of capacity         | Fill in the low colour; icon and rim pulse; a delay part keeps the delay colour                                             | Pulse: low colour to the pulse peak and back, sine, 1000 ms per cycle, while low; ends at once at 25%                                                                                                                                      | Icon and rim hold the low colour                              |
| Empty  | The shield reaches 0                      | Empty track; icon and rim in the low colour, no pulse                                                                       | Held until the depletion outcome: Astra's jump home, or (upgrade selected) the refill, which draws full at once with no flash or edge                                                                                                      | Same                                                          |
| Pickup | The Stardust count increases              | The count shows the new total at once and bumps; a `+N` label in `TYPE.label` with a 1 px ink outline shows under the count | Bump: scale 1 to 1.12 to 1, 200 ms ease-out, origin left centre, at most once per 200 ms. Label: holds 300 ms, then rises 4 and fades out over 300 ms ease-out; removed at 600 ms. A pickup while it shows adds to N and restarts the hold | No bump or rise; the label holds 450 ms and fades over 150 ms |

- The `+N` label centres on the count; its line box top is `SPACING.rowGap`
  below the pill (HUD rect top + 34.5). The bump is a transform: it never
  reflows the pill.
- The pill shows during flight. It hides with the pause button while a modal
  card or storybook page shows; on desktop, where the pause button is hidden,
  it keeps its place, so the HUD never shifts with the input mode.
- The pill takes no input. The shield bar is a meter (Gameplay's shield label,
  value and capacity) and the count a status; both icons are decorative.

## Screens

Each screen lists its anchor and groups in order. Every distance comes from a
token above; strings are Gameplay's.

### Cards

| Screen                  | Groups (top to bottom)                                                                                                                                                                                                                         | Scroll group |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| Settings                | Header, close. Control rows (switch rows, then the Install row with its compact action). Cheats launcher (single action). Build label, supporting                                                                                              | Rows         |
| Install steps           | Header, close. Step rows: row icon, `SPACING.gap`, wrapped body text, rows `SPACING.rowGap` apart, height fits text (not controls)                                                                                                             | Steps        |
| Update offer            | Header, close. Action row: decline (secondary), accept (primary)                                                                                                                                                                               | None         |
| Cheats                  | Header, close. Per scope a section group: heading (`TYPE.label`), persistence (supporting prose), `SPACING.rowGap`, then items `SPACING.gap` apart, each an action stack of one with its description (supporting prose) `SPACING.rowGap` below | Sections     |
| Paused                  | Header, close. Action stack: Resume (primary), Travel, Settings, Return home. Danger note (supporting prose) when shown                                                                                                                        | None         |
| Discovered destinations | Header, close (returns to Paused). Action stack of destinations, or the empty note (supporting prose)                                                                                                                                          | Stack        |
| Station card            | Header, close. Balance. Welcome (supporting prose, centred). Action row: Undock, Shop                                                                                                                                                          | None         |
| Shop                    | Header, close. Balance. Tabs (action row). Item list (control grid)                                                                                                                                                                            | Item list    |
| Buy confirm             | Header, close. Item well. Description (weapons). Price. Remaining (supporting). Action row: Cancel, Buy                                                                                                                                        | None         |

The balance is one centred group: `icon-stardust-20`, `SPACING.markGap`, the
amount in `TYPE.label`, on a 20 line. The shop's row and well geometry is in
[Shop item row](#shop-item-row).

### Shop item row

A `ui-button-tile` at `TEXT_BUTTON.height`, content centred on each state's
face. Constants: `SHOP_ROW`, `shopCard.ts`, to implement.

| Part          | Geometry                                                                                                       |
| ------------- | -------------------------------------------------------------------------------------------------------------- |
| Row inset     | `SPACING.gap` from both row ends                                                                               |
| Item well     | 36x36 at the left inset                                                                                        |
| Glyph offset  | 20 icons at 8, the 24 upgrade composite at 6, the 32 paint swatch at 2, inside the well                        |
| Name block    | `SPACING.gap` right of the well; one 20 line, or two with the level line                                       |
| Trailing slot | Right inset, centred vertically; one width for every row: the widest price pill, Owned or In use               |
| Price pill    | `PILL` with `icon-stardust`, `SPACING.markGap`, the price in `TYPE.label`; every pill one width                |
| Owned, In use | `icon-shop-check` (12x8), `SPACING.markGap`, the label in `TYPE.label`, right-aligned                          |
| Row width     | inset + well + gap + widest name or level line + gap + slot + inset; one width across both tabs                |
| Paint heading | `icon-shop-ship-paint` (20), `SPACING.markGap`, `TYPE.label`, on a 20 line, `SPACING.gap` above the paint rows |
| Confirm well  | 56x56; glyph at 2x by nearest neighbour (40, or 48 for the upgrade composite), swatch 48, centred              |
| Confirm price | `icon-stardust-20`, `SPACING.markGap`, the price in `TYPE.heading`                                             |

### Storybook page

Earth scenes. Constants: `STORY_PANEL`, `storyPage.ts`, to implement.

| Token         | Value                                                    | Rule                                                                                   |
| ------------- | -------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Background    | 960x540 logical canvas at 2x ([storybook](storybook.md)) | Centred, scale `max(1, viewW / 960, viewH / 540)`, nearest neighbour, under the insets |
| Panel width   | `min(availableWidth, STORY_PANEL.maxWidth)`, max 640     | Centred; 640 is the measure for 16 px prose (Chibi's dialogue box)                     |
| Panel anchor  | Bottom edge on the available rect's bottom               | The scene's subject stays visible above                                                |
| Panel padding | `SPACING.panelPadding`                                   | `ui-settings-card` face, no dim behind it                                              |
| Portrait      | 64 in a 68 frame (2 inset)                               | Ada on the left, other speakers on the right; never mirrored                           |
| Portrait gap  | `SPACING.gap`                                            | Frame to text column; frame top on the column top                                      |

Panel groups, `SPACING.gap` apart:

1. Text column: the speaker name (`TYPE.label`, dialogue only), then the
   paragraph (`TYPE.body`) `SPACING.rowGap` below. Narration has no portrait
   and fills the inner width.
2. Choices (choice page only): an action stack of two or three secondary
   buttons; labels wrap and grow the face. Focus starts on the first, the
   default.
3. Page controls: Skip (secondary, always visible) at the inner left edge;
   Previous (secondary) and Next (primary) right-aligned, `SPACING.gap` apart.
   All three share one width. A choice page has no Next. Previous uses the
   disabled face on a scene's first page. A page whose primary action is named
   ("Pick up the rock.") uses that label in Next's slot.

Each page sizes its own panel to its content, up to the available height;
beyond that the text column scrolls and the choices and page controls stay
fixed. Ordinary pages keep a short panel so the background stays visible; only
a choice page grows to fit its choices. The panel's width, bottom edge and
page-control row stay fixed across pages. A space story page that pauses
flight uses the same panel over the paused, dimmed space view, without a
background. In-flight lines use the [conversation box](#conversation-box),
which neither pauses nor dims.

### Conversation box

In-flight dialogue: one line at a time from one speaker, over live flight.
Constants: `CONVERSATION`, `conversationBox.ts`, to implement. Colours are in
[Controls](controls.md#conversation-box); portraits are in
[Conversation portraits](conversation.md).

| Token          | Value                                                        | Rule                                                                                    |
| -------------- | ------------------------------------------------------------ | --------------------------------------------------------------------------------------- |
| Width          | `min(availableWidth, CONVERSATION.maxWidth)`, max 640        | Centred on the available rect; 634 at 720 with phone insets, 640 otherwise              |
| Top            | Weapon press-area bottom plus `SPACING.gap`                  | HUD rect top + 48 target (the target is the press area) = 56, so 64 without a top inset |
| Height         | `CONVERSATION.frame + 2 * SPACING.gap` = 64                  | Fixed; the box never grows                                                              |
| Padding        | `SPACING.gap` on every side                                  | Frame and text column sit 8 inside the panel                                            |
| Panel          | Ink `#181425` at alpha 0.70, square corners                  | No border, nine-slice or dim; the tab, line and portrait draw fully opaque over it      |
| Portrait frame | `CONVERSATION.frame` 48x48: 2 ink edge, navy `#262b44` face  | Ada at the inner left, every other speaker at the inner right; never mirrored           |
| Portrait       | A 22x22 compact frame at 2x (44), nearest neighbour, inset 2 | Fills the face; integer scale at every `s`                                              |
| Text column    | `SPACING.gap` from the frame, the rest of the inner width    | 562 wide at 634, 568 at 640                                                             |
| Text block     | Tab 20, `SPACING.rowGap`, line 20: 44 high                   | Centred on the frame: block top 2 below the frame top                                   |
| Name tab       | 20 high, label width plus `2 * SPACING.markGap`              | `TYPE.label` in ink on the speaker's opaque tab colour, at the column's left edge       |
| Line           | `TYPE.body`, cream, left-aligned, one line                   | Never wraps or shrinks; every Gameplay line fits the 562 column                         |

- The box takes no input and holds no controls. It shows only during flight;
  one box shows at a time, and the next line replaces the current one in
  place.
- Both sides use the same left-aligned text column; only the frame changes
  side with the speaker.
- Clearance at the 360-high view: the box bottom is at 128. The ship's pivot
  sits at the view centre (180) with a 42 display frame; its highest drawn hull
  point across the 16 headings is 167.2 (heading 2), 39.2 below the box. The
  rule is at least 24.
- At the 1280x720 view (720x405 logical) the box bottom is still 128 and the
  hull top 189.7, 61.7 below.

### Galaxy selector

A modal card over the cockpit, one galaxy per page, after Chibi's stage cards.
Constants: `GALAXY_CARD`, `galaxySelectCard.ts`, to implement.

1. Header: `Galaxy {number}`.
2. Galaxy group, rows `SPACING.rowGap` apart: the 180x90 screenshot (a half-scale
   360x180 crop, [selector preview](galaxies.md#selector-preview)), the name (`TYPE.label`), the
   flavour line (`TYPE.body` prose).
3. Action row: Previous (secondary), Jump (primary), Next (secondary), one
   shared width. Previous uses the disabled face on the first page, Next on the
   last.
4. Exits: the close X, an outside tap, back and Escape leave the cockpit and
   return Ada to her room without a jump.

Locked: the number shows, the screenshot is greyscale, the name and flavour
are "..." in disabled text, and Jump is unavailable (disabled face, refusal
cue). The card keeps the largest width and height of all pages. At 720x360 the
card is `58 + 138 + 8 + 48 + 16 = 268` high, inside the 328 available.

## Changes from current values

| Change                                                                                                     | Was                                                                                 |
| ---------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| UI is logical px scaled by `s`: about 8% larger on an 844x390 phone, 1.78x at 1280x720, 2.67x at 1920x1080 | CSS px at 1x, independent of the canvas                                             |
| Safe insets clamp HUD controls, cards and page content                                                     | Insets not read                                                                     |
| Sticks anchor from the safe rect's edges                                                                   | From the centred 720 view                                                           |
| Every action stack fills the inner width with `SPACING.gap`                                                | Generic stacks 4 apart                                                              |
| Status pill beside pause: the shield bar (96x12) and the Stardust count in one `PILL`                      | Shield bar 3 high across the bottom; Stardust count a 14 px plate under the weapons |
| HUD top controls anchor to `hudRect`: the centred base view, clamped by the safe rect                      | The HUD safe rect's corners                                                         |
| Weapon buttons: 48 targets 8 apart, 33 disc, 20 glyph, ink selection annulus; target is the press area     | 48 squares, 24 glyph, cream ring                                                    |
| Pause draws `pause.svg` with smooth sampling                                                               | `ui-pause` PNG, nearest neighbour                                                   |
| Settings draws `settings.svg` as a mask with smooth sampling                                               | `icon-settings-nav` PNG mask                                                        |
| Cards scroll one scroll group with the header and close fixed                                              | The whole card scrolls                                                              |
| Prose never widens a card; cheats headings and notes use group and row gaps                                | 36em prose cap; 16 and 4 margins                                                    |
| Notices use `TYPE.body` and `NOTICE` placement                                                             | 14 px text at fixed offsets                                                         |
| Story pages use `STORY_PANEL`                                                                              | `.story-panel` clamp and rem sizes                                                  |
| Shop row: name to trailing slot is `SPACING.gap`; the paint heading sits on a 20 line                      | 16; a 24 line                                                                       |

## Exceptions

| Exception         | Reason                                                 | Retained rules                                                     |
| ----------------- | ------------------------------------------------------ | ------------------------------------------------------------------ |
| Card press areas  | DOM hit-tests element boxes and card rows sit 4 apart  | Each control box is at least 48 per axis; close uses `hitAround`   |
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
- Every action in a row shares one width and sits `SPACING.gap` apart.
- With phone insets (left and right 43, bottom 19 logical) at 720x360, every
  HUD drawn rect lies in its safe rect and the top clusters' press areas keep
  `SPACING.pageInset` apart.
- `STATUS_PILL`'s left edge equals the pause press area's right plus
  `SPACING.gap` and its centre the pause disc's centre, with and without the
  pause button shown; with four weapons at 720x360 and phone insets, the pill
  at a 162.25-wide count keeps `SPACING.pageInset` from the leftmost weapon
  target.
- `hudRect` matches the HUD rect table at 844x390 (with and without insets),
  1280x720 and 1920x1080; the pause frame and every weapon target lie inside
  `playView` inset by `CONTROL_EDGE`.
- Each card, filled with Gameplay's longest strings at 720x360, fits the
  available rect or scrolls only its scroll group; no text is below 16.
- The galaxy card keeps one size across pages. The story panel keeps its width,
  bottom edge and control row across pages, and each page's height fits that
  page's content.
