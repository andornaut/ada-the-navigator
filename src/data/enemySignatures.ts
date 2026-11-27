import type { EnemyActorKind } from "./enemyActors.ts";
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
    remaining: "scattershot",
  },
  frigate: { mount: "port", remaining: "laser", weapon: "heavyMissile" },
} as const;

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

/** Assigns only existing active mount ids, with one specialized mount and no additional parts. */
export function signatureLoadout(
  archetype: "capital" | "frigate",
  position: RoutePosition,
  shipId: string,
  activeMounts: readonly string[],
): ReadonlyMap<string, EnemyWeapon> {
  const role = HEAVY_SIGNATURES[archetype];
  const special =
    archetype === "capital"
      ? HEAVY_SIGNATURES.capital[capitalProfile(position, shipId)]
      : HEAVY_SIGNATURES.frigate;
  return new Map(
    activeMounts.map((id) => [id, id === special.mount ? special.weapon : role.remaining]),
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
