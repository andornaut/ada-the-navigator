import { MODAL_CONTENT } from "@andornaut/game-kit/modalLayout";
import { HIT_RULE, hitAround, hitMargin, pressedArea } from "@andornaut/game-kit/ui/hitAreas";
import { describe, expect, it } from "vitest";

import { CARD_CONTENT } from "./cardFrame.ts";
import {
  BUTTON_SLICE,
  CONTROL_ROW,
  FOCUS_RING,
  PILL,
  TEXT_BUTTON,
  WHOLE_PX_EDGES,
} from "./controls.ts";
import { CONTROL_EDGE, SAFE_MARGIN } from "./playView.ts";
import { SPACING, TYPE } from "./tokens.ts";

// art/layout.md's token tables, value for value.
describe("layout tokens", () => {
  it("space rows, groups, columns, marks, pages and panels as art/layout.md sets them", () => {
    expect(SPACING).toEqual({
      columnGap: 8,
      gap: 8,
      markGap: 6,
      pageInset: 16,
      panelPadding: 16,
      rowGap: 4,
    });
    expect(SPACING.panelPadding).toBe(MODAL_CONTENT.padding);
    expect(CONTROL_EDGE).toBe(8);
    expect(SAFE_MARGIN).toEqual({ edge: 0, hud: 8, page: 16 });
  });

  it("set the heading, body, label and story roles, and the HUD count role", () => {
    expect(TYPE).toEqual({
      body: { lineHeight: 20, size: 16, weight: 400 },
      count: { lineHeight: 14, size: 12, weight: 700 },
      heading: { lineHeight: 28, size: 24, weight: 700 },
      label: { lineHeight: 20, size: 16, weight: 700 },
      story: { lineHeight: 26, size: 18, weight: 400 },
    });
  });

  it("size actions, compact faces, rows, focus and pills", () => {
    expect(TEXT_BUTTON).toEqual({
      compactHeight: 28,
      compactInset: 8,
      compactWidth: 72,
      height: 48,
      inset: 16,
      lipHeight: 4,
      pressedSink: 2,
      verticalInset: 12,
    });
    // A one-line label fills the 44 face with its 20 line box and 12 insets.
    expect(2 * TEXT_BUTTON.verticalInset + TYPE.label.lineHeight).toBe(
      TEXT_BUTTON.height - TEXT_BUTTON.lipHeight,
    );
    expect(CONTROL_ROW).toEqual({
      gap: 8,
      height: 48,
      icon: 16,
      switch: { height: 16, width: 32 },
      textInset: 4,
    });
    expect(FOCUS_RING.outset).toBe(4);
    expect(FOCUS_RING.fringe + FOCUS_RING.band + FOCUS_RING.fringe).toBe(FOCUS_RING.outset);
    expect(PILL).toMatchObject({ height: 28, padding: 8, radius: 4 });
    expect(WHOLE_PX_EDGES).toEqual([1, 2, 4, 6]);
    expect(BUTTON_SLICE).toEqual({ bottom: 6, left: 2, right: 2, top: 4 });
  });

  it("frame cards with Chibi's close and padding", () => {
    expect(CARD_CONTENT).toEqual({
      closeInset: 6,
      closeSize: 24,
      frameBorder: 2,
      gap: 8,
      lineHeight: 20,
      padding: 16,
      rowGap: 4,
    });
  });
});

describe("press areas", () => {
  it("grow a face by a quarter of its shorter side, clamped to 6..16, then to 48", () => {
    expect(HIT_RULE).toEqual({ leastMargin: 6, marginShare: 0.25, minTarget: 48, mostMargin: 16 });
    expect(hitMargin(HIT_RULE, { height: 24, width: 24, x: 0, y: 0 })).toBe(6);
    expect(hitMargin(HIT_RULE, { height: 48, width: 200, x: 0, y: 0 })).toBe(12);
    expect(hitMargin(HIT_RULE, { height: 100, width: 100, x: 0, y: 0 })).toBe(16);
    expect(hitAround(HIT_RULE, { height: 24, width: 24, x: 10, y: 10 })).toEqual({
      height: 48,
      width: 48,
      x: -2,
      y: -2,
    });
    expect(hitAround(HIT_RULE, { height: 48, width: 48, x: 0, y: 0 })).toEqual({
      height: 72,
      width: 72,
      x: -12,
      y: -12,
    });
  });

  it("give an overlapping press to the nearest drawn centre", () => {
    const a = { height: 48, width: 48, x: 0, y: 0 };
    const b = { height: 48, width: 48, x: 56, y: 0 };
    const areas = [
      { art: a, hit: hitAround(HIT_RULE, a), key: "a" },
      { art: b, hit: hitAround(HIT_RULE, b), key: "b" },
    ];
    expect(pressedArea(areas, { x: 50, y: 24 })).toBe("a");
    expect(pressedArea(areas, { x: 54, y: 24 })).toBe("b");
    expect(pressedArea(areas, { x: 200, y: 24 })).toBeUndefined();
  });
});
