import { CARD_CONTENT, CARD_WIDTH_CAPS } from "./contentCard.ts";
import { SPACING } from "./tokens.ts";

/** The smallest two-column Settings card that preserves each control's label and action. */
export function settingsColumns(
  context: {
    readonly availableWidth: number;
    readonly landscape: boolean;
    readonly overflowing: boolean;
  },
  rowWidths: readonly number[],
): { readonly columns: 1 | 2; readonly minimumWidth: number } {
  const minimumWidth = 2 * Math.max(0, ...rowWidths) + SPACING.columnGap + 2 * CARD_CONTENT.padding;
  const paired =
    context.landscape &&
    context.overflowing &&
    rowWidths.length > 0 &&
    minimumWidth <= Math.min(context.availableWidth, CARD_WIDTH_CAPS.medium);
  return paired ? { columns: 2, minimumWidth } : { columns: 1, minimumWidth: 0 };
}
