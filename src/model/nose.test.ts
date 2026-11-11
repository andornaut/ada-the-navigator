import { describe, expect, it } from "vitest";

import manifest from "../../public/art/manifest.json";
import art from "../../public/art/ship-nose.json";
import {
  noseOffset,
  nosePoint,
  noseScreenOffset,
  readShipNose,
  SHIP_HEADINGS,
  SHIP_NOSE,
  shipHeading,
} from "./nose.ts";

const headingDirection = (index: number) => ({
  x: Math.cos((index * Math.PI) / 16),
  y: Math.sin((index * Math.PI) / 16),
});
const project = (v: { x: number; y: number }) => ({ x: v.x - v.y, y: (v.x + v.y) / 2 });
// The nose is the pyramid hull's forward tip, local (0, -32, 1.2) in frame px (art/ship.md).
const FORWARD = 32;
const HEIGHT = 1.2;

describe("Ada's ship nose", () => {
  it("reads Art's 32 noses from the file the manifest links as shipNose", () => {
    expect(manifest.shipNose).toBe("/art/ship-nose.json");
    expect(SHIP_HEADINGS).toBe(32);
    expect(SHIP_NOSE.frame).toBe(96);
    expect(SHIP_NOSE.displayScale).toBe(0.4375);
    expect(SHIP_NOSE.noses).toHaveLength(32);
    expect(SHIP_NOSE.noses[28]).toEqual({ x: 87.192, y: 46.8 });
    expect(SHIP_NOSE.noses[20]).toEqual({ x: 48, y: 24.173 });
  });

  it.each([
    ["an unknown version", { ...art, version: 2 }],
    ["16 noses", { ...art, noses: art.noses.slice(0, 16) }],
    ["a point outside the frame", { ...art, noses: [[97, 48], ...art.noses.slice(1)] }],
    ["a non-numeric point", { ...art, noses: [["48", 48], ...art.noses.slice(1)] }],
    ["a missing display scale", { ...art, displayScale: undefined }],
    ["no data", undefined],
  ])("rejects %s", (_, value) => {
    expect(readShipNose(value)).toBeUndefined();
  });

  it("selects the heading frame Art's ship draws for a facing", () => {
    expect(shipHeading({ x: 1, y: 0 })).toBe(0);
    expect(shipHeading({ x: 0, y: -1 })).toBe(24);
    expect(shipHeading({ x: 1, y: -1 })).toBe(28);
    expect(shipHeading({ x: -1, y: -1 })).toBe(20);
    expect(shipHeading({ x: Math.cos(0.098), y: Math.sin(0.098) })).toBe(0);
    expect(shipHeading({ x: Math.cos(0.0985), y: Math.sin(0.0985) })).toBe(1);
  });

  it("offsets the drawn nose from the pivot (48, 48) in display px, 17.1 px right at heading 28", () => {
    const right = noseScreenOffset(28);
    expect(right.x).toBeCloseTo((87.192 - 48) * 0.4375, 9);
    expect(right.x).toBeCloseTo(17.15, 2);
    expect(right.y).toBeCloseTo(-HEIGHT * 0.4375, 9);
    // Pointing up, the nose is above the centre by its forward reach and its height.
    expect(noseScreenOffset(20).x).toBeCloseTo(0, 9);
    expect(noseScreenOffset(20).y).toBeCloseTo((24.173 - 48) * 0.4375, 9);
  });

  it.each(Array.from({ length: 32 }, (_, index) => index))(
    "projects heading %i's world nose offset onto Art's drawn nose",
    (index) => {
      const facing = headingDirection(index);
      expect(shipHeading(facing)).toBe(index);
      const projected = project(noseOffset(facing));
      const screen = noseScreenOffset(index);
      expect(projected.x).toBeCloseTo(screen.x, 9);
      expect(projected.y).toBeCloseTo(screen.y, 9);
      // Less its height, Art's nose lies 32 units ahead along the ship's own projection.
      const scale = SHIP_NOSE.displayScale;
      const ahead = {
        x: ((facing.x - facing.y) * Math.sqrt(3) * FORWARD * scale) / 2,
        y: ((facing.x + facing.y) * FORWARD * scale) / 2,
      };
      expect(screen.x).toBeCloseTo(ahead.x, 2);
      expect(screen.y + HEIGHT * scale).toBeCloseTo(ahead.y, 2);
    },
  );

  it("offsets from Ada's position", () => {
    const facing = headingDirection(12);
    const offset = noseOffset(facing);
    expect(nosePoint(facing, { x: 100, y: -50 })).toEqual({
      x: 100 + offset.x,
      y: -50 + offset.y,
    });
  });
});
