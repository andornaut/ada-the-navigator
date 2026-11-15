import type { EnemyActorKind } from "./enemyActors.ts";
import { ENEMY_SIZE_RATIOS } from "./enemyDimensions.ts";
import { type EnemyAssetKey, enemyAssetKey, PHANTOM_FLAGSHIP_ID } from "./enemyIdentity.ts";
import {
  ENEMY_FIRE_MULTIPLIERS,
  HEAVY_SIGNATURES,
  HOSTILE_STATION_SIGNATURE,
  PLATFORM_SIGNATURE,
  platformSignatureTiers,
  signatureLoadout,
  SMALL_CRAFT_SIGNATURES,
} from "./enemySignatures.ts";
import {
  ENEMY_SHARED_WEAPON_TUNING,
  enemyRelativeFireRate,
  equippedEnemyWeaponLevel,
} from "./enemyWeaponLevels.ts";
import { byPosition, ROUTE_POSITION, type RoutePosition } from "./galaxies.ts";
import { hostileStationDefinition } from "./hostileStations.ts";
import { SHIP_PHYSICS, type ShipPhysics } from "./shipPhysics.ts";
import type { EnemyOnlyWeapon, EnemyWeapon, GalaxyNumber, WeaponLevel } from "./types.ts";
import { weaponAt, weaponSpeed } from "./weaponCatalog.ts";

export interface Point {
  x: number;
  y: number;
}
export interface FireProfile {
  /** The weapon's fan at its level, in degrees in the projected aim plane, as Ada fires it. */
  angles: readonly number[];
  /** Bolts per volley fired `gap` seconds apart; a volley starts every `interval`. */
  burst?: { count: number; gap: number };
  interval: number;
  /** The weapon's level; an enemy-only weapon has only level 1. */
  level: WeaponLevel;
  /** A beam is hitscan and a mine is laid in place: neither flies. */
  projectile: "beam" | "bolt" | "dot" | "mine" | "missile";
  /** World units per second its projectiles fly; 0 for a weapon without projectile flight. */
  projectileSpeed: number;
  /** The weapon this profile fires (gameplay/ships.md "Enemy weapons"). */
  weapon: EnemyWeapon;
}
/** The weapon a mount carries at one position tier. */
export interface MountedWeapon {
  level: WeaponLevel;
  weapon: EnemyWeapon;
}
/** One route-position tier's weapon per mount; a mount the tier leaves null is capped. */
export interface MountTier {
  mounts: Readonly<Record<string, MountedWeapon | null>>;
  positions: readonly [RoutePosition, RoutePosition];
}
/**
 * A heavy's weapon mounts (art/heavies.md "Mounts"): weapons fill them pairs first in `fill`
 * order, so the loadout stays symmetric, and an odd count adds a centreline mount.
 */
export interface WeaponMounts {
  fill: readonly string[];
  /** Art's offsets, in the hardpoint offset frame. */
  offsets: Readonly<Record<string, Point>>;
  tiers: readonly MountTier[];
}
interface HardpointBase {
  hp: number;
  id: string;
  /** Fraction of hull width in the hull's local frame: `-y` forward, `+x` starboard. */
  offset: Point;
}
export type HardpointDefinition = HardpointBase &
  ({ kind: "engine" | "command" } | { fire: FireProfile; kind: "weapon" });
/**
 * Movement behaviours an engaged enemy uses. Small craft fight with their weapons, not their
 * hulls: each holds its `standoff` band from Ada and never presses in to ram (gameplay/ships.md
 * "Behaviours"). `retaliate` is the `aggression` trigger and `flee` is the `morale` rule; capital
 * battles assign `escort` to their fighters.
 */
export type Behaviour =
  /** Closes to the standoff band, then holds there, strafing sideways and firing. */
  | { kind: "chase" }
  /** Holds the band with erratic wobble and peer separation, so a pack rings Ada. */
  | { kind: "swarm" }
  /**
   * Rushes to the band's near edge and fires; after `burstVolleys` volleys or a hit it pulls out
   * under the bounded hitAndRun retreat policy, then comes back.
   */
  | { burstVolleys: number; kind: "hitAndRun" }
  /**
   * Makes firing passes beside Ada, never closer than `passDistance`, and loops back beyond
   * `loopDistance`.
   */
  | { kind: "strafe"; loopDistance: number; passDistance: number }
  /** Advances on Ada at `speedFraction` of maximum speed while its turrets fire. */
  | { kind: "siege"; speedFraction: number };
/** Escort stations sit `stationGap` beyond the capital's hull; escorts intercept within reach. */
export interface EscortTuning {
  interceptRadius: number;
  stationGap: number;
}
/** Retreat bounds are steering transitions; existing momentum and turning remain physical. */
export interface RetreatPolicy {
  cooldownSeconds: number;
  curveRadians: number;
  distance: number;
  seconds: number;
}

/** Shared initial retreat policy; archetypes can override either behavior independently. */
export const ENEMY_RETREAT: RetreatPolicy = {
  cooldownSeconds: 6,
  curveRadians: 0.5,
  distance: 200,
  seconds: 1.6,
};

/** Noncombat movement shares use each archetype's existing combat speed. */
export interface EnemyNavigation {
  approachRadius: number;
  ellipseRatio: readonly [number, number];
  patrolRadius: readonly [number, number];
  patrolShare: number;
  searchShare: number;
  turnSeconds: number;
}

/** Canonical provisional patrol and investigation tuning for mobile enemies. */
export const ENEMY_NAVIGATION: EnemyNavigation = {
  approachRadius: 180,
  ellipseRatio: [0.7, 1],
  patrolRadius: [80, 150],
  patrolShare: 0.5,
  searchShare: 0.7,
  turnSeconds: 0.8,
};

export interface EnemyDefinition {
  readonly assetKey?: EnemyAssetKey;
  aggression: "sight" | "retaliate";
  behaviour: Behaviour;
  /** An escort's behaviour once its capital is gone or disabled (gameplay/ships.md "Behaviours"). */
  escortFallback: Extract<Behaviour, { kind: "hitAndRun" }>;
  engagement: number;
  fire: FireProfile;
  hardpoints: HardpointDefinition[];
  hp: number;
  /** A disable-only ship retains this hull HP after any hit. */
  hullFloor?: number;
  morale: { individualHpRatio: number; packLossRatio: number };
  /** A heavy's weapon mounts and their loadout by position tier. */
  mounts?: WeaponMounts;
  /** Null permits a stationary idle variant; combat and finite return rules still apply. */
  navigation: EnemyNavigation | null;
  perception: number;
  physics: ShipPhysics;
  /**
   * Finite pursuit (gameplay/enemies.md "Finite pursuit"): the home radius, the pursuit clock's
   * limit, the unseen limit, and the seconds a returning ship waits before it can re-engage.
   */
  pursuit: { homeRadius: number; maxSeconds: number; rearmSeconds: number; unseenSeconds: number };
  retreats: { hitAndRun: RetreatPolicy; morale: RetreatPolicy };
  sizeRatio: number;
  /** A small craft's standoff band from Ada, in world units; heavies have none. */
  standoff?: { far: number; near: number };
  steering: { separation: number; wobble: number };
}

const engine = (id: string, x: number, y: number): HardpointDefinition => ({
  hp: 4,
  id,
  kind: "engine",
  offset: { x, y },
});
type Cadence = Pick<FireProfile, "burst" | "interval">;
/** Enemy-only base intervals retain their own cadence and the existing galaxy fire curve. */
export const ENEMY_FIRE: Readonly<Record<EnemyOnlyWeapon, Cadence>> = {
  chargedLance: { interval: 6 },
  mineLayer: { interval: 5 },
  ringBurst: { interval: 3.5 },
};
/** An enemy projectile flies this share of Ada's level 1 speed for the same weapon. */
export const ENEMY_SPEED_SHARE = 0.6;
/** World units per second the enemy-only weapons' projectiles fly: the ring burst's bolts. */
const ENEMY_ONLY_SPEED: Readonly<Record<EnemyOnlyWeapon, number>> = {
  chargedLance: 0,
  mineLayer: 0,
  ringBurst: 240,
};
/** Seconds an enemy Phaser's fixed aim line shows before its beam fires along it. */
export const PHASER_AIM_SECONDS = 0.4;
/** The charged lance's tell: it tracks Ada, then holds still before its beam fires. */
export const LANCE_TELL = { lockSeconds: 0.3, trackSeconds: 0.7 } as const;
/** A ring burst's bolts, evenly around the hull. */
export const RING_BOLTS = 8;
/** Mines one ship keeps out at once, and the seconds each lasts. */
export const MINE_LAYER = { count: 4, lifeSeconds: 20 } as const;
/** Platform Laser bursts retain their internal timing at every equipped level. */
const ENEMY_BURSTS: Readonly<
  Partial<Record<string, Partial<Record<EnemyWeapon, FireProfile["burst"]>>>>
> = {
  platform: { laser: { count: 2, gap: 0.15 } },
};
const ENEMY_ONLY_PROJECTILE: Readonly<Record<EnemyOnlyWeapon, FireProfile["projectile"]>> = {
  chargedLance: "beam",
  mineLayer: "mine",
  ringBurst: "bolt",
};

/** Whether a weapon is one only enemies carry. */
export function enemyOnly(weapon: EnemyWeapon): weapon is EnemyOnlyWeapon {
  return weapon === "chargedLance" || weapon === "mineLayer" || weapon === "ringBurst";
}

/**
 * An archetype's fire profile for a weapon at a level: the weapon's fan and projectile at that
 * level, the same whoever fires it, at the enemy's own cadence, its projectiles at
 * ENEMY_SPEED_SHARE of Ada's level 1 speed for the weapon.
 */
export function enemyFire(archetype: string, mounted: MountedWeapon): FireProfile {
  const { weapon } = mounted;
  const level = equippedEnemyWeaponLevel(mounted.level, weapon);
  const shared = enemyOnly(weapon) ? null : weaponAt(weapon, level);
  const cadence = shared
    ? { interval: shared.intervalSeconds }
    : ENEMY_FIRE[weapon as EnemyOnlyWeapon];
  const burst = ENEMY_BURSTS[archetype]?.[weapon];
  return {
    ...cadence,
    ...(burst ? { burst } : {}),
    angles: shared?.anglesDegrees ?? [0],
    level,
    projectile: shared?.projectileKind ?? ENEMY_ONLY_PROJECTILE[weapon as EnemyOnlyWeapon],
    projectileSpeed: enemyOnly(weapon)
      ? ENEMY_ONLY_SPEED[weapon]
      : ENEMY_SPEED_SHARE * weaponSpeed(weapon, 1),
    weapon,
  };
}
const command: HardpointDefinition = {
  hp: 5,
  id: "command",
  kind: "command",
  offset: { x: 0, y: 0 },
};
const armed = (weapon: EnemyWeapon, level: WeaponLevel = 1): MountedWeapon => ({ level, weapon });
/**
 * Frigate mounts: the sponson pair, the dorsal spine and the bow between the tine roots, with
 * each tier's weapons from gameplay/ships.md "Enemy weapons".
 */
const frigateMounts = {
  fill: ["port", "starboard", "spine", "bow"],
  offsets: {
    bow: { x: 0, y: -0.22 },
    port: { x: -0.3, y: 0 },
    spine: { x: 0, y: 0.025 },
    starboard: { x: 0.3, y: 0 },
  },
  tiers: [
    {
      mounts: {
        bow: null,
        port: armed(HEAVY_SIGNATURES.frigate.weapon),
        spine: null,
        starboard: armed(HEAVY_SIGNATURES.frigate.remaining),
      },
      positions: [1, 2],
    },
    {
      mounts: {
        bow: null,
        port: armed(HEAVY_SIGNATURES.frigate.weapon),
        spine: armed(HEAVY_SIGNATURES.frigate.remaining),
        starboard: armed(HEAVY_SIGNATURES.frigate.remaining),
      },
      positions: [3, 4],
    },
    {
      mounts: {
        bow: armed(HEAVY_SIGNATURES.frigate.remaining),
        port: armed(HEAVY_SIGNATURES.frigate.weapon),
        spine: armed(HEAVY_SIGNATURES.frigate.remaining),
        starboard: armed(HEAVY_SIGNATURES.frigate.remaining),
      },
      positions: [5, 6],
    },
  ],
} as const satisfies WeaponMounts;
/**
 * Capital mounts in four pairs: shoulders, wings, claw arms and stern deck. The mine layer sits
 * at the stern because its mines drop behind the ship.
 */
const capitalMounts = {
  fill: [
    "weapon-left",
    "weapon-right",
    "weapon-rear-left",
    "weapon-rear-right",
    "claw-left",
    "claw-right",
    "stern-left",
    "stern-right",
  ],
  offsets: {
    "claw-left": { x: -0.15, y: -0.45 },
    "claw-right": { x: 0.15, y: -0.45 },
    "stern-left": { x: -0.1, y: 0.31 },
    "stern-right": { x: 0.1, y: 0.31 },
    "weapon-left": { x: -0.35, y: -0.3 },
    "weapon-rear-left": { x: -0.42, y: 0.08 },
    "weapon-rear-right": { x: 0.42, y: 0.08 },
    "weapon-right": { x: 0.35, y: -0.3 },
  },
  tiers: [
    {
      mounts: {
        "claw-left": null,
        "claw-right": null,
        "stern-left": null,
        "stern-right": null,
        "weapon-left": armed(HEAVY_SIGNATURES.capital.lance.weapon),
        "weapon-rear-left": armed(HEAVY_SIGNATURES.capital.remaining),
        "weapon-rear-right": armed(HEAVY_SIGNATURES.capital.remaining),
        "weapon-right": armed(HEAVY_SIGNATURES.capital.remaining),
      },
      positions: [1, 2],
    },
    {
      mounts: {
        "claw-left": armed(HEAVY_SIGNATURES.capital.remaining),
        "claw-right": armed(HEAVY_SIGNATURES.capital.remaining),
        "stern-left": null,
        "stern-right": null,
        "weapon-left": armed(HEAVY_SIGNATURES.capital.lance.weapon),
        "weapon-rear-left": armed(HEAVY_SIGNATURES.capital.remaining),
        "weapon-rear-right": armed(HEAVY_SIGNATURES.capital.remaining),
        "weapon-right": armed(HEAVY_SIGNATURES.capital.remaining),
      },
      positions: [3, 4],
    },
    {
      mounts: {
        "claw-left": armed(HEAVY_SIGNATURES.capital.remaining),
        "claw-right": armed(HEAVY_SIGNATURES.capital.remaining),
        "stern-left": armed(HEAVY_SIGNATURES.capital.remaining),
        "stern-right": armed(HEAVY_SIGNATURES.capital.remaining),
        "weapon-left": armed(HEAVY_SIGNATURES.capital.lance.weapon),
        "weapon-rear-left": armed(HEAVY_SIGNATURES.capital.remaining),
        "weapon-rear-right": armed(HEAVY_SIGNATURES.capital.remaining),
        "weapon-right": armed(HEAVY_SIGNATURES.capital.remaining),
      },
      positions: [5, 6],
    },
  ],
} as const satisfies WeaponMounts;
/**
 * Cartwheel's fixed ore-field guard: two turrets at Art's offsets (art/heavies.md "Turret
 * platform"), as in tools/enemy-hardpoints.json, each firing two-shot Laser bursts.
 */
const PLATFORM_MOUNT_OFFSET = 0.29;
const platformMounts = {
  fill: PLATFORM_SIGNATURE.fill,
  offsets: {
    aft: { x: 0, y: PLATFORM_MOUNT_OFFSET },
    port: { x: -PLATFORM_MOUNT_OFFSET, y: 0 },
    starboard: { x: PLATFORM_MOUNT_OFFSET, y: 0 },
  },
  tiers: platformSignatureTiers().map((tier) => ({
    mounts: Object.fromEntries(
      Object.entries(tier.mounts).map(([id, state]) => [
        id,
        state ? armed(PLATFORM_SIGNATURE.weapon) : null,
      ]),
    ),
    positions: tier.positions,
  })),
} as const satisfies WeaponMounts;

/** The mount tier for a route position. */
export function mountTier(mounts: WeaponMounts, position: RoutePosition): MountTier {
  const first = mounts.tiers[0]!;
  // Legacy definitions before a family's authored region retain its first armed layout.
  return position < first.positions[0]
    ? first
    : mounts.tiers.find(({ positions: [from, to] }) => from <= position && position <= to)!;
}

/**
 * A heavy's weapon hardpoints at a tier: each armed mount, in fill order, at Art's offset, with
 * the ship's loadout weapon on it where it has one.
 */
function mountedHardpoints(
  archetype: string,
  mounts: WeaponMounts,
  tier: MountTier,
  hp: number,
  loadout: ReadonlyMap<string, EnemyWeapon> | null = null,
  weaponLevel: WeaponLevel = 1,
): HardpointDefinition[] {
  return mounts.fill.flatMap((id): HardpointDefinition[] => {
    const weapon = tier.mounts[id] && loadout?.get(id);
    const mounted = weapon ? armed(weapon) : tier.mounts[id];
    return mounted
      ? [
          {
            fire: enemyFire(archetype, { ...mounted, level: weaponLevel }),
            hp,
            id,
            kind: "weapon",
            offset: { ...mounts.offsets[id]! },
          },
        ]
      : [];
  });
}

/** A heavy's stable signature on its existing active mounts. */
export function heavyLoadout(
  archetype: EnemyActorKind,
  position: RoutePosition,
  shipId: string,
): ReadonlyMap<string, EnemyWeapon> | null {
  if (archetype === "hostileStation") {
    const signature = HOSTILE_STATION_SIGNATURE;
    const tier = signature.tiers.find((tier) => tier.position === position);
    return tier
      ? new Map(
          signature.fill
            .slice(0, tier.count)
            .map((id) => [
              id,
              id === signature.special.mount ? signature.special.weapon : signature.remaining,
            ]),
        )
      : null;
  }
  const mounts = enemyCatalog[archetype].mounts;
  if (archetype === "platform" && mounts) {
    const tier = mountTier(mounts, position);
    return new Map(
      mounts.fill.filter((id) => tier.mounts[id]).map((id) => [id, PLATFORM_SIGNATURE.weapon]),
    );
  }
  if (!(archetype === "capital" || archetype === "frigate") || !mounts) {
    return null;
  }
  const tier = mountTier(mounts, position);
  return signatureLoadout(
    archetype,
    position,
    shipId,
    mounts.fill.filter((id) => tier.mounts[id]),
  );
}

/**
 * Each small craft carries its signature weapon at level 1 at every route position.
 */
export const SMALL_CRAFT_WEAPONS = {
  fighter: armed(SMALL_CRAFT_SIGNATURES.fighter),
  interceptor: armed(SMALL_CRAFT_SIGNATURES.interceptor),
  retaliator: armed(SMALL_CRAFT_SIGNATURES.retaliator),
  swarm: armed(SMALL_CRAFT_SIGNATURES.swarm),
};

/** Shared ship-sized defaults; each archetype states its own physics. */
const base: Omit<EnemyDefinition, "physics"> = {
  aggression: "sight",
  behaviour: { kind: "chase" },
  engagement: 360,
  escortFallback: { burstVolleys: 3, kind: "hitAndRun" },
  fire: enemyFire("fighter", SMALL_CRAFT_WEAPONS.fighter),
  hardpoints: [],
  hp: 4,
  morale: { individualHpRatio: 0.3, packLossRatio: 0.5 },
  navigation: ENEMY_NAVIGATION,
  perception: 650,
  pursuit: { homeRadius: 2000, maxSeconds: 30, rearmSeconds: 2, unseenSeconds: 6 },
  retreats: { hitAndRun: ENEMY_RETREAT, morale: ENEMY_RETREAT },
  sizeRatio: ENEMY_SIZE_RATIOS.fighter,
  steering: { separation: 70, wobble: 0 },
};
const siege: Behaviour = { kind: "siege", speedFraction: 0.5 };

/** Provisional tuning in world units and seconds, not user-selected values. */
export const enemyCatalog = {
  capital: {
    ...base,
    behaviour: siege,
    engagement: 750,
    // Five Ada widths across: hit areas stay apart and the whole hull reads on screen.
    hardpoints: [
      command,
      engine("engine-left", -0.25, 0.4),
      engine("engine-right", 0.25, 0.4),
      ...mountedHardpoints("capital", capitalMounts, capitalMounts.tiers[0], 3),
    ],
    hp: 18,
    morale: { individualHpRatio: 0, packLossRatio: 1 },
    mounts: capitalMounts,
    perception: 1100,
    physics: SHIP_PHYSICS.capital,
    sizeRatio: ENEMY_SIZE_RATIOS.capital,
  },
  fighter: {
    ...base,
    behaviour: { burstVolleys: 3, kind: "hitAndRun" },
    physics: SHIP_PHYSICS.fighter,
    standoff: { far: 350, near: 250 },
  },
  frigate: {
    ...base,
    behaviour: siege,
    engagement: 500,
    hardpoints: [
      engine("engine", 0, 0.3),
      ...mountedHardpoints("frigate", frigateMounts, frigateMounts.tiers[0], 3),
    ],
    hp: 10,
    // A heavy never flees on hull damage.
    morale: { individualHpRatio: 0, packLossRatio: 1 },
    mounts: frigateMounts,
    physics: SHIP_PHYSICS.frigate,
    sizeRatio: ENEMY_SIZE_RATIOS.frigate,
  },
  interceptor: {
    ...base,
    behaviour: { kind: "strafe", loopDistance: 420, passDistance: 150 },
    engagement: 260,
    fire: enemyFire("interceptor", SMALL_CRAFT_WEAPONS.interceptor),
    hp: 3,
    physics: SHIP_PHYSICS.interceptor,
    sizeRatio: ENEMY_SIZE_RATIOS.interceptor,
    // Its band when a roster gives it chase or hitAndRun.
    standoff: { far: 250, near: 150 },
  },
  platform: {
    ...base,
    behaviour: { kind: "siege", speedFraction: 0 },
    engagement: 520,
    hardpoints: mountedHardpoints("platform", platformMounts, platformMounts.tiers[0]!, 6),
    hp: 12,
    morale: { individualHpRatio: 0, packLossRatio: 1 },
    mounts: platformMounts,
    navigation: null,
    perception: 520,
    physics: SHIP_PHYSICS.platform,
    sizeRatio: ENEMY_SIZE_RATIOS.platform,
  },
  retaliator: {
    ...base,
    aggression: "retaliate",
    fire: enemyFire("retaliator", SMALL_CRAFT_WEAPONS.retaliator),
    hp: 8,
    physics: SHIP_PHYSICS.retaliator,
    sizeRatio: ENEMY_SIZE_RATIOS.retaliator,
    standoff: { far: 350, near: 250 },
  },
  swarm: {
    ...base,
    behaviour: { kind: "swarm" },
    fire: enemyFire("swarm", SMALL_CRAFT_WEAPONS.swarm),
    hp: 2,
    morale: { individualHpRatio: 0.5, packLossRatio: 0.4 },
    physics: SHIP_PHYSICS.swarm,
    sizeRatio: ENEMY_SIZE_RATIOS.swarm,
    standoff: { far: 300, near: 200 },
    steering: { separation: 85, wobble: 0.65 },
  },
} satisfies Record<string, EnemyDefinition>;

export type EnemyArchetype = keyof typeof enemyCatalog;

/**
 * One weighted encounter choice; groupSize is an inclusive member range. A battle adds
 * `escorts` that guard its first member.
 */
export interface EncounterEntry {
  archetype: EnemyArchetype;
  escorts?: { archetype: EnemyArchetype; count: number };
  groupSize: readonly [number, number];
  weight: number;
}

/**
 * Open-space encounter tables by route position (galaxies.ts); frigates and capitals also keep
 * their route roles. A placeholder reads the built galaxy before it.
 */
export const galaxyEncounters: Readonly<Partial<Record<RoutePosition, readonly EncounterEntry[]>>> =
  {
    1: [
      { archetype: "swarm", groupSize: [4, 6], weight: 0.35 },
      { archetype: "fighter", groupSize: [1, 3], weight: 0.3 },
      { archetype: "interceptor", groupSize: [1, 1], weight: 0.15 },
      { archetype: "retaliator", groupSize: [1, 1], weight: 0.1 },
      { archetype: "frigate", groupSize: [1, 1], weight: 0.07 },
      {
        archetype: "capital",
        escorts: { archetype: "fighter", count: 4 },
        groupSize: [1, 1],
        weight: 0.03,
      },
    ],
    2: [
      { archetype: "swarm", groupSize: [5, 8], weight: 0.25 },
      { archetype: "fighter", groupSize: [3, 4], weight: 0.3 },
      { archetype: "interceptor", groupSize: [1, 2], weight: 0.15 },
      { archetype: "retaliator", groupSize: [1, 1], weight: 0.1 },
      { archetype: "frigate", groupSize: [1, 1], weight: 0.15 },
      {
        archetype: "capital",
        escorts: { archetype: "fighter", count: 4 },
        groupSize: [1, 1],
        weight: 0.05,
      },
    ],
    3: [
      { archetype: "swarm", groupSize: [6, 8], weight: 0.2 },
      { archetype: "fighter", groupSize: [3, 4], weight: 0.25 },
      { archetype: "interceptor", groupSize: [2, 2], weight: 0.25 },
      { archetype: "retaliator", groupSize: [1, 1], weight: 0.08 },
      { archetype: "frigate", groupSize: [1, 1], weight: 0.15 },
      {
        archetype: "capital",
        escorts: { archetype: "fighter", count: 5 },
        groupSize: [1, 1],
        weight: 0.07,
      },
    ],
    4: [
      { archetype: "swarm", groupSize: [6, 8], weight: 0.2 },
      { archetype: "fighter", groupSize: [3, 4], weight: 0.3 },
      { archetype: "interceptor", groupSize: [2, 2], weight: 0.15 },
      { archetype: "retaliator", groupSize: [1, 1], weight: 0.1 },
      { archetype: "frigate", groupSize: [1, 2], weight: 0.18 },
      {
        archetype: "capital",
        escorts: { archetype: "fighter", count: 4 },
        groupSize: [1, 1],
        weight: 0.07,
      },
    ],
    5: [
      { archetype: "swarm", groupSize: [5, 7], weight: 0.25 },
      { archetype: "fighter", groupSize: [2, 4], weight: 0.4 },
      { archetype: "interceptor", groupSize: [1, 2], weight: 0.12 },
      { archetype: "retaliator", groupSize: [1, 1], weight: 0.1 },
      { archetype: "frigate", groupSize: [1, 1], weight: 0.1 },
      {
        archetype: "capital",
        escorts: { archetype: "fighter", count: 4 },
        groupSize: [1, 1],
        weight: 0.03,
      },
    ],
    6: [
      { archetype: "swarm", groupSize: [6, 8], weight: 0.18 },
      { archetype: "fighter", groupSize: [3, 5], weight: 0.25 },
      { archetype: "interceptor", groupSize: [2, 2], weight: 0.15 },
      { archetype: "retaliator", groupSize: [1, 1], weight: 0.07 },
      { archetype: "frigate", groupSize: [1, 2], weight: 0.25 },
      {
        archetype: "capital",
        escorts: { archetype: "fighter", count: 6 },
        groupSize: [1, 1],
        weight: 0.1,
      },
    ],
  };

/**
 * Roster behaviour changes by route position (gameplay/ships.md rosters). A placeholder reads
 * the built galaxy before it.
 */
export const galaxyArchetypes: Readonly<
  Partial<
    Record<RoutePosition, Partial<Record<EnemyArchetype, Pick<EnemyDefinition, "behaviour">>>>
  >
> = {
  1: {},
  2: {
    fighter: { behaviour: { kind: "chase" } },
    interceptor: { behaviour: { kind: "chase" } },
  },
  // Needle's patrols chase; its interceptors strafe.
  3: { fighter: { behaviour: { kind: "chase" } } },
  4: {},
  5: {
    interceptor: { behaviour: { burstVolleys: 3, kind: "hitAndRun" } },
  },
  6: { fighter: { behaviour: { kind: "chase" } } },
};

/** The small craft, whose hull HP and weapon each position sets. */
export type SmallCraft = keyof typeof SMALL_CRAFT_WEAPONS;
/** One route position's difficulty (gameplay/ships.md "Difficulty"). */
export interface PositionDifficulty {
  /** Multiplies the roster's frigate and capital weights before the weights renormalize. */
  heavyShare: number;
  /** HP of every heavy hardpoint: weapon, engine, command and platform turret. */
  hardpointHp: number;
  /** Hull HP of a frigate and a capital; a platform's hull is half the frigate's. */
  hulls: { capital: number; frigate: number };
  /** Hull HP of each small craft. */
  hp: Readonly<Record<SmallCraft, number>>;
  /** Added to both ends of every swarm and fighter group range. */
  groupBonus: number;
  /** Multipliers on the base catalog's perception, fire rate and encounter rate. */
  rates: { encounters: number; fire: number; notice: number };
}

/**
 * One tuning value multiplying every enemy's HP, the fire rate and the encounter rate at every
 * position, so the whole curve tunes at once; Stardust uses the unscaled HP.
 */
export const DIFFICULTY_SCALE = 1;

const position = (
  hp: [swarm: number, fighter: number, interceptor: number, retaliator: number],
  groupBonus: number,
  rates: [notice: number, fire: number, encounters: number],
  hardpointHp: number,
  hulls: [frigate: number, capital: number],
  heavyShare: number,
): PositionDifficulty => ({
  groupBonus,
  hardpointHp,
  heavyShare,
  hp: { fighter: hp[1], interceptor: hp[2], retaliator: hp[3], swarm: hp[0] },
  hulls: { capital: hulls[1], frigate: hulls[0] },
  rates: { encounters: rates[2], fire: rates[1], notice: rates[0] },
});

/** Difficulty by route position (gameplay/ships.md "Difficulty"). */
export const POSITION_DIFFICULTY: Readonly<Record<RoutePosition, PositionDifficulty>> = {
  1: position([2, 4, 3, 8], 1, [1.2, 1.44, 1.725], 5, [20, 40], 1),
  2: position([2, 5, 3, 9], 1, [1.3, 1.63, 1.8975], 5, [22, 44], 1),
  3: position([3, 5, 4, 10], 2, [1.4, 1.81, 2.07], 6, [30, 60], 1.2),
  4: position([3, 6, 4, 11], 2, [1.45, 1.88, 2.2425], 6, [32, 64], 1.3),
  5: position([3, 6, 5, 11], 3, [1.5, 1.94, 2.415], 7, [44, 88], 1.4),
  6: position([3, 6, 5, 12], 3, [1.5, 2, 2.5875], 7, [48, 96], 1.5),
};

/** A galaxy's difficulty, by its route position. */
export function difficultyOf(galaxy: GalaxyNumber): PositionDifficulty {
  return POSITION_DIFFICULTY[ROUTE_POSITION[galaxy]];
}

/** An archetype's hull HP at a galaxy's position before difficultyScale. */
export function unscaledHullHp(galaxy: GalaxyNumber, archetype: EnemyArchetype): number {
  const difficulty = difficultyOf(galaxy);
  switch (archetype) {
    case "capital":
    case "frigate":
      return difficulty.hulls[archetype];
    case "platform":
      return difficulty.hulls.frigate / 2;
    default:
      return difficulty.hp[archetype];
  }
}

/** Frigates, capitals and platforms: hull HP and hardpoints, disabled and salvaged. */
export const HEAVIES: readonly EnemyArchetype[] = ["frigate", "capital", "platform"];

/** Heavy salvage rewards by route position, independent of hull, part HP and mount count. */
export const HEAVY_STARDUST = {
  capital: [14, 14, 22, 22, 33, 33],
  frigate: [6, 6, 10, 10, 15, 15],
  platform: [4, 4, 5, 5, 6, 6],
} as const;

/** Small craft use half their unscaled hull HP; heavies use their fixed salvage rewards. */
export function enemyStardust(galaxy: GalaxyNumber, archetype: EnemyArchetype): number {
  if (Object.hasOwn(HEAVY_STARDUST, archetype)) {
    return HEAVY_STARDUST[archetype as keyof typeof HEAVY_STARDUST][ROUTE_POSITION[galaxy] - 1]!;
  }
  return Math.max(1, Math.floor(unscaledHullHp(galaxy, archetype) / 2));
}

/** A galaxy's encounter rate: its position's, times difficultyScale. */
export function encounterRate(galaxy: GalaxyNumber): number {
  return difficultyOf(galaxy).rates.encounters * DIFFICULTY_SCALE;
}

/**
 * A galaxy's encounter table: its roster with the position's group bonus on both ends of every
 * swarm and fighter range and its heavy share on the frigate and capital weights.
 */
export function encounterTable(galaxy: GalaxyNumber): readonly EncounterEntry[] {
  const { groupBonus, heavyShare } = difficultyOf(galaxy);
  return byPosition(galaxyEncounters, galaxy).map((entry) => ({
    ...entry,
    ...(entry.archetype === "frigate"
      ? { escorts: { archetype: "fighter" as const, count: FRIGATE_ESCORT_COUNT } }
      : {}),
    groupSize:
      entry.archetype === "interceptor" || entry.archetype === "retaliator"
        ? [1, 1]
        : entry.archetype === "swarm" || entry.archetype === "fighter"
          ? [entry.groupSize[0] + groupBonus, entry.groupSize[1] + groupBonus]
          : entry.groupSize,
    weight:
      entry.archetype === "frigate" || entry.archetype === "capital"
        ? entry.weight * heavyShare
        : entry.weight,
  }));
}

/**
 * The enemy-only weapons' damage per hit as multiples of base shot damage (gameplay/ships.md
 * "Enemy weapons"): a ring burst bolt 1.5, a mine 3 and a charged lance 6.
 */
export const ENEMY_ONLY_DAMAGE: Readonly<Record<EnemyOnlyWeapon, number>> = {
  chargedLance: 6,
  mineLayer: 3,
  ringBurst: 1.5,
};

/**
 * A profile's damage per hit as a multiple of base shot damage: a shared weapon's at its level,
 * the same whoever fires it, or an enemy-only weapon's own.
 */
export function fireDamageRatio(profile: Pick<FireProfile, "level" | "weapon">): number {
  const weapon = profile.weapon;
  if (enemyOnly(weapon)) {
    return ENEMY_ONLY_DAMAGE[weapon];
  }
  return weaponAt(weapon, profile.level).damageRatio * ENEMY_SHARED_WEAPON_TUNING.damageMultiplier;
}

/** Natural enemy aim for every aimed enemy weapon (gameplay/ships.md "Enemy aim"). */
export const ENEMY_AIM = {
  /** Seconds for the drift to swing through one cycle. */
  driftPeriod: 1.5,
  /** Peak sideways drift either side of the line of fire, in radians (4 degrees). */
  driftRadians: (4 * Math.PI) / 180,
  /** Lead by route position: the share of Ada's predicted movement a shot allows for. */
  lead: { 1: 0.2, 2: 0.4, 3: 0.6, 4: 0.8, 5: 0.9, 6: 1 },
  /** A shot leads Ada by at most this many seconds of her movement. */
  maxLeadSeconds: 1,
  /** Each ship's lead skill is the position's lead times 1 plus up to this much either way. */
  skillSpread: 0.1,
  /**
   * Time constant, in seconds, of the average of Ada's velocity that aim predicts from; it
   * settles on a new velocity within about 0.3 seconds.
   */
  velocitySeconds: 0.1,
} as const satisfies {
  driftPeriod: number;
  driftRadians: number;
  lead: Readonly<Record<RoutePosition, number>>;
  maxLeadSeconds: number;
  skillSpread: number;
  velocitySeconds: number;
};

/** Capital battle escorts, in world units. */
export const FRIGATE_ESCORT_COUNT = 2;

export const escortTuning: EscortTuning = { interceptRadius: 600, stationGap: 60 };

/** Small encounters separated by quiet travel; the adapter owns seeded placement. */
export const enemyEncounterTuning = {
  /** Ballistic debris drifts at a seeded speed in this range, in world units per second. */
  debris: { count: [3, 7], speed: [16, 50] },
  quietDistance: 1800,
  quietSeconds: 12,
} as const;

/** Quiet travel and time between encounters shorten with the galaxy's encounter rate. */
export function encounterQuiet(galaxy: GalaxyNumber): { distance: number; seconds: number } {
  const rate = encounterRate(galaxy);
  return {
    distance: enemyEncounterTuning.quietDistance / rate,
    seconds: enemyEncounterTuning.quietSeconds / rate,
  };
}

export { PHANTOM_FLAGSHIP_ID };
export const FLAGSHIP_PART_HP = 9;
/** Shared weapons use the player cadence share; enemy-only weapons retain their galaxy curve. */
export function enemyFireRate(
  galaxy: GalaxyNumber,
  archetype: keyof typeof ENEMY_FIRE_MULTIPLIERS,
  weapon: EnemyWeapon,
): number {
  const shipRate = ENEMY_FIRE_MULTIPLIERS[archetype];
  return enemyOnly(weapon)
    ? difficultyOf(galaxy).rates.fire * DIFFICULTY_SCALE * shipRate
    : ENEMY_SHARED_WEAPON_TUNING.fireRateShare[ROUTE_POSITION[galaxy]] *
        shipRate *
        enemyRelativeFireRate(archetype, weapon);
}

const scaled = new Map<string, EnemyDefinition>();
/**
 * The catalog definition at a galaxy's route position: its roster behaviour, its position's
 * weapons, hull and hardpoint HP, perception and fire rate, with
 * difficultyScale on HP and fire rate. A heavy's weapon hardpoints are its tier's armed mounts,
 * armed with the loadout ship `shipId` draws (heavyLoadout).
 */
export function enemyDefinition(
  galaxy: GalaxyNumber,
  archetype: EnemyActorKind,
  shipId = "",
  weaponLevel: WeaponLevel = 1,
): EnemyDefinition {
  if (archetype === "hostileStation") {
    return hostileStationDefinition(
      {
        base: enemyCatalog.platform,
        fire: (weapon) => {
          const profile = enemyFire("hostileStation", { level: weaponLevel, weapon });
          return {
            ...profile,
            interval: profile.interval / enemyFireRate(galaxy, "hostileStation", weapon),
          };
        },
        partHp: difficultyOf(galaxy).hardpointHp * DIFFICULTY_SCALE,
      },
      { galaxy, weaponLevel },
    );
  }
  const route = ROUTE_POSITION[galaxy];
  const assetKey = enemyAssetKey({ archetype, id: shipId });
  const loadout = heavyLoadout(archetype, route, shipId);
  const flagship = galaxy === 6 && archetype === "capital" && shipId === PHANTOM_FLAGSHIP_ID;
  const weapons = loadout ? [...loadout.values()].join(",") : "";
  const key = `${assetKey}:${flagship ? "flagship:" : ""}${galaxy}:${archetype}:${weaponLevel}:${weapons}`;
  let definition = scaled.get(key);
  if (!definition) {
    const difficulty = difficultyOf(galaxy);
    const entry: EnemyDefinition = enemyCatalog[archetype];
    const small = Object.hasOwn(SMALL_CRAFT_WEAPONS, archetype)
      ? SMALL_CRAFT_WEAPONS[archetype as SmallCraft]
      : null;
    const catalog: EnemyDefinition = {
      ...entry,
      ...byPosition(galaxyArchetypes, galaxy)[archetype],
      fire: enemyFire(archetype, {
        level: weaponLevel,
        weapon: small?.weapon ?? entry.fire.weapon,
      }),
      hardpoints: entry.mounts
        ? [
            ...entry.hardpoints.filter((part) => part.kind !== "weapon"),
            ...mountedHardpoints(
              archetype,
              entry.mounts,
              mountTier(entry.mounts, route),
              0,
              loadout,
              weaponLevel,
            ),
          ]
        : entry.hardpoints,
    };
    const faster = (fire: FireProfile): FireProfile => ({
      ...fire,
      interval: fire.interval / enemyFireRate(galaxy, archetype, fire.weapon),
    });
    const hardpointHp = difficulty.hardpointHp * DIFFICULTY_SCALE;
    definition = {
      ...catalog,
      assetKey,
      behaviour: catalog.behaviour,
      escortFallback: catalog.escortFallback,
      fire: faster(catalog.fire),
      hardpoints: catalog.hardpoints.map((part) =>
        part.kind === "weapon"
          ? { ...part, fire: faster(part.fire), hp: hardpointHp }
          : { ...part, hp: hardpointHp },
      ),
      hp: unscaledHullHp(galaxy, archetype) * DIFFICULTY_SCALE,
      perception: catalog.perception * difficulty.rates.notice,
    };
    if (flagship) {
      definition = {
        ...definition,
        behaviour: { kind: "siege", speedFraction: 0.25 },
        hardpoints: definition.hardpoints.map((part) => ({ ...part, hp: FLAGSHIP_PART_HP })),
        hp: 160,
        hullFloor: 1,
        pursuit: { ...definition.pursuit, homeRadius: 800 },
        sizeRatio: ENEMY_SIZE_RATIOS.flagship,
      };
    }
    scaled.set(key, definition);
  }
  return definition;
}
