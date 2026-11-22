import { describe, expect, it } from "vitest";

import ore from "../../public/art/cartwheel/ore-nugget.json" with { type: "json" };
import { carriesStardust } from "./drops.ts";
import { orePickupSize, pickupOutline, stardustPickupSize } from "./pickupBody.ts";
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
    expect(ordinary.length).toBeGreaterThan(0);
    expect(orePickupSize()).toBe(frame.sourceSize.w);
    expect(orePickupSize(1)).toBe(frame.sourceSize.w);
    expect(pickupOutline(pickup())).toEqual(ordinary);
    expect(pickupOutline(pickup(1))).toEqual(ordinary);
    expect(orePickupSize(5)).toBe(18);
    const ratio = orePickupSize(5) / frame.sourceSize.w;
    expect(ratio).toBeGreaterThan(1);
    expect(pickupOutline(pickup(5))).toEqual(
      ordinary.map((part) => part.map(({ x, y }) => ({ x: x * ratio, y: y * ratio }))),
    );
    expect(pickupOutline({ ...pickup(5), role: "stardust" })).not.toEqual(pickupOutline(pickup(5)));
  });

  it("scales the Stardust full-glint outline for exactly five and leaves other saved amounts at native size", () => {
    const single = { ...pickup(1), role: "stardust" as const };
    const parts = pickupOutline(single)!;
    expect(stardustPickupSize(1)).toBe(9);
    expect(stardustPickupSize(5)).toBe(18);
    expect(pickupOutline({ ...single, amount: 5 })).toEqual(
      parts.map((part) => part.map(({ x, y }) => ({ x: x * 2, y: y * 2 }))),
    );
    expect(pickupOutline({ ...single, amount: 3 })).toEqual(parts);
  });
});
