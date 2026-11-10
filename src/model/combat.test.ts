import { describe, expect, it } from "vitest";

import { type EnemyArchetype, enemyCatalog } from "../data/enemy-catalog.ts";
import { PROTOTYPE } from "../data/prototype.ts";
import { createEnemy } from "./enemy-ai.ts";
import {
  createFlight,
  ensureDestination,
  ensureRouteEncounter,
  placeDestinationAhead,
  routeBlocked,
  settleRouteEncounters,
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

function pack(flight: FlightState, points: Vec[]): SpaceObject[] {
  const members = points.map((point, index) => {
    const object = ship("swarm", point);
    object.id = `roster:${index}`;
    object.enemy!.id = object.id;
    object.enemy!.packId = "roster";
    return object;
  });
  flight.combat = { initialPackSizes: { roster: members.length }, routeEncounters: [] };
  flight.objects.push(...members);
  return members;
}

describe("combat admission and subframe firing", () => {
  it("records only admitted pack members when a safezone excludes part of a seeded group", () => {
    let template: FlightState | undefined;
    let members: SpaceObject[] = [];
    for (let seed = 0; seed < 64; seed++) {
      const candidate = createFlight(PROTOTYPE, 1, seed, progress);
      const group = candidate.objects.filter((object) => object.enemy?.archetype === "swarm");
      if (group.length >= 3) {
        template = candidate;
        members = group;
        break;
      }
    }
    expect(template).toBeDefined();
    const flight = template!;
    const packId = members[0]!.enemy!.packId!;
    const last = members.at(-1)!;
    flight.chunks = [];
    flight.combat = { initialPackSizes: {}, routeEncounters: [] };
    flight.objects = [{ hp: 1, id: "safe", kind: "destination", radius: 30, x: last.x, y: last.y }];
    stepFlight(PROTOTYPE, 0.001, idle, flight);
    const admitted = flight.objects.filter((object) => object.enemy?.packId === packId);
    expect(admitted.length).toBeGreaterThan(0);
    expect(admitted.length).toBeLessThan(members.length);
    expect(flight.combat!.initialPackSizes[packId]).toBe(admitted.length);
    expect(admitted.every((object) => !object.enemy!.fleeing)).toBe(true);
  });

  it.each(["destination", "guard"] as const)(
    "does not count %s clearance as a casualty but still retreats after a real loss",
    (clearance) => {
      const flight = empty();
      const points =
        clearance === "destination"
          ? [
              { x: 0, y: -1024 },
              { x: 50, y: -1024 },
              { x: 400, y: -1024 },
              { x: 450, y: -1024 },
            ]
          : [
              { x: 690, y: 0 },
              { x: 700, y: 0 },
              { x: 1100, y: 0 },
              { x: 1150, y: 0 },
            ];
      const members = pack(flight, points);
      if (clearance === "destination") {
        ensureDestination(PROTOTYPE, "clearance", flight);
      } else {
        flight.objects.push({
          hp: 1,
          id: "clearance",
          kind: "destination",
          radius: 30,
          x: 1000,
          y: 0,
        });
        ensureRouteEncounter(PROTOTYPE, "clearance", flight);
      }
      expect(flight.combat!.initialPackSizes.roster).toBe(2);
      expect(flight.objects).not.toContain(members[0]);
      expect(flight.objects).not.toContain(members[1]);
      stepFlight(PROTOTYPE, 0.001, idle, flight);
      expect(members[2]!.enemy!.fleeing).toBe(false);
      expect(members[3]!.enemy!.fleeing).toBe(false);
      hit(flight, members[2]!, 2);
      expect(stepFlight(PROTOTYPE, 0.001, idle, flight)).toContainEqual({ type: "enemyDisabled" });
      expect(flight.combat!.initialPackSizes.roster).toBe(2);
      stepFlight(PROTOTYPE, 0.001, idle, flight);
      expect(members[3]!.enemy!.fleeing).toBe(true);
    },
  );

  it("does not erase an already recorded casualty when destination clearance removes its dead object", () => {
    const flight = empty();
    const members = pack(flight, [
      { x: 0, y: -1024 },
      { x: 400, y: -1024 },
    ]);
    members[0]!.hp = 0;
    members[0]!.enemy!.hp = 0;
    ensureDestination(PROTOTYPE, "clearance", flight);
    expect(flight.combat!.initialPackSizes.roster).toBe(2);
    stepFlight(PROTOTYPE, 0.001, idle, flight);
    expect(members[1]!.enemy!.fleeing).toBe(true);
  });

  it("ages and moves a new shot only after its fire delay, then gives it a full subsequent slice", () => {
    const flight = empty();
    const target = ship("fighter", { x: 300, y: 0 });
    target.enemy!.primaryCooldown = 0.012;
    flight.objects.push(target);
    const dt = 1 / 60;
    stepFlight(PROTOTYPE, dt, idle, flight);
    const shot = flight.shots.find((shot) => shot.enemy)!;
    const elapsed = dt - 0.012;
    expect(shot).toBeDefined();
    expect(shot.x).toBeCloseTo(300 + shot.velocity.x * elapsed, 10);
    expect(shot.y).toBeCloseTo(shot.velocity.y * elapsed, 10);
    expect(shot.life).toBeCloseTo(PROTOTYPE.tuning.flight.enemyProjectileLifetime - elapsed, 10);
    const before = { life: shot.life, x: shot.x, y: shot.y };
    stepFlight(PROTOTYPE, dt, idle, flight);
    expect(shot.x).toBeCloseTo(before.x + shot.velocity.x * dt, 10);
    expect(shot.y).toBeCloseTo(before.y + shot.velocity.y * dt, 10);
    expect(shot.life).toBeCloseTo(before.life - dt, 10);
  });

  it("does not hit Ada before a delayed bolt can reach her collision boundary", () => {
    const flight = empty();
    const target = ship("fighter", { x: 15, y: 0 });
    target.cooldown = 999;
    target.enemy!.primaryCooldown = 0.012;
    flight.objects.push(target);
    stepFlight(PROTOTYPE, 1 / 60, idle, flight);
    expect(flight.shield).toBe(PROTOTYPE.tuning.shieldMax);
    expect(flight.shots.filter((shot) => shot.enemy)).toHaveLength(1);
    stepFlight(PROTOTYPE, 1 / 60, idle, flight);
    expect(flight.shield).toBe(PROTOTYPE.tuning.shieldMax - PROTOTYPE.tuning.enemyDamage);
    expect(flight.shots.filter((shot) => shot.enemy)).toHaveLength(0);
  });

  it.each(["destination", "guard"] as const)(
    "preserves both required fights through nearby %s clearance",
    (clearance) => {
      const flight = empty();
      flight.sector = 3;
      const first = ensureDestination(PROTOTYPE, "first", flight);
      const firstGuard = ensureRouteEncounter(PROTOTYPE, "first", flight)!;
      const original = { x: firstGuard.x, y: firstGuard.y };
      let second: SpaceObject;
      if (clearance === "destination") {
        // Compensate for the second destination's lateral offset to place it on the guard.
        flight.player = {
          x: original.x - PROTOTYPE.tuning.safeRadius * 2.5,
          y: original.y + PROTOTYPE.tuning.chunkSize * 2,
        };
        second = ensureDestination(PROTOTYPE, "second", flight);
        expect({ x: second.x, y: second.y }).toEqual(original);
      } else {
        // Parallel approaches place oversized guard footprints across each other.
        second = {
          hp: 1,
          id: "second",
          kind: "destination",
          radius: 30,
          x: first.x + 400,
          y: first.y,
        };
        flight.objects.push(second);
        flight.player = { x: second.x, y: 0 };
      }
      expect(flight.objects).toContain(firstGuard);
      const secondGuard = ensureRouteEncounter(PROTOTYPE, "second", flight)!;
      expect(flight.objects).toContain(firstGuard);
      expect(flight.objects).toContain(secondGuard);
      expect(routeBlocked("first", flight)).toBe(true);
      expect(routeBlocked("second", flight)).toBe(true);
      for (const guard of [firstGuard, secondGuard]) {
        for (const destination of [first, second]) {
          expect(
            Math.hypot(guard.x - destination.x, guard.y - destination.y) - guard.radius,
          ).toBeGreaterThanOrEqual(PROTOTYPE.tuning.safeRadius);
        }
        expect(guard.enemy!.home).toEqual({ x: guard.x, y: guard.y });
        expect(guard.enemy!.position).toEqual({ x: guard.x, y: guard.y });
      }
      expect(
        Math.hypot(firstGuard.x - secondGuard.x, firstGuard.y - secondGuard.y),
      ).toBeGreaterThanOrEqual(firstGuard.radius + secondGuard.radius);
      expect(ensureRouteEncounter(PROTOTYPE, "first", flight)).toBe(firstGuard);
      expect(ensureRouteEncounter(PROTOTYPE, "second", flight)).toBe(secondGuard);
    },
  );
});


it("settles a translated route guard after destination relocation without resetting its combat state", () => {
  const flight = empty();
  flight.sector = 3;
  const destination: SpaceObject = {
    hp: 1, id: "moving-route", kind: "destination", radius: 30, x: 10000, y: 10000,
  };
  flight.objects.push(destination);
  const guard = ensureRouteEncounter(PROTOTYPE, destination.id, flight)!;
  guard.enemy!.hardpoints[0]!.hp = 2;
  guard.enemy!.hardpoints[1]!.cooldown = 0.7;
  guard.enemy!.engaged = true;
  guard.enemy!.pursuitSeconds = 1.25;
  const saved = structuredClone(guard.enemy!);
  const old = { x: destination.x, y: destination.y };
  const friendly: SpaceObject = {
    hp: 1, id: "friendly", kind: "destination", radius: 30,
    x: 400 + guard.x - old.x, y: -1024 + guard.y - old.y,
  };
  flight.objects.push(friendly);
  const relocated = placeDestinationAhead(PROTOTYPE, destination.id, flight);
  const dx = relocated.x - old.x;
  const dy = relocated.y - old.y;
  guard.x += dx;
  guard.y += dy;
  guard.enemy!.position.x += dx;
  guard.enemy!.position.y += dy;
  guard.enemy!.home.x += dx;
  guard.enemy!.home.y += dy;
  expect(Math.hypot(guard.x - friendly.x, guard.y - friendly.y)).toBeLessThan(1e-6);
  expect(ensureRouteEncounter(PROTOTYPE, destination.id, flight)).toBe(guard);
  expect(Math.hypot(guard.x - friendly.x, guard.y - friendly.y)).toBeLessThan(1e-6);
  settleRouteEncounters(PROTOTYPE, flight);
  for (const target of [relocated, friendly]) {
    expect(Math.hypot(guard.x - target.x, guard.y - target.y) - guard.radius).toBeGreaterThanOrEqual(PROTOTYPE.tuning.safeRadius);
  }
  expect(guard.enemy!.hardpoints).toEqual(saved.hardpoints);
  expect({
    ...guard.enemy!, home: saved.home, position: saved.position, velocity: saved.velocity,
  }).toEqual(saved);
  expect(guard.enemy!.position).toEqual({ x: guard.x, y: guard.y });
  expect(guard.enemy!.home).toEqual({ x: guard.x, y: guard.y });
  expect(routeBlocked(destination.id, flight)).toBe(true);
  expect(flight.combat!.routeEncounters).toEqual([destination.id]);
});
