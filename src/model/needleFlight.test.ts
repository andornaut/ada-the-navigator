import { describe, expect, it } from "vitest";

import { CONTENT } from "../data/content.ts";
import { enemyCatalog, enemyDefinition } from "../data/enemyCatalog.ts";
import { NEEDLE } from "../data/needle.ts";
import { createEnemy } from "./enemyAi.ts";
import { createFlight, stepFlight } from "./flight.ts";
import { activeNeedleCourses, inNeedleChannel, needleCourses, needleDebris } from "./needle.ts";
import { newProgress } from "./progress.ts";
import type { FlightInput, SpaceObject, Vec } from "./types.ts";

const idle: FlightInput = { aim: { x: 0, y: 0 }, move: { x: 0, y: 0 }, use: false };

function courseFlight(seed = 417) {
  const flight = createFlight(CONTENT, 4, seed, newProgress());
  flight.needle = { anchor: { x: 0, y: 0 }, chatter: [], exitPackPlaced: true };
  flight.objects = [];
  const course = needleCourses(flight)!.practice;
  const gate = course.gates[0]!;
  flight.facing = { ...gate.tangent };
  return { course, flight, gate };
}

const offset = (point: Vec, direction: Vec, distance: number): Vec => ({
  x: point.x + direction.x * distance,
  y: point.y + direction.y * distance,
});

describe("mounted Needle flight physics", () => {
  it("recoils Ada's actual hull out of a gate rim without shield damage", () => {
    const { flight, gate } = courseFlight();
    const lateral = { x: -gate.tangent.y, y: gate.tangent.x };
    flight.player = offset(
      gate.point,
      lateral,
      (NEEDLE.gate.rim.inner + NEEDLE.gate.rim.outer) / 2,
    );
    const before = { ...flight.player };
    const shield = flight.shield;
    stepFlight(CONTENT, 0.001, idle, flight);
    expect(Math.hypot(flight.player.x - before.x, flight.player.y - before.y)).toBeGreaterThan(0);
    expect(flight.shield).toBe(shield);
  });

  it("allows the real ship through the center opening without treating the hoop as a solid obstacle", () => {
    const { flight, gate } = courseFlight();
    flight.player = offset(gate.point, gate.tangent, -0.01);
    flight.velocity = { x: gate.tangent.x * 20, y: gate.tangent.y * 20 };
    const shield = flight.shield;
    stepFlight(CONTENT, 0.01, { ...idle, move: gate.tangent, throttle: 0.1 }, flight);
    const along =
      (flight.player.x - gate.point.x) * gate.tangent.x +
      (flight.player.y - gate.point.y) * gate.tangent.y;
    expect(along).toBeGreaterThan(0);
    expect(flight.shield).toBe(shield);
  });

  it("excludes hostile bolts from the protected channel while retaining Ada's own bolt", () => {
    const { flight, gate } = courseFlight();
    flight.player = { ...gate.point };
    flight.shots = [true, false].map((enemy) => ({
      ...gate.point,
      damage: 1,
      enemy,
      hitIds: [],
      id: enemy ? "hostile-channel-bolt" : "friendly-channel-bolt",
      life: 1,
      piercing: false,
      velocity: { x: 0, y: 0 },
    }));
    const shield = flight.shield;
    stepFlight(CONTENT, 0.001, idle, flight);
    expect(flight.shield).toBe(shield);
    expect(flight.shots.some(({ id }) => id === "hostile-channel-bolt")).toBe(false);
    expect(flight.shots.some(({ id }) => id === "friendly-channel-bolt")).toBe(true);
  });

  it("keeps each freshly admitted enemy's complete radius outside every active channel", () => {
    let enemies = 0;
    for (const seed of [1, 2, 3, 4, 42, 417]) {
      const { flight, gate } = courseFlight(seed);
      flight.player = { ...gate.point };
      stepFlight(CONTENT, 0.001, idle, flight);
      for (const object of flight.objects.filter(({ kind }) => kind === "enemy")) {
        enemies++;
        expect(
          activeNeedleCourses(flight).some((course) =>
            inNeedleChannel({ radius: object.radius }, course, object),
          ),
          `${seed}:${object.id}`,
        ).toBe(false);
      }
    }
    expect(enemies).toBeGreaterThan(0);
  });

  it("blocks a retained enemy's attempted movement into the channel without deleting it", () => {
    const { course, flight, gate } = courseFlight();
    const lateral = { x: -gate.tangent.y, y: gate.tangent.x };
    const radius = enemyCatalog.swarm.sizeRatio * CONTENT.tuning.flight.shipRadius;
    const point = offset(gate.point, lateral, course.width / 2 + radius + 0.1);
    const enemy = createEnemy(
      enemyDefinition(4, "swarm"),
      { archetype: "swarm", id: "channel-outsider", packId: null, phase: 0 },
      point,
    );
    enemy.velocity = { x: -lateral.x * 200, y: -lateral.y * 200 };
    const object: SpaceObject = {
      ...point,
      enemy,
      hp: enemy.hp,
      id: enemy.id,
      kind: "enemy",
      radius,
    };
    flight.player = { ...gate.point };
    flight.objects = [object];
    expect(inNeedleChannel({ radius }, course, object)).toBe(false);
    stepFlight(CONTENT, 0.05, idle, flight);
    expect(flight.objects).toContain(object);
    expect(inNeedleChannel({ radius }, course, object)).toBe(false);
  });

  it("moves canonical seeded debris and records an actual bolt clear only once", () => {
    const { course, flight } = courseFlight();
    const descriptor = needleDebris(course, flight.seed)[0]!;
    flight.player = { x: descriptor.x + 500, y: descriptor.y };
    stepFlight(CONTENT, 0.01, idle, flight);
    const object = flight.objects.find(({ id }) => id === descriptor.id)!;
    expect(object).toBeDefined();
    expect(object).toMatchObject({
      hp: CONTENT.tuning.flight.rockHp,
      kind: "debris",
      persistent: true,
      radius: descriptor.radius,
      velocity: descriptor.velocity,
    });
    expect(Math.hypot(object.x - descriptor.x, object.y - descriptor.y)).toBeGreaterThan(0);
    flight.shots = [
      {
        damage: object.hp,
        enemy: false,
        hitIds: [],
        id: "clear-canonical-chip",
        life: 1,
        piercing: false,
        velocity: { x: 0, y: 0 },
        x: object.x,
        y: object.y,
      },
    ];
    const events = stepFlight(CONTENT, 0.001, idle, flight);
    expect(events).toContainEqual({ id: descriptor.id, type: "debrisCleared" });
    expect(flight.objects.some(({ id }) => id === descriptor.id)).toBe(false);
    expect(flight.world.notables[descriptor.id]).toBeNull();
    const next = stepFlight(CONTENT, 0.001, idle, flight);
    expect(flight.objects.some(({ id }) => id === descriptor.id)).toBe(false);
    expect(next).not.toContainEqual({ id: descriptor.id, type: "debrisCleared" });
  });
});
