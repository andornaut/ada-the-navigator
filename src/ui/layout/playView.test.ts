import type { Rect } from "@andornaut/game-kit/rect";
import { describe, expect, it } from "vitest";

import { TEXT_BUTTON } from "./controls.ts";
import { fromSafeEdge, safeEdge, slice, units, VIEW_PROPERTIES } from "./css.ts";
import { HIT_RULE, hitAround } from "./hitAreas.ts";
import {
  CONTROL_EDGE,
  HUD_BUTTON,
  HUD_BUTTON_INSET,
  hudButtonTarget,
  hudRect,
  hudRowWidth,
  type Insets,
  logicalView,
  NO_INSETS,
  noticeReserve,
  PAUSE_BUTTON,
  playView,
  SAFE_MARGIN,
  safeInsets,
  safeRect,
  SHIELD_BAR,
  STARDUST_PILL,
  stardustPillRight,
  viewScale,
} from "./playView.ts";
import { SPACING, TYPE } from "./tokens.ts";
import { stickRestCentres, stickTargets, TOUCH_STICK, USE_BUTTON } from "./touchControls.ts";
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

describe("HUD rect", () => {
  const phoneView = logicalView({ height: 390, width: 844 });
  const edges = (rect: Rect) => ({ left: rect.x, right: rect.x + rect.width, top: rect.y });

  it("centres Chibi's 720x360 play view across the logical view, at its top", () => {
    expect(playView(phoneView)).toEqual({ height: 360, width: 720, x: 29, y: 0 });
    expect(playView({ height: 405, width: 720 })).toEqual({ height: 360, width: 720, x: 0, y: 0 });
  });

  it.each([
    [844, 390, NO_INSETS, { left: 37, right: 741, top: 8 }],
    [844, 390, { bottom: 0, left: 43, right: 43, top: 0 }, { left: 43, right: 736.08, top: 8 }],
    [1280, 720, NO_INSETS, { left: 8, right: 712, top: 8 }],
    [1920, 1080, NO_INSETS, { left: 8, right: 712, top: 8 }],
  ])("at %ix%i with insets %o has the edges %o", (width, height, insets, expected) => {
    const rect = edges(hudRect(insets, logicalView({ height, width })));
    expect(rect.left).toBeCloseTo(expected.left, 2);
    expect(rect.right).toBeCloseTo(expected.right, 2);
    expect(rect.top).toBe(expected.top);
  });

  it("gives the bridge the HUD rect's edges in CSS px", () => {
    const layout = playLayout({ height: 390, width: 844 }, NO_INSETS);
    const properties = new Map(viewProperties(layout));
    expect(parseFloat(properties.get(VIEW_PROPERTIES.hud("left"))!)).toBeCloseTo(37 * layout.s, 6);
    expect(parseFloat(properties.get(VIEW_PROPERTIES.hud("right"))!)).toBeCloseTo(
      (layout.view.width - 741) * layout.s,
      6,
    );
    expect(parseFloat(properties.get(VIEW_PROPERTIES.hud("top"))!)).toBeCloseTo(8 * layout.s, 6);
  });
});

describe("HUD anchors", () => {
  const view = logicalView({ height: 390, width: 844 });
  const phone: Insets = { bottom: 19, left: 43, right: 43, top: 0 };
  // The pause frame and weapon targets lie inside the play view inset by CONTROL_EDGE.
  for (const [name, insets] of [
    ["no insets", NO_INSETS],
    ["phone insets", phone],
  ] as const) {
    const hud = hudRect(insets, view);
    const play = playView(view);
    const bounds: Rect = {
      height: play.height - 2 * CONTROL_EDGE,
      width: play.width - 2 * CONTROL_EDGE,
      x: play.x + CONTROL_EDGE,
      y: play.y + CONTROL_EDGE,
    };
    const fromLeft = (rect: Rect): Rect => ({ ...rect, x: hud.x + rect.x, y: hud.y + rect.y });
    const fromRight = (rect: Rect): Rect => ({
      ...rect,
      x: hud.x + hud.width + rect.x,
      y: hud.y + rect.y,
    });
    const inside = (rect: Rect, outer: Rect) =>
      rect.x >= outer.x &&
      rect.y >= outer.y &&
      rect.x + rect.width <= outer.x + outer.width &&
      rect.y + rect.height <= outer.y + outer.height;

    it(`with ${name}, put the pause disc's edge on the HUD rect's corner in a 52.5 press area`, () => {
      expect(PAUSE_BUTTON.art).toEqual({ height: 35, width: 35, x: -1, y: -1 });
      expect(PAUSE_BUTTON.hit.width).toBe(52.5);
      expect(inside(fromLeft({ height: 33, width: 33, x: 0, y: 0 }), bounds)).toBe(true);
      expect(
        inside(fromLeft({ height: 33, width: 33, x: 0, y: 0 }), safeRect(insets, 8, view)),
      ).toBe(true);
    });

    it(`with ${name}, pack four weapon targets 8 apart against the HUD rect's corner`, () => {
      for (const index of [0, 1, 2, 3]) {
        const target = fromRight(hudButtonTarget(index));
        expect(target.x).toBeCloseTo(hud.x + hud.width - 48 - 56 * index, 9);
        expect(target.y).toBe(hud.y);
        expect(inside(target, bounds)).toBe(true);
      }
      const pause = fromLeft(PAUSE_BUTTON.hit);
      const leftmost = fromRight(hudButtonTarget(3));
      expect(leftmost.x - (pause.x + pause.width)).toBeGreaterThanOrEqual(SPACING.pageInset);
    });
  }

  it("draw Chibi's skill button: a 48 target, a 33 disc at 7.5, a 4 annulus and a 20 glyph at 14", () => {
    expect(HUD_BUTTON).toEqual({ annulus: 4, disc: 33, edge: 1, gap: 8, glyph: 20, target: 48 });
    expect(HUD_BUTTON.target).toBe(HIT_RULE.minTarget);
    expect(HUD_BUTTON_INSET).toEqual({ disc: 7.5, glyph: 14 });
    expect(hudRowWidth(3)).toBe(3 * 48 + 2 * 8);
  });

  it("put the Stardust pill a gap left of the weapon targets, centred on their row", () => {
    expect(stardustPillRight(3)).toBe(3 * 48 + 2 * 8 + 8);
    expect(stardustPillRight(0)).toBe(0);
    expect(STARDUST_PILL.top).toBe(10);
    expect(STARDUST_PILL.pill).toMatchObject({ height: 28, padding: 8, radius: 4 });
  });

  it("keep a notice clear of the pause press area, the weapon targets and the pill by a gap", () => {
    expect(noticeReserve(0)).toBe(PAUSE_BUTTON.hit.x + PAUSE_BUTTON.hit.width + SPACING.gap);
    expect(noticeReserve(4)).toBe(4 * 48 + 3 * 8 + SPACING.gap);
    expect(noticeReserve(2, 60)).toBe(2 * 48 + 8 + 8 + 60 + SPACING.gap);
  });
});

describe("touch controls", () => {
  const view = { height: 360, width: 720 };

  // A ring's drawn edges in the view: its frame is drawn 1 inside the 75 frame.
  const ringEdges = (centre: { x: number; y: number }) => ({
    bottom: centre.y + 37,
    left: centre.x - 36,
    right: centre.x + 37,
  });

  it("rest the rings' drawn edges max(24, inset) from the sides and 24 above the safe bottom", () => {
    expect(stickRestCentres(view, NO_INSETS)).toEqual({
      aim: { x: 659, y: 299 },
      move: { x: 60, y: 299 },
    });
    // A wider, deeper view keeps them on its own edges, not a centred 720 view.
    expect(stickRestCentres({ height: 400, width: 900 }, NO_INSETS)).toEqual({
      aim: { x: 839, y: 339 },
      move: { x: 60, y: 339 },
    });
    const clear = stickRestCentres(view, { bottom: 30, left: 90, right: 100, top: 0 });
    expect(ringEdges(clear.move).left).toBe(90);
    expect(720 - ringEdges(clear.aim).right).toBe(100);
    expect(360 - 30 - ringEdges(clear.move).bottom).toBe(TOUCH_STICK.bottom);
    expect(TOUCH_STICK).toMatchObject({
      bottom: 24,
      frame: 75,
      knobReach: 12,
      moveDeadZone: 2.4,
      moveReach: 40,
      side: 24,
    });
  });

  it.each([
    ["no insets", NO_INSETS],
    ["phone insets", phone],
  ] as const)("clear the shield bar by 21 with %s", (_, insets) => {
    const shieldTop = view.height - insets.bottom - SHIELD_BAR.height;
    const { move } = stickRestCentres(view, insets);
    expect(shieldTop - ringEdges(move).bottom).toBe(21);
  });

  it("keep the Use button's press area clear of both rings at the 720 minimum width", () => {
    for (const insets of [NO_INSETS, phone]) {
      const { aim, move } = stickRestCentres(view, insets);
      const rect = safeRect(insets, USE_BUTTON.margin, view);
      const centre = rect.x + rect.width / 2;
      // The widest Use face whose press area still clears both rings.
      const widest =
        2 * Math.min(centre - ringEdges(move).right, ringEdges(aim).left - centre) -
        2 * USE_BUTTON.pressMargin;
      expect(widest).toBeGreaterThanOrEqual(400);
      // Its bottom sits level with the rings' drawn bottom.
      expect(view.height - insets.bottom - USE_BUTTON.bottom).toBe(ringEdges(move).bottom);
    }
  });

  it("give the Use button an action-high HUD face level with the sticks, in a hitAround area", () => {
    expect(USE_BUTTON).toMatchObject({
      border: 2,
      bottom: TOUCH_STICK.bottom,
      height: TEXT_BUTTON.height,
      inset: TEXT_BUTTON.inset,
      margin: CONTROL_EDGE,
      radius: 8,
      text: TYPE.label,
    });
    // Any face at least as wide as it is high grows by the same margin on every side.
    for (const width of [USE_BUTTON.minWidth, 80, 200]) {
      const face = { height: USE_BUTTON.height, width, x: 0, y: 0 };
      expect(hitAround(face)).toEqual({
        height: face.height + 2 * USE_BUTTON.pressMargin,
        width: face.width + 2 * USE_BUTTON.pressMargin,
        x: -USE_BUTTON.pressMargin,
        y: -USE_BUTTON.pressMargin,
      });
    }
    expect(USE_BUTTON.pressMargin).toBe(12);
  });

  it("put each stick's DOM target over its ring's frame", () => {
    expect(stickTargets(view, NO_INSETS).move).toEqual({ height: 75, width: 75, x: 23, y: 262 });
  });
});
