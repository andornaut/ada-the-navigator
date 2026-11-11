import { SCROLL } from "./contentCard.ts";
import { FOCUS_RING, PILL, TEXT_BUTTON } from "./controls.ts";
import { SPACING, TYPE } from "./tokens.ts";

// The shop item row and the buy confirm's well and price (art/layout.md "Shop item row"), in
// logical px. A row is a ui-button-tile at the action height, its content centred on each state's
// face: the item well at the left inset, the name block a gap right of it, the trailing slot at the
// right inset.

// Glyph sizes inside a well: 20 icons, the 24 upgrade composite, the 32 paint swatch. Each centres
// in the 36 well, at 8, 6 and 2.
const GLYPH = { icon: 20, swatch: 32, upgrade: 24 } as const;
const WELL = 36;

export const SHOP_ROW = {
  // The icon-shop-check mark beside Owned and In use.
  check: { height: 8, width: 12 },
  // Columns of the item grid and the rows of one column.
  columnGap: SPACING.columnGap,
  glyph: GLYPH,
  height: TEXT_BUTTON.height,
  inset: SPACING.gap,
  markGap: SPACING.markGap,
  // The name, or the name over its level line, on body line boxes.
  nameGap: SPACING.gap,
  nameLine: TYPE.body.lineHeight,
  // The paint heading: a 20 icon, a mark gap and a label, on a 20 line, a gap above the paint rows.
  paintHeading: { gap: SPACING.gap, icon: 20, line: TYPE.label.lineHeight },
  // Price pills: a PILL with the 16 icon-stardust and the price as a label.
  pill: { icon: 16, pill: PILL },
  rowGap: SPACING.rowGap,
  // The In use row's selection ring: a band, its offset outside the drawn row.
  selection: { band: FOCUS_RING.selectionBand, outset: FOCUS_RING.selectionOutset },
  // The weapon upgrade composite: the 20 weapon glyph at (0, 4), the 12 badge at (12, 0).
  upgrade: { badge: 12, badgeX: 12, weaponY: 4 },
  well: WELL,
  // The well's ink edge; its four corner pixels are clear.
  wellEdge: 2,
} as const;

// A glyph's offset inside its well, centred.
export function glyphOffset(size: number, well: number = SHOP_ROW.well): number {
  return (well - size) / 2;
}

// The buy confirm: a 56 well with the glyph at 2x by nearest neighbour (40, or 48 for the upgrade
// composite) and the swatch at 48, centred; the price as a heading with the 20 Stardust icon.
export const CONFIRM_ITEM = {
  glyphScale: 2,
  price: { icon: 20, markGap: SPACING.markGap, text: TYPE.heading },
  swatch: 48,
  well: 56,
} as const;

// The balance: the 20 Stardust icon, a mark gap and the amount as a label, on a 20 line.
export const BALANCE = { icon: 20, line: TYPE.label.lineHeight, markGap: SPACING.markGap } as const;

// One row's width: the insets, the well, the widest name or level line and the shared trailing
// slot, a gap apart. Every row in the shop uses the widest, across both tabs.
export function shopRowWidth(nameWidth: number, slotWidth: number): number {
  const { inset, nameGap, well } = SHOP_ROW;
  return inset + well + nameGap + nameWidth + nameGap + slotWidth + inset;
}

// The item list's width for columns of rowWidth rows: the columns a column gap apart, plus the
// scroll reserve on its right, which counts toward the content width.
export function shopListWidth(columns: 1 | 2, rowWidth: number): number {
  return columns * rowWidth + (columns - 1) * SHOP_ROW.columnGap + SCROLL.gap + SCROLL.track;
}

// Two columns when a two-column list plus the panel padding fits the available width, else one.
export function shopColumns(availableWidth: number, rowWidth: number): 1 | 2 {
  return shopListWidth(2, rowWidth) + 2 * SPACING.panelPadding <= availableWidth ? 2 : 1;
}
