import { describe, expect, it } from "vitest";

import { EDGE_MARKERS } from "../../data/edgeMarkers.ts";
import type { TargetMarker } from "../../model/targetMarkers.ts";
import { layoutTargetMarkers, type TargetMarkerExtent } from "./targetMarkers.ts";
const size = { height: 24, width: 24 };
const context = {
  area: { height: 360, width: 720, x: 0, y: 0 },
  blocked: [] as {
    height: number;
    width: number;
    x: number;
    y: number;
  }[],
  extent: () => size,
  gap: 4,
  player: { x: 0, y: 0 },
};
const marker = (id: string, x = 4000, y = 0): TargetMarker => ({
  id,
  identified: true,
  symbol: "station",
  x,
  y,
});
const directions = [
  { screen: { x: 1, y: 0 }, world: { x: 1, y: -1 } },
  { screen: { x: -1, y: 0 }, world: { x: -1, y: 1 } },
  { screen: { x: 0, y: 1 }, world: { x: 1, y: 1 } },
  { screen: { x: 0, y: -1 }, world: { x: -1, y: -1 } },
  { screen: { x: 1, y: 1 }, world: { x: 3, y: 1 } },
  { screen: { x: -1, y: -1 }, world: { x: -3, y: -1 } },
  { screen: { x: 1, y: -1 }, world: { x: -1, y: -3 } },
  { screen: { x: -1, y: 1 }, world: { x: 1, y: 3 } },
];
function bearing(
  at: {
    x: number;
    y: number;
  },
  direction: {
    x: number;
    y: number;
  },
) {
  const x = at.x - 360,
    y = at.y - 180;
  expect(x * direction.y - y * direction.x).toBeCloseTo(0, 8);
  expect(x * direction.x + y * direction.y).toBeGreaterThan(0);
}
function contact(
  area: typeof context.area,
  extent: TargetMarkerExtent,
  at: {
    x: number;
    y: number;
  },
) {
  const offset = extent.offset ?? { x: 0, y: 0 };
  const gaps = [
    at.x + offset.x - extent.width / 2 - area.x,
    at.y + offset.y - extent.height / 2 - area.y,
    area.x + area.width - at.x - offset.x - extent.width / 2,
    area.y + area.height - at.y - offset.y - extent.height / 2,
  ];
  expect(Math.min(...gaps)).toBeCloseTo(EDGE_MARKERS.gap, 8);
}
describe("displayed marker bearing", () => {
  it.each([
    { x: 0, y: 0 },
    { x: 12000, y: -8000 },
  ])("keeps every final cardinal/diagonal centre on the actual ray for player %j", (player) => {
    for (const diameter of [6, 8, 12, 14, 24]) {
      for (const { screen, world } of directions) {
        const extent = { height: diameter, width: diameter };
        const target = marker("target", player.x + world.x * 1000, player.y + world.y * 1000);
        const [result] = layoutTargetMarkers(
          { ...context, blocked: [context.area], extent: () => extent, player },
          [target],
        );
        expect(result!.at).toEqual(result!.anchor);
        bearing(result!.at, screen);
        contact(context.area, extent, result!.at);
      }
    }
  });
  it("does not repeat the measured90-unit/28.3-degree HUD displacement of a downward target", () => {
    const [result] = layoutTargetMarkers(
      { ...context, blocked: [{ height: 100, width: 420, x: 150, y: 260 }] },
      [marker("down", 1336, 1336)],
    );
    expect(result!.at).toEqual({ x: 360, y: 347 });
    expect(result!.at).not.toEqual({ x: 270, y: 347 });
    expect(result!.crowded).toBe(true);
    bearing(result!.at, { x: 0, y: 1 });
  });
  it("does not repeat the measured54-unit diagonal slide around a blocking HUD", () => {
    const [clear] = layoutTargetMarkers(context, [marker("diagonal", -2724, 52)]);
    const [blocked] = layoutTargetMarkers({ ...context, blocked: [context.area] }, [
      marker("diagonal", -2724, 52),
    ]);
    expect(blocked!.at).toEqual(clear!.at);
    expect(blocked!.at).toEqual(blocked!.anchor);
    const x = blocked!.at.x - 360,
      y = blocked!.at.y - 180;
    expect(x * -1336 - y * -2776).toBeCloseTo(0, 7);
  });
  it("retains coincident collinear IDs and stable order without separation or deletion", () => {
    const targets = [marker("b", 4000, -4000), marker("a", 2000, -2000)];
    const results = layoutTargetMarkers(context, targets);
    expect(results.map((p) => p.target.id)).toEqual(["a", "b"]);
    expect(results[0]!.at).toEqual(results[1]!.at);
    expect(results[1]!.crowded).toBe(true);
    expect(results).toEqual(layoutTargetMarkers(context, [...targets].reverse()));
  });
  it("cannot change positions through HUD footprints, gap or crowding inputs", () => {
    const target = marker("direction", 3210, -1234);
    const free = layoutTargetMarkers(context, [target])[0]!;
    const covered = layoutTargetMarkers({ ...context, blocked: [context.area], gap: 500 }, [
      target,
    ])[0]!;
    expect(covered.at).toEqual(free.at);
    expect(covered.crowded).toBe(true);
  });
  it("retains full asymmetric native glyph support while keeping its displayed centre on the ray", () => {
    const extent = { height: 24, offset: { x: 0.5, y: 0 }, width: 25 };
    const [result] = layoutTargetMarkers({ ...context, extent: () => extent }, [
      marker("native", 4000, -4000),
    ]);
    expect(result!.at.x + extent.offset.x + extent.width / 2).toBe(719);
    bearing(result!.at, { x: 1, y: 0 });
    contact(context.area, extent, result!.at);
  });
  it.each([1, 8 / 9, 2])(
    "intersects the ray AFTER support-grid alignment at physical scale %s",
    (scale) => {
      const raster = { origin: { x: 45 + 1 / 3, y: 32 }, scale };
      for (const { screen, world } of directions) {
        const [result] = layoutTargetMarkers({ ...context, raster }, [
          marker("ray", world.x * 1000, world.y * 1000),
        ]);
        bearing(result!.at, screen);
        expect(result!.at).toEqual(result!.anchor);
      }
    },
  );
  it("moves an edge inward to the device pixel grid, never a whole CSS px", () => {
    // The reported phone: devicePixelRatio 30 / 11 and 1.0333 CSS px per logical px, turned, so
    // the bottom edge's grid counts from the frame's physical right edge (frameDeviceOrigin).
    const dpr = 30 / 11;
    const scale = (744 / 720) * dpr;
    for (const origin of [
      { x: 0, y: 0 },
      { x: 330, y: -1080 + 11 * scale },
    ]) {
      const raster = { origin, scale };
      const [down] = layoutTargetMarkers({ ...context, raster }, [marker("down", 1336, 1336)]);
      const bottom = down!.at.y + size.height / 2;
      const inward = (360 - EDGE_MARKERS.gap - bottom) * scale;
      expect(inward).toBeGreaterThanOrEqual(0);
      expect(inward).toBeLessThan(1);
      expect(
        Math.abs(origin.y + bottom * scale - Math.round(origin.y + bottom * scale)),
      ).toBeLessThan(1e-6);
    }
  });
  it("keeps an edge already on the device pixel grid in place", () => {
    const raster = { origin: { x: 0, y: 0 }, scale: 2 };
    const [down] = layoutTargetMarkers({ ...context, raster }, [marker("down", 1336, 1336)]);
    expect(down!.at.y + size.height / 2).toBe(360 - EDGE_MARKERS.gap);
  });
  it("keeps bearings through resize rather than moving to another clear edge", () => {
    for (const area of [
      { height: 360, width: 720, x: 0, y: 0 },
      { height: 320, width: 667, x: 0, y: 0 },
    ]) {
      for (const { screen, world } of directions) {
        const [result] = layoutTargetMarkers({ ...context, area, blocked: [area] }, [
          marker("resize", world.x * 1000, world.y * 1000),
        ]);
        bearing(result!.at, screen);
        contact(area, size, result!.at);
      }
    }
  });
});
