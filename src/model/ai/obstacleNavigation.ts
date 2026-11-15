import type { Point } from "../../data/enemyCatalog.ts";
import { ENEMY_AVOIDANCE } from "../../data/enemyNavigation.ts";
import { SHARED_SHIP_PHYSICS, type ShipPhysics } from "../../data/shipPhysics.ts";
import type { EnemyState } from "../enemyAi.ts";
import { direction, stepShipMotion, turnToward } from "../shipPhysics.ts";
import { magnitude, rotate } from "./course.ts";
import type { NavigationQuery } from "./navigationQuery.ts";
import { navigationHorizon } from "./prediction.ts";

/** Predict the existing turn/acceleration/braking response before choosing an obstacle detour. */
export function avoidObstacles(
  physics: ShipPhysics,
  query: NavigationQuery,
  speed: number,
  state: EnemyState,
  request: Point,
): Point {
  const share = Math.min(1, magnitude(request));
  if (!share || !speed) {
    return request;
  }
  const horizon = navigationHorizon(physics);
  const pose = { facing: state.facing, position: state.position };
  if (!query.clear(pose, ENEMY_AVOIDANCE.passageClearance)) {
    const escape = query.escape(pose, ENEMY_AVOIDANCE.passageClearance);
    if (escape) {
      return { x: escape.x * share, y: escape.y * share };
    }
  }
  const desired = direction(request);
  const dt = horizon / ENEMY_AVOIDANCE.predictionSteps;
  const safe = (course: Point, clearance: number): boolean => {
    let position = { ...state.position };
    let facing = { ...state.facing };
    let motion = { heading: state.heading, velocity: { ...state.velocity } };
    let cleared = query.clear({ facing, position }, clearance);
    for (let step = 0; step < ENEMY_AVOIDANCE.predictionSteps; step++) {
      motion = stepShipMotion(
        physics,
        dt,
        { maxSpeed: speed, restHeading: facing },
        { direction: course, speed: speed * share },
        motion,
      );
      position = { x: position.x + motion.velocity.x * dt, y: position.y + motion.velocity.y * dt };
      if (magnitude(motion.velocity)) {
        facing = turnToward(dt, SHARED_SHIP_PHYSICS.hullTurnSeconds, motion.velocity, facing);
      }
      const pose = { facing, position };
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
      return { x: desired.x * share, y: desired.y * share };
    }
    // A local detour must still make forward progress toward the existing navigation request.
    for (let step = 1; step < ENEMY_AVOIDANCE.directions / 4; step++) {
      const angle = (step * Math.PI * 2) / ENEMY_AVOIDANCE.directions;
      for (const sign of [side, -side]) {
        const course = rotate(desired, angle * sign);
        if (safe(course, clearance)) {
          return { x: course.x * share, y: course.y * share };
        }
      }
    }
  }
  return { x: 0, y: 0 };
}
