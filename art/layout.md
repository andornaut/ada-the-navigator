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
  factor `s` (a CSS variable or a scaled root sized to the logical view; Tech
  chooses the mechanism), so layout code reads and writes logical px only.
  CSS px reach device px through `devicePixelRatio`; the canvas backing store
  stays at the logical size with nearest-neighbour upscaling.
- `Scale.EXPAND` makes the logical width vary with aspect (720 at 2:1 or
  narrower, 779 on an 844x390 phone). Anchor every element from the safe
  rect's edges, never from the base 720 view or a centred sub-view.
- Review at a native scale and at fractional scales (1.083 and 1.778): UI
  nine-slices drawn with `image-rendering: pixelated` may render a 2 px edge
  as 2 or 3 device px.

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
| Control edge     | 8     | HUD controls from the view edge                                   | `CONTROL_EDGE`, `playView.ts`, to implement; now `PAUSE_BUTTON.edge`          |
| Page inset       | 16    | Modals and page content from the view edge                        | `SPACING.pageInset`, `tokens.ts`, to implement; now `.ada-modal` padding      |
| Panel padding    | 16    | Inside cards and the story panel, including the 2 px frame        | `SPACING.panelPadding` = game-kit `MODAL_CONTENT.padding`; now `CARD.padding` |
| Body line box    | 20    | 16 px text (body, labels, supporting)                             | `TYPE.body.lineHeight`, `tokens.ts`, to implement                             |
| Heading line box | 28    | 24 px bold titles                                                 | `TYPE.heading.lineHeight`, `tokens.ts`, to implement                          |

Type roles: `TYPE.heading` 24 bold on 28; `TYPE.body` 16 regular on 20;
`TYPE.label` 16 bold on 20. Text never shrinks: wrap, grow the region, reflow
or scroll. Colours per role are in [Controls](controls.md#colour-tokens).

## Page bounds

- HUD controls sit in `safeRect(insets, CONTROL_EDGE, view)`.
- Modals and page content (story panel, notices) fit in
  `safeRect(insets, SPACING.pageInset, view)`, the available rect.
- Backgrounds and the modal dim cover the whole logical view, under the insets.
- The shield bar is the one element on `safeRect(insets, 0, view)`.

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
| Compact width        | Label plus `2 * TEXT_BUTTON.inset`                                      | Install row action                                                    | `cardActionsSize`, `contentCard.ts`; now fixed `ROW.action.button` 72 |
| Control row          | 48 high, 16 icon, 8, label, 8, action                                   | Whole row is one control; action at the row's right end               | `CONTROL_ROW`, `controls.ts`, to implement; now `ROW`                 |
| Row growth           | `max(48, text + 2 * SPACING.rowGap)`                                    | A row with a wrapped note grows by 20 per line                        | `CONTROL_ROW`, `controls.ts`, to implement                            |
| Switch               | 32x16                                                                   | `ui-switch` frame                                                     | `CONTROL_ROW.switch`; now `ROW.action.switch`                         |
| Row icon             | 16x16                                                                   | Settings and install-step icons                                       | `CONTROL_ROW.icon`; now `ROW.icon`                                    |
| Minimum press target | 48x48                                                                   | Every discrete control                                                | `HIT_RULE.minTarget`, `hitAreas.ts`, to implement                     |
| Press-area growth    | `clamp(6, 16, 0.25 * shorter side)` per side, then grown to 48 per axis | HUD controls; nearest drawn centre wins an overlap                    | `hitAround`, `pressedArea`, `HIT_RULE`, `hitAreas.ts`, to implement   |
| Focus ring outset    | 4                                                                       | `ui-focus` outside the drawn face, every state                        | `FOCUS_RING.outset`, `controls.ts`, to implement                      |
| Selection ring       | 2 band, 2 outside the face                                              | Shares the focus outset; focus may overlap it                         | `FOCUS_RING`, `controls.ts`, to implement                             |
| Pill                 | 28 high, radius 4, 8 side padding                                       | Price pills and the HUD Stardust pill                                 | `PILL`, `controls.ts`, to implement                                   |

Faces, content insets, nine-slice margins and press areas are separate
measurements; place neighbours against the full press area. Centre labels by
the face of each state, never the press area.

## Modals

| Token           | Value                                                                | Rule                                                             | Constant                                                                      |
| --------------- | -------------------------------------------------------------------- | ---------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Card width      | `min(availableWidth, max(contentWidth + 32, viewportWidth * 0.5))`   | Content-fitted, 50% floor, capped by the available rect          | game-kit `modalWidth`, `MODAL_CONTENT`; `contentCardLayout`, `contentCard.ts` |
| Card height     | Content-fitted, capped by the available height                       | No minimum, no reserved space                                    | `contentCardLayout`, `contentCard.ts`, to implement                           |
| Frame border    | 2                                                                    | Counts inside the 16 padding                                     | `CARD_CONTENT.frameBorder`, `cardFrame.ts`; now `CARD.frameBorder`            |
| Close face      | 24x24                                                                | `ui-close`                                                       | `CARD_CONTENT.closeSize`, `cardFrame.ts`; now `CARD.closeSize`                |
| Close inset     | 6 from the top and right edges                                       | Press area `hitAround(face)` = 48x48, may extend 6 past the card | `CARD_CONTENT.closeInset`; now `CARD.closeInset`                              |
| Title clearance | `max(padding, closeHitRight + SPACING.gap)` = `max(16, 42 + 8)` = 50 | Mirrored on both sides of the title                              | `cardTitleReserve(close)`, `cardFrame.ts`; now `card-layout.ts`               |
| Header balance  | Frame inner edge to title equals title to first group                | Measured on line boxes in DOM                                    | `cardHeaderLayout`, `cardFrame.ts`; now `card-layout.ts`                      |
| Scroll reserve  | 6 gap plus an 8 track, thumb inset 1                                 | A scrolling region reserves 14 on its right, inside the padding  | `SCROLL`, `contentCard.ts`, to implement                                      |
| Scroll end pad  | 16                                                                   | Below the last control at the scroll end                         | `SCROLL.endPad` = `SPACING.panelPadding`                                      |
| Drag threshold  | 8                                                                    | A pointer moving further scrolls and does not activate           | `SCROLL.dragThreshold`, to implement                                          |

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

HUD elements anchor to `safeRect(insets, CONTROL_EDGE, view)` corners, except
where stated.

| Element    | Geometry                                                                                                                                                                                                             | Constant                                                         |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Pause      | 35x35 frame, 33 disc, drawn edge on the top-left corner (frame 1 outside it); press `hitAround(frame)` = 52.5                                                                                                        | `PAUSE_BUTTON`, `playView.ts`; now `PAUSE_BUTTON`, `pause.ts`    |
| Weapons    | 48x48 faces, radius 8, 2 ink border, 24 glyph, `SPACING.gap` apart, right-aligned on the top-right corner; press `hitAround(face)` = 72, nearest centre wins                                                         | `HUD_BUTTON`, `playView.ts`, to implement                        |
| Stardust   | A `PILL` with `icon-stardust-20`, `SPACING.markGap`, the count in `TYPE.label`; right edge `SPACING.gap` left of the leftmost weapon, centred on the weapon row; grows leftward                                      | `STARDUST_PILL`, `playView.ts`, to implement                     |
| Shield bar | 3 high, the full view width, bottom on `safeRect(insets, 0, view)`                                                                                                                                                   | `SHIELD_BAR`, `playView.ts`, to implement                        |
| Sticks     | 75 frames; ring drawn edge `max(85, inset)` from the left (move) or right (aim) and `max(20, inset)` above the bottom; knob reach 12                                                                                 | `TOUCH_STICK`, `touchControls.ts`, to implement; now `sticks.ts` |
| Settings   | Start screen only: a `HUD_BUTTON` with `icon-settings-nav-24` on the top-right corner                                                                                                                                | `HUD_BUTTON`, `playView.ts`, to implement                        |
| Notice     | `TYPE.body` on an ink panel, content insets `TEXT_BUTTON.inset` by `TEXT_BUTTON.verticalInset`, width at most `STORY_PANEL.maxWidth`; top-centre, `SPACING.gap` below the HUD row; notices stack `SPACING.gap` apart | `NOTICE`, `playView.ts`, to implement                            |

Overlap rules:

- The top-left cluster (pause) and the top-right cluster (weapons, Stardust)
  keep at least `SPACING.pageInset` between their press areas at the smallest
  view (720 logical, with phone insets).
- Sticks sit below the HUD row at every view; the view is at least 360 high.
- Press areas inside one cluster may overlap; `pressedArea` gives the press to
  the nearest drawn centre.
- While a modal or conversation shows, the pause button hides and the HUD
  takes no input under the dim.

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

| Token         | Value                                                | Rule                                                               |
| ------------- | ---------------------------------------------------- | ------------------------------------------------------------------ |
| Background    | Covers the whole logical view                        | Cover-scaled, centred, nearest neighbour, under the insets         |
| Panel width   | `min(availableWidth, STORY_PANEL.maxWidth)`, max 640 | Centred; 640 is the measure for 16 px prose (Chibi's dialogue box) |
| Panel anchor  | Bottom edge on the available rect's bottom           | The scene's subject stays visible above                            |
| Panel padding | `SPACING.panelPadding`                               | `ui-settings-card` face, no dim behind it                          |
| Portrait      | 64 in a 68 frame (2 inset)                           | Ada on the left, other speakers on the right; never mirrored       |
| Portrait gap  | `SPACING.gap`                                        | Frame to text column; frame top on the column top                  |

Panel groups, `SPACING.gap` apart:

1. Text column: the speaker name (`TYPE.label`, dialogue only), then the
   paragraph (`TYPE.body`) `SPACING.rowGap` below. Narration has no portrait
   and fills the inner width.
2. Choices (choice page only): an action stack of two or three secondary
   buttons; labels wrap and grow the face. Focus starts on the first, the
   default.
3. Page controls: Skip (secondary) at the inner left edge; Back (secondary)
   and Next (primary) right-aligned, `SPACING.gap` apart. All three share one
   width. A choice page has no Next. Back uses the disabled face on a scene's
   first page. A page whose primary action is named (Pick up the rock) uses
   that label in Next's slot.

The panel is paged: it measures every page of the scene and keeps the largest
size, up to the available height; beyond that the text column scrolls and the
choices and page controls stay fixed. Space
conversations use the same panel over the paused, dimmed space view, without
a background.

### Galaxy selector

A modal card over the cockpit, one galaxy per page, after Chibi's stage cards.
Constants: `GALAXY_CARD`, `galaxySelectCard.ts`, to implement.

1. Header: `Galaxy {number}`.
2. Galaxy group, rows `SPACING.rowGap` apart: the 180x90 screenshot (a quarter
   of a 720x360 capture, nearest neighbour), the name (`TYPE.label`), the
   flavour line (`TYPE.body` prose).
3. Action row: Back (secondary), Jump (primary), Next (secondary), one shared
   width. Back uses the disabled face on the first page, Next on the last.

Locked: the number shows, the screenshot is greyscale, the name and flavour
are "..." in disabled text, and Jump is unavailable (disabled face, refusal
cue). The card keeps the largest width and height of all pages. At 720x360 the
card is `58 + 138 + 8 + 48 + 16 = 268` high, inside the 328 available.

## Changes from current values

| Change                                                                                                     | Was                                     |
| ---------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| UI is logical px scaled by `s`: about 8% larger on an 844x390 phone, 1.78x at 1280x720, 2.67x at 1920x1080 | CSS px at 1x, independent of the canvas |
| Safe insets clamp HUD controls, cards and page content                                                     | Insets not read                         |
| Sticks anchor from the safe rect's edges                                                                   | From the centred 720 view               |
| Every action stack fills the inner width with `SPACING.gap`                                                | Generic stacks 4 apart                  |
| Compact Install width is measured                                                                          | Fixed 72                                |
| Stardust pill: 28 high, radius 4, padding 8, mark gap 6, count 16 bold, 8 from the weapons                 | 26, 6, 7, 4, 15, 6                      |
| Weapon buttons use the shared focus ring and `hitAround` press areas (72)                                  | 3 px outline at 4; 48 press area        |
| Cards scroll one scroll group with the header and close fixed                                              | The whole card scrolls                  |
| Prose never widens a card; cheats headings and notes use group and row gaps                                | 36em prose cap; 16 and 4 margins        |
| Shield bar sits on the bottom safe edge                                                                    | Bottom view edge                        |
| Notices use `TYPE.body` and `NOTICE` placement                                                             | 14 px text at fixed offsets             |
| Story pages use `STORY_PANEL`                                                                              | `.story-panel` clamp and rem sizes      |
| Shop row: name to trailing slot is `SPACING.gap`; the paint heading sits on a 20 line                      | 16; a 24 line                           |

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
  above the floor, at 720 and 779 logical wide.
- Every action in a row shares one width and sits `SPACING.gap` apart.
- With phone insets (left and right 43, bottom 19 logical) at 720x360, every
  HUD drawn rect lies in its safe rect and the top clusters' press areas keep
  `SPACING.pageInset` apart.
- Each card, filled with Gameplay's longest strings at 720x360, fits the
  available rect or scrolls only its scroll group; no text is below 16.
- The galaxy card and the story panel keep one size across pages.
