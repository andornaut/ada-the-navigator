import { SCROLL, SHOP_ROW, SPACING } from "../../data/layout.ts";
export { BALANCE, CONFIRM_ITEM, SHOP_ROW } from "../../data/layout.ts";

// The shop item row and the buy confirm's well and price (art/layout.md "Shop item row"), in
// logical px. A row is a ui-button-tile at the action height, its content centred on each state's
// face: the item well at the left inset, the name block a gap right of it, the trailing slot at the
// right inset.

// A glyph's offset inside its well, centred.
export function glyphOffset(size: number, well: number = SHOP_ROW.well): number {
  return (well - size) / 2;
}

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
