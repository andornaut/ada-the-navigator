import type { Rect } from "@andornaut/game-kit/rect";

import { SCREEN } from "../../data/screen.ts";
import { HUD_BUTTON, hudRect, type Insets, SAFE_MARGIN, safeRect, type Size } from "./playView.ts";
import { STORY_PANEL } from "./storyPage.ts";
import { SPACING, TYPE } from "./tokens.ts";

// The in-flight conversation box (gameplay/prototype.md "Astra and Penny in flight"), in logical
// px. One compact line: a 48 portrait a gap inside the panel's side, and beside it a text column
// holding the speaker's name tab over the line, a row gap apart. Ada's portrait is on the left;
// Astra's, Penny's and the General's on the right, with the text column on the other side. The
// box is centred below the HUD row, at most the story panel's measure wide within the page safe
// rect, and keeps clear of Ada's ship.

const PORTRAIT = 48;

export const CONVERSATION_BOX = {
  // The box's height: the portrait and a gap above and below it.
  height: PORTRAIT + 2 * SPACING.gap,
  // Inside the panel, between the panel, the portrait and the text column.
  inset: SPACING.gap,
  maxWidth: STORY_PANEL.maxWidth,
  name: TYPE.label,
  // The ink panel, translucent so space shows through; text, tab and portrait stay opaque.
  panel: { alpha: 0.7, ink: "#181425" },
  portrait: PORTRAIT,
  rowGap: SPACING.rowGap,
  // Ada's ship at its display size (public/art/manifest.json), centred in the play view.
  ship: { centreY: SCREEN.height / 2, display: 42 },
  // Space kept clear between the box's bottom and the top of Ada's ship.
  shipClearance: 24,
  // The name tab's inset beside its label.
  tabInset: SPACING.markGap,
  text: TYPE.body,
  // Below the HUD row: a HUD button's target and a gap under the HUD rect's top.
  top: HUD_BUTTON.target + SPACING.gap,
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

/** The space between the box's bottom and the top of Ada's ship. */
export function conversationShipClearance(insets: Insets, view: Size): number {
  const box = conversationBoxRect(insets, view);
  const { centreY, display } = CONVERSATION_BOX.ship;
  return centreY - display / 2 - (box.y + box.height);
}

/** The portrait and the text column inside a box width wide, for the speaker's side. */
export function conversationSpeakerLayout(
  side: "left" | "right",
  width: number,
): { readonly portrait: Rect; readonly text: Rect } {
  const { height, inset, portrait } = CONVERSATION_BOX;
  const textWidth = width - portrait - 3 * inset;
  const left = side === "left";
  return {
    portrait: {
      height: portrait,
      width: portrait,
      x: left ? inset : width - inset - portrait,
      y: inset,
    },
    text: {
      height: height - 2 * inset,
      width: textWidth,
      x: left ? 2 * inset + portrait : inset,
      y: inset,
    },
  };
}
