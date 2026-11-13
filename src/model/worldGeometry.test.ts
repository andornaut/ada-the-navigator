import { describe, expect, it } from "vitest";

import { CONTENT } from "../data/content.ts";
import { ECONOMY } from "../data/economy.ts";
import { ORE_FIELDS } from "../data/galaxyFeatures.ts";
import { GALAXY_SIDE } from "../data/world.ts";
import {
  canonicalCell,
  canonicalCellKey,
  nearestImage,
  wrapCoordinate,
  wrappedDelta,
  wrappedDistance,
  wrappedDistanceSquared,
  wrapPoint,
} from "./worldGeometry.ts";

describe("finite torus coordinates", () => {
  it("uses the approved extent without coupling density or active budgets to its area", () => {
    expect(GALAXY_SIDE / CONTENT.tuning.chunkSize).toBe(2250);
    expect(GALAXY_SIDE % ECONOMY.station.cellSize).toBe(0);
    expect(GALAXY_SIDE % ORE_FIELDS.cellSize).toBe(0);
  });

  it.each([
    [5, -5],
    [-5, -5],
    [15, -5],
    [-15, -5],
    [26, -4],
    [-26, 4],
    [0, 0],
    [-0, 0],
  ])("normalizes coordinate %s to %s", (value, expected) => {
    expect(wrapCoordinate(10, value)).toBe(expected);
  });

  it("wraps both axes at once without moving or mutating the input", () => {
    const point = Object.freeze({ x: 6.25, y: -6.25 });
    expect(wrapPoint(10, point)).toEqual({ x: -3.75, y: 3.75 });
    expect(point).toEqual({ x: 6.25, y: -6.25 });
    expect(wrapCoordinate(10, -5.125)).toBe(4.875);
  });

  it("measures seam neighbors and exact half-period ties reciprocally", () => {
    const a = { x: 4.75, y: -4.75 };
    const b = { x: -4.75, y: 4.75 };
    expect(wrappedDelta(10, a, b)).toEqual({ x: 0.5, y: -0.5 });
    expect(wrappedDelta(10, b, a)).toEqual({ x: -0.5, y: 0.5 });
    expect(wrappedDistanceSquared(10, a, b)).toBe(0.5);
    expect(wrappedDistance(10, a, b)).toBeCloseTo(Math.sqrt(0.5));
    expect(wrappedDelta(10, { x: -2.5, y: 2.5 }, { x: 2.5, y: -2.5 })).toEqual({ x: 5, y: -5 });
    expect(wrappedDelta(10, { x: 2.5, y: -2.5 }, { x: -2.5, y: 2.5 })).toEqual({ x: -5, y: 5 });
  });

  it("is invariant under whole-world translations and canonicalizing twice", () => {
    for (const period of [-4, -1, 0, 1, 4]) {
      const point = { x: 3.25 + period * 10, y: -4.5 - period * 10 };
      const canonical = wrapPoint(10, point);
      expect(wrapPoint(10, canonical)).toEqual(canonical);
      expect(canonical).toEqual({ x: 3.25, y: -4.5 });
      expect(wrappedDelta(10, point, { x: -4.75, y: 4.5 })).toEqual({ x: 2, y: -1 });
    }
  });

  it("keeps corner-crossing motion local through an explicit image offset", () => {
    const reference = Object.freeze({ x: 4.875, y: 4.75 });
    const target = Object.freeze({ x: -4.875, y: -4.75 });
    const image = nearestImage(10, reference, target);
    expect(image).toEqual({ offset: { x: 10, y: 10 }, point: { x: 5.125, y: 5.25 } });
    expect(wrappedDelta(10, reference, target)).toEqual({ x: 0.25, y: 0.5 });
    expect(wrapPoint(10, image.point)).toEqual(target);
    // One anchor translation keeps authored path vertices in the same continuous local chart.
    const localVertices = [
      { x: 0, y: 0 },
      { x: 0.5, y: -0.25 },
    ];
    expect(
      localVertices.map((at) => ({ x: image.point.x + at.x, y: image.point.y + at.y })),
    ).toEqual([
      { x: 5.125, y: 5.25 },
      { x: 5.625, y: 5 },
    ]);
    expect(target).toEqual({ x: -4.875, y: -4.75 });
  });

  it.each([0, -1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])(
    "rejects invalid extent %s",
    (side) => {
      expect(() => wrapPoint(side, { x: 0, y: 0 })).toThrow(RangeError);
      expect(() => canonicalCell(side, { x: 0, y: 0 })).toThrow(RangeError);
    },
  );

  it.each([NaN, Infinity, -Infinity, Number.MAX_SAFE_INTEGER])(
    "rejects invalid coordinate %s before producing a vector",
    (value) => {
      expect(() => wrappedDelta(10, { x: 0, y: 0 }, { x: value, y: 0 })).toThrow(RangeError);
      expect(() => nearestImage(10, { x: value, y: 0 }, { x: 0, y: 0 })).toThrow(RangeError);
    },
  );
});

describe("canonical torus cell identity", () => {
  it("aliases seam and negative cells to one signed identity without changing near-origin seeds", () => {
    expect(canonicalCell(2250, { x: 1125, y: -1126 })).toEqual({ x: -1125, y: 1124 });
    expect(canonicalCellKey(2250, { x: 0, y: -1 })).toBe("0,-1");
    for (const index of [-4501, -2251, -1126, -1125, -1, 0, 1124, 1125, 2250, 4501]) {
      const point = { x: index, y: -index };
      const canonical = canonicalCell(2250, point);
      expect(canonicalCellKey(2250, point)).toBe(
        canonicalCellKey(2250, { x: index + 2250, y: -index - 2250 }),
      );
      expect(canonicalCell(2250, canonical)).toEqual(canonical);
      expect(canonical.x).toBeGreaterThanOrEqual(-1125);
      expect(canonical.x).toBeLessThan(1125);
    }
  });

  it("handles odd cell periods, singleton grids and maximum safe indices", () => {
    expect(canonicalCell(3, { x: 2, y: -2 })).toEqual({ x: -1, y: 1 });
    expect(canonicalCell(1, { x: 8, y: -3 })).toEqual({ x: 0, y: 0 });
    expect(canonicalCell(3, { x: Number.MAX_SAFE_INTEGER, y: -Number.MAX_SAFE_INTEGER })).toEqual({
      x: 1,
      y: -1,
    });
    expect(canonicalCellKey(2250, { x: -0, y: 0 })).toBe("0,0");
    expect(() => canonicalCell(2250, { x: 0.5, y: 0 })).toThrow(RangeError);
  });
});
