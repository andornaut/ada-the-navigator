import { describe, expect, it } from "vitest";

import { ECONOMY } from "../data/economy.ts";
import { CURRENTS } from "../data/galaxyFeatures.ts";
import { SPAWNER_POLICIES, spawnerStage } from "../data/spawnerCatalog.ts";
import {
  currentInCell,
  pointOnCurrent,
  worldCurrentAt,
  worldCurrentInCell,
  worldCurrentsNear,
  worldFlowAt,
  worldNearestOnCurrent,
} from "./currents.ts";
import {
  fitsEncounter,
  worldEngagementAdmissions,
  worldFitsEncounter,
  worldSelectEncounter,
} from "./spawner.ts";
import { worldStationsNear } from "./stations.ts";
import type { SpaceObject } from "./types.ts";
import { periodicWorldGrid, worldCellChance } from "./worldCells.ts";
import { wrappedDistance } from "./worldGeometry.ts";
const context = { worldSide: 1152000 };
describe("explicit periodic currents and encounter budgets", () => {
  it("uses uniform 338-cell density and one continuous path through alias cells", () => {
    const grid = periodicWorldGrid(context, CURRENTS.cellSize);
    expect(grid.periodCells).toBe(338);
    expect(worldCellChance(grid, CURRENTS.chance) / grid.pitch ** 2).toBeCloseTo(
      CURRENTS.chance / CURRENTS.cellSize ** 2,
      15,
    );
    const currents = worldCurrentsNear(context, 3, 15000, { x: -576000, y: -576000 });
    expect(currents.length).toBeGreaterThan(0);
    expect(new Set(currents.map((current) => current.id)).size).toBe(currents.length);
    for (const current of currents) {
      const [x, y] = current.id.slice(8).split(",").map(Number);
      expect(worldCurrentInCell(context, 3, { x: x! + 338, y: y! - 338 })).toEqual(current);
      const middle = pointOnCurrent(current, current.length * 0.493).point;
      expect(worldCurrentAt(context, 3, middle)?.id).toBe(current.id);
      const image = { x: middle.x + context.worldSide, y: middle.y - context.worldSide };
      expect(worldNearestOnCurrent(context, current, image).distance).toBeLessThan(1e-7);
      const a = worldFlowAt(context, 3, middle),
        b = worldFlowAt(context, 3, image);
      expect(a.x).toBeCloseTo(b.x, 7);
      expect(a.y).toBeCloseTo(b.y, 7);
      for (let i = 1; i < current.points.length; i++) {
        expect(
          Math.hypot(
            current.points[i]!.x - current.points[i - 1]!.x,
            current.points[i]!.y - current.points[i - 1]!.y,
          ),
        ).toBeLessThan(1000);
      }
      const stations = worldStationsNear(context, ECONOMY, 3, grid.pitch * 2, middle);
      for (const point of current.points) {
        expect(wrappedDistance(context.worldSide, { x: 0, y: 0 }, point)).toBeGreaterThanOrEqual(
          CURRENTS.clearance + current.width / 2,
        );
        for (const station of stations) {
          expect(wrappedDistance(context.worldSide, station, point)).toBeGreaterThanOrEqual(
            CURRENTS.clearance + current.width / 2,
          );
        }
      }
    }
  });
  it("keeps unbounded current IDs and shapes unchanged when context is absent", () => {
    for (const cell of [
      { x: -12, y: 7 },
      { x: 400, y: -200 },
    ]) {
      expect(worldCurrentInCell({}, 3, cell)).toEqual(currentInCell(3, cell));
    }
  });
  it("counts seam neighbours against whole-group budget while legacy remains distant", () => {
    const policy = SPAWNER_POLICIES[1],
      stage = spawnerStage(1, 0);
    const centre = { x: 575900, y: 0 };
    const objects: SpaceObject[] = Array.from({ length: stage.localCap }, (_, i) => ({
      hp: 4,
      id: `enemy:${i}`,
      kind: "enemy",
      radius: 10,
      x: -575900,
      y: i * 10,
    }));
    const plan = { archetype: "fighter" as const, count: 1 };
    expect(worldFitsEncounter(context, policy, stage, 10, objects, centre, plan)).toBe(false);
    expect(fitsEncounter(policy, stage, 10, objects, centre, plan)).toBe(true);
    expect(worldSelectEncounter(context, policy, stage, 10, objects, centre, 0, 0)).toBeNull();
  });
  it("reserves nearest seam contacts before farther candidates without exceeding the cap", () => {
    const policy = SPAWNER_POLICIES[1],
      stage = { ...spawnerStage(1, 0), localCap: 1 };
    const objects: SpaceObject[] = [
      { hp: 4, id: "near", kind: "enemy", radius: 10, x: -575990, y: 0 },
      { hp: 4, id: "far", kind: "enemy", radius: 10, x: 575000, y: 0 },
    ];
    expect([
      ...worldEngagementAdmissions(context, policy, stage, objects, new Set(["near", "far"]), {
        x: 575990,
        y: 0,
      }),
    ]).toEqual(["near"]);
    expect([
      ...worldEngagementAdmissions({}, policy, stage, objects, new Set(["near", "far"]), {
        x: 575990,
        y: 0,
      }),
    ]).toEqual(["far", "near"]);
  });
});
