import { describe, expect, it } from "vitest";

import { ASTEROID_FIELDS, CHUNK_CATALOG } from "./chunkCatalog.ts";
import { galaxyArchetypes, galaxyEncounters } from "./enemyCatalog.ts";
import {
  BUILT,
  byPosition,
  GALAXY_COUNT,
  GALAXY_NUMBERS,
  galaxyAt,
  ROUTE,
  ROUTE_POSITION,
  type RoutePosition,
  tuningPosition,
  unlockedBy,
} from "./galaxies.ts";
import { JOB_REWARDS } from "./jobs.ts";
import { GALAXIES, galaxyCard } from "./storybook.ts";
import type { GalaxyNumber } from "./types.ts";

const named = (ids: readonly number[]) => ids.map((id) => galaxyCard(id as 1).name);

describe("the galaxy route", () => {
  it("places every galaxy at one route position, in Gameplay's order", () => {
    expect(GALAXY_COUNT).toBe(6);
    expect(new Set(Object.values(ROUTE_POSITION))).toEqual(new Set([1, 2, 3, 4, 5, 6]));
    expect(named(ROUTE)).toEqual([
      "Sunflower",
      "Whirlpool",
      "Needle",
      "Andromeda",
      "Cartwheel",
      "Phantom",
    ]);
    for (const galaxy of GALAXY_NUMBERS) {
      expect(galaxyAt(ROUTE_POSITION[galaxy])).toBe(galaxy);
    }
    // Galaxy selection lists the cards in the same order, under Art's ids.
    expect(GALAXIES.map(({ galaxy }) => galaxy)).toEqual(ROUTE);
    expect(GALAXIES.map(({ id }) => id)).toEqual([
      "sunflower",
      "whirlpool",
      "needle",
      "andromeda",
      "cartwheel",
      "phantom",
    ]);
  });

  it("keeps the existing galaxy ids and adds the placeholders after them", () => {
    expect(named([1, 2, 3])).toEqual(["Sunflower", "Cartwheel", "Whirlpool"]);
    expect(named([4, 5, 6])).toEqual(["Needle", "Andromeda", "Phantom"]);
    expect([...BUILT]).toEqual([1, 2, 3]);
  });

  it("unlocks the next position, each placeholder after it and the next built galaxy", () => {
    expect(named(unlockedBy(1))).toEqual(["Whirlpool"]);
    expect(named(unlockedBy(3))).toEqual(["Needle", "Andromeda", "Cartwheel"]);
    expect(named(unlockedBy(2))).toEqual(["Phantom"]);
    expect(unlockedBy(6)).toEqual([]);
  });
});

describe("tuning by route position", () => {
  it("keeps each built galaxy's tuning as it was, now at its route position", () => {
    // Job rewards follow route position (quests.md "Rewards"): Whirlpool second, Cartwheel fifth.
    expect(byPosition(JOB_REWARDS, 3).deliveryLong).toBe(35);
    expect(byPosition(JOB_REWARDS, 2).deliveryLong).toBe(50);
    // Whirlpool's hunters chase; Cartwheel's interceptors hit and run.
    expect(byPosition(galaxyArchetypes, 3).fighter).toEqual({ behaviour: { kind: "chase" } });
    expect(byPosition(galaxyArchetypes, 2).interceptor?.behaviour.kind).toBe("hitAndRun");
  });

  it("gives Needle and Andromeda their own rosters and Phantom Cartwheel's", () => {
    // Galaxies: Needle 4, Andromeda 5, Phantom 6, Cartwheel 2 (gameplay/ships.md rosters).
    const roster = (galaxy: GalaxyNumber) =>
      byPosition(galaxyEncounters, galaxy).map(({ archetype, groupSize, weight }) => [
        archetype,
        groupSize,
        weight,
      ]);
    expect(roster(4)).toEqual([
      ["swarm", [6, 8], 0.2],
      ["fighter", [3, 4], 0.25],
      ["interceptor", [2, 2], 0.25],
      ["retaliator", [1, 1], 0.08],
      ["frigate", [1, 1], 0.15],
      ["capital", [1, 1], 0.07],
    ]);
    expect(roster(5)).toEqual([
      ["swarm", [6, 8], 0.2],
      ["fighter", [3, 4], 0.3],
      ["interceptor", [2, 2], 0.15],
      ["retaliator", [1, 1], 0.1],
      ["frigate", [1, 2], 0.18],
      ["capital", [1, 1], 0.07],
    ]);
    expect(byPosition(galaxyEncounters, 4).at(-1)!.escorts).toEqual({
      archetype: "fighter",
      count: 5,
    });
    expect(byPosition(galaxyArchetypes, 4)).toEqual({ fighter: { behaviour: { kind: "chase" } } });
    expect(byPosition(galaxyArchetypes, 5)).toEqual({});
    expect(byPosition(galaxyEncounters, 6)).toBe(byPosition(galaxyEncounters, 2));
  });

  it("gives each placeholder the tuning of the built galaxy before it on the route", () => {
    expect([3, 4, 6].map((position) => tuningPosition(position as RoutePosition))).toEqual([
      2, 2, 5,
    ]);
    const tables: readonly Readonly<Partial<Record<RoutePosition, unknown>>>[] = [
      ASTEROID_FIELDS,
      CHUNK_CATALOG,
    ];
    for (const table of tables) {
      // Needle and Andromeda read Whirlpool's, Phantom Cartwheel's.
      expect(byPosition(table, 4)).toBe(byPosition(table, 3));
      expect(byPosition(table, 5)).toBe(byPosition(table, 3));
      expect(byPosition(table, 6)).toBe(byPosition(table, 2));
      // Every built galaxy has its own entry.
      for (const galaxy of BUILT) {
        expect(table[ROUTE_POSITION[galaxy]]).toBeDefined();
      }
    }
    // Job rewards are Gameplay's per position, every galaxy having stations: positions 3 to 5
    // pay alike, and Phantom only surveys and rescues.
    expect([3, 4, 5].map((position) => JOB_REWARDS[position as RoutePosition])).toEqual([
      { deliveryLong: 50, deliveryShort: 30, hunt: 30, rescue: 50, survey: 20 },
      { deliveryLong: 50, deliveryShort: 30, hunt: 30, rescue: 50, survey: 20 },
      { deliveryLong: 50, deliveryShort: 30, hunt: 30, rescue: 50, survey: 20 },
    ]);
    expect(JOB_REWARDS[6]).toEqual({ rescue: 50, survey: 20 });
  });
});
