import { describe, expect, it } from "vitest";

import pickups from "../../public/art/pickups/pickups.json" with { type: "json" };
import { carriesStardust } from "./drops.ts";
import {
  orePickupFrameSize,
  orePickupSize,
  pickupOutline,
  stardustPickupFrameSize,
  stardustPickupSize,
} from "./pickupBody.ts";
import type { SpaceObject } from "./types.ts";

const pickup = (amount?: number): SpaceObject => ({
  ...(amount === undefined ? {} : { amount }),
  hp: 1,
  id: "ore",
  kind: "pickup",
  radius: 7,
  role: "cargo",
  x: 0,
  y: 0,
});

describe("ore pickup identity and collision", () => {
  it("keeps quantity-bearing ore out of Stardust classification and preserves legacy Stardust", () => {
    for (const amount of [undefined, 1, 5]) {
      expect(carriesStardust(pickup(amount))).toBe(false);
    }
    expect(carriesStardust({ ...pickup(5), role: "stardust" })).toBe(true);
    expect(carriesStardust({ ...pickup(5), role: "discovery" })).toBe(true);
    const legacy = pickup(5);
    delete legacy.role;
    expect(carriesStardust(legacy)).toBe(true);
    expect(carriesStardust({ ...pickup(5), kind: "rock" })).toBe(false);
  });

  it("draws ordinary ore 14 px tall and scales every canonical collision part for five", () => {
    const frame = pickups.frames["ore-nugget"];
    const scale = pickups.displayScale;
    const ordinary = frame.collision.map((part) =>
      part.map(([x, y]) => ({
        x: (x! - frame.pivot[0]!) * scale,
        y: (y! - frame.pivot[1]!) * scale,
      })),
    );
    expect(ordinary.length).toBeGreaterThan(0);
    expect(orePickupSize()).toBe(14);
    expect(orePickupSize(1)).toBe(14);
    expect(orePickupFrameSize(1)).toEqual({ height: 17.5, width: 17.5 });
    expect(pickupOutline(pickup())).toEqual(ordinary);
    expect(pickupOutline(pickup(1))).toEqual(ordinary);
    expect(orePickupSize(5)).toBe(18);
    const ratio = orePickupSize(5) / orePickupSize(1);
    expect(ratio).toBeGreaterThan(1);
    expect(orePickupFrameSize(5).width).toBeCloseTo(17.5 * ratio, 9);
    expect(pickupOutline(pickup(5))).toEqual(
      ordinary.map((part) => part.map(({ x, y }) => ({ x: x * ratio, y: y * ratio }))),
    );
    expect(pickupOutline({ ...pickup(5), role: "stardust" })).not.toEqual(pickupOutline(pickup(5)));
  });

  it("scales the Stardust outline for exactly five and leaves other saved amounts at native size", () => {
    const single = { ...pickup(1), role: "stardust" as const };
    const parts = pickupOutline(single)!;
    expect(stardustPickupSize(1)).toBe(14);
    expect(stardustPickupSize(5)).toBe(18);
    expect(stardustPickupFrameSize(1)).toEqual({ height: 17.5, width: 14 });
    const ratio = 18 / 14;
    expect(pickupOutline({ ...single, amount: 5 })).toEqual(
      parts.map((part) => part.map(({ x, y }) => ({ x: x * ratio, y: y * ratio }))),
    );
    expect(pickupOutline({ ...single, amount: 3 })).toEqual(parts);
  });
});
