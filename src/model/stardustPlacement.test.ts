import { describe, expect, it, vi } from "vitest";

import { CONTENT } from "../data/content.ts";
import { ECONOMY } from "../data/economy.ts";
import * as asteroidLoot from "./asteroidLoot.ts";
import { toScreen } from "./convex.ts";
import { createFlight, stepFlight } from "./flight.ts";
import { orePickupSize, stardustPickupSize } from "./pickupBody.ts";
import {
  discoveryCacheGroup,
  pickupSpacingRadius,
  stardustDropOffsets,
} from "./stardustPlacement.ts";
import { collectWeapon } from "./weapons.ts";

const cacheContent = {
  ...CONTENT,
  tuning: {
    ...CONTENT.tuning,
    flight: {
      ...CONTENT.tuning.flight,
      spawnWeights: { enemy: 0, pickup: 1, rock: 0 },
    },
  },
};

const idle = { aim: { x: 0, y: 0 }, fire: false, move: { x: 0, y: 0 }, use: false };
describe("ordinary Stardust placement", () => {
  it("places one identifiable five-unit bundle at each stable cache child ID", () => {
    const flight = createFlight(cacheContent, 1, 173, { known: [] });
    const generated = () =>
      createFlight(cacheContent, 1, 173, { known: [] }).objects.filter((object) =>
        /:stardust:[0-3]$/.test(object.id),
      );
    const pickups = flight.objects.filter(({ id }) => /:stardust:[0-3]$/.test(id));
    expect(pickups.length).toBeGreaterThan(0);
    expect(ECONOMY.discoveryStardust).toBe(5);
    for (const pickup of pickups) {
      const parent = pickup.id.slice(0, -":stardust:0".length);
      expect(pickup.id).toBe(`${parent}:stardust:0`);
      expect(pickup).toMatchObject({ amount: 5, kind: "pickup", role: "stardust" });
      expect(flight.objects.some(({ id }) => id === parent)).toBe(false);
      expect(discoveryCacheGroup(ECONOMY, structuredClone(pickup))).toBe(parent);
      expect(
        discoveryCacheGroup(ECONOMY, { ...pickup, id: "asteroid:1:stardust:0" }),
      ).toBeUndefined();
      expect(
        discoveryCacheGroup(ECONOMY, { ...pickup, id: `${parent}:stardust:04` }),
      ).toBeUndefined();
      expect(
        discoveryCacheGroup(ECONOMY, { ...pickup, id: `${parent}:stardust:1` }),
      ).toBeUndefined();
      expect(discoveryCacheGroup(ECONOMY, { ...pickup, amount: 7 })).toBeUndefined();
    }
    expect(generated()).toEqual(pickups);
  });

  it("keeps surviving legacy cache pieces and does not refill the cache", () => {
    const flight = createFlight(cacheContent, 1, 173, { known: [] });
    const first = flight.objects.find((object) => /:stardust:0$/.test(object.id))!;
    const prefix = first.id.slice(0, -1);
    const legacy = [1, 2, 3].map((index) => ({
      ...first,
      amount: 1,
      id: `${prefix}${index}`,
      radius: ECONOMY.stardustPickupRadius,
      x: first.x + index,
    }));
    flight.objects = [...flight.objects.filter((object) => object.id !== first.id), ...legacy];
    flight.chunks = [];
    stepFlight(cacheContent, 0.001, idle, flight);
    expect(flight.objects.filter((object) => object.id.startsWith(prefix))).toEqual(legacy);
    for (const member of legacy) {
      expect(discoveryCacheGroup(ECONOMY, member)).toBe(prefix.slice(0, -":stardust:".length));
    }
  });

  it("preserves distant random drop candidates and separates close candidates without extra randomness", () => {
    const candidates = [
      { radius: pickupSpacingRadius(stardustPickupSize(5)), x: 0, y: 0 },
      { radius: pickupSpacingRadius(stardustPickupSize(1)), x: 0, y: 0 },
      { radius: pickupSpacingRadius(stardustPickupSize(5)), x: -2, y: 1 },
      { radius: pickupSpacingRadius(stardustPickupSize(1)), x: 100, y: 100 },
    ];
    const before = JSON.stringify(candidates);
    const placed = stardustDropOffsets(ECONOMY, candidates);
    expect(placed[0]).toMatchObject({ x: 0, y: 0 });
    expect(placed[3]).toMatchObject({ x: 100, y: 100 });
    expect(JSON.stringify(candidates)).toBe(before);
    for (const [index, first] of placed.entries()) {
      for (const [other, second] of placed.entries()) {
        if (other <= index) {
          continue;
        }
        const minimum =
          candidates[index]!.radius + candidates[other]!.radius + ECONOMY.stardustPickupGap;
        expect(Math.hypot(first.x - second.x, first.y - second.y)).toBeGreaterThanOrEqual(minimum);
      }
    }
    expect(stardustDropOffsets(ECONOMY, candidates)).toEqual(placed);
  });

  it("keeps crowded Stardust clear of fixed ore obstacles without moving those obstacles", () => {
    const obstacles = [
      { radius: pickupSpacingRadius(orePickupSize(5)), x: 0, y: 0 },
      { radius: pickupSpacingRadius(orePickupSize(1)), x: 25, y: 0 },
    ];
    const before = structuredClone(obstacles);
    const context = { ...ECONOMY, obstacles };
    const radius = pickupSpacingRadius(stardustPickupSize(5));
    const candidates = [
      { radius, x: 0, y: 0 },
      { radius, x: 0, y: 0 },
    ];
    const placed = stardustDropOffsets(context, candidates);
    for (const point of placed) {
      for (const obstacle of obstacles) {
        expect(Math.hypot(point.x - obstacle.x, point.y - obstacle.y)).toBeGreaterThanOrEqual(
          radius + obstacle.radius + ECONOMY.stardustPickupGap,
        );
      }
    }
    expect(obstacles).toEqual(before);
    expect(stardustDropOffsets(context, candidates)).toEqual(placed);
  });

  it("separates the actual rock-release path without changing its five-unit reward", () => {
    const loot = vi
      .spyOn(asteroidLoot, "rollAsteroidLoot")
      .mockReturnValue({ ore: 5, stardust: 12 });
    try {
      const flight = createFlight(CONTENT, 1, 173, { known: [] });
      flight.objects = [
        {
          asteroid: "asteroid-s1",
          hp: 1,
          id: "ordinary-drop",
          kind: "rock",
          radius: 10,
          x: 100,
          y: 0,
        },
      ];
      collectWeapon("phaser", flight);
      flight.weapon = "phaser";
      flight.facing = { x: 1, y: 0 };
      stepFlight(CONTENT, 0.001, { ...idle, aim: { x: 1, y: 0 }, fire: true }, flight);
      const pickups = flight.objects.filter(
        (object) => object.role === "stardust" && object.release,
      );
      expect(pickups.map(({ amount }) => amount)).toEqual([5, 5, 1, 1]);
      expect(loot).toHaveBeenCalledTimes(1);
      const ore = flight.objects.find((object) => object.role === "cargo")!;
      expect(ore.amount).toBe(5);
      const placed = [ore, ...pickups].map((pickup) => ({
        ...toScreen(pickup),
        radius: pickupSpacingRadius(
          (pickup.role === "cargo" ? orePickupSize : stardustPickupSize)(pickup.amount),
        ),
      }));
      for (const [index, first] of placed.entries()) {
        for (const second of placed.slice(index + 1)) {
          expect(Math.hypot(first.x - second.x, first.y - second.y)).toBeGreaterThanOrEqual(
            first.radius + second.radius + ECONOMY.stardustPickupGap - 1e-9,
          );
        }
      }
    } finally {
      loot.mockRestore();
    }
  });

  it("collects one generated bundle as a single five-unit event", () => {
    const flight = createFlight(cacheContent, 1, 173, { known: [] });
    const pickup = flight.objects.find((object) => /:stardust:0$/.test(object.id))!;
    expect(pickup).toBeDefined();
    flight.objects = [pickup];
    flight.player = { x: pickup.x, y: pickup.y };
    const events = stepFlight(cacheContent, 0.001, idle, flight);
    expect(events.filter(({ type }) => type === "stardust")).toEqual([
      { amount: 5, type: "stardust" },
    ]);
    expect(events.flatMap((event) => (event.type === "collected" ? [event.id] : []))).toEqual([
      pickup.id,
    ]);
    expect(flight.objects.find(({ id }) => id === pickup.id)).toBeUndefined();
    expect(
      stepFlight(cacheContent, 0.001, idle, flight).some(({ type }) => type === "stardust"),
    ).toBe(false);
  });
});
