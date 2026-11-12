import { describe, expect, it } from "vitest";

import weapons from "../../public/art/enemy-weapons.json";
import { toScreen } from "./convex.ts";
import {
  convexOverlap,
  MINE_PARTS,
  MINE_REACH,
  mineParts,
  mineSpin,
  mineTouches,
} from "./mine-shape.ts";

const square = (half: number) => [
  [
    { x: -half, y: -half },
    { x: half, y: -half },
    { x: half, y: half },
    { x: -half, y: half },
  ],
];

describe("mine silhouette", () => {
  it("is Art's 32-sided body and 8 spike triangles at spin 0", () => {
    expect(MINE_PARTS.map((part) => part.length)).toEqual([32, ...Array(8).fill(3)]);
    expect(MINE_PARTS[1]![0]).toEqual({ x: weapons.mine.collision[1]![0]![0], y: 0 });
    expect(MINE_REACH).toBeCloseTo(7.5, 9);
  });

  it("spins 60 degrees a second, held at 0 under reduced motion", () => {
    expect(mineSpin(false, 1.5)).toBeCloseTo(90, 9);
    expect(mineSpin(true, 1.5)).toBe(0);
  });

  it("turns clockwise on screen with the drawing", () => {
    // The first spike's tip at screen right turns to screen down (y grows) at 90 degrees.
    const tip = mineParts(90)[1]![0]!;
    expect(tip.x).toBeCloseTo(0, 9);
    expect(tip.y).toBeCloseTo(7.5, 9);
  });

  it("overlaps convex polygons by the separating axis test", () => {
    const [a] = square(1);
    const shifted = (dx: number) => a!.map(({ x, y }) => ({ x: x + dx, y }));
    expect(convexOverlap(a!, shifted(1.9))).toBe(true);
    expect(convexOverlap(a!, shifted(2.1))).toBe(false);
  });

  it("touches a body by its spikes, which turn with the spin", () => {
    // A small square 7 px right of the mine on screen: the spin-0 spike reaches it, a spike
    // turned 22.5 degrees off it does not.
    const body = square(0.4);
    const screen = { x: 7, y: 0 };
    // The world offset whose projection is the screen offset (x - y, (x + y) / 2).
    const world = { x: screen.y + screen.x / 2, y: screen.y - screen.x / 2 };
    expect(toScreen(world)).toEqual(screen);
    expect(mineTouches(0, { x: 0, y: 0 }, body, world)).toBe(true);
    expect(mineTouches(22.5, { x: 0, y: 0 }, body, world)).toBe(false);
    expect(mineTouches(0, { x: 100, y: 100 }, body, { x: 100 + world.x, y: 100 + world.y })).toBe(
      true,
    );
    expect(mineTouches(0, { x: 0, y: 0 }, body, { x: 40, y: 0 })).toBe(false);
  });
});
