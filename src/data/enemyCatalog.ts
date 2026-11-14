import { byPosition, ROUTE_POSITION, type RoutePosition } from "./galaxies.ts";
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
/**
 * Each weapon's enemy cadence (gameplay/ships.md "Enemy weapons"), before the position's fire
 * rate. The Phaser and the lance are hitscan and mines are laid in place.
 */
export const ENEMY_FIRE: Readonly<Record<EnemyWeapon, Cadence>> = {
  chargedLance: { interval: 6 },
  heavyMissile: { interval: 4 },
  laser: { interval: 1.4 },
  mineLayer: { interval: 5 },
  multiLaser: { interval: 2.2 },
  phaser: { interval: 3 },
  rapidMissile: { interval: 2 },
  ringBurst: { interval: 3.5 },
  scattershot: { interval: 2.4 },
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
/** The swarm's slower, lighter Laser and the platform's two-shot Laser bursts. */
const ARCHETYPE_FIRE: Readonly<Partial<Record<string, Partial<Record<EnemyWeapon, Cadence>>>>> = {
  platform: { laser: { ...ENEMY_FIRE.laser, burst: { count: 2, gap: 0.15 } } },
  swarm: { laser: { interval: 1.8 } },
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
  const { level, weapon } = mounted;
  const cadence = ARCHETYPE_FIRE[archetype]?.[weapon] ?? ENEMY_FIRE[weapon];
  const shared = enemyOnly(weapon) ? null : weaponAt(weapon, level);
  return {
    ...cadence,
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
      mounts: { bow: null, port: armed("laser"), spine: null, starboard: armed("laser") },
      positions: [1, 2],
    },
    {
      mounts: {
        bow: null,
        port: armed("laser"),
        spine: armed("rapidMissile"),
        starboard: armed("laser"),
      },
      positions: [3, 4],
    },
    {
      mounts: {
        bow: armed("chargedLance"),
        port: armed("laser"),
        spine: armed("rapidMissile"),
        starboard: armed("laser"),
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
        "weapon-left": armed("laser"),
        "weapon-rear-left": armed("multiLaser"),
        "weapon-rear-right": armed("multiLaser"),
        "weapon-right": armed("laser"),
      },
      positions: [1, 2],
    },
    {
      mounts: {
        "claw-left": armed("rapidMissile"),
        "claw-right": armed("heavyMissile"),
        "stern-left": null,
        "stern-right": null,
        "weapon-left": armed("laser"),
        "weapon-rear-left": armed("multiLaser"),
        "weapon-rear-right": armed("multiLaser"),
        "weapon-right": armed("laser"),
      },
      positions: [3, 4],
    },
    {
      mounts: {
        "claw-left": armed("phaser"),
        "claw-right": armed("heavyMissile"),
        "stern-left": armed("ringBurst"),
        "stern-right": armed("mineLayer"),
        "weapon-left": armed("laser"),
        "weapon-rear-left": armed("rapidMissile"),
        "weapon-rear-right": armed("rapidMissile"),
        "weapon-right": armed("laser"),
      },
      positions: [5, 6],
    },
  ],
} as const satisfies WeaponMounts;
/**
 * Cartwheel's fixed ore-field guard: two turrets at Art's offsets (art/heavies.md "Turret
 * platform"), as in tools/enemy-hardpoints.json, each firing two-shot Laser bursts.
 */
const platformMounts = {
  fill: ["port", "starboard"],
  offsets: { port: { x: -0.29, y: 0 }, starboard: { x: 0.29, y: 0 } },
  tiers: [
    { mounts: { port: armed("laser"), starboard: armed("laser") }, positions: [1, 2] },
    { mounts: { port: armed("laser"), starboard: armed("laser") }, positions: [3, 4] },
    { mounts: { port: armed("laser"), starboard: armed("laser") }, positions: [5, 6] },
  ],
} as const satisfies WeaponMounts;

/** The mount tier for a route position. */
export function mountTier(mounts: WeaponMounts, position: RoutePosition): MountTier {
  return mounts.tiers.find(
    (tier) => position >= tier.positions[0] && position <= tier.positions[1],
  )!;
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
): HardpointDefinition[] {
  return mounts.fill.flatMap((id): HardpointDefinition[] => {
    const weapon = tier.mounts[id] && loadout?.get(id);
    const mounted = weapon ? armed(weapon) : tier.mounts[id];
    return mounted
      ? [
          {
            fire: enemyFire(archetype, mounted),
            hp,
            id,
            kind: "weapon",
            offset: { ...mounts.offsets[id]! },
          },
        ]
      : [];
  });
}

/**
 * Each heavy's weapon pool at positions 1-2, 3-4 and 5-6 (gameplay/ships.md "Enemy weapons"),
 * enemy-only weapons among them; a ship carries at most HEAVY_TYPES of its pool's types.
 */
export const HEAVY_POOLS: Readonly<
  Record<"capital" | "frigate", readonly [EnemyWeapon[], EnemyWeapon[], EnemyWeapon[]]>
> = {
  capital: [
    ["laser", "multiLaser", "rapidMissile"],
    ["laser", "multiLaser", "rapidMissile", "heavyMissile", "scattershot"],
    ["laser", "rapidMissile", "heavyMissile", "phaser", "scattershot", "ringBurst", "mineLayer"],
  ],
  frigate: [
    ["laser", "multiLaser", "rapidMissile"],
    ["laser", "multiLaser", "rapidMissile", "scattershot"],
    ["laser", "rapidMissile", "scattershot", "heavyMissile", "chargedLance"],
  ],
};
/** The most weapon types one heavy carries. */
export const HEAVY_TYPES = 3;
/** Weapons a heavy mounts at most once; its other types take the remaining mounts. */
export const SINGLE_MOUNT_WEAPONS: ReadonlySet<EnemyWeapon> = new Set<EnemyWeapon>([
  "chargedLance",
  "heavyMissile",
  "mineLayer",
  "phaser",
  "ringBurst",
]);

/** A stable random stream for a key: FNV-1a over its characters, then mulberry32. */
function keyRandom(key: string): () => number {
  let state = 2166136261;
  for (let index = 0; index < key.length; index++) {
    state = Math.imul(state ^ key.charCodeAt(index), 16777619);
  }
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let mix = Math.imul(state ^ (state >>> 15), 1 | state);
    mix = (mix + Math.imul(mix ^ (mix >>> 7), 61 | mix)) ^ mix;
    return ((mix ^ (mix >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * A frigate's or capital's weapon on each of its tier's armed mounts, or null for any other
 * archetype (gameplay/ships.md "Enemy weapons"). The ship draws at most HEAVY_TYPES types from
 * its position's pool, seeded by its id so it keeps them across save and resume; a pool smaller
 * than that gives every type. The mounts, in fill order, are dealt in turn among its types, each
 * of SINGLE_MOUNT_WEAPONS on one mount at most. A draw of single-mount types only swaps its last
 * for the pool's first repeatable type in draw order, so every mount is armed.
 */
export function heavyLoadout(
  archetype: EnemyArchetype,
  position: RoutePosition,
  shipId: string,
): ReadonlyMap<string, EnemyWeapon> | null {
  const mounts = enemyCatalog[archetype].mounts;
  if (!(archetype === "capital" || archetype === "frigate") || !mounts) {
    return null;
  }
  const pool = HEAVY_POOLS[archetype][Math.ceil(position / 2) - 1]!;
  const random = keyRandom(`${archetype}:${position}:${shipId}`);
  const order = [...pool];
  for (let index = order.length - 1; index > 0; index--) {
    const swap = Math.floor(random() * (index + 1));
    [order[index], order[swap]] = [order[swap]!, order[index]!];
  }
  let types = order.slice(0, HEAVY_TYPES);
  if (types.every((weapon) => SINGLE_MOUNT_WEAPONS.has(weapon))) {
    const repeatable = order.find((weapon) => !SINGLE_MOUNT_WEAPONS.has(weapon));
    if (repeatable) {
      types = [...types.slice(0, -1), repeatable];
    }
  }
  const tier = mountTier(mounts, position);
  const loadout = new Map<string, EnemyWeapon>();
  let turn = 0;
  for (const id of mounts.fill.filter((mount) => tier.mounts[mount])) {
    for (let tries = 0; tries < types.length; tries++) {
      const weapon = types[(turn + tries) % types.length]!;
      if (SINGLE_MOUNT_WEAPONS.has(weapon) && [...loadout.values()].includes(weapon)) {
        continue;
      }
      loadout.set(id, weapon);
      turn = (turn + tries + 1) % types.length;
      break;
    }
  }
  return loadout;
}

/**
 * Small craft weapons at positions 1-2, 3-4 and 5-6 (gameplay/ships.md "Enemy weapons"), every
 * one level 1; the base catalog carries the first.
 */
export const SMALL_CRAFT_WEAPONS: Readonly<
  Record<"fighter" | "interceptor" | "retaliator" | "swarm", readonly MountedWeapon[]>
> = {
  fighter: [armed("laser"), armed("rapidMissile"), armed("rapidMissile")],
  interceptor: [armed("laser"), armed("multiLaser"), armed("multiLaser")],
  retaliator: [armed("multiLaser"), armed("multiLaser"), armed("multiLaser")],
  swarm: [armed("laser"), armed("laser"), armed("laser")],
};

/** Shared ship-sized defaults; each archetype states its own physics. */
const base: Omit<EnemyDefinition, "physics"> = {
  aggression: "sight",
  behaviour: { kind: "chase" },
  engagement: 360,
  escortFallback: { burstVolleys: 3, kind: "hitAndRun" },
  fire: enemyFire("fighter", armed("laser")),
  hardpoints: [],
  hp: 4,
  morale: { individualHpRatio: 0.3, packLossRatio: 0.5 },
  navigation: ENEMY_NAVIGATION,
  perception: 650,
  pursuit: { homeRadius: 2000, maxSeconds: 30, rearmSeconds: 2, unseenSeconds: 6 },
  retreats: { hitAndRun: ENEMY_RETREAT, morale: ENEMY_RETREAT },
  sizeRatio: 1,
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
    sizeRatio: 5,
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
    sizeRatio: 4,
  },
  interceptor: {
    ...base,
    behaviour: { kind: "strafe", loopDistance: 420, passDistance: 150 },
    engagement: 260,
    hp: 3,
    physics: SHIP_PHYSICS.interceptor,
    sizeRatio: 0.75,
    // Its band when a roster gives it chase or hitAndRun.
    standoff: { far: 250, near: 150 },
  },
  platform: {
    ...base,
    behaviour: { kind: "siege", speedFraction: 0 },
    engagement: 520,
    hardpoints: mountedHardpoints("platform", platformMounts, platformMounts.tiers[0], 6),
    hp: 12,
    morale: { individualHpRatio: 0, packLossRatio: 1 },
    mounts: platformMounts,
    navigation: null,
    perception: 520,
    physics: SHIP_PHYSICS.platform,
    sizeRatio: 3,
  },
  retaliator: {
    ...base,
    aggression: "retaliate",
    fire: enemyFire("retaliator", SMALL_CRAFT_WEAPONS.retaliator[0]!),
    hp: 8,
    physics: SHIP_PHYSICS.retaliator,
    sizeRatio: 2,
    standoff: { far: 350, near: 250 },
  },
  swarm: {
    ...base,
    behaviour: { kind: "swarm" },
    fire: enemyFire("swarm", SMALL_CRAFT_WEAPONS.swarm[0]!),
    hp: 2,
    morale: { individualHpRatio: 0.5, packLossRatio: 0.4 },
    physics: SHIP_PHYSICS.swarm,
    sizeRatio: 0.65,
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
  1: position([2, 4, 3, 8], 1, [1.2, 1.44, 1.725], 4, [20, 40], 1),
  2: position([2, 5, 3, 9], 1, [1.3, 1.63, 1.8975], 4, [22, 44], 1),
  3: position([3, 5, 4, 10], 2, [1.4, 1.81, 2.07], 5, [30, 60], 1.2),
  4: position([3, 6, 4, 11], 2, [1.45, 1.88, 2.2425], 5, [32, 64], 1.3),
  5: position([3, 6, 5, 11], 3, [1.5, 1.94, 2.415], 6, [44, 88], 1.4),
  6: position([3, 6, 5, 12], 3, [1.5, 2, 2.5875], 6, [48, 96], 1.5),
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

/**
 * An enemy's Stardust at a galaxy's position (gameplay/economy.md "Earning Stardust"): half its
 * unscaled hit points, rounded down, and at least 1; a heavy counts all its hardpoints' hit
 * points, not its hull.
 */
export function enemyStardust(galaxy: GalaxyNumber, archetype: EnemyArchetype): number {
  const hp = HEAVIES.includes(archetype)
    ? enemyDefinition(galaxy, archetype).hardpoints.length * difficultyOf(galaxy).hardpointHp
    : unscaledHullHp(galaxy, archetype);
  return Math.max(1, Math.floor(hp / 2));
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
    groupSize:
      entry.archetype === "swarm" || entry.archetype === "fighter"
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
 * "Enemy weapons"): a ring burst bolt 1.5, a mine 3 and a charged lance 3.
 */
export const ENEMY_ONLY_DAMAGE: Readonly<Record<EnemyOnlyWeapon, number>> = {
  chargedLance: 3,
  mineLayer: 3,
  ringBurst: 1.5,
};

/**
 * A profile's damage per hit as a multiple of base shot damage: a shared weapon's at its level,
 * the same whoever fires it (every enemy weapon is level 1), or an enemy-only weapon's own.
 */
export function fireDamageRatio(profile: Pick<FireProfile, "level" | "weapon">): number {
  const weapon = profile.weapon;
  if (enemyOnly(weapon)) {
    return ENEMY_ONLY_DAMAGE[weapon];
  }
  return weaponAt(weapon, profile.level).damageRatio;
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

export const PHANTOM_FLAGSHIP_ID = "phantomFlagship";
const scaled = new Map<string, EnemyDefinition>();
/**
 * The catalog definition at a galaxy's route position: its roster behaviour, its position's
 * weapons, hull and hardpoint HP, perception and fire rate, with
 * difficultyScale on HP and fire rate. A heavy's weapon hardpoints are its tier's armed mounts,
 * armed with the loadout ship `shipId` draws (heavyLoadout).
 */
export function enemyDefinition(
  galaxy: GalaxyNumber,
  archetype: EnemyArchetype,
  shipId = "",
): EnemyDefinition {
  const route = ROUTE_POSITION[galaxy];
  const loadout = heavyLoadout(archetype, route, shipId);
  const flagship = galaxy === 6 && archetype === "capital" && shipId === PHANTOM_FLAGSHIP_ID;
  const key = `${flagship ? "flagship:" : ""}${galaxy}:${archetype}:${loadout ? [...loadout.values()].join(",") : ""}`;
  let definition = scaled.get(key);
  if (!definition) {
    const difficulty = difficultyOf(galaxy);
    const entry: EnemyDefinition = enemyCatalog[archetype];
    const small = Object.hasOwn(SMALL_CRAFT_WEAPONS, archetype)
      ? SMALL_CRAFT_WEAPONS[archetype as SmallCraft][Math.ceil(route / 2) - 1]!
      : null;
    const catalog: EnemyDefinition = {
      ...entry,
      ...byPosition(galaxyArchetypes, galaxy)[archetype],
      fire: small ? enemyFire(archetype, small) : entry.fire,
      hardpoints: entry.mounts
        ? [
            ...entry.hardpoints.filter((part) => part.kind !== "weapon"),
            ...mountedHardpoints(
              archetype,
              entry.mounts,
              mountTier(entry.mounts, route),
              0,
              loadout,
            ),
          ]
        : entry.hardpoints,
    };
    const fireRate = difficulty.rates.fire * DIFFICULTY_SCALE;
    const faster = (fire: FireProfile): FireProfile => ({
      ...fire,
      interval: fire.interval / fireRate,
    });
    const hardpointHp = difficulty.hardpointHp * DIFFICULTY_SCALE;
    definition = {
      ...catalog,
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
        hardpoints: definition.hardpoints.map((part) => ({ ...part, hp: 8 })),
        hp: 160,
        hullFloor: 1,
        pursuit: { ...definition.pursuit, homeRadius: 800 },
      };
    }
    scaled.set(key, definition);
  }
  return definition;
}
