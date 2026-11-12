import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import type { SectorId } from "../../data/types.ts";
import { FALLBACK_SPACE_PALETTE, readGalaxyFields } from "../../game/space-palette.ts";
import { hitAround, pressedArea } from "./hitAreas.ts";
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
  mapEarthRect,
  mapHeaderCap,
  mapHeaderWidth,
  mapProjection,
  mapQuestsRect,
  openingView,
  panelMaxWidth,
  panLimit,
  readingOrder,
  recentreView,
  scaleLimits,
  toolColumnLeft,
  toScreen,
  zoomView,
} from "./mapScreen.ts";
import {
  HUD_BUTTON_INSET,
  hudRect,
  logicalView,
  NO_INSETS,
  safeInsets,
  safeRect,
  viewScale,
} from "./playView.ts";
import { BUTTON_GAP, SMALL_BUTTON_GAP, SPACING } from "./tokens.ts";

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
        height: 48,
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

  it("use Art's 13 glyphs, each a shipped map-*.svg", () => {
    const glyphs = [
      ...Object.values(MAP_GLYPHS).filter((glyph) => glyph !== null),
      ...MAP_TOOLS.map(({ glyph }) => glyph),
    ];
    expect(new Set(glyphs).size).toBe(13);
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
    expect([base.fit.width, base.fit.height]).toEqual([643.5, 283.5]);
    expect([base.inner.width, base.inner.height]).toEqual([599.5, 239.5]);
    const limits = scaleLimits(base.inner);
    expect(round(limits.max, 5)).toBe(0.03992);
    expect(round(limits.min, 5)).toBe(0.00677);
    expect(round(Math.log(limits.max / limits.min) / Math.log(MAP_SCREEN.zoomStep), 2)).toBe(4.37);
    const wide = regionsAt({ height: 720, width: 1280 });
    expect([wide.fit.width, round(wide.fit.height, 2)]).toEqual([643.5, 328.5]);
    expect(round(scaleLimits(wide.inner).max, 5)).toBe(0.04742);
  });

  it("puts Quests then Return to Earth on the HUD row, 24 left of the close disc, capping the header", () => {
    // 720 logical with phone insets of 43 at each side.
    const phone = { bottom: 0, left: 43, right: 43, top: 0 };
    expect(MAP_SCREEN.hudRow).toEqual({
      earth: { width: 148.5 },
      gap: BUTTON_GAP,
      height: 48,
      quests: { width: 86.25 },
      right: 33 + SMALL_BUTTON_GAP,
    });
    const span = (rect: { width: number; x: number }) => [rect.x, rect.x + rect.width];
    // Art's table: Quests 400.25 to 486.5 and Return to Earth 502.5 to 651 at the base, 369.25 to
    // 455.5 and 471.5 to 620 with phone insets.
    expect(span(mapQuestsRect(NO_INSETS, BASE))).toEqual([400.25, 486.5]);
    expect(span(mapEarthRect(NO_INSETS, BASE))).toEqual([502.5, 651]);
    expect(span(mapQuestsRect(phone, BASE))).toEqual([369.25, 455.5]);
    expect(span(mapEarthRect(phone, BASE))).toEqual([471.5, 620]);
    // Return to Earth, a standard button, ends SMALL_BUTTON_GAP left of the close tool's small disc,
    // and Quests ends BUTTON_GAP left of it.
    const hud = hudRect(phone, BASE);
    const closeDisc = toolColumnLeft(phone, BASE) + HUD_BUTTON_INSET.disc;
    expect(closeDisc).toBe(hud.x + hud.width - 33);
    expect(closeDisc - (mapEarthRect(phone, BASE).x + 148.5)).toBe(SMALL_BUTTON_GAP);
    expect(mapEarthRect(phone, BASE).x - (mapQuestsRect(phone, BASE).x + 86.25)).toBe(BUTTON_GAP);
    expect(mapQuestsRect(phone, BASE).y).toBe(mapEarthRect(phone, BASE).y);
    // The header reaches Quests less SPACING.gap: 380.25 at the base, 318.25 with phone insets.
    expect(mapHeaderCap(NO_INSETS, BASE)).toBe(380.25);
    expect(mapHeaderCap(phone, BASE)).toBe(318.25);
  });

  it("stacks the pips over the percent: the widest header is 279.8 and the cap holds 18 pips", () => {
    const { header } = MAP_SCREEN;
    expect([header.stackTop, header.stackGap, header.labelTop]).toEqual([9, 4, 14]);
    // The column tops at stackTop: 6 pips, the gap and the 20 line centre on the 48 row.
    expect(header.stackTop).toBe((header.height - (header.pip + header.stackGap + 20)) / 2);
    // "Sunflower" (116.0), "100% mapped" (106.8) and 12 pips (94).
    expect(mapHeaderWidth(116, 106.8, 12)).toBeCloseTo(279.8, 9);
    expect(mapHeaderWidth(116, 0, 12)).toBe(32 + 116 + 25 + 94);
    expect(mapHeaderWidth(116, 106.8, 0)).toBeCloseTo(279.8, 9);
    const cap = mapHeaderCap({ bottom: 0, left: 43, right: 43, top: 0 }, BASE);
    expect(mapHeaderWidth(116, 106.8, 18)).toBeLessThanOrEqual(cap);
    expect(mapHeaderWidth(116, 106.8, 19)).toBeGreaterThan(cap);
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

  it("keeps the centred place panel a gap clear of the tool column: 599 at the 720 base", () => {
    expect(toolColumnLeft(NO_INSETS, BASE)).toBe(667.5);
    expect(panelMaxWidth(NO_INSETS, BASE)).toBe(599);
    for (const [css, cssInsets] of [
      [
        { height: 390, width: 844 },
        { bottom: 21, left: 47, right: 47, top: 0 },
      ],
      [{ height: 720, width: 1280 }, NO_INSETS],
      [
        { height: 390, width: 844 },
        { bottom: 0, left: 47, right: 0, top: 0 },
      ],
    ] as const) {
      const view = logicalView(css);
      const insets = safeInsets(cssInsets, viewScale(css));
      const page = safeRect(insets, SPACING.pageInset, view);
      const width = panelMaxWidth(insets, view);
      const centre = page.x + page.width / 2;
      expect(width).toBeLessThanOrEqual(page.width);
      expect(centre + width / 2).toBeCloseTo(
        Math.min(page.x + page.width, toolColumnLeft(insets, view) - SPACING.gap),
        9,
      );
    }
  });

  it("opens on the box of Ada and every place, clamped between the disc and the minimum box", () => {
    const { inner } = regionsAt(BASE);
    const { max, min } = scaleLimits(inner);
    // Close places: the minimum box clamps to maxScale, its centre at the inner centre.
    const close = openingView(inner, [{ x: 500, y: 0 }], { x: 0, y: 0 });
    expect(close.scale).toBeCloseTo(max);
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
    expect(hitAround(art).width).toBe(MAP_SYMBOL.hit);
    const areas = [
      { art: chipRect({ x: 100, y: 100 }), key: "a" },
      { art: chipRect({ x: 112, y: 100 }), key: "b" },
    ].map(({ art: rect, key }) => ({ art: rect, hit: hitAround(rect), key }));
    expect(pressedArea(areas, { x: 101, y: 100 })).toBe("a");
    expect(pressedArea(areas, { x: 111, y: 100 })).toBe("b");
  });

  it("separate at full zoom for places at least 1020 apart, in every direction", () => {
    const { inner } = regionsAt(
      { height: 390, width: 844 },
      { bottom: 21, left: 47, right: 47, top: 0 },
    );
    const { max } = scaleLimits(inner);
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
    const fog = (galaxy: SectorId) => {
      const field = { ...FALLBACK_SPACE_PALETTE, ...fields.get(galaxy) };
      return fogColor(field.environment, field.environmentDetail);
    };
    // Sunflower, Cartwheel, Whirlpool and Black Eye.
    expect(([1, 2, 3, 6] as const).map(fog)).toEqual(["#c2b37f", "#4c3430", "#254046", "#392535"]);
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
