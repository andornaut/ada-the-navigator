import { describe, expect, it } from "vitest";

import { CONTENT } from "../data/content.ts";
import { enemyDefinition } from "../data/enemyCatalog.ts";
import { SPAWNER_POLICIES, spawnerStage } from "../data/spawnerCatalog.ts";
import { partsReach, worldParts } from "./convex.ts";
import { createEnemy } from "./enemyAi.ts";
import { enemyPhysicalBody } from "./enemyBody.ts";
import { createFlight } from "./flight.ts";
import { newGameState } from "./game.ts";
import {
  requiredWorldPlacementClear,
  requiredWorldPopulation,
} from "./requiredWorldReservations.ts";
import { worldFitsEncounter } from "./spawner.ts";
import type { SpaceObject } from "./types.ts";

const context = { content: CONTENT, galaxy: 1 as const };
function fixture() {
  const site: SpaceObject = { hp: 1, id: "growers", kind: "destination", radius: 9999, x: 0, y: 0 };
  const point = { x: 2000, y: 0 };
  const guard: SpaceObject = {
    ...point,
    enemy: createEnemy(
      enemyDefinition(1, "frigate", "route:growers"),
      {
        archetype: "frigate",
        id: "route:growers",
        packId: null,
        phase: 0,
      },
      point,
    ),
    hp: 30,
    id: "route:growers",
    kind: "enemy",
    radius: 9999,
    routeId: site.id,
  };
  const flight = createFlight(CONTENT, 1, 173, newGameState().progress[1]);
  flight.objects = [];
  flight.world = { notables: {}, version: 1 };
  return { flight, guard, reservations: [{ guard, site }], site };
}

describe("required world reservations", () => {
  it("reserves the canonical protected radius and actual hull rather than sprite bounds", () => {
    const { guard, reservations } = fixture();
    expect(
      requiredWorldPlacementClear(context, reservations, {
        center: { x: CONTENT.tuning.safeRadius + 9, y: 0 },
        radius: 10,
      }),
    ).toBe(false);
    expect(
      requiredWorldPlacementClear(context, reservations, {
        center: { x: CONTENT.tuning.safeRadius + 11, y: 0 },
        radius: 10,
      }),
    ).toBe(true);
    expect(requiredWorldPlacementClear(context, reservations, { center: guard, radius: 1 })).toBe(
      false,
    );
    const reach = partsReach(worldParts(enemyPhysicalBody(1, guard.enemy!)!));
    expect(
      requiredWorldPlacementClear(context, reservations, {
        center: { x: guard.x + reach + 11, y: 0 },
        radius: 10,
      }),
    ).toBe(true);
    expect(requiredWorldPlacementClear(context, [], { center: guard, radius: -1 })).toBe(false);
  });

  it("keeps complete swept footprints clear across the world seam", () => {
    const { guard, reservations, site } = fixture();
    site.x = 9990;
    guard.x = 9000;
    const periodic = { ...context, worldSide: 10000 };
    expect(
      requiredWorldPlacementClear(periodic, reservations, {
        center: { x: 5, y: 0 },
        radius: 1,
      }),
    ).toBe(false);
    expect(
      requiredWorldPlacementClear(context, reservations, {
        center: { x: 5, y: 0 },
        radius: 1,
      }),
    ).toBe(true);
    expect(
      requiredWorldPlacementClear(periodic, reservations, {
        center: { x: guard.x + 600, y: 0 },
        radius: 650,
      }),
    ).toBe(false);
  });

  it("deduplicates loaded and retained state without reviving tombstones or revealing plans", () => {
    const { flight, guard, reservations, site } = fixture();
    const before = structuredClone(flight);
    expect(requiredWorldPopulation(flight, [...reservations, ...reservations])).toEqual([guard]);
    expect(flight).toEqual(before);
    expect(flight.objects).not.toContain(site);
    expect(flight).not.toHaveProperty("markerActors");
    const retained = structuredClone(guard);
    retained.enemy!.hp = 9;
    retained.enemy!.hardpoints[0]!.cooldown = 1.25;
    flight.world.notables[guard.id] = retained;
    expect(requiredWorldPopulation(flight, reservations)).toEqual([retained]);
    const loaded = structuredClone(retained);
    loaded.enemy!.hp = 8;
    flight.objects.push(loaded);
    expect(requiredWorldPopulation(flight, reservations)).toEqual([loaded]);
    flight.objects = [];
    flight.world.notables[guard.id] = null;
    expect(requiredWorldPopulation(flight, reservations)).toEqual([]);
    expect(flight.world.notables[guard.id]).toBeNull();
  });

  it("reserves required admission capacity before optional ambient selection without raising caps", () => {
    const { flight, guard, reservations } = fixture();
    const policy = SPAWNER_POLICIES[1];
    const stage = spawnerStage(1, 0);
    const ambient = { archetype: "fighter" as const, count: 1 };
    expect(
      worldFitsEncounter({}, policy, stage, CONTENT.tuning.flight.shipRadius, [], guard, ambient),
    ).toBe(true);
    expect(
      worldFitsEncounter(
        {},
        policy,
        stage,
        CONTENT.tuning.flight.shipRadius,
        requiredWorldPopulation(flight, reservations),
        guard,
        ambient,
      ),
    ).toBe(false);
    expect(stage.localCap).toBe(3);
    expect(stage.maxNearbyArchetypes).toBe(1);
    expect(flight.objects).toEqual([]);
    expect(flight.combat?.routeEncounters).toEqual([]);
  });
});
