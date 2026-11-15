import { expect, it } from "vitest";

import { CONTENT } from "../data/content.ts";
import { SPAWNER_POLICIES } from "../data/spawnerCatalog.ts";
import { placementRadius } from "./asteroids.ts";
import {
  activateRequiredRoute,
  createFlight,
  createUnpopulatedFlight,
  planRequiredFrigate,
  planRequiredRouteReservations,
  planRequiredWorld,
  populateRequiredFlight,
  spawnQuestFrigateAt,
  stepFlight,
} from "./flight.ts";
import { newGameState } from "./game.ts";
import { readRequiredPlan, storeRequiredPlan } from "./requiredEncounterPlans.ts";
import {
  requiredWorldPlacementClear,
  type RequiredWorldReservation,
} from "./requiredWorldReservations.ts";
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

it("activates a reserved site once without replacing destroyed support or treating absence as defeat", () => {
  const flight = createUnpopulatedFlight(CONTENT, 1, 173);
  const planned = planRequiredWorld(CONTENT, flight, ["growers", "workshop", "salvagers"]);
  if (planned.status !== "planned") {
    throw new Error(planned.siteId);
  }
  const progress = newGameState().progress[1];
  for (const plan of planned.plans) {
    storeRequiredPlan(progress, flight, {
      leader: plan.leader,
      site: planned.sites.find((site) => site.id === plan.siteId)!,
      support: [...plan.support],
    });
  }
  expect(flight.objects).toEqual([]);
  const created = activateRequiredRoute(CONTENT, "growers", flight);
  expect(created.status).toBe("created");
  expect(flight.requiredPlans?.growers).toBeUndefined();
  const after = structuredClone(flight);
  expect(activateRequiredRoute(CONTENT, "growers", flight).status).toBe("existing");
  expect(flight).toEqual(after);
  if (created.status !== "created") {
    throw new Error(created.status);
  }
  flight.objects = flight.objects.filter((object) => object.id !== created.guard.id);
  flight.world.notables[created.guard.id] = null;
  const casualty = structuredClone(flight);
  expect(activateRequiredRoute(CONTENT, "growers", flight).status).toBe("resolved");
  expect(flight).toEqual(casualty);
  expect(activateRequiredRoute(CONTENT, "absent-site", flight).status).toBe("unplanned");
});

it("generates optional content around hidden required footprints and retains capacity for activation", () => {
  const flight = createUnpopulatedFlight(CONTENT, 1, 173);
  const progress = newGameState().progress[1];
  const planned = populateRequiredFlight(
    CONTENT,
    progress,
    ["growers", "workshop", "salvagers"],
    flight,
  );
  expect(planned.status).toBe("planned");
  const reservations: RequiredWorldReservation[] = Object.values(
    flight.requiredPlans ?? {},
  ).flatMap(({ leader, site, support }) => [leader, ...support].map((guard) => ({ guard, site })));
  expect(reservations).toHaveLength(3);
  expect(progress.known).toEqual([]);
  expect(flight.objects.some((actor) => actor.routeId || progress.known.includes(actor.id))).toBe(
    false,
  );
  const site = reservations.find(({ site }) => site.id === "growers")!.site;
  flight.player = { x: site.x, y: site.y };
  stepFlight(CONTENT, 1 / 120, { aim: { x: 0, y: 0 }, move: { x: 0, y: 0 }, use: false }, flight);
  const optional = flight.objects.filter((actor) =>
    ["rock", "resource", "debris", "enemy"].includes(actor.kind),
  );
  expect(optional.length).toBeGreaterThan(0);
  expect(
    optional.every((actor) =>
      requiredWorldPlacementClear({ content: CONTENT, galaxy: flight.galaxy }, reservations, {
        center: actor.orbit ?? actor,
        radius: placementRadius(actor) + (actor.orbit?.radius ?? 0),
      }),
    ),
  ).toBe(true);
  expect(activateRequiredRoute(CONTENT, "growers", flight).status).toBe("created");
  expect(flight.combat?.emptyRoutePlans).toBeUndefined();
  expect(progress.known).toEqual([]);
});

it("retains the same hidden plan when activation geometry fails and transfers it only after validation", () => {
  const flight = createUnpopulatedFlight(CONTENT, 1, 173);
  const progress = newGameState().progress[1];
  populateRequiredFlight(CONTENT, progress, ["growers"], flight);
  const plan = readRequiredPlan(flight, "growers")!;
  expect(plan).not.toBeNull();
  const blocker: SpaceObject = {
    hp: 1,
    id: "blocked-required-home",
    kind: "rock",
    radius: plan.leader.radius,
    x: plan.leader.x,
    y: plan.leader.y,
  };
  flight.objects.push(blocker);
  const before = structuredClone(flight);
  expect(activateRequiredRoute(CONTENT, "growers", flight).status).toBe("blocked");
  expect(readRequiredPlan(flight, "growers")).toBe(plan);
  expect(flight).toEqual(before);
  flight.objects = flight.objects.filter(({ id }) => id !== blocker.id);
  const result = activateRequiredRoute(CONTENT, "growers", flight);
  expect(result.status).toBe("created");
  if (result.status !== "created") {
    throw new Error(result.status);
  }
  expect(result.guard).toBe(plan.leader);
  expect(readRequiredPlan(flight, "growers")).toBeNull();
});
