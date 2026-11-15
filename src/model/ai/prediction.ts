import type { EnemyDefinition } from "../../data/enemyCatalog.ts";
import type { ShipPhysics } from "../../data/shipPhysics.ts";

/** Seconds needed to turn or accelerate and then brake under the existing ship physics. */
export function navigationHorizon(physics: ShipPhysics): number {
  return Math.max(physics.turnSeconds, physics.accelerationSeconds) + physics.brakingSeconds;
}

/** A broad-phase reach that covers both ordinary and noncombat steering responses. */
export function navigationReach(
  definition: Pick<EnemyDefinition, "navigation" | "physics">,
): number {
  return (
    definition.physics.maxSpeed *
    navigationHorizon({
      ...definition.physics,
      turnSeconds: Math.max(
        definition.physics.turnSeconds,
        definition.navigation?.turnSeconds ?? 0,
      ),
    })
  );
}
