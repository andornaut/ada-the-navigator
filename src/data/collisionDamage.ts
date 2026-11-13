import type { GameContent } from "./types.ts";
import { weaponAt } from "./weaponCatalog.ts";

/** Shared time between damaging scenery impacts, in seconds. */
export const SCENERY_IMPACT_SECONDS = 0.5;

/** One obstacle impact costs one basic Laser hit, independent of the equipped weapon or level. */
export function sceneryImpactDamage(
  tuning: Pick<GameContent["tuning"]["flight"], "playerShotDamage">,
): number {
  return tuning.playerShotDamage * weaponAt("laser", 1).damageRatio;
}
