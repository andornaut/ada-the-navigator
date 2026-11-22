import { CONTROL_ROW, TEXT_BUTTON } from "../../data/layout.ts";
import { BUTTON_GAP } from "./tokens.ts";

export { SCROLL } from "../../data/layout.ts";
export { CARD_CONTENT, cardHeaderLayout, cardTitleReserve } from "./cardFrame.ts";

/**
 * Modal window width families in logical pixels, clamped to the available game-area rect. Height
 * follows content and fonts stay full size. Full-screen views are not modal windows.
 */
export const CARD_WIDTH_CAPS = { large: 688, medium: 500, small: 400 } as const;
/** The screen margin between a modal window and each game-area edge, in logical pixels. */
export const MODAL_SCREEN_MARGIN = 16;
export type CardSize = keyof typeof CARD_WIDTH_CAPS;

export function cardWidth(context: {
  readonly availableWidth: number;
  readonly size: CardSize;
}): number {
  return Math.max(0, Math.min(context.availableWidth, CARD_WIDTH_CAPS[context.size]));
}

// A group's left edge in the card's inner width: centred.
export function groupX(innerWidth: number, width: number): number {
  return (innerWidth - width) / 2;
}

// Install uses the same intrinsic width as other labeled actions.
export function cardActionsSize(labelWidth: number): number {
  return Math.max(TEXT_BUTTON.height, labelWidth + 2 * TEXT_BUTTON.inset);
}

// A control row's width for its label and right-end action.
export function rowWidth(labelWidth: number, actionWidth: number): number {
  return CONTROL_ROW.icon + CONTROL_ROW.gap + labelWidth + CONTROL_ROW.gap + actionWidth;
}

// Intrinsic widths include each action's own label and two insets, with gaps in a row.
export function actionsWidth(axis: "row" | "stack", labelWidths: readonly number[]): number {
  if (labelWidths.length === 0) {
    return 0;
  }
  const buttonWidths = labelWidths.map(cardActionsSize);
  return axis === "row"
    ? buttonWidths.reduce((total, width) => total + width, 0) +
        (buttonWidths.length - 1) * BUTTON_GAP
    : Math.max(...buttonWidths);
}
