import type { Rect } from "@andornaut/game-kit/rect";

import {
  HUD_BUTTON,
  hudRect,
  type Insets,
  playView,
  SAFE_MARGIN,
  safeRect,
  type Size,
} from "./playView.ts";
import { SPACING, TYPE } from "./tokens.ts";

// The in-flight conversation box (art/layout.md "Conversation box"), shared with Chibi, in logical
// px: a fixed 60 high panel, centred, at most 480 wide within the page safe rect. A 48 portrait
// slot in a 52 frame sits padding inside the panel, Ada's on the left and every other speaker's on
// the right. Beside it a text column, a gap from the frame and from the far edge, holds up to two
// left-aligned body lines centred on the panel. The 20 high name tab overhangs the panel's top by
// half its height at the end opposite the portrait. The tab top sits a clearance below the HUD
// button row, so every top button stays live.

const SLOT = 48;
const FRAME_EDGE = 2;
const FRAME = SLOT + 2 * FRAME_EDGE;
const PADDING = 4;
const TAB = { clearance: 10, edge: 1, height: 20, inset: SPACING.gap, overhang: 10, radius: 2 };

export const CONVERSATION_BOX = {
  height: FRAME + 2 * PADDING,
  // At most this many wrapped lines; the text never shrinks.
  lines: 2,
  maxWidth: 480,
  // The name tab's label, a mark gap inside each side of the tab.
  name: TYPE.label,
  // Notices: no portrait or tab, their lines centred a gap inside each side.
  noticeInset: SPACING.gap,
  padding: PADDING,
  // The ink panel, translucent so space shows through; text, tab and portrait stay opaque.
  panel: { alpha: 0.7, ink: "#181425" },
  // A 22 compact frame at 2x, centred in the navy slot inside the 2 ink frame edge.
  portrait: { art: 44, edge: FRAME_EDGE, face: "#262b44", frame: FRAME, slot: SLOT },
  // Ada's ship pivots on the play view's centre; its highest drawn hull point across the 32
  // headings (heading 4) is this far above the pivot.
  ship: { hullRise: 12.8 },
  // Space kept clear between the box's bottom and the top of Ada's ship.
  shipClearance: 24,
  tab: { ...TAB, labelInset: SPACING.markGap },
  text: TYPE.body,
  // The text column's gap from the portrait frame and from the panel's far edge.
  textGap: SPACING.gap,
  // From the HUD rect's top: the HUD button row, the tab clearance, then the tab's overhang.
  top: HUD_BUTTON.target + TAB.clearance + TAB.overhang,
} as const;

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

/** The name tab's top in the logical view: the HUD button row's bottom plus the tab clearance. */
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
 * wide, for the speaker's side. The tab anchors to the panel end opposite the portrait, inset
 * from it, and overhangs the panel's top; its width follows its label.
 */
export function conversationSpeakerLayout(
  side: "left" | "right",
  width: number,
): {
  readonly frame: Rect;
  readonly nameTab: { readonly end: "left" | "right"; readonly inset: number; readonly y: number };
  readonly slot: Rect;
  readonly text: Rect & { readonly align: "left" };
} {
  const { height, padding, portrait, tab, textGap } = CONVERSATION_BOX;
  const left = side === "left";
  const frameX = left ? padding : width - padding - portrait.frame;
  const textWidth = width - padding - portrait.frame - 2 * textGap;
  return {
    frame: { height: portrait.frame, width: portrait.frame, x: frameX, y: padding },
    nameTab: { end: left ? "right" : "left", inset: tab.inset, y: -tab.overhang },
    slot: {
      height: portrait.slot,
      width: portrait.slot,
      x: frameX + portrait.edge,
      y: padding + portrait.edge,
    },
    text: {
      align: "left",
      height: height - 2 * padding,
      width: textWidth,
      x: left ? padding + portrait.frame + textGap : textGap,
      y: padding,
    },
  };
}
