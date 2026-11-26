import type { IndustrialBodyKey } from "./enemyIdentity.ts";

/** Existing strafe approach and pass steering factors. */
export const ENEMY_STRAFE = {
  bendGain: 2,
  floorBlendShare: 0.8,
  floorMargin: 1.8,
  passEntry: 2.5,
  passOffset: 2,
} as const;

/** Navigation-only world-space hull clearance and bounded prediction resolution. */
export const ENEMY_AVOIDANCE = {
  clearance: 80,
  directions: 16,
  lookAheadScale: 1.25,
  passageClearance: 40,
  predictionSamples: 12,
  steeringDirections: 12,
} as const;

/** Existing steering thresholds and frequency, independent of catalog speed and amplitude. */
export const ENEMY_STEERING = {
  arrivalRadius: 5,
  swarmWobbleRadiansPerSecond: 3,
} as const;

/**
 * Fixed forward hull guns fire only along the hull facing, and only while the aim point is within
 * `arcRadians` either side of it. While the ship fights Ada its hull keeps its nose on her,
 * turning with its aimTurnSeconds, and its requested speed is capped by direction: full speed
 * ahead, `lateralShare` of its top speed sideways and `reverseShare` straight back.
 */
export interface ForwardGuns {
  arcRadians: number;
  lateralShare: number;
  reverseShare: number;
}

/** The nose arc and strafing speeds of every ship with fixed forward guns (gameplay/ships.md). */
export const ENEMY_FORWARD_GUNS: ForwardGuns = {
  arcRadians: (20 * Math.PI) / 180,
  lateralShare: 0.8,
  reverseShare: 0.6,
};

/**
 * Every enemy ship that can move keeps moving (gameplay/ships.md "Keep moving"). Its request never
 * falls below `minimumShare` of its current top speed. A turret ship that would hold a point
 * circles it at `turretHoldRadii` times its spacing radius. Pack members on their shared route keep
 * at least the galaxy's member spacing and the sum of both radii plus `packGap` apart, each the
 * larger of its spacing and collision radius. A miner traces a rock's drawn outline with its
 * centre its spacing radius plus `edgeGap` from it, for a seeded `dwellSeconds` per rock, and
 * never picks one of its last `recentPicks` again.
 */
export interface EnemyKeepMoving {
  dwellSeconds: readonly [number, number];
  edgeGap: number;
  minimumShare: number;
  packGap: number;
  recentPicks: number;
  turretHoldRadii: number;
}

/** The keep-moving values (gameplay/ships.md "Keep moving"). */
export const ENEMY_KEEP_MOVING: EnemyKeepMoving = {
  dwellSeconds: [6, 12],
  edgeGap: 20,
  minimumShare: 0.25,
  packGap: 20,
  recentPicks: 3,
  turretHoldRadii: 2,
};

/** The industrial retaliator bodies that mine: the Mining Freighter traces asteroid edges. */
export const MINING_HULLS: readonly IndustrialBodyKey[] = ["retaliatorMiningFreighter"];
