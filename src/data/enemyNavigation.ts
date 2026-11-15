/** Strafe geometry in multiples of the behavior's pass distance. */
export const ENEMY_STRAFE = {
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
