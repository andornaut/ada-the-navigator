import { expect, it } from "vitest";

import { CONTENT } from "../data/content.ts";
import { SPAWNER_POLICIES } from "../data/spawnerCatalog.ts";
import {
  createFlight,
  createUnpopulatedFlight,
  planRequiredFrigate,
  planRequiredRouteReservations,
  planRequiredWorld,
  spawnQuestFrigateAt,
} from "./flight.ts";
import { worldFitsEncounter, worldSpawnerStage } from "./spawner.ts";
import type { SpaceObject } from "./types.ts";

function siteFlight(x: number) {
  const flight = createFlight(CONTENT, 1, 173, { known: [] });
  flight.objects = [];
  flight.world = { notables: {}, version: 1 };
  const site: SpaceObject = { hp: 1, id: "growers", kind: "destination", radius: 30, x, y: -2000 };
  flight.objects.push(site);
  return { flight, site };
}

it("plans the required frigate with zero support under the inner one-archetype limit", () => {
  const { flight, site } = siteFlight(0);
  const before = structuredClone(flight);
  const plan = planRequiredFrigate(CONTENT, flight, "route:growers", site.id)!;
  expect(plan).not.toBeNull();
  expect(plan.leader.enemy!.archetype).toBe("frigate");
  expect(plan.support).toHaveLength(0);
  expect(plan.leader.routeId).toBe(site.id);
  expect(flight).toEqual(before);
  const policy = SPAWNER_POLICIES[1];
  const stage = worldSpawnerStage({}, policy, plan.leader);
  expect(stage.maxNearbyArchetypes).toBe(1);
  expect(
    worldFitsEncounter({}, policy, stage, CONTENT.tuning.flight.shipRadius, [], plan.leader, {
      archetype: "frigate",
      count: 1,
    }),
  ).toBe(true);
});

it("retains the largest legal support formation and stable identities outside the inner band", () => {
  const { flight, site } = siteFlight(15000);
  const plan = planRequiredFrigate(CONTENT, flight, "route:growers", site.id)!;
  expect(plan.support).toHaveLength(2);
  const created = spawnQuestFrigateAt(
    CONTENT,
    flight,
    plan.leader.id,
    site.id,
    plan.leader,
    plan.support.length,
  )!;
  expect(created).not.toBeNull();
  expect(plan.support.map((actor) => actor.id)).toEqual([
    "route:growers:escort:0",
    "route:growers:escort:1",
  ]);
  const follower = flight.objects.find((actor) => actor.id === plan.support[0]!.id)!;
  flight.objects = flight.objects.filter((actor) => actor !== follower);
  flight.world.notables[follower.id] = null;
  const before = structuredClone(flight);
  const repeated = planRequiredFrigate(CONTENT, flight, created.id, site.id)!;
  expect(repeated.support).toHaveLength(1);
  expect(flight).toEqual(before);
});

it("reports an incompatible occupied type budget without omitting the required leader", () => {
  const { flight, site } = siteFlight(0);
  const other = siteFlight(15000);
  const plan = planRequiredFrigate(CONTENT, other.flight, "route:workshop", other.site.id)!;
  const fighter = structuredClone(plan.support[0]!);
  fighter.x = site.x;
  fighter.y = site.y - 1500;
  flight.objects.push(fighter);
  const before = structuredClone(flight);
  expect(planRequiredFrigate(CONTENT, flight, "route:growers", site.id)).toBeNull();
  expect(flight).toEqual(before);
  expect(flight.combat?.emptyRoutePlans).toBeUndefined();
});

it("reserves all three real Sunflower leaders before optional support without revealing planned sites", () => {
  const { flight, site } = siteFlight(0);
  flight.objects = [];
  const sites = ["growers", "workshop", "salvagers"].map((id, index) => ({
    ...site,
    id,
    x: (index - 1) * CONTENT.tuning.storySpacing,
  }));
  const before = structuredClone(flight);
  const result = planRequiredRouteReservations(CONTENT, flight, sites);
  expect(result.status).toBe("planned");
  if (result.status !== "planned") {
    throw new Error(result.siteId);
  }
  expect(result.plans.map((plan) => plan.leader.routeId)).toEqual(sites.map((item) => item.id));
  expect(result.plans.every((plan) => plan.support.length === 0)).toBe(true);
  expect(result.plans.every((plan) => plan.leader.enemy!.archetype === "frigate")).toBe(true);
  expect(flight).toEqual(before);
});

it("plans canonical required sites and leaders before the first optional chunk without revealing them", () => {
  const flight = createUnpopulatedFlight(CONTENT, 1, 173);
  const before = structuredClone(flight);
  const result = planRequiredWorld(CONTENT, flight, ["growers", "workshop", "salvagers"]);
  expect(result.status).toBe("planned");
  if (result.status !== "planned") {
    throw new Error(result.siteId);
  }
  expect(result.sites.map((site) => site.id)).toEqual(["growers", "workshop", "salvagers"]);
  expect(result.plans).toHaveLength(3);
  expect(result.plans.every((plan) => plan.leader.hp > 0)).toBe(true);
  expect(flight).toEqual(before);
  expect(flight.chunks).toEqual([]);
  expect(flight.objects).toEqual([]);
  expect(flight.world.notables).toEqual({});
});
