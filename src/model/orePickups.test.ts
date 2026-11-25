import { describe, expect, it } from "vitest";

import ore from "../../public/art/ore-nugget.json" with { type: "json" };
import stardust from "../../public/art/stardust.json" with { type: "json" };
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

  it("draws ordinary ore at its 9 px frame and scales the rest frame's parts by 2 for five", () => {
    const [frame] = Object.values(ore.frames);
    // One frame px is one display px, centred on the frame.
    const ordinary = frame!.collision.map((part) =>
      part.map(([x, y]) => ({ x: x! - 4.5, y: y! - 4.5 })),
    );
    expect(ordinary.length).toBeGreaterThan(0);
    expect(orePickupSize()).toBe(9);
    expect(orePickupSize(1)).toBe(9);
    expect(orePickupFrameSize(1)).toEqual({ height: 9, width: 9 });
    expect(pickupOutline(pickup())).toEqual(ordinary);
    expect(pickupOutline(pickup(1))).toEqual(ordinary);
    expect(orePickupSize(5)).toBe(18);
    expect(orePickupFrameSize(5)).toEqual({ height: 18, width: 18 });
    expect(pickupOutline(pickup(5))).toEqual(
      ordinary.map((part) => part.map(({ x, y }) => ({ x: x * 2, y: y * 2 }))),
    );
    expect(pickupOutline({ ...pickup(5), role: "stardust" })).not.toEqual(pickupOutline(pickup(5)));
  });

  it("scales the Stardust outline for exactly five and leaves other saved amounts at native size", () => {
    const single = { ...pickup(1), role: "stardust" as const };
    const parts = pickupOutline(single)!;
    const [rest] = Object.values(stardust.frames);
    expect(parts).toEqual(
      rest!.collision.map((part) => part.map(([x, y]) => ({ x: x! - 4.5, y: y! - 4.5 }))),
    );
    expect(stardustPickupSize(1)).toBe(9);
    expect(stardustPickupSize(5)).toBe(18);
    expect(stardustPickupFrameSize(1)).toEqual({ height: 9, width: 9 });
    expect(stardustPickupFrameSize(5)).toEqual({ height: 18, width: 18 });
    expect(pickupOutline({ ...single, amount: 5 })).toEqual(
      parts.map((part) => part.map(({ x, y }) => ({ x: x * 2, y: y * 2 }))),
    );
    expect(pickupOutline({ ...single, amount: 3 })).toEqual(parts);
  });
});
