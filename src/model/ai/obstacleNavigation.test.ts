import { expect, it } from "vitest";

import { CONTENT } from "../../data/content.ts";
import { enemyCatalog } from "../../data/enemyCatalog.ts";
import { ENEMY_AVOIDANCE } from "../../data/enemyNavigation.ts";
import { SHARED_SHIP_PHYSICS } from "../../data/shipPhysics.ts";
import { actualGap } from "../../testing/aiGeometry.ts";
import { ASTEROID_SHAPES, scenerySilhouette, worldSceneryBodyContact } from "../asteroids.ts";
import { createEnemy } from "../enemyAi.ts";
import { enemyHull } from "../enemyBody.ts";
import { direction, stepShipMotion, turnToward } from "../shipPhysics.ts";
import type { SpaceObject } from "../types.ts";
import { avoidObstacles } from "./obstacleNavigation.ts";
import { worldNavigationQuery } from "./worldNavigation.ts";

it("steers the released navigation core past an authored asteroid using current hull physics", () => {
  const shape = [...ASTEROID_SHAPES.values()].find((s) => s.size === "large")!;
  const rock: SpaceObject = {
    asteroid: shape.id,
    hp: 10,
    id: "navigation-rock",
    kind: "rock",
    radius: shape.radius,
    x: 0,
    y: 0,
  };
  const definition = enemyCatalog.frigate;
  const radius = CONTENT.tuning.flight.shipRadius * definition.sizeRatio;
  let state = createEnemy(
    definition,
    { archetype: "frigate", id: "navigation-guard", packId: null, phase: 0.4 },
    { x: -800, y: 0 },
  );
  state.facing = { x: 1, y: 0 };
  const dt = 1 / 60;
  let closest = Infinity;
  for (let step = 0; state.position.x < 500 && step < 2400; step++) {
    const query = worldNavigationQuery(
      { drawnOf: scenerySilhouette, frameOf: () => 0 },
      [rock],
      definition,
      { ...state, radius },
    );
    const direct = direction({ x: 800 - state.position.x, y: -state.position.y });
    const request = query
      ? avoidObstacles(definition.physics, query, dt, definition.physics.maxSpeed, state, direct)
      : direct;
    const motion = stepShipMotion(
      definition.physics,
      dt,
      { maxSpeed: definition.physics.maxSpeed, restHeading: state.facing },
      { direction: request, speed: definition.physics.maxSpeed * Math.hypot(request.x, request.y) },
      { heading: state.heading, velocity: state.velocity },
    );
    state = {
      ...state,
      facing: turnToward(dt, SHARED_SHIP_PHYSICS.hullTurnSeconds, motion.velocity, state.facing),
      heading: motion.heading,
      position: {
        x: state.position.x + motion.velocity.x * dt,
        y: state.position.y + motion.velocity.y * dt,
      },
      velocity: motion.velocity,
    };
    expect(worldSceneryBodyContact({}, rock, state.position, enemyHull(state)!, 0)).toBeNull();
    closest = Math.min(closest, actualGap(rock, state.position, state.facing));
  }
  expect(state.position.x).toBeGreaterThan(500);
  expect(closest).toBeGreaterThanOrEqual(ENEMY_AVOIDANCE.clearance);
  expect(rock.radius).toBe(shape.radius);
});

it("keeps navigation absent when no obstacle reaches the canonical prediction range", () => {
  const definition = enemyCatalog.frigate;
  const enemy = createEnemy(
    definition,
    { archetype: "frigate", id: "empty-navigation", packId: null, phase: 0 },
    { x: 0, y: 0 },
  );
  expect(
    worldNavigationQuery({ drawnOf: scenerySilhouette, frameOf: () => 0 }, [], definition, {
      ...enemy,
      radius: CONTENT.tuning.flight.shipRadius * definition.sizeRatio,
    }),
  ).toBeUndefined();
});

it("bounds tiny-step prediction while checking the exact first runtime pose", () => {
  const definition = enemyCatalog.frigate;
  const state = createEnemy(
    definition,
    { archetype: "frigate", id: "tiny-step", packId: null, phase: 0.4 },
    { x: 0, y: 0 },
  );
  state.facing = { x: 1, y: 0 };
  state.velocity = { x: 30, y: 0 };
  const dt = 0.000001;
  const poses: { facing: { x: number; y: number }; position: { x: number; y: number } }[] = [];
  const query = {
    clear(pose: (typeof poses)[number]) {
      poses.push(pose);
      return true;
    },
    escape() {
      return null;
    },
  };
  const request = avoidObstacles(
    definition.physics,
    query,
    dt,
    definition.physics.maxSpeed,
    state,
    { x: 1, y: 0 },
  );
  const motion = stepShipMotion(
    definition.physics,
    dt,
    { maxSpeed: definition.physics.maxSpeed, restHeading: state.facing },
    { direction: { x: 1, y: 0 }, speed: definition.physics.maxSpeed },
    { heading: state.heading, velocity: state.velocity },
  );
  const first = poses.find((pose) => pose.position.x !== 0)!;
  expect(first.position).toEqual({ x: motion.velocity.x * dt, y: motion.velocity.y * dt });
  expect(first.facing).toEqual(
    turnToward(dt, SHARED_SHIP_PHYSICS.hullTurnSeconds, motion.velocity, state.facing),
  );
  expect(request).toEqual({ x: 1, y: 0 });
  expect(poses.length).toBeLessThan(500);
  let blockedQueries = 0;
  expect(
    avoidObstacles(
      definition.physics,
      {
        clear(pose) {
          blockedQueries++;
          return pose.position.x <= 0;
        },
        escape() {
          return null;
        },
      },
      dt,
      definition.physics.maxSpeed,
      state,
      { x: 1, y: 0 },
    ),
  ).toEqual({ x: 0, y: 0 });
  expect(blockedQueries).toBeLessThan(100);
});

interface Pass {
  readonly closest: number;
  readonly hit: boolean;
  readonly swerved: boolean;
  readonly track: readonly { readonly x: number; readonly y: number }[];
}

/**
 * A frigate flies east from (-800, 0) for 16 s while a large moving rock travels at its velocity.
 * Without prediction the query sees the rock as stationary wherever it is each step.
 */
function passMovingRock(
  prediction: boolean,
  speed: number,
  rock: { readonly velocity: { x: number; y: number }; readonly x: number; readonly y: number },
): Pass {
  const shape = [...ASTEROID_SHAPES.values()].find((s) => s.size === "large")!;
  const definition = enemyCatalog.frigate;
  const radius = CONTENT.tuning.flight.shipRadius * definition.sizeRatio;
  let state = createEnemy(
    definition,
    { archetype: "frigate", id: "moving-rock-pass", packId: null, phase: 0.4 },
    { x: -800, y: 0 },
  );
  state = {
    ...state,
    facing: { x: 1, y: 0 },
    heading: { x: 1, y: 0 },
    velocity: { x: speed, y: 0 },
  };
  const dt = 1 / 60;
  let closest = Infinity;
  let hit = false;
  let swerved = false;
  const track = [];
  for (let step = 0; step < 960; step++) {
    const time = step * dt;
    const at = { x: rock.x + rock.velocity.x * time, y: rock.y + rock.velocity.y * time };
    const object: SpaceObject = {
      asteroid: shape.id,
      hp: 10,
      id: "moving:pass",
      kind: "debris",
      radius: shape.radius,
      ...at,
      ...(prediction ? { velocity: rock.velocity } : {}),
    };
    const query = worldNavigationQuery(
      { drawnOf: scenerySilhouette, frameOf: () => 0 },
      [object],
      definition,
      { ...state, radius },
    );
    const direct = direction({ x: 4000 - state.position.x, y: -state.position.y });
    const request = query
      ? avoidObstacles(definition.physics, query, dt, speed, state, direct)
      : direct;
    swerved ||= Math.abs(request.x - direct.x) > 1e-9 || Math.abs(request.y - direct.y) > 1e-9;
    const motion = stepShipMotion(
      definition.physics,
      dt,
      { maxSpeed: definition.physics.maxSpeed, restHeading: state.facing },
      { direction: request, speed: speed * Math.hypot(request.x, request.y) },
      { heading: state.heading, velocity: state.velocity },
    );
    state = {
      ...state,
      facing: turnToward(dt, SHARED_SHIP_PHYSICS.hullTurnSeconds, motion.velocity, state.facing),
      heading: motion.heading,
      position: {
        x: state.position.x + motion.velocity.x * dt,
        y: state.position.y + motion.velocity.y * dt,
      },
      velocity: motion.velocity,
    };
    const moved = { ...object, x: at.x + rock.velocity.x * dt, y: at.y + rock.velocity.y * dt };
    hit ||= worldSceneryBodyContact({}, moved, state.position, enemyHull(state)!, 0) !== null;
    closest = Math.min(closest, actualGap(moved, state.position, state.facing));
    track.push(state.position);
  }
  return { closest, hit, swerved, track };
}

it("clears a rock crossing its path only when it predicts the rock's motion", () => {
  const speed = enemyCatalog.frigate.physics.maxSpeed;
  // Timed to reach the frigate's line as the frigate reaches x = 0.
  const rock = { velocity: { x: 0, y: 60 }, x: 0, y: -480 };
  const stationary = passMovingRock(false, speed, rock);
  const predicted = passMovingRock(true, speed, rock);
  expect(stationary.hit).toBe(true);
  expect(predicted.hit).toBe(false);
  expect(predicted.closest).toBeGreaterThanOrEqual(ENEMY_AVOIDANCE.passageClearance);
  expect(predicted.track.at(-1)!.x).toBeGreaterThan(500);
});

it("clears a rock flying head-on down its path", () => {
  const speed = enemyCatalog.frigate.physics.maxSpeed;
  const rock = { velocity: { x: -70, y: 0 }, x: 600, y: 0 };
  const stationary = passMovingRock(false, speed, rock);
  const predicted = passMovingRock(true, speed, rock);
  expect(stationary.closest).toBeLessThan(ENEMY_AVOIDANCE.passageClearance);
  expect(predicted.hit).toBe(false);
  expect(predicted.closest).toBeGreaterThanOrEqual(ENEMY_AVOIDANCE.passageClearance);
  expect(predicted.track.at(-1)!.x).toBeGreaterThan(500);
});

it.each([
  ["leaving its path", { velocity: { x: 0, y: 80 }, x: -450, y: 0 }],
  ["receding ahead of it", { velocity: { x: 60, y: 0 }, x: -450, y: 0 }],
])("holds course past a rock %s, where a stationary reading swerves", (_, rock) => {
  const speed = enemyCatalog.frigate.physics.maxSpeed * 0.5;
  const stationary = passMovingRock(false, speed, rock);
  const predicted = passMovingRock(true, speed, rock);
  expect(stationary.swerved).toBe(true);
  expect(predicted.swerved).toBe(false);
  expect(predicted.hit).toBe(false);
});

it("predicts the same detour for the same state", () => {
  const speed = enemyCatalog.frigate.physics.maxSpeed;
  const rock = { velocity: { x: 0, y: 60 }, x: 0, y: -480 };
  const first = passMovingRock(true, speed, rock);
  expect(passMovingRock(true, speed, JSON.parse(JSON.stringify(rock)) as typeof rock)).toEqual(
    first,
  );
  expect(first.swerved).toBe(true);
});
