import { describe, expect, it } from "vitest";

import { CONTENT } from "../data/content.ts";
import { ZIP_END_SCALE, zipAt } from "./pickupZip.ts";

const { pickupZip } = CONTENT.tuning.flight;
const from = { x: 0, y: 0 };
const ship = { x: 20, y: -10 };

describe("pickup zip", () => {
  it("takes 0.15 s from the pickup into the ship, then ends", () => {
    expect(pickupZip).toBe(0.15);
    expect(zipAt(pickupZip, 0, from, ship)).toEqual({ at: from, scale: 1 });
    expect(zipAt(pickupZip, pickupZip, from, ship)).toBeNull();
  });

  it("accelerates toward the ship and shrinks as it lands", () => {
    const half = zipAt(pickupZip, pickupZip / 2, from, ship)!;
    expect(half.at).toEqual({ x: 5, y: -2.5 });
    expect(half.scale).toBeCloseTo(1 - (1 - ZIP_END_SCALE) / 4, 9);
    const late = zipAt(pickupZip, pickupZip * 0.99, from, ship)!;
    expect(late.at.x).toBeGreaterThan(19);
    expect(late.scale).toBeGreaterThan(ZIP_END_SCALE);
  });

  it("follows Ada as she moves", () => {
    const moved = { x: 40, y: 0 };
    expect(zipAt(pickupZip, pickupZip / 2, from, moved)!.at.x).toBe(10);
  });
});
