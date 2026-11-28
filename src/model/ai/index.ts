export { magnitude } from "./course.ts";
export {
  edgeCourse,
  minerDwell,
  minerNeedsPick,
  outlineEdge,
  pickMinerRock,
  type TracedEdge,
} from "./edgeTrace.ts";
export {
  aimDrift,
  averageVelocity,
  type BallisticDebris,
  circlingSide,
  createEnemy,
  damageEnemy,
  type EnemyAttackOpportunity,
  type EnemyContext,
  enemyDefeated,
  type EnemyEffects,
  enemyEffects,
  enemyFireLine,
  enemyIntegrity,
  type EnemyIntent,
  enemySpeedFraction,
  type EnemyState,
  type FireIntent,
  hardpointOffset,
  type HardpointState,
  leadPoint,
  leadSkill,
  type RetreatState,
  stepDebris,
  stepEnemy,
  strafeLimited,
  type TacticState,
  withinNoseArc,
} from "./enemyAi.ts";
export { steerAroundObstacles } from "./obstacleNavigation.ts";
export { packSlot } from "./packRoute.ts";
export type { StationGuardAnchor } from "./stationGuardPatrol.ts";
