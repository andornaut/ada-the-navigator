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

export const ENEMY_FIRE_MULTIPLIERS = {
  capital: 1.5,
  fighter: 1,
  frigate: 2,
  hostileStation: 1,
  interceptor: 1,
  platform: 1.5,
  retaliator: 1,
  swarm: 1,
} as const;

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

/** One dedicated FNV-1a and mulberry32 draw, independent of all encounter random streams. */
function firstDraw(key: string): number {
  let state = 2166136261;
  for (let index = 0; index < key.length; index++) {
    state = Math.imul(state ^ key.charCodeAt(index), 16777619);
  }
  state = (state + 0x6d2b79f5) | 0;
  let mix = Math.imul(state ^ (state >>> 15), 1 | state);
  mix = (mix + Math.imul(mix ^ (mix >>> 7), 61 | mix)) ^ mix;
  return ((mix ^ (mix >>> 14)) >>> 0) / 4294967296;
}

export function capitalProfile(position: RoutePosition, shipId: string): "lance" | "mine" {
  const { lanceWeight, mineFromPosition, mineWeight } = CAPITAL_PROFILE_SELECTION;
  return position >= mineFromPosition &&
    firstDraw(`capital-profile:${position}:${shipId}`) < mineWeight / (mineWeight + lanceWeight)
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
