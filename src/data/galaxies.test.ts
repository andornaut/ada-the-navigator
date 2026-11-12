import { describe, expect, it } from "vitest";

import { ASTEROID_FIELDS, CHUNK_CATALOG } from "./chunk-catalog.ts";
import { ECONOMY } from "./economy.ts";
import { sectorArchetypes, sectorEncounters, sectorEnemyTuning } from "./enemy-catalog.ts";
import {
  BUILT,
  byPosition,
  GALAXY_COUNT,
  galaxyAt,
  ROUTE,
  ROUTE_POSITION,
  type RoutePosition,
  SECTORS,
  tuningPosition,
  unlockedBy,
} from "./galaxies.ts";
import { JOB_REWARDS } from "./jobs.ts";
import { GALAXIES, galaxyCard } from "./storybook.ts";

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
      "Black Eye",
    ]);
    for (const galaxy of SECTORS) {
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
      "black-eye",
    ]);
  });

  it("keeps the existing galaxy ids and adds the placeholders after them", () => {
    expect(named([1, 2, 3])).toEqual(["Sunflower", "Cartwheel", "Whirlpool"]);
    expect(named([4, 5, 6])).toEqual(["Needle", "Andromeda", "Black Eye"]);
    expect([...BUILT]).toEqual([1, 2, 3]);
  });

  it("unlocks the next position, each placeholder after it and the next built galaxy", () => {
    expect(named(unlockedBy(1))).toEqual(["Whirlpool"]);
    expect(named(unlockedBy(3))).toEqual(["Needle", "Andromeda", "Cartwheel"]);
    expect(named(unlockedBy(2))).toEqual(["Black Eye"]);
    expect(unlockedBy(6)).toEqual([]);
  });
});

describe("tuning by route position", () => {
  it("keeps each built galaxy's tuning as it was, now at its route position", () => {
    // Sunflower's, Cartwheel's and Whirlpool's values, unchanged.
    expect(byPosition(sectorEnemyTuning, 1)).toEqual({
      encounterRate: 1.2,
      fireRate: 1.15,
      perception: 1.2,
    });
    expect(byPosition(sectorEnemyTuning, 2)).toEqual({
      encounterRate: 1.3,
      fireRate: 1.3,
      perception: 1.3,
    });
    expect(byPosition(sectorEnemyTuning, 3)).toEqual({
      encounterRate: 1.35,
      fireRate: 1.45,
      perception: 1.4,
    });
    // Job rewards follow route position (quests.md "Rewards"): Whirlpool second, Cartwheel fifth.
    expect(byPosition(JOB_REWARDS, 3).deliveryLong).toBe(35);
    expect(byPosition(JOB_REWARDS, 2).deliveryLong).toBe(50);
    expect(byPosition(sectorArchetypes, 2).retaliator).toEqual({ hp: 9 });
    expect(byPosition(sectorArchetypes, 3).retaliator).toEqual({ hp: 10 });
  });

  it("gives each placeholder the tuning of the built galaxy before it on the route", () => {
    expect([3, 4, 6].map((position) => tuningPosition(position as RoutePosition))).toEqual([
      2, 2, 5,
    ]);
    const tables: readonly Readonly<Partial<Record<RoutePosition, unknown>>>[] = [
      ASTEROID_FIELDS,
      CHUNK_CATALOG,
      ECONOMY.weaponDropChance,
      sectorArchetypes,
      sectorEncounters,
      sectorEnemyTuning,
    ];
    for (const table of tables) {
      // Needle and Andromeda read Whirlpool's, Black Eye Cartwheel's.
      expect(byPosition(table, 4)).toBe(byPosition(table, 3));
      expect(byPosition(table, 5)).toBe(byPosition(table, 3));
      expect(byPosition(table, 6)).toBe(byPosition(table, 2));
      // Every built galaxy has its own entry.
      for (const galaxy of BUILT) {
        expect(table[ROUTE_POSITION[galaxy]]).toBeDefined();
      }
    }
    // Job rewards are Gameplay's per position, every galaxy having stations: positions 3 to 5
    // pay alike, and Black Eye only surveys and rescues.
    expect([3, 4, 5].map((position) => JOB_REWARDS[position as RoutePosition])).toEqual([
      { deliveryLong: 50, deliveryShort: 30, hunt: 30, rescue: 50, survey: 20 },
      { deliveryLong: 50, deliveryShort: 30, hunt: 30, rescue: 50, survey: 20 },
      { deliveryLong: 50, deliveryShort: 30, hunt: 30, rescue: 50, survey: 20 },
    ]);
    expect(JOB_REWARDS[6]).toEqual({ rescue: 50, survey: 20 });
  });
});
