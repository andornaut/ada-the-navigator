import type { EnemyDefinition } from "../../data/enemyCatalog.ts";
import { ENEMY_AVOIDANCE } from "../../data/enemyNavigation.ts";
import type { ShipPhysics } from "../../data/shipPhysics.ts";

/** Seconds needed to turn or accelerate and then brake under the existing ship physics. */
export function navigationHorizon(physics: ShipPhysics): number {
  return (
    (Math.max(physics.turnSeconds, physics.accelerationSeconds) + physics.brakingSeconds) *
    ENEMY_AVOIDANCE.lookAheadScale
  );
}

/** Broad-phase look-ahead seconds, covering both ordinary and noncombat steering responses. */
export function navigationLookAhead(
  definition: Pick<EnemyDefinition, "navigation" | "physics">,
): number {
  return navigationHorizon({
    ...definition.physics,
    turnSeconds: Math.max(definition.physics.turnSeconds, definition.navigation?.turnSeconds ?? 0),
  });
}
