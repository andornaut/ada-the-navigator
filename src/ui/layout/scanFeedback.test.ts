import { describe, expect, it } from "vitest";

import { hudRect, NO_INSETS, playView } from "./playView.ts";
import {
  SCAN_FEEDBACK,
  scanFeedbackArea,
  scanFeedbackPath,
  scanFeedbackRect,
  scanFeedbackTop,
} from "./scanFeedback.ts";
import { SPACING } from "./tokens.ts";
const context = {
  anchor: { x: 360, y: 240 },
  area: { height: 360, width: 720, x: 0, y: 0 },
  blocked: [],
  dialogue: [],
  height: 40,
  hudRow: [],
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
  it("ends the rise SPACING.gap under the HUD row with no conversation, in any column", () => {
    // Pause at the left end and a weapon count at the right: neither is in the start's column.
    const hudRow = [
      { height: 32, width: 32, x: 12, y: 12 },
      { height: 14, width: 40, x: 660, y: 40 },
    ];
    const path = scanFeedbackPath({ ...context, hudRow })!;
    expect(path.top).toBe(54 + SPACING.gap);
    expect(scanFeedbackRect({ ...context, hudRow, path, progress: 1 })!.y).toBe(62);
  });
  it("slides a clamped start along its nearest edge toward the centre until clear with room", () => {
    // The aim stick's target at the bottom right; the target lies off the right edge.
    const stick = { height: 75, width: 75, x: 595, y: 235 };
    const path = scanFeedbackPath({ ...context, anchor: { x: 700, y: 2000 }, blocked: [stick] })!;
    expect(path.from.x).toBe(520);
    expect(path.from.y).toBe(stick.y - SPACING.gap - context.height);
    expect(path.from.y - path.top).toBeGreaterThanOrEqual(SCAN_FEEDBACK.minRise);
  });
  it("slides along the bottom edge when that is the edge nearest the target", () => {
    const stick = { height: 75, width: 75, x: 595, y: 235 };
    const path = scanFeedbackPath({ ...context, anchor: { x: 760, y: 420 }, blocked: [stick] })!;
    expect(path.from.y).toBe(320);
    expect(path.from.x).toBe(stick.x - SPACING.gap - context.width);
  });
  it("takes the nearest place with room on the bottom edge when its own edge has none", () => {
    // A control just above the bottom-centred start leaves it less than minRise.
    const control = { height: 30, width: 60, x: 240, y: 240 };
    const path = scanFeedbackPath({ ...context, anchor: { x: 360, y: 2000 }, blocked: [control] })!;
    expect(path.from).toEqual({ height: 40, width: 200, x: 308, y: 320 });
    expect(path.from.y - path.top).toBeGreaterThanOrEqual(SCAN_FEEDBACK.minRise);
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
      const box = scanFeedbackPath({ ...context, anchor, blocked: controls })!.from;
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
    const path = scanFeedbackPath({ ...context, dialogue: [panel] })!;
    expect(path.from.y).toBe(panel.y + panel.height + SPACING.gap);
    expect(scanFeedbackTop(path, [panel])).toBe(path.from.y);
  });
  it("ends the rise SPACING.gap below a conversation box above the start, and only then", () => {
    const panel = { height: 60, width: 480, x: 120, y: 66 };
    const dialogue = [panel];
    const path = scanFeedbackPath({ ...context, dialogue })!;
    expect(scanFeedbackTop(path, dialogue)).toBe(panel.y + panel.height + SPACING.gap);
    for (let index = 0; index <= 20; index++) {
      const box = scanFeedbackRect({ ...context, dialogue, path, progress: index / 20 })!;
      expect(box.y).toBeGreaterThanOrEqual(panel.y + panel.height + SPACING.gap);
    }
    // Outside the column, or below the start, a box leaves the rise as it is.
    const aside = [{ height: 60, width: 100, x: 0, y: 66 }];
    expect(scanFeedbackTop(scanFeedbackPath({ ...context, dialogue: aside })!, aside)).toBe(0);
    const below = [{ height: 40, width: 480, x: 120, y: 300 }];
    expect(scanFeedbackTop(scanFeedbackPath({ ...context, dialogue: below })!, below)).toBe(0);
  });
  it("stops below a name tab above the start when the box itself is not above it", () => {
    const tab = { height: 20, width: 220, x: 260, y: 150 };
    const panel = { height: 30, width: 130, x: 120, y: 170 };
    const path = scanFeedbackPath({ ...context, dialogue: [tab, panel] })!;
    expect(path.from.y).toBe(220);
    expect(scanFeedbackTop(path, [tab, panel])).toBe(tab.y + tab.height + SPACING.gap);
  });
  it("places receipts in the HUD controls' rect, measured from the game area", () => {
    for (const view of [
      { height: 360, width: 720 },
      { height: 405, width: 720 },
      { height: 360, width: 800 },
    ]) {
      const hud = hudRect(NO_INSETS, view);
      expect(scanFeedbackArea(NO_INSETS, view)).toEqual({ ...hud, x: hud.x - playView(view).x });
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
