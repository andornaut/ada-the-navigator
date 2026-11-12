import { byPosition, type RoutePosition } from "./galaxies.ts";
import { SHIP_PHYSICS, type ShipPhysics } from "./ship-physics.ts";
import type { EnemyWeapon, SectorId, WeaponLevel } from "./types.ts";

export interface Point {
  x: number;
  y: number;
}
export interface FireProfile {
  angles: number[];
  /** Bolts per volley fired `gap` seconds apart; a volley starts every `interval`. */
  burst?: { count: number; gap: number };
  id: string;
  interval: number;
  /** The weapon's level; an enemy-only weapon has only level 1. */
  level: WeaponLevel;
  projectile: "bolt" | "missile";
  projectileSpeedRatio: number;
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
  required: boolean;
}
export type HardpointDefinition = HardpointBase &
  ({ kind: "engine" | "command" } | { fire: FireProfile; kind: "weapon" });
/**
 * Movement behaviours an engaged enemy uses. None holds a standoff distance: each one
 * chases, escapes or alternates between the two. `retaliate` is the `aggression` trigger and
 * `flee` is the `morale` rule; capital battles assign `escort` to their fighters.
 */
export type Behaviour =
  /** Pursues Ada directly and keeps pressing in. */
  | { kind: "chase" }
  /** Chases with erratic wobble and peer separation. */
  | { kind: "swarm" }
  /** Rushes in; pulls away for `retreatSeconds` when hit or after `burstVolleys` volleys. */
  | { burstVolleys: number; kind: "hitAndRun"; retreatSeconds: number }
  /** Flies straight through once within `passDistance`, loops back beyond `loopDistance`. */
  | { kind: "strafe"; loopDistance: number; passDistance: number }
  /** Advances on Ada at `speedFraction` of maximum speed while its turrets fire. */
  | { kind: "siege"; speedFraction: number };
/** Escort stations sit `stationGap` beyond the capital's hull; escorts intercept within reach. */
export interface EscortTuning {
  interceptRadius: number;
  stationGap: number;
}
export interface EnemyDefinition {
  aggression: "sight" | "retaliate";
  behaviour: Behaviour;
  engagement: number;
  fire: FireProfile;
  hardpoints: HardpointDefinition[];
  hp: number;
  morale: { individualHpRatio: number; packLossRatio: number };
  /** A heavy's weapon mounts and their loadout by position tier. */
  mounts?: WeaponMounts;
  perception: number;
  physics: ShipPhysics;
  pursuit: { homeRadius: number; maxSeconds: number; unseenSeconds: number };
  sizeRatio: number;
  steering: { separation: number; wobble: number };
}

const engine = (id: string, x: number, y: number): HardpointDefinition => ({
  hp: 4,
  id,
  kind: "engine",
  offset: { x, y },
  required: true,
});
const bolt: FireProfile = {
  angles: [0],
  id: "turret-bolt",
  interval: 1.4,
  level: 1,
  projectile: "bolt",
  projectileSpeedRatio: 1.7,
  weapon: "basic",
};
const missile: FireProfile = {
  angles: [0],
  id: "straight-missile",
  interval: 3,
  level: 1,
  projectile: "missile",
  projectileSpeedRatio: 1.3,
  weapon: "rapidMissile",
};
const command: HardpointDefinition = {
  hp: 5,
  id: "command",
  kind: "command",
  offset: { x: 0, y: 0 },
  required: true,
};
const weapon = (fire: FireProfile, id: string, offset: Point, hp = 3): HardpointDefinition => ({
  fire,
  hp,
  id,
  kind: "weapon",
  offset: { ...offset },
  required: true,
});
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
      mounts: { bow: null, port: armed("basic"), spine: null, starboard: armed("basic") },
      positions: [1, 2],
    },
    {
      mounts: {
        bow: null,
        port: armed("basic", 2),
        spine: armed("rapidMissile", 2),
        starboard: armed("basic", 2),
      },
      positions: [3, 4],
    },
    {
      mounts: {
        bow: armed("chargedLance"),
        port: armed("basic", 3),
        spine: armed("rapidMissile", 3),
        starboard: armed("basic", 3),
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
        "weapon-left": armed("basic"),
        "weapon-rear-left": armed("multiLaser"),
        "weapon-rear-right": armed("multiLaser"),
        "weapon-right": armed("basic"),
      },
      positions: [1, 2],
    },
    {
      mounts: {
        "claw-left": armed("rapidMissile", 2),
        "claw-right": armed("heavyMissile"),
        "stern-left": null,
        "stern-right": null,
        "weapon-left": armed("basic", 2),
        "weapon-rear-left": armed("multiLaser", 2),
        "weapon-rear-right": armed("multiLaser", 2),
        "weapon-right": armed("basic", 2),
      },
      positions: [3, 4],
    },
    {
      mounts: {
        "claw-left": armed("phaser"),
        "claw-right": armed("heavyMissile"),
        "stern-left": armed("ringBurst"),
        "stern-right": armed("mineLayer"),
        "weapon-left": armed("basic", 3),
        "weapon-rear-left": armed("rapidMissile", 3),
        "weapon-rear-right": armed("rapidMissile", 3),
        "weapon-right": armed("basic", 3),
      },
      positions: [5, 6],
    },
  ],
} as const satisfies WeaponMounts;
/** Shared ship-sized defaults; each archetype states its own physics. */
const base: Omit<EnemyDefinition, "physics"> = {
  aggression: "sight",
  behaviour: { kind: "chase" },
  engagement: 360,
  fire: bolt,
  hardpoints: [],
  hp: 4,
  morale: { individualHpRatio: 0.3, packLossRatio: 0.5 },
  perception: 650,
  pursuit: { homeRadius: 1400, maxSeconds: 18, unseenSeconds: 3 },
  sizeRatio: 1,
  steering: { separation: 70, wobble: 0 },
};
const siege: Behaviour = { kind: "siege", speedFraction: 0.5 };
/**
 * Cartwheel's fixed ore-field guard: two required turrets, each firing two-bolt bursts with
 * the base bolt. The turrets' offsets are Art's (art/heavies.md "Turret platform"), as in
 * tools/enemy-hardpoints.json.
 */
const platformBurst: FireProfile = {
  ...bolt,
  burst: { count: 2, gap: 0.15 },
  id: "platform-burst",
  interval: 1.4,
};

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
      weapon(bolt, "weapon-left", capitalMounts.offsets["weapon-left"]),
      weapon(bolt, "weapon-right", capitalMounts.offsets["weapon-right"]),
      weapon(missile, "weapon-rear-left", capitalMounts.offsets["weapon-rear-left"]),
      weapon(missile, "weapon-rear-right", capitalMounts.offsets["weapon-rear-right"]),
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
    behaviour: { burstVolleys: 3, kind: "hitAndRun", retreatSeconds: 1.6 },
    physics: SHIP_PHYSICS.fighter,
  },
  frigate: {
    ...base,
    behaviour: siege,
    engagement: 500,
    hardpoints: [
      engine("engine", 0, 0.3),
      weapon(bolt, "port", frigateMounts.offsets.port),
      weapon(bolt, "starboard", frigateMounts.offsets.starboard),
    ],
    hp: 10,
    mounts: frigateMounts,
    physics: SHIP_PHYSICS.frigate,
    sizeRatio: 4,
  },
  interceptor: {
    ...base,
    behaviour: { kind: "strafe", loopDistance: 420, passDistance: 90 },
    engagement: 260,
    hp: 3,
    physics: SHIP_PHYSICS.interceptor,
    sizeRatio: 0.75,
  },
  platform: {
    ...base,
    behaviour: { kind: "siege", speedFraction: 0 },
    engagement: 520,
    hardpoints: [
      weapon(platformBurst, "port", { x: -0.29, y: 0 }, 6),
      weapon(platformBurst, "starboard", { x: 0.29, y: 0 }, 6),
    ],
    // The hull has no HP of its own: hits land only on its turrets.
    hp: 12,
    morale: { individualHpRatio: 0, packLossRatio: 1 },
    perception: 520,
    physics: SHIP_PHYSICS.platform,
    sizeRatio: 3,
  },
  retaliator: {
    ...base,
    aggression: "retaliate",
    fire: {
      ...bolt,
      angles: [-0.2, 0, 0.2],
      id: "retaliator-spread",
      interval: 2.2,
      weapon: "multiLaser",
    },
    hp: 8,
    physics: SHIP_PHYSICS.retaliator,
    sizeRatio: 2,
  },
  swarm: {
    ...base,
    behaviour: { kind: "swarm" },
    fire: { ...bolt, id: "swarm-bolt", interval: 1.8, projectileSpeedRatio: 1.5 },
    hp: 2,
    morale: { individualHpRatio: 0.5, packLossRatio: 0.4 },
    physics: SHIP_PHYSICS.swarm,
    sizeRatio: 0.65,
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
export const sectorEncounters: Readonly<Partial<Record<RoutePosition, readonly EncounterEntry[]>>> =
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
  };

/**
 * Archetype changes by route position: hull HP and movement behaviour (gameplay/ships.md). A
 * placeholder reads the built galaxy before it.
 */
export const sectorArchetypes: Readonly<
  Partial<
    Record<
      RoutePosition,
      Partial<Record<EnemyArchetype, Partial<Pick<EnemyDefinition, "behaviour" | "hp">>>>
    >
  >
> = {
  1: {},
  2: {
    fighter: { behaviour: { kind: "chase" }, hp: 5 },
    frigate: { hp: 12 },
    interceptor: { behaviour: { kind: "chase" }, hp: 4 },
    retaliator: { hp: 10 },
    swarm: { hp: 3 },
  },
  5: {
    fighter: { hp: 5 },
    frigate: { hp: 12 },
    interceptor: { behaviour: { burstVolleys: 3, kind: "hitAndRun", retreatSeconds: 1.6 } },
    retaliator: { hp: 9 },
  },
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

/** Difficulty by route position: perception reach, fire rate and encounter frequency multipliers. */
export interface SectorEnemyTuning {
  encounterRate: number;
  fireRate: number;
  perception: number;
}
export const sectorEnemyTuning: Readonly<Partial<Record<RoutePosition, SectorEnemyTuning>>> = {
  1: { encounterRate: 1.2, fireRate: 1.15, perception: 1.2 },
  2: { encounterRate: 1.35, fireRate: 1.45, perception: 1.4 },
  5: { encounterRate: 1.3, fireRate: 1.3, perception: 1.3 },
};

/** Quiet travel and time between encounters shorten with the galaxy's encounter rate. */
export function encounterQuiet(sector: SectorId): { distance: number; seconds: number } {
  const rate = byPosition(sectorEnemyTuning, sector).encounterRate;
  return {
    distance: enemyEncounterTuning.quietDistance / rate,
    seconds: enemyEncounterTuning.quietSeconds / rate,
  };
}

const scaled = new Map<string, EnemyDefinition>();
/**
 * The catalog definition with the galaxy's archetype changes and its perception and fire-rate
 * multipliers applied.
 */
export function enemyDefinition(sector: SectorId, archetype: EnemyArchetype): EnemyDefinition {
  const key = `${sector}:${archetype}`;
  let definition = scaled.get(key);
  if (!definition) {
    const { fireRate, perception } = byPosition(sectorEnemyTuning, sector);
    const catalog: EnemyDefinition = {
      ...enemyCatalog[archetype],
      ...byPosition(sectorArchetypes, sector)[archetype],
    };
    const faster = (fire: FireProfile): FireProfile => ({
      ...fire,
      interval: fire.interval / fireRate,
    });
    definition = {
      ...catalog,
      fire: faster(catalog.fire),
      hardpoints: catalog.hardpoints.map((part) =>
        part.kind === "weapon" ? { ...part, fire: faster(part.fire) } : part,
      ),
      perception: catalog.perception * perception,
    };
    scaled.set(key, definition);
  }
  return definition;
}
