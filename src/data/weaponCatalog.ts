import type { Weapon } from "./types.ts";

export interface WeaponDefinition {
  intervalSeconds: number;
  speedRatio: number;
  damageRatio: number;
  /** A beam is hitscan: it has no projectile object. */
  projectileKind: "bolt" | "missile" | "dot" | "beam";
  /** Visible angular offsets in the projected aim plane, before unprojection. */
  anglesDegrees: readonly number[];
  /** World units a projectile travels before it vanishes; null for the base lifetime. */
  rangeWorld: number | null;
  fadeStartFraction: number | null;
  /** World radius of a missile's blast, which damages every enemy in it; null without one. */
  blastRadius: number | null;
  /** World range of a hitscan beam; null for projectile weapons. */
  beamRange: number | null;
}

/** A weapon's definition at levels 1, 2 and 3; level 1 is the base and 2 and 3 are bought. */
export type WeaponLevels = readonly [WeaponDefinition, WeaponDefinition, WeaponDefinition];

export const WEAPON_LEVEL_COUNT = 3;

/**
 * The beam half-width that lets a near miss graze, how long its flash shows and how long a hit's
 * spark shows (art/weapons.md "Phaser beam").
 */
export const BEAM = { flashSeconds: 0.15, halfWidth: 4, sparkSeconds: 0.16 } as const;

const projectile = {
  beamRange: null,
  blastRadius: null,
  fadeStartFraction: null,
  rangeWorld: null,
  speedRatio: 1,
} as const;
/** The base projectile speed every speed ratio multiplies (tuning.flight.projectileSpeed). */
const BASE_SPEED = 600;
/** The speed ratio that flies a projectile at `worldSpeed` world units per second. */
const flies = (worldSpeed: number) => worldSpeed / BASE_SPEED;
/** Laser and Multi-Laser bolts reach 1200 world units at every level and speed. */
const BOLT_REACH = 1200;
/** Rapid and Heavy Missiles reach 220 world units at every level and speed. */
const MISSILE_REACH = 220;
const fan = (count: number, spread: number) =>
  Array.from({ length: count }, (_, index) => -spread + (2 * spread * index) / (count - 1));

/**
 * Provisional tuning: speed and damage ratios multiply the existing base values. Each level
 * multiplies effective output (damage x fire rate x hits per volley) by 1.5, so level 3 is
 * 2.25 times level 1, except Rapid Missile, whose fire rate alone takes it to 1.2 and 1.5 times
 * level 1; gameplay/rules.md gives each weapon's growth dimensions. A fan's extra bolts or dots
 * count as hits; blast and beam range growth is a bonus on top.
 */
export const WEAPON_CATALOG: Readonly<Record<Weapon, WeaponLevels>> = {
  // Fire rate (1.2, 1.0, 0.8 s) and damage make each single-target 1.5 step; the blast's growth
  // to 72 and 85 is a bonus against groups. The missile flies 400 world units per second,
  // reaching 220.
  heavyMissile: [
    {
      ...projectile,
      anglesDegrees: [0],
      blastRadius: 60,
      damageRatio: 8,
      intervalSeconds: 1.2,
      projectileKind: "missile",
      rangeWorld: MISSILE_REACH,
      speedRatio: flies(400),
    },
    {
      ...projectile,
      anglesDegrees: [0],
      blastRadius: 72,
      damageRatio: 10,
      intervalSeconds: 1,
      projectileKind: "missile",
      rangeWorld: MISSILE_REACH,
      speedRatio: flies(400),
    },
    {
      ...projectile,
      anglesDegrees: [0],
      blastRadius: 85,
      damageRatio: 12,
      intervalSeconds: 0.8,
      projectileKind: "missile",
      rangeWorld: MISSILE_REACH,
      speedRatio: flies(400),
    },
  ],
  // Damage and fire rate each grow 1.25/1.2 then 1.5/1.5; the bolt flies 500, 600 and 700 world
  // units per second, reaching 1200 at each.
  laser: [
    {
      ...projectile,
      anglesDegrees: [0],
      damageRatio: 1,
      intervalSeconds: 0.28,
      projectileKind: "bolt",
      rangeWorld: BOLT_REACH,
      speedRatio: flies(500),
    },
    {
      ...projectile,
      anglesDegrees: [0],
      damageRatio: 1.25,
      intervalSeconds: 0.28 / 1.2,
      projectileKind: "bolt",
      rangeWorld: BOLT_REACH,
      speedRatio: flies(600),
    },
    {
      ...projectile,
      anglesDegrees: [0],
      damageRatio: 1.5,
      intervalSeconds: 0.28 / 1.5,
      projectileKind: "bolt",
      rangeWorld: BOLT_REACH,
      speedRatio: flies(700),
    },
  ],
  // Bolt count grows hits 4/3 then 5/3 across the same -20 to 20 fan; damage makes up the rest.
  // Its bolts fly 400, 500 and 600 world units per second, reaching 1200 at each.
  multiLaser: [
    {
      ...projectile,
      anglesDegrees: fan(3, 20),
      damageRatio: 1,
      intervalSeconds: 0.3,
      projectileKind: "bolt",
      rangeWorld: BOLT_REACH,
      speedRatio: flies(400),
    },
    {
      ...projectile,
      anglesDegrees: fan(4, 20),
      damageRatio: 1.125,
      intervalSeconds: 0.3,
      projectileKind: "bolt",
      rangeWorld: BOLT_REACH,
      speedRatio: flies(500),
    },
    {
      ...projectile,
      anglesDegrees: fan(5, 20),
      damageRatio: 1.35,
      intervalSeconds: 0.3,
      projectileKind: "bolt",
      rangeWorld: BOLT_REACH,
      speedRatio: flies(600),
    },
  ],
  // 4x Laser damage at a 4x Laser interval matches Laser's single-target output. Damage alone
  // makes each single-target 1.5 step; range growth to 384 and 460.8 is a bonus.
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
      damageRatio: 6,
      intervalSeconds: 1.12,
      projectileKind: "beam",
    },
    {
      ...projectile,
      anglesDegrees: [0],
      beamRange: 460.8,
      damageRatio: 9,
      intervalSeconds: 1.12,
      projectileKind: "beam",
    },
  ],
  // Fixed 1.5 damage and a small blast at every level; fire rate grows 1.2 then 1.5 (every 0.30,
  // 0.25 and 0.20 s) and the missile flies 500, 600 and 700 world units per second, reaching
  // 220 at each.
  rapidMissile: [
    {
      ...projectile,
      anglesDegrees: [0],
      blastRadius: 25,
      damageRatio: 1.5,
      intervalSeconds: 0.3,
      projectileKind: "missile",
      rangeWorld: MISSILE_REACH,
      speedRatio: flies(500),
    },
    {
      ...projectile,
      anglesDegrees: [0],
      blastRadius: 25,
      damageRatio: 1.5,
      intervalSeconds: 0.25,
      projectileKind: "missile",
      rangeWorld: MISSILE_REACH,
      speedRatio: flies(600),
    },
    {
      ...projectile,
      anglesDegrees: [0],
      blastRadius: 25,
      damageRatio: 1.5,
      intervalSeconds: 0.2,
      projectileKind: "missile",
      rangeWorld: MISSILE_REACH,
      speedRatio: flies(700),
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
      rangeWorld: 360,
    },
    {
      ...projectile,
      anglesDegrees: fan(9, 30),
      damageRatio: (0.35 * 1.5 * 7) / 9,
      fadeStartFraction: 0.65,
      intervalSeconds: 0.45,
      projectileKind: "dot",
      rangeWorld: 360,
    },
    {
      ...projectile,
      anglesDegrees: fan(11, 30),
      damageRatio: (0.35 * 2.25 * 7) / 11,
      fadeStartFraction: 0.65,
      intervalSeconds: 0.45,
      projectileKind: "dot",
      rangeWorld: 360,
    },
  ],
};

/** A weapon's definition at a level from 1 to 3; out-of-range levels clamp. */
export function weaponAt(weapon: Weapon, level: number): WeaponDefinition {
  const index = Math.min(WEAPON_LEVEL_COUNT, Math.max(1, Math.floor(level))) - 1;
  return WEAPON_CATALOG[weapon][index]!;
}
