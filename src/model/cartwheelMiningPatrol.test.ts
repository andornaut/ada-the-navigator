import { describe, expect, it, vi } from "vitest";

import { CONTENT } from "../data/content.ts";
import { isEnemyActorKind } from "../data/enemyActors.ts";
import { enemyCatalog } from "../data/enemyCatalog.ts";
import { ROUTE_POSITION } from "../data/galaxies.ts";
import { SPAWNER_POLICIES } from "../data/spawnerCatalog.ts";
import { MOVING_ROCKS } from "../data/spawnTargets.ts";
import { ASTEROID_SHAPES } from "./asteroids.ts";
import {
  CARTWHEEL_MINING_PATROL,
  type CartwheelMiningPatrolContext,
  type CartwheelMiningRockPath,
  planCartwheelMiningPatrol,
} from "./cartwheelMiningPatrol.ts";
import { closestOnSegment } from "./convex.ts";
import { createEnemy } from "./enemyAi.ts";
import { enemyEquipmentDefinition } from "./enemyEquipment.ts";
import { CURRENT_FLIGHT_TOPOLOGY, flightWorldContext } from "./flightTopology.ts";
import { ambientPackId } from "./geography.ts";
import { worldOreFieldInCell } from "./oreFields.ts";
import { MOVING_ROCK_PREFIX } from "./rockRicochet.ts";
import { worldFitsEncounter, worldSpawnerStage } from "./spawner.ts";
import { planRegion } from "./spawnPlanner.ts";
import { spawnRules, worldSpawnExclusions, worldSpawnSites } from "./spawnTargets.ts";
import type { SpaceObject, Vec } from "./types.ts";
import { periodicWorldGrid, worldCellAt } from "./worldCells.ts";
import { worldDelta, worldDistance } from "./worldContacts.ts";
import { wrapPoint } from "./worldGeometry.ts";

const field = { guard: null, id: "field", x: 0, y: 0 } as const;
// Use the ordinary leash and a projected firing envelope supplied by the integration port.
const fighter = {
  pursuitRadius: enemyCatalog.fighter.pursuit.homeRadius,
  radius: 13,
  weaponReach: 450,
};
const moving = (id: string, x: number): CartwheelMiningRockPath => ({
  end: { x, y: 100 },
  id,
  radius: 20,
  start: { x, y: -100 },
});
const context = (rocks = [moving("a", 850), moving("b", 1050)]): CartwheelMiningPatrolContext => ({
  admits: () => true,
  allocation: {
    anchor: { x: 700, y: 0 },
    fighters: [fighter, fighter, fighter, fighter],
    id: "pack",
  },
  fieldIsClear: () => true,
  fields: [field],
  hubKnown: true,
  rocksNear: () => rocks,
});

function plan(input: CartwheelMiningPatrolContext = context()) {
  const result = planCartwheelMiningPatrol(input);
  expect(result.status).toBe("planned");
  if (result.status !== "planned") {
    throw new Error("Expected a mining patrol placement");
  }
  return result.plan;
}

const length = ([x, y]: readonly [Vec, Vec]) => Math.hypot(y.x - x.x, y.y - x.y);

describe("Cartwheel mining patrol placement", () => {
  it("keeps one allocation intact, staggers homes and places the full-width bypass beyond pursuit and fire", () => {
    const placement = plan();
    const [entry, exit] = placement.bypass;
    const halfWidth = CARTWHEEL_MINING_PATROL.bypassWidth / 2;
    expect(placement.allocationId).toBe("pack");
    expect(placement.coverIds).toEqual(["a", "b"]);
    expect(placement.homes).toHaveLength(4);
    expect(placement.homes[0]?.x).not.toBe(placement.homes[1]?.x);
    for (const [index, home] of placement.homes.entries()) {
      for (const other of placement.homes.slice(index + 1)) {
        expect(length([home, other])).toBeGreaterThanOrEqual(110);
      }
      expect(length([home, closestOnSegment(home, entry, exit)]) - halfWidth).toBeGreaterThan(
        fighter.pursuitRadius + fighter.weaponReach + fighter.radius,
      );
    }
    expect(entry.x).toBeLessThan(0);
    expect(exit.x).toBeLessThan(0);
    expect(
      length([field, closestOnSegment(field, entry, exit)]) - halfWidth,
    ).toBeGreaterThanOrEqual(950);
    expect(CARTWHEEL_MINING_PATROL).toEqual({
      bypassWidth: 220,
      warningRange: 800,
      warningSeconds: 2.5,
    });
  });

  it("skips rock queries and admission for protected sites, unknown Hub and absent allocations", () => {
    const rocksNear = vi.fn(() => []);
    const admits = vi.fn(() => true);
    const input = { ...context(), admits, rocksNear };
    expect(planCartwheelMiningPatrol({ ...input, hubKnown: false })).toEqual({
      status: "hub-unknown",
    });
    const unallocated = { ...input };
    delete unallocated.allocation;
    expect(planCartwheelMiningPatrol(unallocated)).toEqual({ status: "no-allocation" });
    expect(
      planCartwheelMiningPatrol({
        ...input,
        fieldIsClear: () => false,
        fields: [{ ...field, guard: field, id: "platform" }, field],
      }),
    ).toEqual({
      rejected: [
        { fieldId: "platform", reason: "guarded" },
        { fieldId: "field", reason: "required-site" },
      ],
      status: "no-placement",
    });
    expect(rocksNear).not.toHaveBeenCalled();
    expect(admits).not.toHaveBeenCalled();
  });

  it("requires two distinct moving paths, without treating a duplicated id or a static rock as cover", () => {
    const input = context([
      moving("one", 850),
      moving("one", 1050),
      { id: "static", radius: 40, start: { x: 900, y: 0 } },
    ]);
    const admits = vi.fn(() => true);
    expect(planCartwheelMiningPatrol({ ...input, admits })).toEqual({
      rejected: [{ fieldId: "field", reason: "cover" }],
      status: "no-placement",
    });
    expect(admits).not.toHaveBeenCalled();
  });

  it("refuses when moving rocks sweep the opposite search band from clear starting positions", () => {
    const tracks = Array.from({ length: 61 }, (_, index) => {
      const y = (index - 30) * 100;
      return { end: { x: -1050, y }, id: `cross:${index}`, radius: 20, start: { x: -6500, y } };
    });
    const admits = vi.fn(() => true);
    const input = context([moving("a", 850), moving("b", 1050), ...tracks]);
    expect(planCartwheelMiningPatrol({ ...input, admits })).toMatchObject({
      rejected: expect.arrayContaining([{ fieldId: "field", reason: "bypass" }]),
      status: "no-placement",
    });
    expect(admits).not.toHaveBeenCalled();
  });

  it("passes the complete allocation to admission and leaves everything unplaced on refusal", () => {
    const input = context();
    const snapshot = structuredClone(input.allocation);
    const admits = vi.fn(() => false);
    expect(planCartwheelMiningPatrol({ ...input, admits })).toMatchObject({
      rejected: expect.arrayContaining([{ fieldId: "field", reason: "admission" }]),
      status: "no-placement",
    });
    expect(input.allocation).toEqual(snapshot);
    expect(admits).toHaveBeenCalledWith(
      expect.objectContaining({
        allocationId: "pack",
        homes: expect.arrayContaining([...plan(input).homes]),
      }),
    );
  });

  it("uses shortest wrapped paths for cover and normalises the returned placements", () => {
    const side = 20_000;
    const edge = { ...field, y: 9950 };
    const shifted = (p: Vec) => wrapPoint(side, { x: p.x + edge.x, y: p.y + edge.y });
    const input = context([
      {
        ...moving("a", 850),
        end: shifted({ x: 850, y: 100 }),
        start: shifted({ x: 850, y: -100 }),
      },
      {
        ...moving("b", 1050),
        end: shifted({ x: 1050, y: 100 }),
        start: shifted({ x: 1050, y: -100 }),
      },
    ]);
    const allocation = { ...input.allocation!, anchor: shifted(input.allocation!.anchor) };
    const placement = plan({ ...input, allocation, fields: [edge], worldSide: side });
    expect(placement.coverIds).toEqual(["a", "b"]);
    expect(placement.homes).toEqual(plan().homes.map(shifted));
  });

  it.each([
    { groupId: "fighter:lattice:2,-9", seed: 67, status: "planned" },
    { groupId: "fighter:lattice:4,-8", seed: 1103, status: "no-placement" },
  ])("checks ordinary admission with seeded rock paths for $seed", (test) => {
    const { groupId, seed, status } = test;
    const galaxy = 2;
    const world = flightWorldContext({ topology: CURRENT_FLIGHT_TOPOLOGY });
    const ore = worldOreFieldInCell(world, galaxy, { x: 1, y: -2 })!;
    expect(ore.guard).toBeNull();
    const rules = spawnRules(galaxy, world.worldSide);
    const grid = periodicWorldGrid(world, CONTENT.tuning.chunkSize);
    const cell = worldCellAt(grid, ore);
    const span = 18;
    const query = (span + 1) * grid.pitch * Math.SQRT2 + 3500;
    const generated = planRegion(
      rules,
      { encounter: seed, world: seed },
      {
        cell: { x: cell.x - span, y: cell.y - span },
        columns: 2 * span + 1,
        exclusions: worldSpawnExclusions(world, galaxy, seed, [], query, ore),
        rows: 2 * span + 1,
        sites: worldSpawnSites(world, galaxy, query, ore),
      },
    ).placements;
    const group = generated.filter(({ group }) => group === groupId);
    expect(group).toHaveLength(4);
    const id = ambientPackId(group[0]!.chunk);
    const rocks = generated
      .filter(({ category }) => category === "rock")
      .map((rock) => ({
        ...(rock.moving
          ? {
              end: {
                x: rock.x + rock.moving.velocity.x * MOVING_ROCKS.pathSeconds,
                y: rock.y + rock.moving.velocity.y * MOVING_ROCKS.pathSeconds,
              },
            }
          : {}),
        id: rock.moving ? MOVING_ROCK_PREFIX + rock.id : rock.id,
        radius: rock.radius,
        start: { x: rock.x, y: rock.y },
      }));
    rocks.push(
      ...ore.rocks.map((rock, index) => ({
        id: `${ore.id}:${index}`,
        radius: ASTEROID_SHAPES.get(rock.asteroid)!.radius,
        start: rock,
      })),
    );
    const packCentre = {
      x: group.reduce((sum, actor) => sum + actor.x, 0) / group.length,
      y: group.reduce((sum, actor) => sum + actor.y, 0) / group.length,
    };
    const neighbours = generated.flatMap((actor): SpaceObject[] => {
      if (
        actor.category !== "enemy" ||
        actor.group === groupId ||
        !isEnemyActorKind(actor.archetype)
      ) {
        return [];
      }
      const identity = {
        archetype: actor.archetype,
        id: actor.id,
        packId: actor.group ?? null,
        phase: 0,
      };
      const enemy = createEnemy(enemyEquipmentDefinition(galaxy, identity), identity, actor);
      return [
        {
          enemy,
          hp: enemy.hp,
          id: actor.id,
          kind: "enemy",
          radius: actor.radius,
          x: actor.x,
          y: actor.y,
        },
      ];
    });
    const policy = SPAWNER_POLICIES[galaxy];
    const result = planCartwheelMiningPatrol({
      ...world,
      admits: ({ anchor, homes }) =>
        worldFitsEncounter(
          world,
          policy,
          worldSpawnerStage(world, policy, anchor),
          ROUTE_POSITION[galaxy],
          neighbours,
          anchor,
          { archetype: "fighter", count: homes.length },
          Math.max(...homes.map((home) => worldDistance(world, anchor, home) + fighter.radius)),
        ),
      allocation: {
        anchor: packCentre,
        fighters: group.map(({ radius }) => ({ ...fighter, radius })),
        id,
      },
      fieldIsClear: () => true,
      fields: [ore],
      hubKnown: true,
      rocksNear: () => rocks,
    });
    expect(result.status).toBe(status);
    if (result.status === "no-placement") {
      expect(result.rejected).toContainEqual({ fieldId: ore.id, reason: "admission" });
      return;
    }
    if (result.status !== "planned") {
      throw new Error("Unexpected rejection before placement");
    }
    const placement = result.plan;
    expect(placement.allocationId).toBe(id);
    expect(placement.homes).toHaveLength(group.length);
    expect(placement.coverIds).toEqual(["moving:rock:7,-16:0", "moving:rock:7,-16:1"]);
    expect(placement.coverIds.every((id) => rocks.find((rock) => rock.id === id)?.end)).toBe(true);
    expect(worldDelta(world, ore, placement.anchor).y).toBeGreaterThan(0);
    expect(placement.bypass.every((point) => worldDelta(world, ore, point).y < -950)).toBe(true);
  });
});
