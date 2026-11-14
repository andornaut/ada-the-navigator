import { capTop } from "./cardFrame.ts";
import { CARD_WIDTH_CAPS } from "./contentCard.ts";
import { CONTROL_ROW } from "./controls.ts";
import { STORY_PANEL } from "./storyPage.ts";
import { SPACING, TYPE } from "./tokens.ts";

export const SETTINGS_OUTER_PADDING = 2 * SPACING.panelPadding;
export const SETTINGS_INNER_PADDING = SPACING.panelPadding;
export const SETTINGS_SECTION_GAP = SPACING.panelPadding;
export const SETTINGS_COLUMN_GAP = 2 * SETTINGS_INNER_PADDING + STORY_PANEL.rule.width;
export const SETTINGS_TITLE_INK_TOP = CONTROL_ROW.textInset + capTop(TYPE.body);

/** The title's visible cap top, from the actual loaded font's metrics. */
export function settingsTitleInkTop(metrics: {
  readonly ascent: number;
  readonly descent: number;
  readonly inkAscent: number;
  readonly lineHeight: number;
}): number {
  return (
    CONTROL_ROW.textInset +
    (metrics.lineHeight - metrics.ascent - metrics.descent) / 2 +
    metrics.ascent -
    metrics.inkAscent
  );
}

/** The smallest two-column Settings card that preserves each control's label and action. */
export function settingsColumns(
  context: {
    readonly actionsWidth: number;
    readonly availableWidth: number;
    readonly landscape: boolean;
    readonly overflowing: boolean;
  },
  rowWidths: readonly number[],
): { readonly columns: 1 | 2; readonly minimumWidth: number } {
  const minimumWidth =
    2 * Math.max(context.actionsWidth, 0, ...rowWidths) +
    SETTINGS_COLUMN_GAP +
    2 * SETTINGS_OUTER_PADDING;
  const paired =
    context.landscape &&
    context.overflowing &&
    rowWidths.length > 0 &&
    minimumWidth <= Math.min(context.availableWidth, CARD_WIDTH_CAPS.medium);
  return paired ? { columns: 2, minimumWidth } : { columns: 1, minimumWidth: 0 };
}
