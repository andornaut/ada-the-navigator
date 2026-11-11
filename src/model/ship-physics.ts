import type { ShipPhysics } from "../data/ship-physics.ts";

export interface Vector {
  x: number;
  y: number;
}
/** Movement memory: the smoothed heading is null at rest or with no movement request. */
export interface ShipMotion {
  heading: Vector | null;
  velocity: Vector;
}
/** A zero direction requests a stop; speed is the target speed for a non-zero direction. */
export interface MotionRequest {
  direction: Vector;
  speed: number;
}

const length = (v: Vector) => Math.hypot(v.x, v.y);
/** Unit vector, or zero; adding zero maps -0 to 0 so saved state survives JSON unchanged. */
export function direction(v: Vector): Vector {
  const size = length(v);
  return size ? { x: v.x / size + 0, y: v.y / size + 0 } : { x: 0, y: 0 };
}

/**
 * Rotates the unit `current` toward `target` along the shorter arc, removing the
 * fraction `1 - exp(-dt / response)` of the angle and snapping within half a degree.
 */
export function turnToward(dt: number, response: number, target: Vector, current: Vector): Vector {
  const requested = direction(target);
  if (!length(current)) {
    return requested;
  }
  let delta = Math.atan2(
    current.x * requested.y - current.y * requested.x,
    current.x * requested.x + current.y * requested.y,
  );
  // Choose a consistent side for an exact half-turn.
  if (Math.abs(Math.abs(delta) - Math.PI) < 1e-12) {
    delta = Math.PI;
  }
  const remaining = Math.exp(-dt / Math.max(0.001, response));
  if (Math.abs(delta) * remaining <= Math.PI / 360) {
    return requested;
  }
  const angle = Math.atan2(current.y, current.x) + delta * (1 - remaining);
  return { x: Math.cos(angle) + 0, y: Math.sin(angle) + 0 };
}

/**
 * The movement model shared by every ship. While moving, the heading turns toward the
 * requested direction with `turnSeconds`; from rest it starts on the request directly.
 * Velocity approaches `heading * speed` with `accelerationSeconds`, or zero with
 * `brakingSeconds` when nothing is requested. The midpoint heading drives velocity so
 * results barely depend on frame rate.
 */
export function stepShipMotion(
  physics: ShipPhysics,
  dt: number,
  request: MotionRequest,
  motion: ShipMotion,
): ShipMotion {
  const requested = direction(request.direction);
  const moving = length(requested) > 0;
  let heading: Vector | null = null;
  let applied = requested;
  if (moving && length(motion.velocity) < 0.01) {
    heading = requested;
  } else if (moving) {
    const previous = motion.heading ?? direction(motion.velocity);
    heading = turnToward(dt, physics.turnSeconds, requested, previous);
    applied = turnToward(dt / 2, physics.turnSeconds, requested, previous);
  }
  const speed = moving ? Math.max(0, request.speed) : 0;
  const response = moving ? physics.accelerationSeconds : physics.brakingSeconds;
  const blend = 1 - Math.exp(-dt / Math.max(0.001, response));
  const velocity = {
    x: motion.velocity.x + (applied.x * speed - motion.velocity.x) * blend,
    y: motion.velocity.y + (applied.y * speed - motion.velocity.y) * blend,
  };
  // Stop subpixel drift so a released ship comes to rest.
  if (!moving && length(velocity) < 0.01) {
    return { heading, velocity: { x: 0, y: 0 } };
  }
  return { heading, velocity };
}

/** Current speed as a fraction of a ship's maximum speed, clamped to [0, 1]. */
export function speedFraction(maxSpeed: number, velocity: Vector): number {
  if (!(maxSpeed > 0)) {
    return 0;
  }
  return Math.min(1, Math.max(0, length(velocity) / maxSpeed));
}

/**
 * Converts a hull-local offset to world axes. In the local frame `-y` is forward and
 * `+x` is starboard, so a hull facing up (`{ x: 0, y: -1 }`) leaves offsets unchanged.
 */
export function hullOffset(facing: Vector, offset: Vector): Vector {
  return {
    x: -facing.y * offset.x - facing.x * offset.y,
    y: facing.x * offset.x - facing.y * offset.y,
  };
}
