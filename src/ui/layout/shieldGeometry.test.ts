import { describe, expect, it } from "vitest";

import { shieldRasterGeometry } from "./shieldGeometry.ts";

describe("approved shield geometry", () => {
  it.each([
    [1, 1],
    [1280 / 720, 1],
    [390 / 360, 2.6],
    [3, 2.5],
  ])(
    "keeps five gaps and independent fills inside one dark rectangle at unit %s density %s",
    (unit, density) => {
      for (const level of [1, 2, 3]) {
        const g = shieldRasterGeometry(unit, density, { x: 337.375, y: 310.421875 }, level);
        const bg = g.background,
          m = g.main,
          t = g.timer;
        expect([
          m.y - bg.y,
          t.y - m.y - m.height,
          bg.y + bg.height - t.y - t.height,
          m.x - bg.x,
          bg.x + bg.width - m.x - m.width,
        ]).toEqual(Array(5).fill(g.gap));
        expect(g.gap).toBeGreaterThan(0);
        expect(t.x).toBe(m.x);
        expect(t.x + t.width).toBe(m.x + m.width);
        expect(g.fill.x + g.capacityWidth).toBe(m.x + m.width - g.inset);
        expect(m.height - g.fill.height - g.inset).toBe(g.inset);
        expect(bg.x).toBeGreaterThan(0);
        expect(bg.y).toBeGreaterThanOrEqual(0);
        expect(bg.x + bg.width).toBeLessThan(g.width);
        expect(bg.y + bg.height).toBeLessThanOrEqual(g.height);
        expect((337.375 + g.x) * density).toBeCloseTo(Math.round(337.375 * density), 9);
        expect((310.421875 + g.y) * density).toBeCloseTo(Math.round(310.421875 * density), 9);
      }
    },
  );
});
