import { describe, expect, it } from "vitest";

import { CONVERSATION_BOX } from "../../data/layout.ts";
import { fromHudEdge } from "./css.ts";
import { STATUS_PILL } from "./playView.ts";
import { scanFeedbackSlot } from "./scanFeedback.ts";
import { SPACING } from "./tokens.ts";

const row = { bossBottom: 0, leftEnd: 170, rightStart: 580, unit: 1, width: 720 };

describe("top-centre scan notice slot", () => {
  it("aligns to the resource pill and leaves room for the nearer HUD group", () => {
    const slot = scanFeedbackSlot(row);
    expect(slot.top).toBe(fromHudEdge("top", STATUS_PILL.y));
    expect(slot.maxWidth).toContain(`${2 * (360 - 170 - SPACING.gap)}px`);
  });

  it("moves below the row if there is no centered strip wide enough for the notice", () => {
    const slot = scanFeedbackSlot({ ...row, rightStart: 390 });
    expect(slot.top).toBe(fromHudEdge("top", CONVERSATION_BOX.top));
    expect(slot.maxWidth).toContain(fromHudEdge("left"));
    expect(slot.maxWidth).toContain(fromHudEdge("right"));
  });

  it("keeps the visible boss bar in its slot and reserves a gap for the receipt below", () => {
    const slot = scanFeedbackSlot({ ...row, bossBottom: 60, unit: 2 });
    expect(slot.top).toBe(`max(${fromHudEdge("top", STATUS_PILL.y)}, ${60 + 2 * SPACING.gap}px)`);
  });
});
