import { SHIP_PHYSICS, type ShipPhysics } from "./ship-physics.ts";
import type { SectorId } from "./types.ts";

export interface Point {
  x: number;
  y: number;
}
export interface FireProfile {
  angles: number[];
  id: string;
  interval: number;
  projectile: "bolt" | "missile";
  projectileSpeedRatio: number;
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
  projectile: "bolt",
  projectileSpeedRatio: 1.7,
};
const missile: FireProfile = {
  angles: [0],
  id: "straight-missile",
  interval: 3,
  projectile: "missile",
  projectileSpeedRatio: 1.3,
};
const command: HardpointDefinition = {
  hp: 5,
  id: "command",
  kind: "command",
  offset: { x: 0, y: 0 },
  required: true,
};
const weapon = (fire: FireProfile, id: string, x: number, y: number): HardpointDefinition => ({
  fire,
  hp: 3,
  id,
  kind: "weapon",
  offset: { x, y },
  required: true,
});
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
      weapon(bolt, "weapon-left", -0.35, -0.3),
      weapon(bolt, "weapon-right", 0.35, -0.3),
      weapon(missile, "weapon-rear-left", -0.42, 0.08),
      weapon(missile, "weapon-rear-right", 0.42, 0.08),
    ],
    hp: 18,
    morale: { individualHpRatio: 0, packLossRatio: 1 },
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
      weapon(bolt, "port", -0.3, 0),
      weapon(bolt, "starboard", 0.3, 0),
    ],
    hp: 10,
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
  retaliator: {
    ...base,
    aggression: "retaliate",
    fire: { ...bolt, angles: [-0.2, 0, 0.2], id: "retaliator-spread", interval: 2.2 },
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

/** Equal weights in this order preserve the unthemed sectors' seeded encounters. */
const sharedEncounters: readonly EncounterEntry[] = (
  ["fighter", "swarm", "interceptor", "retaliator"] as const
).map((archetype) => ({ archetype, groupSize: [1, 4], weight: 0.25 }));

/** Open-space encounter tables per sector; frigates and capitals also keep their route roles. */
export const sectorEncounters: Readonly<Record<SectorId, readonly EncounterEntry[]>> = {
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
  2: sharedEncounters,
  3: sharedEncounters,
};

/** Capital battle escorts, in world units. */
export const escortTuning: EscortTuning = { interceptRadius: 600, stationGap: 60 };

/** Small encounters separated by quiet travel; the adapter owns seeded placement. */
export const enemyEncounterTuning = {
  debris: { count: [3, 7], speedRatio: [0.08, 0.25] },
  quietDistance: 1800,
  quietSeconds: 12,
  speedCapRatio: 1.1,
} as const;

/** Per-galaxy difficulty: perception reach, fire rate and encounter frequency multipliers. */
export interface SectorEnemyTuning {
  encounterRate: number;
  fireRate: number;
  perception: number;
}
export const sectorEnemyTuning: Readonly<Record<SectorId, SectorEnemyTuning>> = {
  1: { encounterRate: 1.2, fireRate: 1.15, perception: 1.2 },
  2: { encounterRate: 1, fireRate: 1, perception: 1 },
  3: { encounterRate: 1, fireRate: 1, perception: 1 },
};

/** Quiet travel and time between encounters shorten with the galaxy's encounter rate. */
export function encounterQuiet(sector: SectorId): { distance: number; seconds: number } {
  const rate = sectorEnemyTuning[sector].encounterRate;
  return {
    distance: enemyEncounterTuning.quietDistance / rate,
    seconds: enemyEncounterTuning.quietSeconds / rate,
  };
}

const scaled = new Map<string, EnemyDefinition>();
/** The catalog definition with the galaxy's perception and fire-rate multipliers applied. */
export function enemyDefinition(sector: SectorId, archetype: EnemyArchetype): EnemyDefinition {
  const key = `${sector}:${archetype}`;
  let definition = scaled.get(key);
  if (!definition) {
    const { fireRate, perception } = sectorEnemyTuning[sector];
    const catalog: EnemyDefinition = enemyCatalog[archetype];
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
