import { describe, expect, it } from "vitest";

import { ASTEROID_SHAPES } from "./asteroids.ts";
import { type Parts, partsReach, worldParts } from "./convex.ts";
import { shipSilhouette } from "./nose.ts";

const reference = (parts: Parts) =>
  Math.max(0, ...parts.flatMap((part) => part.map((at) => Math.hypot(at.x, at.y))));

describe("immutable outline reach", () => {
  it("preserves every ship heading and asteroid frame radius in screen and world coordinates", () => {
    const outlines = [
      ...Array.from({ length: 64 }, (_, heading) => shipSilhouette(heading)),
      ...[...ASTEROID_SHAPES.values()].flatMap((shape) => shape.silhouette.frames),
    ];
    for (const outline of outlines) {
      for (const parts of [outline, worldParts(outline)]) {
        expect(partsReach(parts)).toBe(reference(parts));
        expect(partsReach(parts)).toBe(reference(parts));
      }
    }
    expect(partsReach([])).toBe(0);
  });

  it("reads an immutable outline once and independently prepares a replacement identity", () => {
    let reads = 0;
    const outline: Parts = [
      [
        {
          get x() {
            reads++;
            return 3;
          },
          get y() {
            reads++;
            return 4;
          },
        },
      ],
    ];
    expect(partsReach(outline)).toBe(5);
    const preparedReads = reads;
    expect(preparedReads).toBeGreaterThan(0);
    for (let i = 0; i < 100; i++) {
      expect(partsReach(outline)).toBe(5);
    }
    expect(reads).toBe(preparedReads);
    expect(partsReach([[{ x: 6, y: 8 }]])).toBe(10);
  });
});
