import { modalWidth } from "@andornaut/game-kit/modalLayout";

import {
  CARD_CONTENT,
  CARD_FLOOR_VIEW_WIDTH,
  CONTROL_ROW,
  TEXT_BUTTON,
} from "../../data/layout.ts";
import { cardTitleReserve } from "./cardFrame.ts";
import { BUTTON_GAP } from "./tokens.ts";
export { CARD_FLOOR_VIEW_WIDTH, SCROLL } from "../../data/layout.ts";

// The content-fitted card (art/layout.md "Modals" and "Groups"), as Chibi's
// src/ui/layout/contentCard.ts, in logical px, shared by every Ada modal. The width source is
// game-kit's modalWidth.

export { CARD_CONTENT, cardHeaderLayout, cardTitleReserve } from "./cardFrame.ts";

export const CARD_WIDTH_CAPS = { large: 760, medium: 560, small: 360 } as const;
export type CardSize = keyof typeof CARD_WIDTH_CAPS;

// Presets cap the content-fitted width; short content never stretches to fill the cap.
export function cardWidth(
  context: { readonly availableWidth: number; readonly size: CardSize },
  groupWidths: readonly number[],
  title: { readonly close: boolean; readonly width: number } | undefined,
): number {
  const headerWidth = title
    ? title.width + 2 * (cardTitleReserve(title.close) - CARD_CONTENT.padding)
    : 0;
  return modalWidth(
    {
      availableWidth: Math.min(context.availableWidth, CARD_WIDTH_CAPS[context.size]),
      viewportWidth: CARD_FLOOR_VIEW_WIDTH,
    },
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
