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
  passageClearance: 40,
  predictionSteps: 6,
} as const;

/** Swarm steering oscillation frequency, independent of its catalog amplitude. */
export const ENEMY_STEERING = {
  swarmWobbleRadiansPerSecond: 3,
} as const;
