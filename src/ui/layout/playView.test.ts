import type { Rect } from "@andornaut/game-kit/rect";
import { HIT_RULE } from "@andornaut/game-kit/ui/hitAreas";
import { describe, expect, it } from "vitest";

import { MOVE_STICK_GEOMETRY, STICK_GEOMETRY, stickVector } from "../../input/state.ts";
import { PILL, TEXT_BUTTON } from "./controls.ts";
import { conversationBoxRect } from "./conversationBox.ts";
import { fromSafeEdge, safeEdge, slice, units, VIEW_PROPERTIES } from "./css.ts";
import {
  CONTROL_EDGE,
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
  shieldPillRect,
  type Size,
  startNavOrder,
  STATUS_PILL,
  statusPillWidth,
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
import { playLayout, uncoveredInsets, viewProperties } from "./viewScale.ts";

const PHONE: Insets = { bottom: 19, left: 43, right: 43, top: 0 };

describe("view scale", () => {
  it.each([
    [844, 390, 1.0833, 779.08, 360, 52],
    [1280, 720, 1.7778, 720, 405, 85.33],
    [1440, 900, 2, 720, 450, 96],
    [1920, 1080, 2.6667, 720, 405, 128],
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
    [844, 390, NO_INSETS, { left: 41, right: 738.08, top: 12 }],
    [844, 390, { bottom: 0, left: 43, right: 43, top: 0 }, { left: 43, right: 736.08, top: 12 }],
    // A one-sided notch moves both sides in alike.
    [844, 390, { bottom: 0, left: 47, right: 0, top: 0 }, { left: 47, right: 732.08, top: 12 }],
    [1280, 720, NO_INSETS, { left: 12, right: 708, top: 12 }],
    [1920, 1080, NO_INSETS, { left: 12, right: 708, top: 12 }],
    [720, 360, NO_INSETS, { left: 12, right: 708, top: 12 }],
  ])("at %ix%i with insets %o has the edges %o", (width, height, insets, expected) => {
    const rect = edges(hudRect(insets, logicalView({ height, width })));
    expect(rect.left).toBeCloseTo(expected.left, 2);
    expect(rect.right).toBeCloseTo(expected.right, 2);
    expect(rect.top).toBe(expected.top);
  });

  it("gives the bridge the HUD rect's edges in CSS px", () => {
    const layout = playLayout({ height: 390, width: 844 }, NO_INSETS);
    const properties = new Map(viewProperties(layout));
    expect(parseFloat(properties.get(VIEW_PROPERTIES.hud("left"))!)).toBeCloseTo(41 * layout.s, 6);
    // The right edge mirrors the left: the same distance in from the view's right.
    expect(parseFloat(properties.get(VIEW_PROPERTIES.hud("right"))!)).toBeCloseTo(41 * layout.s, 6);
    expect(parseFloat(properties.get(VIEW_PROPERTIES.hud("top"))!)).toBeCloseTo(12 * layout.s, 6);
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
        // The right side mirrors the left from the view's edge, so the discs stay in the play view.
        expect(inside(disc, play)).toBe(true);
      }
      expect(fromRight(hudButtonTarget(0)).x + 7.5 + 33).toBeCloseTo(hud.x + hud.width, 9);
      const pause = fromLeft(PAUSE_BUTTON.hit);
      const leftmost = fromRight(hudButtonTarget(3));
      expect(leftmost.x - (pause.x + pause.width)).toBeGreaterThanOrEqual(SPACING.pageInset);
    });
  }

  it("put Exit at the far top right where it shows, the other discs one pitch left of it", () => {
    // Each disc's face right edge from the HUD rect's right edge, right to left.
    const faces = (exit: boolean) =>
      startNavOrder(exit).map((button, index) => {
        const target = hudButtonTarget(index);
        return [button, target.x + HUD_BUTTON_INSET.disc + HUD_BUTTON.disc] as const;
      });
    expect(startNavOrder(true)).toEqual(["exit", "settings", "achievements"]);
    expect(startNavOrder(false)).toEqual(["settings", "achievements"]);
    // The rightmost face's right edge is the HUD rect's corner either way.
    expect(faces(true)[0]).toEqual(["exit", 0]);
    expect(faces(false)[0]).toEqual(["settings", 0]);
    // Without Exit the others take its place; faces stay SMALL_BUTTON_GAP apart.
    const pitch = HUD_BUTTON.disc + SMALL_BUTTON_GAP;
    expect(Object.fromEntries(faces(true))).toEqual({
      achievements: -2 * pitch,
      exit: 0,
      settings: -pitch,
    });
    expect(Object.fromEntries(faces(false))).toEqual({ achievements: -pitch, settings: 0 });
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
    // A +N tick sits under its count: its 20 line box from HUD rect top + 36.5, centred on the
    // item notice's 24 row from + 34.5, a mark gap below the pill.
    const countTop = STATUS_PILL.y + (PILL.height - TYPE.label.lineHeight) / 2;
    expect(countTop + STATUS_PILL.tick.top).toBe(36.5);
    expect(countTop + STATUS_PILL.tick.top + TYPE.label.lineHeight / 2).toBe(34.5 + 24 / 2);
    expect(countTop + STATUS_PILL.tick.top - (STATUS_PILL.y + PILL.height)).toBe(SPACING.markGap);
  });

  it("fix the pill's width by its segments: 82.92, 174.84 with ore, 219.84 with both, 127.92 with cargo", () => {
    expect(STATUS_PILL.count).toBe(40.92);
    expect(statusPillWidth(false, false)).toBeCloseTo(82.92, 9);
    expect(statusPillWidth(true, false)).toBeCloseTo(174.84, 9);
    expect(statusPillWidth(true, true)).toBeCloseTo(219.84, 9);
    expect(statusPillWidth(false, true)).toBeCloseTo(127.92, 9);
    expect("bar" in STATUS_PILL).toBe(false);
  });

  it("centre each +N tick on its count slot, pill left + 54.46 for Stardust and + 146.38 for ore", () => {
    const { cargoIcon, count, divider, dividerGap, markGap, pill, stardustIcon } = STATUS_PILL;
    const stardust = pill.padding + stardustIcon + markGap + count / 2;
    const ore =
      stardust + count / 2 + 2 * dividerGap + divider.width + cargoIcon + markGap + count / 2;
    expect(stardust).toBeCloseTo(54.46, 9);
    expect(ore).toBeCloseTo(146.38, 9);
    // The widest label, "+9,999" with its outline, 51.38: the two never meet.
    expect(ore - stardust - 51.38).toBeGreaterThan(0);
  });

  it("make the shield pill 202 wide: padding, the 20 icon, a mark gap and the 160x12 bar", () => {
    expect(SHIELD_PILL.bar).toEqual({
      fill: { height: 8, width: 156 },
      height: 12,
      inset: 2,
      rim: 1,
      width: 160,
    });
    expect(SHIELD_PILL.bar.width - 2 * SHIELD_PILL.bar.inset).toBe(SHIELD_PILL.bar.fill.width);
    expect(SHIELD_PILL).toMatchObject({ bottom: TOUCH_STICK.bottom, edge: 2, icon: 20, low: 0.25 });
    expect(SHIELD_PILL.pill).toEqual(PILL);
    expect(SHIELD_PILL.width).toBe(202);
    expect(2 * PILL.padding + SHIELD_PILL.icon + SHIELD_PILL.markGap + SHIELD_PILL.bar.width).toBe(
      202,
    );
  });

  it.each([
    ["the 720 base", { height: 360, width: 720 }, NO_INSETS, { x: 259, y: 300 }],
    ["1280x720", logicalView({ height: 720, width: 1280 }), NO_INSETS, { x: 259, y: 300 }],
    [
      "the 720 base with phone insets",
      { height: 360, width: 720 },
      { bottom: 19, left: 43, right: 43, top: 0 },
      { x: 259, y: 281 },
    ],
    [
      "844x390 with phone insets",
      logicalView({ height: 390, width: 844 }),
      { bottom: 19, left: 43, right: 43, top: 0 },
      { x: 288.54, y: 281 },
    ],
  ] as const)("put the shield pill at the bottom centre at %s", (_, view, insets, at) => {
    const rect = shieldPillRect(insets, view);
    expect(rect.x).toBeCloseTo(at.x, 2);
    expect(rect.y).toBe(at.y);
    expect(rect).toMatchObject({ height: 28, width: 202 });
    // Its bottom sits level with the sticks' drawn bottom, clear of both rings across.
    const { aim, move } = stickRestCentres(view, insets);
    expect(rect.y + rect.height).toBe(move.y + 37);
    expect(rect.x - (move.x + 37)).toBeGreaterThanOrEqual(142);
    expect(aim.x - 36 - (rect.x + rect.width)).toBeGreaterThanOrEqual(142);
  });

  it("add 45 for the cargo segment and 91.92 for the ore segment", () => {
    expect(STATUS_PILL.cargoIcon).toBe(20);
    expect(statusPillWidth(false, true) - statusPillWidth(false, false)).toBeCloseTo(45, 9);
    expect(statusPillWidth(true, false) - statusPillWidth(false, false)).toBeCloseTo(91.92, 9);
  });

  it.each([
    ["720x360", { height: 360, width: 720 }, NO_INSETS, 62.75, 382.5, 83.91],
    ["720x360 with phone insets", { height: 360, width: 720 }, PHONE, 93.75, 351.5, 21.91],
    [
      "844x390 with phone insets",
      logicalView({ height: 390, width: 844 }),
      PHONE,
      93.75,
      410.58,
      80.99,
    ],
  ] as const)(
    "keep the widest pill a page inset clear of six weapons at %s",
    (_, view, insets, left, leftmost, clearance) => {
      const hud = hudRect(insets, view);
      const pillLeft = hud.x + STATUS_PILL.x;
      const first = hud.x + hud.width + hudButtonTarget(5).x;
      expect(pillLeft).toBeCloseTo(left, 2);
      expect(first).toBeCloseTo(leftmost, 2);
      expect(first - SPACING.pageInset - pillLeft - statusPillWidth(true, true)).toBeCloseTo(
        clearance,
        2,
      );
    },
  );
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
      Math.min(
        area.y + area.height - TOUCH_STICK.bottom,
        view.height - insets.bottom - TOUCH_STICK.bottom,
      ),
    );

    it(`with ${name}, keeps the 720x360 game area centred across the view at its top`, () => {
      expect(area).toMatchObject({ height: 360, width: 720, y: 0 });
      expect(area.x).toBe(Math.floor((Math.floor(view.width) - 720) / 2));
    });

    it(`with ${name}, puts the pause disc, the status pill and four weapon discs in it`, () => {
      const inside = (rect: Rect) => contains(area, rect) && contains(hud, rect);
      expect(inside(fromLeft({ height: 33, width: 33, x: 0, y: 0 }))).toBe(true);
      const pill = {
        height: 28,
        width: statusPillWidth(true, true),
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

    it(`with ${name}, rests the sticks 32 from the game area's sides and 32 above its bottom`, () => {
      const { aim, move } = stickRestCentres(view, insets);
      const width = Math.floor(view.width);
      // max(the left gap + 32, the larger side inset) from each side: an inset replaces the 32.
      const side = Math.ceil(
        Math.max(area.x + TOUCH_STICK.side, Math.max(insets.left, insets.right)),
      );
      expect(ring(move).x).toBe(side);
      expect(width - (ring(aim).x + 73)).toBe(side);
      // min(playView bottom - 32, view bottom - inset - 32): a bottom inset adds to the 32.
      expect(ring(move).y + 73).toBe(sticksBottom);
      expect(aim.y).toBe(move.y);
      for (const stick of [move, aim]) {
        expect(contains(area, ring(stick))).toBe(true);
        expect(contains(safeRect(insets, SAFE_MARGIN.edge, view), ring(stick))).toBe(true);
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

  it("let the larger side inset replace the 32 on both sides and a bottom inset add to the 32", () => {
    // The larger side inset clears both sides, so a one-sided notch keeps the mirror.
    const { aim, move } = stickRestCentres(view, { bottom: 19, left: 47, right: 10, top: 0 });
    expect(move.x - 36).toBe(47);
    expect(720 - (aim.x + 37)).toBe(47);
    expect(move.y + 37).toBe(360 - 19 - 32);
  });

  it("keep 32 from a wide view's game area, which a phone's 43 inset does not reach", () => {
    // 844x390 CSS is 779.08x360 logical: the game area's left gap is 29, used on both sides.
    const wide = logicalView({ height: 390, width: 844 });
    const { aim, move } = stickRestCentres(wide, { bottom: 0, left: 43, right: 43, top: 0 });
    expect(move.x - 36).toBe(29 + 32);
    expect(779 - (aim.x + 37)).toBe(29 + 32);
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

  it("rest the rings' drawn edges 32 in from the game area's sides and 32 above its bottom", () => {
    expect(stickRestCentres(view, NO_INSETS)).toEqual({
      aim: { x: 651, y: 291 },
      move: { x: 68, y: 291 },
    });
    // A wider, deeper view keeps them in its centred 720x360 game area, not in the bands.
    expect(stickRestCentres({ height: 400, width: 900 }, NO_INSETS)).toEqual({
      aim: { x: 741, y: 291 },
      move: { x: 158, y: 291 },
    });
    const clear = stickRestCentres(view, { bottom: 30, left: 90, right: 100, top: 0 });
    expect(ringEdges(clear.move).left).toBe(100);
    expect(720 - ringEdges(clear.aim).right).toBe(100);
    expect(360 - 30 - ringEdges(clear.move).bottom).toBe(TOUCH_STICK.bottom);
    expect(TOUCH_STICK).toMatchObject({
      bottom: 32,
      frame: 75,
      knobReach: 12,
      moveDeadZone: 2.4,
      moveReach: 40,
      side: 32,
    });
  });

  it.each([
    ["no insets", NO_INSETS],
    ["phone insets", phone],
  ] as const)(
    "rest both rings 32 above the bottom safe edge, which no bar holds, with %s",
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
  ] as const)("mirror the rings' drawn edges across the view of %s", (_, size, insets) => {
    const { aim, move } = stickRestCentres(size, insets);
    expect(Math.floor(size.width) - ringEdges(aim).right).toBe(ringEdges(move).left);
    expect(ringEdges(aim).bottom).toBe(ringEdges(move).bottom);
  });

  it.each([
    ["the 720 base", view, NO_INSETS, { x: 574, y: 191 }],
    ["1280x720", logicalView({ height: 720, width: 1280 }), NO_INSETS, { x: 574, y: 191 }],
    ["the 720 base with phone insets", view, phone, { x: 563, y: 172 }],
    [
      "844x390 with phone insets",
      logicalView({ height: 390, width: 844 }),
      phone,
      { x: 604, y: 172 },
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
    // The midpoint to the aim centre (612.5, 241) and either side of it along the line.
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

  it("reach the conversation box's lower right by 32.5 at the 720 base and 51.5 with phone insets", () => {
    for (const [insets, depth] of [
      [NO_INSETS, 32.5],
      [phone, 51.5],
    ] as const) {
      const disc = useDiscLayout(view, insets);
      const box = conversationBoxRect(insets, view);
      const boxBottom = box.y + box.height;
      expect(boxBottom).toBe(123.5);
      expect(boxBottom - (disc.centre.y - USE_DISC.radius)).toBe(depth);
      // The circle does take the overlap's points: only the box, over the canvas, keeps them.
      expect(usePressed(disc, { x: disc.centre.x, y: boxBottom - 1 })).toBe(true);
      expect(disc.centre.x).toBeLessThan(box.x + box.width);
    }
  });

  it("put each stick's DOM target over its ring's frame", () => {
    expect(stickTargets(view, NO_INSETS).move).toEqual({ height: 75, width: 75, x: 31, y: 254 });
  });
});

describe("symmetric HUD on every view", () => {
  // CSS sizes with odd and even logical widths, bands on either axis and the exact 2:1 base.
  const sizes: Size[] = [{ height: 360, width: 720 }];
  for (let width = 600; width <= 2600; width += 37) {
    for (const height of [300, 346, 390, 405, 720, 768, 1080]) {
      sizes.push({ height, width });
    }
  }
  const insetCases: readonly Insets[] = [
    NO_INSETS,
    { bottom: 21, left: 47, right: 47, top: 0 },
    // One-sided notches, and a fractional one.
    { bottom: 21, left: 47, right: 0, top: 0 },
    { bottom: 0, left: 0, right: 59, top: 0 },
    { bottom: 0, left: 43.4, right: 12.6, top: 0 },
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
        const side = Math.ceil(Math.max(gap + HUD_EDGE, insets.left, insets.right));
        expect(Number.isInteger(hud.x), label).toBe(true);
        expect(Number.isInteger(hud.y), label).toBe(true);
        expect(hud.x, label).toBe(side);
        expect(hud.y, label).toBe(Math.ceil(Math.max(HUD_EDGE, insets.top)));
        // Left: the pause disc's drawn edge, or with the pause button hidden the pill's.
        const pauseDisc = hud.x + PAUSE_BUTTON.art.x + 1;
        const pillAlone = hud.x + STATUS_PILL.xAlone;
        expect(pauseDisc, label).toBe(side);
        expect(pillAlone, label).toBe(side);
        // Right: the rightmost disc's drawn edge, as far from the view's right edge.
        const target = hudButtonTarget(0);
        const discRight = hud.x + hud.width + target.x + HUD_BUTTON_INSET.disc + HUD_BUTTON.disc;
        expect(view.width - discRight, label).toBeCloseTo(side, 9);
        // Top: the pause disc and every weapon disc have the same drawn top.
        const pauseTop = hud.y + PAUSE_BUTTON.art.y + 1;
        for (const index of [0, 1, 2, 3]) {
          expect(hud.y + hudButtonTarget(index).y + HUD_BUTTON_INSET.disc, label).toBe(pauseTop);
        }
        // Without insets the HUD sits exactly HUD_EDGE in from the game area's left and top.
        if (cssInsets === NO_INSETS) {
          expect(hud.x - gap, label).toBe(HUD_EDGE);
          expect(hud.y, label).toBe(HUD_EDGE);
        }
        // The sticks mirror across the view's whole-pixel width at one height.
        const { aim, move } = stickRestCentres(view, insets);
        expect(Math.floor(view.width) - ringEdges(aim).right, label).toBe(ringEdges(move).left);
        expect(ringEdges(move).left, label).toBe(
          Math.ceil(Math.max(gap + TOUCH_STICK.side, insets.left, insets.right)),
        );
        expect(aim.y, label).toBe(move.y);
      }
    }
  });
});

describe("stick reach on every view", () => {
  const sizes: Size[] = [{ height: 360, width: 720 }];
  for (let width = 600; width <= 2600; width += 37) {
    for (const height of [300, 346, 390, 405, 720, 768, 1080]) {
      sizes.push({ height, width });
    }
  }
  const insetCases: readonly Insets[] = [
    NO_INSETS,
    { bottom: 21, left: 47, right: 47, top: 0 },
    { bottom: 21, left: 47, right: 0, top: 0 },
    { bottom: 0, left: 0, right: 59, top: 0 },
    { bottom: 0, left: 43.4, right: 12.6, top: 0 },
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
