import { describe, expect, it } from "vitest";

import { scanFeedbackRect } from "./scanFeedback.ts";

const context = {
  anchor: { x: 360, y: 240 },
  area: { height: 360, width: 720, x: 0, y: 0 },
  blocked: [],
  height: 40,
  progress: 0,
  reducedMotion: false,
  width: 200,
};
describe("scan receipt placement", () => {
  it("starts on the actual projected object and moves toward the top", () => {
    expect(scanFeedbackRect(context)).toEqual({ height: 40, width: 200, x: 260, y: 220 });
    expect(scanFeedbackRect({ ...context, progress: 1 })?.y).toBe(0);
  });
  it("clamps an offscreen known anchor without inventing a different target", () => {
    expect(scanFeedbackRect({ ...context, anchor: { x: -500, y: 800 } })).toEqual({
      height: 40,
      width: 200,
      x: 0,
      y: 320,
    });
  });
  it("uses static placement under reduced motion", () => {
    expect(scanFeedbackRect({ ...context, progress: 1, reducedMotion: true })).toEqual(
      scanFeedbackRect(context),
    );
  });
  it("avoids occupied HUD and dialogue rectangles without reserving entire bands", () => {
    const blocked = [{ height: 80, width: 200, x: 260, y: 180 }];
    const box = scanFeedbackRect({ ...context, blocked })!;
    expect(
      box.x + box.width <= 260 || box.x >= 460 || box.y + box.height <= 180 || box.y >= 260,
    ).toBe(true);
    expect(box.y).toBeLessThanOrEqual(context.anchor.y);
  });
  it("retains a receipt when the entire viewport is covered or text cannot fit", () => {
    expect(scanFeedbackRect({ ...context, blocked: [context.area] })).toBeNull();
    expect(scanFeedbackRect({ ...context, width: 800 })).toBeNull();
  });
});
