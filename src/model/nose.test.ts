import { describe, expect, it } from "vitest";

import { noseOffset, nosePoint, noseScreenOffset, SHIP_NOSE, shipHeading } from "./nose.ts";

const headingDirection = (index: number) => ({
  x: Math.cos((index * Math.PI) / 8),
  y: Math.sin((index * Math.PI) / 8),
});
const project = (v: { x: number; y: number }) => ({ x: v.x - v.y, y: (v.x + v.y) / 2 });
const scale = SHIP_NOSE.display / SHIP_NOSE.frame;

describe("Ada's ship nose", () => {
  it("selects the heading frame Art's ship draws for a facing", () => {
    expect(shipHeading({ x: 1, y: 0 })).toBe(0);
    expect(shipHeading({ x: 0, y: -1 })).toBe(12);
    expect(shipHeading({ x: 1, y: -1 })).toBe(14);
    expect(shipHeading({ x: -1, y: -1 })).toBe(10);
    expect(shipHeading({ x: Math.cos(0.19), y: Math.sin(0.19) })).toBe(0);
    expect(shipHeading({ x: Math.cos(0.2), y: Math.sin(0.2) })).toBe(1);
  });

  it("sits 32 ship units ahead on the hull's mid-plane, 17.1 px right at heading 14", () => {
    const right = noseScreenOffset(14);
    expect(right.x).toBeCloseTo(32 * Math.SQRT2 * (Math.sqrt(3) / 2) * scale, 9);
    expect(right.x).toBeCloseTo(17.15, 2);
    expect(right.y).toBeCloseTo(-2 * scale, 9);
    // Pointing up, the nose is above the centre by its forward reach and its height.
    expect(noseScreenOffset(10).x).toBeCloseTo(0, 9);
    expect(noseScreenOffset(10).y).toBeCloseTo(((-32 * Math.SQRT2) / 2) * scale - 2 * scale, 9);
  });

  it.each(Array.from({ length: 16 }, (_, index) => index))(
    "projects heading %i's world nose offset onto its drawn nose",
    (index) => {
      const facing = headingDirection(index);
      const projected = project(noseOffset(facing));
      const screen = noseScreenOffset(index);
      expect(projected.x).toBeCloseTo(screen.x, 9);
      expect(projected.y).toBeCloseTo(screen.y, 9);
      // Less its height, the drawn nose lies along the ship's own projection of the heading.
      const forward = { x: screen.x, y: screen.y + SHIP_NOSE.z * scale };
      const along = {
        x: (facing.x - facing.y) * (Math.sqrt(3) / 2),
        y: (facing.x + facing.y) / 2,
      };
      expect(forward.x * along.y - forward.y * along.x).toBeCloseTo(0, 9);
      expect(forward.x * along.x + forward.y * along.y).toBeGreaterThan(0);
    },
  );

  it("offsets from Ada's position", () => {
    const facing = headingDirection(6);
    const offset = noseOffset(facing);
    expect(nosePoint(facing, { x: 100, y: -50 })).toEqual({
      x: 100 + offset.x,
      y: -50 + offset.y,
    });
  });
});
