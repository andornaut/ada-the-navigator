import { MODAL_CONTENT } from "@andornaut/game-kit/modalLayout";
import type { Rect } from "@andornaut/game-kit/rect";

import { CARD_SLICE } from "./controls.ts";
import { hitAround } from "./hitAreas.ts";
import { SPACING, TYPE } from "./tokens.ts";

// The modal card's frame and header (art/layout.md "Modals"), as Chibi's
// src/ui/layout/cardFrame.ts, in logical px.
export const CARD_CONTENT = {
  closeInset: 6,
  closeSize: 24,
  // The frame's nine-slice edge, counted inside the padding; a title's top gap is measured inside
  // it.
  frameBorder: CARD_SLICE,
  gap: SPACING.gap,
  lineHeight: TYPE.body.lineHeight,
  padding: MODAL_CONTENT.padding,
  rowGap: SPACING.rowGap,
} as const;

// The close X's face, closeInset in from the card's top and right edges (x measured in from the
// right edge), and its press area: hitAround(face), which may extend past the card.
const CLOSE_ART: Rect = {
  height: CARD_CONTENT.closeSize,
  width: CARD_CONTENT.closeSize,
  x: CARD_CONTENT.closeInset,
  y: CARD_CONTENT.closeInset,
};

export const CARD_CLOSE = { art: CLOSE_ART, hit: hitAround(CLOSE_ART) } as const;

// The title's clearance on each side: the full positioned close target plus a gap, mirrored, or
// the ordinary padding without a close control.
export function cardTitleReserve(close: boolean): number {
  return close
    ? Math.max(CARD_CONTENT.padding, CARD_CLOSE.hit.x + CARD_CLOSE.hit.width + CARD_CONTENT.gap)
    : CARD_CONTENT.padding;
}

// Where the title and the first group start below the card's top: the gap from the title to the
// first group equals the gap from the frame's inner top edge to the title, unless the close
// target's clearance pushes the first group lower. DOM measures line boxes, so firstInkTop is
// the distance from the first group's top to its first visible content.
export function cardHeaderLayout(
  close: boolean,
  firstInkTop: number | undefined,
  titleHeight: number | undefined,
): { readonly bodyTop: number; readonly titleTop: number } {
  const { frameBorder, gap, padding } = CARD_CONTENT;
  const closeClearance = close ? CARD_CLOSE.hit.y + CARD_CLOSE.hit.height + gap : 0;
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
