import type { EnemyWeapon } from "../data/types.ts";
import type { Vec } from "./types.ts";

export type ImpactFamily =
  | "missile"
  | "compact"
  | "compactBright"
  | "phaserRings"
  | "pellet"
  | "lance"
  | "ripple"
  | "shockwave";

/** Visual provenance captured from the weapon that fired, never the current loadout. */
export function impactFamily(weapon: EnemyWeapon): ImpactFamily {
  switch (weapon) {
    case "rapidMissile":
    case "heavyMissile":
      return "missile";
    case "laser":
    case "multiLaser":
      return "compact";
    case "phaser":
      return "compactBright";
    case "scattershot":
      return "pellet";
    case "chargedLance":
      return "lance";
    case "ringBurst":
      return "ripple";
    case "mineLayer":
      return "shockwave";
    default:
      throw new RangeError("Unknown source weapon");
  }
}

/** Presentation-only contact in world coordinates. Direction is incoming, not a surface normal. */
export interface WeaponImpact extends Vec {
  readonly id: string;
  readonly targetId?: string;
  readonly age: number;
  readonly family: ImpactFamily;
  readonly direction?: Vec;
  readonly blastRadius?: number;
}
