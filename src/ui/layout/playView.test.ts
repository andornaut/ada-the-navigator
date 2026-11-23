import type { Rect } from "@andornaut/game-kit/runtime/rect";
import { HIT_RULE } from "@andornaut/game-kit/runtime/ui/hitAreas";
import { describe, expect, it } from "vitest";

import { TOUCH_STICK as CANONICAL_TOUCH_STICK } from "../../data/layout.ts";
import { MOVE_STICK_GEOMETRY, STICK_GEOMETRY, stickVector } from "../../input/state.ts";
import { PILL, TEXT_BUTTON } from "./controls.ts";
import { conversationBoxRect } from "./conversationBox.ts";
import { fromSafeEdge, safeEdge, slice, units, VIEW_PROPERTIES } from "./css.ts";
import {
  CONTROL_EDGE,
  countSlot,
  countWidth,
  gameAreaGap,
  HUD_BUTTON,
  HUD_BUTTON_INSET,
  HUD_EDGE,
  HUD_ROW,
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
  SHIELD_PILL,
  shieldBarWidth,
  shieldFillWidth,
  shieldIconCentre,
  shieldPillRect,
  shieldPillWidth,
  type Size,
  startNavOrder,
  STATUS_PILL,
  statusCargoInset,
  statusPillWidth,
  statusTickCentres,
  STICK_AREA_MARGIN,
  viewScale,
} from "./playView.ts";
import { SMALL_BUTTON_GAP, SPACING, TYPE } from "./tokens.ts";
import {
  stickRestCentres,
  stickTargets,
  TOUCH_STICK,
  USE_DISC,
  useDiscLayout,
  usePressed,
} from "./touchControls.ts";
import { playLayout, viewProperties } from "./viewScale.ts";

const PHONE: Insets = { bottom: 19, left: 43, right: 43, top: 0 };

describe("view scale", () => {
  it.each([
    [844, 390, 1.0833, 779.08, 360, 52],
    [1280, 720, 1.7778, 720, 405, 85.33],
    // A screen wider than 2:1 widens the logical view instead.
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

  it("gives the DOM full-viewport bounds, scale and whole-pixel drawn edges", () => {
    const layout = playLayout({ height: 390, width: 844 });
    expect(layout.insets).toEqual(NO_INSETS);
    expect(layout.slices[2]).toBe(2);
    expect(layout.slices[4]).toBe(4);
    expect(Object.fromEntries(viewProperties(layout))).toMatchObject({
      "--ada-safe-left": "0px",
      "--ada-slice-4": "4px",
      "--ada-unit": String(layout.s),
    });
    expect(layout.slices[1]).toBe(1);
    expect(playLayout({ height: 720, width: 1280 }).slices).toEqual({
      1: 2,
      2: 4,
      4: 7,
      6: 11,
    });
    // The galaxy preview's 1 px frame at 1.78x and 2.67x: round(1 * s) whole CSS px.
    expect(playLayout({ height: 1080, width: 1920 }).slices[1]).toBe(3);
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
});

describe("HUD rect", () => {
  const phoneView = logicalView({ height: 390, width: 844 });
  const edges = (rect: Rect) => ({ left: rect.x, right: rect.x + rect.width, top: rect.y });

  it("centres the 720x360 play view in the logical view on both axes, on whole pixels", () => {
    expect(playView(phoneView)).toEqual({ height: 360, width: 720, x: 29, y: 0 });
    expect(playView({ height: 405, width: 720 })).toEqual({ height: 360, width: 720, x: 0, y: 22 });
    // A Firefox phone frame turned from portrait: 744x396 CSS is 720x383.23, bands 11 and 12.23.
    const turned = logicalView({ height: 396, width: 744 });
    expect(playView(turned)).toEqual({ height: 360, width: 720, x: 0, y: 11 });
    expect(turned.height - 360 - playView(turned).y).toBeCloseTo(12.23, 2);
  });

  it.each([
    [844, 390, NO_INSETS, { left: 41, right: 737, top: 12 }],
    [844, 390, { bottom: 0, left: 43, right: 43, top: 0 }, { left: 43, right: 735, top: 12 }],
    // A one-sided notch sets a common clearance from the two play edges.
    [844, 390, { bottom: 0, left: 47, right: 0, top: 0 }, { left: 47, right: 731, top: 12 }],
    [844, 390, { bottom: 0, left: 0, right: 47, top: 0 }, { left: 46, right: 732, top: 12 }],
    [1280, 575, NO_INSETS, { left: 52, right: 748, top: 12 }],
    [1280, 720, NO_INSETS, { left: 12, right: 708, top: 34 }],
    [720, 360, NO_INSETS, { left: 12, right: 708, top: 12 }],
  ])("at %ix%i with insets %o has the edges %o", (width, height, insets, expected) => {
    const rect = edges(hudRect(insets, logicalView({ height, width })));
    expect(rect.left).toBeCloseTo(expected.left, 2);
    expect(rect.right).toBeCloseTo(expected.right, 2);
    expect(rect.top).toBe(expected.top);
  });

  it("gives the bridge the HUD rect's edges in CSS px", () => {
    const layout = playLayout({ height: 390, width: 844 });
    const properties = new Map(viewProperties(layout));
    expect(parseFloat(properties.get(VIEW_PROPERTIES.hud("left"))!)).toBeCloseTo(41 * layout.s, 6);
    // The two viewport offsets account for their different band widths.
    expect(parseFloat(properties.get(VIEW_PROPERTIES.hud("right"))!)).toBeCloseTo(
      844 - 737 * layout.s,
      6,
    );
    expect(parseFloat(properties.get(VIEW_PROPERTIES.hud("top"))!)).toBeCloseTo(12 * layout.s, 6);
    expect(parseFloat(properties.get(VIEW_PROPERTIES.hud("bottom"))!)).toBeCloseTo(
      12 * layout.s,
      6,
    );
  });

  it("gives the bridge the game area's top and bottom bands in CSS px", () => {
    const layout = playLayout({ height: 720, width: 1280 });
    const properties = new Map(viewProperties(layout));
    expect(parseFloat(properties.get(VIEW_PROPERTIES.areaTop)!)).toBeCloseTo(22 * layout.s, 6);
    expect(parseFloat(properties.get(VIEW_PROPERTIES.areaBottom)!)).toBeCloseTo(23 * layout.s, 6);
    expect(parseFloat(properties.get(VIEW_PROPERTIES.hud("top"))!)).toBeCloseTo(34 * layout.s, 6);
    expect(parseFloat(properties.get(VIEW_PROPERTIES.hud("bottom"))!)).toBeCloseTo(
      35 * layout.s,
      6,
    );
  });
});

describe("HUD anchors", () => {
  const view = logicalView({ height: 390, width: 844 });
  const phone: Insets = { bottom: 19, left: 43, right: 43, top: 0 };
  // The pause disc and the weapon discs lie inside the play view inset by HUD_EDGE.
  for (const [name, insets] of [
    ["no insets", NO_INSETS],
    ["phone insets", phone],
  ] as const) {
    const hud = hudRect(insets, view);
    const play = playView(view);
    const bounds: Rect = {
      height: play.height - 2 * HUD_EDGE,
      width: play.width - 2 * HUD_EDGE,
      x: play.x + HUD_EDGE,
      y: play.y + HUD_EDGE,
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
        inside(fromLeft({ height: 33, width: 33, x: 0, y: 0 }), safeRect(insets, 12, view)),
      ).toBe(true);
    });

    it(`with ${name}, pack four weapon discs 24 apart, the rightmost on the HUD rect's corner`, () => {
      for (const index of [0, 1, 2, 3]) {
        const target = fromRight(hudButtonTarget(index));
        expect(target.x).toBeCloseTo(hud.x + hud.width + 7.5 - 48 - 57 * index, 9);
        // Neighbouring discs are small buttons, SMALL_BUTTON_GAP apart face to face.
        if (index > 0) {
          const right = fromRight(hudButtonTarget(index - 1));
          expect(right.x + 7.5 - (target.x + 7.5 + 33)).toBe(SMALL_BUTTON_GAP);
        }
        expect(target.y).toBe(hud.y - 7.5);
        const disc = { height: 33, width: 33, x: target.x + 7.5, y: target.y + 7.5 };
        expect(disc.y).toBe(hud.y);
        expect(inside(disc, bounds)).toBe(true);
        expect(inside(disc, safeRect(insets, HUD_EDGE, view))).toBe(true);
      }
      expect(fromRight(hudButtonTarget(0)).x + 7.5 + 33).toBeCloseTo(hud.x + hud.width, 9);
      const pause = fromLeft(PAUSE_BUTTON.hit);
      const leftmost = fromRight(hudButtonTarget(3));
      expect(leftmost.x - (pause.x + pause.width)).toBeGreaterThanOrEqual(SPACING.pageInset);
    });
  }

  it("put Exit alone at the far top right where it shows, and no disc where it does not", () => {
    expect(startNavOrder(true)).toEqual(["exit"]);
    expect(startNavOrder(false)).toEqual([]);
    // Exit's face right edge is the HUD rect's right edge.
    const target = hudButtonTarget(startNavOrder(true).indexOf("exit"));
    expect(target.x + HUD_BUTTON_INSET.disc + HUD_BUTTON.disc).toBe(0);
    expect(target.y + HUD_BUTTON_INSET.disc).toBe(0);
  });

  it("draw Chibi's skill button: a 48 target, a 33 disc at 7.5, a 4 annulus and a 20 glyph at 14", () => {
    expect(HUD_BUTTON).toEqual({ annulus: 4, disc: 33, edge: 1, gap: 9, glyph: 20, target: 48 });
    expect(HUD_BUTTON.target).toBe(HIT_RULE.minTarget);
    expect(HUD_BUTTON_INSET).toEqual({ disc: 7.5, glyph: 14 });
    // The discs sit SMALL_BUTTON_GAP apart: targets 9 apart, a 57 pitch.
    expect(HUD_BUTTON.gap + 2 * HUD_BUTTON_INSET.disc).toBe(SMALL_BUTTON_GAP);
    expect(hudRowWidth(3)).toBe(3 * 48 + 2 * 9);
  });

  it("put the status pill a gap right of the pause press area, or on the HUD edge without it", () => {
    const pauseRight = PAUSE_BUTTON.hit.x + PAUSE_BUTTON.hit.width;
    expect(STATUS_PILL.x).toBe(pauseRight + SPACING.gap);
    expect(STATUS_PILL.x).toBe(50.75);
    expect(STATUS_PILL.xAlone).toBe(0);
    // The pause disc, the weapon discs and the pill share the HUD row's centre line.
    const discCentre = PAUSE_BUTTON.art.y + PAUSE_BUTTON.art.height / 2;
    expect(discCentre).toBe(HUD_ROW.centre);
    expect(hudButtonTarget(0).y + HUD_BUTTON.target / 2).toBe(HUD_ROW.centre);
    expect(STATUS_PILL.y + STATUS_PILL.pill.height / 2).toBe(discCentre);
    expect(STATUS_PILL.y).toBe(2.5);
    expect(STATUS_PILL.pill).toEqual(PILL);
    // A +N tick sits just under its count: its 20 line box from HUD rect top + 33.5, 27 below
    // the count's line box top and the 3 gap below the pill, over the item notice's row.
    const countTop = STATUS_PILL.y + (PILL.height - TYPE.label.lineHeight) / 2;
    expect(STATUS_PILL.tick.gap).toBe(3);
    expect(STATUS_PILL.tick.top).toBe(27);
    expect(countTop + STATUS_PILL.tick.top).toBe(33.5);
    expect(countTop + STATUS_PILL.tick.top - (STATUS_PILL.y + PILL.height)).toBe(
      STATUS_PILL.tick.gap,
    );
  });

  it("measure each count in TYPE.label's tabular digits, at least one digit wide", () => {
    // Liberation Sans Bold at 16 px: a digit or k is 1139/2048 em, 8.90; m is 1821/2048, 14.23;
    // the point is 569/2048, 4.45.
    expect(STATUS_PILL.minCount).toBeCloseTo(8.9, 2);
    expect(countWidth("0")).toBe(STATUS_PILL.minCount);
    expect(countWidth("42")).toBeCloseTo(17.8, 2);
    expect(countWidth("999m")).toBeCloseTo(40.92, 2);
    expect(countWidth("999k")).toBeCloseTo(35.59, 2);
    expect(countWidth("44.4k")).toBeCloseTo(40.04, 2);
    expect(countWidth("9999k")).toBeCloseTo(44.49, 2);
    expect(countWidth("9999m")).toBeCloseTo(49.82, 2);
    expect(countWidth("9999")).toBe(countWidth("1000"));
    expect(countSlot("")).toBe(STATUS_PILL.minCount);
    expect(() => countWidth("1,000")).toThrow(/,/u);
    expect("count" in STATUS_PILL).toBe(false);
  });

  it.each([
    // Art's widths (art/layout.md "Status pill"): 36 plus the Stardust slot, ore 37 plus its slot,
    // cargo 31 or tow 28.
    ["0", null, null, 44.9],
    ["44.4k", null, null, 76.04],
    ["42", "18", null, 108.59],
    ["9999", "18", "carrying", 157.39],
    ["9999m", "9999m", "carrying", 203.64],
  ] as const)(
    "size the pill to Stardust %s, ore %s, cargo %s: %d",
    (stardust, ore, aboard, width) => {
      expect(statusPillWidth({ ore, stardust }, aboard)).toBeCloseTo(width, 1);
    },
  );

  it("move only the right edge as a count grows: the left stays and the ore slot shifts", () => {
    const small = statusTickCentres({ ore: "3", stardust: "7" });
    const large = statusTickCentres({ ore: "3", stardust: "9999m" });
    expect(small.stardust).toBeCloseTo(30 + STATUS_PILL.minCount / 2, 9);
    expect(large.stardust).toBeCloseTo(30 + countWidth("9999m") / 2, 9);
    // The ore tick follows the Stardust slot's growth.
    expect(large.ore! - small.ore!).toBeCloseTo(countWidth("9999m") - STATUS_PILL.minCount, 9);
    expect(statusTickCentres({ ore: null, stardust: "0" }).ore).toBeNull();
  });

  it("centre each +N tick on its count slot, far enough apart that two labels never meet", () => {
    const { ore, stardust } = statusTickCentres({ ore: "0", stardust: "0" });
    expect(stardust).toBeCloseTo(30 + STATUS_PILL.minCount / 2, 9);
    expect(ore).toBeCloseTo(67 + STATUS_PILL.minCount + STATUS_PILL.minCount / 2, 9);
    // Closest at the one-digit minimum, 45.90. A label is at most "+" and its count with the
    // outline, 11.34 plus the slot, so the two keep 37 - 11.34 = 25.66 between them.
    expect(ore! - stardust).toBeCloseTo(45.9, 1);
    for (const [stardustCount, oreCount] of [
      ["0", "0"],
      ["9999", "999"],
      ["9999m", "9999m"],
    ] as const) {
      const centres = statusTickCentres({ ore: oreCount, stardust: stardustCount });
      const halves = 11.34 + (countSlot(stardustCount) + countSlot(oreCount)) / 2;
      expect(centres.ore! - centres.stardust - halves).toBeCloseTo(25.66, 2);
    }
  });

  it("make the shield bar 120, 180 or 240 by 12 by Shield level, the pill the bar plus 36", () => {
    expect(SHIELD_PILL.bar).toEqual({ height: 12, inset: 2, rim: 1 });
    expect(SHIELD_PILL.bars).toEqual([120, 180, 240]);
    expect(SHIELD_PILL).toMatchObject({
      edge: 2,
      icon: 20,
      iconGap: 3,
      low: 0.25,
      padding: { left: 5, right: 8 },
    });
    expect(SHIELD_PILL.pill).toEqual(PILL);
    expect([1, 2, 3].map(shieldBarWidth)).toEqual([120, 180, 240]);
    expect([1, 2, 3].map(shieldFillWidth)).toEqual([116, 176, 236]);
    expect([1, 2, 3].map(shieldPillWidth)).toEqual([156, 216, 276]);
    // The icon's drawn pixels span x 3 to 17 in its 20 box: 8 and 6 to them as drawn.
    expect(SHIELD_PILL.padding.left + 3).toBe(8);
    expect(SHIELD_PILL.iconGap + 3).toBe(6);
    // Outside 1 to 3, the nearest level.
    expect([0, 4].map(shieldBarWidth)).toEqual([120, 240]);
  });

  it.each([
    ["the 720 base", { height: 360, width: 720 }, NO_INSETS, [282, 252, 222], 320],
    ["1280x720", logicalView({ height: 720, width: 1280 }), NO_INSETS, [282, 252, 222], 342],
    [
      "the 720 base with phone insets",
      { height: 360, width: 720 },
      { bottom: 19, left: 43, right: 43, top: 0 },
      [282, 252, 222],
      313,
    ],
    [
      "844x390 with phone insets",
      logicalView({ height: 390, width: 844 }),
      { bottom: 19, left: 43, right: 43, top: 0 },
      [311, 281, 251],
      313,
    ],
  ] as const)("put the shield pill at the bottom centre at %s", (_, view, insets, xs, y) => {
    const { aim, move } = stickRestCentres(view, insets);
    for (const level of [1, 2, 3] as const) {
      const rect = shieldPillRect(insets, view, level);
      expect(rect.x).toBeCloseTo(xs[level - 1]!, 2);
      expect(rect.y).toBe(y);
      expect(rect).toMatchObject({ height: 28, width: shieldPillWidth(level) });
      // A longer bar grows both ways about the centre.
      expect(rect.x + rect.width / 2).toBeCloseTo(xs[0]! + 78, 2);
      // The shield sits on the HUD rect's bottom edge and clears both ring frames.
      expect(rect.y + rect.height).toBe(hudRect(insets, view).y + hudRect(insets, view).height);
      expect(rect.y + rect.height).toBe(y + 28);
      expect(rect.x - (move.x + 38)).toBeGreaterThanOrEqual(45);
      expect(aim.x - 37 - (rect.x + rect.width)).toBeGreaterThanOrEqual(45);
    }
  });

  it.each([
    ["the 720 base", { height: 360, width: 720 }, NO_INSETS, 334],
    [
      "the 720 base with phone insets",
      { height: 360, width: 720 },
      { bottom: 19, left: 43, right: 43, top: 0 },
      327,
    ],
    ["1280x720", logicalView({ height: 720, width: 1280 }), NO_INSETS, 356],
  ] as const)("land a Shield notice on the pill's icon centre at %s", (_, view, insets, y) => {
    const hud = hudRect(insets, view);
    for (const level of [1, 2, 3] as const) {
      const pill = shieldPillRect(insets, view, level);
      const icon = shieldIconCentre(insets, view, level);
      expect(icon.x + hud.x).toBeCloseTo(pill.x + 15, 9);
      expect(icon.y + hud.y).toBe(y);
    }
  });

  it("add 31 for cargo, 28 for tow and 37 plus its slot for the ore segment", () => {
    expect(STATUS_PILL.cargoIcon).toBe(20);
    const alone = statusPillWidth({ ore: null, stardust: "42" }, null);
    expect(statusPillWidth({ ore: null, stardust: "42" }, "carrying") - alone).toBeCloseTo(31, 9);
    expect(statusPillWidth({ ore: null, stardust: "42" }, "towing") - alone).toBeCloseTo(28, 9);
    // An item notice for cargo lands on its own icon box's centre.
    expect(statusCargoInset("carrying")).toBe(14);
    expect(statusCargoInset("towing")).toBe(11);
    expect(statusCargoInset(null)).toBe(16);
    const counts = { ore: "18", stardust: "42" };
    expect(statusPillWidth(counts, "carrying") - statusCargoInset("carrying")).toBeCloseTo(
      statusPillWidth(counts, "towing") - statusCargoInset("towing"),
      9,
    );
    expect(statusPillWidth({ ore: "9999m", stardust: "42" }, null) - alone).toBeCloseTo(
      37 + countWidth("9999m"),
      9,
    );
  });

  it.each([
    ["720x360", { height: 360, width: 720 }, NO_INSETS, 62.75, 382.5, 100.11],
    ["720x360 with phone insets", { height: 360, width: 720 }, PHONE, 93.75, 351.5, 38.11],
    [
      "844x390 with phone insets",
      logicalView({ height: 390, width: 844 }),
      PHONE,
      93.75,
      409.5,
      96.11,
    ],
  ] as const)(
    "keep the widest pill a page inset clear of six weapons at %s",
    (_, view, insets, left, leftmost, clearance) => {
      const hud = hudRect(insets, view);
      const pillLeft = hud.x + STATUS_PILL.x;
      const first = hud.x + hud.width + hudButtonTarget(5).x;
      expect(pillLeft).toBeCloseTo(left, 2);
      expect(first).toBeCloseTo(leftmost, 2);
      const widest = statusPillWidth({ ore: "9999m", stardust: "9999m" }, "carrying");
      expect(widest).toBeCloseTo(203.64, 2);
      expect(first - SPACING.pageInset - pillLeft - widest).toBeCloseTo(clearance, 2);
    },
  );
});

// Representative base, phone, desktop, portrait and ultrawide CSS viewports.
const SCREENS = [
  { height: 360, width: 720 },
  { height: 390, width: 844 },
  { height: 720, width: 1280 },
  { height: 844, width: 390 },
  { height: 1080, width: 2400 },
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
    // The side offset from the outer screen edges, clamped STICK_AREA_MARGIN inside the area.
    const side = TOUCH_STICK.side;
    const sticksBottom = Math.floor(
      Math.min(view.height - TOUCH_STICK.bottom, area.y + area.height - STICK_AREA_MARGIN),
    );

    it(`with ${name}, keeps the 720x360 game area centred in the view on both axes`, () => {
      expect(area).toMatchObject({ height: 360, width: 720 });
      expect(area.x).toBe(Math.floor((Math.floor(view.width) - 720) / 2));
      expect(area.y).toBe(Math.floor((Math.floor(view.height) - 360) / 2));
    });

    it(`with ${name}, puts the pause disc, the status pill and four weapon discs in it`, () => {
      const inside = (rect: Rect) => contains(area, rect) && contains(hud, rect);
      expect(inside(fromLeft({ height: 33, width: 33, x: 0, y: 0 }))).toBe(true);
      const pill = {
        height: 28,
        width: statusPillWidth({ ore: "9999m", stardust: "9999m" }, "carrying"),
        x: STATUS_PILL.x,
        y: STATUS_PILL.y,
      };
      expect(contains(area, fromLeft(pill))).toBe(true);
      for (const index of [0, 1, 2, 3]) {
        const target = fromRight(hudButtonTarget(index));
        expect(contains(area, target)).toBe(true);
        expect(inside({ height: 33, width: 33, x: target.x + 7.5, y: target.y + 7.5 })).toBe(true);
      }
    });

    it(`with ${name}, rests the sticks 80 from the screen's sides, ${STICK_AREA_MARGIN} inside the area`, () => {
      const { aim, move } = stickRestCentres(view, insets);
      const width = Math.floor(view.width);
      expect(ring(move).x).toBe(Math.max(side, area.x + STICK_AREA_MARGIN));
      expect(ring(aim).x + 73).toBe(Math.min(width - side, area.x + 720 - STICK_AREA_MARGIN));
      expect(ring(move).y + 73).toBe(sticksBottom);
      expect(aim.y).toBe(move.y);
      const inner: Rect = {
        height: area.height - 2 * STICK_AREA_MARGIN,
        width: area.width - 2 * STICK_AREA_MARGIN,
        x: area.x + STICK_AREA_MARGIN,
        y: area.y + STICK_AREA_MARGIN,
      };
      for (const stick of [move, aim]) {
        expect(contains(inner, ring(stick))).toBe(true);
      }
    });

    it(`with ${name}, keeps the Use disc's ring in the game area and the safe rect`, () => {
      const { frame } = useDiscLayout(view, insets);
      expect(contains(area, ring({ x: frame.x + 37, y: frame.y + 37 }))).toBe(true);
      expect(
        contains(
          safeRect(insets, SAFE_MARGIN.edge, view),
          ring({ x: frame.x + 37, y: frame.y + 37 }),
        ),
      ).toBe(true);
    });
  }
});

describe("stick insets", () => {
  const view = { height: 360, width: 720 };

  it("ignores asymmetric and fractional safe insets", () => {
    const expected = { aim: { x: 603, y: 273 }, move: { x: 116, y: 273 } };
    expect(stickRestCentres(view, NO_INSETS)).toEqual(expected);
    expect(stickRestCentres(view, { bottom: 119.5, left: 147.2, right: 10, top: 80 })).toEqual(
      expected,
    );
  });

  it("measures 80 from outer screen sides on a wider view", () => {
    const wide = stickRestCentres(logicalView({ height: 390, width: 844 }), PHONE);
    expect([wide.move.x - 36, wide.aim.x + 37]).toEqual([80, 699]);
    const phone = stickRestCentres(logicalView({ height: 1080, width: 2400 }), PHONE);
    expect([phone.move.x - 36, phone.aim.x + 37]).toEqual([80, 720]);
  });

  it(`clamp a ring ${STICK_AREA_MARGIN} inside the game area where the screen edge lies in a band`, () => {
    // 3000x1080 is 1000x360 logical, the area 140 to 860: 80 from the outer sides lies in the
    // bands, so the ring edges move in to 8 inside the area.
    const wide = stickRestCentres(logicalView({ height: 1080, width: 3000 }), NO_INSETS);
    expect([wide.move.x - 36, wide.aim.x + 37]).toEqual([148, 852]);
    // 1440x900 is 720x450, the area 45 to 405: 50 above the screen's bottom (400) lies within
    // the margin of the area's bottom, so the rings move up to 397.
    const tall = stickRestCentres(logicalView({ height: 900, width: 1440 }), NO_INSETS);
    expect(tall.move.y + 37).toBe(405 - STICK_AREA_MARGIN);
    expect(STICK_AREA_MARGIN).toBe(8);
  });
});

// Approved touch controls by view, insets in logical px:
// rest centres, the shield pill's left, top and bottom, and Use's centre.
type Pair = readonly [number, number];
const ART_VIEWS: readonly (readonly [string, Size, Insets, Pair, Pair, number, Pair, Pair])[] = [
  [
    "720x360",
    { height: 360, width: 720 },
    NO_INSETS,
    [116, 273],
    [603, 273],
    282,
    [320, 348],
    [526, 173],
  ],
  [
    "844x390, phone insets",
    { height: 390, width: 844 },
    PHONE,
    [116, 273],
    [662, 273],
    311,
    [313, 341],
    [585, 173],
  ],
  [
    "1280x720",
    { height: 720, width: 1280 },
    NO_INSETS,
    [116, 318],
    [603, 318],
    282,
    [342, 370],
    [526, 218],
  ],
  [
    "2404x1080 at dpr 2.5",
    { height: 1080, width: 2404 },
    NO_INSETS,
    [116, 273],
    [684, 273],
    322,
    [320, 348],
    [607, 173],
  ],
  [
    "2560x1080",
    { height: 1080, width: 2560 },
    NO_INSETS,
    [116, 273],
    [736, 273],
    348,
    [320, 348],
    [659, 173],
  ],
];

describe("touch controls by view", () => {
  it.each(ART_VIEWS)(
    "at %s match approved rest centres, the game-area shield pill and Use",
    (_, screen, insets, move, aim, pillX, pillY, use) => {
      const view = logicalView(screen);
      const centres = stickRestCentres(view, insets);
      expect([centres.move.x, centres.move.y]).toEqual(move);
      expect([centres.aim.x, centres.aim.y]).toEqual(aim);
      const pill = shieldPillRect(insets, view);
      expect(pill.x).toBeCloseTo(pillX, 2);
      expect([pill.y, pill.y + pill.height]).toEqual(pillY);
      const disc = useDiscLayout(view, insets);
      expect([disc.centre.x, disc.centre.y]).toEqual(use);
    },
  );
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

  it("reexports the canonical stick geometry", () => {
    expect(TOUCH_STICK).toBe(CANONICAL_TOUCH_STICK);
    expect(CANONICAL_TOUCH_STICK).toMatchObject({ bottom: 50, side: 80 });
    expect(USE_DISC.fromAim).toEqual({ x: -77, y: -100 });
  });

  it("rest the drawn edges 80 from the outer screen sides and 50 above the bottom", () => {
    expect(stickRestCentres(view, NO_INSETS)).toEqual({
      aim: { x: 603, y: 273 },
      move: { x: 116, y: 273 },
    });
    // A wider view moves the sides in to eight inside; its bottom stays 50 above the screen's.
    expect(stickRestCentres({ height: 400, width: 900 }, NO_INSETS)).toEqual({
      aim: { x: 765, y: 313 },
      move: { x: 134, y: 313 },
    });
    const clear = stickRestCentres(view, { bottom: 30, left: 90, right: 100, top: 0 });
    expect(ringEdges(clear.move).left).toBe(80);
    expect(720 - ringEdges(clear.aim).right).toBe(80);
    expect(360 - ringEdges(clear.move).bottom).toBe(TOUCH_STICK.bottom);
    expect(TOUCH_STICK).toMatchObject({
      bottom: 50,
      frame: 75,
      knobReach: 12,
      moveDeadZone: 2.4,
      moveReach: 40,
      side: 80,
    });
  });

  it.each([
    ["no insets", NO_INSETS],
    ["phone insets", phone],
  ] as const)("rest both rings 50 above the screen's bottom edge, with %s", (_, insets) => {
    const { aim, move } = stickRestCentres(view, insets);
    expect(view.height - ringEdges(move).bottom).toBe(TOUCH_STICK.bottom);
    expect(view.height - ringEdges(aim).bottom).toBe(TOUCH_STICK.bottom);
  });

  it.each([
    ["the 720 view", view, NO_INSETS],
    ["the 720 view with phone insets", view, phone],
    ["a wider, deeper view", { height: 400, width: 900 }, NO_INSETS],
    ["a fractional view with fractional insets", { height: 360, width: 779.2 }, phone],
  ] as const)("mirror the rings' drawn edges across the view of %s", (_, size, insets) => {
    const { aim, move } = stickRestCentres(size, insets);
    expect(Math.floor(size.width) - ringEdges(aim).right).toBe(ringEdges(move).left);
    expect(ringEdges(aim).bottom).toBe(ringEdges(move).bottom);
  });

  it.each([
    ["the 720 base", view, NO_INSETS, { x: 526, y: 173 }],
    ["1280x720", logicalView({ height: 720, width: 1280 }), NO_INSETS, { x: 526, y: 218 }],
    ["the 720 base with phone insets", view, phone, { x: 526, y: 173 }],
    [
      "844x390 with phone insets",
      logicalView({ height: 390, width: 844 }),
      phone,
      { x: 585, y: 173 },
    ],
  ] as const)(
    "centre the Use disc (-77, -100) from the aim ring's centre at %s",
    (_, size, insets, at) => {
      const { aim } = stickRestCentres(size, insets);
      const disc = useDiscLayout(size, insets);
      expect(disc.centre).toEqual(at);
      expect(disc.centre).toEqual({ x: aim.x - 77, y: aim.y - 100 });
      expect(disc.awayFrom).toEqual(aim);
      expect(disc.frame).toEqual({ height: 75, width: 75, x: at.x - 37, y: at.y - 37 });
    },
  );

  it("press Use within 100 of its centre, cut on the line midway to the aim ring's centre", () => {
    expect(USE_DISC).toEqual({ frame: 75, fromAim: { x: -77, y: -100 }, radius: 100 });
    const disc = useDiscLayout(view, NO_INSETS);
    const { centre } = disc;
    expect(usePressed(disc, centre)).toBe(true);
    expect(usePressed(disc, { x: centre.x - 99.9, y: centre.y })).toBe(true);
    expect(usePressed(disc, { x: centre.x - 100, y: centre.y })).toBe(false);
    expect(usePressed(disc, { x: centre.x, y: centre.y - 99.9 })).toBe(true);
    // The midpoint to the aim centre and either side of it along the line.
    const toward = (share: number) => ({ x: centre.x + 77 * share, y: centre.y + 100 * share });
    expect(usePressed(disc, toward(0.49))).toBe(true);
    expect(usePressed(disc, toward(0.5))).toBe(false);
    // The aim ring's whole frame, and the stick's DOM target, stay with the aim stick.
    const aim = stickTargets(view, NO_INSETS).aim;
    for (const x of [aim.x, aim.x + aim.width]) {
      for (const y of [aim.y, aim.y + aim.height]) {
        expect(usePressed(disc, { x, y })).toBe(false);
      }
    }
  });

  it("reach the conversation box's lower right by 52.5 regardless of phone insets", () => {
    for (const [insets, depth] of [
      [NO_INSETS, 52.5],
      [phone, 52.5],
    ] as const) {
      const disc = useDiscLayout(view, insets);
      const box = conversationBoxRect(insets, view);
      const boxBottom = box.y + box.height;
      expect(boxBottom).toBe(125.5);
      expect(boxBottom - (disc.centre.y - USE_DISC.radius)).toBe(depth);
      // The circle does take the overlap's points: only the box, over the canvas, keeps them.
      expect(usePressed(disc, { x: disc.centre.x, y: boxBottom - 1 })).toBe(true);
      expect(disc.centre.x).toBeLessThan(box.x + box.width);
    }
  });

  it("put each stick's DOM target over its ring's frame", () => {
    expect(stickTargets(view, NO_INSETS).move).toEqual({ height: 75, width: 75, x: 79, y: 236 });
  });
});

describe("symmetric HUD on every view", () => {
  // Base, portrait, desktop, ultrawide and fractional logical widths exercise both clamp axes.
  const sizes: Size[] = [
    { height: 360, width: 720 },
    { height: 844, width: 390 },
    { height: 720, width: 1280 },
    { height: 300, width: 2600 },
    { height: 346, width: 769 },
  ];
  const insetCases: readonly Insets[] = [
    NO_INSETS,
    // One-sided landscape notch and portrait top/bottom safe areas.
    { bottom: 21, left: 47, right: 0, top: 0 },
    { bottom: 34, left: 0, right: 0, top: 47 },
  ];
  const ringEdges = (centre: { x: number; y: number }) => ({
    bottom: centre.y + 37,
    left: centre.x - 36,
    right: centre.x + 37,
  });

  it("keeps the HUD's drawn edges HUD_EDGE in, mirrored, level and on whole pixels", () => {
    expect(HUD_EDGE).toBe(12);
    for (const css of sizes) {
      const view = logicalView(css);
      for (const cssInsets of insetCases) {
        const insets = safeInsets(cssInsets, 1);
        const label = `${css.width}x${css.height} ${JSON.stringify(cssInsets)}`;
        const hud = hudRect(insets, view);
        const gap = gameAreaGap(view);
        const area = playView(view);
        const playRight = area.x + area.width;
        expect(Number.isInteger(hud.x), label).toBe(true);
        expect(Number.isInteger(hud.y), label).toBe(true);
        expect(hud.y, label).toBe(Math.ceil(Math.max(area.y + HUD_EDGE, insets.top)));
        // Left: the pause disc's drawn edge, or with the pause button hidden the pill's.
        const pauseDisc = hud.x + PAUSE_BUTTON.art.x + 1;
        const pillAlone = hud.x + STATUS_PILL.xAlone;
        expect(pauseDisc, label).toBeGreaterThanOrEqual(insets.left);
        expect(pauseDisc - area.x, label).toBeGreaterThanOrEqual(HUD_EDGE);
        expect(pillAlone, label).toBe(pauseDisc);
        // The rightmost disc has the same drawn clearance from the other play edge.
        const target = hudButtonTarget(0);
        const discRight = hud.x + hud.width + target.x + HUD_BUTTON_INSET.disc + HUD_BUTTON.disc;
        expect(view.width - discRight + 1e-9, label).toBeGreaterThanOrEqual(insets.right);
        expect(playRight - discRight, label).toBeCloseTo(pauseDisc - area.x, 9);
        // Top: the pause disc and every weapon disc have the same drawn top.
        const pauseTop = hud.y + PAUSE_BUTTON.art.y + 1;
        for (const index of [0, 1, 2, 3]) {
          expect(hud.y + hudButtonTarget(index).y + HUD_BUTTON_INSET.disc, label).toBe(pauseTop);
        }
        // Without insets the HUD sits exactly HUD_EDGE in from the game area's four edges, and
        // the shield pill's drawn bottom as far above its bottom as the pause disc's drawn top
        // below its top.
        if (cssInsets === NO_INSETS) {
          expect(hud.x - gap, label).toBe(HUD_EDGE);
          expect(hud.y - area.y, label).toBe(HUD_EDGE);
          expect(area.y + area.height - (hud.y + hud.height), label).toBe(HUD_EDGE);
          const shield = shieldPillRect(insets, view);
          expect(area.y + area.height - (shield.y + shield.height), label).toBe(pauseTop - area.y);
        }
        // The sticks sit TOUCH_STICK.side from the outer screen sides regardless of safe insets, mirrored across
        // the view's whole-pixel width at one height, unless the clamp holds a ring
        // STICK_AREA_MARGIN inside the game area.
        const { aim, move } = stickRestCentres(view, insets);
        const stickSide = TOUCH_STICK.side;
        expect(ringEdges(move).left, label).toBe(Math.max(stickSide, gap + STICK_AREA_MARGIN));
        expect(ringEdges(aim).right, label).toBe(
          Math.min(Math.floor(view.width) - stickSide, gap + 720 - STICK_AREA_MARGIN),
        );
        if (stickSide >= gap + STICK_AREA_MARGIN + 1) {
          expect(Math.floor(view.width) - ringEdges(aim).right, label).toBe(ringEdges(move).left);
        }
        expect(aim.y, label).toBe(move.y);
      }
    }
  });
});

describe("stick reach on every view", () => {
  const sizes: Size[] = [
    { height: 360, width: 720 },
    { height: 844, width: 390 },
    { height: 720, width: 1280 },
    { height: 300, width: 2600 },
    { height: 346, width: 769 },
  ];
  const insetCases: readonly Insets[] = [
    NO_INSETS,
    { bottom: 21, left: 47, right: 0, top: 0 },
    { bottom: 34, left: 0, right: 0, top: 47 },
  ];
  const strength = (vector: { x: number; y: number }) => Math.hypot(vector.x, vector.y);

  it("keeps full speed 40 out past the 2.4 dead zone", () => {
    expect(MOVE_STICK_GEOMETRY).toEqual({ deadZone: 2.4, reach: 40 });
    expect(TOUCH_STICK.moveReach).toBe(40);
  });

  it("reaches full speed from the rest centre straight to the game area's outer side or bottom", () => {
    for (const css of sizes) {
      const view = logicalView(css);
      for (const cssInsets of insetCases) {
        const insets = safeInsets(cssInsets, 1);
        const label = `${css.width}x${css.height} ${JSON.stringify(cssInsets)}`;
        const area = playView(view);
        const bottom = Math.min(area.y + area.height, view.height - insets.bottom);
        const { aim, move } = stickRestCentres(view, insets);
        // The rest centre pixel's centre is where a thumb lands on the default position.
        const centre = { x: move.x + 0.5, y: move.y + 0.5 };
        const outward = { x: area.x - centre.x, y: 0 };
        expect(-outward.x, label).toBeGreaterThanOrEqual(TOUCH_STICK.moveReach);
        expect(strength(stickVector(MOVE_STICK_GEOMETRY, outward)), label).toBeCloseTo(1, 9);
        const down = { x: 0, y: bottom - centre.y };
        expect(down.y, label).toBeGreaterThanOrEqual(TOUCH_STICK.moveReach);
        expect(strength(stickVector(MOVE_STICK_GEOMETRY, down)), label).toBeCloseTo(1, 9);
        // The aim stick takes only a direction: it clears its dead zone outward and down.
        const aimCentre = { x: aim.x + 0.5, y: aim.y + 0.5 };
        const aimOut = { x: area.x + area.width - aimCentre.x, y: 0 };
        const aimDown = { x: 0, y: bottom - aimCentre.y };
        expect(strength(stickVector(STICK_GEOMETRY, aimOut)), label).toBeGreaterThan(0);
        expect(strength(stickVector(STICK_GEOMETRY, aimDown)), label).toBeGreaterThan(0);
      }
    }
  });
});

describe("shield and pause game-area margins", () => {
  it.each([
    { height: 360, width: 720 },
    { height: 720, width: 1280 },
    { height: 390, width: 844 },
    { height: 844, width: 390 },
    // The turned Firefox phone frame, 1.88:1.
    { height: 396, width: 744 },
  ])("mirrors the pause disc's drawn top at every level in $width x $height", (screen) => {
    const view = logicalView(screen);
    const area = playView(view);
    const hud = hudRect(NO_INSETS, view);
    const pauseGap = hud.y + PAUSE_BUTTON.art.y + 1 - area.y;
    expect(pauseGap).toBe(HUD_EDGE);
    for (const level of [1, 2, 3]) {
      const shield = shieldPillRect(NO_INSETS, view, level);
      expect(area.y + area.height - (shield.y + shield.height)).toBe(pauseGap);
      expect(shield.x + shield.width / 2).toBeCloseTo(area.x + area.width / 2, 9);
    }
  });
});
