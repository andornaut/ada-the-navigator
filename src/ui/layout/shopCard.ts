import { SHOP_ROW, SPACING } from "../../data/layout.ts";
import { FOCUS_RING } from "./controls.ts";
export { BALANCE, CONFIRM_ITEM, SHOP_ROW } from "../../data/layout.ts";

export const EXCHANGE_FIELD = { edge: 1, width: 96 } as const;

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

// The paged list includes the focus rings on both sides, without a scroll track.
export function shopListWidth(columns: number, rowWidth: number): number {
  return columns * rowWidth + (columns - 1) * SHOP_ROW.columnGap;
}

// Use every complete column fitting inside the card padding and the row focus rings.
export function shopColumns(availableWidth: number, rowWidth: number): number {
  const room = availableWidth - 2 * SPACING.panelPadding - 2 * FOCUS_RING.outset;
  return Math.max(1, Math.floor((room + SHOP_ROW.columnGap) / (rowWidth + SHOP_ROW.columnGap)));
}

// The existing two-line label fits a standard row; only additional wrapped lines grow it.
export function shopRowHeight(nameHeight: number): number {
  return Math.max(SHOP_ROW.height, nameHeight + SHOP_ROW.height - 2 * SHOP_ROW.nameLine);
}
