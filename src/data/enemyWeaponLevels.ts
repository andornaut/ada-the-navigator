import type { RoutePosition } from "./galaxies.ts";
import type { EnemyWeapon, WeaponLevel } from "./types.ts";
import { WEAPON_CATALOG } from "./weaponCatalog.ts";

/** Relative weights for weapon levels 1, 2 and 3, by galaxy route position. */
export const ENEMY_WEAPON_LEVEL_WEIGHTS = {
  1: [100, 0, 0],
  2: [75, 25, 0],
  3: [50, 50, 0],
  4: [25, 75, 0],
  5: [0, 75, 25],
  6: [0, 50, 50],
} as const satisfies Readonly<Record<RoutePosition, readonly [number, number, number]>>;

/** Shared enemy damage uses the equipped player weapon's damage. */
export const ENEMY_SHARED_WEAPON_TUNING = { damageMultiplier: 1 } as const;

/** Selects from a supplied uniform draw without choosing eligibility or consuming a stream. */
export function selectEnemyWeaponLevel(position: RoutePosition, roll: number): WeaponLevel {
  if (!Number.isFinite(roll) || roll < 0 || roll >= 1) {
    throw new RangeError("Enemy weapon level draw must be in [0, 1)");
  }
  const weights = ENEMY_WEAPON_LEVEL_WEIGHTS[position];
  const draw = roll * weights.reduce((sum: number, weight) => sum + weight, 0);
  let cumulative = 0;
  for (const [index, weight] of weights.entries()) {
    cumulative += weight;
    if (draw < cumulative) {
      return (index + 1) as WeaponLevel;
    }
  }
  throw new RangeError("Enemy weapon level weights have no selected outcome");
}

/** The six shared weapons equip the selected level; enemy-only weapons remain level one. */
export function equippedEnemyWeaponLevel(level: WeaponLevel, weapon: EnemyWeapon): WeaponLevel {
  return Object.hasOwn(WEAPON_CATALOG, weapon) ? level : 1;
}
