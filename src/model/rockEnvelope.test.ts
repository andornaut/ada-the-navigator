import { describe, expect, it, vi } from "vitest";

import { ASTEROID_SHAPES } from "./asteroids.ts";
import * as convex from "./convex.ts";
import { drawnRock, rocksOverlap, type Spaced } from "./rockSpacing.ts";

const rock = (asteroid: string, x = 0, y = 0, kind: "resource" | "rock" = "rock"): Spaced => ({
  asteroid,
  kind,
  x,
  y,
});
const reference = (a: Spaced, b: Spaced) => {
  const first = drawnRock(a)!;
  const second = drawnRock(b)!;
  const offset = convex.toScreen({ x: b.x - a.x, y: b.y - a.y });
  return (
    Math.hypot(offset.x, offset.y) < first.reach + second.reach &&
    convex.grown(first.parts, second.parts).some((part) => convex.inside(part, offset))
  );
};

describe("prepared rock envelopes", () => {
  it("reuses ordered immutable geometry across movement and prepares distinct silhouettes independently", () => {
    const grown = vi.spyOn(convex, "grown");
    try {
      rocksOverlap(rock("asteroid-s2"), rock("asteroid-m3"));
      expect(grown).toHaveBeenCalledTimes(1);
      rocksOverlap(rock("asteroid-s2", 1, 2), rock("asteroid-m3", 3, 4));
      expect(grown).toHaveBeenCalledTimes(1);
      rocksOverlap(rock("asteroid-m3"), rock("asteroid-s2"));
      expect(grown).toHaveBeenCalledTimes(2);
      rocksOverlap(rock("asteroid-s2"), rock("asteroid-m3", 0, 0, "resource"));
      expect(grown).toHaveBeenCalledTimes(3);
    } finally {
      grown.mockRestore();
    }
  });

  it("matches canonical polygon containment for every shape, order, resource silhouette and edge", () => {
    for (const a of ASTEROID_SHAPES.keys()) {
      for (const b of ASTEROID_SHAPES.keys()) {
        for (const kind of ["resource", "rock"] as const) {
          const first = rock(a);
          const second = rock(b, 0, 0, kind);
          const parts = convex.grown(drawnRock(first)!.parts, drawnRock(second)!.parts);
          const limit = drawnRock(first)!.reach + drawnRock(second)!.reach;
          const points = [
            { x: limit, y: 0 },
            { x: -limit, y: 0 },
            { x: 0, y: limit },
            { x: 0, y: -limit },
            ...parts.flat(),
            ...[-100, -20, 0, 20, 100].flatMap((x) =>
              [-100, -20, 0, 20, 100].map((y) => ({ x, y })),
            ),
          ];
          for (const point of points) {
            for (const delta of [0, -1e-9, 1e-9]) {
              const offset = convex.fromScreen({ x: point.x + delta, y: point.y });
              const moved = { ...second, ...offset };
              expect(rocksOverlap(first, moved)).toBe(reference(first, moved));
            }
          }
        }
      }
    }
  });
});
