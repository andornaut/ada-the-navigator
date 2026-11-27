import { readFileSync } from "node:fs";

import type { Rect } from "@andornaut/game-kit/runtime/rect";
import { HIT_RULE, hitAround, pressedArea } from "@andornaut/game-kit/runtime/ui/hitAreas";
import { describe, expect, it } from "vitest";

import { FALLBACK_SPACE_PALETTE, readGalaxyFields } from "../../art/spacePalette.ts";
import type { GalaxyNumber } from "../../data/types.ts";
import { uiIconUrl } from "../../data/uiIconUrl.ts";
import { CURRENT_FLIGHT_TOPOLOGY } from "../../model/flightTopology.ts";
import { CARD_CLOSE } from "./cardFrame.ts";
import {
  adaAngle,
  chipRect,
  clampView,
  filledPips,
  fitRegion,
  fogColor,
  fogReveal,
  innerRegion,
  keepClear,
  MAP_GLYPHS,
  MAP_PANEL,
  MAP_SCREEN,
  MAP_SYMBOL,
  MAP_TOOLS,
  mapCardLift,
  mapCardWidth,
  mapCloseRect,
  mapGalaxiesRect,
  mapHeaderCap,
  mapHeaderGeometry,
  mapHeaderLeft,
  mapHeaderWidth,
  mapImage,
  mapProjection,
  mapQuestsRect,
  mapSurveyEllipse,
  type MapView,
  mapWorldDiamond,
  openingView,
  panelMaxWidth,
  panView,
  type Point,
  readingOrder,
  recentreView,
  scaleLimits,
  selectedPanelMaxHeight,
  toolColumnLeft,
  toScreen,
  zoomView,
} from "./mapScreen.ts";
import { logicalView, NO_INSETS, safeInsets, safeRect, viewScale } from "./playView.ts";
import { SPACING } from "./tokens.ts";

const BASE = { height: 360, width: 720 };
const SIDE = CURRENT_FLIGHT_TOPOLOGY.side;
const regionsAt = (css: { height: number; width: number }, cssInsets = NO_INSETS) => {
  const view = logicalView(css);
  const insets = safeInsets(cssInsets, viewScale(css));
  const fit = fitRegion(insets, view);
  return { field: { ...view, x: 0, y: 0 }, fit, inner: innerRegion(fit) };
};
const round = (value: number, digits: number) => Number(value.toFixed(digits));

function surveyDistances(field: Rect, inner: Rect, view: MapView) {
  const { rx, ry, x, y } = mapSurveyEllipse(inner, view);
  const right = field.x + field.width;
  const bottom = field.y + field.height;
  const dx = Math.max(field.x - x, 0, x - right);
  const dy = Math.max(field.y - y, 0, y - bottom);
  return {
    farthest: Math.hypot(
      Math.max(x - field.x, right - x) / rx,
      Math.max(y - field.y, bottom - y) / ry,
    ),
    nearest: Math.hypot(dx / rx, dy / ry),
  };
}

function expectSurveyArc(field: Rect, inner: Rect, view: MapView) {
  const { farthest, nearest } = surveyDistances(field, inner, view);
  expect(nearest).toBeLessThan(1);
  expect(farthest).toBeGreaterThan(1);
}

describe("map screen tokens", () => {
  it("are art/map.md's", () => {
    expect(MAP_SCREEN).toMatchObject({
      chartRadius: 25000,
      dragThreshold: 8,
      fitMargin: 22,
      fog: { feather: 0.16, minFeather: 3, reveal: 1500, sample: 250 },
      header: {
        alpha: 0.65,
        dividerGap: 12,
        height: 64,
        labelTop: 14,
        nameTop: 10,
        padding: 8,
        pip: 8,
        pipPitch: 11,
        radius: 4,
        stackGap: 4,
        stackTop: 9,
      },
      minBox: { height: 6000, width: 12000 },
      tools: { pitch: 57 },
      wheelStep: 100,
      zoomStep: 1.5,
    });
    expect(MAP_PANEL).toMatchObject({
      actionGap: 16,
      markGap: 8,
      minWidth: 360,
      padding: 16,
      reasonGap: 8,
      textTop: 4,
    });
    expect(MAP_SYMBOL).toMatchObject({
      ada: { keyline: 1.5, size: 28 },
      chip: 28,
      edge: 1,
      glyph: 20,
      hit: 48,
      objective: { ink: 4, stroke: 2, tip: 23 },
      ring: { band: 2, fringe: 1, radius: 17 },
    });
  });

  it("use Art's map glyphs without the replaced close X, each a shipped map-*.svg", () => {
    const glyphs = [
      ...Object.values(MAP_GLYPHS).filter((glyph) => glyph !== null),
      ...MAP_TOOLS.map(({ glyph }) => glyph),
    ];
    expect(new Set(glyphs).size).toBe(14);
    for (const glyph of glyphs) {
      const svg = readFileSync(
        new URL(`../../../public${uiIconUrl(glyph)}`, import.meta.url),
        "utf8",
      );
      expect(svg, glyph).toContain('aria-hidden="true"');
    }
  });
});

describe("map projection and fit", () => {
  it("fits the regions and zoom range of Art's table", () => {
    const base = regionsAt(BASE);
    expect([base.fit.width, base.fit.height]).toEqual([688, 200]);
    expect([base.inner.width, base.inner.height]).toEqual([644, 156]);
    const limits = scaleLimits(base.inner, base.field, SIDE);
    expect(round(limits.max, 5)).toBe(0.04733);
    expect(round(limits.min, 5)).toBe(0.00441);
    expect(round(Math.log(limits.max / limits.min) / Math.log(MAP_SCREEN.zoomStep), 2)).toBe(5.85);
    const wide = regionsAt({ height: 720, width: 1280 });
    expect([wide.fit.width, round(wide.fit.height, 2)]).toEqual([688, 245]);
    expect(round(scaleLimits(wide.inner, wide.field, SIDE).max, 5)).toBe(0.05367);
  });

  it("anchors Quests, Galaxies and the sole primary Close at the bottom right", () => {
    expect(mapQuestsRect(NO_INSETS, BASE)).toEqual({ height: 48, width: 98, x: 378, y: 296 });
    expect(mapGalaxiesRect(NO_INSETS, BASE)).toEqual({ height: 48, width: 98, x: 492, y: 296 });
    expect(mapCloseRect(NO_INSETS, BASE)).toEqual({ height: 48, width: 98, x: 606, y: 296 });
    const phone = { bottom: 19, left: 43, right: 43, top: 0 };
    expect(mapCloseRect(phone, BASE)).toEqual({ height: 48, width: 98, x: 579, y: 293 });
    expect(MAP_TOOLS.map(({ id }) => id)).toEqual(["zoomOut", "zoomIn", "recentre"]);
    expect(toolColumnLeft(NO_INSETS, BASE)).toBe(542 - CARD_CLOSE.hit.width);
  });

  it("starts the header at the safe page inset and ends it a gap before the tools", () => {
    const phone = { bottom: 19, left: 43, right: 43, top: 0 };
    expect(mapHeaderLeft(NO_INSETS, BASE)).toBe(16);
    expect(mapHeaderLeft(phone, BASE)).toBe(43);
    // The close target reserves a fixed width to the right of the zoom tools.
    expect(mapHeaderCap(NO_INSETS, BASE)).toBe(518 - CARD_CLOSE.hit.width);
    expect(mapHeaderCap(phone, BASE)).toBe(464 - CARD_CLOSE.hit.width);
  });

  it("fits a shared card width and lifts the selection only where it meets the footer", () => {
    const phone = { bottom: 19, left: 43, right: 43, top: 0 };
    const width = mapCardWidth(NO_INSETS, BASE, 362, 2);
    expect(width).toBe(365);
    expect(mapCardLift(width, 374)).toBe(0);
    const compactWidth = mapCardWidth(phone, BASE, 362, 2);
    expect(compactWidth).toBe(362);
    expect(mapCardLift(compactWidth, 320)).toBe(56);
    expect(mapCardWidth(phone, BASE, 500, 2)).toBe(mapHeaderCap(phone, BASE));
  });

  it("fills one survey pip per whole tenth of the displayed percent", () => {
    expect([0, 9, 10, 55, 99, 100].map(filledPips)).toEqual([0, 0, 1, 5, 9, 10]);
  });

  it("draws ten 8-pixel pips at an 11-pixel pitch", () => {
    expect(MAP_SCREEN.header).toMatchObject({ pip: 8, pipPitch: 11, pipRow: 107, pips: 10 });
    expect(mapHeaderWidth(200, 100)).toBe(200 + 2 + 100 + 107 + 6 * 8);
  });

  it("uses one equal ink gap for title, both dividers, percent, pips and both outer edges", () => {
    // The ink totals 273. Six equal 15-pixel gaps make room for the padded 346-pixel note.
    expect(mapHeaderGeometry(100, 64, 346)).toEqual({ gap: 15, width: 363 });
    expect(mapHeaderWidth(100, 64, 346)).toBe(363);
    expect(mapHeaderGeometry(100, 64, 346, 2)).toEqual({ gap: 15, width: 363 });
    expect(mapHeaderWidth(100, 64, 601)).toBe(621);
  });

  it("keeps the widest header inside the phone cap and the note's minimum at about 363", () => {
    const phone = { bottom: 19, left: 43, right: 43, top: 0 };
    // Ink widths the browser smoke measures at 720x360 (map-header-proof.json): the longest galaxy
    // name, "Andromeda", in TYPE.heading, "100% mapped" in TYPE.label and the note in TYPE.body.
    const ink = { name: 133, note: 345, percent: 105 };
    const minimum = mapHeaderWidth(0, 0, ink.note);
    expect(minimum).toBeGreaterThanOrEqual(361);
    expect(minimum).toBeLessThanOrEqual(365);
    expect(mapHeaderWidth(ink.name, ink.percent, ink.note)).toBeLessThanOrEqual(
      mapHeaderCap(phone, BASE),
    );
    expect(mapHeaderCap(phone, BASE)).toBe(464 - CARD_CLOSE.hit.width);
  });

  it("sets the Quests lines: a 28 chip slot, markGap, then text from 42", () => {
    expect(MAP_SCREEN.quests).toEqual({
      chip: MAP_SYMBOL.chip,
      inset: 8,
      markGap: 6,
      textColumn: 42,
    });
  });

  it("reserves destination details left of footer actions at every supported inset", () => {
    expect(panelMaxWidth(NO_INSETS, BASE)).toBe(354);
    for (const [css, cssInsets] of [
      [
        { height: 390, width: 844 },
        { bottom: 21, left: 47, right: 47, top: 0 },
      ],
      [{ height: 720, width: 1280 }, NO_INSETS],
    ] as const) {
      const view = logicalView(css);
      const insets = safeInsets(cssInsets, viewScale(css));
      const page = safeRect(insets, SPACING.pageInset, view);
      expect(page.x + panelMaxWidth(insets, view) + SPACING.gap).toBeCloseTo(
        mapQuestsRect(insets, view).x,
        9,
      );
    }
  });

  it("opens on the box of Ada and every place, clamped between the disc and the minimum box", () => {
    const { field, inner } = regionsAt(BASE);
    const { max, min } = scaleLimits(inner, field, SIDE);
    // The opening fits the minimum box inside reserved chrome; further zoom remains available.
    const close = openingView(inner, field, SIDE, [{ x: 500, y: 0 }], { x: 0, y: 0 });
    expect(close.scale).toBeCloseTo(0.026);
    expect(close.scale).toBeLessThan(max);
    // A spread galaxy fits between the limits.
    const spread = [
      { x: 12000, y: -12000 },
      { x: -12000, y: 12000 },
    ];
    const fitted = openingView(inner, field, SIDE, spread, { x: 0, y: 0 });
    expect(fitted.scale).toBeGreaterThan(min);
    expect(fitted.scale).toBeLessThan(max);
    for (const place of spread) {
      const at = toScreen(inner, fitted, place);
      expect(at.x).toBeGreaterThanOrEqual(inner.x - 1e-6);
      expect(at.x).toBeLessThanOrEqual(inner.x + inner.width + 1e-6);
    }
    // A far station: minScale clamps it, and the least pan keeps Ada inside the inner region.
    const far = openingView(inner, field, SIDE, [{ x: 100_000, y: -100_000 }], { x: 0, y: 0 });
    expect(far.scale).toBeCloseTo(min);
    const ada = toScreen(inner, far, { x: 0, y: 0 });
    expect(ada.x).toBeGreaterThanOrEqual(inner.x - 1e-6);
    expect(ada.x).toBeLessThanOrEqual(inner.x + inner.width + 1e-6);
    expect(ada.y).toBeGreaterThanOrEqual(inner.y - 1e-6);
    expect(ada.y).toBeLessThanOrEqual(inner.y + inner.height + 1e-6);
  });

  it("zooms by one step about an anchor and refuses at each limit", () => {
    const { field, inner } = regionsAt(BASE);
    const { max, min } = scaleLimits(inner, field, SIDE);
    const centre = { x: inner.x + inner.width / 2, y: inner.y + inner.height / 2 };
    const start = { centre: { x: 0, y: 0 }, scale: min, worldSide: SIDE };
    expect(zoomView(inner, field, 1 / MAP_SCREEN.zoomStep, centre, start).refused).toBe(true);
    const step = zoomView(inner, field, MAP_SCREEN.zoomStep, centre, start);
    expect(step.refused).toBe(false);
    expect(step.view.scale).toBeCloseTo(min * 1.5);
    let view = step.view;
    for (let index = 0; index < 10; index++) {
      view = zoomView(inner, field, MAP_SCREEN.zoomStep, centre, view).view;
    }
    expect(view.scale).toBeCloseTo(max);
    expect(zoomView(inner, field, MAP_SCREEN.zoomStep, centre, view).refused).toBe(true);
    // The anchor's world point stays under it.
    const anchor = { x: inner.x + 30, y: inner.y + 40 };
    const before = { centre: { x: 1000, y: 500 }, scale: min * 2, worldSide: SIDE };
    const after = zoomView(inner, field, 1.5, anchor, before).view;
    const world = (view: typeof before) => ({
      x: view.centre.x + (anchor.x - centre.x) / view.scale,
      y: view.centre.y + (anchor.y - centre.y) / view.scale,
    });
    expect(world(after).x).toBeCloseTo(world(before).x);
    expect(world(after).y).toBeCloseTo(world(before).y);
  });

  it("recentres on Ada at the same scale", () => {
    const { field, inner } = regionsAt(BASE);
    const view = { centre: { x: 0, y: 0 }, scale: 0.01, worldSide: SIDE };
    const away = recentreView(inner, field, { x: 5000, y: 0 }, view);
    expect(away).toEqual({ ...view, centre: mapProjection({ x: 5000, y: 0 }) });
  });
});

describe("close places", () => {
  it("give every chip a 48 press area where the nearest centre wins", () => {
    const art = chipRect({ x: 100, y: 100 });
    expect(hitAround(HIT_RULE, art).width).toBe(MAP_SYMBOL.hit);
    const areas = [
      { art: chipRect({ x: 100, y: 100 }), key: "a" },
      { art: chipRect({ x: 112, y: 100 }), key: "b" },
    ].map(({ art: rect, key }) => ({ art: rect, hit: hitAround(HIT_RULE, rect), key }));
    expect(pressedArea(areas, { x: 101, y: 100 })).toBe("a");
    expect(pressedArea(areas, { x: 111, y: 100 })).toBe("b");
  });

  it("preserves full-page maximum zoom despite reserved chrome and separates 1020-apart places", () => {
    const { inner } = regionsAt(
      { height: 390, width: 844 },
      { bottom: 21, left: 47, right: 47, top: 0 },
    );
    const { max } = scaleLimits(inner, { height: 390, width: 844 }, SIDE);
    expect(max).toBeGreaterThanOrEqual(0.039);
    const view = { centre: { x: 0, y: 0 }, scale: max, worldSide: SIDE };
    for (let degrees = 0; degrees < 360; degrees += 5) {
      const angle = (degrees * Math.PI) / 180;
      const a = toScreen(inner, view, { x: 0, y: 0 });
      const b = toScreen(inner, view, { x: Math.cos(angle) * 1020, y: Math.sin(angle) * 1020 });
      expect(Math.hypot(a.x - b.x, a.y - b.y), String(degrees)).toBeGreaterThanOrEqual(
        MAP_SYMBOL.chip - 0.05,
      );
    }
  });

  it("caps a selected panel below the fit top, ring diameter and gap", () => {
    const { fit } = regionsAt({ height: 720, width: 1280 });
    expect(selectedPanelMaxHeight(fit, 389)).toBe(255);
    expect(selectedPanelMaxHeight(fit, 369)).toBe(235);
    expect(selectedPanelMaxHeight(fit, fit.y)).toBe(0);
  });

  it("pans a selected chip clear of the panel at once, and orders places for reading", () => {
    const { field, fit, inner } = regionsAt(BASE);
    const view = { centre: { x: 0, y: 0 }, scale: 0.02, worldSide: SIDE };
    const panelTop = 250;
    const low = { x: 3000, y: 3000 };
    const cleared = keepClear(fit, inner, field, panelTop, low, view);
    const at = toScreen(inner, cleared, low);
    expect(at.y + 19).toBeLessThanOrEqual(panelTop - 8 + 1e-6);
    expect(keepClear(fit, inner, field, null, { x: 0, y: 0 }, view)).toEqual(view);
    expect(
      readingOrder([
        { x: 5, y: 2 },
        { x: 1, y: 2 },
        { x: 9, y: 1 },
      ]),
    ).toEqual([
      { x: 9, y: 1 },
      { x: 1, y: 2 },
      { x: 5, y: 2 },
    ]);
  });
});

describe("fog and Ada", () => {
  it("colours each galaxy's fog as Art's table: the mean of environment and its detail", () => {
    const fields = readGalaxyFields(
      JSON.parse(
        readFileSync(new URL("../../../public/art/galaxies.json", import.meta.url), "utf8"),
      ),
    );
    const fog = (galaxy: GalaxyNumber) => {
      const field = { ...FALLBACK_SPACE_PALETTE, ...fields.get(galaxy) };
      return fogColor(field.environment, field.environmentDetail);
    };
    // Sunflower, Cartwheel, Whirlpool and Phantom.
    expect(([1, 2, 3, 6] as const).map(fog)).toEqual(["#c2b37f", "#9f7f73", "#9cb4aa", "#6c6072"]);
  });

  it("reveals an ellipse twice as wide as it is tall with a floored feather", () => {
    const reveal = fogReveal(0.005);
    expect(reveal.rx).toBeCloseTo(1500 * Math.SQRT2 * 0.005);
    expect(reveal.ry).toBeCloseTo(reveal.rx / 2);
    expect(reveal.sigma).toBe(3);
    expect(fogReveal(0.04).sigma).toBeCloseTo(0.16 * 1500 * Math.SQRT2 * 0.04);
  });

  it("points Ada's arrow along her projected facing", () => {
    expect(adaAngle({ x: 1, y: -1 })).toBeCloseTo(0);
    expect(adaAngle({ x: 1, y: 1 })).toBeCloseTo(Math.PI / 2);
  });
});

describe("the square bound", () => {
  const { field, fit, inner } = regionsAt(BASE);
  const wide = regionsAt({ height: 720, width: 1280 });

  it("projects all four unwrapped tips as the map pans, zooms, and refits", () => {
    const worldSide = 240_000;
    const region = { height: 240, width: 640, x: 78, y: 65 };
    const view = { centre: { x: 60_000, y: -30_000 }, scale: 0.002, worldSide };
    expect(mapWorldDiamond(region, view)).toEqual([
      { x: 278, y: 5 },
      { x: 758, y: 245 },
      { x: 278, y: 485 },
      { x: -202, y: 245 },
    ]);
    expect(
      mapWorldDiamond(
        { height: 300, width: 800, x: 78, y: 65 },
        { ...view, centre: { x: 0, y: 30_000 }, scale: 0.004 },
      ),
    ).toEqual([
      { x: 478, y: -385 },
      { x: 1438, y: 95 },
      { x: 478, y: 575 },
      { x: -482, y: 95 },
    ]);
  });

  const tolerance = 1e-3;
  /** The view's projected extent across the whole field. */
  const extent = (frame: { field: Rect; inner: Rect }, view: MapView) => {
    const mid = {
      x: frame.inner.x + frame.inner.width / 2,
      y: frame.inner.y + frame.inner.height / 2,
    };
    return {
      bottom: view.centre.y + (frame.field.y + frame.field.height - mid.y) / view.scale,
      left: view.centre.x + (frame.field.x - mid.x) / view.scale,
      right: view.centre.x + (frame.field.x + frame.field.width - mid.x) / view.scale,
      top: view.centre.y + (frame.field.y - mid.y) / view.scale,
    };
  };
  /** The view's edge inside the square's projected extent, and its centre inside the diamond. */
  const expectInside = (frame: { field: Rect; inner: Rect }, view: MapView) => {
    const side = view.worldSide;
    const at = extent(frame, view);
    expect(at.left).toBeGreaterThanOrEqual(-side - tolerance);
    expect(at.right).toBeLessThanOrEqual(side + tolerance);
    expect(at.top).toBeGreaterThanOrEqual(-side / 2 - tolerance);
    expect(at.bottom).toBeLessThanOrEqual(side / 2 + tolerance);
    expect(Math.abs(view.centre.x) / 2 + Math.abs(view.centre.y)).toBeLessThanOrEqual(
      side / 2 + tolerance,
    );
  };
  /** Every zoom step from minScale to maxScale, and maxScale. */
  const zoomLevels = (frame: { field: Rect; inner: Rect }, side = SIDE) => {
    const { max, min } = scaleLimits(frame.inner, frame.field, side);
    const levels: number[] = [];
    for (let scale = min; scale < max; scale *= MAP_SCREEN.zoomStep) {
      levels.push(scale);
    }
    return [...levels, max];
  };
  // A view movement: the map follows the pointer, so the drag runs the other way.
  const directions = {
    down: { x: 0, y: 1 },
    downLeft: { x: -2, y: 1 },
    downRight: { x: 2, y: 1 },
    left: { x: -1, y: 0 },
    right: { x: 1, y: 0 },
    up: { x: 0, y: -1 },
    upLeft: { x: -2, y: -1 },
    upRight: { x: 2, y: -1 },
  } as const;
  const hard = (direction: Point) => ({ x: -direction.x * 1e7, y: -direction.y * 1e7 });

  it("draws every position at its canonical point in the square", () => {
    const view = { centre: { x: 0, y: 0 }, scale: 0.01, worldSide: SIDE };
    const across = { x: SIDE / 2 + 100, y: -SIDE / 2 - 40 };
    expect(mapImage(view, across)).toEqual({ x: -SIDE / 2 + 100, y: SIDE / 2 - 40 });
    expect(toScreen(inner, view, across)).toEqual(
      toScreen(inner, view, { x: -SIDE / 2 + 100, y: SIDE / 2 - 40 }),
    );
  });

  it.each(Object.entries(directions))(
    "stops a hard pan %s at the survey oval or the square",
    (name, direction) => {
      for (const frame of [{ field, inner }, wide]) {
        const { min } = scaleLimits(frame.inner, frame.field, SIDE);
        for (const scale of zoomLevels(frame)) {
          const start = { centre: { x: 0, y: 0 }, scale, worldSide: SIDE };
          const panned = panView(frame.inner, frame.field, hard(direction), start);
          expectInside(frame, panned);
          expect(panned.scale).toBe(scale);
          // Panning on in the same direction moves it no further.
          const further = panView(frame.inner, frame.field, hard(direction), panned);
          if (scale === min) {
            expectInside(frame, further);
            expectSurveyArc(frame.field, frame.inner, panned);
            expectSurveyArc(frame.field, frame.inner, further);
            expect(clampView(frame.inner, frame.field, panned)).toEqual(panned);
            continue;
          }
          expect(further.centre.x).toBeCloseTo(panned.centre.x, 3);
          expect(further.centre.y).toBeCloseTo(panned.centre.y, 3);
          const at = extent(frame, panned);
          // Straight pans stop with the view's edge on the diamond's tip.
          if (name === "right") {
            expect(at.right).toBeCloseTo(SIDE, 3);
          }
          if (name === "left") {
            expect(at.left).toBeCloseTo(-SIDE, 3);
          }
          if (name === "up") {
            expect(at.top).toBeCloseTo(-SIDE / 2, 3);
          }
          if (name === "down") {
            expect(at.bottom).toBeCloseTo(SIDE / 2, 3);
          }
          // Diagonal pans stop with the centre on the seam or the edge on the extent.
          if (direction.x !== 0 && direction.y !== 0) {
            const onSeam =
              Math.abs(Math.abs(panned.centre.x) / 2 + Math.abs(panned.centre.y) - SIDE / 2) < 1;
            const onExtent =
              Math.abs(Math.abs(direction.x > 0 ? at.right : at.left) - SIDE) < 1 ||
              Math.abs(Math.abs(direction.y > 0 ? at.bottom : at.top) - SIDE / 2) < 1;
            expect(onSeam || onExtent, `${name} at ${scale}`).toBe(true);
          }
        }
      }
    },
  );

  it("pulls back a diagonal view whose ellipse box overlaps but whose actual oval misses", () => {
    // This extent leaves the survey oval as the tighter bound for the diagonal request.
    const worldSide = 240_000;
    const { min } = scaleLimits(inner, field, worldSide);
    const start = { centre: { x: 0, y: 0 }, scale: min, worldSide };
    const { rx, ry, x, y } = mapSurveyEllipse(inner, start);
    const requested = {
      ...start,
      centre: { x: (x + rx * 0.8) / min, y: (y + ry * 0.8) / min },
    };
    expect(surveyDistances(field, inner, requested).nearest).toBeCloseTo(Math.hypot(0.8, 0.8));
    const view = clampView(inner, field, requested);
    expectInside({ field, inner }, view);
    expectSurveyArc(field, inner, view);
    expect(surveyDistances(field, inner, view).nearest).toBeGreaterThan(0.98);
    expect(clampView(inner, field, start)).toEqual(start);
  });

  it("clamps recentre, keep clear and a direct clamp to the square", () => {
    const view = { centre: { x: 0, y: 0 }, scale: 0.02, worldSide: SIDE };
    const corner = { x: SIDE / 2 - 1, y: SIDE / 2 - 1 };
    expectInside({ field, inner }, recentreView(inner, field, corner, view));
    expectInside({ field, inner }, keepClear(fit, inner, field, 250, corner, view));
    expectInside(
      { field, inner },
      clampView(inner, field, { ...view, centre: { x: 1e9, y: -1e9 } }),
    );
    const { min } = scaleLimits(inner, field, SIDE);
    const atMin = { ...view, scale: min };
    for (const clamped of [
      recentreView(inner, field, corner, atMin),
      keepClear(fit, inner, field, 250, corner, atMin),
      clampView(inner, field, { ...view, centre: { x: 1e9, y: -1e9 }, scale: 0 }),
    ]) {
      expect(clamped.scale).toBe(min);
      expectInside({ field, inner }, clamped);
      expectSurveyArc(field, inner, clamped);
    }
  });

  it("keeps Ada and every place reachable at closer scales, the square's corners included", () => {
    const half = SIDE / 2 - 1;
    const points = [
      { x: 0, y: 0 },
      { x: half, y: half },
      { x: -half, y: -half },
      { x: half, y: -half },
      { x: -half, y: half },
      { x: half, y: 0 },
      { x: 0, y: -half },
      { x: 60_000, y: -110_000 },
    ];
    for (const frame of [{ field, inner }, wide]) {
      for (const scale of zoomLevels(frame).slice(1)) {
        for (const point of points) {
          const view = { centre: { x: 0, y: 0 }, scale, worldSide: SIDE };
          const centred = recentreView(frame.inner, frame.field, point, view);
          expectInside(frame, centred);
          const at = toScreen(frame.inner, centred, point);
          const label = `${point.x},${point.y} at ${scale}`;
          expect(at.x, label).toBeGreaterThanOrEqual(frame.field.x - tolerance);
          expect(at.x, label).toBeLessThanOrEqual(frame.field.x + frame.field.width + tolerance);
          expect(at.y, label).toBeGreaterThanOrEqual(frame.field.y - tolerance);
          expect(at.y, label).toBeLessThanOrEqual(frame.field.y + frame.field.height + tolerance);
        }
      }
    }
  });

  it.each([
    ["the tools, about the fit centre", { x: fit.x + fit.width / 2, y: fit.y + fit.height / 2 }],
    ["the wheel, about a pointer at the left", { x: 20, y: 100 }],
    ["the wheel, about a pointer at the bottom right", { x: 700, y: 340 }],
  ])("re-centres zooming out near each edge with %s", (_input, anchor) => {
    const { max, min } = scaleLimits(inner, field, SIDE);
    for (const direction of Object.values(directions)) {
      const start = { centre: { x: 0, y: 0 }, scale: max, worldSide: SIDE };
      let view = panView(inner, field, hard(direction), start);
      for (let step = 0; step < 20; step++) {
        const zoomed = zoomView(inner, field, 1 / MAP_SCREEN.zoomStep, anchor, view);
        if (zoomed.refused) {
          break;
        }
        view = zoomed.view;
        expectInside({ field, inner }, view);
      }
      expect(view.scale).toBeCloseTo(min, 9);
      expectSurveyArc(field, inner, view);
      expect(zoomView(inner, field, 1 / MAP_SCREEN.zoomStep, anchor, view).refused).toBe(true);
    }
  });

  it("pinches out near an edge inside the square", () => {
    const { max, min } = scaleLimits(inner, field, SIDE);
    const start = { centre: { x: 0, y: 0 }, scale: max, worldSide: SIDE };
    let view = panView(inner, field, hard(directions.upLeft), start);
    for (let step = 0; step < 40; step++) {
      const zoomed = zoomView(inner, field, 0.8, { x: 100, y: 60 }, view).view;
      view = panView(inner, field, { x: 15, y: 9 }, zoomed);
      expectInside({ field, inner }, view);
    }
    expect(view.scale).toBeCloseTo(min, 9);
    expectSurveyArc(field, inner, view);
  });

  it("caps zoom-out at the charting disc while the square is larger than the view", () => {
    for (const frame of [{ field, inner }, wide]) {
      const { min } = scaleLimits(frame.inner, frame.field, SIDE);
      const disc = Math.min(
        frame.inner.width / (2 * Math.SQRT2 * MAP_SCREEN.chartRadius),
        frame.inner.height / (Math.SQRT2 * MAP_SCREEN.chartRadius),
      );
      expect(min).toBe(disc);
      const capped = clampView(frame.inner, frame.field, {
        centre: { x: 0, y: 0 },
        scale: 0,
        worldSide: SIDE,
      });
      expect(capped.scale).toBe(disc);
    }
  });

  it("fills the view with the square on its limiting axis when the square is smaller", () => {
    const side = 20_000;
    for (const frame of [{ field, inner }, wide]) {
      const { min } = scaleLimits(frame.inner, frame.field, side);
      const limiting = Math.max(frame.field.width / (2 * side), frame.field.height / side);
      expect(min).toBeCloseTo(limiting, 12);
      for (const direction of Object.values(directions)) {
        const start = { centre: { x: 0, y: 0 }, scale: min, worldSide: side };
        const view = panView(frame.inner, frame.field, hard(direction), start);
        expectInside(frame, view);
        const at = extent(frame, view);
        const across = (at.right - at.left) / (2 * side);
        const down = (at.bottom - at.top) / side;
        expect(Math.max(across, down)).toBeCloseTo(1, 6);
      }
      const out = zoomView(
        frame.inner,
        frame.field,
        1 / MAP_SCREEN.zoomStep,
        { x: 10, y: 10 },
        { centre: { x: 0, y: 0 }, scale: min * 1.2, worldSide: side },
      ).view;
      expect(out.scale).toBeCloseTo(min, 12);
      expectInside(frame, out);
    }
    // The base field is 2:1 like the square, so the square fills it on both axes.
    const base = clampView(inner, field, { centre: { x: 0, y: 0 }, scale: 0, worldSide: side });
    const at = extent({ field, inner }, base);
    expect([at.right - at.left, at.bottom - at.top].map((value) => round(value, 6))).toEqual([
      2 * side,
      side,
    ]);
  });

  it("opens at minScale with the oval in view and places on their canonical sides", () => {
    const player = { x: SIDE / 2 - 500, y: 0 };
    const across = { x: -SIDE / 2 + 500, y: 0 };
    const view = openingView(inner, field, SIDE, [across], player);
    expectInside({ field, inner }, view);
    const ada = toScreen(inner, view, player);
    expectSurveyArc(field, inner, view);
    // The place draws at its canonical point, a square's width from Ada on the map.
    expect(toScreen(inner, view, across).x).toBeLessThan(ada.x);
  });

  it("keeps the oval in the minScale opening fit and Ada on screen at closer openings", () => {
    const half = SIDE / 2;
    const steps = 24;
    const wrap = (point: Point) => mapImage({ worldSide: SIDE }, point);
    const failures: string[] = [];
    let outsideInner = 0;
    // Ada at each depth inside each of the square's four edges, swept along it; the ends of each
    // sweep are the corner, which projects to the diamond's tips.
    const positions: { readonly ada: Point; readonly depth: number; readonly out: Point }[] = [];
    for (const depth of [1, 300, 3000]) {
      for (let step = 0; step <= steps; step++) {
        const along = -half + depth + ((SIDE - 2 * depth) * step) / steps;
        positions.push(
          { ada: { x: half - depth, y: along }, depth, out: { x: 1, y: 0 } },
          { ada: { x: -half + depth, y: along }, depth, out: { x: -1, y: 0 } },
          { ada: { x: along, y: half - depth }, depth, out: { x: 0, y: 1 } },
          { ada: { x: along, y: -half + depth }, depth, out: { x: 0, y: -1 } },
        );
      }
    }
    for (const frame of [{ field, fit, inner }, wide]) {
      const { min } = scaleLimits(frame.inner, frame.field, SIDE);
      for (const { ada, depth, out } of positions) {
        // Places 1500 past the nearest seam and past both nearest seams, which draw at the
        // square's far edges, and one beside Ada.
        const jump = depth + 1500;
        const across = wrap({ x: ada.x + out.x * jump, y: ada.y + out.y * jump });
        const past = (value: number) => Math.sign(value) * (half - Math.abs(value) + 1500);
        const corner = wrap({ x: ada.x + past(ada.x), y: ada.y + past(ada.y) });
        const beside = { x: ada.x - out.x * 400, y: ada.y - out.y * 400 };
        for (const [kind, places] of [
          ["across", [across, corner]],
          ["beside", [beside]],
          ["alone", []],
        ] as const) {
          const view = openingView(frame.inner, frame.field, SIDE, places, ada);
          expectInside(frame, view);
          const at = toScreen(frame.inner, view, ada);
          const shown =
            at.x >= frame.field.x - tolerance &&
            at.x <= frame.field.x + frame.field.width + tolerance &&
            at.y >= frame.field.y - tolerance &&
            at.y <= frame.field.y + frame.field.height + tolerance;
          if (view.scale === min) {
            expectSurveyArc(frame.field, frame.inner, view);
          } else if (!shown) {
            failures.push(`${frame.field.width}x${frame.field.height} ${kind} ${ada.x},${ada.y}`);
          }
          const inInner =
            at.x >= frame.inner.x - tolerance &&
            at.x <= frame.inner.x + frame.inner.width + tolerance &&
            at.y >= frame.inner.y - tolerance &&
            at.y <= frame.inner.y + frame.inner.height + tolerance;
          outsideInner += inInner ? 0 : 1;
          if (kind === "across") {
            // The seam spreads the box across the square, so the opening is at minScale.
            expect(view.scale).toBeCloseTo(min, 12);
          }
        }
      }
    }
    expect(failures).toEqual([]);
    // Near a tip the clamp can move Ada out of the inner region.
    expect(outsideInner).toBeGreaterThan(0);
  });
});
