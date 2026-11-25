import { describe, expect, it } from "vitest";

import weapons from "../../public/art/enemy-weapons.json";
import { toScreen } from "./convex.ts";
import { convexOverlap, MINE_PARTS, MINE_REACH, mineTouches } from "./mineShape.ts";

const square = (half: number) => [
  [
    { x: -half, y: -half },
    { x: half, y: -half },
    { x: half, y: half },
    { x: -half, y: half },
  ],
];
// The world offset whose projection is the screen offset (x - y, (x + y) / 2).
const fromScreen = (screen: { x: number; y: number }) => ({
  x: screen.y + screen.x / 2,
  y: screen.y - screen.x / 2,
});
// The silhouette's farthest vertex on screen.
const farthest = MINE_PARTS.flat().reduce((best, point) =>
  Math.hypot(point.x, point.y) > Math.hypot(best.x, best.y) ? point : best,
);

describe("mine silhouette", () => {
  it("is Art's 36 convex parts over every spin frame, reaching 9.14 px", () => {
    expect(MINE_PARTS).toHaveLength(36);
    expect(MINE_PARTS[0]).toEqual(weapons.mine.collision[0]!.map(([x, y]) => ({ x, y })));
    expect(MINE_REACH).toBeCloseTo(9.142, 3);
    expect(Math.hypot(farthest.x, farthest.y)).toBe(MINE_REACH);
  });

  it("overlaps convex polygons by the separating axis test", () => {
    const [a] = square(1);
    const shifted = (dx: number) => a!.map(({ x, y }) => ({ x: x + dx, y }));
    expect(convexOverlap(a!, shifted(1.9))).toBe(true);
    expect(convexOverlap(a!, shifted(2.1))).toBe(false);
  });

  it("touches a body at its farthest stud sweep and misses one just past it", () => {
    const body = square(0.4);
    const out = { x: farthest.x / MINE_REACH, y: farthest.y / MINE_REACH };
    const at = (distance: number) => fromScreen({ x: out.x * distance, y: out.y * distance });
    expect(toScreen(at(MINE_REACH)).x).toBeCloseTo(farthest.x, 9);
    expect(mineTouches({ x: 0, y: 0 }, body, at(MINE_REACH))).toBe(true);
    expect(mineTouches({ x: 0, y: 0 }, body, at(MINE_REACH + 1))).toBe(false);
    const placed = at(MINE_REACH);
    expect(mineTouches({ x: 100, y: 100 }, body, { x: 100 + placed.x, y: 100 + placed.y })).toBe(
      true,
    );
    expect(mineTouches({ x: 0, y: 0 }, body, { x: 40, y: 0 })).toBe(false);
  });
});
