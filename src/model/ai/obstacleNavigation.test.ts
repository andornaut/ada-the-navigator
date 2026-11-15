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
    const request = avoidObstacles(
      definition.physics,
      query,
      definition.physics.maxSpeed,
      state,
      direction({ x: 800 - state.position.x, y: -state.position.y }),
    );
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
