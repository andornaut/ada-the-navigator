import { MODAL_CONTENT, modalWidth } from "@andornaut/game-kit/modalLayout";

// Chibi's content-fitted card layout (src/ui/layout/contentCard.ts) in CSS pixels, shared by
// every Ada modal: Settings, install steps, the update offer, cheats and the cards to come.

export const CARD = {
  closeInset: 6,
  closeSize: 24,
  closeTarget: 48,
  // ui-settings-card's 2px nine-slice edge, inside which the title's top gap is measured.
  frameBorder: 2,
  gap: 8,
  padding: MODAL_CONTENT.padding,
  rowGap: 4,
} as const;

// Control rows: a 16px icon, 8px, the label, 8px, then the switch or row action.
export const ROW = { action: { button: 72, switch: 32 }, gap: 8, height: 48, icon: 16 } as const;

// Buttons: the widest label plus 16px insets on each side.
export const BUTTON_INSET = 16;

// The close target, 6px in from the card's top and right edges, centred on its 24px face.
const CLOSE_HIT_Y = CARD.closeInset + CARD.closeSize / 2 - CARD.closeTarget / 2;
const CLOSE_HIT_RIGHT = CLOSE_HIT_Y + CARD.closeTarget;

// The title's clearance on each side: the close target and a gap, mirrored, or the padding.
export function cardTitleReserve(close: boolean): number {
  return close ? Math.max(CARD.padding, CLOSE_HIT_RIGHT + CARD.gap) : CARD.padding;
}

// The card's width: min(availableWidth, max(contentWidth + 32, viewportWidth / 2)), where
// contentWidth is the widest group or the title with its reserved clearance.
export function cardWidth(
  view: { readonly availableWidth: number; readonly viewportWidth: number },
  groupWidths: readonly number[],
  title: { readonly close: boolean; readonly width: number } | undefined,
): number {
  const headerWidth = title ? title.width + 2 * (cardTitleReserve(title.close) - CARD.padding) : 0;
  return modalWidth(view, Math.max(headerWidth, 0, ...groupWidths));
}

// A group's left edge in the card's inner width: centred.
export function groupX(innerWidth: number, width: number): number {
  return (innerWidth - width) / 2;
}

// A control row's width for its label and right-end control.
export function rowWidth(labelWidth: number, actionWidth: number): number {
  return ROW.icon + ROW.gap + labelWidth + ROW.gap + actionWidth;
}

// An action group's size: buttons of one shared width side by side 8px apart, or stacked 4px apart.
export function actionsWidth(axis: "row" | "stack", labelWidths: readonly number[]): number {
  if (labelWidths.length === 0) {
    return 0;
  }
  const button = Math.max(...labelWidths) + 2 * BUTTON_INSET;
  return axis === "row"
    ? labelWidths.length * button + (labelWidths.length - 1) * CARD.gap
    : button;
}

// Where the title and the first group start below the card's top: the gap from the title's ink to
// the first group's ink equals the gap from the frame's inner top edge to the title's ink, unless
// the close target's clearance pushes the first group lower.
export function cardHeaderLayout(
  close: boolean,
  firstInkTop: number | undefined,
  titleHeight: number | undefined,
): { readonly bodyTop: number; readonly titleTop: number } {
  const { frameBorder, gap, padding } = CARD;
  const closeClearance = close ? CLOSE_HIT_RIGHT + gap : 0;
  if (titleHeight === undefined) {
    return { bodyTop: close ? closeClearance : padding, titleTop: padding };
  }
  if (firstInkTop === undefined) {
    return {
      bodyTop: Math.max(padding + titleHeight, closeClearance - gap) + gap,
      titleTop: padding,
    };
  }
  const balanced = 2 * padding - frameBorder + titleHeight - firstInkTop;
  const bodyTop = Math.ceil(Math.max(balanced, closeClearance));
  return { bodyTop, titleTop: (bodyTop + firstInkTop + frameBorder - titleHeight) / 2 };
}
