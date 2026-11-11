# Station and shop

Layout for the station card, the shop and the buy confirm. Each is a modal on
the shared content-fitted card layout in [Controls](controls.md#cards-and-modals):
card width, centring, 16px padding, the header, the close X, 8px between groups
and the dimmed, input-exclusive background all come from there. This page
defines only each card's groups. Sizes are CSS pixels at 1x. Gameplay owns the
strings, prices, item order and behaviour; the keys below are Gameplay's player
string keys.

## Shared parts

| Part                | Asset or token                                                                         |
| ------------------- | -------------------------------------------------------------------------------------- |
| Card, close, focus  | `ui-settings-card`, `ui-close`, `ui-focus`                                             |
| Buttons and tabs    | `ui-button` (secondary), `ui-button-primary`                                           |
| Item row            | `ui-button-tile`: normal, pressed, disabled; nine-slice 2/4/2/6                        |
| Stardust            | `icon-stardust`, 16px in price pills, 20px in balances and the confirm price           |
| Item glyphs         | `icon-shop-*` sheets and `weapon-<id>.svg`; see Shop icons                             |
| Owned and In use    | `icon-shop-check`, 12x8                                                                |
| Ship paint swatches | The scheme's `ship-12` frame: `ship-12` for Classic, `ship-<scheme>-12` for the others |

Text uses the controls text tokens: titles 24px bold white `#ffffff`, body and
names 16px cream `#ead4aa`, supporting text 16px `#b8b3c9`, disabled text 16px
`#9a96ad`. Body text groups never widen a card: they wrap within the inner width
the other groups and the 50% viewport floor set.

A balance is one centred group: `icon-stardust` at 20px, 6px, then the amount
16px bold cream, both centred vertically on a 20px line.

## Station card

Opens on docking. The close X, an outside tap, back and Escape all act as Undock.

1. Header: `station`.
2. Balance: `stardustAmount`.
3. `stationWelcome`, supporting text, centred lines.
4. Action group: Undock (`undock`, secondary) left, Shop (`shop`, primary) right.

No quest board until station quests are designed.

## Shop

1. Header: `shop`. The close X, back and Escape close the shop.
2. Balance: the amount alone, without the word Stardust.
3. Tabs: one action group, Weapons (`shopWeapons`) left and Ship (`shopShip`)
   right, sharing one width. The selected tab draws `ui-button-primary`, the
   other `ui-button`; both keep the normal and pressed frames. Tabs are a tab
   list; switching tabs resets the list scroll to the top.
4. Item list: the selected tab's row groups, in a vertical scroll viewport.

The Weapons tab holds one row group. The Ship tab holds the upgrade row group,
then the paint group: a heading line and the paint row group, 8px apart. The
heading is `icon-shop-ship-paint` (20px), 6px, then `shipPaint` 16px bold
white, on a 24px line, left-aligned to the paint row group.

### Row group

- Two columns, 8px apart, with 4px between rows. Rows fill left then right in
  item order, and a group always starts a new line.
- Every row in the shop shares one width: the widest row content across both
  tabs, so the card keeps its width when the tab changes. The group centres in
  the list.
- When two columns plus the card padding exceed the available width, the group
  is one column.

### Item row

A `ui-button-tile` 48 high: a 44px face over a 4px lip, the whole row one
control. Pressed drops the face and its content 2px and removes the lip.
Content centres vertically on the face.

| Part          | Geometry                                                                                                                                                         |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Item well     | 36x36, 8px from the row's left edge. 2px ink `#181425` edge with its four corner pixels clear, face navy `#262b44`                                               |
| Glyph         | Centred in the well: 20x20 icons at offset 8, the 24x24 upgrade composite at 6, the 32x32 paint swatch at 2                                                      |
| Name          | 8px right of the well. 16px cream on one 20px line, or with a second 20px line for the level                                                                     |
| Level line    | Levelled items only: `level` ("Level {level} of {max}"), current level, supporting text                                                                          |
| Trailing slot | At the row's right end, 8px inset, centred vertically. One width for every row: the widest of the price pill, Owned and In use                                   |
| Price pill    | 28 high, radius 4, ink `#181425`. `icon-stardust` 16px, 6px, then the price 16px bold cream, centred as a group with 8px side padding. All pills share one width |
| Owned         | `icon-shop-check`, 6px, then `owned` 16px bold supporting, right-aligned in the slot                                                                             |
| In use        | `icon-shop-check`, 6px, then `inUse` 16px bold cream, plus the selection ring                                                                                    |

Row width is 8 + 36 + 8 + the widest name or level line + 16 + the trailing
slot + 8.

Row states:

- **Buy**: affordable and not owned, or a levelled item below its maximum. The
  pill shows the next level's price. Activating opens the buy confirm.
- **Owned**: owned weapons and maxed levelled items show Owned and do nothing
  on activation. An owned paint scheme not in use shows Owned; activating puts
  it in use at once, with no confirm.
- **In use**: the paint scheme in use. A 2px cream `#ead4aa` selection ring sits
  2px outside the row's drawn rectangle (4px outset, outer corner radius 5).
  Exactly one paint row is in use; the ring moves when another is chosen.
- **Unaffordable**: the tile's disabled frame, a flat `#2f2d3d` face over the
  full 48px with no lip and no press displacement, content centred on it. The
  well face is `#2f2d3d`, the glyph uses its disabled colour `#9a96ad`, and the
  name, level and price use disabled text `#9a96ad`; the Stardust icon and the
  ink pill are unchanged. Unlike a disabled control, the row stays focusable and
  activatable: activation plays the [refusal cue](controls.md#refusal-cue) on
  the row, tinting the name and the price.

Focus draws `ui-focus` 4px outside the row in every state; it may overlap the
selection ring. Contrast: names 6.59:1 and level lines 4.69:1 on the `#46425e`
face, disabled text 4.69:1 on `#2f2d3d`, the price 12.44:1 and a disabled price
6.30:1 on the pill.

### Upgrade glyph

A weapon upgrade row draws a 24x24 composite: the weapon's 20px glyph at (0, 4)
and the 12x12 `icon-shop-upgrade-badge` at (12, 0), drawn over the glyph. In an
unaffordable row both use their disabled colour.

### Scrolling

- The card's height fits its content up to the available height. Beyond that,
  the header, balance and tabs stay fixed and the item list scrolls vertically,
  clipped at the list edges with no fade.
- A scrolling list reserves 14px on its right, inside the card padding: a 6px
  gap and an 8px track `#2f2d3d` the list's full height, with a `#6b6685` thumb
  inset 1px, its length proportional to the visible fraction. The reserve
  counts towards the content width.
- Drag and wheel scroll the list. A pointer that moves more than 8px scrolls
  and does not activate the row it started on.
- Keyboard focus scrolls the focused row fully into view, including its focus
  ring.

## Buy confirm

Opens over the shop, which dims behind it. The close X, an outside tap, back,
Escape and Cancel all cancel.

1. Header: `confirmTitle` ("Buy {name}?").
2. Item well: 56x56, the item well's edge and navy face, with the glyph at 2x by
   nearest neighbour (40x40, or 48x48 for the upgrade composite) or the paint
   swatch at 48x48, centred.
3. Weapons only: the weapon's description (`aboutMissiles`, `aboutTripleLaser`,
   `aboutScattershot`), body text, centred lines.
4. Price: `icon-stardust` at 20px, 6px, then the price 24px bold cream, centred.
5. `confirmLeft` ("{amount} left after"), supporting text, centred.
6. Action group: Cancel (`confirmCancel`, secondary) left, Buy (`confirmBuy`,
   primary) right.

## Differences from the approved mock-ups

The shared card layout takes precedence over these mock-up measurements:

- Cards are content-fitted rather than fixed at 400, 640 and 340 wide, and
  action groups and tabs share the widest label's width instead of filling or
  left-aligning in the card.
- The shop balance is a centred group under the title, not inside the header's
  top-left corner.
- The two item columns form one centred group with 4px between rows, rather
  than 8px.
- Rows are 48 high (44px face), not 50, and level lines are 16px supporting
  text, not 14px. Owned and In use labels are 16px.
- Row insets are 8px throughout; the mock-up's well inset was 7, its name gap
  9 and its pill inset 10.
- `icon-stardust` is 16px and 20px rather than the mock-up's 11px and 15px
  sparkle, and the pills share a content-fitted width instead of a fixed 70px.
