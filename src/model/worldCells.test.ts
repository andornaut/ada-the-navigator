import { describe, expect, it } from "vitest";

import { CURRENTS } from "../data/galaxyFeatures.ts";
import { GALAXY_SIDE } from "../data/world.ts";
import {
  periodicWorldGrid,
  worldCell,
  worldCellAt,
  worldCellChance,
  worldCellKey,
  worldCellOrigin,
  worldCellsNear,
  worldGrid,
} from "./worldCells.ts";

describe("explicit world placement grids", () => {
  it("keeps legacy coordinates and occupancy unchanged instead of inferring an extent", () => {
    const grid = worldGrid({}, 12000);
    expect(grid.worldSide).toBeUndefined();
    expect(worldCell(grid, { x: 96, y: -97 })).toEqual({ x: 96, y: -97 });
    expect(worldCellOrigin(grid, { x: -1, y: 1 })).toEqual({ x: -12000, y: 12000 });
    expect(worldCellChance(grid, 0.7)).toBe(0.7);
    expect(worldCellAt(grid, { x: -1, y: 12000 })).toEqual({ x: -1, y: 1 });
  });

  it("keeps station and ore identities periodic while preserving their exact pitch", () => {
    for (const pitch of [12000, 4500, 512]) {
      const grid = worldGrid({ worldSide: GALAXY_SIDE }, pitch);
      expect(grid.pitch).toBe(pitch);
      expect(worldCellKey(grid, { x: 1, y: -1 })).toBe(
        worldCellKey(grid, { x: 1 + grid.periodCells!, y: -1 - grid.periodCells! }),
      );
      expect(worldCellOrigin(grid, { x: 0, y: 0 })).toEqual({ x: 0, y: 0 });
    }
  });

  it("requires explicit resampling for currents and preserves expected density per area", () => {
    expect(() => worldGrid({ worldSide: GALAXY_SIDE }, CURRENTS.cellSize)).toThrow(RangeError);
    const grid = periodicWorldGrid({ worldSide: GALAXY_SIDE }, CURRENTS.cellSize);
    expect(grid.periodCells).toBe(338);
    expect(grid.pitch * grid.periodCells!).toBe(GALAXY_SIDE);
    expect(grid.pitch).toBeGreaterThanOrEqual(CURRENTS.cellSize);
    expect(worldCellChance(grid, CURRENTS.chance) / grid.pitch ** 2).toBeCloseTo(
      CURRENTS.chance / CURRENTS.cellSize ** 2,
      16,
    );
    expect(worldCellOrigin(grid, { x: -169, y: 168 })).toEqual({
      x: -GALAXY_SIDE / 2,
      y: 168 * grid.pitch,
    });
    expect(() => worldCellChance(periodicWorldGrid({ worldSide: 10000 }, 3400), 1)).toThrow(
      RangeError,
    );
  });

  it("does not change configured density when world area grows", () => {
    for (const side of [GALAXY_SIDE, GALAXY_SIDE * 2]) {
      const grid = periodicWorldGrid({ worldSide: side }, 3400);
      const expectedPerArea = (grid.periodCells! ** 2 * worldCellChance(grid, 0.4)) / side ** 2;
      expect(expectedPerArea).toBeCloseTo(0.4 / 3400 ** 2, 16);
    }
  });

  it("deduplicates corner neighborhoods and returns one identity per cell for large queries", () => {
    const grid = worldGrid({ worldSide: 400 }, 100);
    const near = [...worldCellsNear(grid, 110, { x: 199, y: -199 })];
    const keys = near.map((cell) => worldCellKey(grid, cell));
    expect(keys).toContain("-2,1");
    expect(keys).toContain("1,-2");
    expect(new Set(keys).size).toBe(keys.length);
    const all = [...worldCellsNear(grid, 1000, { x: 0, y: 0 })];
    expect(all).toHaveLength(16);
    expect(new Set(all.map((cell) => worldCellKey(grid, cell))).size).toBe(16);
  });

  it("tiles odd periods without leaving half a cell beyond the centered world", () => {
    const grid = worldGrid({ worldSide: 1200 }, 400);
    expect(worldCellOrigin(grid, { x: -1, y: 1 })).toEqual({ x: -600, y: 200 });
    expect(worldCellAt(grid, { x: -600, y: 599 })).toEqual({ x: -1, y: 1 });
    expect(worldCellAt(grid, { x: 600, y: -601 })).toEqual({ x: -1, y: 1 });
  });

  it("rejects invalid grids, density and unbounded numeric query mistakes", () => {
    for (const pitch of [0, -1, NaN, Infinity]) {
      expect(() => worldGrid({}, pitch)).toThrow(RangeError);
    }
    expect(() => periodicWorldGrid({ worldSide: 100 }, 12000)).toThrow(RangeError);
    expect(() => worldCellChance(worldGrid({}, 100), -1)).toThrow(RangeError);
    expect(() => [...worldCellsNear(worldGrid({}, 100), Infinity, { x: 0, y: 0 })]).toThrow(
      RangeError,
    );
    expect(() => worldCell(worldGrid({}, 100), { x: 0.5, y: 0 })).toThrow(RangeError);
  });
});
