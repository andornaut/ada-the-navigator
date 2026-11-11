import { modalWidth } from "@andornaut/game-kit/modalLayout";

import { SCREEN } from "../../data/screen.ts";
import { CARD_CONTENT, cardTitleReserve } from "./cardFrame.ts";
import { CONTROL_ROW, TEXT_BUTTON } from "./controls.ts";
import { SPACING } from "./tokens.ts";

// The content-fitted card (art/layout.md "Modals" and "Groups"), as Chibi's
// src/ui/layout/contentCard.ts, in logical px, shared by every Ada modal. The width source is
// game-kit's modalWidth.

export { CARD_CONTENT, cardHeaderLayout, cardTitleReserve } from "./cardFrame.ts";

// The 50% width floor is half the fixed 720 base view, as in Chibi, at every logical width.
export const CARD_FLOOR_VIEW_WIDTH = SCREEN.width;

// A card's scrolling region: it reserves a 6 gap and an 8 track on its right inside the padding,
// the thumb inset 1 in the track, and keeps endPad below its last control at the scroll end. A
// pointer moving further than dragThreshold scrolls and does not activate.
export const SCROLL = {
  dragThreshold: 8,
  endPad: SPACING.panelPadding,
  gap: 6,
  thumbInset: 1,
  track: 8,
} as const;

// The card's width: min(availableWidth, max(contentWidth + 32, 720 / 2)), where contentWidth is
// the widest group or the title with its reserved clearance; prose groups do not count.
export function cardWidth(
  availableWidth: number,
  groupWidths: readonly number[],
  title: { readonly close: boolean; readonly width: number } | undefined,
): number {
  const headerWidth = title
    ? title.width + 2 * (cardTitleReserve(title.close) - CARD_CONTENT.padding)
    : 0;
  return modalWidth(
    { availableWidth, viewportWidth: CARD_FLOOR_VIEW_WIDTH },
    Math.max(headerWidth, 0, ...groupWidths),
  );
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

// An action row's width: buttons of one shared width, the widest label plus the insets, a gap
// apart; a stack fills the inner width, so its least width is one button.
export function actionsWidth(axis: "row" | "stack", labelWidths: readonly number[]): number {
  if (labelWidths.length === 0) {
    return 0;
  }
  const button = Math.max(...labelWidths) + 2 * TEXT_BUTTON.inset;
  return axis === "row"
    ? labelWidths.length * button + (labelWidths.length - 1) * SPACING.gap
    : button;
}
