import type { LayoutColumnSizing } from "@andornaut/game-kit/runtime/ui/layoutTree";

import { capTop, lineInkTop } from "./cardFrame.ts";
import { CARD_CONTENT, CARD_WIDTH_CAPS } from "./contentCard.ts";
import { PAGE_DIVIDER_STYLE } from "./controlPresentation.ts";
import { CONTROL_ROW } from "./controls.ts";
import { SPACING, TYPE } from "./tokens.ts";

export const SETTINGS_OUTER_PADDING = 2 * SPACING.panelPadding;
export const SETTINGS_INNER_PADDING = SPACING.panelPadding;
export const SETTINGS_SECTION_GAP = SPACING.panelPadding;
export const SETTINGS_COLUMN_GAP = 2 * SETTINGS_INNER_PADDING + PAGE_DIVIDER_STYLE.thickness;
export const SETTINGS_TITLE_INK_TOP = CONTROL_ROW.textInset + capTop(TYPE.body);

/** The title's visible cap top, from the actual loaded font's metrics. */
export function settingsTitleInkTop(metrics: {
  readonly ascent: number;
  readonly descent: number;
  readonly inkAscent: number;
  readonly lineHeight: number;
}): number {
  return CONTROL_ROW.textInset + lineInkTop(metrics);
}

/** Pair controls whenever their labels fit the clamped large card; footer width is independent. */
export function settingsColumns(
  context: { readonly availableWidth: number },
  rowWidths: readonly number[],
): { readonly columns: 1 | 2; readonly minimumWidth: number } {
  const minimumWidth =
    2 * Math.max(0, ...rowWidths) + SETTINGS_COLUMN_GAP + 2 * SETTINGS_OUTER_PADDING;
  return rowWidths.length > 0 &&
    minimumWidth <= Math.min(context.availableWidth, CARD_WIDTH_CAPS.large)
    ? { columns: 2, minimumWidth }
    : { columns: 1, minimumWidth: 0 };
}

/** Match the native row spacing and the shared divider's intrinsic middle track. */
export function settingsColumnArrangement(
  columns: 1 | 2,
):
  | { readonly gap: number; readonly kind: "stack" }
  | { readonly gap: number; readonly kind: "columns"; readonly sizing: LayoutColumnSizing } {
  return columns === 2
    ? {
        gap: SETTINGS_COLUMN_GAP / 2,
        kind: "columns",
        sizing: {
          mode: "tracks",
          tracks: [{ kind: "fraction" }, { kind: "intrinsic" }, { kind: "fraction" }],
        },
      }
    : { gap: CARD_CONTENT.rowGap, kind: "stack" };
}
