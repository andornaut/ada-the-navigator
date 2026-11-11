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
import {
  activateFlightRegion,
  ACTIVE_CHUNK_RADIUS,
  archivedObjectIds,
  persistentObject,
} from "./geography.ts";
import type { FlightState, SectorProgress, SpaceObject } from "./types.ts";

const progress: SectorProgress = {
  charted: [],
  deposited: 0,
  disabledEnemies: 0,
  discoveries: 0,
  donated: {},
  explored: [],
  holodisk: false,
  introduced: false,
  known: [],
  opened: false,
  questComplete: false,
  questItem: null,
  resolved: false,
  revealed: [],
  stage: 0,
  stations: [],
};
const idle = { aim: { x: 0, y: 0 }, move: { x: 0, y: 0 }, use: false };
function empty(): FlightState {
  const flight = createFlight(PROTOTYPE, 1, 173, progress);
  flight.objects = [];
  return flight;
}
function enemy(
  id: string,
  x: number,
  archetype: "swarm" | "frigate" | "capital" = "swarm",
  packId: string | null = null,
): SpaceObject {
  const point = { x, y: 100 };
  const definition = enemyCatalog[archetype];
  return {
    ...point,
    enemy: createEnemy(definition, { archetype, id, packId, phase: 0.2 }, point),
    hp: definition.hp,
    id,
    kind: "enemy",
    radius: definition.sizeRatio * PROTOTYPE.tuning.flight.shipRadius,
  };
}
function retained(flight: FlightState): SpaceObject[] {
  return [
    ...flight.objects,
    ...Object.values(flight.world.notables).filter(
      (object): object is SpaceObject => object !== null,
    ),
  ];
}

describe("regenerating ordinary chunks and persistent notables", () => {
  it("bounds ordinary objects, active chunk keys and pack metadata over long travel", () => {
    const flight = empty();
    const sizes: number[] = [];
    for (let index = 1; index <= 150; index++) {
      flight.player = { x: index * 4096, y: 0 };
      stepFlight(PROTOTYPE, 0.001, idle, flight);
      expect(flight.chunks.length).toBeLessThanOrEqual((ACTIVE_CHUNK_RADIUS * 2 + 1) ** 2);
      expect(flight.objects.length).toBeLessThan(250);
      expect(Object.keys(flight.combat?.initialPackSizes ?? {}).length).toBeLessThan(12);
      expect(flight.world.notables).toEqual({});
      sizes.push(JSON.stringify(flight).length);
    }
    expect(Math.max(...sizes)).toBeLessThan(100000);
    expect(Math.max(...sizes.slice(100))).toBeLessThan(Math.max(...sizes.slice(0, 50)) + 20000);
    expect(Object.hasOwn(flight, "dormant")).toBe(false);
    expect(Object.hasOwn(flight, "exploredChunks")).toBe(false);
  });

  it("recreates ordinary template scenery and pickups after leaving retention range", () => {
    const flight = createFlight(PROTOTYPE, 1, 173, progress);
    const original = flight.objects.filter(
      (object) => object.id.startsWith("chunk:0,0:") && !persistentObject(object),
    );
    expect(original.length).toBeGreaterThan(0);
    const ids = new Set(original.map((object) => object.id));
    const expected = structuredClone(original);
    flight.objects = flight.objects.filter((object) => !ids.has(object.id));
    const interrupted = JSON.parse(JSON.stringify(flight)) as FlightState;
    stepFlight(PROTOTYPE, 0.001, idle, interrupted);
    expect(interrupted.objects.some((object) => ids.has(object.id))).toBe(false);
    flight.player = { x: 12000, y: 0 };
    stepFlight(PROTOTYPE, 0.001, idle, flight);
    expect(flight.chunks).not.toContain("0,0");
    expect(flight.world.notables).toEqual({});
    flight.player = { x: 0, y: 0 };
    stepFlight(PROTOTYPE, 0.001, idle, flight);
    expect(flight.objects.filter((object) => ids.has(object.id))).toEqual(expected);
  });

  it("preserves important HP, parts, cooldowns and AI while discarding far trash without casualties", () => {
    const flight = empty();
    const notable = enemy("frigate", 100, "frigate");
    notable.enemy!.hardpoints[0]!.hp = 1;
    notable.enemy!.hardpoints[1]!.cooldown = 0.75;
    notable.enemy!.fleeing = true;
    notable.enemy!.lastSeen = { x: 50, y: 75 };
    notable.enemy!.pursuitSeconds = 1.2;
    const trash = enemy("trash", 100, "swarm");
    flight.objects.push(notable, trash);
    const expected = structuredClone(notable);
    flight.player = { x: 12000, y: 0 };
    syncFlightRegion(PROTOTYPE, flight);
    expect(flight.world.notables[notable.id]).toEqual(expected);
    expect(flight.world.notables).not.toHaveProperty(trash.id);
    expect(archivedObjectIds(flight).has(trash.id)).toBe(true);
    stepFlight(PROTOTYPE, 0.1, idle, flight);
    expect(flight.world.notables[notable.id]).toEqual(expected);
    flight.player = { x: 0, y: 0 };
    syncFlightRegion(PROTOTYPE, flight);
    expect(flight.objects.find((object) => object.id === notable.id)).toEqual(expected);
    expect(flight.world.notables).not.toHaveProperty(notable.id);
    expect(flight.objects.some((object) => object.id === trash.id)).toBe(false);
  });

  it("records defeated notable tombstones before filtering and never respawns their guards", () => {
    const flight = empty();
    const destination = ensureDestination(PROTOTYPE, "growers", flight);
    const guard = ensureRouteEncounter(PROTOTYPE, destination.id, flight)!;
    for (const part of guard.enemy!.hardpoints) {
      part.hp = 0;
    }
    expect(stepFlight(PROTOTYPE, 0.001, idle, flight)).toContainEqual({ type: "enemyDisabled" });
    expect(flight.world.notables[guard.id]).toBeNull();
    expect(routeBlocked(destination.id, flight)).toBe(false);
    flight.player = { x: 12000, y: 0 };
    stepFlight(PROTOTYPE, 0.001, idle, flight);
    flight.player = { x: destination.x, y: destination.y };
    stepFlight(PROTOTYPE, 0.001, idle, flight);
    expect(ensureRouteEncounter(PROTOTYPE, destination.id, flight)).toBeNull();
    expect(retained(flight).some((object) => object.id === guard.id)).toBe(false);
    expect(flight.world.notables[guard.id]).toBeNull();
  });

  it("does not treat partially discarded trash packs as combat losses", () => {
    const flight = empty();
    const near = enemy("near", 300, "swarm", "pack");
    const far = enemy("far", 5000, "swarm", "pack");
    flight.objects.push(near, far);
    flight.combat = { initialPackSizes: { pack: 2 }, routeEncounters: [] };
    expect(stepFlight(PROTOTYPE, 0.001, idle, flight)).not.toContainEqual({
      type: "enemyDisabled",
    });
    expect(near.enemy!.fleeing).toBe(false);
    expect(flight.combat.initialPackSizes.pack).toBe(2);
    expect(flight.combat.unloadedPackMembers?.pack).toBe(1);
    expect(flight.world.notables).not.toHaveProperty(far.id);
    flight.player = { x: 12000, y: 0 };
    syncFlightRegion(PROTOTYPE, flight);
    expect(flight.combat.initialPackSizes).not.toHaveProperty("pack");
  });

  it("keeps projectiles single-owned and finite while ordinary moving debris is discarded", () => {
    const flight = empty();
    const boundary = (ACTIVE_CHUNK_RADIUS + 1) * PROTOTYPE.tuning.chunkSize;
    flight.objects.push({
      hp: 4,
      id: "debris",
      kind: "debris",
      radius: 10,
      velocity: { x: 180, y: 0 },
      x: boundary - 1,
      y: 0,
    });
    flight.shots.push({
      enemy: true,
      hitIds: [],
      id: "finite",
      life: 0.05,
      piercing: false,
      velocity: { x: 100, y: 0 },
      x: 9000,
      y: 0,
    });
    stepFlight(PROTOTYPE, 0.01, idle, flight);
    expect(retained(flight).some((object) => object.id === "debris")).toBe(false);
    expect(flight.shots).toHaveLength(1);
    stepFlight(PROTOTYPE, 0.1, idle, flight);
    expect(flight.shots).toHaveLength(0);
    expect(flight.world.notables).toEqual({});
  });

  it("retains quest objects and explicit persistence markers beyond the ordinary window", () => {
    const flight = empty();
    const destination = ensureDestination(PROTOTYPE, "growers", flight);
    const guard = ensureRouteEncounter(PROTOTYPE, destination.id, flight)!;
    guard.enemy!.hardpoints[0]!.hp = 1;
    const npc: SpaceObject = {
      hp: 1,
      id: "interacted",
      kind: "resource",
      persistent: true,
      radius: 10,
      x: 100,
      y: 100,
    };
    const whale: SpaceObject = {
      hp: 2,
      id: "whale-debris:0",
      kind: "debris",
      radius: 10,
      x: 200,
      y: 200,
    };
    flight.objects.push(npc, whale);
    const expected = structuredClone(guard);
    flight.player = { x: 12000, y: 0 };
    syncFlightRegion(PROTOTYPE, flight);
    expect(flight.objects).toContain(destination);
    expect(flight.objects).toContain(whale);
    expect(flight.world.notables[npc.id]).toEqual(npc);
    expect(routeBlocked(destination.id, flight)).toBe(true);
    expect(ensureRouteEncounter(PROTOTYPE, destination.id, flight)).toBeNull();
    activateRouteEncounter(PROTOTYPE, destination.id, flight);
    expect(flight.objects.find((object) => object.id === guard.id)).toEqual(expected);
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

  it("preserves exact active and notable state through interrupted saves, without a second canonical copy", () => {
    const flight = empty();
    flight.objects.push(enemy("notable", 9000, "capital"), enemy("active", 400));
    syncFlightRegion(PROTOTYPE, flight);
    flight.cargo = 300;
    flight.ownedWeapons = ["rapidMissile"];
    flight.weapon = "rapidMissile";
    const resumed = JSON.parse(JSON.stringify(flight)) as FlightState;
    const input = { ...idle, aim: { x: 1, y: 0 }, move: { x: 0, y: 1 } };
    expect(stepFlight(PROTOTYPE, 0.2, input, resumed)).toEqual(
      stepFlight(PROTOTYPE, 0.2, input, flight),
    );
    expect(resumed).toEqual(flight);
    for (const id of Object.keys(flight.world.notables)) {
      expect(flight.objects.some((object) => object.id === id)).toBe(false);
    }
  });
});

it("wakes every same-route notable before translation without duplicating ownership", () => {
  const flight = empty();
  const guards = [9000, 9300, 15000].map((x, index) => {
    const object = enemy(`guard-${index}`, x, "frigate");
    object.routeId = "growers";
    object.enemy!.hardpoints[0]!.hp = index + 1;
    object.enemy!.hardpoints[1]!.cooldown = index + 0.25;
    return object;
  });
  flight.objects.push(...guards);
  syncFlightRegion(PROTOTYPE, flight);
  const resumed = JSON.parse(JSON.stringify(flight)) as FlightState;
  activateFlightRegion(PROTOTYPE, guards[0]!, resumed);
  expect(resumed.objects.filter((object) => object.routeId === "growers")).toHaveLength(2);
  resumed.objects = resumed.objects.filter((object) => object.routeId !== "growers");
  expect(routeBlocked("growers", resumed)).toBe(true);
  // Restore the complete snapshot for explicit all-guard relocation.
  const relocating = JSON.parse(JSON.stringify(flight)) as FlightState;
  activateRouteEncounter(PROTOTYPE, "growers", relocating);
  expect(relocating.objects.filter((object) => object.routeId === "growers")).toHaveLength(3);
  expect(relocating.world.notables).toEqual({});
  for (const expected of guards) {
    expect(relocating.objects.find((object) => object.id === expected.id)).toEqual(expected);
  }
});

it("keeps mutable returned guards canonical until outer compaction and preserves their latest edits", () => {
  const flight = empty();
  flight.sector = 3;
  flight.objects.push({
    hp: 1,
    id: "growers",
    kind: "destination",
    radius: 30,
    x: 10000,
    y: 10000,
  });
  const guard = ensureRouteEncounter(PROTOTYPE, "growers", flight)!;
  expect(flight.objects).toContain(guard);
  guard.enemy!.hardpoints[0]!.hp = 2;
  guard.enemy!.hardpoints[1]!.cooldown = 0.7;
  guard.x += 400;
  guard.enemy!.home.x += 400;
  guard.enemy!.position.x += 400;
  const expected = structuredClone(guard);
  expect(ensureRouteEncounter(PROTOTYPE, "growers", flight)).toBe(guard);
  syncFlightRegion(PROTOTYPE, flight);
  expect(flight.world.notables[guard.id]).toEqual(expected);
  activateRouteEncounter(PROTOTYPE, "growers", flight);
  expect(flight.objects.find((object) => object.id === guard.id)).toEqual(expected);
});

it("retains every encountered notable instead of claiming constant total save size", () => {
  const flight = empty();
  const before = JSON.stringify(flight).length;
  const encounters = Array.from({ length: 8 }, (_, index) =>
    enemy(`notable-${index}`, (index + 20) * 4096, "capital"),
  );
  flight.objects.push(...encounters);
  syncFlightRegion(PROTOTYPE, flight);
  expect(Object.keys(flight.world.notables)).toHaveLength(8);
  for (const object of encounters) {
    expect(flight.world.notables[object.id]).toEqual(object);
  }
  expect(JSON.stringify(flight).length).toBeGreaterThan(before);
  activateFlightRegion(PROTOTYPE, encounters[0]!, flight);
  expect(flight.objects.filter((object) => object.id.startsWith("notable-"))).toHaveLength(1);
  expect(Object.keys(flight.world.notables)).toHaveLength(7);
});
