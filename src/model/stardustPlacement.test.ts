import { describe, expect, it, vi } from "vitest";

import GALAXIES_FILE from "../../public/art/galaxies.json" with { type: "json" };
import { CONTENT } from "../data/content.ts";
import { ECONOMY } from "../data/economy.ts";
import * as asteroidLoot from "./asteroidLoot.ts";
import { toScreen } from "./convex.ts";
import { createFlight, stepFlight } from "./flight.ts";
import { stardustDiamond, stardustDropOffsets } from "./stardustPlacement.ts";
import { collectWeapon } from "./weapons.ts";

const cacheContent = {
  ...CONTENT,
  tuning: {
    ...CONTENT.tuning,
    flight: {
      ...CONTENT.tuning.flight,
      spawnWeights: { enemy: 0, pickup: 1, resource: 0, rock: 0 },
    },
  },
};

const idle = { aim: { x: 0, y: 0 }, fire: false, move: { x: 0, y: 0 }, use: false };
describe("ordinary Stardust placement", () => {
  it("places four actual single-unit cache pickups without the aggregate collider", () => {
    const flight = createFlight(cacheContent, 1, 173, { known: [] });
    const groups = new Map<string, typeof flight.objects>();
    for (const object of flight.objects) {
      const match = /^(.*):stardust:[0-3]$/.exec(object.id);
      if (match) {
        const group = groups.get(match[1]!) ?? [];
        group.push(object);
        groups.set(match[1]!, group);
      }
    }
    expect(groups.size).toBeGreaterThan(0);
    expect(ECONOMY.discoveryStardust).toBe(4);
    for (const [parent, objects] of groups) {
      expect(objects).toHaveLength(4);
      expect(objects.reduce((sum, object) => sum + (object.amount ?? 0), 0)).toBe(4);
      expect(flight.objects.some((object) => object.id === parent)).toBe(false);
      for (const object of objects) {
        expect(object).toMatchObject({
          amount: 1,
          kind: "pickup",
          radius: ECONOMY.stardustPickupRadius,
          role: "stardust",
        });
      }
    }
    const repeat = createFlight(cacheContent, 1, 173, { known: [] });
    expect(repeat.objects.filter((object) => /:stardust:[0-3]$/.test(object.id))).toEqual(
      flight.objects.filter((object) => /:stardust:[0-3]$/.test(object.id)),
    );
  });

  it("does not refill a partly retained cache when an active chunk is rebuilt", () => {
    const flight = createFlight(cacheContent, 1, 173, { known: [] });
    const first = flight.objects.find((object) => /:stardust:0$/.test(object.id))!;
    const parent = first.id.replace(/:stardust:0$/, ""),
      removed = first.id;
    flight.objects = flight.objects.filter((object) => object.id !== removed);
    flight.chunks = [];
    stepFlight(cacheContent, 0.001, idle, flight);
    expect(
      flight.objects.filter((object) => object.id.startsWith(`${parent}:stardust:`)),
    ).toHaveLength(3);
    expect(flight.objects.some((object) => object.id === removed)).toBe(false);
  });

  it("keeps full-glint radial bounds apart in the tighter projected diamond", () => {
    const origin = { x: 700, y: -800 };
    const points = stardustDiamond(ECONOMY, origin).map((point) =>
      toScreen({ x: point.x - origin.x, y: point.y - origin.y }),
    );
    expect(points).toHaveLength(4);
    expect(Math.max(...points.map((point) => Math.abs(point.x)))).toBe(11);
    const step =
      Math.ceil(Math.SQRT2 * (ECONOMY.stardustPickupRadius + GALAXIES_FILE.lightField.keyline)) +
      ECONOMY.stardustPickupGap;
    expect(points).toEqual([
      { x: 0, y: -step },
      { x: step, y: 0 },
      { x: 0, y: step },
      { x: -step, y: 0 },
    ]);
    const diameter = 2 * (ECONOMY.stardustPickupRadius + GALAXIES_FILE.lightField.keyline);
    for (const [a, first] of points.entries()) {
      for (const second of points.slice(a + 1)) {
        expect(
          Math.hypot(first.x - second.x, first.y - second.y) - diameter,
        ).toBeGreaterThanOrEqual(ECONOMY.stardustPickupGap);
      }
    }
  });

  it("preserves distant random drop candidates and separates close candidates without extra randomness", () => {
    const candidates = [
      { x: 0, y: 0 },
      { x: 0, y: 0 },
      { x: -2, y: 1 },
      { x: 100, y: 100 },
    ];
    const before = JSON.stringify(candidates);
    const placed = stardustDropOffsets(ECONOMY, candidates);
    expect(placed[0]).toEqual(candidates[0]);
    expect(placed[3]).toEqual(candidates[3]);
    expect(JSON.stringify(candidates)).toBe(before);
    const minimum =
      2 * Math.SQRT2 * (ECONOMY.stardustPickupRadius + GALAXIES_FILE.lightField.keyline) +
      ECONOMY.stardustPickupGap;
    for (const [index, first] of placed.entries()) {
      for (const second of placed.slice(index + 1)) {
        expect(Math.hypot(first.x - second.x, first.y - second.y)).toBeGreaterThanOrEqual(minimum);
      }
    }
    expect(stardustDropOffsets(ECONOMY, candidates)).toEqual(placed);
  });

  it("separates the actual rock-release path without changing its five-unit reward", () => {
    const loot = vi
      .spyOn(asteroidLoot, "rollAsteroidLoot")
      .mockReturnValue({ ore: 0, stardust: 5 });
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
      expect(pickups).toHaveLength(5);
      expect(pickups.reduce((sum, pickup) => sum + (pickup.amount ?? 0), 0)).toBe(5);
      expect(loot).toHaveBeenCalledTimes(1);
      const minimum =
        2 * Math.SQRT2 * (ECONOMY.stardustPickupRadius + GALAXIES_FILE.lightField.keyline) +
        ECONOMY.stardustPickupGap;
      const points = pickups.map((point) => toScreen(point));
      for (const [index, first] of points.entries()) {
        for (const second of points.slice(index + 1)) {
          expect(Math.hypot(first.x - second.x, first.y - second.y)).toBeGreaterThanOrEqual(
            minimum - 1e-9,
          );
        }
      }
    } finally {
      loot.mockRestore();
    }
  });

  it("collects the four actual cache objects through ordinary contact for a total of four", () => {
    const flight = createFlight(cacheContent, 1, 173, { known: [] });
    const first = flight.objects.find((object) => /:stardust:0$/.test(object.id))!;
    expect(first).toBeDefined();
    const parent = first.id.replace(/:stardust:0$/, "");
    const cache = flight.objects.filter((object) => object.id.startsWith(`${parent}:stardust:`));
    flight.objects = cache;
    let total = 0;
    const collected = new Set<string>();
    for (const pickup of cache) {
      if (pickup.hp <= 0) {
        continue;
      }
      flight.player = { x: pickup.x, y: pickup.y };
      const events = stepFlight(cacheContent, 0.001, idle, flight);
      for (const event of events) {
        if (event.type === "stardust") {
          expect(event.amount).toBe(1);
          total += event.amount;
        }
        if (event.type === "collected") {
          collected.add(event.id);
        }
      }
    }
    expect(total).toBe(4);
    expect(collected.size).toBe(4);
  });
});
