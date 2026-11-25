# Station and shop

Station pages share a Large card footprint and common navigation. Purchase
and task decisions use a separate dialog over the current page. Gameplay
owns the strings, prices, stock order, eligibility and transaction rules.

## Shared parts

| Part                | Asset or token                                                                                        |
| ------------------- | ----------------------------------------------------------------------------------------------------- |
| Card and close      | `ui-settings-card`, `ui-close`                                                                        |
| Footer controls     | `ui-button` for service pages and `ui-button-primary` for Undock                                      |
| Item row            | `ui-button-tile` normal, pressed and disabled frames, nine-slice 2/4/2/6                              |
| Resources           | `icon-stardust-20` at 16 px in pills. `icon-stardust-20` and `icon-ore-20` for balances and Exchange. |
| Item glyphs         | Weapon and ammo SVG masks, equipment and project SVGs. See [Shop icons](shop-icons.md).               |
| Job glyphs          | `icon-job-*.svg` and disabled counterparts. See [Shop icons](shop-icons.md#job-icons).                |
| Status mark         | `icon-shop-check.svg`, 12x8                                                                           |
| Ship paint swatches | The scheme's 48-heading ship art, `ship-48` for Classic and `ship-<scheme>-48` for other schemes      |

Text uses the [controls text tokens](controls.md#colour-tokens). Titles are
white `#ffffff`, names and balance amounts are cream `#ead4aa`, and supporting
text uses `#b8b3c9`. Tile rows use `#c0bbd0` for secondary lines and Owned,
`#a6a2b8` for unaffordable and busy text, and `#9a96ad` for disabled glyphs.

## Station pages

Dock opens the station welcome with its title and, for an authored keeper, a
name tab, portrait and one paragraph. Available services appear immediately.
The ordinary welcome has no Continue or Skip. A station without a keeper
opens on its title and services. Mandatory choices and guarded arrivals
follow their existing [interaction path](layout.md#conversation-card).

The shared Stardust and Ore group anchors at the top left of each Station
page. Its top and left margins match the content inset. Both icons have
spoken resource names paired with their displayed amounts.

The footer follows the [footer pattern](layout.md#groups). It places
available Shop and Jobs & Projects actions, then Exchange, on the left,
`BUTTON_GAP` (16) apart. Primary Undock sits on the right. The current
service button
uses the flat disabled face colour, yellow text and a thick underline in the
primary colour. Keyboard focus remains visible on the face, with a brighter
and thicker underline on the current page.

On the welcome, the close X, outside tap, back and Escape undock. From Shop,
Jobs & Projects or Exchange the same inputs return to the welcome and focus
the service that opened the page. Undock remains available in the footer on
every Station page.

## Shop

Two fixed, equal panes sit side by side under the Shop title, with compact
headings and a divider. Each station chooses and orders two of Weapons,
Equipment and Ammo. Each pane shows up to four offers in a single column.
Sparse stock keeps the pane layout. Equipment includes paint alongside
equipment tracks. Shop has no inner tabs, pagination or scrolling.

### Item row

The whole tile is one control. A left well holds the glyph, the name and
optional detail occupy the middle, and the right end holds a price or status
mark. Long names and details truncate visually within the pane and retain
their text in the spoken row label.

| Part       | Art                                                                                  |
| ---------- | ------------------------------------------------------------------------------------ |
| Item well  | Ink `#181425` 2 px edge with clear corners, navy face `#262b44`                      |
| Glyph      | Centred in the well at 20x20, with a 24x24 upgrade composite or a 32x32 paint swatch |
| Name       | Cream                                                                                |
| Level line | `level` ("Level {level} of {max}") in row supporting                                 |
| Price pill | Ink `#181425` with `icon-stardust-20` and the price in cream                         |
| Owned      | Check mark and `owned` in row supporting                                             |
| In use     | Check mark and `inUse` in cream on a navy in-face selection treatment                |

- **Buy.** An affordable unowned item or an available upgrade opens Buy
  confirm. The upgrade pill shows the next level's price.
- **Owned.** Owned weapons and maxed tracks show Owned. Selecting an owned
  paint scheme equips it immediately. The In use marker moves to that scheme.
- **Unaffordable.** The flat `#2f2d3d` tile has no lip or press displacement.
  The well uses the same face. The glyph uses muted mask ink or its disabled
  SVG, and the ink pill and Stardust icon remain visible. The row stays focusable and
  activation plays the [refusal cue](controls.md#refusal-cue).
- **Keyboard focus.** Shop stock tints the face inside the tile, keeping its
  edges, lip and pressed art. Installed paint uses the supporting colour
  when focused. An unaffordable focused row uses `#514b68` with white text.

On the normal `#46425e` face, names are 6.58:1 and secondary lines are 5.11:1.
Disabled text is 5.42:1 on the resting `#2f2d3d` face. Cream and disabled
prices on the ink pill are 12.44:1 and 7.27:1 respectively.

### Item glyph sources

- Weapons use `weapon-<id>.svg` in `/art/ui/icons/`, the same mask as the HUD.
  The item well supplies the normal or unaffordable ink. See
  [Shop icons](shop-icons.md).
- A weapon upgrade adds a 12x12 `icon-shop-upgrade-badge.svg` at (12, 0) over
  the 20x20 weapon mask at (0, 4). An unaffordable row uses muted mask ink
  and `icon-shop-upgrade-badge-disabled.svg`.
- Engine tuning, Shield and Tractor beam use `icon-shop-engine-tuning`,
  `icon-shop-shield` and `icon-shop-tractor-beam` from `/art/ui/icons/`.
  The row and confirm share the smooth SVG caller in
  `src/ui/stationItemIcon.ts`. Each has a normal `.svg` and a
  `-disabled.svg`, authored by `art/tools/shop-equipment-svg.ts`.
  Paint rows use the scheme swatch.

### Ammunition rows

Ammo uses its kind's mask (`ammo-missile.svg`, `ammo-energy.svg` or
`ammo-shell.svg`) alone in the well, with the well's state colour. The upright
stock glyph sits next to the weapon-specific name and pack count. If Ada
lacks the required weapon, the row keeps its pack count and requirement
beneath the name, omits the price and disables activation. Once
unlocked, an unaffordable pack uses the usual focusable refusal state.

## Jobs & Projects

The page and footer both say Jobs & Projects. A project-only station can
open the page. Jobs-only stations hide the project pane.

### Job board

The fixed pane grid matches Shop, with Jobs on the left and Community
projects on the right. The board reserves room for unfunded projects, keeps
any held task at the top, and caps the offer selection at four without
pagination. Completed jobs replenish through the Gameplay board.

The Jobs heading pairs its category colour with Rewards and the Stardust
icon. Community projects pairs its category colour with Contributions and
the same icon. Both hints have equivalent spoken text. The job and project
colours (`#feae34` and `#8f9cf0`) also tint the well edges.

Each tile has one action. A job shows its type glyph, title, detail and
reward pill. An activity uses `icon-job-activity`, its name and its goal. A
held task shows Active in cream with the check. Project tiles show the
project glyph, name, detail and contribution or Funded. Busy jobs use the
flat disabled appearance and remain inspectable.

Use changes in face fill, text or icon colour for focus, press and selection.
Keep the tile's ordinary border in every state.

A job offer opens its details and Cancel and Accept. Reward shows the amount
and Stardust icon with equivalent spoken text. Ore in descriptions stays
text. A busy job shows the refusal reason in its dialog and retains the
acceptance guard. A held task opens a Cancel and Drop confirmation. The
non-Dock `activityDrop` model confirmation uses the
[interaction material-choice path](layout.md#conversation-card).

A project opens its details and the applicable guarded contribution action
with Cancel. Contribution shows the offered Stardust amount, with no
projected player balance or amount remaining to fund the project. Funded
project rows cannot activate. See [Community projects](projects.md) for
project art and scope. Closing a detail restores focus to its row or an
available board control.

## Exchange

Buy Stardust and Buy ore each put the buy label and rate at the left, with
1, 10 and 100 actions beside them. The rate uses both resource icons and
equivalent spoken text. It uses the Gameplay unit cost, currently two of
the spent resource for one received. Each quantity shows the received
resource icon and speaks both the amount received and the cost.

Quantity columns align between rows. The gaps before, between and after
the visible quantity faces are equal. An unavailable quantity keeps a flat
muted face lighter than the row, with readable icons and text. It stays in
keyboard order and gives brief refusal feedback. A successful trade
updates both header balances together. There is no quantity input,
confirmation or success summary.

## Buy confirm

Opens over the shop, which dims and stays inactive behind it. The top-right
X invokes Cancel. An outside tap, back and Escape use the same one-layer
path where dismissal is allowed. Keep the shop open and restore focus to
the invoking item, the nearest available offer after a stock change or
the Shop footer action.

1. `confirmTitle` ("Buy {name}?") and the top-right X.
2. Item well with an ink edge and navy face. Centre the glyph at 2x, or use the
   larger paint swatch. SVG masks and painted vectors draw with smooth
   sampling. Paint swatches retain nearest-neighbour sampling.
3. The offer's description where supplied, centred. A weapon offer uses
   its description and an ammunition pack uses the pack count.
4. Offered price, centred in cream with `icon-stardust-20`. Omit the
   projected remaining Stardust balance.
5. Cancel (`confirmCancel`, secondary) left, Buy (`confirmBuy`, primary) right.
   Buy is subject to the current purchase guard.
