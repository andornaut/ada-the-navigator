import { describe, expect, it } from "vitest";

import ore from "../../public/art/cartwheel/ore-nugget.json" with { type: "json" };
import { carriesStardust } from "./drops.ts";
import { orePickupSize, pickupOutline } from "./pickupBody.ts";
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

  it("keeps ordinary ore at native size and scales every canonical collision part for five", () => {
    const frame = Object.values(ore.frames)[0]!;
    const ordinary = frame.collision.map((part) =>
      part.map(([x, y]) => ({ x: x! - frame.sourceSize.w / 2, y: y! - frame.sourceSize.h / 2 })),
    );
    expect(ordinary).toHaveLength(15);
    expect(orePickupSize()).toBe(11);
    expect(orePickupSize(1)).toBe(11);
    expect(pickupOutline(pickup())).toEqual(ordinary);
    expect(pickupOutline(pickup(1))).toEqual(ordinary);
    expect(orePickupSize(5)).toBe(18);
    const ratio = orePickupSize(5) / 11;
    expect(ratio).toBeGreaterThan(1);
    expect(pickupOutline(pickup(5))).toEqual(
      ordinary.map((part) => part.map(({ x, y }) => ({ x: x * ratio, y: y * ratio }))),
    );
    expect(pickupOutline({ ...pickup(5), role: "stardust" })).not.toEqual(pickupOutline(pickup(5)));
  });
});
