import { MODAL_CONTENT } from "@andornaut/game-kit/modalLayout";
import type { Rect } from "@andornaut/game-kit/rect";
import { HIT_RULE, hitAround } from "@andornaut/game-kit/ui/hitAreas";

import { CARD_SLICE } from "./controls.ts";
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

export const CARD_CLOSE = { art: CLOSE_ART, hit: hitAround(HIT_RULE, CLOSE_ART) } as const;

// The title's clearance on each side: the full positioned close target plus a gap, mirrored, or
// the ordinary padding without a close control.
export function cardTitleReserve(close: boolean): number {
  return close
    ? Math.max(CARD_CONTENT.padding, CARD_CLOSE.hit.x + CARD_CLOSE.hit.width + CARD_CONTENT.gap)
    : CARD_CONTENT.padding;
}

// art: Liberation Sans's vertical metrics in both weights, as fractions of the font size.
export const UI_FONT_FACE = {
  ascent: 1854 / 2048,
  capHeight: 1409 / 2048,
  descent: 434 / 2048,
} as const;

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
