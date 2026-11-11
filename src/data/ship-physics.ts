/** Movement tuning shared by every ship; times are exponential time constants in seconds. */
export interface ShipPhysics {
  /** Maximum speed as a fraction of Ada's base maximum speed. */
  speedRatio: number;
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
  speedRatio: number,
  accelerationSeconds: number,
  brakingSeconds: number,
  turnSeconds: number,
  aimTurnSeconds: number,
): ShipPhysics => ({
  accelerationSeconds,
  aimTurnSeconds,
  brakingSeconds,
  speedRatio,
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

/** Provisional tuning for Ada's ship and every enemy archetype. */
export const SHIP_PHYSICS = {
  ada: physics(1, 0.3, 0.45, 0.18, 0.07),
  capital: physics(0.2, 2.5, 3, 2, 0.5),
  fighter: physics(0.8, 0.4, 0.5, 0.3, 0.15),
  frigate: physics(0.4, 1.5, 2, 1.2, 0.4),
  interceptor: physics(1.1, 0.9, 1.2, 0.6, 0.12),
  oversizedCapital: physics(0.12, 3.5, 4, 3, 0.6),
  retaliator: physics(0.45, 1.2, 1.5, 0.9, 0.35),
  swarm: physics(0.9, 0.2, 0.25, 0.12, 0.1),
} satisfies Record<string, ShipPhysics>;
