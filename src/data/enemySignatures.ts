import {
  ANDROMEDA_REDACT,
  CARTWHEEL_CLAIM,
  NEEDLE_CADENCE,
  SUNFLOWER_CAPITAL_BOSS,
  WHIRLPOOL_CAPITAL_BOSS,
} from "./capitalBosses.ts";
import type { EnemyActorKind } from "./enemyActors.ts";
import { PHANTOM_FLAGSHIP_ID } from "./enemyIdentity.ts";
import { enemyRandom } from "./enemyRandom.ts";
import type { RoutePosition } from "./galaxies.ts";
import type { EnemyWeapon, Weapon } from "./types.ts";

export const SMALL_CRAFT_SIGNATURES = {
  fighter: "multiLaser",
  interceptor: "phaser",
  retaliator: "rapidMissile",
  swarm: "laser",
} as const satisfies Record<string, Weapon>;

export const HEAVY_SIGNATURES = {
  capital: {
    lance: { mount: "weapon-left", weapon: "chargedLance" },
    mine: { mount: "stern-right", weapon: "mineLayer" },
    remaining: "laser",
  },
  frigate: { mount: "port", remaining: "laser", weapon: "heavyMissile" },
} as const;

const POINT_DEFENSE_MOUNTS = {
  "weapon-rear-left": "scattershot",
  "weapon-rear-right": "scattershot",
} as const;

/** Named capital turret overrides in route order. Other active mounts carry Laser. */
const BOSS_TURRETS: Readonly<Record<string, Readonly<Partial<Record<string, EnemyWeapon>>>>> = {
  [`1:${SUNFLOWER_CAPITAL_BOSS.id}`]: {
    ...POINT_DEFENSE_MOUNTS,
    "weapon-left": "chargedLance",
    "weapon-right": "rapidMissile",
  },
  [`2:${WHIRLPOOL_CAPITAL_BOSS.id}`]: {
    "weapon-left": "chargedLance",
    "weapon-rear-left": "rapidMissile",
    "weapon-rear-right": "rapidMissile",
    "weapon-right": "rapidMissile",
  },
  [`3:${NEEDLE_CADENCE.id}`]: {
    ...POINT_DEFENSE_MOUNTS,
    "claw-left": "multiLaser",
    "claw-right": "chargedLance",
    "weapon-left": "chargedLance",
    "weapon-right": "multiLaser",
  },
  [`4:${ANDROMEDA_REDACT.id}`]: {
    ...POINT_DEFENSE_MOUNTS,
    "claw-left": "heavyMissile",
    "claw-right": "heavyMissile",
    "weapon-left": "chargedLance",
    "weapon-right": "heavyMissile",
  },
  [`5:${CARTWHEEL_CLAIM.id}`]: {
    ...POINT_DEFENSE_MOUNTS,
    "stern-left": "mineLayer",
    "stern-right": "mineLayer",
  },
  [`6:${PHANTOM_FLAGSHIP_ID}`]: {
    "claw-right": "chargedLance",
    "stern-left": "mineLayer",
    "stern-right": "mineLayer",
    "weapon-left": "chargedLance",
    "weapon-rear-left": "heavyMissile",
    "weapon-rear-right": "heavyMissile",
  },
};

const SHARED_MOUNT_RATES = {
  1: [0.25, 0.4],
  2: [0.25, 0.4],
  3: [0.35, 0.5],
  4: [0.35, 0.5],
  5: [0.45, 0.6],
  6: [0.45, 0.6],
} as const satisfies Record<RoutePosition, readonly [number, number]>;

/** Absolute fractions of Ada's same-level rate. Fixed front Lasers use the standard band. */
export function enemySharedMountRate(
  position: RoutePosition,
  archetype: EnemyActorKind,
  weapon: Weapon,
  fixed: boolean,
): number {
  const [standard, heavy] = SHARED_MOUNT_RATES[position];
  const usesHeavyBand =
    (archetype === "capital" && !(fixed && weapon === "laser")) ||
    (archetype === "frigate" && weapon === "heavyMissile") ||
    (archetype === "platform" && weapon === "laser") ||
    (archetype === "retaliator" && weapon === "rapidMissile");
  return usesHeavyBand ? heavy : standard;
}

export const CAPITAL_PROFILE_SELECTION = {
  lanceWeight: 1,
  mineFromPosition: 5,
  mineWeight: 1,
} as const;

export const PLATFORM_SIGNATURE = {
  fill: ["port", "starboard", "aft"],
  tiers: [
    { count: 2, position: 5 },
    { count: 3, position: 6 },
  ],
  weapon: "laser",
} as const;

export const HOSTILE_STATION_SIGNATURE = {
  fill: [
    "weapon-0",
    "weapon-1",
    "weapon-2",
    "weapon-3",
    "weapon-4",
    "weapon-5",
    "weapon-6",
    "weapon-7",
  ],
  hullPerWeaponHp: 2,
  remaining: "rapidMissile",
  special: { mount: "weapon-5", weapon: "ringBurst" },
  tiers: [
    { count: 6, position: 4 },
    { count: 7, position: 5 },
    { count: 8, position: 6 },
  ],
} as const;

export function capitalProfile(position: RoutePosition, shipId: string): "lance" | "mine" {
  const { lanceWeight, mineFromPosition, mineWeight } = CAPITAL_PROFILE_SELECTION;
  return position >= mineFromPosition &&
    enemyRandom(`capital-profile:${position}:${shipId}`)() < mineWeight / (mineWeight + lanceWeight)
    ? "mine"
    : "lance";
}

/** Assigns weapons to existing active mounts. Unnamed capitals keep one seeded specialist. */
export function signatureLoadout(
  archetype: "capital" | "frigate",
  position: RoutePosition,
  shipId: string,
  activeMounts: readonly string[],
): ReadonlyMap<string, EnemyWeapon> {
  const role = HEAVY_SIGNATURES[archetype];
  const boss = archetype === "capital" ? BOSS_TURRETS[`${position}:${shipId}`] : undefined;
  if (boss) {
    return new Map(activeMounts.map((id) => [id, boss[id] ?? role.remaining]));
  }
  const special =
    archetype === "capital"
      ? HEAVY_SIGNATURES.capital[capitalProfile(position, shipId)]
      : HEAVY_SIGNATURES.frigate;
  const pointDefense: Readonly<Partial<Record<string, EnemyWeapon>>> =
    archetype === "capital" ? POINT_DEFENSE_MOUNTS : {};
  return new Map(
    activeMounts.map((id) => [
      id,
      id === special.mount ? special.weapon : (pointDefense[id] ?? role.remaining),
    ]),
  );
}

export interface SignatureTier {
  readonly mounts: Readonly<Record<string, { readonly armed: true } | null>>;
  readonly positions: readonly [RoutePosition, RoutePosition];
}

function weaponTier(
  fill: readonly string[],
  position: RoutePosition,
  count: number,
): SignatureTier {
  return {
    mounts: Object.fromEntries(
      fill.map((id, index) => [id, index < count ? { armed: true } : null]),
    ),
    positions: [position, position],
  };
}

/** Existing v1 tiers use the actual route positions, rather than fixed two-position bands. */
export function platformSignatureTiers(): readonly SignatureTier[] {
  return PLATFORM_SIGNATURE.tiers.map(({ count, position }) =>
    weaponTier(PLATFORM_SIGNATURE.fill, position, count),
  );
}

export function hostileStationSignatureTiers(): readonly SignatureTier[] {
  return HOSTILE_STATION_SIGNATURE.tiers.map(({ count, position }) =>
    weaponTier(HOSTILE_STATION_SIGNATURE.fill, position, count),
  );
}

/** Station hull is independent of part damage and derives from its active weapon tier. */
export function hostileStationHullHp(partHp: number, position: RoutePosition): number | undefined {
  const tier = HOSTILE_STATION_SIGNATURE.tiers.find((tier) => tier.position === position);
  return tier === undefined
    ? undefined
    : HOSTILE_STATION_SIGNATURE.hullPerWeaponHp * tier.count * partHp;
}
