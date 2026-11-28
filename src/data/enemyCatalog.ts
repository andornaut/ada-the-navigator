import type { EnemyActorKind } from "./enemyActors.ts";
import { ENEMY_SIZE_RATIOS } from "./enemyDimensions.ts";
import {
  type EnemyGeometryKey,
  enemyGeometryKey,
  type HeavyHullProfile,
  PHANTOM_FLAGSHIP_ID,
} from "./enemyIdentity.ts";
import { ART_FRONT_LASER_MOUNTS } from "./enemyMuzzles.ts";
import { ENEMY_FORWARD_GUNS, type ForwardGuns } from "./enemyNavigation.ts";
import {
  enemySharedMountRate,
  HEAVY_SIGNATURES,
  HOSTILE_STATION_SIGNATURE,
  PLATFORM_SIGNATURE,
  platformSignatureTiers,
  signatureLoadout,
  SMALL_CRAFT_SIGNATURES,
} from "./enemySignatures.ts";
import { ENEMY_SHARED_WEAPON_TUNING, equippedEnemyWeaponLevel } from "./enemyWeaponLevels.ts";
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
  pelletDelays?: readonly number[];
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
/**
 * A weapon hardpoint is a turret that tracks Ada unless `fixed`: a fixed front weapon fires only
 * along the hull facing, while its aim point is within the forward guns' nose arc.
 */
export type HardpointDefinition = HardpointBase &
  ({ kind: "engine" | "command" } | { fire: FireProfile; fixed?: true; kind: "weapon" });
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

/**
 * How a ship's hull weapon is mounted, which also sets how its hull faces. `turrets`: every
 * turret tracks Ada and the hull faces its travel. `forward`: fixed forward guns (ForwardGuns);
 * the hull keeps its nose on Ada and strafes while fighting her. Hardpoint weapons are turrets,
 * except a heavy's `fixed` front Lasers.
 */
export type EnemyGuns = { kind: "turrets" } | ({ kind: "forward" } & ForwardGuns);
const FORWARD_GUNS: EnemyGuns = { kind: "forward", ...ENEMY_FORWARD_GUNS };
const TURRETS: EnemyGuns = { kind: "turrets" };

export interface EnemyDefinition {
  readonly assetKey?: EnemyGeometryKey;
  aggression: "sight" | "retaliate";
  behaviour: Behaviour;
  /** An escort's behaviour once its capital is gone or disabled (gameplay/ships.md "Behaviours"). */
  escortFallback: Extract<Behaviour, { kind: "hitAndRun" }>;
  engagement: number;
  fire: FireProfile;
  fireClockPolicy: "continuous" | "staggered-and-paused";
  guns: EnemyGuns;
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
/** Unpositioned enemy-only profiles use the first applicable battle interval. */
export const ENEMY_FIRE: Readonly<Record<EnemyOnlyWeapon, Cadence>> = {
  chargedLance: { interval: 4 },
  mineLayer: { interval: 2 },
  ringBurst: { interval: 3 },
};
/**
 * An enemy projectile flies this share of Ada's level 1 speed for the same weapon: `forward` from
 * the forward-gun small craft, `heavy` from heavies and hostile stations (gameplay/ships.md
 * "Enemy weapons").
 */
export const ENEMY_SPEED_SHARE = { forward: 0.6, heavy: 0.8 } as const;
/** Frigates, capitals and platforms: hull HP and hardpoints, disabled and salvaged. */
export const HEAVIES: readonly EnemyArchetype[] = ["frigate", "capital", "platform"];
/** The share of Ada's level 1 speed an archetype's shared-weapon projectiles fly at. */
export function enemySpeedShare(archetype: string): number {
  return archetype === "hostileStation" || HEAVIES.some((heavy) => heavy === archetype)
    ? ENEMY_SPEED_SHARE.heavy
    : ENEMY_SPEED_SHARE.forward;
}
/** World units per second the enemy-only weapons' projectiles fly: the ring burst's bolts. */
const ENEMY_ONLY_SPEED: Readonly<Record<EnemyOnlyWeapon, number>> = {
  chargedLance: 0,
  mineLayer: 0,
  ringBurst: 320,
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
 * level, the same whoever fires it, at the enemy's own cadence, its projectiles at the
 * archetype's ENEMY_SPEED_SHARE of Ada's level 1 speed for the weapon.
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
    ...(shared?.pelletDelays ? { pelletDelays: shared.pelletDelays } : {}),
    level,
    projectile: shared?.projectileKind ?? ENEMY_ONLY_PROJECTILE[weapon as EnemyOnlyWeapon],
    projectileSpeed: enemyOnly(weapon)
      ? ENEMY_ONLY_SPEED[weapon]
      : enemySpeedShare(archetype) * weaponSpeed(weapon, 1),
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
    bow: { x: 0, y: -0.2695314285714286 },
    port: { x: -0.3675428571428571, y: 0 },
    spine: { x: 0, y: 0.03062857142857143 },
    starboard: { x: 0.3675428571428571, y: 0 },
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
    "claw-left": { x: -0.1488888888888889, y: -0.4466666666666667 },
    "claw-right": { x: 0.1488888888888889, y: -0.4466666666666667 },
    "stern-left": { x: -0.09925925925925927, y: 0.30770370370370376 },
    "stern-right": { x: 0.09925925925925927, y: 0.30770370370370376 },
    "weapon-left": { x: -0.34740740740740744, y: -0.2977777777777778 },
    "weapon-rear-left": { x: -0.4168888888888889, y: 0.07940740740740741 },
    "weapon-rear-right": { x: 0.4168888888888889, y: 0.07940740740740741 },
    "weapon-right": { x: 0.34740740740740744, y: -0.2977777777777778 },
  },
  tiers: [
    {
      mounts: {
        "claw-left": null,
        "claw-right": null,
        "stern-left": null,
        "stern-right": null,
        "weapon-left": armed(HEAVY_SIGNATURES.capital.lance.weapon),
        "weapon-rear-left": armed(HEAVY_SIGNATURES.capital.pointDefense),
        "weapon-rear-right": armed(HEAVY_SIGNATURES.capital.pointDefense),
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
        "weapon-rear-left": armed(HEAVY_SIGNATURES.capital.pointDefense),
        "weapon-rear-right": armed(HEAVY_SIGNATURES.capital.pointDefense),
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
        "weapon-rear-left": armed(HEAVY_SIGNATURES.capital.pointDefense),
        "weapon-rear-right": armed(HEAVY_SIGNATURES.capital.pointDefense),
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
const PLATFORM_MOUNT_OFFSET = 0.2899999999999999;
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

export const AUTHORED_PURSUIT_HOME_RADIUS = 2000;

/**
 * Fixed front Lasers each moving heavy carries in addition to its mounts (gameplay/ships.md
 * "Difficulty"): a frigate one and a capital, the flagship included, two. Platforms and hostile
 * stations carry none.
 */
export const FRONT_LASER_COUNT = { capital: 2, frigate: 1 } as const;
/** One fixed front Laser's mount on a hull design: Art's prow position. */
export interface FrontLaserMount {
  id: string;
  /** Fraction of hull width in the hull's local frame: `-y` forward, `+x` starboard. */
  offset: Point;
}
/** Front Laser mounts by hull design; each design lists exactly its class's FRONT_LASER_COUNT. */
export type FrontLaserMounts = Readonly<
  Partial<Record<EnemyGeometryKey, readonly FrontLaserMount[]>>
>;
/**
 * Art's prow mounts for the Shoulder and Twin hull frigates, the six capital designs and the
 * flagship, read from their hardpoints files.
 */
export const FRONT_LASER_MOUNTS: FrontLaserMounts = ART_FRONT_LASER_MOUNTS;

/**
 * A moving heavy's fixed front Laser hardpoints on its hull design's mounts, each firing the
 * shared Laser at `weaponLevel` with `hp`, before the galaxy's fire rate and part HP apply; none
 * for a design without mounts or a ship that carries none.
 */
export function frontLaserHardpoints(
  frontMounts: FrontLaserMounts,
  weaponLevel: WeaponLevel,
  hp: number,
  archetype: string,
  assetKey: EnemyGeometryKey,
): HardpointDefinition[] {
  const count = Object.hasOwn(FRONT_LASER_COUNT, archetype)
    ? FRONT_LASER_COUNT[archetype as keyof typeof FRONT_LASER_COUNT]
    : 0;
  const mounts = count ? (frontMounts[assetKey] ?? []) : [];
  if (mounts.length && mounts.length !== count) {
    throw new RangeError(`${assetKey} needs ${count} front Laser mounts, not ${mounts.length}`);
  }
  return mounts.map(({ id, offset }) => ({
    fire: enemyFire(archetype, { level: weaponLevel, weapon: "laser" }),
    fixed: true,
    hp,
    id,
    kind: "weapon",
    offset: { ...offset },
  }));
}

/** Shared ship-sized defaults; each archetype states its own physics. */
const base: Omit<EnemyDefinition, "guns" | "physics"> = {
  aggression: "sight",
  behaviour: { kind: "chase" },
  engagement: 360,
  escortFallback: { burstVolleys: 3, kind: "hitAndRun" },
  fire: enemyFire("fighter", SMALL_CRAFT_WEAPONS.fighter),
  fireClockPolicy: "continuous",
  hardpoints: [],
  hp: 4,
  morale: { individualHpRatio: 0.3, packLossRatio: 0.5 },
  navigation: ENEMY_NAVIGATION,
  perception: 650,
  pursuit: {
    homeRadius: AUTHORED_PURSUIT_HOME_RADIUS,
    maxSeconds: 30,
    rearmSeconds: 2,
    unseenSeconds: 8,
  },
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
    fireClockPolicy: "staggered-and-paused",
    guns: TURRETS,
    // Five Ada widths across: hit areas stay apart and the whole hull reads on screen.
    hardpoints: [
      command,
      engine("engine-left", -0.24814814814814815, 0.3970370370370371),
      engine("engine-right", 0.24814814814814815, 0.3970370370370371),
      ...mountedHardpoints("capital", capitalMounts, capitalMounts.tiers[0], 3),
      ...frontLaserHardpoints(FRONT_LASER_MOUNTS, 1, 3, "capital", "capital"),
    ],
    hp: 18,
    morale: { individualHpRatio: 0, packLossRatio: 1 },
    mounts: capitalMounts,
    perception: 1100,
    physics: SHIP_PHYSICS.capital,
    pursuit: { ...base.pursuit, homeRadius: 1000 },
    sizeRatio: ENEMY_SIZE_RATIOS.capital,
  },
  fighter: {
    ...base,
    behaviour: { burstVolleys: 3, kind: "hitAndRun" },
    guns: FORWARD_GUNS,
    physics: SHIP_PHYSICS.fighter,
    pursuit: { ...base.pursuit, homeRadius: 2500 },
    standoff: { far: 350, near: 250 },
  },
  frigate: {
    ...base,
    behaviour: siege,
    engagement: 500,
    fireClockPolicy: "staggered-and-paused",
    guns: TURRETS,
    hardpoints: [
      engine("engine", 0, 0.3675428571428571),
      ...mountedHardpoints("frigate", frigateMounts, frigateMounts.tiers[0], 3),
      ...frontLaserHardpoints(FRONT_LASER_MOUNTS, 1, 3, "frigate", "frigate"),
    ],
    hp: 10,
    // A heavy never flees on hull damage.
    morale: { individualHpRatio: 0, packLossRatio: 1 },
    mounts: frigateMounts,
    physics: SHIP_PHYSICS.frigate,
    pursuit: { ...base.pursuit, homeRadius: 1500 },
    sizeRatio: ENEMY_SIZE_RATIOS.frigate,
  },
  interceptor: {
    ...base,
    behaviour: { kind: "strafe", loopDistance: 420, passDistance: 150 },
    engagement: 260,
    fire: enemyFire("interceptor", SMALL_CRAFT_WEAPONS.interceptor),
    guns: FORWARD_GUNS,
    hp: 3,
    physics: SHIP_PHYSICS.interceptor,
    pursuit: { ...base.pursuit, homeRadius: 3000 },
    sizeRatio: ENEMY_SIZE_RATIOS.interceptor,
    // Its band when a roster gives it chase or hitAndRun.
    standoff: { far: 250, near: 150 },
  },
  platform: {
    ...base,
    behaviour: { kind: "siege", speedFraction: 0 },
    engagement: 520,
    guns: TURRETS,
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
    guns: FORWARD_GUNS,
    hp: 8,
    physics: SHIP_PHYSICS.retaliator,
    pursuit: { ...base.pursuit, homeRadius: 1000 },
    sizeRatio: ENEMY_SIZE_RATIOS.retaliator,
    standoff: { far: 350, near: 250 },
  },
  swarm: {
    ...base,
    behaviour: { kind: "swarm" },
    fire: enemyFire("swarm", SMALL_CRAFT_WEAPONS.swarm),
    guns: FORWARD_GUNS,
    hp: 2,
    morale: { individualHpRatio: 0.5, packLossRatio: 0.4 },
    physics: SHIP_PHYSICS.swarm,
    pursuit: { ...base.pursuit, homeRadius: 2500 },
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
  /** Independent hull HP for the three heavy ship archetypes. */
  hulls: { capital: number; frigate: number; platform: number };
  /** Hull HP of each small craft. */
  hp: Readonly<Record<SmallCraft, number>>;
  /** Added to both ends of every swarm and fighter group range. */
  groupBonus: number;
  /** Multipliers on the base catalog's perception and encounter rate. */
  rates: { encounters: number; notice: number };
}

/**
 * One tuning value multiplying every enemy's HP and the encounter rate at every
 * position, so the whole curve tunes at once. Stardust has its own payout table.
 */
export const DIFFICULTY_SCALE = 1;

const position = (
  hp: [swarm: number, fighter: number, interceptor: number, retaliator: number],
  groupBonus: number,
  rates: [notice: number, encounters: number],
  hardpointHp: number,
  hulls: [frigate: number, capital: number, platform: number],
  heavyShare: number,
): PositionDifficulty => ({
  groupBonus,
  hardpointHp,
  heavyShare,
  hp: { fighter: hp[1], interceptor: hp[2], retaliator: hp[3], swarm: hp[0] },
  hulls: { capital: hulls[1], frigate: hulls[0], platform: hulls[2] },
  rates: { encounters: rates[1], notice: rates[0] },
});

/** Difficulty by route position (gameplay/ships.md "Difficulty"). */
export const POSITION_DIFFICULTY: Readonly<Record<RoutePosition, PositionDifficulty>> = {
  1: position([2, 4, 3, 15], 1, [1.2, 1.725], 10, [40, 80, 60], 1),
  2: position([2, 4, 3, 15], 1, [1.3, 1.8975], 10, [45, 100, 65], 1),
  3: position([4, 7, 5, 20], 2, [1.4, 2.07], 12, [50, 120, 70], 1.2),
  4: position([4, 7, 5, 20], 2, [1.45, 2.2425], 12, [55, 140, 75], 1.3),
  5: position([6, 10, 8, 25], 3, [1.5, 2.415], 14, [60, 160, 80], 1.4),
  6: position([6, 10, 8, 25], 3, [1.5, 2.5875], 14, [65, 180, 85], 1.5),
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
    case "platform":
      return difficulty.hulls[archetype];
    default:
      return difficulty.hp[archetype];
  }
}

/** Inclusive whole-number destruction payouts, regardless of route position or HP. */
export const ENEMY_STARDUST_RANGES = {
  capital: [20, 30],
  fighter: [2, 5],
  frigate: [10, 20],
  hostileStation: [20, 30],
  interceptor: [3, 5],
  platform: [15, 25],
  retaliator: [4, 6],
  swarm: [1, 3],
} as const satisfies Record<EnemyActorKind, readonly [number, number]>;

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
/** Archie's flagship: its hull HP and every part's, its front Lasers included. */
export const FLAGSHIP_HULL_HP = 320;
export const FLAGSHIP_PART_HP = 18;

/** Seconds between attack starts, including any warning already inside the weapon cycle. */
export function enemyFireInterval(
  galaxy: GalaxyNumber,
  archetype: EnemyActorKind,
  fire: Pick<FireProfile, "weapon" | "level">,
  fixed = false,
): number {
  const position = ROUTE_POSITION[galaxy];
  const { level, weapon } = fire;
  if (weapon === "chargedLance") {
    return 4 - Math.floor((position - 1) / 2);
  }
  if (weapon === "ringBurst") {
    return position >= 5 ? 2 : ENEMY_FIRE.ringBurst.interval;
  }
  if (weapon === "mineLayer") {
    return ENEMY_FIRE.mineLayer.interval;
  }
  return (
    weaponAt(weapon, level).intervalSeconds /
    enemySharedMountRate(position, archetype, weapon, fixed)
  );
}

const scaled = new WeakMap<FrontLaserMounts, Map<string, EnemyDefinition>>();
/**
 * The catalog definition at a galaxy's route position: its roster behaviour, its position's
 * weapons, hull and hardpoint HP, perception and fire rate, with
 * difficultyScale on HP. A heavy's weapon hardpoints are its tier's armed mounts,
 * armed with the loadout ship `shipId` draws (heavyLoadout), then its front Lasers on Art's prow
 * mounts (FRONT_LASER_MOUNTS).
 */
export function enemyDefinition(
  galaxy: GalaxyNumber,
  archetype: EnemyActorKind,
  shipId = "",
  weaponLevel: WeaponLevel = 1,
  hullProfile?: HeavyHullProfile,
): EnemyDefinition {
  return mountedEnemyDefinition(
    FRONT_LASER_MOUNTS,
    galaxy,
    archetype,
    shipId,
    weaponLevel,
    hullProfile,
  );
}

/** enemyDefinition with its front Lasers on `frontMounts` in place of FRONT_LASER_MOUNTS. */
export function mountedEnemyDefinition(
  frontMounts: FrontLaserMounts,
  galaxy: GalaxyNumber,
  archetype: EnemyActorKind,
  shipId = "",
  weaponLevel: WeaponLevel = 1,
  hullProfile?: HeavyHullProfile,
): EnemyDefinition {
  if (archetype === "hostileStation") {
    return hostileStationDefinition(
      {
        base: enemyCatalog.platform,
        fire: (weapon) => {
          const profile = enemyFire("hostileStation", { level: weaponLevel, weapon });
          return {
            ...profile,
            interval: enemyFireInterval(galaxy, "hostileStation", profile),
          };
        },
        hullScale: DIFFICULTY_SCALE,
        partHp: difficultyOf(galaxy).hardpointHp * DIFFICULTY_SCALE,
      },
      { galaxy, weaponLevel },
    );
  }
  const route = ROUTE_POSITION[galaxy];
  // The galaxy's hull design, such as the Twin hull frigate, supplies muzzles and collision.
  const assetKey = enemyGeometryKey(
    { archetype, ...(hullProfile === undefined ? {} : { hullProfile }), id: shipId },
    route,
  );
  const loadout = heavyLoadout(archetype, route, shipId);
  const flagship = galaxy === 6 && archetype === "capital" && shipId === PHANTOM_FLAGSHIP_ID;
  const weapons = loadout ? [...loadout.values()].join(",") : "";
  const key = `${assetKey}:${flagship ? "flagship:" : ""}${galaxy}:${archetype}:${weaponLevel}:${weapons}`;
  const cache = scaled.get(frontMounts) ?? new Map<string, EnemyDefinition>();
  scaled.set(frontMounts, cache);
  let definition = cache.get(key);
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
            ...frontLaserHardpoints(frontMounts, weaponLevel, 0, archetype, assetKey),
          ]
        : entry.hardpoints,
    };
    const withCadence = (fire: FireProfile, fixed = false): FireProfile => ({
      ...fire,
      interval: enemyFireInterval(galaxy, archetype, fire, fixed),
    });
    const hardpointHp = difficulty.hardpointHp * DIFFICULTY_SCALE;
    definition = {
      ...catalog,
      assetKey,
      behaviour: catalog.behaviour,
      escortFallback: catalog.escortFallback,
      fire: withCadence(catalog.fire),
      hardpoints: catalog.hardpoints.map((part) =>
        part.kind === "weapon"
          ? { ...part, fire: withCadence(part.fire, part.fixed), hp: hardpointHp }
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
        hp: FLAGSHIP_HULL_HP,
        sizeRatio: ENEMY_SIZE_RATIOS.flagship,
      };
    }
    cache.set(key, definition);
  }
  return definition;
}
