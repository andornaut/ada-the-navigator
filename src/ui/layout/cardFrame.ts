import { HIT_RULE, hitAround } from "@andornaut/game-kit/ui/hitAreas";

import { CARD_CLOSE_ART, CARD_CONTENT, TYPE, UI_FONT_FACE } from "../../data/layout.ts";

export { CARD_CONTENT, UI_FONT_FACE } from "../../data/layout.ts";

export const CARD_CLOSE = {
  art: CARD_CLOSE_ART,
  hit: hitAround(HIT_RULE, CARD_CLOSE_ART),
} as const;

// The title's clearance on each side: the full positioned close target plus a gap, mirrored, or
// the ordinary padding without a close control.
export function cardTitleReserve(close: boolean): number {
  return close
    ? Math.max(CARD_CONTENT.padding, CARD_CLOSE.hit.x + CARD_CLOSE.hit.width + CARD_CONTENT.gap)
    : CARD_CONTENT.padding;
}

// How far the cap height's top sits below the top of a CSS line box of a type role in the UI
// font: the half-leading, then the ascent above the cap height.
export function capTop(type: { readonly lineHeight: number; readonly size: number }): number {
  const { ascent, capHeight, descent } = UI_FONT_FACE;
  return (type.lineHeight - (ascent + descent) * type.size) / 2 + (ascent - capHeight) * type.size;
}

// A list card's header, as Chibi's Achievements card (art/layout.md "Achievements card"): the
// list starts a gap below the close target's press area, and the title's cap height sits midway
// between the frame's inner top edge and the cap top of the list's first line, of type `first`.
export function listCardHeader(first: { readonly lineHeight: number; readonly size: number }): {
  readonly bodyTop: number;
  readonly titleTop: number;
} {
  const bodyTop = CARD_CLOSE.hit.y + CARD_CLOSE.hit.height + CARD_CONTENT.gap;
  const middle = (CARD_CONTENT.frameBorder + bodyTop + capTop(first)) / 2;
  const heading = TYPE.heading;
  return {
    bodyTop,
    titleTop: middle - capTop(heading) - (UI_FONT_FACE.capHeight * heading.size) / 2,
  };
}

// Logical px a DOM measurement may read over its true size: layout snaps to 1/64 CSS px, well
// under this at every scale the game runs.
const MEASURE_SLACK = 0.05;

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
  // A 28 line box can measure a hair over 28; that much never rounds the first group a whole px
  // lower.
  const bodyTop = Math.ceil(Math.max(balanced, closeClearance) - MEASURE_SLACK);
  return { bodyTop, titleTop: (bodyTop + firstInkTop + frameBorder - titleHeight) / 2 };
}
