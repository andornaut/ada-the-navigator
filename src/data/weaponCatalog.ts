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
/**
 * Laser and Multi-Laser bolts reach 370 world units at every level and speed, as far as the
 * Phaser: past the play view's edges and corners.
 */
const BOLT_REACH = 370;
/** Rapid Missile damage per hit at every level: 5, 6 and 7.5 a second, tying Heavy at level 1. */
const RAPID_DAMAGE = 1.5;
/** Rapid and Heavy Missiles reach 220 world units at every level and speed. */
const MISSILE_REACH = 220;
/** Heavy Missile's blast radius in world units, the same at every level. */
const HEAVY_BLAST = 50;
/** Phaser's beam reaches 370 world units at every level, across the play view. */
const PHASER_RANGE = 370;
/** Scattershot dots travel 100 world units, its close range at every level. */
const SCATTER_RANGE = 100;
/** A level 1 Scattershot volley's damage, as Laser damage, when every dot hits. */
const SCATTER_VOLLEY = 6;
const fan = (count: number, spread: number) =>
  Array.from({ length: count }, (_, index) => -spread + (2 * spread * index) / (count - 1));

/**
 * Provisional tuning: speed and damage ratios multiply the existing base values. Each level
 * multiplies effective output (damage x fire rate x hits per volley) by 1.5, so level 3 is
 * 2.25 times level 1, except Rapid Missile, whose fire rate alone takes it to 1.2 and 1.5 times
 * level 1, and Multi-Laser, whose bolt count alone takes it to 4/3 and 5/3; gameplay/rules.md
 * gives each weapon's growth dimensions. A fan's extra bolts or dots
 * count as hits; blast and beam range growth is a bonus on top.
 */
export const WEAPON_CATALOG: Readonly<Record<Weapon, WeaponLevels>> = {
  // Slow and heavy (gameplay/rules.md): one missile every 2 s at every level, damage alone making
  // each 1.5 step (10, 15 and 22.5 times Laser damage), with a 50 blast at every level. The
  // missile flies 400 world units per second, reaching 220.
  heavyMissile: [
    {
      ...projectile,
      anglesDegrees: [0],
      blastRadius: HEAVY_BLAST,
      damageRatio: 10,
      intervalSeconds: 2,
      projectileKind: "missile",
      rangeWorld: MISSILE_REACH,
      speedRatio: flies(400),
    },
    {
      ...projectile,
      anglesDegrees: [0],
      blastRadius: HEAVY_BLAST,
      damageRatio: 15,
      intervalSeconds: 2,
      projectileKind: "missile",
      rangeWorld: MISSILE_REACH,
      speedRatio: flies(400),
    },
    {
      ...projectile,
      anglesDegrees: [0],
      blastRadius: HEAVY_BLAST,
      damageRatio: 22.5,
      intervalSeconds: 2,
      projectileKind: "missile",
      rangeWorld: MISSILE_REACH,
      speedRatio: flies(400),
    },
  ],
  // Damage and fire rate each grow 1.25/1.2 then 1.5/1.5; the bolt flies 500, 600 and 700 world
  // units per second, reaching 370 at each.
  laser: [
    {
      ...projectile,
      anglesDegrees: [0],
      damageRatio: 1,
      intervalSeconds: 0.3,
      projectileKind: "bolt",
      rangeWorld: BOLT_REACH,
      speedRatio: flies(500),
    },
    {
      ...projectile,
      anglesDegrees: [0],
      damageRatio: 1.25,
      intervalSeconds: 0.3 / 1.2,
      projectileKind: "bolt",
      rangeWorld: BOLT_REACH,
      speedRatio: flies(600),
    },
    {
      ...projectile,
      anglesDegrees: [0],
      damageRatio: 1.5,
      intervalSeconds: 0.3 / 1.5,
      projectileKind: "bolt",
      rangeWorld: BOLT_REACH,
      speedRatio: flies(700),
    },
  ],
  // Every 0.30 s, each bolt a fixed 0.7 times Laser damage; levels add only bolts, 3, 4 then 5
  // across the same -20 to 20 fan. Its bolts fly 400, 500 and 600 world units per second,
  // reaching 370 at each.
  multiLaser: [
    {
      ...projectile,
      anglesDegrees: fan(3, 20),
      damageRatio: 0.7,
      intervalSeconds: 0.3,
      projectileKind: "bolt",
      rangeWorld: BOLT_REACH,
      speedRatio: flies(400),
    },
    {
      ...projectile,
      anglesDegrees: fan(4, 20),
      damageRatio: 0.7,
      intervalSeconds: 0.3,
      projectileKind: "bolt",
      rangeWorld: BOLT_REACH,
      speedRatio: flies(500),
    },
    {
      ...projectile,
      anglesDegrees: fan(5, 20),
      damageRatio: 0.7,
      intervalSeconds: 0.3,
      projectileKind: "bolt",
      rangeWorld: BOLT_REACH,
      speedRatio: flies(600),
    },
  ],
  // The long-range weapon: once a second at 6.5 times Laser damage, its 370 range covering the
  // play view at every level; damage alone makes each 1.5 step.
  phaser: [
    {
      ...projectile,
      anglesDegrees: [0],
      beamRange: PHASER_RANGE,
      damageRatio: 6.5,
      intervalSeconds: 1,
      projectileKind: "beam",
    },
    {
      ...projectile,
      anglesDegrees: [0],
      beamRange: PHASER_RANGE,
      damageRatio: 6.5 * 1.5,
      intervalSeconds: 1,
      projectileKind: "beam",
    },
    {
      ...projectile,
      anglesDegrees: [0],
      beamRange: PHASER_RANGE,
      damageRatio: 6.5 * 2.25,
      intervalSeconds: 1,
      projectileKind: "beam",
    },
  ],
  // Fixed RAPID_DAMAGE and a small blast at every level; fire rate grows 1.2 then 1.5 (every 0.30,
  // 0.25 and 0.20 s) and the missile flies 500, 600 and 700 world units per second, reaching
  // 220 at each.
  rapidMissile: [
    {
      ...projectile,
      anglesDegrees: [0],
      blastRadius: 25,
      damageRatio: RAPID_DAMAGE,
      intervalSeconds: 0.3,
      projectileKind: "missile",
      rangeWorld: MISSILE_REACH,
      speedRatio: flies(500),
    },
    {
      ...projectile,
      anglesDegrees: [0],
      blastRadius: 25,
      damageRatio: RAPID_DAMAGE,
      intervalSeconds: 0.3 / 1.2,
      projectileKind: "missile",
      rangeWorld: MISSILE_REACH,
      speedRatio: flies(600),
    },
    {
      ...projectile,
      anglesDegrees: [0],
      blastRadius: 25,
      damageRatio: RAPID_DAMAGE,
      intervalSeconds: 0.3 / 1.5,
      projectileKind: "missile",
      rangeWorld: MISSILE_REACH,
      speedRatio: flies(700),
    },
  ],
  // The close-range weapon: a volley a second within 100. A level 1 volley deals 6 times Laser
  // damage when every dot hits; dots grow hits 9/7 then 11/7 across -30 to 30, and damage makes up
  // the rest of the 1.5 and 2.25 times level 1 volley.
  scattershot: [
    {
      ...projectile,
      anglesDegrees: fan(7, 30),
      damageRatio: SCATTER_VOLLEY / 7,
      fadeStartFraction: 0.65,
      intervalSeconds: 1,
      projectileKind: "dot",
      rangeWorld: SCATTER_RANGE,
    },
    {
      ...projectile,
      anglesDegrees: fan(9, 30),
      damageRatio: (SCATTER_VOLLEY * 1.5) / 9,
      fadeStartFraction: 0.65,
      intervalSeconds: 1,
      projectileKind: "dot",
      rangeWorld: SCATTER_RANGE,
    },
    {
      ...projectile,
      anglesDegrees: fan(11, 30),
      damageRatio: (SCATTER_VOLLEY * 2.25) / 11,
      fadeStartFraction: 0.65,
      intervalSeconds: 1,
      projectileKind: "dot",
      rangeWorld: SCATTER_RANGE,
    },
  ],
};

/** A weapon's projectile speed in world units per second at a level; 0 for the hitscan beam. */
export function weaponSpeed(weapon: Weapon, level: number): number {
  const definition = weaponAt(weapon, level);
  return definition.projectileKind === "beam" ? 0 : definition.speedRatio * BASE_SPEED;
}

/** A weapon's definition at a level from 1 to 3; out-of-range levels clamp. */
export function weaponAt(weapon: Weapon, level: number): WeaponDefinition {
  const index = Math.min(WEAPON_LEVEL_COUNT, Math.max(1, Math.floor(level))) - 1;
  return WEAPON_CATALOG[weapon][index]!;
}
