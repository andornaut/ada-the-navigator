import { expect, it, vi } from "vitest";

import { CONTENT } from "../data/content.ts";
import { enemyDefinition } from "../data/enemyCatalog.ts";
import * as ai from "./ai/index.ts";
import { toScreen } from "./convex.ts";
import { activeEnemyBeams, createUnpopulatedFlight, stepFlight } from "./flight/index.ts";
import { playerWeaponCoverage } from "./playerWeaponCoverage.ts";
import type { FlightInput, SpaceObject, Vec } from "./types.ts";

const idle: FlightInput = { aim: { x: 0, y: 0 }, fire: false, move: { x: 0, y: 0 }, use: false };
function fixture(archetype: "swarm" | "interceptor") {
  const flight = createUnpopulatedFlight(CONTENT, 1, 173);
  const point = { x: archetype === "interceptor" ? 220 : 300, y: 0 };
  const definition = enemyDefinition(flight.galaxy, archetype, "launch-parity", 1);
  const enemy = ai.createEnemy(
    definition,
    { archetype, id: "launch-parity", packId: null, phase: 0, weaponLevel: 1 },
    point,
  );
  enemy.velocity = { x: 37, y: -19 };
  // The nose gun fires along the facing, so the nose starts on Ada at the origin.
  enemy.facing = { x: -1, y: 0 };
  const object: SpaceObject = {
    ...point,
    enemy,
    hp: definition.hp,
    id: enemy.id,
    kind: "enemy",
    radius: definition.sizeRatio * CONTENT.tuning.flight.shipRadius,
  };
  flight.objects = [object];
  flight.freshChunk = null;
  return { flight, object, point };
}

it("snapshots firing hull velocity before movement and preserves the delayed shot's independent future", () => {
  const { flight, object, point } = fixture("swarm");
  const dt = 1 / 60;
  object.enemy!.primaryCooldown = 0.012;
  flight.velocity = { x: -101, y: 63 };
  const original = ai.stepEnemy;
  const launches: { fire: ai.FireIntent[]; velocity: Vec }[] = [];
  const observe = vi.spyOn(ai, "stepEnemy").mockImplementation((...args) => {
    const next = original(...args);
    launches.push(structuredClone({ fire: next.fire, velocity: next.velocity }));
    return next;
  });
  try {
    const viewport = { viewportHeight: 300, viewportWidth: 630 };
    stepFlight(CONTENT, dt, { ...idle, ...viewport }, flight);
    const frame = launches.find((frame) => frame.fire.length)!;
    expect(frame).toBeDefined();
    expect(frame.fire).toHaveLength(1);
    const fire = frame.fire[0]!;
    const shot = flight.shots.find((shot) => shot.enemy)!;
    expect(shot).toBeDefined();
    expect(shot.velocity).toEqual({
      x: fire.aim.x * fire.speed + frame.velocity.x,
      y: fire.aim.y * fire.speed + frame.velocity.y,
    });
    const elapsed = dt - fire.delay;
    expect(shot.x).toBeCloseTo(fire.origin.x + shot.velocity.x * elapsed, 10);
    expect(shot.y).toBeCloseTo(fire.origin.y + shot.velocity.y * elapsed, 10);
    const range = playerWeaponCoverage(
      { ...viewport, centre: point },
      { direction: fire.aim, origin: fire.origin },
    );
    expect(shot.life).toBeCloseTo(range / fire.speed - elapsed, 10);
    const relativeEnd = toScreen({ x: fire.aim.x * range, y: fire.aim.y * range });
    expect(Math.hypot(relativeEnd.x, relativeEnd.y)).toBeGreaterThan(0);
    const before = structuredClone(shot);
    object.enemy!.primaryCooldown = 999;
    object.enemy!.velocity = { x: -53, y: 79 };
    flight.velocity = { x: 9, y: -87 };
    stepFlight(CONTENT, dt, { ...idle, ...viewport }, flight);
    expect(flight.shots).toContain(shot);
    expect(shot.velocity).toEqual(before.velocity);
    expect(shot.x).toBeCloseTo(before.x + before.velocity.x * dt, 10);
    expect(shot.y).toBeCloseTo(before.y + before.velocity.y * dt, 10);
    expect(shot.life).toBeCloseTo(before.life - dt, 10);
  } finally {
    observe.mockRestore();
  }
});

it("snapshots a real interceptor Phaser's rounded range without adding hull velocity or changing its tell", () => {
  const { flight, object, point } = fixture("interceptor");
  object.enemy!.primaryCooldown = 0;
  const viewport = { viewportHeight: 300, viewportWidth: 630 };
  stepFlight(CONTENT, 0.001, { ...idle, ...viewport }, flight);
  const beam = activeEnemyBeams(flight)[0]!;
  expect(beam).toBeDefined();
  expect(beam.kind).toBe("phaser");
  expect(beam.fired).toBe(false);
  expect(flight.shots).toHaveLength(0);
  expect(beam.range).toBeCloseTo(
    playerWeaponCoverage(
      { ...viewport, centre: point },
      { direction: beam.direction, origin: beam.muzzle },
    ),
    10,
  );
  const captured = {
    direction: { ...beam.direction },
    muzzle: { ...beam.muzzle },
    range: beam.range,
  };
  object.enemy!.primaryCooldown = 999;
  object.enemy!.velocity = { x: -72, y: 81 };
  stepFlight(CONTENT, 0.05, { ...idle, ...viewport }, flight);
  expect(beam.fired).toBe(false);
  expect(beam.direction).toEqual(captured.direction);
  expect(beam.muzzle).toEqual(captured.muzzle);
  expect(beam.range).toBe(captured.range);
});
