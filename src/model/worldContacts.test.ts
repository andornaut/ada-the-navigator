import { describe, expect, it } from "vitest";

import {
  sceneryBodyContact,
  sceneryContact,
  type Silhouette,
  worldSceneryBlocksSegment,
  worldSceneryBodyContact,
  worldSceneryContact,
} from "./asteroids.ts";
import type { Parts } from "./convex.ts";
import type { SpaceObject } from "./types.ts";
import { worldDelta, worldDistance, worldPoint } from "./worldContacts.ts";

const torus = { worldSide: 1000 };
const square: Parts = [
  [
    { x: -10, y: -10 },
    { x: 10, y: -10 },
    { x: 10, y: 10 },
    { x: -10, y: 10 },
  ],
];
const drawn: Silhouette = { frames: [square], reach: Math.SQRT2 * 10 };
const rock = (x: number, y: number): SpaceObject => ({
  hp: 3,
  id: "one-rock",
  kind: "rock",
  radius: 10,
  x,
  y,
});

describe("explicit world contact operands", () => {
  it("preserves legacy coordinates without inferring a world from their values", () => {
    const a = { x: 498, y: 498 },
      b = { x: -498, y: -498 };
    expect(worldDelta({}, a, b)).toEqual({ x: -996, y: -996 });
    expect(worldDistance({}, a, b)).toBe(Math.hypot(996, 996));
    expect(worldPoint({}, a, b)).toBe(b);
    expect(worldDelta(torus, a, b)).toEqual({ x: 4, y: 4 });
    expect(worldDistance(torus, a, b)).toBe(Math.hypot(4, 4));
    expect(worldPoint(torus, a, b)).toEqual({ x: 502, y: 502 });
  });

  it.each([
    [498, 0, -498, 0],
    [0, 498, 0, -498],
    [498, 498, -498, -498],
  ])("uses one whole circle image across a seam or corner (%s,%s)", (x, y, ox, oy) => {
    const object = Object.freeze(rock(ox, oy));
    const center = { x, y };
    const image = { ...object, ...worldPoint(torus, center, object) };
    expect(sceneryContact(object, center, 2)).toBeNull();
    expect(worldSceneryContact(torus, object, center, 2)).toEqual(sceneryContact(image, center, 2));
    expect(worldSceneryContact(torus, object, center, 2)).not.toBeNull();
    expect(worldSceneryContact({}, object, center, 2)).toBeNull();
    expect(object).toEqual(rock(ox, oy));
  });

  it("keeps authored silhouettes and body vertices local and unchanged", () => {
    const object = Object.freeze(rock(-498, -498));
    const center = { x: 498, y: 498 };
    const body: Parts = [
      [
        { x: -3, y: -3 },
        { x: 3, y: -3 },
        { x: 3, y: 3 },
        { x: -3, y: 3 },
      ],
    ];
    const before = structuredClone({ body, drawn });
    const image = { ...object, x: 502, y: 502 };
    expect(worldSceneryContact(torus, object, center, 2, 0, drawn)).toEqual(
      sceneryContact(image, center, 2, 0, drawn),
    );
    expect(worldSceneryBodyContact(torus, object, center, body, 0, 1, drawn)).toEqual(
      sceneryBodyContact(image, center, body, 0, 1, drawn),
    );
    expect(worldSceneryBodyContact(torus, object, center, body, 0, 1, drawn)).not.toBeNull();
    expect({ body, drawn }).toEqual(before);
    expect(object.x).toBe(-498);
    expect(object.id).toBe("one-rock");
  });

  it.each([false, true])(
    "tests a continuous seam sweep once without wrapping endpoints (corner=%s)",
    (corner) => {
      const object = Object.freeze(rock(-495, corner ? -495 : 0));
      const start = Object.freeze({ x: 490, y: corner ? 490 : 0 });
      const end = Object.freeze({ x: 515, y: corner ? 515 : 0 });
      expect(worldSceneryBlocksSegment(torus, object, start, end, 0)).toBe(true);
      expect(worldSceneryBlocksSegment(torus, object, end, start, 0)).toBe(true);
      expect(worldSceneryBlocksSegment({}, object, start, end, 0)).toBe(false);
      expect(
        worldSceneryBlocksSegment(
          torus,
          object,
          { x: 490, y: 460 },
          { x: 515, y: 460 },
          0,
          0,
          drawn,
        ),
      ).toBe(false);
      expect(end.x).toBe(515);
      expect(object.id).toBe("one-rock");
    },
  );
});
