import { expect, it } from "vitest";

import { CONTENT } from "../data/content.ts";
import { ENEMY_AVOIDANCE } from "../data/enemyNavigation.ts";
import { ROUTE_POSITION } from "../data/galaxies.ts";
import { partsReach, worldParts } from "./convex.ts";
import { enemyPhysicalBody } from "./enemyBody.ts";
import {
  createFlight,
  ensureRouteEncounter,
  questFrigateHome,
  questGuardPlacementContext,
  spawnChapterEnemy,
  spawnQuestFrigateAt,
} from "./flight.ts";
import { flightWorldContext } from "./flightTopology.ts";
import { worldActivateFlightRegion, worldSyncFlightRegion } from "./geography.ts";
import { legacyGuardHomeUpdates } from "./legacyGuardHomes.ts";
import { questGuardAnchor, questGuardHomePorts } from "./questGuardPlacement.ts";
import type { SpaceObject } from "./types.ts";
import { worldDistance } from "./worldContacts.ts";

function fixture() {
  const flight = createFlight(CONTENT, 1, 173, { known: [] });
  flight.objects = [];
  flight.world = { notables: {}, version: 1 };
  flight.player = { x: 10000, y: 14000 };
  const site: SpaceObject = {
    hp: 1,
    id: "quest-site",
    kind: "station",
    radius: 30,
    x: 10000,
    y: 10000,
  };
  flight.objects.push(site);
  const guard = spawnChapterEnemy(
    CONTENT,
    "frigate",
    "quest-guard",
    { x: 18000, y: 10000 },
    flight,
    { routeId: site.id },
  )!;
  const context = questGuardPlacementContext(CONTENT, flight);
  return { context, flight, guard, ports: questGuardHomePorts(context), site };
}

it("selects a site-local full-formation home independently of Ada and without mutating actors", () => {
  const { context, flight, guard, ports, site } = fixture();
  const before = structuredClone(flight);
  const world = flightWorldContext(flight);
  expect(ports.validHome(world, site, guard, guard.enemy!.home)).toBe(false);
  const home = ports.recoveryHome(world, site, guard)!;
  expect(home).not.toBeNull();
  expect(ports.validHome(world, site, guard, home)).toBe(true);
  expect(flight).toEqual(before);
  flight.player = { x: site.x - 9000, y: site.y - 7000 };
  expect(ports.recoveryHome(world, site, guard)).toEqual(home);
  const anchor = questGuardAnchor(context, guard)!;
  expect(anchor.center).toEqual({ x: site.x, y: site.y });
  expect(anchor.clearanceRadius).toBeGreaterThan(CONTENT.tuning.flight.shipRadius * 5);
  expect(Math.hypot(home.x - site.x, home.y - site.y)).toBeLessThan(
    anchor.clearanceRadius + ENEMY_AVOIDANCE.clearance * 2,
  );
});

it("honors loaded site authority, retained sites and removal without resurrecting followers", () => {
  const { flight, guard, ports, site } = fixture();
  flight.world.notables[site.id] = { ...site, x: -10000 };
  expect(ports.resolveSite(flight, site.id)).toBe(site);
  const follower = flight.objects.find((actor) => actor.enemy?.escortOf === guard.id)!;
  flight.objects = flight.objects.filter((actor) => actor !== site && actor !== follower);
  flight.world.notables[site.id] = site;
  flight.world.notables[follower.id] = null;
  const before = structuredClone(flight);
  expect(legacyGuardHomeUpdates(ports, flight)).toHaveLength(1);
  expect(flight).toEqual(before);
  flight.world.notables[site.id] = null;
  expect(legacyGuardHomeUpdates(ports, flight)).toEqual([]);
  delete flight.world.notables[site.id];
  expect(legacyGuardHomeUpdates(ports, flight)).toEqual([]);
});

it("rejects occupied and protected home geometry without changing combat state", () => {
  const { flight, guard, ports, site } = fixture();
  const world = flightWorldContext(flight);
  const home = ports.recoveryHome(world, site, guard)!;
  flight.objects.push({ hp: 1, id: "blocking-site", kind: "destination", radius: 30, ...home });
  expect(ports.validHome(world, site, guard, home)).toBe(false);
  expect(ports.validHome(world, site, guard, site)).toBe(false);
  guard.enemy!.hardpoints[0]!.cooldown = 0.7;
  const before = structuredClone(flight);
  ports.recoveryHome(world, site, guard);
  expect(flight).toEqual(before);
});

it("creates an explicit local three-hull formation once, or rejects it atomically at the population cap", () => {
  const { flight, guard, ports, site } = fixture();
  const point = ports.recoveryHome(flightWorldContext(flight), site, guard)!;
  flight.objects = [site];
  const created = spawnQuestFrigateAt(CONTENT, flight, "new-guard", site.id, point)!;
  expect(created).not.toBeNull();
  expect(flight.objects.filter((actor) => actor.kind === "enemy")).toHaveLength(3);
  const before = structuredClone(flight);
  expect(spawnQuestFrigateAt(CONTENT, flight, "new-guard", site.id, site)).toBe(created);
  expect(flight).toEqual(before);
  const opposite = { x: 2 * site.x - point.x, y: 2 * site.y - point.y };
  expect(spawnQuestFrigateAt(CONTENT, flight, "second-guard", site.id, opposite)).toBeNull();
  expect(flight).toEqual(before);
  flight.objects = [site];
  flight.world.notables["new-guard"] = null;
  const removed = structuredClone(flight);
  expect(spawnQuestFrigateAt(CONTENT, flight, "new-guard", site.id, point)).toBeNull();
  expect(flight).toEqual(removed);
});

it("diagnoses that a home-only legacy repair cannot reactivate a guard paged by its remote position", () => {
  const { flight, guard, ports, site } = fixture();
  const home = ports.recoveryHome(flightWorldContext(flight), site, guard)!;
  const position = { x: guard.x, y: guard.y };
  guard.enemy!.home = home;
  flight.player = { x: site.x, y: site.y };
  worldSyncFlightRegion(flightWorldContext(flight), CONTENT, flight);
  expect(flight.world.notables[guard.id]).toBe(guard);
  worldActivateFlightRegion(flightWorldContext(flight), CONTENT, site, flight);
  expect(flight.objects.some((actor) => actor.id === guard.id)).toBe(false);
  expect({ x: guard.x, y: guard.y }).toEqual(position);
  expect(guard.enemy!.home).toEqual(home);
});

it("creates a new quest route frigate at the canonical local home without projecting toward Ada", () => {
  const { flight, site } = fixture();
  site.kind = "destination";
  flight.objects = [site];
  const before = structuredClone(flight);
  const home = questFrigateHome(CONTENT, flight, `route:${site.id}`, site.id)!;
  expect(flight).toEqual(before);
  const guard = ensureRouteEncounter(CONTENT, site.id, flight)!;
  expect(guard).not.toBeNull();
  expect({ x: guard.x, y: guard.y }).toEqual(home);
  expect(guard.enemy!.home).toEqual(home);
  expect(guard.routeId).toBe(site.id);
  const followers = flight.objects.filter((actor) => actor.enemy?.escortOf === guard.id);
  expect(followers).toHaveLength(2);
  const world = flightWorldContext(flight);
  const reach = Math.max(
    ...[guard, ...followers].map(
      (actor) =>
        worldDistance(world, guard, actor) +
        partsReach(worldParts(enemyPhysicalBody(ROUTE_POSITION[flight.galaxy], actor.enemy!)!)),
    ),
  );
  const minimum = CONTENT.tuning.safeRadius + reach;
  expect(worldDistance(world, site, guard)).toBeGreaterThanOrEqual(minimum);
  expect(worldDistance(world, site, guard)).toBeLessThanOrEqual(
    minimum + ENEMY_AVOIDANCE.clearance,
  );
  expect(guard.x).toBe(site.x);
  expect(guard.y).toBeLessThan(site.y);
  const remote = structuredClone(before);
  remote.player = { x: -30000, y: -10000 };
  const independentlyPlaced = ensureRouteEncounter(CONTENT, site.id, remote)!;
  expect(independentlyPlaced).not.toBeNull();
  expect({ x: independentlyPlaced.x, y: independentlyPlaced.y }).toEqual(home);
  expect(flight.combat!.routeEncounters).toContain(site.id);
  const once = structuredClone(flight);
  flight.player = { x: 30000, y: -10000 };
  expect(ensureRouteEncounter(CONTENT, site.id, flight)).toBe(guard);
  expect(guard).toEqual(once.objects.find((actor) => actor.id === guard.id));
});
