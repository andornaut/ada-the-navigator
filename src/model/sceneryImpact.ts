import { SCENERY_IMPACT_SECONDS, sceneryImpactDamage } from "../data/collisionDamage.ts";
import type { GameContent } from "../data/types.ts";
import type { FlightState, SpaceObject } from "./types.ts";

export interface SceneryImpact {
  readonly amount: number;
  readonly damageObstacle: boolean;
}

/** Decides one shared-cooldown impact without mutating the ship, obstacle or destruction state. */
export function sceneryImpact(
  tuning: Pick<GameContent["tuning"]["flight"], "playerShotDamage">,
  flight: Pick<FlightState, "lastBump" | "shield" | "time">,
  obstacle: Pick<SpaceObject, "hp" | "kind">,
): SceneryImpact | null {
  if (
    flight.shield <= 0 ||
    obstacle.hp <= 0 ||
    !["rock", "resource", "debris"].includes(obstacle.kind) ||
    flight.time - (flight.lastBump ?? -Infinity) < SCENERY_IMPACT_SECONDS - 1e-9
  ) {
    return null;
  }
  return { amount: sceneryImpactDamage(tuning), damageObstacle: Number.isFinite(obstacle.hp) };
}
