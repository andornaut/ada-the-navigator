import type { Rect } from "@andornaut/game-kit/rect";

import {
  BALANCE,
  CARD_CONTENT,
  CONVERSATION_BOX,
  KEEPER_PIP,
  KEEPER_PIPS_WIDTH,
  SAFE_MARGIN,
  SPACING,
  TEXT_BUTTON,
  TYPE,
} from "../../data/layout.ts";
import { cardHeaderLayout } from "./cardFrame.ts";
import { conversationSpeakerLayout } from "./conversationBox.ts";
import { type Insets, safeRect, type Size } from "./playView.ts";

// The station card (art/layout.md "Station card"), in logical px: header, the balance, the
// keeper's block and the action row. The block is the conversation box's panel inside the card:
// its width, height, ink, portrait frame on the right and name tab, overhanging its top. On a
// first docking three pips follow the text column, which narrows to make room for them.

// A keeper's text column, beside the portrait frame on the panel's right.
const TEXT = conversationSpeakerLayout(true, "right", CONVERSATION_BOX.maxWidth).text;

export const KEEPER_BLOCK = {
  // Phantom's generic welcome: no portrait or tab, centred a gap inside each side.
  genericInset: CONVERSATION_BOX.noticeInset,
  height: CONVERSATION_BOX.height,
  // Static and decorative: shown lines filled cream, coming lines ringed.
  pips: { ...KEEPER_PIP, offset: SPACING.gap, width: KEEPER_PIPS_WIDTH },
  text: TEXT,
  // The text column while the pips show: the pips and their offset come out of it.
  textWithPips: TEXT.width - SPACING.gap - KEEPER_PIPS_WIDTH,
  width: CONVERSATION_BOX.maxWidth,
} as const;

/** Where the pips' first disc starts in the panel, and its top for a text of lineCount lines. */
export function keeperPips(lineCount: number): { readonly x: number; readonly y: number } {
  const lines = Math.min(Math.max(lineCount, 1), CONVERSATION_BOX.lines);
  const { lineHeight } = CONVERSATION_BOX.text;
  const textTop = (KEEPER_BLOCK.height - lines * lineHeight) / 2;
  return {
    x: TEXT.x + KEEPER_BLOCK.textWithPips + KEEPER_BLOCK.pips.offset,
    y: textTop + (lines - 1) * lineHeight + (lineHeight - KEEPER_PIP.disc) / 2,
  };
}

/**
 * The station card's height: the header, the balance line, a gap, the name tab's overhang and
 * the block, a gap, the action row and the padding below it.
 */
export function stationCardHeight(): number {
  const { bodyTop } = cardHeaderLayout(true, 0, TYPE.heading.lineHeight);
  return (
    bodyTop +
    BALANCE.line +
    CARD_CONTENT.gap +
    CONVERSATION_BOX.tab.overhang +
    KEEPER_BLOCK.height +
    CARD_CONTENT.gap +
    TEXT_BUTTON.height +
    CARD_CONTENT.padding
  );
}

/** The station card in the logical view: the block's width and padding, centred in the page rect. */
export function stationCardRect(insets: Insets, view: Size): Rect {
  return safeRect(insets, SAFE_MARGIN.page, view);
}
