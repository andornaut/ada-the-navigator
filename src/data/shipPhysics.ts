/** Movement tuning shared by every ship; times are exponential time constants in seconds. */
export interface ShipPhysics {
  /** Maximum speed in world units per second. */
  maxSpeed: number;
  /** Time constant for velocity to approach a non-zero target. */
  accelerationSeconds: number;
  /** Time constant for velocity to approach zero with no target. */
  brakingSeconds: number;
  /** Time constant for the movement heading to turn toward its target. */
  turnSeconds: number;
  /** Time constant for the aim direction to turn toward its target. */
  aimTurnSeconds: number;
}

const physics = (
  maxSpeed: number,
  accelerationSeconds: number,
  brakingSeconds: number,
  turnSeconds: number,
  aimTurnSeconds: number,
): ShipPhysics => ({
  accelerationSeconds,
  aimTurnSeconds,
  brakingSeconds,
  maxSpeed,
  turnSeconds,
});

/** Movement tuning shared by every ship. */
export interface SharedShipPhysics {
  /** Time constant for an enemy hull to turn toward its velocity direction. */
  hullTurnSeconds: number;
  /** A ship with no movement request comes to rest below this fraction of its maximum speed. */
  restSpeedFraction: number;
}

/** Provisional shared tuning. */
export const SHARED_SHIP_PHYSICS: SharedShipPhysics = {
  hullTurnSeconds: 0.08,
  restSpeedFraction: 0.01,
};

/**
 * Provisional tuning for Ada's ship and every enemy archetype (gameplay/ships.md "Values"). Ada's
 * maximum speed and turn time constants are her base engine's; engine levels change them.
 */
export const SHIP_PHYSICS = {
  ada: physics(175, 0.36, 0.55, 0.16, 0.08),
  capital: physics(40, 2.5, 3, 2, 0.5),
  fighter: physics(140, 0.4, 0.5, 0.3, 0.15),
  frigate: physics(80, 1.5, 2, 1.2, 0.4),
  interceptor: physics(200, 0.9, 1.2, 0.6, 0.12),
  // Fixed in place: only its turrets turn. The movement constants never act at speed 0.
  platform: physics(0, 1, 1, 1, 0.3),
  retaliator: physics(90, 1.2, 1.5, 0.9, 0.35),
  swarm: physics(160, 0.2, 0.25, 0.12, 0.1),
} satisfies Record<string, ShipPhysics>;
