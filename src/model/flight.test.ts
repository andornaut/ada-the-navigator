import { describe, expect, it } from "vitest";

import { enemyCatalog, enemyDefinition } from "../data/enemy-catalog.ts";
import { PROTOTYPE } from "../data/prototype.ts";
import { RESOURCE_ROCKS } from "../data/resource-rocks.ts";
import type { PrototypeContent } from "../data/types.ts";
import { WEAPON_CATALOG } from "../data/weapon-catalog.ts";
import { createEnemy } from "./enemy-ai.ts";
import {
  createFlight,
  dronesNear,
  ensureDestination,
  inBattle,
  movementSpeedFraction,
  placeDestinationAhead,
  shipSpeedFraction,
  stepFlight,
  syncFlightRegion,
  teleport,
} from "./flight.ts";
import { shipCircleContact } from "./ship-body.ts";
import type { FlightInput, FlightState, SectorProgress, Vec } from "./types.ts";
import { noLevels } from "./upgrades.ts";

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
const idle: FlightInput = { aim: { x: 0, y: 0 }, move: { x: 0, y: 0 }, use: false };
function empty(): FlightState {
  const flight = createFlight(PROTOTYPE, 1, 1234, progress);
  flight.objects = [];
  return flight;
}
/** Unsigned angle between two vectors, in degrees. */
function degrees(a: Vec, b: Vec): number {
  return (Math.abs(Math.atan2(a.x * b.y - a.y * b.x, a.x * b.x + a.y * b.y)) * 180) / Math.PI;
}

describe("flight boundaries", () => {
  it("resumes deterministic simulation including projectiles and cooldowns after JSON roundtrip", () => {
    const original = createFlight(PROTOTYPE, 2, 41, progress);
    const input = { ...idle, aim: { x: 1, y: 0 }, move: { x: 1, y: 0.3 } };
    stepFlight(PROTOTYPE, 0.8, input, original);
    const resumed = JSON.parse(JSON.stringify(original)) as FlightState;
    expect(Number.isFinite(resumed.sinceDamage)).toBe(true);
    const first = stepFlight(PROTOTYPE, 2, input, original);
    expect(stepFlight(PROTOTYPE, 2, input, resumed)).toEqual(first);
    expect(resumed).toEqual(original);
  });

  it("counts all first-visit travel but not standing, teleport or revisited portions", () => {
    const flight = empty();
    flight.player = { x: 100, y: 100 };
    const right = { ...idle, move: { x: 1, y: 0 } };
    stepFlight(PROTOTYPE, 1, right, flight);
    expect(flight.freshDistance).toBeGreaterThan(PROTOTYPE.tuning.physics.maxSpeed * 0.6);
    const target = ensureDestination(PROTOTYPE, "hub", flight);
    target.x = 100;
    target.y = 100;
    flight.dangerFor = 0;
    const before = flight.freshDistance;
    expect(teleport(PROTOTYPE, "hub", flight)).toBe(true);
    expect(flight.velocity).toEqual({ x: 0, y: 0 });
    stepFlight(PROTOTYPE, 1, idle, flight);
    stepFlight(PROTOTYPE, 0.5, right, flight);
    expect(flight.freshDistance).toBe(before);
  });

  it("keeps movement independent of aim and fires an upgrade only while aiming, one shot per volley", () => {
    const flight = empty();
    flight.player = { x: 100, y: 100 };
    stepFlight(PROTOTYPE, 0.4, { ...idle, move: { x: 1, y: 0 } }, flight);
    expect(flight.shots).toHaveLength(0);
    expect(flight.facing).toEqual({ x: 1, y: 0 });
    flight.weapon = "multiLaser";
    flight.ammo.multiLaser = 5;
    stepFlight(PROTOTYPE, 0.01, { ...idle, aim: { x: 0, y: -1 } }, flight);
    // A three-bolt fan is one shot.
    expect(flight.shots).toHaveLength(3);
    expect(flight.ammo.multiLaser).toBe(4);
    expect(flight.weapon).toBe("multiLaser");
    expect(flight.facing.x).toBeGreaterThan(0);
    expect(flight.facing.y).toBeLessThan(0);
    expect(degrees(flight.shots[1]!.velocity, flight.facing)).toBeLessThan(1e-9);
  });

  it("blocks scenery without shield damage and accepts consecutive hits without invulnerability", () => {
    const flight = empty();
    flight.player = { x: 100, y: 100 };
    flight.objects.push({ hp: 100, id: "wall", kind: "rock", radius: 30, x: 145, y: 100 });
    stepFlight(PROTOTYPE, 0.5, { ...idle, move: { x: 1, y: 0 } }, flight);
    expect(flight.player.x).toBeLessThan(106);
    expect(flight.shield).toBe(PROTOTYPE.tuning.shieldMax);
    flight.shots = [0, 1].map((n) => ({
      ...flight.player,
      damage: 1,
      enemy: true,
      hitIds: [],
      id: `hit${n}`,
      life: 1,
      piercing: false,
      velocity: { x: 0, y: 0 },
    }));
    stepFlight(PROTOTYPE, 0.01, idle, flight);
    expect(flight.shield).toBe(PROTOTYPE.tuning.shieldMax - 2 * PROTOTYPE.tuning.hazardDamage);
    flight.objects = [];
    stepFlight(PROTOTYPE, PROTOTYPE.tuning.shieldRechargeDelay + 1, idle, flight);
    expect(flight.shield).toBeGreaterThan(
      PROTOTYPE.tuning.shieldMax - 2 * PROTOTYPE.tuning.hazardDamage,
    );
  });

  it("generates ahead, protects arrivals and refuses teleport during danger", () => {
    const flight = empty();
    const target = ensureDestination(PROTOTYPE, "growers", flight);
    expect(target.y).toBeLessThan(-PROTOTYPE.tuning.chunkSize);
    expect(target.role).toBe("growers");
    flight.dangerFor = 1;
    expect(teleport(PROTOTYPE, target.id, flight)).toBe(false);
    flight.dangerFor = 0;
    expect(teleport(PROTOTYPE, target.id, flight)).toBe(true);
    flight.shots.push({
      ...flight.player,
      damage: 1,
      enemy: true,
      hitIds: [],
      id: "arrival-hit",
      life: 1,
      piercing: false,
      velocity: { x: 0, y: 0 },
    });
    stepFlight(PROTOTYPE, 0.01, idle, flight);
    expect(flight.shield).toBe(PROTOTYPE.tuning.shieldMax);
    expect(flight.dangerFor).toBe(0);
  });

  it("collects cargo without a capacity limit and retains each collected upgrade", () => {
    const flight = empty();
    flight.cargo = 500;
    flight.weapon = "rapidMissile";
    flight.objects.push(
      { ...flight.player, hp: 1, id: "cargo", kind: "pickup", radius: 10, role: "cargo" },
      {
        ...flight.player,
        hp: 1,
        id: "multiLaser",
        kind: "pickup",
        radius: 10,
        weapon: "multiLaser",
      },
    );
    stepFlight(PROTOTYPE, 0.01, idle, flight);
    expect(flight.cargo).toBe(501);
    expect(flight.objects).toHaveLength(0);
    expect(flight.weapon).toBe("multiLaser");
    expect(flight.ownedWeapons).toEqual(["rapidMissile", "multiLaser"]);
  });

  it("clears consecutive targets with nonpiercing bolts and releases cargo from destroyed resource rocks", () => {
    const flight = empty();
    flight.player = { x: 100, y: 100 };
    flight.objects = [
      { hp: 1, id: "debris", kind: "debris", radius: 10, x: 130, y: 100 },
      {
        // Facing along the firing line, it starts moving along it rather than off it.
        enemy: {
          ...createEnemy(
            enemyCatalog.fighter,
            { archetype: "fighter", id: "enemy", packId: null, phase: 0 },
            { x: 160, y: 100 },
          ),
          facing: { x: 1, y: 0 },
          hp: 1,
        },
        hp: 1,
        id: "enemy",
        kind: "enemy",
        radius: 10,
        x: 160,
        y: 100,
      },
      { hp: 1, id: "resource", kind: "resource", radius: 10, x: 190, y: 100 },
    ];
    flight.weapon = "laser";
    const events = stepFlight(PROTOTYPE, 1, { ...idle, aim: { x: 1, y: 0 } }, flight);
    expect(events).toContainEqual({ id: "debris", type: "debrisCleared" });
    expect(events).toContainEqual({ type: "enemyDisabled" });
    expect(flight.objects.filter((o) => o.role === "cargo")).toHaveLength(
      RESOURCE_ROCKS.classes.medium.pieces,
    );
    expect(flight.objects.some((o) => ["debris", "enemy", "resource"].includes(o.id))).toBe(false);
  });

  it("separates regenerated known destinations and discovers nearby arrivals", () => {
    const flight = createFlight(PROTOTYPE, 1, 123, {
      ...progress,
      known: ["growers", "workshop", "salvagers"],
    });
    const a = ensureDestination(PROTOTYPE, "growers", flight);
    const b = ensureDestination(PROTOTYPE, "workshop", flight);
    expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThanOrEqual(
      PROTOTYPE.tuning.safeRadius * 2,
    );
    const previous = { x: a.x, y: a.y };
    expect(placeDestinationAhead(PROTOTYPE, "growers", flight)).toBe(a);
    flight.player.x += PROTOTYPE.tuning.chunkSize * 10;
    const moved = placeDestinationAhead(PROTOTYPE, "growers", flight);
    expect(moved.x).not.toBe(previous.x);
    flight.dangerFor = 0;
    teleport(PROTOTYPE, "growers", flight);
    expect(stepFlight(PROTOTYPE, 0.01, idle, flight)).toContainEqual({
      id: "growers",
      type: "discovered",
    });
  });
});

it("stops movement and fresh exploration after released controls finish braking", () => {
  const flight = empty();
  flight.player = { x: 100, y: 100 };
  stepFlight(PROTOTYPE, 0.2, { ...idle, move: { x: 1, y: 0 } }, flight);
  stepFlight(PROTOTYPE, 3, idle, flight);
  const position = { ...flight.player };
  const explored = flight.freshDistance;
  stepFlight(PROTOTYPE, 1, idle, flight);
  expect(flight.player).toEqual(position);
  expect(flight.freshDistance).toBe(explored);
});

it("retains nonzero movement-facing through released coasting and rest before placing the next quest", () => {
  const flight = empty();
  stepFlight(PROTOTYPE, 0.4, { ...idle, move: { x: 1, y: 0 } }, flight);
  stepFlight(PROTOTYPE, 0.1, idle, flight);
  expect(flight.velocity.x).toBeGreaterThan(0);
  expect(flight.facing).toEqual({ x: 1, y: 0 });
  stepFlight(PROTOTYPE, 3, idle, flight);
  expect(flight.velocity).toEqual({ x: 0, y: 0 });
  expect(flight.facing).toEqual({ x: 1, y: 0 });
  const before = { ...flight.player };
  const first = ensureDestination(PROTOTYPE, "growers", flight);
  const second = ensureDestination(PROTOTYPE, "workshop", flight);
  expect(first.x).toBeGreaterThan(before.x);
  expect(second.x).toBeGreaterThan(before.x);
  expect(Math.hypot(first.x - second.x, first.y - second.y)).toBeGreaterThanOrEqual(
    PROTOTYPE.tuning.safeRadius * 2,
  );
});

it("places distinct quest destinations for legacy zero-facing saves without leaving them on the player", () => {
  const flight = empty();
  flight.facing = { x: 0, y: 0 };
  const first = ensureDestination(PROTOTYPE, "growers", flight);
  const second = ensureDestination(PROTOTYPE, "workshop", flight);
  expect(first.y).toBeLessThan(flight.player.y);
  expect(second.y).toBeLessThan(flight.player.y);
  expect(Math.hypot(first.x - second.x, first.y - second.y)).toBeGreaterThanOrEqual(
    PROTOTYPE.tuning.safeRadius * 2,
  );
  syncFlightRegion(PROTOTYPE, flight);
  expect(flight.objects).toContain(first);
  expect(flight.objects).toContain(second);
});

describe("drones near", () => {
  it("leave a debris hit's danger without drones near, which an engaged drone in perception sets", () => {
    const flight = empty();
    flight.player = { x: 100, y: 100 };
    flight.objects = [
      {
        hp: PROTOTYPE.tuning.flight.rockHp,
        id: "debris",
        kind: "debris",
        radius: PROTOTYPE.tuning.flight.rockRadius,
        velocity: { x: 1, y: 0 },
        x: 100,
        y: 100,
      },
    ];
    stepFlight(PROTOTYPE, 0.05, idle, flight);
    expect(flight.shield).toBeLessThan(PROTOTYPE.tuning.shieldMax);
    expect(flight.dangerFor).toBeGreaterThan(0);
    expect(dronesNear(PROTOTYPE, flight)).toBe(false);
    const { perception } = enemyDefinition(1, "fighter");
    const drone = (x: number, engaged: boolean) => {
      const at = { x, y: flight.player.y };
      const enemy = createEnemy(
        enemyCatalog.fighter,
        { archetype: "fighter", id: "drone", packId: null, phase: 0 },
        at,
      );
      return {
        ...at,
        enemy: { ...enemy, engaged },
        hp: 1,
        id: "drone",
        kind: "enemy" as const,
        radius: 10,
      };
    };
    flight.objects = [drone(flight.player.x + perception - 1, false)];
    expect(dronesNear(PROTOTYPE, flight)).toBe(false);
    flight.objects = [drone(flight.player.x + perception + 1, true)];
    expect(dronesNear(PROTOTYPE, flight)).toBe(false);
    flight.objects = [drone(flight.player.x + perception - 1, true)];
    expect(dronesNear(PROTOTYPE, flight)).toBe(true);
  });
});

describe("directional handling", () => {
  const maxSpeed = PROTOTYPE.tuning.physics.maxSpeed;
  const physics = PROTOTYPE.tuning.physics;
  const vectorOnly: PrototypeContent = {
    ...PROTOTYPE,
    tuning: { ...PROTOTYPE.tuning, physics: { ...PROTOTYPE.tuning.physics, turnSeconds: 0 } },
  };
  const instantAim: PrototypeContent = {
    ...PROTOTYPE,
    tuning: { ...PROTOTYPE.tuning, physics: { ...PROTOTYPE.tuning.physics, aimTurnSeconds: 0 } },
  };
  const east = { x: 1, y: 0 };
  const speed = (flight: FlightState) => Math.hypot(flight.velocity.x, flight.velocity.y);
  function cruising(): FlightState {
    const flight = empty();
    flight.player = { x: 256, y: 256 };
    flight.velocity = { x: maxSpeed, y: 0 };
    flight.facing = { ...east };
    return flight;
  }
  function frames(
    content: PrototypeContent,
    count: number,
    input: FlightInput,
    flight: FlightState,
  ): void {
    for (let i = 0; i < count; i++) {
      stepFlight(content, 1 / 60, input, flight);
    }
  }

  it("turns a full-speed 90 degree request no faster than vector-only handling, then converges", () => {
    const request = { ...idle, move: { x: 0, y: -1 } };
    const damped = cruising();
    const reference = cruising();
    stepFlight(PROTOTYPE, 0.1, request, damped);
    stepFlight(vectorOnly, 0.1, request, reference);
    const turned = degrees(damped.velocity, east);
    const referenceTurned = degrees(reference.velocity, east);
    expect(referenceTurned).toBeCloseTo(17.8, 0);
    expect(turned).toBeLessThanOrEqual(referenceTurned);
    expect(turned).toBeGreaterThan(4);
    expect(turned).toBeLessThan(9);
    stepFlight(PROTOTYPE, 0.1, request, damped);
    expect(speed(damped)).toBeLessThan(0.95 * maxSpeed);
    stepFlight(PROTOTYPE, 2, request, damped);
    expect(degrees(damped.velocity, request.move)).toBeLessThan(1);
    expect(degrees(damped.facing, request.move)).toBeLessThan(1);
    expect(speed(damped)).toBeGreaterThan(0.95 * maxSpeed);
  });

  it.each([45, 90, 135, 180])(
    "never brings velocity closer to a %i degree request than vector-only handling",
    (angle) => {
      const radians = (angle * Math.PI) / 180;
      const input = { ...idle, move: { x: Math.cos(radians), y: -Math.sin(radians) } };
      const error = (flight: FlightState) =>
        Math.hypot(
          flight.velocity.x - input.move.x * maxSpeed,
          flight.velocity.y - input.move.y * maxSpeed,
        );
      const damped = cruising();
      const reference = cruising();
      for (let i = 0; i < 60; i++) {
        stepFlight(PROTOTYPE, 1 / 60, input, damped);
        stepFlight(vectorOnly, 1 / 60, input, reference);
        expect(error(damped)).toBeGreaterThanOrEqual(error(reference) - 1e-9);
        expect(speed(damped)).toBeLessThanOrEqual(maxSpeed + 1e-9);
      }
    },
  );

  it("keeps acceleration from rest, braking and independent aim identical to vector-only handling", () => {
    const damped = empty();
    const reference = empty();
    const input = { ...idle, aim: { x: 0, y: -1 }, move: east };
    stepFlight(PROTOTYPE, physics.accelerationSeconds, input, damped);
    stepFlight(vectorOnly, physics.accelerationSeconds, input, reference);
    expect(damped.velocity.x).toBeCloseTo(maxSpeed * (1 - Math.exp(-1)), 6);
    expect(damped.velocity.y).toBe(0);
    expect(damped.facing).toEqual(input.aim);
    stepFlight(PROTOTYPE, physics.brakingSeconds, idle, damped);
    stepFlight(vectorOnly, physics.brakingSeconds, idle, reference);
    expect(damped.velocity).toEqual(reference.velocity);
    stepFlight(PROTOTYPE, 4, idle, damped);
    stepFlight(vectorOnly, 4, idle, reference);
    expect(damped.facing).toEqual(east);
    expect(damped.velocity).toEqual({ x: 0, y: 0 });
    expect(damped.player).toEqual(reference.player);
  });

  it("converges aim with its response and fires immediately along the smoothed facing", () => {
    const flight = empty();
    flight.facing = { ...east };
    const aim = { ...idle, aim: { x: 0, y: -1 } };
    stepFlight(PROTOTYPE, 1 / 60, aim, flight);
    expect(flight.shots).toHaveLength(1);
    expect(degrees(flight.facing, aim.aim)).toBeCloseTo(
      90 * Math.exp(-1 / 60 / physics.aimTurnSeconds),
      6,
    );
    expect(degrees(flight.shots[0]!.velocity, flight.facing)).toBeLessThan(1e-9);
    expect(flight.fireCooldown).toBeCloseTo(WEAPON_CATALOG.laser[0].intervalSeconds, 9);
    frames(PROTOTYPE, 5, aim, flight);
    expect(degrees(flight.facing, aim.aim)).toBeCloseTo(
      90 * Math.exp(-0.1 / physics.aimTurnSeconds),
      6,
    );
    // The half-degree snap lands on frame 22 at aimTurnSeconds 0.07.
    frames(PROTOTYPE, 15, aim, flight);
    expect(flight.facing).not.toEqual(aim.aim);
    frames(PROTOTYPE, 1, aim, flight);
    expect(flight.facing).toEqual(aim.aim);
  });

  it("keeps right-stick fire cadence identical to instant aim", () => {
    const damped = empty();
    const instant = empty();
    damped.facing = { ...east };
    instant.facing = { ...east };
    const aim = { ...idle, aim: { x: 0, y: -1 } };
    for (let i = 0; i < 60; i++) {
      stepFlight(PROTOTYPE, 1 / 60, aim, damped);
      stepFlight(instantAim, 1 / 60, aim, instant);
      expect(damped.shots.map((s) => s.id)).toEqual(instant.shots.map((s) => s.id));
      expect(damped.fireCooldown).toBe(instant.fireCooldown);
    }
    expect(damped.shots.length).toBeGreaterThan(1);
    expect(damped.shots.at(-1)!.velocity).toEqual(instant.shots.at(-1)!.velocity);
  });

  it("turns back to movement-facing without a snap and stops firing when aim is released", () => {
    const flight = cruising();
    const move = { ...idle, move: east };
    stepFlight(PROTOTYPE, 0.5, { ...move, aim: { x: -1, y: 0 } }, flight);
    expect(flight.facing).toEqual({ x: -1, y: 0 });
    const fired = new Set(flight.shots.map((s) => s.id));
    expect(fired.size).toBeGreaterThan(0);
    stepFlight(PROTOTYPE, 1 / 60, move, flight);
    expect(degrees(flight.facing, east)).toBeCloseTo(
      180 * Math.exp(-1 / 60 / physics.aimTurnSeconds),
      6,
    );
    expect(degrees(flight.facing, east)).toBeGreaterThan(100);
    frames(PROTOTYPE, 21, move, flight);
    expect(degrees(flight.facing, east)).toBeLessThan(1);
    frames(PROTOTYPE, 3, move, flight);
    expect(flight.facing).toEqual(east);
    stepFlight(PROTOTYPE, 1, move, flight);
    expect(flight.shots.every((s) => fired.has(s.id))).toBe(true);
  });

  it("keeps the current facing when aim is released at rest", () => {
    const flight = empty();
    stepFlight(PROTOTYPE, 0.5, { ...idle, aim: { x: -1, y: 0 } }, flight);
    expect(flight.facing).toEqual({ x: -1, y: 0 });
    stepFlight(PROTOTYPE, 0.5, idle, flight);
    expect(flight.velocity).toEqual({ x: 0, y: 0 });
    expect(flight.facing).toEqual({ x: -1, y: 0 });
  });

  it("matches one 1/30 s frame with two 1/60 s frames and stays close at 144 Hz", () => {
    const input = { ...idle, aim: { x: -1, y: 0 }, move: { x: 0, y: -1 } };
    const single = cruising();
    const split = cruising();
    stepFlight(PROTOTYPE, 1 / 30, input, single);
    stepFlight(PROTOTYPE, 1 / 60, input, split);
    stepFlight(PROTOTYPE, 1 / 60, input, split);
    for (const key of ["velocity", "facing", "player"] as const) {
      expect(split[key].x).toBeCloseTo(single[key].x, 9);
      expect(split[key].y).toBeCloseTo(single[key].y, 9);
    }
    const reference = cruising();
    const fast = cruising();
    stepFlight(PROTOTYPE, 0.25, input, reference);
    for (let i = 0; i < 36; i++) {
      stepFlight(PROTOTYPE, 1 / 144, input, fast);
    }
    expect(degrees(fast.velocity, reference.velocity)).toBeLessThan(0.1);
    expect(Math.abs(speed(fast) - speed(reference))).toBeLessThan(0.5);
    expect(degrees(fast.facing, reference.facing)).toBeLessThan(0.1);
  });

  it("turns movement and aim along the short arc across the angle boundary", () => {
    const flight = cruising();
    const at = (deg: number) => ({
      x: Math.cos((deg * Math.PI) / 180),
      y: Math.sin((deg * Math.PI) / 180),
    });
    const target = at(-179);
    flight.facing = at(179);
    flight.velocity = { x: flight.facing.x * maxSpeed, y: flight.facing.y * maxSpeed };
    stepFlight(PROTOTYPE, 1 / 60, { ...idle, aim: target, move: target }, flight);
    expect(flight.facing.x).toBeLessThan(-0.99);
    expect(flight.velocity.x).toBeLessThan(-0.99 * maxSpeed);
    expect(degrees(flight.facing, target)).toBeLessThan(2);
    expect(degrees(flight.velocity, target)).toBeLessThan(2);
  });

  it("keeps collision blocking and the speed limit while turning toward a rock", () => {
    const flight = empty();
    flight.player = { x: 100, y: 100 };
    flight.velocity = { x: 0, y: -maxSpeed };
    flight.objects.push({ hp: 100, id: "wall", kind: "rock", radius: 30, x: 140, y: 80 });
    for (let i = 0; i < 12; i++) {
      stepFlight(PROTOTYPE, 1 / 60, { ...idle, move: east }, flight);
      expect(speed(flight)).toBeLessThanOrEqual(maxSpeed + 1e-9);
      // Ada's drawn ship stays off the rock's circle at every heading she turns through.
      expect(shipCircleContact(flight.facing, flight.player, { x: 140, y: 80 }, 30)).toBeNull();
    }
    expect(flight.player.y).toBeLessThan(100);
    expect(flight.shield).toBe(PROTOTYPE.tuning.shieldMax);
  });

  it("adds no save fields and settles a restored mid-turn flight on the same course", () => {
    const flight = cruising();
    const reference = cruising();
    const input = { ...idle, aim: { x: -1, y: 0 }, move: { x: 0, y: 1 } };
    stepFlight(PROTOTYPE, 0.05, input, flight);
    stepFlight(vectorOnly, 0.05, input, reference);
    expect(Object.keys(flight).sort()).toEqual(Object.keys(reference).sort());
    const restored = JSON.parse(JSON.stringify(flight)) as FlightState;
    stepFlight(PROTOTYPE, 1.5, input, flight);
    stepFlight(PROTOTYPE, 1.5, input, restored);
    expect(degrees(restored.velocity, flight.velocity)).toBeLessThan(0.5);
    expect(restored.facing).toEqual(flight.facing);
  });
});

describe("analog movement speed", () => {
  const maxSpeed = PROTOTYPE.tuning.physics.maxSpeed;
  const speed = (flight: FlightState) => Math.hypot(flight.velocity.x, flight.velocity.y);
  function cruise(move: Vec): FlightState {
    const flight = empty();
    flight.player = { x: 256, y: 256 };
    for (let frame = 0; frame < 180; frame++) {
      stepFlight(PROTOTYPE, 1 / 60, { ...idle, move }, flight);
    }
    return flight;
  }

  it.each([
    [1e-9, 6],
    [0.25, 11],
    [0.5, 34],
    [0.75, 82],
    [1, 160],
  ])("targets about Gameplay's speed at %s deflection", (deflection, expected) => {
    const fraction = movementSpeedFraction(PROTOTYPE.tuning, deflection);
    expect(fraction * maxSpeed).toBeCloseTo(expected, -0.5);
  });

  it("settles the ship at the curved speed for partial and full stick deflection", () => {
    for (const deflection of [0.25, 0.5, 1]) {
      const flight = cruise({ x: 0, y: -deflection });
      const target = maxSpeed * movementSpeedFraction(PROTOTYPE.tuning, deflection);
      expect(speed(flight) / target).toBeCloseTo(1, 3);
    }
    expect(speed(cruise({ x: 0, y: -0.25 }))).toBeLessThan(0.1 * maxSpeed);
  });

  it("rises monotonically from the floor to exactly maxSpeed at full deflection", () => {
    let previous = 0;
    for (let step = 1; step <= 100; step++) {
      const fraction = movementSpeedFraction(PROTOTYPE.tuning, step / 100);
      expect(fraction).toBeGreaterThan(previous);
      previous = fraction;
    }
    expect(movementSpeedFraction(PROTOTYPE.tuning, 1)).toBe(1);
    expect(movementSpeedFraction(PROTOTYPE.tuning, 2)).toBe(1);
    expect(movementSpeedFraction(PROTOTYPE.tuning, 1e-9)).toBeCloseTo(
      PROTOTYPE.tuning.minSpeedFraction,
      9,
    );
  });

  it("requests no speed without input and brakes to a stop", () => {
    expect(movementSpeedFraction(PROTOTYPE.tuning, 0)).toBe(0);
    const flight = cruise({ x: 1, y: 0 });
    for (let frame = 0; frame < 160; frame++) {
      stepFlight(PROTOTYPE, 1 / 60, idle, flight);
    }
    expect(flight.velocity).toEqual({ x: 0, y: 0 });
  });

  it("comes to rest about 2.5 s after release from full speed, below 1% of maximum speed", () => {
    const flight = cruise({ x: 1, y: 0 });
    const brakingSeconds = PROTOTYPE.tuning.physics.brakingSeconds;
    let elapsed = 0;
    let slowest = Infinity;
    while (speed(flight) > 0 && elapsed < 5) {
      slowest = Math.min(slowest, speed(flight));
      stepFlight(PROTOTYPE, 1 / 60, idle, flight);
      elapsed += 1 / 60;
    }
    expect(elapsed).toBeCloseTo(brakingSeconds * Math.log(100), 1);
    expect(elapsed).toBeGreaterThan(2.45);
    expect(elapsed).toBeLessThan(2.6);
    // The last moving frame is at Ada's 2 u/s rest threshold, not a sub-pixel crawl.
    expect(slowest).toBeGreaterThanOrEqual(0.01 * maxSpeed);
    const position = { ...flight.player };
    stepFlight(PROTOTYPE, 1, idle, flight);
    expect(flight.player).toEqual(position);
  });

  it("keeps keyboard movement, including bounded diagonals, at maxSpeed", () => {
    expect(speed(cruise({ x: 1, y: 0 })) / maxSpeed).toBeCloseTo(1, 3);
    expect(speed(cruise({ x: Math.SQRT1_2, y: Math.SQRT1_2 })) / maxSpeed).toBeCloseTo(1, 3);
  });
});

describe("ship speed fraction", () => {
  it.each([
    [{ x: 0, y: 0 }, 0],
    [{ x: 48, y: 64 }, 0.5],
    [{ x: -200, y: 0 }, 1],
    [{ x: 300, y: 400 }, 1],
  ])("reports %j as %s of maxSpeed", (velocity, expected) => {
    expect(shipSpeedFraction(PROTOTYPE, { velocity })).toBeCloseTo(expected, 12);
  });

  it("is zero for a non-positive maxSpeed", () => {
    expect(
      shipSpeedFraction(
        {
          ...PROTOTYPE,
          tuning: { ...PROTOTYPE.tuning, physics: { ...PROTOTYPE.tuning.physics, maxSpeed: 0 } },
        },
        { velocity: { x: 1, y: 0 } },
      ),
    ).toBe(0);
  });

  it("scales jets by Ada's tuned top speed so they do not saturate after engine tuning", () => {
    const levels = { ...noLevels(), engine: 3 };
    // Engine level 3 raises the top speed from 200 to 220.
    expect(shipSpeedFraction(PROTOTYPE, { levels, velocity: { x: 200, y: 0 } })).toBeCloseTo(
      200 / 220,
      12,
    );
    expect(shipSpeedFraction(PROTOTYPE, { levels, velocity: { x: 220, y: 0 } })).toBeCloseTo(1, 12);
    expect(shipSpeedFraction(PROTOTYPE, { levels: noLevels(), velocity: { x: 200, y: 0 } })).toBe(
      1,
    );
  });
});

describe("shield in battle", () => {
  type EnemyChange = Partial<NonNullable<FlightState["objects"][number]["enemy"]>>;
  /** A flight with one swarm craft at `offset` from Ada, in the given state. */
  function withEnemy(offset: Vec, change: EnemyChange): FlightState {
    const flight = empty();
    const point = { x: flight.player.x + offset.x, y: flight.player.y + offset.y };
    const enemy = {
      ...createEnemy(
        enemyCatalog.swarm,
        { archetype: "swarm", id: "enemy:battle", packId: null, phase: 0 },
        point,
      ),
      engaged: true,
      ...change,
    };
    flight.objects.push({ ...point, enemy, hp: 2, id: "enemy:battle", kind: "enemy", radius: 9 });
    return flight;
  }

  it("counts an attacker inside the square, 424 from Ada on the 720-wide view", () => {
    expect(720 / 2 + PROTOTYPE.tuning.battleMargin).toBe(424);
    for (const offset of [
      { x: 424, y: 0 },
      { x: -424, y: 424 },
      { x: 0, y: -400 },
    ]) {
      expect(inBattle(PROTOTYPE, 720, withEnemy(offset, {}))).toBe(true);
    }
    for (const offset of [
      { x: 425, y: 0 },
      { x: 0, y: -425 },
    ]) {
      expect(inBattle(PROTOTYPE, 720, withEnemy(offset, {}))).toBe(false);
    }
  });

  it.each([{ engaged: false }, { fleeing: true }, { returning: true }, { disabled: true }])(
    "ignores a ship with %j",
    (change) => {
      expect(inBattle(PROTOTYPE, 720, withEnemy({ x: 100, y: 0 }, change))).toBe(false);
    },
  );

  it("holds the recharge while an attacker stays close, then waits the full delay", () => {
    const flight = withEnemy({ x: 300, y: 0 }, {});
    // The attacker's shots barely scratch, so only battle can hold the recharge.
    const harmless = structuredClone(PROTOTYPE);
    harmless.tuning.flight.playerShotDamage = 1e-9;
    flight.shield = 4;
    flight.sinceDamage = PROTOTYPE.tuning.shieldRechargeDelay;
    stepFlight(harmless, 3, idle, flight);
    expect(flight.shield).toBeCloseTo(4, 3);
    // Out of the fight, the shield waits its delay, then refills 10 HP over 60 seconds.
    flight.objects = [];
    flight.shots = [];
    stepFlight(harmless, PROTOTYPE.tuning.shieldRechargeDelay - 0.1, idle, flight);
    expect(flight.shield).toBeCloseTo(4, 3);
    stepFlight(harmless, 0.1 + 6, idle, flight);
    expect(flight.shield).toBeCloseTo(4 + (10 / 60) * 6, 1);
  });
});
