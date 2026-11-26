import { CONVERSATION_BOX, SHIELD_PILL } from "../../data/layout.ts";
import { fromHudEdge, pixels, units } from "./css.ts";
import { STATUS_PILL } from "./playView.ts";
import { SPACING } from "./tokens.ts";

export interface ScanFeedbackSlot {
  readonly width: number;
  readonly leftEnd: number;
  readonly rightStart: number;
  readonly bossBottom: number;
  readonly unit: number;
}

/** Keep the panel centered, moving it below the HUD row when that row is full. */
export function scanFeedbackSlot({
  bossBottom,
  leftEnd,
  rightStart,
  unit,
  width,
}: ScanFeedbackSlot) {
  const center = width / 2;
  const gap = SPACING.gap * unit;
  const clearance = 2 * Math.max(0, Math.min(center - leftEnd - gap, rightStart - center - gap));
  const belowRow = clearance < SHIELD_PILL.bars[0] * unit;
  const top = fromHudEdge("top", belowRow ? CONVERSATION_BOX.top : STATUS_PILL.y);
  const safeWidth = `100% - ${fromHudEdge("left")} - ${fromHudEdge("right")}`;
  return {
    maxWidth: belowRow
      ? `min(${units(CONVERSATION_BOX.maxWidth)}, ${safeWidth})`
      : `min(${units(CONVERSATION_BOX.maxWidth)}, ${safeWidth}, ${pixels(clearance)})`,
    top: bossBottom > 0 ? `max(${top}, ${pixels(bossBottom + gap)})` : top,
  };
}
