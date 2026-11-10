import { describe, expect, it } from "vitest";

import { enemyCatalog } from "../data/enemy-catalog.ts";
import { PROTOTYPE } from "../data/prototype.ts";
import { createEnemy } from "./enemy-ai.ts";
import {
  activateRouteEncounter,
  createFlight,
  ensureDestination,
  ensureRouteEncounter,
  routeBlocked,
  stepFlight,
  syncFlightRegion,
  teleport,
} from "./flight.ts";
import { ACTIVE_CHUNK_RADIUS, archivedObjectIds } from "./geography.ts";
import type { FlightState, SectorProgress, SpaceObject } from "./types.ts";

const progress: SectorProgress = {
  deposited: 0, disabledEnemies: 0, discoveries: 0, introduced: false, known: [],
  questComplete: false, questItem: null, resolved: false, stage: 0,
};
const idle = { aim: { x: 0, y: 0 }, move: { x: 0, y: 0 }, use: false };
function empty(): FlightState {
  const flight = createFlight(PROTOTYPE, 1, 173, progress);
  flight.objects = [];
  return flight;
}
function objects(flight: FlightState): SpaceObject[] {
  return [...flight.objects, ...Object.values(flight.dormant?.pages ?? {}).flatMap((page) => JSON.parse(page) as SpaceObject[])];
}
function enemy(id: string, x: number, packId: string | null = null): SpaceObject {
  const point = { x, y: 100 };
  return {
    ...point,
    enemy: createEnemy(enemyCatalog.swarm, { archetype: "swarm", id, packId, phase: 0.2 }, point),
    hp: 2, id, kind: "enemy", radius: 10,
  };
}

describe("geographically bounded simulation", () => {
  it("bounds active objects over long exploration while retaining visited chunks and exact immutable pages", () => {
    const flight = empty();
    flight.objects.push({ hp: 9, id: "initial", kind: "rock", radius: 10, x: 100, y: 100 });
    for (let index = 1; index <= 40; index++) {
      flight.player = { x: index * 4096, y: 0 };
      stepFlight(PROTOTYPE, 0.001, idle, flight);
      const centerX = Math.floor(flight.player.x / PROTOTYPE.tuning.chunkSize);
      expect(flight.objects.every((object) => object.kind === "destination" || (
        Math.abs(Math.floor(object.x / PROTOTYPE.tuning.chunkSize) - centerX) <= ACTIVE_CHUNK_RADIUS &&
        Math.abs(Math.floor(object.y / PROTOTYPE.tuning.chunkSize)) <= ACTIVE_CHUNK_RADIUS
      ))).toBe(true);
      expect(flight.objects.length).toBeLessThan(250);
    }
    expect(flight.chunks.length).toBeGreaterThan(500);
    expect(Object.keys(flight.dormant!.pages).length).toBeGreaterThan(100);
    const initial = flight.dormant!.pages["0,0"]!;
    expect(initial).toContain('"initial"');
    stepFlight(PROTOTYPE, 0.1, idle, flight);
    expect(flight.dormant!.pages["0,0"]).toBe(initial);
    expect(new Set(objects(flight).map((object) => object.id)).size).toBe(objects(flight).length);
  });

  it("does not regenerate mined rocks or collected upgrades after a dormant round trip", () => {
    const flight = empty();
    flight.objects.push(
      { hp: 1, id: "mined", kind: "resource", radius: 10, x: 60, y: 0 },
      { hp: 1, id: "upgrade", kind: "pickup", radius: 10, weapon: "rapid", x: 0, y: 0 },
    );
    stepFlight(PROTOTYPE, 0.15, { ...idle, aim: { x: 1, y: 0 } }, flight);
    expect(flight.objects.some((object) => object.id === "mined" || object.id === "upgrade")).toBe(false);
    const remaining = structuredClone(flight.objects);
    const ammo = flight.ammo;
    flight.player = { x: 12000, y: 0 };
    syncFlightRegion(PROTOTYPE, flight);
    flight.player = { x: 0, y: 0 };
    syncFlightRegion(PROTOTYPE, flight);
    expect(flight.objects).toEqual(remaining);
    stepFlight(PROTOTYPE, 0.01, idle, flight);
    expect(objects(flight).some((object) => object.id === "mined" || object.id === "upgrade")).toBe(false);
    expect(flight.ammo).toBe(ammo);
    expect(flight.objects.filter((object) => object.role === "cargo")).toHaveLength(PROTOTYPE.tuning.flight.piecesPerRock);
  });

  it("preserves damaged enemy hardpoints, cooldowns and pursuit state without inactive clock catch-up", () => {
    const flight = empty();
    const point = { x: 100, y: 100 };
    const state = createEnemy(enemyCatalog.frigate, { archetype: "frigate", id: "damaged", packId: null, phase: 0.4 }, point);
    state.hardpoints[0]!.hp = 1;
    state.hardpoints[1]!.cooldown = 0.75;
    state.age = 3;
    state.fleeing = true;
    state.engaged = true;
    state.lastSeen = { x: 50, y: 75 };
    state.lastSeenAge = 0.4;
    state.pursuitSeconds = 1.2;
    state.velocity = { x: 3, y: 7 };
    const target: SpaceObject = { ...point, enemy: state, hp: 8, id: "damaged", kind: "enemy", radius: 30 };
    flight.objects.push(target);
    const before = structuredClone(target);
    flight.player = { x: 12000, y: 0 };
    syncFlightRegion(PROTOTYPE, flight);
    const page = flight.dormant!.pages["0,0"]!;
    stepFlight(PROTOTYPE, 0.4, idle, flight);
    expect(flight.dormant!.pages["0,0"]).toBe(page);
    flight.player = { x: 0, y: 0 };
    syncFlightRegion(PROTOTYPE, flight);
    expect(flight.objects.find((object) => object.id === target.id)).toEqual(before);
  });

  it("retains dormant pack members without false retreat, then counts a genuine casualty", () => {
    const flight = empty();
    const near = enemy("near", 300, "pack");
    const far = enemy("far", 5000, "pack");
    flight.objects.push(near, far);
    flight.combat = { initialPackSizes: { pack: 2 }, routeEncounters: [] };
    syncFlightRegion(PROTOTYPE, flight);
    expect(flight.dormant!.packMembers.pack).toBe(1);
    stepFlight(PROTOTYPE, 0.001, idle, flight);
    expect(near.enemy!.fleeing).toBe(false);
    flight.shots.push({ enemy: false, hitIds: [], id: "kill", life: 1, piercing: false, velocity: { x: 0, y: 0 }, x: near.x, y: near.y });
    near.enemy!.hp = 1;
    near.hp = 1;
    expect(stepFlight(PROTOTYPE, 0.001, idle, flight)).toContainEqual({ type: "enemyDisabled" });
    flight.player = { x: far.x - 300, y: 100 };
    stepFlight(PROTOTYPE, 0.001, idle, flight);
    expect(flight.objects.find((object) => object.id === "far")!.enemy!.fleeing).toBe(true);
    expect(flight.combat.initialPackSizes.pack).toBe(2);
  });

  it("owns a crossing debris object in one coordinate page while global projectiles expire normally", () => {
    const flight = empty();
    const boundary = (ACTIVE_CHUNK_RADIUS + 1) * PROTOTYPE.tuning.chunkSize;
    flight.objects.push({ hp: 4, id: "crossing", kind: "debris", radius: 10, velocity: { x: 180, y: 0 }, x: boundary - 1, y: 0 });
    flight.shots.push({ enemy: true, hitIds: [], id: "finite", life: 0.05, piercing: false, velocity: { x: 100, y: 0 }, x: 9000, y: 0 });
    stepFlight(PROTOTYPE, 0.01, idle, flight);
    expect(flight.objects.some((object) => object.id === "crossing")).toBe(false);
    const page = flight.dormant!.pages["4,0"]!;
    const saved = (JSON.parse(page) as SpaceObject[]).find((object) => object.id === "crossing")!;
    expect(saved.x).toBeCloseTo(boundary + 0.8);
    stepFlight(PROTOTYPE, 0.1, idle, flight);
    expect(flight.shots).toHaveLength(0);
    expect(flight.dormant!.pages["4,0"]).toBe(page);
    flight.player.x = PROTOTYPE.tuning.chunkSize;
    syncFlightRegion(PROTOTYPE, flight);
    expect(flight.objects.find((object) => object.id === "crossing")).toEqual(saved);
    expect(objects(flight).filter((object) => object.id === "crossing")).toHaveLength(1);
    expect(Object.values(flight.dormant!.pages).some((encoded) => encoded.includes('"finite"'))).toBe(false);
  });

  it("keeps dormant required guards blocking, wakes them explicitly, and preserves known teleport arrivals", () => {
    const flight = empty();
    const destination = ensureDestination(PROTOTYPE, "growers", flight);
    const guard = ensureRouteEncounter(PROTOTYPE, destination.id, flight)!;
    guard.enemy!.hardpoints[0]!.hp = 1;
    guard.enemy!.hardpoints[1]!.cooldown = 0.4;
    const expected = structuredClone(guard);
    flight.player = { x: 12000, y: 0 };
    syncFlightRegion(PROTOTYPE, flight);
    expect(flight.objects).toContain(destination);
    expect(flight.objects.some((object) => object.id === guard.id)).toBe(false);
    expect(routeBlocked(destination.id, flight)).toBe(true);
    const pages = { ...flight.dormant!.pages };
    expect(ensureRouteEncounter(PROTOTYPE, destination.id, flight)).toBeNull();
    expect(flight.dormant!.pages).toEqual(pages);
    activateRouteEncounter(PROTOTYPE, destination.id, flight);
    expect(flight.objects.find((object) => object.id === guard.id)).toEqual(expected);
    expect(routeBlocked(destination.id, flight)).toBe(true);
    syncFlightRegion(PROTOTYPE, flight);
    flight.dangerFor = 0;
    expect(teleport(PROTOTYPE, destination.id, flight)).toBe(true);
    expect(routeBlocked(destination.id, flight)).toBe(true);
    expect(flight.objects.filter((object) => object.id === guard.id)).toHaveLength(1);
    const shield = flight.shield;
    stepFlight(PROTOTYPE, 0.01, idle, flight);
    expect(flight.shield).toBeGreaterThanOrEqual(shield);
    expect(flight.dangerFor).toBe(0);
  });

  it("preserves the same active and dormant future through interrupted-flight JSON snapshots", () => {
    const flight = empty();
    flight.objects.push(enemy("dormant", 9000));
    syncFlightRegion(PROTOTYPE, flight);
    flight.ammo = 7;
    flight.cargo = 3;
    flight.weapon = "rapid";
    const resumed = JSON.parse(JSON.stringify(flight)) as FlightState;
    const input = { ...idle, aim: { x: 1, y: 0 }, move: { x: 0, y: 1 } };
    expect(stepFlight(PROTOTYPE, 0.2, input, resumed)).toEqual(stepFlight(PROTOTYPE, 0.2, input, flight));
    expect(resumed).toEqual(flight);
  });
});


it("reports only the current archive delta and resets once on the next simulation step", () => {
  const flight = empty();
  flight.objects.push(enemy("archive-first", 9000));
  syncFlightRegion(PROTOTYPE, flight);
  expect(archivedObjectIds(flight).has("archive-first")).toBe(true);
  flight.objects.push(enemy("archive-second", 12000));
  syncFlightRegion(PROTOTYPE, flight);
  expect([...archivedObjectIds(flight)].sort()).toEqual(["archive-first", "archive-second"]);
  stepFlight(PROTOTYPE, 0.001, idle, flight);
  expect(archivedObjectIds(flight).size).toBe(0);
});

it("retains a route blocker index when one of several dormant guards sharing a route wakes", () => {
  const flight = empty();
  const first = enemy("first-guard", 9000);
  const second = enemy("second-guard", 15000);
  first.routeId = second.routeId = "growers";
  flight.objects.push(first, second);
  syncFlightRegion(PROTOTYPE, flight);
  expect(flight.dormant!.routes).toEqual(["growers"]);
  const resumed = JSON.parse(JSON.stringify(flight)) as FlightState;
  activateRouteEncounter(PROTOTYPE, "growers", resumed);
  expect(resumed.objects.filter((object) => object.routeId === "growers")).toHaveLength(1);
  expect(resumed.dormant!.routes).toEqual(["growers"]);
  expect(routeBlocked("growers", resumed)).toBe(true);
  resumed.objects = resumed.objects.filter((object) => object.routeId !== "growers");
  expect(routeBlocked("growers", resumed)).toBe(true);
  activateRouteEncounter(PROTOTYPE, "growers", resumed);
  expect(resumed.objects.filter((object) => object.routeId === "growers")).toHaveLength(1);
  expect(resumed.dormant!.routes).toEqual([]);
});
