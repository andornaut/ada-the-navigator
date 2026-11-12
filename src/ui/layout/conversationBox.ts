import type { Rect } from "@andornaut/game-kit/rect";

import { CONVERSATION_BOX, SAFE_MARGIN } from "../../data/layout.ts";
import { hudRect, type Insets, playView, safeRect, type Size } from "./playView.ts";
export { CONVERSATION_BOX } from "../../data/layout.ts";

// The in-flight conversation box (art/layout.md "Conversation box"), shared with Chibi, in logical
// px: a fixed 60 high panel, centred, at most 480 wide within the page safe rect. A 48 portrait
// slot in a 52 frame sits padding inside the panel, Ada's on the left and every other speaker's on
// the right. Beside it a text column, a gap from the frame and from the far edge, holds up to two
// left-aligned body lines centred on the panel. The 20 high name tab overhangs the panel's top by
// half its height at the panel's left end. The box top sits a clearance below the weapon count
// pills, so every top button stays live.

/** The box in the logical view: centred, below the HUD rect's row, at most maxWidth within the page rect. */
export function conversationBoxRect(insets: Insets, view: Size): Rect {
  const page = safeRect(insets, SAFE_MARGIN.page, view);
  const hud = hudRect(insets, view);
  const width = Math.min(CONVERSATION_BOX.maxWidth, page.width);
  return {
    height: CONVERSATION_BOX.height,
    width,
    x: (view.width - width) / 2,
    y: hud.y + CONVERSATION_BOX.top,
  };
}

/** The name tab's top in the logical view: its overhang above the box's top. */
export function conversationTabTop(insets: Insets, view: Size): number {
  return conversationBoxRect(insets, view).y - CONVERSATION_BOX.tab.overhang;
}

/** The top of Ada's ship in the logical view: her pivot on the play view's centre, less the hull's rise. */
export function shipHullTop(view: Size): number {
  const play = playView(view);
  return play.y + play.height / 2 - CONVERSATION_BOX.ship.hullRise;
}

/** The space between the box's bottom and the top of Ada's ship. */
export function conversationShipClearance(insets: Insets, view: Size): number {
  const box = conversationBoxRect(insets, view);
  return shipHullTop(view) - (box.y + box.height);
}

/** The text block's top inside the box for lineCount lines: the lines centred on the panel. */
export function conversationTextTop(lineCount: number): number {
  const lines = Math.min(Math.max(lineCount, 1), CONVERSATION_BOX.lines);
  return (CONVERSATION_BOX.height - lines * CONVERSATION_BOX.text.lineHeight) / 2;
}

/**
 * The portrait frame, its slot, the text column and the name tab's anchor inside a box width
 * wide, for the speaker's side. Every tab anchors to the panel's left end and overhangs its top:
 * tab.inset in when the portrait is on the right or absent, and just past a left portrait frame
 * (Ada's, 64 in), so it sits over the text column's top-left; its width follows its label. A
 * speaker without a drawn portrait has no frame or slot, and its text column takes the slot's
 * width, textGap from each end of the panel.
 */
export function conversationSpeakerLayout(
  drawn: boolean,
  side: "left" | "right",
  width: number,
): {
  readonly frame: Rect | null;
  readonly nameTab: { readonly end: "left" | "right"; readonly inset: number; readonly y: number };
  readonly slot: Rect | null;
  readonly text: Rect & { readonly align: "left" };
} {
  const { height, padding, portrait, tab, textGap } = CONVERSATION_BOX;
  const left = side === "left";
  const frameX = left ? padding : width - padding - portrait.frame;
  const nameTab = {
    end: "left",
    inset: left && drawn ? padding + portrait.frame + textGap : tab.inset,
    y: -tab.overhang,
  } as const;
  const textBox = { align: "left", height: height - 2 * padding, y: padding } as const;
  if (!drawn) {
    return {
      frame: null,
      nameTab,
      slot: null,
      text: { ...textBox, width: width - 2 * textGap, x: textGap },
    };
  }
  return {
    frame: { height: portrait.frame, width: portrait.frame, x: frameX, y: padding },
    nameTab,
    slot: {
      height: portrait.slot,
      width: portrait.slot,
      x: frameX + portrait.edge,
      y: padding + portrait.edge,
    },
    text: {
      ...textBox,
      width: width - padding - portrait.frame - 2 * textGap,
      x: left ? padding + portrait.frame + textGap : textGap,
    },
  };
}
