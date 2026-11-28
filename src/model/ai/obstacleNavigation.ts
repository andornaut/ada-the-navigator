import type { Point } from "../../data/enemyCatalog.ts";
import { ENEMY_AVOIDANCE } from "../../data/enemyNavigation.ts";
import { SHARED_SHIP_PHYSICS, type ShipPhysics } from "../../data/shipPhysics.ts";
import { direction, stepShipMotion, turnToward } from "../shipPhysics.ts";
import { magnitude, rotate } from "./course.ts";
import type { EnemyState } from "./enemyAi.ts";
import type { NavigationQuery } from "./navigationQuery.ts";
import { navigationHorizon } from "./prediction.ts";

/** Predict the existing turn/acceleration/braking response before choosing an obstacle detour. */
export function avoidObstacles(
  physics: ShipPhysics,
  query: NavigationQuery,
  stepSeconds: number,
  speed: number,
  state: EnemyState,
  request: Point,
): Point {
  return steerAroundObstacles(physics, query, stepSeconds, speed, state, request).request;
}

/**
 * The obstacle-steered request, and whether no course was clear: then the ship reverses its
 * request instead of stopping (gameplay/ships.md "Keep moving").
 */
export function steerAroundObstacles(
  physics: ShipPhysics,
  query: NavigationQuery,
  stepSeconds: number,
  speed: number,
  state: EnemyState,
  request: Point,
): { blocked: boolean; request: Point } {
  const share = Math.min(1, magnitude(request));
  if (!share || !speed) {
    return { blocked: false, request };
  }
  const horizon = navigationHorizon(physics);
  const pose = { facing: state.facing, position: state.position, time: 0 };
  if (!query.clear(pose, ENEMY_AVOIDANCE.passageClearance)) {
    const escape = query.escape(pose, ENEMY_AVOIDANCE.passageClearance);
    if (escape) {
      return { blocked: false, request: { x: escape.x * share, y: escape.y * share } };
    }
  }
  const desired = direction(request);
  const firstStep = Math.min(horizon, stepSeconds);
  const samples = ENEMY_AVOIDANCE.predictionSamples;
  const predictionStep = (horizon - firstStep) / (samples - 1);
  const safe = (course: Point, clearance: number): boolean => {
    let position = { ...state.position };
    let facing = { ...state.facing };
    let motion = { heading: state.heading, velocity: { ...state.velocity } };
    let time = 0;
    let cleared = query.clear({ facing, position, time }, clearance);
    // Check the exact next runtime step before sampling the remaining prediction horizon.
    for (let step = 0; step < samples; step++) {
      const dt = step === 0 ? firstStep : predictionStep;
      if (dt <= 0) {
        continue;
      }
      motion = stepShipMotion(
        physics,
        dt,
        { maxSpeed: physics.maxSpeed, restHeading: facing },
        { direction: course, speed: speed * share },
        motion,
      );
      position = { x: position.x + motion.velocity.x * dt, y: position.y + motion.velocity.y * dt };
      time += dt;
      if (magnitude(motion.velocity)) {
        facing = turnToward(dt, SHARED_SHIP_PHYSICS.hullTurnSeconds, motion.velocity, facing);
      }
      // Each sample meets moving obstacles at the same elapsed time, so relative motion counts.
      const pose = { facing, position, time };
      if (!query.clear(pose, 0)) {
        return false;
      }
      const clear = query.clear(pose, clearance);
      if (cleared && !clear) {
        return false;
      }
      cleared ||= clear;
    }
    return cleared;
  };
  const side = Math.cos(state.phase) >= 0 ? 1 : -1;
  // Prefer the wide travel berth; a constrained passage retains its own non-contact clearance.
  for (const clearance of [ENEMY_AVOIDANCE.clearance, ENEMY_AVOIDANCE.passageClearance]) {
    if (safe(desired, clearance)) {
      return { blocked: false, request: { x: desired.x * share, y: desired.y * share } };
    }
    // A local detour must still make forward progress toward the existing navigation request.
    for (let step = 1; step < ENEMY_AVOIDANCE.steeringDirections / 4; step++) {
      const angle = (step * Math.PI * 2) / ENEMY_AVOIDANCE.steeringDirections;
      for (const sign of [side, -side]) {
        const course = rotate(desired, angle * sign);
        if (safe(course, clearance)) {
          return { blocked: false, request: { x: course.x * share, y: course.y * share } };
        }
      }
    }
  }
  // With no clear course the ship reverses rather than waiting for a request that never changes
  // while it stands still.
  return { blocked: true, request: { x: 0 - desired.x * share, y: 0 - desired.y * share } };
}
