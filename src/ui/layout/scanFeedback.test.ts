import { describe, expect, it } from "vitest";

import { hudRect, NO_INSETS, playView } from "./playView.ts";
import { scanFeedbackArea, scanFeedbackRect } from "./scanFeedback.ts";
import { SPACING } from "./tokens.ts";
const context = {
  anchor: { x: 360, y: 240 },
  area: { height: 360, width: 720, x: 0, y: 0 },
  blocked: [],
  dialogue: [],
  height: 40,
  width: 200,
};
describe("scan receipt placement", () => {
  it("places the notice at the actual projected object", () => {
    expect(scanFeedbackRect(context)).toEqual({ height: 40, width: 200, x: 260, y: 220 });
  });
  it("clamps an offscreen known anchor without inventing a different target", () => {
    expect(scanFeedbackRect({ ...context, anchor: { x: -500, y: 800 } })).toEqual({
      height: 40,
      width: 200,
      x: 0,
      y: 320,
    });
  });
  it("chooses an initial position outside occupied HUD rectangles", () => {
    const blocked = [{ height: 80, width: 200, x: 260, y: 180 }];
    const box = scanFeedbackRect({ ...context, blocked })!;
    expect(
      box.x + box.width <= 260 || box.x >= 460 || box.y + box.height <= 180 || box.y >= 260,
    ).toBe(true);
    expect(box.y).toBeLessThanOrEqual(context.anchor.y);
  });
  it("keeps a clamped notice on the nearest clear edge", () => {
    // The aim stick's target at the bottom right; the target lies off the right edge.
    const stick = { height: 75, width: 75, x: 595, y: 235 };
    const path = scanFeedbackRect({ ...context, anchor: { x: 700, y: 2000 }, blocked: [stick] })!;
    expect(path.x).toBe(520);
    expect(path.y).toBe(320);
  });
  it("slides along the bottom edge when that is the edge nearest the target", () => {
    const stick = { height: 95, width: 75, x: 595, y: 235 };
    const path = scanFeedbackRect({ ...context, anchor: { x: 760, y: 420 }, blocked: [stick] })!;
    expect(path.y).toBe(320);
    expect(path.x).toBe(stick.x - SPACING.gap - context.width);
  });
  it("keeps every start SPACING.gap clear of each control", () => {
    const controls = [
      { height: 75, width: 75, x: 50, y: 235 },
      { height: 75, width: 75, x: 595, y: 235 },
      { height: 75, width: 75, x: 518, y: 135 },
    ];
    for (const anchor of [
      { x: 2000, y: 2000 },
      { x: -500, y: 800 },
      { x: 560, y: 180 },
    ]) {
      const box = scanFeedbackRect({ ...context, anchor, blocked: controls })!;
      for (const control of controls) {
        expect(
          box.x + box.width <= control.x - SPACING.gap ||
            box.x >= control.x + control.width + SPACING.gap ||
            box.y + box.height <= control.y - SPACING.gap ||
            box.y >= control.y + control.height + SPACING.gap,
        ).toBe(true);
      }
    }
  });
  it("moves a start that would overlap the conversation box SPACING.gap below it", () => {
    const panel = { height: 60, width: 480, x: 120, y: 200 };
    const path = scanFeedbackRect({ ...context, dialogue: [panel] })!;
    expect(path.y).toBe(panel.y + panel.height + SPACING.gap);
  });
  it("places receipts in the HUD controls' rect, measured from the game area", () => {
    for (const view of [
      { height: 360, width: 720 },
      { height: 405, width: 720 },
      { height: 360, width: 800 },
    ]) {
      const hud = hudRect(NO_INSETS, view);
      const play = playView(view);
      expect(scanFeedbackArea(NO_INSETS, view)).toEqual({
        ...hud,
        x: hud.x - play.x,
        y: hud.y - play.y,
      });
    }
    expect(scanFeedbackArea(NO_INSETS, { height: 360, width: 800 })).toEqual({
      height: 336,
      width: 696,
      x: 12,
      y: 12,
    });
  });
  it("retains a receipt when the entire viewport is covered or text cannot fit", () => {
    expect(scanFeedbackRect({ ...context, blocked: [context.area] })).toBeNull();
    expect(scanFeedbackRect({ ...context, width: 800 })).toBeNull();
  });
});
