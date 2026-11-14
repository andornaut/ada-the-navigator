import { readFileSync } from "node:fs";

import { HIT_RULE, hitAround, pressedArea } from "@andornaut/game-kit/ui/hitAreas";
import { describe, expect, it } from "vitest";

import type { GalaxyNumber } from "../../data/types.ts";
import { FALLBACK_SPACE_PALETTE, readGalaxyFields } from "../../game/spacePalette.ts";
import {
  adaAngle,
  chipRect,
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
  mapCloseRect,
  mapGalaxiesRect,
  mapHeaderCap,
  mapHeaderGeometry,
  mapHeaderWidth,
  mapImage,
  mapProjection,
  mapQuestsRect,
  openingView,
  panelMaxWidth,
  panLimit,
  panView,
  readingOrder,
  recentreView,
  scaleLimits,
  toolColumnLeft,
  toScreen,
  zoomView,
} from "./mapScreen.ts";
import { logicalView, NO_INSETS, safeInsets, safeRect, viewScale } from "./playView.ts";
import { SPACING } from "./tokens.ts";

const BASE = { height: 360, width: 720 };
const regionsAt = (css: { height: number; width: number }, cssInsets = NO_INSETS) => {
  const view = logicalView(css);
  const insets = safeInsets(cssInsets, viewScale(css));
  const fit = fitRegion(insets, view);
  return { fit, inner: innerRegion(fit) };
};
const round = (value: number, digits: number) => Number(value.toFixed(digits));

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
        padding: 16,
        pip: 6,
        pipPitch: 8,
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
    expect(new Set(glyphs).size).toBe(12);
    for (const glyph of glyphs) {
      const svg = readFileSync(
        new URL(`../../../public/art/ui/icons/${glyph}.svg`, import.meta.url),
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
    const limits = scaleLimits(base.inner);
    expect(round(limits.max, 5)).toBe(0.04733);
    expect(round(limits.min, 5)).toBe(0.00441);
    expect(round(Math.log(limits.max / limits.min) / Math.log(MAP_SCREEN.zoomStep), 2)).toBe(5.85);
    const wide = regionsAt({ height: 720, width: 1280 });
    expect([wide.fit.width, round(wide.fit.height, 2)]).toEqual([688, 245]);
    expect(round(scaleLimits(wide.inner).max, 5)).toBe(0.05367);
  });

  it("anchors Quests, Galaxies and the sole primary Close at the bottom right", () => {
    expect(mapQuestsRect(NO_INSETS, BASE)).toEqual({ height: 48, width: 98, x: 378, y: 296 });
    expect(mapGalaxiesRect(NO_INSETS, BASE)).toEqual({ height: 48, width: 98, x: 492, y: 296 });
    expect(mapCloseRect(NO_INSETS, BASE)).toEqual({ height: 48, width: 98, x: 606, y: 296 });
    const phone = { bottom: 19, left: 43, right: 43, top: 0 };
    expect(mapCloseRect(phone, BASE)).toEqual({ height: 48, width: 98, x: 579, y: 293 });
    expect(MAP_TOOLS.map(({ id }) => id)).toEqual(["zoomOut", "zoomIn", "recentre"]);
    expect(toolColumnLeft(NO_INSETS, BASE)).toBe(542);
    expect(mapHeaderCap(NO_INSETS, BASE)).toBe(518);
  });

  it("uses one equal ink gap for title, divider, percent, pips and both outer edges", () => {
    // Synthetic measured ink widths: content 260 plus five equal 24 gaps fills a 380 header.
    const geometry = mapHeaderGeometry(100, 65, 12, 348);
    expect(geometry).toEqual({ gap: 24, width: 380 });
    expect(mapHeaderWidth(100, 65, 12, 348)).toBe(380);
    expect(mapHeaderGeometry(100, 65, 0, 348)).toEqual({ gap: 54, width: 382 });
    expect(mapHeaderWidth(100, 65, 12, 600)).toBe(635);
  });

  it("sets the Quests lines: a 28 chip overhanging the 20 label by 4, text from 50", () => {
    expect(MAP_SCREEN.quests).toEqual({
      chip: MAP_SYMBOL.chip,
      lineGap: 8,
      markGap: 6,
      overhang: (MAP_SYMBOL.chip - 20) / 2,
      ring: 1,
      textColumn: 50,
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
    const { inner } = regionsAt(BASE);
    const { max, min } = scaleLimits(inner);
    // The opening fits the minimum box inside reserved chrome; further zoom remains available.
    const close = openingView(inner, [{ x: 500, y: 0 }], { x: 0, y: 0 });
    expect(close.scale).toBeCloseTo(0.026);
    expect(close.scale).toBeLessThan(max);
    // A spread galaxy fits between the limits.
    const spread = [
      { x: 12000, y: -12000 },
      { x: -12000, y: 12000 },
    ];
    const fitted = openingView(inner, spread, { x: 0, y: 0 });
    expect(fitted.scale).toBeGreaterThan(min);
    expect(fitted.scale).toBeLessThan(max);
    for (const place of spread) {
      const at = toScreen(inner, fitted, place);
      expect(at.x).toBeGreaterThanOrEqual(inner.x - 1e-6);
      expect(at.x).toBeLessThanOrEqual(inner.x + inner.width + 1e-6);
    }
    // A far station: minScale clamps it, and the least pan keeps Ada inside the inner region.
    const far = openingView(inner, [{ x: 200_000, y: -200_000 }], { x: 0, y: 0 });
    expect(far.scale).toBeCloseTo(min);
    const ada = toScreen(inner, far, { x: 0, y: 0 });
    expect(ada.x).toBeGreaterThanOrEqual(inner.x - 1e-6);
    expect(ada.x).toBeLessThanOrEqual(inner.x + inner.width + 1e-6);
    expect(ada.y).toBeGreaterThanOrEqual(inner.y - 1e-6);
    expect(ada.y).toBeLessThanOrEqual(inner.y + inner.height + 1e-6);
  });

  it("zooms by one step about an anchor and refuses at each limit", () => {
    const { inner } = regionsAt(BASE);
    const limit = panLimit([]);
    const { max, min } = scaleLimits(inner);
    const centre = { x: inner.x + inner.width / 2, y: inner.y + inner.height / 2 };
    const start = { centre: { x: 0, y: 0 }, scale: min };
    expect(zoomView(inner, limit, 1 / MAP_SCREEN.zoomStep, centre, start).refused).toBe(true);
    const step = zoomView(inner, limit, MAP_SCREEN.zoomStep, centre, start);
    expect(step.refused).toBe(false);
    expect(step.view.scale).toBeCloseTo(min * 1.5);
    let view = step.view;
    for (let index = 0; index < 10; index++) {
      view = zoomView(inner, limit, MAP_SCREEN.zoomStep, centre, view).view;
    }
    expect(view.scale).toBeCloseTo(max);
    expect(zoomView(inner, limit, MAP_SCREEN.zoomStep, centre, view).refused).toBe(true);
    // The anchor's world point stays under it.
    const anchor = { x: inner.x + 30, y: inner.y + 40 };
    const before = { centre: { x: 1000, y: 500 }, scale: min * 2 };
    const after = zoomView(inner, limit, 1.5, anchor, before).view;
    const world = (view: typeof before) => ({
      x: view.centre.x + (anchor.x - centre.x) / view.scale,
      y: view.centre.y + (anchor.y - centre.y) / view.scale,
    });
    expect(world(after).x).toBeCloseTo(world(before).x);
    expect(world(after).y).toBeCloseTo(world(before).y);
  });

  it("recentres on Ada and keeps the inner centre inside the disc and the places", () => {
    const { inner } = regionsAt(BASE);
    const station = { x: 60_000, y: -60_000 };
    const limit = panLimit([station]);
    const away = recentreView(
      inner,
      limit,
      { x: 5000, y: 0 },
      { centre: { x: 0, y: 0 }, scale: 0.01 },
    );
    expect(away.centre).toEqual(mapProjection({ x: 5000, y: 0 }));
    const projected = mapProjection(station);
    expect(limit.x + limit.width).toBeGreaterThanOrEqual(projected.x);
    const lost = recentreView(
      inner,
      limit,
      { x: 1e7, y: 1e7 },
      { centre: { x: 0, y: 0 }, scale: 0.01 },
    );
    expect(lost.centre.y).toBeLessThanOrEqual(limit.y + limit.height);
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
    const { max } = scaleLimits(inner);
    expect(max).toBeGreaterThanOrEqual(0.039);
    const view = { centre: { x: 0, y: 0 }, scale: max };
    for (let degrees = 0; degrees < 360; degrees += 5) {
      const angle = (degrees * Math.PI) / 180;
      const a = toScreen(inner, view, { x: 0, y: 0 });
      const b = toScreen(inner, view, { x: Math.cos(angle) * 1020, y: Math.sin(angle) * 1020 });
      expect(Math.hypot(a.x - b.x, a.y - b.y), String(degrees)).toBeGreaterThanOrEqual(
        MAP_SYMBOL.chip - 0.05,
      );
    }
  });

  it("pans a selected chip clear of the panel at once, and orders places for reading", () => {
    const { fit, inner } = regionsAt(BASE);
    const view = { centre: { x: 0, y: 0 }, scale: 0.02 };
    const panelTop = 250;
    const low = { x: 3000, y: 3000 };
    const cleared = keepClear(fit, inner, panelTop, low, view);
    const at = toScreen(inner, cleared, low);
    expect(at.y + 19).toBeLessThanOrEqual(panelTop - 8 + 1e-6);
    expect(keepClear(fit, inner, null, { x: 0, y: 0 }, view)).toEqual(view);
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
    expect(([1, 2, 3, 6] as const).map(fog)).toEqual(["#c2b37f", "#4c3430", "#254046", "#362939"]);
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

describe("explicit periodic map views", () => {
  const side = 1_152_000;
  const player = { x: side / 2 - 100, y: side / 2 - 80 };
  const place = { x: -side / 2 + 60, y: -side / 2 + 40 };
  const inner = { height: 300, width: 600, x: 0, y: 0 };
  const limit = panLimit([]);
  const view = { centre: mapProjection(player), scale: 0.02, worldSide: side };

  it("projects one nearest image across both seams without changing the canonical point", () => {
    expect(mapImage(view, place)).toEqual({ x: place.x + side, y: place.y + side });
    expect(toScreen(inner, view, place)).toEqual({ x: 300.8, y: 152.8 });
    const legacy = { centre: view.centre, scale: view.scale };
    expect(mapImage(legacy, place)).toBe(place);
    expect(toScreen(inner, legacy, place).y).toBeLessThan(-20_000);
    expect(place).toEqual({ x: -side / 2 + 60, y: -side / 2 + 40 });
  });

  it("preserves explicit topology through zoom pan recenter and panel clearance", () => {
    const zoomed = zoomView(inner, limit, 1.5, { x: 300, y: 150 }, view).view;
    const panned = panView(inner, limit, { x: -50, y: 40 }, zoomed);
    const centred = recentreView(inner, limit, player, panned);
    const clear = keepClear(inner, inner, 200, place, centred);
    for (const current of [zoomed, panned, centred, clear]) {
      expect(current.worldSide).toBe(side);
    }
    expect(toScreen(inner, centred, player)).toEqual({ x: 300, y: 150 });
    expect(Math.abs(toScreen(inner, clear, place).x - 300)).toBeLessThan(50);
  });
});
