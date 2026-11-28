import { ENEMY_AVOIDANCE } from "../../data/enemyNavigation.ts";
import { direction } from "../shipPhysics.ts";
import type { Vec } from "../types.ts";
import { type WorldContext, worldDelta, worldDistance } from "../world/index.ts";

export interface StationGuardAnchor {
  readonly center: Vec;
  /** Minimum center distance, including the site's protection and the moving hull footprint. */
  readonly clearanceRadius: number;
}

/** The existing valid home and canonical berth define the station patrol radius. */
export function stationGuardPatrolRadius(
  context: WorldContext,
  anchor: StationGuardAnchor,
  home: Vec,
): number {
  return Math.max(
    worldDistance(context, anchor.center, home),
    anchor.clearanceRadius + ENEMY_AVOIDANCE.clearance,
  );
}

/** A site-centered course through a valid local home, outside its exclusion zone. */
export function stationGuardPatrol(
  context: WorldContext,
  anchor: StationGuardAnchor,
  home: Vec,
  side: -1 | 1,
  position: Vec,
): Vec {
  const radius = stationGuardPatrolRadius(context, anchor, home);
  const offset = worldDelta(context, anchor.center, position);
  const distance = Math.hypot(offset.x, offset.y);
  const outward = direction(distance ? offset : worldDelta(context, anchor.center, home));
  const correction = Math.max(-1, Math.min(1, 1 - distance / radius));
  return direction({
    x: outward.x * correction - side * outward.y,
    y: outward.y * correction + side * outward.x,
  });
}
