# Station and shop

The station card, the shop and the buy confirm: their groups, states and
art. Each is a modal on the content-fitted card in [Layout](layout.md#modals),
and every distance and size, including the item row's, is in
[Layout](layout.md#shop-item-row). Gameplay owns the strings, prices, item
order and behaviour; the keys below are Gameplay's player string keys.

## Shared parts

| Part                | Asset or token                                                                              |
| ------------------- | ------------------------------------------------------------------------------------------- |
| Card, close, focus  | `ui-settings-card`, `ui-close`, `ui-focus`                                                  |
| Buttons and tabs    | `ui-button` (secondary), `ui-button-primary`                                                |
| Item row            | `ui-button-tile`: normal, pressed, disabled; nine-slice 2/4/2/6                             |
| Stardust            | `icon-stardust` (16px) in price pills; `icon-stardust-20` in balances and the confirm price |
| Item glyphs         | `icon-shop-*` sheets and `weapon-<id>.svg`; see [Shop icons](shop-icons.md)                 |
| Owned and In use    | `icon-shop-check`, 12x8                                                                     |
| Ship paint swatches | The scheme's `ship-24` frame: `ship-24` for Classic, `ship-<scheme>-24` for the others      |

Text uses the [controls text tokens](controls.md#colour-tokens): titles white
`#ffffff`, body and names cream `#ead4aa`, supporting text `#b8b3c9`, disabled
text `#9a96ad`. A balance's amount is cream.

## Station card

Opens on docking. The close X, an outside tap, back and Escape all act as Undock.

1. Header: `station`.
2. Balance: `stardustAmount`.
3. `stationWelcome`, supporting text, centred lines.
4. Action group: Undock (`undock`, secondary) left, Shop (`shop`, primary) right.

No quest board until station quests are designed.

## Shop

1. Header: `shop`. The close X, an outside tap, back and Escape return to the
   station card; only the station card's exits undock.
2. Balance: the amount alone, without the word Stardust.
3. Tabs: one action group, Weapons (`shopWeapons`) left and Ship (`shopShip`)
   right, sharing one width. The selected tab draws `ui-button-primary`, the
   other `ui-button`; both keep the normal and pressed frames. Tabs are a tab
   list; switching tabs resets the list scroll to the top.
4. Item list: the selected tab's row groups, in a vertical scroll viewport.

The Weapons tab holds one row group. The Ship tab holds the upgrade row group,
then the paint group: the paint heading (`icon-shop-ship-paint`, then
`shipPaint` in white) and the paint row group. The heading is left-aligned to
the paint row group.

### Row group

- A control grid ([Layout](layout.md#groups)). Rows fill left then right in
  item order, and a group always starts a new line.
- Every row in the shop shares one width across both tabs, so the card keeps
  its width when the tab changes. The group centres in the list.

### Item row

A `ui-button-tile`, the whole row one control, with the button face states.

| Part       | Art                                                                                     |
| ---------- | --------------------------------------------------------------------------------------- |
| Item well  | Ink `#181425` 2px edge with its four corner pixels clear, face navy `#262b44`           |
| Glyph      | Centred in the well: 20x20 icons, the 24x24 upgrade composite or the 32x32 paint swatch |
| Name       | Cream                                                                                   |
| Level line | Levelled items only: `level` ("Level {level} of {max}"), supporting text                |
| Price pill | Ink `#181425` with `icon-stardust` and the price in cream                               |
| Owned      | `icon-shop-check` and `owned` in supporting text                                        |
| In use     | `icon-shop-check` and `inUse` in cream, plus the selection ring                         |

Row states:

- **Buy**: affordable and not owned, or a levelled item below its maximum. The
  pill shows the next level's price. Activating opens the buy confirm.
- **Owned**: owned weapons and maxed levelled items show Owned and do nothing
  on activation. An owned paint scheme not in use shows Owned; activating puts
  it in use at once, with no confirm.
- **In use**: the paint scheme in use, with the cream `#ead4aa` selection ring
  outside the row's drawn rectangle. Exactly one paint row is in use; the ring
  moves when another is chosen.
- **Unaffordable**: the tile's disabled frame, a flat `#2f2d3d` face over the
  full height with no lip and no press displacement, content centred on it. The
  well face is `#2f2d3d`, the glyph uses its disabled colour `#9a96ad`, and the
  name, level and price use disabled text `#9a96ad`; the Stardust icon and the
  ink pill are unchanged. Unlike a disabled control, the row stays focusable and
  activatable: activation plays the [refusal cue](controls.md#refusal-cue) on
  the row, tinting the name and the price.

Focus draws `ui-focus` outside the row in every state; it may overlap the
selection ring. Contrast: names 6.59:1 and level lines 4.69:1 on the `#46425e`
face, disabled text 4.69:1 on `#2f2d3d`, the price 12.44:1 and a disabled price
6.30:1 on the pill.

### Upgrade glyph

A weapon upgrade row draws a 24x24 composite: the weapon's 20px glyph at (0, 4)
and the 12x12 `icon-shop-upgrade-badge` at (12, 0), drawn over the glyph. In an
unaffordable row both use their disabled colour.

### Scrolling

- The item list is the shop's scroll group ([Layout](layout.md#modals)): the
  header, balance and tabs stay fixed, and the list clips at its edges with no
  fade.
- The scroll track is `#2f2d3d`, the list's full height, with a `#6b6685`
  thumb whose length is proportional to the visible fraction. Its reserve
  counts towards the content width.
- Drag and wheel scroll the list.

## Buy confirm

Opens over the shop, which dims behind it. The close X, an outside tap, back,
Escape and Cancel all cancel.

1. Header: `confirmTitle` ("Buy {name}?").
2. Item well: the confirm well, with the item well's edge and navy face and
   the glyph at 2x by nearest neighbour or the paint swatch, centred.
3. Weapons only: the weapon's description (`aboutRapidMissile`,
   `aboutMultiLaser`, `aboutHeavyMissile`, `aboutScattershot`, `aboutPhaser`),
   body text, centred lines.
4. Price: `icon-stardust-20` and the price in cream, centred.
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
- The two item columns form one centred control grid, rather than rows 8px
  apart.
- Rows use the standard action height, not 50, and level lines and the Owned
  and In use labels use the 16px text roles, not 14px.
- Row insets are `SPACING.gap` throughout; the mock-up's well inset was 7, its
  name gap 9 and its pill inset 10.
- `icon-stardust` (16px) and `icon-stardust-20` replace the mock-up's 11px and 15px
  sparkle, and the pills share a content-fitted width instead of a fixed 70px.
