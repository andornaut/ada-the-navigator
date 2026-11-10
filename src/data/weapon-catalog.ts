import type { Weapon } from "./types.ts";

export interface WeaponDefinition {
  intervalSeconds: number;
  speedRatio: number;
  damageRatio: number;
  projectileKind: "bolt" | "missile" | "dot";
  /** Visible angular offsets in the projected aim plane, before unprojection. */
  anglesDegrees: readonly number[];
  rangeScreenWidths: number | null;
  fadeStartFraction: number | null;
}

// Provisional tuning: speed and damage ratios multiply the existing base values.
export const WEAPON_CATALOG: Readonly<Record<Weapon, WeaponDefinition>> = {
  basic: {
    anglesDegrees: [0],
    damageRatio: 1,
    fadeStartFraction: null,
    intervalSeconds: 0.28,
    projectileKind: "bolt",
    rangeScreenWidths: null,
    speedRatio: 1,
  },
  missiles: {
    anglesDegrees: [0],
    damageRatio: 4,
    fadeStartFraction: null,
    intervalSeconds: 0.6,
    projectileKind: "missile",
    rangeScreenWidths: null,
    speedRatio: 0.6,
  },
  scattershot: {
    anglesDegrees: [-30, -20, -10, 0, 10, 20, 30],
    damageRatio: 0.35,
    fadeStartFraction: 0.65,
    intervalSeconds: 0.45,
    projectileKind: "dot",
    rangeScreenWidths: 0.5,
    speedRatio: 1,
  },
  tripleLaser: {
    anglesDegrees: [-20, 0, 20],
    damageRatio: 1,
    fadeStartFraction: null,
    intervalSeconds: 0.3,
    projectileKind: "bolt",
    rangeScreenWidths: null,
    speedRatio: 1,
  },
};
