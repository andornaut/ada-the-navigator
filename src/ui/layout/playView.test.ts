import type { Rect } from "@andornaut/game-kit/rect";
import { describe, expect, it } from "vitest";

import { TEXT_BUTTON } from "./controls.ts";
import { fromSafeEdge, safeEdge, slice, units } from "./css.ts";
import { hitAround } from "./hitAreas.ts";
import {
  CONTROL_EDGE,
  HUD_BUTTON,
  hudButtonFace,
  type Insets,
  logicalView,
  NO_INSETS,
  noticeReserve,
  PAUSE_BUTTON,
  SAFE_MARGIN,
  safeInsets,
  safeRect,
  SHIELD_BAR,
  STARDUST_PILL,
  stardustPillRight,
  viewScale,
} from "./playView.ts";
import { SPACING } from "./tokens.ts";
import { stickRestCentres, stickTargets, TOUCH_STICK } from "./touchControls.ts";
import { playLayout, uncoveredInsets, viewProperties } from "./viewScale.ts";

describe("view scale", () => {
  it.each([
    [844, 390, 1.0833, 779.08, 360, 52],
    [1280, 720, 1.7778, 720, 405, 85.33],
    [1440, 900, 2, 720, 450, 96],
    [1920, 1080, 2.6667, 720, 405, 128],
    // An EXPAND-wide screen widens the logical view instead.
    [1600, 600, 1.6667, 960, 360, 80],
  ])("at %sx%s is s %s, a %sx%s logical view and a %s CSS px button", (w, h, s, lw, lh, button) => {
    const css = { height: h, width: w };
    expect(viewScale(css)).toBeCloseTo(s, 4);
    expect(logicalView(css).width).toBeCloseTo(lw, 2);
    expect(logicalView(css).height).toBeCloseTo(lh, 2);
    expect(TEXT_BUTTON.height * viewScale(css)).toBeCloseTo(button, 2);
  });

  it("is never smaller than the 720x360 base view", () => {
    for (const css of [
      { height: 390, width: 844 },
      { height: 768, width: 1024 },
      { height: 300, width: 1200 },
    ]) {
      const view = logicalView(css);
      expect(view.width).toBeGreaterThanOrEqual(720 - 1e-9);
      expect(view.height).toBeGreaterThanOrEqual(360 - 1e-9);
    }
  });

  it("gives the DOM s as --ada-unit, the CSS px insets and whole-pixel nine-slice edges", () => {
    const layout = playLayout(
      { height: 390, width: 844 },
      { bottom: 21, left: 47, right: 47, top: 0 },
    );
    expect(layout.insets.left).toBeCloseTo(47 / (390 / 360), 9);
    expect(layout.slices[2]).toBe(2);
    expect(layout.slices[4]).toBe(4);
    expect(Object.fromEntries(viewProperties(layout))).toMatchObject({
      "--ada-safe-left": "47px",
      "--ada-slice-4": "4px",
      "--ada-unit": String(layout.s),
    });
    expect(playLayout({ height: 720, width: 1280 }, NO_INSETS).slices).toEqual({
      2: 4,
      4: 7,
      6: 11,
    });
  });

  it("writes logical sizes as calc(var(--ada-unit) * N), never raw px", () => {
    expect(units(48)).toBe("calc(var(--ada-unit) * 48px)");
    expect(units(0)).toBe("0px");
    expect(safeEdge("bottom", 0)).toBe("max(var(--ada-safe-bottom), 0px)");
    expect(safeEdge("top", 8)).toBe("max(var(--ada-safe-top), calc(var(--ada-unit) * 8px))");
    expect(fromSafeEdge("left", 8, -1.75)).toBe(
      "calc(max(var(--ada-safe-left), calc(var(--ada-unit) * 8px)) + var(--ada-unit) * -1.75px)",
    );
    expect(slice(2)).toBe("var(--ada-slice-2)");
  });
});

describe("safe-margin clamp", () => {
  const view = { height: 360, width: 720 };
  const phone: Insets = { bottom: 19, left: 43, right: 43, top: 0 };

  it("moves each edge in by the larger of the margin and the inset", () => {
    expect(safeRect(NO_INSETS, CONTROL_EDGE, view)).toEqual({
      height: 344,
      width: 704,
      x: 8,
      y: 8,
    });
    expect(safeRect(phone, CONTROL_EDGE, view)).toEqual({ height: 333, width: 634, x: 43, y: 8 });
    expect(safeRect(phone, SAFE_MARGIN.page, view)).toEqual({
      height: 325,
      width: 634,
      x: 43,
      y: 16,
    });
    expect(safeRect(phone, SHIELD_BAR.margin, view)).toEqual({
      height: 341,
      width: 634,
      x: 43,
      y: 0,
    });
  });

  it("reads CSS px insets as logical px at s", () => {
    expect(safeInsets({ bottom: 21, left: 47, right: 47, top: 0 }, 1.0833)).toEqual({
      bottom: 21 / 1.0833,
      left: 47 / 1.0833,
      right: 47 / 1.0833,
      top: 0,
    });
  });

  it("counts only insets the page frame does not already keep clear", () => {
    expect(
      uncoveredInsets({ bottom: 21, left: 47, right: 47, top: 20 }, { ...NO_INSETS, top: 20 }),
    ).toEqual({ bottom: 21, left: 47, right: 47, top: 0 });
  });
});

describe("HUD anchors", () => {
  const view = { height: 360, width: 720 };
  const phone: Insets = { bottom: 19, left: 43, right: 43, top: 0 };
  const hud = safeRect(phone, CONTROL_EDGE, view);
  // A rect relative to the HUD safe rect's top-left or top-right corner, in the view.
  const fromLeft = (rect: Rect): Rect => ({ ...rect, x: hud.x + rect.x, y: hud.y + rect.y });
  const fromRight = (rect: Rect): Rect => ({
    ...rect,
    x: hud.x + hud.width + rect.x,
    y: hud.y + rect.y,
  });
  const inside = (rect: Rect, bounds: Rect) =>
    rect.x >= bounds.x &&
    rect.y >= bounds.y &&
    rect.x + rect.width <= bounds.x + bounds.width &&
    rect.y + rect.height <= bounds.y + bounds.height;

  it("put the pause disc's edge on the top-left corner in a 52.5 press area", () => {
    expect(PAUSE_BUTTON.art).toEqual({ height: 35, width: 35, x: -1, y: -1 });
    expect(PAUSE_BUTTON.hit).toEqual(hitAround(PAUSE_BUTTON.art));
    expect(PAUSE_BUTTON.hit.width).toBe(52.5);
    const disc = { height: 33, width: 33, x: 0, y: 0 };
    expect(inside(fromLeft(disc), hud)).toBe(true);
  });

  it("right-align the weapon faces a gap apart, each in a 72 press area", () => {
    expect(HUD_BUTTON.hit.width).toBe(72);
    expect(hudButtonFace(0)).toEqual({ height: 48, width: 48, x: -48, y: 0 });
    expect(hudButtonFace(1).x).toBe(-48 - SPACING.gap - 48);
    for (const index of [0, 1, 2, 3]) {
      expect(inside(fromRight(hudButtonFace(index)), hud)).toBe(true);
    }
  });

  it("keep the pause and four weapons' press areas a page inset apart at 720 with insets", () => {
    const pause = fromLeft(PAUSE_BUTTON.hit);
    const leftmost = fromRight(hitAround(hudButtonFace(3)));
    expect(leftmost.x - (pause.x + pause.width)).toBeGreaterThanOrEqual(SPACING.pageInset);
  });

  it("put the Stardust pill a gap left of the weapons, centred on their row", () => {
    expect(stardustPillRight(3)).toBe(3 * 48 + 2 * 8 + 8);
    expect(stardustPillRight(0)).toBe(0);
    expect(STARDUST_PILL.top + STARDUST_PILL.pill.height / 2).toBe(HUD_BUTTON.size / 2);
    expect(STARDUST_PILL.pill).toMatchObject({ height: 28, padding: 8, radius: 4 });
  });

  it("keep a notice clear of the pause and weapon press areas by a gap", () => {
    expect(noticeReserve(0)).toBe(PAUSE_BUTTON.hit.x + PAUSE_BUTTON.hit.width + SPACING.gap);
    expect(noticeReserve(4)).toBe(4 * 48 + 3 * 8 + 12 + SPACING.gap);
  });

  it("rest the sticks' drawn edges max(85, inset) in and max(20, inset) up", () => {
    expect(stickRestCentres(view, NO_INSETS)).toEqual({
      aim: { x: 598, y: 303 },
      move: { x: 121, y: 303 },
    });
    // A wider, deeper view keeps them on its own edges, not a centred 720 view.
    expect(stickRestCentres({ height: 400, width: 900 }, NO_INSETS)).toEqual({
      aim: { x: 778, y: 343 },
      move: { x: 121, y: 343 },
    });
    const clear = stickRestCentres(view, { bottom: 30, left: 90, right: 100, top: 0 });
    expect(clear.move.x - 36).toBe(90);
    expect(719 - (clear.aim.x + 36)).toBe(100);
    expect(359 - (clear.move.y + 36)).toBe(30);
    expect(TOUCH_STICK).toMatchObject({ bottom: 20, frame: 75, knobReach: 12, side: 85 });
  });

  it("put each stick's DOM target over its ring's frame", () => {
    expect(stickTargets(view, NO_INSETS).move).toEqual({ height: 75, width: 75, x: 84, y: 266 });
  });
});
