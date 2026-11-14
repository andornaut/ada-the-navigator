import { CONTROL_ROW, TEXT_BUTTON } from "../../data/layout.ts";
import { BUTTON_GAP } from "./tokens.ts";

export { SCROLL } from "../../data/layout.ts";
export { CARD_CONTENT, cardHeaderLayout, cardTitleReserve } from "./cardFrame.ts";

/** Fixed modal widths in logical pixels, clamped to the available game-area rect. */
export const CARD_WIDTH_CAPS = { large: 700, medium: 500, small: 400 } as const;
export const MODAL_GAME_MARGIN = 10;
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

// The compact Install action's width: 72, or its label plus the compact insets when wider.
export function cardActionsSize(labelWidth: number): number {
  return Math.max(TEXT_BUTTON.compactWidth, labelWidth + 2 * TEXT_BUTTON.compactInset);
}

// A control row's width for its label and right-end action.
export function rowWidth(labelWidth: number, actionWidth: number): number {
  return CONTROL_ROW.icon + CONTROL_ROW.gap + labelWidth + CONTROL_ROW.gap + actionWidth;
}

// An action row's width: buttons of one shared width, the widest label plus the insets,
// BUTTON_GAP apart; a stack fills the inner width, so its least width is one button.
export function actionsWidth(axis: "row" | "stack", labelWidths: readonly number[]): number {
  if (labelWidths.length === 0) {
    return 0;
  }
  const button = Math.max(...labelWidths) + 2 * TEXT_BUTTON.inset;
  return axis === "row"
    ? labelWidths.length * button + (labelWidths.length - 1) * BUTTON_GAP
    : button;
}
