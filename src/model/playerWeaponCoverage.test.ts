import { describe, expect, it } from "vitest";

import { fromScreen, toScreen } from "./convex.ts";
import { playerWeaponCoverage } from "./playerWeaponCoverage.ts";

const context = { centre: { x: 0, y: 0 }, viewportHeight: 360, viewportWidth: 720 };
const origin = { x: 0, y: 0 };

describe("playerWeaponCoverage", () => {
  it.each([
    [380, 0],
    [-380, 0],
    [0, 260],
    [0, -260],
  ])("reaches the projected cardinal boundary %s,%s in world units", (x, y) => {
    const direction = fromScreen({ x, y });
    expect(playerWeaponCoverage(context, { direction, origin })).toBeCloseTo(
      Math.hypot(direction.x, direction.y),
      10,
    );
  });

  it.each([
    [360, 180],
    [-360, 180],
    [360, -180],
    [-360, -180],
    [1, 0.5],
  ])("intersects the rounded boundary along projected direction %s,%s", (x, y) => {
    const direction = fromScreen({ x, y });
    const length = Math.hypot(direction.x, direction.y);
    const travel = playerWeaponCoverage(context, { direction, origin });
    const endpoint = toScreen({
      x: (travel * direction.x) / length,
      y: (travel * direction.y) / length,
    });
    expect((Math.abs(endpoint.x) / 380) ** 4.4 + (Math.abs(endpoint.y) / 260) ** 4.4).toBeCloseTo(
      1,
      12,
    );
    if (Math.abs(x) === 360) {
      expect(travel).toBeGreaterThan(length);
    }
  });

  it.each([
    [1, 0],
    [0, 1],
    [-1, 0],
    [0, -1],
  ])("uses the isometric metric for world heading %s,%s", (x, y) => {
    const expected = (1 / 380 ** 4.4 + (0.5 / 260) ** 4.4) ** (-1 / 4.4);
    expect(playerWeaponCoverage(context, { direction: { x, y }, origin })).toBeCloseTo(
      expected,
      10,
    );
  });

  it("subtracts the actual muzzle offset along a ray and preserves translated centres", () => {
    const centre = { x: 900, y: -500 };
    const direction = fromScreen({ x: 1, y: 0 });
    const muzzle = fromScreen({ x: 30, y: 0 });
    expect(
      playerWeaponCoverage(
        { ...context, centre },
        {
          direction,
          origin: { x: centre.x + muzzle.x, y: centre.y + muzzle.y },
        },
      ),
    ).toBeCloseTo(350 / Math.SQRT2, 10);
  });

  it("accounts for lateral muzzle displacement instead of subtracting radial distance", () => {
    const muzzle = fromScreen({ x: 0, y: 130 });
    const expectedX = 380 * (1 - 0.5 ** 4.4) ** (1 / 4.4);
    expect(
      playerWeaponCoverage(context, { direction: fromScreen({ x: 1, y: 0 }), origin: muzzle }),
    ).toBeCloseTo(expectedX / Math.SQRT2, 10);
  });

  it("scales each viewport dimension independently", () => {
    const viewport = { ...context, viewportHeight: 180, viewportWidth: 1440 };
    const shot = playerWeaponCoverage(viewport, { direction: fromScreen({ x: 1, y: 0 }), origin });
    expect(shot).toBeCloseTo(760 / Math.SQRT2, 10);
    expect(
      playerWeaponCoverage(viewport, { direction: fromScreen({ x: 0, y: 1 }), origin }),
    ).toBeCloseTo(130 * Math.SQRT2, 10);
  });

  it("allows an inward boundary ray, but gives no outward or outside travel", () => {
    const muzzle = fromScreen({ x: 380, y: 0 });
    expect(
      playerWeaponCoverage(context, { direction: fromScreen({ x: -1, y: 0 }), origin: muzzle }),
    ).toBeCloseTo(760 / Math.SQRT2, 10);
    expect(
      playerWeaponCoverage(context, { direction: fromScreen({ x: 1, y: 0 }), origin: muzzle }),
    ).toBe(0);
    expect(
      playerWeaponCoverage(context, {
        direction: fromScreen({ x: -1, y: 0 }),
        origin: fromScreen({ x: 381, y: 0 }),
      }),
    ).toBe(0);
  });

  it.each([0, -1, NaN, Infinity])("refuses invalid viewport dimension %s", (viewportWidth) => {
    expect(
      playerWeaponCoverage({ ...context, viewportWidth }, { direction: { x: 1, y: 0 }, origin }),
    ).toBe(0);
  });

  it("refuses zero and nonfinite rays", () => {
    expect(playerWeaponCoverage(context, { direction: origin, origin })).toBe(0);
    expect(playerWeaponCoverage(context, { direction: { x: Infinity, y: 1 }, origin })).toBe(0);
  });
});
