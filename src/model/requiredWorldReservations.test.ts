import { describe, expect, it } from "vitest";

import { CONTENT } from "../data/content.ts";
import { enemyDefinition } from "../data/enemyCatalog.ts";
import { spacingRadius } from "../data/enemySpacing.ts";
import { ROUTE_POSITION } from "../data/galaxies.ts";
import { SPAWNER_POLICIES, spawnerStage } from "../data/spawnerCatalog.ts";
import { createEnemy } from "./enemyAi.ts";
import { createFlight } from "./flight.ts";
import { newGameState } from "./game.ts";
import {
  requiredWorldOccupantsPlacementClear,
  requiredWorldOccupantsPopulation,
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
    // The guard's footprint is its Shoulder frigate's spacing radius.
    const reach = spacingRadius(1, guard.enemy!)!;
    expect(reach).toBe(63);
    expect(
      requiredWorldPlacementClear(context, reservations, {
        center: { x: guard.x + reach + 10, y: 0 },
        radius: 10,
      }),
    ).toBe(false);
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
    expect(worldFitsEncounter({}, policy, stage, ROUTE_POSITION[1], [], guard, ambient)).toBe(true);
    expect(
      worldFitsEncounter(
        {},
        policy,
        stage,
        ROUTE_POSITION[1],
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

describe("independent required world occupants", () => {
  function swarm() {
    const point = { x: 2000, y: 0 };
    const definition = enemyDefinition(4, "swarm", "needle:exit:0");
    return {
      ...point,
      enemy: createEnemy(
        definition,
        { archetype: "swarm", id: "needle:exit:0", packId: "needle:exit", phase: 0 },
        point,
      ),
      hp: definition.hp,
      id: "needle:exit:0",
      kind: "enemy" as const,
      radius: definition.sizeRatio * CONTENT.tuning.flight.shipRadius,
    };
  }

  it("supports protected sites without actors and authored swarm hulls without a route association", () => {
    const { site } = fixture();
    const actor = swarm();
    const needle = { content: CONTENT, galaxy: 4 as const };
    expect(
      requiredWorldOccupantsPlacementClear(
        needle,
        { actors: [], sites: [site] },
        {
          center: site,
          radius: 1,
        },
      ),
    ).toBe(false);
    expect(
      requiredWorldOccupantsPlacementClear(
        needle,
        { actors: [actor], sites: [] },
        {
          center: actor,
          radius: 1,
        },
      ),
    ).toBe(false);
    const reach = spacingRadius(3, actor.enemy)!;
    expect(
      requiredWorldOccupantsPlacementClear(
        needle,
        { actors: [actor], sites: [site] },
        {
          center: { x: actor.x + reach + 11, y: actor.y },
          radius: 10,
        },
      ),
    ).toBe(true);
    expect(actor).not.toHaveProperty("routeId");
    expect(actor.enemy.escortOf).toBeNull();
  });

  it("uses only canonical protected-place kinds, not an enemy sprite radius as site protection", () => {
    const actor = swarm();
    expect(
      requiredWorldOccupantsPlacementClear(
        { content: CONTENT, galaxy: 4 },
        {
          actors: [],
          sites: [{ ...actor, radius: 9999 }],
        },
        { center: actor, radius: 1 },
      ),
    ).toBe(true);
    expect(
      requiredWorldOccupantsPlacementClear(
        { content: CONTENT, galaxy: 4, worldSide: 10000 },
        {
          actors: [{ ...actor, x: 9999 }],
          sites: [],
        },
        { center: { x: 1, y: 0 }, radius: 1 },
      ),
    ).toBe(false);
  });

  it("counts authored actors once while retaining loaded state, clocks and authoritative removals", () => {
    const { flight } = fixture();
    const actor = swarm();
    expect(requiredWorldOccupantsPopulation(flight, [actor, actor])).toEqual([actor]);
    const retained = structuredClone(actor);
    retained.enemy.primaryCooldown = 0.75;
    flight.world.notables[actor.id] = retained;
    expect(requiredWorldOccupantsPopulation(flight, [actor])).toEqual([retained]);
    const loaded = structuredClone(retained);
    loaded.enemy.primaryCooldown = 0.25;
    flight.objects.push(loaded);
    const saved = structuredClone(flight);
    expect(requiredWorldOccupantsPopulation(flight, [actor, actor])).toEqual([loaded]);
    expect(flight).toEqual(saved);
    flight.objects = [];
    flight.world.notables[actor.id] = null;
    expect(requiredWorldOccupantsPopulation(flight, [actor])).toEqual([]);
    expect(flight.world.notables[actor.id]).toBeNull();
  });
});
