import { describe, expect, it } from "vitest";

import { enemyCatalog, enemyDefinition } from "../data/enemyCatalog.ts";
import { GALAXY_NUMBERS } from "../data/galaxies.ts";
import { SPAWNER_POLICIES, spawnerStage } from "../data/spawnerCatalog.ts";
import { createEnemy } from "./enemyAi.ts";
import { fitsEncounter, groupReach, memberPosition, selectEncounter } from "./spawner.ts";
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
  it("uses the fresh ledger at stage boundaries without changing enemy physics", () => {
    expect([0, 1799, 1800, 4199, 4200].map((fresh) => spawnerStage(1, fresh).localCap)).toEqual([
      3, 3, 4, 4, 5,
    ]);
    for (const galaxy of GALAXY_NUMBERS) {
      for (const archetype of ["swarm", "fighter", "interceptor", "capital"] as const) {
        expect(enemyDefinition(galaxy, archetype).physics).toBe(enemyCatalog[archetype].physics);
      }
    }
  });

  it("excludes later archetypes from the first stage across seeded encounter rolls", () => {
    const seen = new Set<string>();
    let seed = 12345;
    const next = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32;
    for (let i = 0; i < 1000; i++) {
      const plan = selectEncounter(policy, spawnerStage(1, 0), 10, [], centre, next(), next())!;
      seen.add(plan.archetype);
      expect(plan.count).toBeLessThanOrEqual(plan.archetype === "swarm" ? 2 : 1);
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
    expect(plan).toMatchObject({ archetype: "fighter", count: 1 });
    expect(objects).toHaveLength(1);
  });

  it("budgets the whole capital battle, its large footprint and the one-capital limit", () => {
    const laterPolicy = SPAWNER_POLICIES[3];
    const stage = spawnerStage(3, 0);
    const plan = {
      archetype: "capital",
      count: 1,
      escorts: { archetype: "fighter", count: 4 },
    } as const;
    expect(fitsEncounter(laterPolicy, stage, 10, [], centre, plan)).toBe(true);
    const objects = [occupant("old:0", centre), occupant("old:1", centre)];
    expect(fitsEncounter(laterPolicy, stage, 10, objects, centre, plan)).toBe(false);
    expect(
      fitsEncounter(laterPolicy, stage, 10, [occupant("capital", centre, "capital")], centre, plan),
    ).toBe(false);
    const reach = groupReach(laterPolicy, 10, plan);
    expect(reach).toBeGreaterThan(100);
    const edge = occupant("edge", { x: centre.x + 1800 + reach + 5, y: centre.y });
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
