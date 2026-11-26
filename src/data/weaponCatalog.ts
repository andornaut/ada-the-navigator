import type { Weapon } from "./types.ts";

export interface WeaponDefinition {
  intervalSeconds: number;
  speedRatio: number;
  damageRatio: number;
  /** A beam is hitscan: it has no projectile object. */
  projectileKind: "bolt" | "missile" | "dot" | "beam";
  /** Visible angular offsets in the projected aim plane, before unprojection. */
  anglesDegrees: readonly number[];
  /** When present, each pellet's launch offset in seconds, in angle order. */
  pelletDelays?: readonly number[];
  /** Weapon-relative world range before expiry; null for the base lifetime. */
  rangeWorld: number | null;
  fadeStartFraction: number | null;
  /** A missile's blast radius on screen in px; it damages every enemy it covers. Null without. */
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
export const BEAM = { flashSeconds: 0.15, halfWidth: 6, sparkSeconds: 0.16 } as const;

/** Full missile collision width is 12 world units. */
export const MISSILE_HIT_RADIUS = 6;
/** The enemy-only charged lance retains its existing collision width. */
export const LANCE_HIT_RADIUS = 4;

const projectile = {
  beamRange: null,
  blastRadius: null,
  fadeStartFraction: null,
  rangeWorld: null,
  speedRatio: 1,
} as const;
/** The base projectile speed every speed ratio multiplies (tuning.flight.projectileSpeed). */
export const BASE_PROJECTILE_SPEED = 600;
/** The speed ratio that flies a projectile at `worldSpeed` world units per second. */
const flies = (worldSpeed: number) => worldSpeed / BASE_PROJECTILE_SPEED;
/**
 * Catalog fallback reach without Ada's snapshotted coverage, shared with enemy bolts.
 */
const BOLT_REACH = 370;
/** Rapid Missile damage per hit at every level. */
const RAPID_DAMAGE = 1.5;
/** Rapid and Heavy Missiles reach 220 world units at every level and speed. */
const MISSILE_REACH = 220;
/** Heavy Missile's blast radius in screen px, the same at every level. */
const HEAVY_BLAST = 60;
/** Enemy Phaser catalog range; Ada uses her snapshotted rounded coverage. */
const PHASER_RANGE = 370;
/** Scattershot dots travel 100 world units, its close range at every level. */
const SCATTER_RANGE = 100;
/** A level 1 Scattershot pellet's damage, as Laser damage. */
const SCATTER_PELLET_DAMAGE = 0.8;
const fan = (count: number, spread: number) =>
  Array.from({ length: count }, (_, index) => -spread + (2 * spread * index) / (count - 1));

// Each baseline holds one weapon's values shared by its levels.
const MULTI_LASER_SPREAD = 8;
const SCATTER_ROW_SECONDS = 0.06;

function scatterRows(first: number, middle: number, last: number) {
  const rows = [fan(first, 30), fan(middle, 15), last === 1 ? [0] : fan(last, 4)];
  return {
    anglesDegrees: rows.flat(),
    pelletDelays: rows.flatMap((row, index) => row.map(() => index * SCATTER_ROW_SECONDS)),
  };
}

const heavyMissileBase = {
  ...projectile,
  anglesDegrees: [0],
  blastRadius: HEAVY_BLAST,
  intervalSeconds: 2,
  projectileKind: "missile",
  rangeWorld: MISSILE_REACH,
  speedRatio: flies(400),
} as const;
const laserBase = {
  ...projectile,
  anglesDegrees: [0],
  intervalSeconds: 0.3,
  projectileKind: "bolt",
  rangeWorld: BOLT_REACH,
} as const;
const multiLaserBase = {
  ...projectile,
  damageRatio: 0.7,
  intervalSeconds: 0.4,
  projectileKind: "bolt",
  rangeWorld: BOLT_REACH,
} as const;
const phaserBase = {
  ...projectile,
  anglesDegrees: [0],
  beamRange: PHASER_RANGE,
  intervalSeconds: 1,
  projectileKind: "beam",
} as const;
const rapidMissileBase = {
  ...projectile,
  anglesDegrees: [0],
  blastRadius: 30,
  damageRatio: RAPID_DAMAGE,
  intervalSeconds: 0.3,
  projectileKind: "missile",
  rangeWorld: MISSILE_REACH,
} as const;
const scattershotBase = {
  ...projectile,
  fadeStartFraction: 0.65,
  intervalSeconds: 1,
  projectileKind: "dot",
  rangeWorld: SCATTER_RANGE,
} as const;

/** Canonical weapon values; levels change only each weapon's approved growth dimensions. */
export const WEAPON_CATALOG: Readonly<Record<Weapon, WeaponLevels>> = {
  // One missile every 2 s, with a 60 blast at every level. The missile flies 400 world units
  // per second, reaching 220.
  heavyMissile: [
    {
      ...heavyMissileBase,
      damageRatio: 5,
    },
    {
      ...heavyMissileBase,
      damageRatio: 6,
    },
    {
      ...heavyMissileBase,
      damageRatio: 7,
    },
  ],
  // Damage and fire rate each grow 1.25/1.2 then 1.5/1.5; the bolt flies 500, 600 and 700 world
  // units per second, reaching 370 at each.
  laser: [
    {
      ...laserBase,
      damageRatio: 1,
      speedRatio: flies(500),
    },
    {
      ...laserBase,
      damageRatio: 1.25,
      intervalSeconds: laserBase.intervalSeconds / 1.2,
      speedRatio: flies(600),
    },
    {
      ...laserBase,
      damageRatio: 1.5,
      intervalSeconds: laserBase.intervalSeconds / 1.5,
      speedRatio: flies(700),
    },
  ],
  // A volley every 0.40 s, with 3, 4 or 5 bolts across the same -8 to 8 fan. Bolts fly
  // 400, 500 and 600 world units per second, reaching 370 at each level.
  multiLaser: [
    {
      ...multiLaserBase,
      anglesDegrees: fan(3, MULTI_LASER_SPREAD),
      speedRatio: flies(400),
    },
    {
      ...multiLaserBase,
      anglesDegrees: fan(4, MULTI_LASER_SPREAD),
      speedRatio: flies(500),
    },
    {
      ...multiLaserBase,
      anglesDegrees: fan(5, MULTI_LASER_SPREAD),
      speedRatio: flies(600),
    },
  ],
  // Fires once a second with the same range at every level.
  phaser: [
    {
      ...phaserBase,
      damageRatio: 4,
    },
    {
      ...phaserBase,
      damageRatio: 6,
    },
    {
      ...phaserBase,
      damageRatio: 8,
    },
  ],
  // Fixed RAPID_DAMAGE and a small blast at every level; fire rate grows 1.2 then 1.5 (every 0.30,
  // 0.25 and 0.20 s) and the missile flies 500, 600 and 700 world units per second, reaching
  // 220 at each.
  rapidMissile: [
    {
      ...rapidMissileBase,
      speedRatio: flies(500),
    },
    {
      ...rapidMissileBase,
      intervalSeconds: rapidMissileBase.intervalSeconds / 1.2,
      speedRatio: flies(600),
    },
    {
      ...rapidMissileBase,
      intervalSeconds: rapidMissileBase.intervalSeconds / 1.5,
      speedRatio: flies(700),
    },
  ],
  // One three-row volley per second, at 0.8, 1 and 1.2 damage per pellet.
  scattershot: [
    {
      ...scattershotBase,
      ...scatterRows(7, 3, 1),
      damageRatio: SCATTER_PELLET_DAMAGE,
    },
    {
      ...scattershotBase,
      ...scatterRows(9, 4, 1),
      damageRatio: SCATTER_PELLET_DAMAGE * 1.25,
    },
    {
      ...scattershotBase,
      ...scatterRows(11, 5, 2),
      damageRatio: (SCATTER_PELLET_DAMAGE * 3) / 2,
    },
  ],
};

/** A weapon's projectile speed in world units per second at a level; 0 for the hitscan beam. */
export function weaponSpeed(weapon: Weapon, level: number): number {
  const definition = weaponAt(weapon, level);
  return definition.projectileKind === "beam" ? 0 : definition.speedRatio * BASE_PROJECTILE_SPEED;
}

/** A weapon's definition at a level from 1 to 3; out-of-range levels clamp. */
export function weaponAt(weapon: Weapon, level: number): WeaponDefinition {
  const index = Math.min(WEAPON_LEVEL_COUNT, Math.max(1, Math.floor(level))) - 1;
  return WEAPON_CATALOG[weapon][index]!;
}
