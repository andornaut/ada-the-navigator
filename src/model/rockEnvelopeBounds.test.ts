import { describe, expect, it, vi } from "vitest";

import * as asteroids from "./asteroids.ts";
import { ASTEROID_SHAPES } from "./asteroids.ts";
import { fromScreen, grown, inside } from "./convex.ts";
import { drawnRock, rocksOverlap, type Spaced } from "./rockSpacing.ts";

const rock = (asteroid: string, x = 0, y = 0): Spaced => ({ asteroid, kind: "rock", x, y });

describe("expanded envelope broad phase", () => {
  it("rejects a separated pair inside its coarse circles without evaluating polygon edge signs", () => {
    const a = rock("asteroid-m1"),
      b = rock("asteroid-m2");
    const first = drawnRock(a)!,
      second = drawnRock(b)!;
    const parts = grown(first.parts, second.parts);
    const maximum = Math.max(...parts.flat().map(({ y }) => y));
    const screen = { x: 0, y: (maximum + first.reach + second.reach) / 2 };
    expect(screen.y).toBeLessThan(first.reach + second.reach);
    expect(parts.some((part) => inside(part, screen))).toBe(false);
    rocksOverlap(a, b);
    const sign = vi.spyOn(Math, "sign");
    try {
      expect(rocksOverlap(a, { ...b, ...fromScreen(screen) })).toBe(false);
      expect(sign).not.toHaveBeenCalled();
    } finally {
      sign.mockRestore();
    }
  });

  it("retains canonical degenerate-outline behavior without imposing a new box constraint", () => {
    const line = {
      frames: [
        [
          [
            { x: 0, y: 0 },
            { x: 5, y: 0 },
          ],
        ],
      ],
      reach: 5,
    };
    const silhouette = vi.spyOn(asteroids, "scenerySilhouette").mockReturnValue(line);
    try {
      const offset = fromScreen({ x: 9, y: 0 });
      expect(rocksOverlap(rock("asteroid-s1"), rock("asteroid-s2", offset.x, offset.y))).toBe(true);
    } finally {
      silhouette.mockRestore();
    }
  });

  it("preserves exact containment at every shape pair's bounding edges and adjacent float-scale offsets", () => {
    for (const a of ASTEROID_SHAPES.keys()) {
      for (const b of ASTEROID_SHAPES.keys()) {
        const first = drawnRock(rock(a))!,
          second = drawnRock(rock(b))!;
        const parts = grown(first.parts, second.parts),
          points = parts.flat();
        const x = [Math.min(...points.map(({ x }) => x)), Math.max(...points.map(({ x }) => x))];
        const y = [Math.min(...points.map(({ y }) => y)), Math.max(...points.map(({ y }) => y))];
        for (const sx of [...x, 0]) {
          for (const sy of [...y, 0]) {
            for (const delta of [-1e-12, 0, 1e-12]) {
              const offset = fromScreen({ x: sx + delta, y: sy });
              const screen = { x: offset.x - offset.y, y: (offset.x + offset.y) / 2 };
              const expected =
                Math.hypot(screen.x, screen.y) < first.reach + second.reach &&
                parts.some((part) => inside(part, screen));
              expect(rocksOverlap(rock(a), rock(b, offset.x, offset.y))).toBe(expected);
            }
          }
        }
      }
    }
  });
});
