import { describe, expect, it } from "vitest";

import { type EnemyArchetype, enemyCatalog } from "../data/enemy-catalog.ts";
import { PROTOTYPE } from "../data/prototype.ts";
import { createEnemy } from "./enemy-ai.ts";
import {
  createFlight,
  ensureDestination,
  ensureRouteEncounter,
  routeBlocked,
  stepFlight,
  teleport,
} from "./flight.ts";
import type { FlightInput, FlightState, SectorProgress, SpaceObject, Vec } from "./types.ts";

const idle: FlightInput = { aim: { x: 0, y: 0 }, move: { x: 0, y: 0 }, use: false };
const progress: SectorProgress = {
  deposited: 0,
  disabledEnemies: 0,
  discoveries: 0,
  introduced: false,
  known: [],
  questComplete: false,
  questItem: null,
  resolved: false,
  stage: 0,
};
function empty(): FlightState {
  const flight = createFlight(PROTOTYPE, 1, 173, progress);
  flight.objects = [];
  return flight;
}
function ship(archetype: EnemyArchetype, point: Vec): SpaceObject {
  const definition = enemyCatalog[archetype];
  return {
    ...point,
    enemy: createEnemy(definition, { archetype, id: "target", packId: null, phase: 0 }, point),
    hp: definition.hp,
    id: "target",
    kind: "enemy",
    radius: definition.sizeRatio * PROTOTYPE.tuning.flight.shipRadius,
  };
}
function hit(flight: FlightState, point: Vec, count = 1): void {
  for (let i = 0; i < count; i++) {
    flight.shots.push({
      ...point,
      enemy: false,
      hitIds: [],
      id: `test:${flight.nextId++}`,
      life: 1,
      piercing: false,
      projectile: "bolt",
      velocity: { x: 0, y: 0 },
    });
  }
}
function partPosition(object: SpaceObject, id: string): Vec {
  const definition = enemyCatalog[object.enemy!.archetype];
  const part = definition.hardpoints.find((part) => part.id === id)!;
  const width = definition.sizeRatio * PROTOTYPE.tuning.flight.shipRadius * 2;
  return { x: object.x + part.offset.x * width, y: object.y + part.offset.y * width };
}

describe("integrated combat", () => {
  it("fires bolts and straight missiles from independent capital hardpoints and preserves saved futures", () => {
    const flight = empty();
    const target = ship("capital", { x: 400, y: 0 });
    flight.objects.push(target);
    stepFlight(PROTOTYPE, 0.01, idle, flight);
    expect(flight.shots.map((shot) => shot.projectile).sort()).toEqual(["bolt", "missile"]);
    const missile = flight.shots.find((shot) => shot.projectile === "missile")!;
    const velocity = { ...missile.velocity };
    const position = { x: missile.x, y: missile.y };
    flight.player.y = 200;
    const resumed = JSON.parse(JSON.stringify(flight)) as FlightState;
    stepFlight(PROTOTYPE, 0.1, idle, flight);
    stepFlight(PROTOTYPE, 0.1, idle, resumed);
    expect(resumed).toEqual(flight);
    expect(missile.velocity).toEqual(velocity);
    expect(missile.x).toBeCloseTo(position.x + velocity.x * 0.1);
    expect(missile.y).toBeCloseTo(position.y + velocity.y * 0.1);
  });

  it("disables individual weapons and engines, and requires every designated part before defeat", () => {
    const flight = empty();
    const target = ship("capital", { x: 400, y: 0 });
    flight.objects.push(target);
    target.enemy!.velocity = { x: 20, y: 10 };
    hit(flight, partPosition(target, "engine-left"), 4);
    hit(flight, partPosition(target, "weapon-left"), 3);
    stepFlight(PROTOTYPE, 0.001, idle, flight);
    flight.shots = [];
    const before = { x: target.x, y: target.y };
    for (const part of target.enemy!.hardpoints) {
      part.cooldown = 0;
    }
    stepFlight(PROTOTYPE, 0.01, idle, flight);
    expect({ x: target.x, y: target.y }).toEqual(before);
    expect(flight.shots.map((shot) => shot.projectile)).toEqual(["missile"]);
    for (const id of ["engine-right", "weapon-right"]) {
      hit(flight, partPosition(target, id), 5);
    }
    expect(stepFlight(PROTOTYPE, 0.01, idle, flight)).not.toContainEqual({ type: "enemyDisabled" });
    expect(flight.objects).toContain(target);
    hit(flight, partPosition(target, "command"), 5);
    expect(stepFlight(PROTOTYPE, 0.01, idle, flight)).toContainEqual({ type: "enemyDisabled" });
    expect(flight.objects).not.toContain(target);
    expect(stepFlight(PROTOTYPE, 0.01, idle, flight)).not.toContainEqual({ type: "enemyDisabled" });
  });

  it("hits a recessed command part through empty hull and stops nonpiercing shots at the first live part", () => {
    const flight = empty();
    const target = ship("capital", { x: 400, y: 0 });
    target.enemy!.hardpoints.forEach((part) => (part.cooldown = 999));
    flight.objects.push(target);
    flight.shots.push({
      enemy: false,
      hitIds: [],
      id: "travel",
      life: 5,
      piercing: false,
      velocity: { x: 300, y: 0 },
      x: 250,
      y: 0,
    });
    stepFlight(PROTOTYPE, 0.7, idle, flight);
    expect(target.enemy!.hardpoints.find((part) => part.id === "command")?.hp).toBe(4);
    expect(flight.shots.some((shot) => shot.id === "travel")).toBe(false);
  });

  it("blocks hostile movement and line of fire at scenery instead of walking through it", () => {
    const flight = empty();
    const target = ship("fighter", { x: 300, y: 0 });
    target.enemy!.engaged = true;
    target.enemy!.velocity = { x: -100, y: 0 };
    flight.objects.push(target, { hp: 99, id: "wall", kind: "rock", radius: 40, x: 240, y: 0 });
    stepFlight(PROTOTYPE, 1, idle, flight);
    expect(target.x).toBeGreaterThanOrEqual(290);
    expect(flight.shots).toHaveLength(0);
    flight.shots.push({
      enemy: true,
      hitIds: [],
      id: "incoming",
      life: 5,
      piercing: false,
      velocity: { x: -500, y: 0 },
      x: 300,
      y: 0,
    });
    stepFlight(PROTOTYPE, 0.8, idle, flight);
    expect(flight.shield).toBe(PROTOTYPE.tuning.shieldMax);
    expect(flight.shots.some((shot) => shot.id === "incoming")).toBe(false);
  });

  it("keeps ballistic debris velocity constant, damages on crossing, and absorbs it at safe regions", () => {
    const flight = empty();
    const debris: SpaceObject = {
      hp: 5,
      id: "moving",
      kind: "debris",
      radius: 20,
      velocity: { x: -100, y: 0 },
      x: 60,
      y: 0,
    };
    flight.objects.push(debris);
    stepFlight(PROTOTYPE, 0.5, idle, flight);
    expect(debris.x).toBeCloseTo(10);
    expect(debris.velocity).toEqual({ x: -100, y: 0 });
    expect(flight.shield).toBeLessThan(PROTOTYPE.tuning.shieldMax);
    const destination = ensureDestination(PROTOTYPE, "friendly", flight);
    destination.x = -200;
    destination.y = 0;
    flight.dangerFor = 0;
    expect(teleport(PROTOTYPE, destination.id, flight)).toBe(true);
    const shield = flight.shield;
    stepFlight(PROTOTYPE, 1, idle, flight);
    expect(flight.objects.some((object) => object.id === "moving")).toBe(false);
    expect(flight.shield).toBeGreaterThanOrEqual(shield);
  });

  it.each([1, 2, 3] as const)(
    "guards a sector %i route outside the safezone without respawn after defeat",
    (sector) => {
      const flight = empty();
      flight.sector = sector;
      expect(routeBlocked("quest", flight)).toBe(false);
      const destination = ensureDestination(PROTOTYPE, "quest", flight);
      const guard = ensureRouteEncounter(PROTOTYPE, "quest", flight)!;
      const archetype = sector === 1 ? "frigate" : sector === 2 ? "capital" : "oversizedCapital";
      expect(guard.enemy?.archetype).toBe(archetype);
      expect(
        Math.hypot(guard.x - destination.x, guard.y - destination.y) - guard.radius,
      ).toBeGreaterThan(PROTOTYPE.tuning.safeRadius);
      expect(ensureRouteEncounter(PROTOTYPE, "quest", flight)).toBe(guard);
      flight.player = { x: destination.x, y: destination.y };
      expect(stepFlight(PROTOTYPE, 0.01, idle, flight)).not.toContainEqual({
        id: "quest",
        type: "discovered",
      });
      flight.objects = flight.objects.filter((object) => object !== guard);
      expect(routeBlocked("quest", flight)).toBe(false);
      expect(ensureRouteEncounter(PROTOTYPE, "quest", flight)).toBeNull();
      expect(stepFlight(PROTOTYPE, 0.01, idle, flight)).toContainEqual({
        id: "quest",
        type: "discovered",
      });
      expect(flight.shield).toBe(PROTOTYPE.tuning.shieldMax);
    },
  );

  it("upgrades legacy enemy state lazily without resetting saved damage or blocking unspawned routes", () => {
    const flight = empty();
    delete flight.combat;
    flight.objects.push({
      behavior: "shoot",
      hp: 2,
      id: "legacy",
      kind: "enemy",
      radius: 10,
      x: 300,
      y: 0,
    });
    stepFlight(PROTOTYPE, 0.01, idle, flight);
    expect(flight.objects[0]?.enemy?.hp).toBe(2);
    expect(flight.objects[0]?.enemy?.id).toBe("legacy");
    expect(routeBlocked("old-destination", flight)).toBe(false);
    expect(flight.shots.some((shot) => shot.enemy)).toBe(true);
  });

  it("generates deterministic small packs, separated encounter cells, terrain and ballistic regions", () => {
    const flight = empty();
    // Generate distinct distant near-fields without advancing combat or encounter time.
    for (let i = 1; i <= 12; i++) {
      flight.player = { x: i * 4096, y: 0 };
      ensureDestination(PROTOTYPE, `scan:${i}`, flight);
    }
    const packs = flight.combat?.initialPackSizes ?? {};
    expect(Object.keys(packs).length).toBeGreaterThan(2);
    expect(Object.values(packs).every((size) => size >= 1 && size <= 4)).toBe(true);
    expect(flight.objects.some((object) => object.id.startsWith("terrain:"))).toBe(true);
    expect(
      flight.objects.some((object) => object.id.startsWith("ballistic:") && object.velocity),
    ).toBe(true);
    expect(flight.objects.some((object) => object.role === "discovery")).toBe(true);
    const origins = Object.keys(packs).map((id) => id.slice(5).split(",").map(Number));
    for (let i = 0; i < origins.length; i++) {
      for (let j = i + 1; j < origins.length; j++) {
        const first = origins[i]!;
        const second = origins[j]!;
        expect(
          Math.hypot(first[0]! - second[0]!, first[1]! - second[1]!) * PROTOTYPE.tuning.chunkSize,
        ).toBeGreaterThanOrEqual(1800);
      }
    }
    const replay = empty();
    for (let i = 1; i <= 12; i++) {
      replay.player = { x: i * 4096, y: 0 };
      ensureDestination(PROTOTYPE, `scan:${i}`, replay);
    }
    expect(replay).toEqual(flight);
  });
});
