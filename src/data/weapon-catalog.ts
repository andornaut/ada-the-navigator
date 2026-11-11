import type { Weapon } from "./types.ts";

export interface WeaponDefinition {
  intervalSeconds: number;
  speedRatio: number;
  damageRatio: number;
  /** A beam is hitscan: it has no projectile object. */
  projectileKind: "bolt" | "missile" | "dot" | "beam";
  /** Visible angular offsets in the projected aim plane, before unprojection. */
  anglesDegrees: readonly number[];
  rangeScreenWidths: number | null;
  fadeStartFraction: number | null;
  /** World radius of a missile's blast, which damages every enemy in it; null without one. */
  blastRadius: number | null;
  /** World range of a hitscan beam; null for projectile weapons. */
  beamRange: number | null;
}

/** A weapon's definition at levels 1, 2 and 3; level 1 is the base and 2 and 3 are bought. */
export type WeaponLevels = readonly [WeaponDefinition, WeaponDefinition, WeaponDefinition];

export const WEAPON_LEVEL_COUNT = 3;

/** The beam half-width that lets a near miss graze, and how long its flash shows. */
export const BEAM = { flashSeconds: 0.15, halfWidth: 4 } as const;

const projectile = {
  beamRange: null,
  blastRadius: null,
  fadeStartFraction: null,
  rangeScreenWidths: null,
  speedRatio: 1,
} as const;
const fan = (count: number, spread: number) =>
  Array.from({ length: count }, (_, index) => -spread + (2 * spread * index) / (count - 1));

/**
 * Provisional tuning: speed and damage ratios multiply the existing base values. Each level
 * multiplies effective output (damage x fire rate x hits per volley) by 1.5, so level 3 is
 * 2.25 times level 1; gameplay/prototype.md gives each weapon's growth dimensions.
 */
export const WEAPON_CATALOG: Readonly<Record<Weapon, WeaponLevels>> = {
  // Damage and fire rate each grow 1.25/1.2 then 1.5/1.5.
  basic: [
    {
      ...projectile,
      anglesDegrees: [0],
      damageRatio: 1,
      intervalSeconds: 0.28,
      projectileKind: "bolt",
    },
    {
      ...projectile,
      anglesDegrees: [0],
      damageRatio: 1.25,
      intervalSeconds: 0.28 / 1.2,
      projectileKind: "bolt",
    },
    {
      ...projectile,
      anglesDegrees: [0],
      damageRatio: 1.5,
      intervalSeconds: 0.28 / 1.5,
      projectileKind: "bolt",
    },
  ],
  // Blast 60, 72, 85 grows the catch radius (blast plus a 10-unit hull) 82/70 then 95/70 times;
  // damage makes up the rest of each 1.5 step.
  heavyMissile: [
    {
      ...projectile,
      anglesDegrees: [0],
      blastRadius: 60,
      damageRatio: 8,
      intervalSeconds: 1.2,
      projectileKind: "missile",
      speedRatio: 0.6,
    },
    {
      ...projectile,
      anglesDegrees: [0],
      blastRadius: 72,
      damageRatio: 10.25,
      intervalSeconds: 1.2,
      projectileKind: "missile",
      speedRatio: 0.6,
    },
    {
      ...projectile,
      anglesDegrees: [0],
      blastRadius: 85,
      damageRatio: 13.25,
      intervalSeconds: 1.2,
      projectileKind: "missile",
      speedRatio: 0.6,
    },
  ],
  // Bolt count grows hits 4/3 then 5/3 across the same -20 to 20 fan; damage makes up the rest.
  multiLaser: [
    {
      ...projectile,
      anglesDegrees: fan(3, 20),
      damageRatio: 1,
      intervalSeconds: 0.3,
      projectileKind: "bolt",
    },
    {
      ...projectile,
      anglesDegrees: fan(4, 20),
      damageRatio: 1.125,
      intervalSeconds: 0.3,
      projectileKind: "bolt",
    },
    {
      ...projectile,
      anglesDegrees: fan(5, 20),
      damageRatio: 1.35,
      intervalSeconds: 0.3,
      projectileKind: "bolt",
    },
  ],
  // 4x Basic damage at a 4x Basic interval matches Basic's single-target output; range grows
  // 1.2 then 1.44 times and damage 1.25 then 1.5625 times.
  phaser: [
    {
      ...projectile,
      anglesDegrees: [0],
      beamRange: 320,
      damageRatio: 4,
      intervalSeconds: 1.12,
      projectileKind: "beam",
    },
    {
      ...projectile,
      anglesDegrees: [0],
      beamRange: 384,
      damageRatio: 5,
      intervalSeconds: 1.12,
      projectileKind: "beam",
    },
    {
      ...projectile,
      anglesDegrees: [0],
      beamRange: 460.8,
      damageRatio: 6.25,
      intervalSeconds: 1.12,
      projectileKind: "beam",
    },
  ],
  // Damage grows 1.25 then 1.5 and fire rate 1.2 then 1.5, with a small blast at every level.
  rapidMissile: [
    {
      ...projectile,
      anglesDegrees: [0],
      blastRadius: 25,
      damageRatio: 1.5,
      intervalSeconds: 0.3,
      projectileKind: "missile",
      speedRatio: 1.3,
    },
    {
      ...projectile,
      anglesDegrees: [0],
      blastRadius: 25,
      damageRatio: 1.875,
      intervalSeconds: 0.25,
      projectileKind: "missile",
      speedRatio: 1.3,
    },
    {
      ...projectile,
      anglesDegrees: [0],
      blastRadius: 25,
      damageRatio: 2.25,
      intervalSeconds: 0.2,
      projectileKind: "missile",
      speedRatio: 1.3,
    },
  ],
  // Up close every dot hits, so dots grow hits 9/7 then 11/7 across -30 to 30, reach grows a
  // little, and damage makes up the rest.
  scattershot: [
    {
      ...projectile,
      anglesDegrees: fan(7, 30),
      damageRatio: 0.35,
      fadeStartFraction: 0.65,
      intervalSeconds: 0.45,
      projectileKind: "dot",
      rangeScreenWidths: 0.5,
    },
    {
      ...projectile,
      anglesDegrees: fan(9, 30),
      damageRatio: (0.35 * 1.5 * 7) / 9,
      fadeStartFraction: 0.65,
      intervalSeconds: 0.45,
      projectileKind: "dot",
      rangeScreenWidths: 0.55,
    },
    {
      ...projectile,
      anglesDegrees: fan(11, 30),
      damageRatio: (0.35 * 2.25 * 7) / 11,
      fadeStartFraction: 0.65,
      intervalSeconds: 0.45,
      projectileKind: "dot",
      rangeScreenWidths: 0.6,
    },
  ],
};

/** A weapon's definition at a level from 1 to 3; out-of-range levels clamp. */
export function weaponAt(weapon: Weapon, level: number): WeaponDefinition {
  const index = Math.min(WEAPON_LEVEL_COUNT, Math.max(1, Math.floor(level))) - 1;
  return WEAPON_CATALOG[weapon][index]!;
}
