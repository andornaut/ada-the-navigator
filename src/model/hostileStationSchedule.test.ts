import { expect, it } from "vitest";

import { CONTENT } from "../data/content.ts";
import { enemyActorDefinition } from "../data/enemyActorDefinition.ts";
import { ROUTE_POSITION } from "../data/galaxies.ts";
import { SPAWNER_POLICIES } from "../data/spawnerCatalog.ts";
import { GALAXY_SIDE } from "../data/world.ts";
import { outlinesContact } from "./convex.ts";
import { createEnemy } from "./enemyAi.ts";
import { enemyPhysicalBody } from "./enemyBody.ts";
import { createUnpopulatedFlight, spawnPlannedHostileStation } from "./flight.ts";
import { flightWorldContext } from "./flightTopology.ts";
import { worldRecordObjectRemoval } from "./geography.ts";
import type { PlannedHostileStation } from "./hostileStations.ts";
import {
  type HostileStationScheduleContext,
  planHostileStationFormation,
  scheduleHostileStations,
} from "./hostileStationSchedule.ts";
import { hostileStationSites } from "./hostileStationSites.ts";
import { worldSpawnerStage } from "./spawner.ts";
import { worldPoint } from "./worldContacts.ts";

const identities = {
  bodyId: "authoritative-body",
  defenderIds: ["authoritative-left", "authoritative-right"],
};

it("uses authoritative IDs and actual assembled bodies for opposite defender slots, including wrapping", () => {
  for (const worldSide of [undefined, 100000]) {
    const context = { galaxy: 6 as const, ...(worldSide === undefined ? {} : { worldSide }) };
    const site = { id: "geographic-point", x: 49999, y: 0 };
    const plan = planHostileStationFormation(context, identities, site)!;
    expect(plan.id).toBe(identities.bodyId);
    expect(plan.point).toEqual({ x: site.x, y: site.y });
    expect(plan.defenders.map(({ id }) => id)).toEqual(identities.defenderIds);
    if (worldSide !== undefined) {
      expect(plan.defenders.some(({ point }) => point.x < 0)).toBe(true);
    }
    const actors = [
      { id: plan.id, kind: "hostileStation" as const, point: plan.point },
      ...plan.defenders.map((actor) => ({ ...actor, kind: "swarm" as const })),
    ].map((actor) => {
      const definition = enemyActorDefinition(context.galaxy, actor.kind, actor.id);
      return {
        point: actor.point,
        state: createEnemy(
          definition,
          { archetype: actor.kind, id: actor.id, packId: null, phase: 0 },
          actor.point,
        ),
      };
    });
    for (const [index, actor] of actors.entries()) {
      for (const other of actors.slice(index + 1)) {
        expect(
          outlinesContact(
            enemyPhysicalBody(ROUTE_POSITION[6], actor.state)!,
            actor.point,
            enemyPhysicalBody(ROUTE_POSITION[6], other.state)!,
            worldPoint(context, actor.point, other.point),
          ),
        ).toBeNull();
      }
    }
  }
});

it("spaces defenders by the station's and their own spacing radii and the member spacing", () => {
  for (const galaxy of [2, 5, 6] as const) {
    const site = { id: "geographic-point", x: 40000, y: 0 };
    const plan = planHostileStationFormation({ galaxy }, identities, site)!;
    // Station r 70, swarm r 8, then the galaxy's member spacing.
    const gap = 70 + 8 + SPAWNER_POLICIES[galaxy].memberSpacing;
    expect(plan.defenders.map(({ point }) => point)).toEqual([
      { x: site.x - gap, y: site.y },
      { x: site.x + gap, y: site.y },
    ]);
  }
});

function fixture() {
  const siteContext = { galaxy: 5 as const, geographySeed: 173, worldSide: GALAXY_SIDE };
  const site = hostileStationSites(siteContext, {
    height: 200000,
    width: 200000,
    x: -100000,
    y: -100000,
  })[0]!;
  expect(site).toBeDefined();
  const region = { height: 2, width: 2, x: site.x - 1, y: site.y - 1 };
  const flight = createUnpopulatedFlight(CONTENT, 5, 173);
  flight.player = { x: site.x, y: site.y + 1200 };
  const registered = new Set<string>();
  const remembered = new Map<string, typeof site>();
  const attempts: PlannedHostileStation[] = [];
  const context: HostileStationScheduleContext = {
    ...siteContext,
    hasEncounter: (id) => registered.has(id),
    identities: () => identities,
    materialize(plan) {
      attempts.push(structuredClone(plan));
      return spawnPlannedHostileStation(CONTENT, flight, plan);
    },
    register: (id) => {
      registered.add(id);
    },
    remember(candidate) {
      if (!remembered.has(candidate.id)) {
        remembered.set(candidate.id, { ...candidate });
      }
      return remembered.get(candidate.id)!;
    },
  };
  return { attempts, context, flight, region, registered, remembered, site };
}

it("defers the whole real formation at capacity, then retries the same site and points once capacity clears", () => {
  const { attempts, context, flight, region, registered, remembered, site } = fixture();
  const stage = worldSpawnerStage(flightWorldContext(flight), SPAWNER_POLICIES[5], site);
  for (let index = 0; index < stage.localCap; index++) {
    const id = `occupied:${index}`;
    const point = { x: site.x + 600, y: site.y + index * 40 };
    const definition = enemyActorDefinition(5, "swarm", id);
    const enemy = createEnemy(
      definition,
      { archetype: "swarm", id, packId: "occupied", phase: 0 },
      point,
    );
    flight.objects.push({
      ...point,
      enemy,
      hp: enemy.hp,
      id,
      kind: "enemy",
      radius: definition.sizeRatio * CONTENT.tuning.flight.shipRadius,
    });
  }
  const before = structuredClone(flight);
  scheduleHostileStations(context, region);
  expect(flight).toEqual(before);
  expect(registered.size).toBe(0);
  expect([...remembered.keys()]).toEqual([site.id]);
  flight.objects = [];
  scheduleHostileStations(context, region);
  expect(registered).toEqual(new Set([site.id]));
  expect(flight.objects.map(({ id }) => id)).toEqual([
    identities.bodyId,
    ...identities.defenderIds,
  ]);
  expect(attempts[1]).toEqual(attempts[0]);
  const committed = structuredClone(flight);
  scheduleHostileStations(context, region);
  expect(flight).toEqual(committed);
  expect(attempts).toHaveLength(2);
});

it("never replenishes casualties or rematerializes a registered unresolved body after pack pruning", () => {
  const { attempts, context, flight, region, registered, site } = fixture();
  scheduleHostileStations(context, region);
  expect(registered.has(site.id)).toBe(true);
  const casualty = flight.objects.find(({ id }) => id === identities.defenderIds[0])!;
  worldRecordObjectRemoval(flightWorldContext(flight), CONTENT, casualty, flight);
  flight.objects = flight.objects.filter(({ id }) => id !== casualty.id);
  const survivors = structuredClone(flight);
  scheduleHostileStations(context, region);
  expect(flight).toEqual(survivors);
  expect(attempts).toHaveLength(1);
  // A registry without an authoritative actor is unresolved, even without pack metadata.
  flight.objects = [];
  flight.world.notables = {};
  flight.combat!.initialPackSizes = {};
  const unresolved = structuredClone(flight);
  scheduleHostileStations(context, region);
  expect(flight).toEqual(unresolved);
  expect(attempts).toHaveLength(1);
});
