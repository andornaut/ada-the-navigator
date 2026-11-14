import { describe, expect, it } from "vitest";

import { CONTENT } from "../data/content.ts";
import { encounterTable, enemyCatalog, enemyDefinition } from "../data/enemyCatalog.ts";
import { GALAXY_NUMBERS } from "../data/galaxies.ts";
import {
  FIGHTER_GROUP_TARGET,
  SPAWNER_POLICIES,
  spawnerStage,
  SWARM_GROUP_MINIMUM,
} from "../data/spawnerCatalog.ts";
import { GALAXY_SIDE } from "../data/world.ts";
import { createEnemy } from "./enemyAi.ts";
import { createFlight, stepFlight } from "./flight.ts";
import {
  engagementAdmissions,
  fitsEncounter,
  groupReach,
  memberPosition,
  selectEncounter,
  worldRegionalEngagementAdmissions,
  worldSpawnerStage,
} from "./spawner.ts";
import type { SpaceObject, Vec } from "./types.ts";

function occupant(
  id: string,
  point: Vec,
  archetype: "fighter" | "capital" = "fighter",
): SpaceObject {
  return {
    ...point,
    enemy: createEnemy(
      enemyCatalog[archetype],
      { archetype, id, packId: "adjacent", phase: 0 },
      point,
    ),
    hp: 4,
    id,
    kind: "enemy",
    radius: enemyCatalog[archetype].sizeRatio * 10,
  };
}

const policy = SPAWNER_POLICIES[1];
const centre = { x: 4000, y: 0 };

describe("spawner admission", () => {
  it("uses geographic region boundaries without changing enemy physics", () => {
    const approved = [0, 10000, 25000] as const;
    const caps = {
      1: [3, 4, 5],
      2: [5, 6, 7],
      3: [4, 5, 6],
      4: [4, 5, 6],
      5: [5, 6, 7],
      6: [6, 7, 8],
    };
    for (const galaxy of GALAXY_NUMBERS) {
      expect(SPAWNER_POLICIES[galaxy].stages.map((stage) => stage.centerDistance)).toEqual(
        approved,
      );
      expect(SPAWNER_POLICIES[galaxy].stages.map((stage) => stage.localCap)).toEqual(caps[galaxy]);
    }
    // One selector serves every galaxy; exercise each approved boundary on its three sides.
    for (const [index, threshold] of approved.entries()) {
      for (const offset of [-1, 0, 1]) {
        const stage = Math.max(0, index - (offset < 0 ? 1 : 0));
        expect(spawnerStage(1, threshold + offset).localCap).toBe(policy.stages[stage]!.localCap);
      }
    }
    expect(spawnerStage(1, approved[2] + 1).localCap).toBe(policy.stages.at(-1)!.localCap);
    for (const galaxy of GALAXY_NUMBERS) {
      for (const archetype of ["swarm", "fighter", "interceptor", "capital"] as const) {
        expect(enemyDefinition(galaxy, archetype).physics).toBe(enemyCatalog[archetype].physics);
      }
    }
  });

  it("blends only composition weights within the centered transition bands", () => {
    for (const [distance, swarm, retaliator, interceptor] of [
      [9000, 0.55, 0, 0],
      [9500, 0.525, 0.0375, 0],
      [10000, 0.5, 0.075, 0],
      [10500, 0.475, 0.1125, 0],
      [11000, 0.45, 0.15, 0],
      [24000, 0.45, 0.15, 0],
      [25000, 0.425, 0.15, 0.05],
      [26000, 0.4, 0.15, 0.1],
    ]) {
      const stage = spawnerStage(1, distance!);
      const weight = (kind: string) => stage.roster.find((e) => e.archetype === kind)?.weight ?? 0;
      expect(weight("swarm")).toBeCloseTo(swarm!, 12);
      expect(weight("retaliator")).toBeCloseTo(retaliator!, 12);
      expect(weight("interceptor")).toBeCloseTo(interceptor!, 12);
      expect(stage.localCap).toBe(distance! < 10000 ? 3 : distance! < 25000 ? 4 : 5);
    }
  });

  it("uses shortest center distance for aliases and returns to the inner profile without history", () => {
    const context = { worldSide: GALAXY_SIDE };
    for (const point of [
      { x: 9999, y: 0 },
      { x: 6000, y: 8000 },
      { x: 25000, y: 0 },
    ]) {
      expect(
        worldSpawnerStage(context, policy, { x: point.x + GALAXY_SIDE, y: point.y - GALAXY_SIDE }),
      ).toEqual(worldSpawnerStage(context, policy, point));
    }
    expect(worldSpawnerStage(context, policy, { x: GALAXY_SIDE / 2 - 1, y: 0 })).toEqual(
      worldSpawnerStage(context, policy, { x: -GALAXY_SIDE / 2 + 1, y: 0 }),
    );
    expect(worldSpawnerStage(context, policy, { x: 30000, y: 0 }).localCap).toBe(5);
    expect(worldSpawnerStage(context, policy, { x: 0, y: 0 }).localCap).toBe(3);
  });

  it("admits by each encounter location and keeps existing enemies unchanged on return", () => {
    const reserved = Array.from({ length: 3 }, (_, i) =>
      occupant(`reserved:${i}`, { x: 9999, y: i }),
    );
    reserved.forEach((object) => {
      object.enemy!.engaged = true;
    });
    const inner = occupant("inner", { x: 9999, y: 0 });
    const middle = occupant("middle", { x: 10001, y: 0 });
    const objects = [...reserved, inner, middle];
    const before = structuredClone(objects);
    const admitted = worldRegionalEngagementAdmissions(
      {},
      policy,
      objects,
      new Set([inner.id, middle.id]),
      { x: 30000, y: 0 },
    );
    expect(admitted.has(inner.id)).toBe(false);
    expect(admitted.has(middle.id)).toBe(true);
    expect(objects).toEqual(before);
    objects.forEach((object) => {
      object.x = 0;
      object.enemy!.engaged = true;
    });
    const returned = structuredClone(objects);
    expect(worldRegionalEngagementAdmissions({}, policy, objects, new Set(), centre).size).toBe(
      objects.length,
    );
    expect(objects).toEqual(returned);
  });

  it("preserves later rosters and geometry while whole-group admission follows each stage budget", () => {
    for (const galaxy of [3, 4, 5, 2, 6] as const) {
      const policy = SPAWNER_POLICIES[galaxy];
      expect(policy.localRadius).toBe(900);
      expect(policy.maxNearbyCapitals).toBe(1);
      expect(policy.memberSpacing).toBe(galaxy === 3 || galaxy === 4 ? 110 : 100);
      for (const stage of policy.stages) {
        expect(stage.roster).toEqual(
          encounterTable(galaxy).map((entry) =>
            entry.archetype === "fighter"
              ? { ...entry, groupSize: [FIGHTER_GROUP_TARGET, FIGHTER_GROUP_TARGET] }
              : entry.archetype === "swarm"
                ? { ...entry, groupSize: [SWARM_GROUP_MINIMUM, entry.groupSize[1]] }
                : entry,
          ),
        );
        expect(stage.maxNearbyArchetypes).toBe({ 2: 4, 3: 2, 4: 3, 5: 4, 6: 4 }[galaxy]);
        const objects = Array.from({ length: stage.localCap }, (_, index) =>
          occupant(`occupied:${index}`, centre),
        );
        const before = structuredClone(objects);
        expect(selectEncounter(policy, stage, 10, objects, centre, 0, 0)).toBeNull();
        expect(objects).toEqual(before);
        const single = { archetype: "fighter", count: 1 } as const;
        expect(fitsEncounter(policy, stage, 10, objects.slice(1), centre, single)).toBe(true);
        expect(fitsEncounter(policy, stage, 10, objects, centre, single)).toBe(false);
      }
    }
  });

  it("uses every galaxy stage for live admissions while preserving guards and existing combatants", () => {
    for (const galaxy of GALAXY_NUMBERS) {
      for (const stage of SPAWNER_POLICIES[galaxy].stages) {
        const ships = Array.from({ length: stage.localCap + 2 }, (_, index) =>
          occupant(`live:${index}`, centre),
        );
        ships[0]!.routeId = "required";
        ships[1]!.enemy!.engaged = true;
        const eligible = new Set(ships.map((ship) => ship.id));
        const before = structuredClone(ships);
        const admitted = engagementAdmissions(
          SPAWNER_POLICIES[galaxy],
          stage,
          ships,
          eligible,
          centre,
        );
        expect(admitted.size).toBe(stage.localCap);
        expect(admitted.has(ships[0]!.id)).toBe(true);
        expect(admitted.has(ships[1]!.id)).toBe(true);
        expect(ships).toEqual(before);
        ships.forEach((ship) => {
          ship.enemy!.engaged = true;
        });
        expect(
          engagementAdmissions(SPAWNER_POLICIES[galaxy], stage, ships, eligible, centre).size,
        ).toBe(ships.length);
      }
    }
  });

  it("excludes later archetypes from the first stage across seeded encounter rolls", () => {
    const seen = new Set<string>();
    let seed = 12345;
    const next = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32;
    for (let i = 0; i < 32; i++) {
      const plan = selectEncounter(policy, spawnerStage(1, 0), 10, [], centre, next(), next())!;
      seen.add(plan.archetype);
      expect(plan.count).toBeLessThanOrEqual(plan.archetype === "swarm" ? 2 : 3);
    }
    expect([...seen].sort()).toEqual(["fighter", "swarm"]);
  });

  it("counts a chasing adjacent pack using its live location, including a required guard", () => {
    const stage = spawnerStage(1, 0);
    const objects = Array.from({ length: 3 }, (_, i) =>
      occupant(`old:${i}`, { x: centre.x + 1700, y: i * 10 }),
    );
    objects[0]!.routeId = "required";
    objects[1]!.enemy!.engaged = true;
    expect(selectEncounter(policy, stage, 10, objects, centre, 0, 0)).toBeNull();
    objects.forEach((object) => {
      object.x += 3000;
    });
    expect(selectEncounter(policy, stage, 10, objects, centre, 0, 0)).not.toBeNull();
    expect(objects[0]!.routeId).toBe("required");
    expect(objects[1]!.enemy!.engaged).toBe(true);
  });

  it("uses available space for the current type rather than silently adding another type", () => {
    const objects = [occupant("old", centre)];
    const plan = selectEncounter(policy, spawnerStage(1, 0), 10, objects, centre, 0.99, 0)!;
    expect(plan).toMatchObject({ archetype: "fighter", count: 2 });
    expect(objects).toHaveLength(1);
  });

  it("admits configured swarm maxima within every galaxy region's budget", () => {
    for (const galaxy of GALAXY_NUMBERS) {
      const policy = SPAWNER_POLICIES[galaxy];
      for (const stage of policy.stages) {
        const swarm = stage.roster.find(({ archetype }) => archetype === "swarm")!;
        const plan = selectEncounter(policy, { ...stage, roster: [swarm] }, 10, [], centre, 0, 0);
        expect(plan).toMatchObject({
          archetype: "swarm",
          count: Math.min(stage.localCap, swarm.groupSize[1]),
        });
        expect(plan!.count).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it("fits occupied swarm capacity down to two without singleton, cap raises or max growth", () => {
    const policy = SPAWNER_POLICIES[6];
    const stage = policy.stages[2]!;
    const swarm = stage.roster.find(({ archetype }) => archetype === "swarm")!;
    for (const [occupied, expected] of [
      [8, null],
      [7, null],
      [6, 2],
      [5, 3],
    ] as const) {
      const objects = Array.from({ length: occupied }, (_, i) => occupant(`old:${i}`, centre));
      const before = structuredClone({ objects, stage });
      const plan = selectEncounter(
        policy,
        { ...stage, roster: [swarm] },
        10,
        objects,
        centre,
        0,
        0,
      );
      if (expected === null) {
        expect(plan).toBeNull();
      } else {
        expect(plan).toMatchObject({ archetype: "swarm", count: expected });
      }
      expect({ objects, stage }).toEqual(before);
    }
  });

  it("fits target-four fighters to available slots without exceeding or raising the budget", () => {
    for (const [stageIndex, occupants, expected] of [
      [0, 0, 3],
      [1, 0, 4],
      [1, 1, 3],
      [2, 0, 4],
    ] as const) {
      const stage = policy.stages[stageIndex]!;
      const fighter = stage.roster.find(({ archetype }) => archetype === "fighter")!;
      const objects = Array.from({ length: occupants }, (_, index) =>
        occupant(`old:${index}`, centre),
      );
      const before = structuredClone(stage);
      expect(
        selectEncounter(policy, { ...stage, roster: [fighter] }, 10, objects, centre, 0, 0),
      ).toMatchObject({ archetype: "fighter", count: expected });
      expect(stage).toEqual(before);
    }
  });

  it("budgets the whole capital battle, its large footprint and the one-capital limit", () => {
    const laterPolicy = SPAWNER_POLICIES[3];
    const stage = SPAWNER_POLICIES[3].stages[1]!;
    const plan = {
      archetype: "capital",
      count: 1,
      escorts: { archetype: "fighter", count: 4 },
    } as const;
    expect(fitsEncounter(laterPolicy, spawnerStage(3, 0), 10, [], centre, plan)).toBe(false);
    expect(fitsEncounter(laterPolicy, stage, 10, [], centre, plan)).toBe(true);
    const capital = stage.roster.find(({ archetype }) => archetype === "capital")!;
    expect(
      selectEncounter(
        laterPolicy,
        { ...spawnerStage(3, 0), roster: [capital] },
        10,
        [],
        centre,
        0,
        0,
      ),
    ).toBeNull();
    expect(
      selectEncounter(laterPolicy, { ...stage, roster: [capital] }, 10, [], centre, 0, 0),
    ).toEqual(plan);
    expect(capital.escorts).toEqual(plan.escorts);
    const objects = [occupant("old:0", centre), occupant("old:1", centre)];
    expect(fitsEncounter(laterPolicy, stage, 10, objects, centre, plan)).toBe(false);
    expect(
      fitsEncounter(laterPolicy, stage, 10, [occupant("capital", centre, "capital")], centre, plan),
    ).toBe(false);
    const reach = groupReach(laterPolicy, 10, plan);
    expect(reach).toBeGreaterThan(100);
    const edge = occupant("edge", {
      x: centre.x + laterPolicy.localRadius * 2 + reach + 5,
      y: centre.y,
    });
    expect(fitsEncounter(laterPolicy, { ...stage, localCap: 5 }, 10, [edge], centre, plan)).toBe(
      false,
    );
  });

  it("keeps complete symmetric groups within their reserved footprint", () => {
    const plan = { archetype: "swarm", count: 3 } as const;
    const reach = groupReach(policy, 10, plan);
    const positions = Array.from({ length: plan.count }, (_, index) =>
      memberPosition(policy.memberSpacing, plan.count, centre, index),
    );
    expect(positions[0]!.x + positions[2]!.x).toBe(2 * centre.x);
    expect(
      positions.every((point) => Math.hypot(point.x - centre.x, point.y - centre.y) + 6.5 <= reach),
    ).toBe(true);
  });
});

describe("actual flight engagement path", () => {
  it("reserves guard and existing chaser pressure before admitting new ambient ships", () => {
    const content = structuredClone(CONTENT);
    content.tuning.flight.objectsPerChunk = 0;
    const flight = createFlight(content, 1, 19, { known: [] });
    flight.player = { x: 4000, y: 4000 };
    const idle = { aim: { x: 0, y: 0 }, move: { x: 0, y: 0 }, use: false };
    stepFlight(content, 0.001, idle, flight);
    const ships = Array.from({ length: 5 }, (_, index) =>
      occupant(`candidate:${index}`, { x: 4200 + index * 80, y: 4000 }),
    );
    ships.forEach((ship) => {
      ship.enemy!.packId = null;
    });
    ships[4]!.routeId = "required";
    ships[3]!.enemy!.engaged = true;
    flight.objects = ships;
    stepFlight(content, 0.001, idle, flight);
    expect(ships.filter((ship) => ship.enemy!.engaged)).toHaveLength(3);
    expect(ships[4]!.enemy!.engaged).toBe(true);
    expect(ships[3]!.enemy!.engaged).toBe(true);
    const waiting = ships.filter((ship) => !ship.enemy!.engaged);
    expect(waiting).toHaveLength(2);
    expect(waiting.every((ship) => ship.enemy!.lastSeen?.x === flight.player.x)).toBe(true);
    // Existing combatants can converge beyond the budget without being frozen or removed.
    ships.forEach((ship) => {
      ship.enemy!.engaged = true;
    });
    stepFlight(content, 0.001, idle, flight);
    expect(ships.every((ship) => ship.enemy!.engaged)).toBe(true);
    expect(
      ships.every((ship) => Math.hypot(ship.enemy!.velocity.x, ship.enemy!.velocity.y) > 0),
    ).toBe(true);
    expect(flight.objects.filter((object) => object.kind === "enemy")).toHaveLength(5);
  });
});

it("uses encounter locations rather than fresh history in actual seeded generation", () => {
  const content = structuredClone(CONTENT);
  content.tuning.flight.objectsPerChunk = 0;
  const idle = { aim: { x: 0, y: 0 }, move: { x: 0, y: 0 }, use: false };
  for (const point of [
    { x: 4500, y: 4500 },
    { x: 15000, y: 0 },
    { x: 30000, y: 0 },
  ]) {
    let encounters = 0;
    for (let seed = 0; seed < 12; seed++) {
      const flight = createFlight(content, 1, seed, { known: [] });
      flight.freshDistance = 123456;
      flight.freshChunk = null;
      flight.player = point;
      stepFlight(content, 0.001, idle, flight);
      const packs = new Map<string, SpaceObject[]>();
      for (const object of flight.objects) {
        const packId = object.enemy?.packId;
        if (packId?.startsWith("pack:")) {
          packs.set(packId, [...(packs.get(packId) ?? []), object]);
        }
      }
      for (const [packId, group] of packs) {
        const [x, y] = packId.slice(5).split(",").map(Number);
        const location = {
          x: (x! + 0.5) * content.tuning.chunkSize,
          y: (y! + 0.5) * content.tuning.chunkSize,
        };
        const stage = worldSpawnerStage({}, policy, location);
        const entry = stage.roster.find((entry) => entry.archetype === group[0]!.enemy!.archetype);
        expect(entry).toBeDefined();
        expect(group.length).toBeLessThanOrEqual(entry!.groupSize[1]);
        expect(group.length).toBeLessThanOrEqual(stage.localCap);
        encounters++;
      }
      expect(flight.freshDistance).toBe(123456);
    }
    expect(encounters).toBeGreaterThan(0);
  }
});
