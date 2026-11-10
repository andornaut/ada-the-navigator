import { describe, expect, it } from "vitest";

import { PROTOTYPE } from "../data/prototype.ts";
import {
  createFlight,
  ensureDestination,
  placeDestinationAhead,
  stepFlight,
  teleport,
} from "./flight.ts";
import type { FlightInput, FlightState, SectorProgress } from "./types.ts";

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
const idle: FlightInput = { aim: { x: 0, y: 0 }, move: { x: 0, y: 0 }, use: false };
function empty(): FlightState {
  const flight = createFlight(PROTOTYPE, 1, 1234, progress);
  flight.objects = [];
  return flight;
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
    expect(flight.freshDistance).toBeGreaterThan(PROTOTYPE.tuning.maxSpeed * 0.7);
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

  it("keeps movement independent of aim, fires only while aiming and falls back on empty ammo", () => {
    const flight = empty();
    flight.player = { x: 100, y: 100 };
    stepFlight(PROTOTYPE, 0.1, { ...idle, move: { x: 1, y: 0 } }, flight);
    expect(flight.shots).toHaveLength(0);
    expect(flight.facing).toEqual({ x: 1, y: 0 });
    flight.weapon = "spread";
    flight.ammo = 1;
    stepFlight(PROTOTYPE, 0.01, { ...idle, aim: { x: 0, y: -1 } }, flight);
    expect(flight.shots).toHaveLength(3);
    expect(flight.weapon).toBe("basic");
    expect(flight.facing).toEqual({ x: 0, y: -1 });
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
      enemy: true,
      hitIds: [],
      id: `hit${n}`,
      life: 1,
      piercing: false,
      velocity: { x: 0, y: 0 },
    }));
    stepFlight(PROTOTYPE, 0.01, idle, flight);
    expect(flight.shield).toBe(PROTOTYPE.tuning.shieldMax - 2 * PROTOTYPE.tuning.enemyDamage);
    flight.objects = [];
    stepFlight(PROTOTYPE, PROTOTYPE.tuning.shieldRechargeDelay + 1, idle, flight);
    expect(flight.shield).toBeGreaterThan(
      PROTOTYPE.tuning.shieldMax - 2 * PROTOTYPE.tuning.enemyDamage,
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

  it("caps cargo and matching ammunition while replacing different upgrades", () => {
    const flight = empty();
    const pickup = (id: string) => ({
      ...flight.player,
      hp: 1,
      id,
      kind: "pickup" as const,
      radius: 10,
    });
    flight.cargo = PROTOTYPE.tuning.cargoCapacity;
    flight.weapon = "rapid";
    flight.ammo = PROTOTYPE.tuning.weaponAmmo.rapid * 2 - 1;
    flight.objects.push(
      { ...pickup("cargo"), role: "cargo" },
      { ...pickup("rapid"), weapon: "rapid" },
    );
    stepFlight(PROTOTYPE, 0.01, idle, flight);
    expect(flight.cargo).toBe(PROTOTYPE.tuning.cargoCapacity);
    expect(flight.objects.some((o) => o.id === "cargo")).toBe(true);
    expect(flight.ammo).toBe(PROTOTYPE.tuning.weaponAmmo.rapid * 2);
    flight.objects.push({ ...pickup("pierce"), weapon: "pierce" });
    stepFlight(PROTOTYPE, 0.01, idle, flight);
    expect(flight.weapon).toBe("pierce");
    expect(flight.ammo).toBe(PROTOTYPE.tuning.weaponAmmo.pierce);
  });
  it("distinguishes pursuit, ranged fire and a stationary contact guard", () => {
    const flight = empty();
    flight.player = { x: 100, y: 100 };
    flight.objects = ["pursue", "shoot", "guard"].map((behavior, i) => ({
      behavior: behavior as "pursue" | "shoot" | "guard",
      cooldown: 0,
      hp: 10,
      id: behavior,
      kind: "enemy",
      radius: 14,
      x: 200,
      y: 90 + i * 10,
    }));
    stepFlight(PROTOTYPE, 0.1, idle, flight);
    expect(flight.objects.find((o) => o.id === "pursue")?.x).toBeLessThan(200);
    expect(flight.objects.find((o) => o.id === "guard")?.x).toBe(200);
    expect(flight.shots.filter((s) => s.enemy)).toHaveLength(1);
    expect(flight.dangerFor).toBeGreaterThan(0);
  });

  it("pierces debris and disables ships, while destroyed resource rocks release cargo pieces", () => {
    const flight = empty();
    flight.player = { x: 100, y: 100 };
    flight.objects = [
      { hp: 1, id: "debris", kind: "debris", radius: 10, x: 130, y: 100 },
      { behavior: "guard", hp: 1, id: "enemy", kind: "enemy", radius: 10, x: 160, y: 100 },
      { hp: 1, id: "resource", kind: "resource", radius: 10, x: 190, y: 100 },
    ];
    flight.weapon = "pierce";
    flight.ammo = 1;
    const events = stepFlight(PROTOTYPE, 0.2, { ...idle, aim: { x: 1, y: 0 } }, flight);
    expect(events).toContainEqual({ id: "debris", type: "debrisCleared" });
    expect(events).toContainEqual({ type: "enemyDisabled" });
    expect(flight.objects.filter((o) => o.role === "cargo")).toHaveLength(
      PROTOTYPE.tuning.flight.piecesPerRock,
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
  stepFlight(PROTOTYPE, 4, idle, flight);
  const position = { ...flight.player };
  const explored = flight.freshDistance;
  stepFlight(PROTOTYPE, 1, idle, flight);
  expect(flight.player).toEqual(position);
  expect(flight.freshDistance).toBe(explored);
});
