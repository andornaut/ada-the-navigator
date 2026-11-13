# Station and shop

The station card, the shop, the buy confirm and the job board: their groups,
states and art. Each is a modal on the content-fitted card in [Layout](layout.md#modals),
and every distance and size, including the item row's, is in
[Layout](layout.md#shop-item-row). Gameplay owns the strings, prices, item
order and behaviour; the keys below are Gameplay's player string keys.

## Shared parts

| Part                | Asset or token                                                                                   |
| ------------------- | ------------------------------------------------------------------------------------------------ |
| Card, close, focus  | `ui-settings-card`, `ui-close`, `ui-focus`                                                       |
| Buttons and tabs    | `ui-button` (secondary), `ui-button-primary`                                                     |
| Item row            | `ui-button-tile`: normal, pressed, disabled; nine-slice 2/4/2/6                                  |
| Stardust            | `icon-stardust` (16px) in price pills; `icon-stardust-20` in balances and the confirm price      |
| Item glyphs         | `icon-shop-*` and `icon-project-*` sheets and `weapon-<id>.svg`; see [Shop icons](shop-icons.md) |
| Job glyphs          | `icon-job-*` sheets; see [Shop icons](shop-icons.md#job-icons)                                   |
| Owned and In use    | `icon-shop-check`, 12x8                                                                          |
| Ship paint swatches | The scheme's `ship-24` frame: `ship-24` for Classic, `ship-<scheme>-24` for the others           |

Text uses the [controls text tokens](controls.md#colour-tokens): titles white
`#ffffff`, body and names cream `#ead4aa`, supporting text `#b8b3c9`, disabled
text `#9a96ad`. Inside a tile row, shop, project and job rows alike, the
second line and Owned take row supporting `#c0bbd0` and an unaffordable or
busy row's text takes row disabled `#a6a2b8`, so every row's text is 5:1 or
more. A balance's amount is cream.

## Station card

Opens on docking. The close X, an outside tap, back and Escape all act as Undock.

The welcome uses the same two-column dialogue panel as Earth pages: the actual
keeper's portrait, name tab and current greeting on the text side; balance, Jobs
and Shop choices on the action side. Next line and Undock are separate secondary
navigation controls. The generated station's keeper supplies the speaker; a
station without an authored keeper shows the station title and menu without
speech, a portrait or a name tab. The overlay has one close X and no duplicate Close button.

## Shop

1. Header: `shop`. The close X, an outside tap, back and Escape return to the
   station card; only the station card's exits undock.
2. Balance: the amount alone, without the word Stardust.
3. Tabs: one action group, Weapons (`shopWeapons`), Ship (`shopShip`) and,
   once the galaxy's projects are offered, Projects (`projects`), left to
   right and sharing one width. The selected tab draws `ui-button-primary`, the
   other `ui-button`; both keep the normal and pressed frames. Tabs are a tab
   list; switching tabs resets the list scroll to the top.
4. Item list: the selected tab's row groups, in a vertical scroll viewport.

The Weapons tab holds the [ammunition row group](#ammunition-rows), when Ada
owns any non-Laser weapon, then its item row group. The Projects tab holds the
galaxy's project rows ([Community projects](projects.md)). The Ship tab holds the
upgrade row group, then the paint group: the paint heading
(`icon-shop-ship-paint`, then `shipPaint` in white) and the paint row group.
The heading is left-aligned to the paint row group.

### Row group

- A control grid ([Layout](layout.md#groups)). Rows fill left then right in
  item order, and a group always starts a new line.
- Every row in the shop shares one width across every tab, so the card keeps
  its width when the tab changes. The group centres in the list.

### Item row

A `ui-button-tile`, the whole row one control, with the button face states.

| Part       | Art                                                                                     |
| ---------- | --------------------------------------------------------------------------------------- |
| Item well  | Ink `#181425` 2px edge with its four corner pixels clear, face navy `#262b44`           |
| Glyph      | Centred in the well: 20x20 icons, the 24x24 upgrade composite or the 32x32 paint swatch |
| Name       | Cream                                                                                   |
| Level line | Levelled items only: `level` ("Level {level} of {max}"), row supporting `#c0bbd0`       |
| Price pill | Ink `#181425` with `icon-stardust` and the price in cream                               |
| Owned      | `icon-shop-check` and `owned` in row supporting `#c0bbd0`                               |
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
  name, level or pack line and price use row disabled `#a6a2b8`; the Stardust
  icon and the ink pill are unchanged. Unlike a disabled control, the row stays
  focusable and activatable: activation plays the
  [refusal cue](controls.md#refusal-cue) on the row, tinting the name and the
  price.

Focus draws `ui-focus` outside the row in every state; it may overlap the
selection ring. Contrast: names 6.58:1 and level lines 5.11:1 on the `#46425e`
face, row disabled text 5.42:1 on `#2f2d3d`, the price 12.44:1 and a disabled
price 7.27:1 on the pill.

### Upgrade glyph

A weapon upgrade row draws a 24x24 composite: the weapon's 20px glyph at (0, 4)
and the 12x12 `icon-shop-upgrade-badge` at (12, 0), drawn over the glyph. In an
unaffordable row both use their disabled colour.

### Ammunition rows

One row per owned non-Laser weapon, in the HUD order (Multi-Laser,
Rapid Missile, Heavy Missile, Scattershot, Phaser), in its own row group before
the weapon rows, so the repeat purchase shows without scrolling.

| Part       | Art                                                                                      |
| ---------- | ---------------------------------------------------------------------------------------- |
| Glyph      | The weapon's ammunition-kind icon alone, 20x20 at 8 in the well: `icon-shop-ammo-<kind>` |
| Name       | `ammoPack` ("{weapon} ammo"), cream                                                      |
| Pack line  | `ammoPackCount` ("×{count}", the pack size), supporting text, as the level line          |
| Price pill | The pack price, as every price pill                                                      |

| Weapon        | Kind      | Glyph                    | Name                 | Pack line | Name width |
| ------------- | --------- | ------------------------ | -------------------- | --------- | ---------- |
| Rapid Missile | `missile` | `icon-shop-ammo-missile` | "Rapid Missile ammo" | "×200"    | 144.04     |
| Multi-Laser   | `energy`  | `icon-shop-ammo-energy`  | "Multi-Laser ammo"   | "×200"    | 128.03     |
| Heavy Missile | `missile` | `icon-shop-ammo-missile` | "Heavy Missile ammo" | "×50"     | 147.59     |
| Scattershot   | `shell`   | `icon-shop-ammo-shell`   | "Scattershot ammo"   | "×130"    | 129.83     |
| Phaser        | `energy`  | `icon-shop-ammo-energy`  | "Phaser ammo"        | "×55"     | 99.59      |

- Ammunition rows draw the ammunition-kind sheet, never the weapon's sheet or
  an upgrade-style composite.
- The row name names the weapon, so the glyph shows only the kind: upright
  stock, distinct from the weapon glyphs' rightward fire and from the upgrade
  composite.
- The name block is two 20 lines, the name over the pack line, as a levelled
  row's name over its level line. The pack line is row supporting `#c0bbd0`,
  5.11:1 on the `#46425e` face, and row disabled `#a6a2b8` in an unaffordable
  row.
- An ammunition row is never Owned: it is Buy, or Unaffordable with the
  disabled tile, the glyph's `disabled` frame and the shared refusal cue.
- The buy confirm draws the ammunition glyph at 2x (40) in the confirm well,
  with `confirmTitle` ("Buy Rapid Missile ammo?"); `ammoPackCount` ("×200")
  takes the description's place, body text, centred.
- Row width: the widest ammunition line, "Heavy Missile ammo" (147.59), is
  narrower than the widest upgrade name, "Heavy Missile upgrade" (161.85), so
  ammunition rows never widen the shop. Rows stay 301.19 wide (slot 71.34,
  Owned) and two columns need 656.38, inside the 688 available at 720 logical.

### Scrolling

- The item list is the shop's scroll group ([Layout](layout.md#modals)): the
  header, balance and tabs stay fixed, and the list clips at its edges with no
  fade.
- The scroll track is `#2f2d3d`, the list's full height, with a `#6b6685`
  thumb whose length is proportional to the visible fraction. Its reserve
  counts towards the content width.
- Drag and wheel scroll the list.

## Job board

Gameplay's job board (`gameplay/quests.md` "Job board"), opened by Jobs on
the station card, on the shop's card pattern. The close X, an outside tap,
back and Escape return to the station card. Geometry is in
[Layout](layout.md#job-board-row).

1. Header: `jobBoard`.
2. Balance: the amount alone, as in the shop.
3. `jobBoardIntro`, supporting text, centred lines.
4. The refusal line, `jobBusy` (or `activityBusy`), supporting text, centred,
   shown after a busy row refuses and hidden when the board reopens.
5. Job list: one column of job rows, `STACK_BUTTON_GAP` apart, the scroll
   group, with the shop's scroll track and thumb. The held job or the active
   activity heads it.

### Job row

A `ui-button-tile`, the whole row one control, as the item row.

| Part   | Art                                                                                                                |
| ------ | ------------------------------------------------------------------------------------------------------------------ |
| Well   | The item well, with the job type's `icon-job-<type>` glyph at 8; an activity row shows `icon-job-activity`         |
| Title  | Gameplay's title (`surveyTitle`, `deliveryTitle`, `rescueTitle`, `huntTitle`), cream                               |
| Detail | Its one line (`surveyAbout` and the others), row supporting `#c0bbd0`                                              |
| Reward | The price pill with the reward amount, as every pill                                                               |
| Action | The [compact row action](controls.md#compact-row-action): Accept (`jobAccept`) primary, Drop (`jobDrop`) secondary |
| Active | Held rows: `icon-shop-check` and `jobActive` in cream in the reward's place, plus the selection ring               |

Row states:

- **Offer**: the tile's normal frame; the action is Accept on the primary
  compact face. Activating accepts at once, with no confirm.
- **Held**: the held job or active activity, at the top of every board in its
  galaxy, with the cream selection ring, Active, and Drop on the secondary
  compact face. Activating opens Gameplay's Drop confirm (`jobDropTitle` or
  `activityDrop`, Cancel and Drop).
- **Busy**: an offer while the galaxy's task slot is taken: the tile's flat
  disabled frame, the well `#2f2d3d`, the glyph's `disabled` frame, the title,
  detail, reward and Accept in row disabled `#a6a2b8`, and the compact
  action's disabled face. The disabled face is the tile's own colour, so only
  the label shows. The row stays focusable; activation plays the
  [refusal cue](controls.md#refusal-cue) on the row and shows the refusal
  line.

Contrast: titles 6.58:1 and details 5.11:1 on the `#46425e` face, busy text
5.42:1 on `#2f2d3d`, the reward 12.44:1 (busy 7.27:1) on the pill, Accept ink
7.26:1 on the primary face and Drop ink 5.95:1 on the secondary face. The
primary and secondary faces are 3.84:1 and 3.15:1 against the tile.

The Active activity row (`gameplay/quests.md` "Repeatable activities") shows
the shared activity glyph, `icon-job-activity`'s normal frame, for every
activity; its title is the activity's name and its detail line the goal.

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
