import type { Rect } from "@andornaut/game-kit/rect";
import { describe, expect, it } from "vitest";

import { PILL, TEXT_BUTTON } from "./controls.ts";
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
  PAUSE_BUTTON,
  playView,
  SAFE_MARGIN,
  safeInsets,
  safeRect,
  STATUS_PILL,
  statusPillWidth,
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

  it("gives the DOM s as --ada-unit, the CSS px insets and whole-pixel drawn edges", () => {
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
    expect(layout.slices[1]).toBe(1);
    expect(playLayout({ height: 720, width: 1280 }, NO_INSETS).slices).toEqual({
      1: 2,
      2: 4,
      4: 7,
      6: 11,
    });
    // The galaxy preview's 1 px frame at 1.78x and 2.67x: round(1 * s) whole CSS px.
    expect(playLayout({ height: 1080, width: 1920 }, NO_INSETS).slices[1]).toBe(3);
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
    expect(safeRect(phone, SAFE_MARGIN.edge, view)).toEqual({
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

  it("put the status pill a gap right of the pause press area, centred on the pause disc", () => {
    const pauseRight = PAUSE_BUTTON.hit.x + PAUSE_BUTTON.hit.width;
    expect(STATUS_PILL.x).toBe(pauseRight + SPACING.gap);
    expect(STATUS_PILL.x).toBe(50.75);
    const discCentre = PAUSE_BUTTON.art.y + PAUSE_BUTTON.art.height / 2;
    expect(STATUS_PILL.y + STATUS_PILL.pill.height / 2).toBe(discCentre);
    expect(STATUS_PILL.y).toBe(2.5);
    expect(STATUS_PILL.pill).toEqual(PILL);
    // The +N tick's line box a row gap below the pill: HUD rect top + 34.5.
    expect(STATUS_PILL.y + STATUS_PILL.tick.top).toBe(34.5);
  });

  it("measure the pill as 189 plus the count, 215.70 at 125 and 237.94 at 12,500", () => {
    expect(statusPillWidth(0)).toBe(189);
    expect(statusPillWidth(26.7)).toBeCloseTo(215.7, 9);
    expect(statusPillWidth(48.94)).toBeCloseTo(237.94, 9);
    expect(STATUS_PILL.bar).toEqual({
      fill: { height: 8, width: 92 },
      height: 12,
      inset: 2,
      rim: 1,
      width: 96,
    });
    expect(STATUS_PILL.bar.width - 2 * STATUS_PILL.bar.inset).toBe(STATUS_PILL.bar.fill.width);
  });

  it("keep the pill at a 162.25 count a page inset from four weapons at 720 with phone insets", () => {
    const view = { height: 360, width: 720 };
    const hud = hudRect({ bottom: 19, left: 43, right: 43, top: 0 }, view);
    const pillRight = hud.x + STATUS_PILL.x + statusPillWidth(162.25);
    const leftmost = hud.x + hud.width + hudButtonTarget(3).x;
    expect(leftmost - pillRight).toBe(SPACING.pageInset);
  });
});

// Every screen the game draws on, CSS px: the user's wide phone (about 2000x899 device px at DPR
// 2.6), 2.22:1 (2400x1080), 2:1, 16:9 at 1280x720 and 1920x1080, a notched phone and 4:3.
const SCREENS = [
  { height: 346, width: 769 },
  { height: 1080, width: 2400 },
  { height: 360, width: 720 },
  { height: 720, width: 1280 },
  { height: 1080, width: 1920 },
  { height: 390, width: 844 },
  { height: 768, width: 1024 },
] as const;
const contains = (outer: Rect, rect: Rect) =>
  rect.x >= outer.x - 1e-9 &&
  rect.y >= outer.y - 1e-9 &&
  rect.x + rect.width <= outer.x + outer.width + 1e-9 &&
  rect.y + rect.height <= outer.y + outer.height + 1e-9;

describe.each(SCREENS)("every control inside the game area at %o", (screen) => {
  const view = logicalView(screen);
  const area = playView(view);
  // Insets in logical px: none, and a notched phone held landscape.
  for (const [name, insets] of [
    ["no insets", NO_INSETS],
    ["phone insets", { bottom: 19, left: 43, right: 43, top: 0 }],
  ] as const) {
    const hud = hudRect(insets, view);
    const fromLeft = (rect: Rect): Rect => ({ ...rect, x: hud.x + rect.x, y: hud.y + rect.y });
    const fromRight = (rect: Rect): Rect => ({
      ...rect,
      x: hud.x + hud.width + rect.x,
      y: hud.y + rect.y,
    });
    // A ring's drawn rect: its frame is drawn 1 inside the 75 frame.
    const ring = (centre: { x: number; y: number }): Rect => ({
      height: 73,
      width: 73,
      x: centre.x - 36,
      y: centre.y - 36,
    });
    const sticksBottom = Math.floor(
      Math.min(area.y + area.height - TOUCH_STICK.bottom, view.height - insets.bottom - 20),
    );

    it(`with ${name}, keeps the 720x360 game area centred across the view at its top`, () => {
      expect(area).toMatchObject({ height: 360, width: 720, y: 0 });
      expect(area.x).toBe(Math.floor((Math.floor(view.width) - 720) / 2));
    });

    it(`with ${name}, puts the pause disc, the status pill and four weapon targets in it`, () => {
      const inside = (rect: Rect) => contains(area, rect) && contains(hud, rect);
      expect(inside(fromLeft({ height: 33, width: 33, x: 0, y: 0 }))).toBe(true);
      const pill = { height: 28, width: statusPillWidth(40), x: STATUS_PILL.x, y: STATUS_PILL.y };
      expect(contains(area, fromLeft(pill))).toBe(true);
      for (const index of [0, 1, 2, 3]) {
        expect(inside(fromRight(hudButtonTarget(index)))).toBe(true);
      }
    });

    it(`with ${name}, rests the sticks 24 from the game area's sides and 20 above its bottom`, () => {
      const { aim, move } = stickRestCentres(view, insets);
      const width = Math.floor(view.width);
      const rightGap = width - (area.x + area.width);
      // max(playView side + 24, inset) from the view edge: an inset replaces the 24.
      expect(ring(move).x).toBe(Math.ceil(Math.max(area.x + TOUCH_STICK.side, insets.left)));
      expect(width - (ring(aim).x + 73)).toBe(
        Math.ceil(Math.max(rightGap + TOUCH_STICK.side, insets.right)),
      );
      // min(playView bottom - 20, view bottom - inset - 20): a bottom inset adds to the 20.
      expect(ring(move).y + 73).toBe(sticksBottom);
      expect(aim.y).toBe(move.y);
      for (const stick of [move, aim]) {
        expect(contains(area, ring(stick))).toBe(true);
        expect(contains(safeRect(insets, SAFE_MARGIN.edge, view), ring(stick))).toBe(true);
      }
    });

    it(`with ${name}, centres Use on the HUD rect, its bottom level with the sticks`, () => {
      const centre = hud.x + hud.width / 2;
      // Symmetric insets clamp the HUD rect within a pixel of the game area's centre.
      expect(Math.abs(centre - (area.x + area.width / 2))).toBeLessThan(1);
      // The Use bottom, max(band below the game area, bottom inset) + 20 from the view bottom.
      const useBottom =
        view.height - (Math.max(view.height - (area.y + area.height), insets.bottom) + 20);
      expect(Math.floor(useBottom)).toBe(sticksBottom);
    });
  }
});

describe("stick insets", () => {
  const view = { height: 360, width: 720 };

  it("let a side inset replace the 24 and a bottom inset add to the 20", () => {
    const { aim, move } = stickRestCentres(view, { bottom: 19, left: 47, right: 10, top: 0 });
    expect(move.x - 36).toBe(47);
    expect(720 - (aim.x + 37)).toBe(24);
    expect(move.y + 37).toBe(360 - 19 - 20);
  });

  it("keep 24 from a wide view's game area, which a phone's 43 inset does not reach", () => {
    // 844x390 CSS is 779.08x360 logical: the game area spans 29 to 749.
    const wide = logicalView({ height: 390, width: 844 });
    const { aim, move } = stickRestCentres(wide, { bottom: 0, left: 43, right: 43, top: 0 });
    expect(move.x - 36).toBe(29 + 24);
    expect(779 - (aim.x + 37)).toBe(30 + 24);
  });
});

describe("touch controls", () => {
  const view = { height: 360, width: 720 };
  const phone: Insets = { bottom: 19, left: 43, right: 43, top: 0 };

  // A ring's drawn edges in the view: its frame is drawn 1 inside the 75 frame.
  const ringEdges = (centre: { x: number; y: number }) => ({
    bottom: centre.y + 37,
    left: centre.x - 36,
    right: centre.x + 37,
  });

  it("rest the rings' drawn edges 24 in from the game area's sides and 20 above its bottom", () => {
    expect(stickRestCentres(view, NO_INSETS)).toEqual({
      aim: { x: 659, y: 303 },
      move: { x: 60, y: 303 },
    });
    // A wider, deeper view keeps them in its centred 720x360 game area, not in the bands.
    expect(stickRestCentres({ height: 400, width: 900 }, NO_INSETS)).toEqual({
      aim: { x: 749, y: 303 },
      move: { x: 150, y: 303 },
    });
    const clear = stickRestCentres(view, { bottom: 30, left: 90, right: 100, top: 0 });
    expect(ringEdges(clear.move).left).toBe(90);
    expect(720 - ringEdges(clear.aim).right).toBe(100);
    expect(360 - 30 - ringEdges(clear.move).bottom).toBe(TOUCH_STICK.bottom);
    expect(TOUCH_STICK).toMatchObject({
      bottom: 20,
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
  ] as const)(
    "rest both rings 20 above the bottom safe edge, which no bar holds, with %s",
    (_, insets) => {
      const { aim, move } = stickRestCentres(view, insets);
      expect(view.height - insets.bottom - ringEdges(move).bottom).toBe(TOUCH_STICK.bottom);
      expect(view.height - insets.bottom - ringEdges(aim).bottom).toBe(TOUCH_STICK.bottom);
    },
  );

  it.each([
    ["the 720 view", view, NO_INSETS],
    ["the 720 view with phone insets", view, phone],
    ["a wider, deeper view", { height: 400, width: 900 }, NO_INSETS],
    ["a fractional view with fractional insets", { height: 360, width: 779.2 }, phone],
  ] as const)("mirror the rings' drawn edges across the game area of %s", (_, size, insets) => {
    const { aim, move } = stickRestCentres(size, insets);
    const area = playView(size);
    expect(area.x + area.width - ringEdges(aim).right).toBe(ringEdges(move).left - area.x);
    expect(ringEdges(aim).bottom).toBe(ringEdges(move).bottom);
  });

  it("keep the Use button's press area clear of both rings at the 720 minimum width", () => {
    for (const insets of [NO_INSETS, phone]) {
      const { aim, move } = stickRestCentres(view, insets);
      const rect = hudRect(insets, view);
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
    expect(stickTargets(view, NO_INSETS).move).toEqual({ height: 75, width: 75, x: 23, y: 266 });
  });
});
