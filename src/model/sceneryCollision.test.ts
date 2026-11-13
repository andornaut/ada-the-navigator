import { describe, expect, it } from "vitest";

import { CONTENT } from "../data/content.ts";
import { ECONOMY } from "../data/economy.ts";
import type { GameContent } from "../data/types.ts";
import { ASTEROID_SHAPES } from "./asteroids.ts";
import { dropRandom, rollRockAmmoDrop } from "./drops.ts";
import { createFlight, stepFlight } from "./flight.ts";
import type { FlightEvent, FlightState, SpaceObject } from "./types.ts";

const idle = { aim: { x: 0, y: 0 }, move: { x: 0, y: 0 }, use: false };
const shape = [...ASTEROID_SHAPES.values()].find(({ size }) => size === "medium")!;
function fixture(kind: "rock" | "resource" | "debris" = "rock", hp = 3, content = CONTENT) {
  const flight = createFlight(content, 1, 7, { known: [] });
  const obstacle: SpaceObject = {
    ...(kind === "debris" ? {} : { asteroid: shape.id }),
    hp,
    id: "collision-target",
    kind,
    persistent: true,
    radius: shape.radius,
    ...(kind === "resource" ? { resource: "medium" as const } : {}),
    x: 100,
    y: 100,
  };
  flight.objects = [obstacle];
  flight.shots = [];
  flight.cargo = 0;
  return { flight, obstacle };
}
function impact(content: GameContent, flight: FlightState, obstacle: SpaceObject, dt = 1 / 60) {
  flight.player = { x: obstacle.x, y: obstacle.y };
  flight.velocity = { x: 0, y: 0 };
  return stepFlight(content, dt, idle, flight);
}
function payload(flight: FlightState, events: readonly FlightEvent[]) {
  const live = flight.objects.filter(({ hp }) => hp > 0);
  return {
    ammo:
      live.filter(({ ammoPack }) => ammoPack).length +
      events.filter(({ type }) => type === "ammoCollected").length,
    ore: flight.cargo + live.filter(({ role }) => role === "cargo").length,
    stardust:
      live.reduce(
        (sum, object) => sum + (object.role === "stardust" ? (object.amount ?? 0) : 0),
        0,
      ) + events.reduce((sum, event) => sum + (event.type === "stardust" ? event.amount : 0), 0),
  };
}
function shotAt(obstacle: SpaceObject) {
  return {
    damage: 1,
    enemy: false,
    hitIds: [],
    id: "laser-shot",
    life: 1,
    piercing: false,
    velocity: { x: 0, y: 0 },
    x: obstacle.x,
    y: obstacle.y,
  };
}

describe("scenery collision damage", () => {
  it("damages Ada and the struck obstacle once per admitted half-second impact", () => {
    const { flight, obstacle } = fixture();
    const events = impact(CONTENT, flight, obstacle);
    expect(flight.shield).toBe(9);
    expect(obstacle.hp).toBe(2);
    expect(flight.sinceDamage).toBe(0);
    const first = flight.lastBump!;
    events.push(...impact(CONTENT, flight, obstacle, 0.1));
    expect(flight.lastBump).toBe(first);
    expect(flight.shield).toBe(9);
    expect(obstacle.hp).toBe(2);
    for (const hp of [1, 0]) {
      flight.time = flight.lastBump! + 0.5 - 0.01;
      events.push(...impact(CONTENT, flight, obstacle, 0.01));
      expect(obstacle.hp).toBe(hp);
    }
    expect(flight.shield).toBe(7);
    expect(flight.objects).not.toContain(obstacle);
    expect(flight.world.notables[obstacle.id]).toBeNull();
    expect(
      events.filter((event) => event.type === "asteroidDestroyed" && event.id === obstacle.id),
    ).toHaveLength(1);
    const once = payload(flight, events);
    events.push(...stepFlight(CONTENT, 0.2, idle, flight));
    expect(payload(flight, events)).toEqual(once);
    expect(
      events.filter((event) => event.type === "asteroidDestroyed" && event.id === obstacle.id),
    ).toHaveLength(1);
  });

  it("uses one basic Laser hit rather than the equipped weapon or its upgraded damage", () => {
    const content = {
      ...CONTENT,
      tuning: { ...CONTENT.tuning, flight: { ...CONTENT.tuning.flight, playerShotDamage: 2 } },
    };
    const { flight, obstacle } = fixture("rock", 5, content);
    flight.weapon = "heavyMissile";
    flight.levels.weapons.laser = 3;
    flight.levels.weapons.heavyMissile = 3;
    impact(content, flight, obstacle);
    expect(flight.shield).toBe(8);
    expect(obstacle.hp).toBe(3);
  });

  it("damages only one struck object when several obstacles overlap in one step", () => {
    const { flight, obstacle } = fixture("rock", 1);
    const other = { ...obstacle, id: "other", x: obstacle.x + 1 };
    flight.objects.push(other);
    const events = impact(CONTENT, flight, obstacle);
    expect([obstacle.hp, other.hp].sort()).toEqual([0, 1]);
    expect(flight.shield).toBe(9);
    expect(events.filter(({ type }) => type === "asteroidDestroyed")).toHaveLength(1);
    expect(flight.objects.filter(({ kind }) => kind === "rock")).toHaveLength(1);
  });

  it.each([false, true])(
    "releases the existing seeded rock drops once (same-frame Laser: %s)",
    (sameFrameShot) => {
      const collision = fixture("rock", 1);
      const laser = fixture("rock", 1);
      // Select an existing deterministic ammo-drop outcome so the shared drop path is exercised.
      let id = "";
      for (let index = 0; index < 5000; index++) {
        const candidate = `ammo-rock:${index}`;
        if (rollRockAmmoDrop(ECONOMY, ["multiLaser"], dropRandom(7, `ammo:${candidate}`))) {
          id = candidate;
          break;
        }
      }
      expect(id).not.toBe("");
      for (const entry of [collision, laser]) {
        entry.obstacle.id = id;
        entry.flight.ownedWeapons = ["multiLaser"];
      }
      if (sameFrameShot) {
        collision.flight.shots = [shotAt(collision.obstacle)];
      }
      const collided = impact(CONTENT, collision.flight, collision.obstacle);
      laser.flight.shots = [shotAt(laser.obstacle)];
      const shot = stepFlight(CONTENT, 1 / 60, idle, laser.flight);
      expect(payload(collision.flight, collided)).toEqual(payload(laser.flight, shot));
      expect(payload(collision.flight, collided).ammo).toBe(1);
      const loot = payload(collision.flight, collided);
      expect(loot.ore + loot.stardust).toBeGreaterThanOrEqual(1);
      expect(loot.ore + loot.stardust).toBeLessThanOrEqual(5);
      expect(collided.filter(({ type }) => type === "asteroidDestroyed")).toHaveLength(1);
      expect(collision.flight.objects).not.toContain(collision.obstacle);
    },
  );

  it("releases resource cargo once and resolves the obstacle even when the same impact depletes Ada", () => {
    const { flight, obstacle } = fixture("resource", 1);
    flight.shield = 1;
    const events = impact(CONTENT, flight, obstacle);
    expect(flight.shield).toBe(0);
    expect(obstacle.hp).toBe(0);
    const loot = payload(flight, events);
    expect(loot.ore + loot.stardust).toBeGreaterThanOrEqual(1);
    expect(loot.ore + loot.stardust).toBeLessThanOrEqual(5);
    expect(events.filter(({ type }) => type === "depleted")).toHaveLength(1);
    expect(events.filter(({ type }) => type === "asteroidDestroyed")).toEqual([
      expect.objectContaining({ id: obstacle.id, resource: true }),
    ]);
    const once = payload(flight, events);
    expect(stepFlight(CONTENT, 1, idle, flight)).toEqual([]);
    expect(payload(flight, events)).toEqual(once);
  });

  it("clears struck moving debris through its existing destruction event once", () => {
    const { flight, obstacle } = fixture("debris", 1);
    obstacle.velocity = { x: -100, y: 0 };
    const events = impact(CONTENT, flight, obstacle);
    expect(flight.shield).toBe(9);
    expect(obstacle.hp).toBe(0);
    expect(events.filter(({ type }) => type === "debrisCleared")).toEqual([
      { id: obstacle.id, type: "debrisCleared" },
    ]);
    expect(flight.objects).not.toContain(obstacle);
  });

  it.each(["station", "destination"] as const)("does not damage protected %s contacts", (kind) => {
    const { flight, obstacle } = fixture();
    obstacle.kind = kind;
    obstacle.role = "whale";
    impact(CONTENT, flight, obstacle);
    expect(flight.shield).toBe(10);
    expect(obstacle.hp).toBe(3);
  });

  it("does not make indestructible scenery destructible", () => {
    const { flight, obstacle } = fixture("rock", Infinity);
    impact(CONTENT, flight, obstacle);
    expect(flight.shield).toBe(9);
    expect(obstacle.hp).toBe(Infinity);
    expect(flight.objects).toContain(obstacle);
  });
});
