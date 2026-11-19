import { describe, expect, it } from "vitest";

import { scanFeedbackPath, scanFeedbackRect } from "./scanFeedback.ts";
import { SPACING } from "./tokens.ts";
const context = {
  anchor: { x: 360, y: 240 },
  area: { height: 360, width: 720, x: 0, y: 0 },
  blocked: [],
  dialogue: [],
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
  it("chooses an initial position outside occupied HUD rectangles", () => {
    const blocked = [{ height: 80, width: 200, x: 260, y: 180 }];
    const box = scanFeedbackRect({ ...context, blocked })!;
    expect(
      box.x + box.width <= 260 || box.x >= 460 || box.y + box.height <= 180 || box.y >= 260,
    ).toBe(true);
    expect(box.y).toBeLessThanOrEqual(context.anchor.y);
  });
  it("rises continuously on one HUD-safe vertical corridor without jumping above an obstacle", () => {
    const blocked = [{ height: 50, width: 200, x: 260, y: 50 }];
    const path = scanFeedbackPath({ ...context, blocked })!;
    expect(path.from.x).toBe(260);
    expect(path.top).toBeGreaterThanOrEqual(100);
    let previous = path.from.y;
    for (let index = 0; index <= 100; index++) {
      const box = scanFeedbackRect({ ...context, blocked, path, progress: index / 100 })!;
      expect(box.x).toBe(path.from.x);
      expect(box.y).toBeLessThanOrEqual(previous);
      expect(box.y).toBeGreaterThanOrEqual(path.top);
      expect(box.y).toBeGreaterThanOrEqual(100);
      previous = box.y;
    }
  });
  it("clamps an offscreen anchor inside the area and clear of a grown touch control", () => {
    // The aim stick's 75 target grown by SPACING.gap, at the bottom right.
    const stick = { height: 91, width: 91, x: 587, y: 227 };
    const box = scanFeedbackRect({ ...context, anchor: { x: 2000, y: 2000 }, blocked: [stick] })!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(720);
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.y + box.height).toBeLessThanOrEqual(360);
    expect(
      box.x + box.width <= stick.x ||
        box.x >= stick.x + stick.width ||
        box.y + box.height <= stick.y ||
        box.y >= stick.y + stick.height,
    ).toBe(true);
  });
  it("ends the rise SPACING.gap below a conversation box above the start, and only then", () => {
    const panel = { height: 60, width: 480, x: 120, y: 66 };
    const dialogue = [panel];
    const path = scanFeedbackPath({ ...context, dialogue })!;
    expect(path.top).toBe(panel.y + panel.height + SPACING.gap);
    for (let index = 0; index <= 20; index++) {
      const box = scanFeedbackRect({ ...context, dialogue, path, progress: index / 20 })!;
      expect(box.y).toBeGreaterThanOrEqual(panel.y + panel.height + SPACING.gap);
    }
    // Outside the column, or below the start, a box leaves the rise as it is.
    const aside = [{ height: 60, width: 100, x: 0, y: 66 }];
    expect(scanFeedbackPath({ ...context, dialogue: aside })!.top).toBe(0);
    const below = [{ height: 40, width: 480, x: 120, y: 300 }];
    expect(scanFeedbackPath({ ...context, dialogue: below })!.top).toBe(0);
  });
  it("stops below a name tab above the start when the box itself is not above it", () => {
    const tab = { height: 20, width: 220, x: 260, y: 150 };
    const panel = { height: 60, width: 480, x: 120, y: 170 };
    const path = scanFeedbackPath({ ...context, dialogue: [tab, panel] })!;
    expect(path.from.y).toBe(220);
    expect(path.top).toBe(tab.y + tab.height + SPACING.gap);
  });
  it("stops below a conversation box shown after the path was chosen", () => {
    const path = scanFeedbackPath(context)!;
    expect(path.top).toBe(0);
    const dialogue = [{ height: 60, width: 480, x: 120, y: 66 }];
    expect(scanFeedbackRect({ ...context, dialogue, path, progress: 1 })!.y).toBe(
      66 + 60 + SPACING.gap,
    );
    expect(scanFeedbackRect({ ...context, path, progress: 1 })!.y).toBe(0);
  });
  it("retains a receipt when the entire viewport is covered or text cannot fit", () => {
    expect(scanFeedbackRect({ ...context, blocked: [context.area] })).toBeNull();
    expect(scanFeedbackRect({ ...context, width: 800 })).toBeNull();
  });
});
