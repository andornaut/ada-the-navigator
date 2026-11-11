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
export interface EnemyDefinition {
  aggression: "sight" | "retaliate";
  engagement: number;
  fire: FireProfile;
  hardpoints: HardpointDefinition[];
  hp: number;
  morale: { individualHpRatio: number; packLossRatio: number };
  perception: number;
  physics: ShipPhysics;
  pursuit: { homeRadius: number; maxSeconds: number; unseenSeconds: number };
  sizeRatio: number;
  steering: { orbit: number; separation: number; wobble: number };
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
  engagement: 360,
  fire: bolt,
  hardpoints: [],
  hp: 4,
  morale: { individualHpRatio: 0.3, packLossRatio: 0.5 },
  perception: 650,
  pursuit: { homeRadius: 1400, maxSeconds: 18, unseenSeconds: 3 },
  sizeRatio: 1,
  steering: { orbit: 0, separation: 70, wobble: 0 },
};

/** Provisional tuning in world units and seconds, not user-selected values. */
export const enemyCatalog = {
  capital: {
    ...base,
    engagement: 750,
    hardpoints: [
      command,
      engine("engine-left", -0.3, 0.35),
      engine("engine-right", 0.3, 0.35),
      weapon(bolt, "weapon-left", -0.4, -0.2),
      weapon(missile, "weapon-right", 0.4, -0.2),
    ],
    hp: 18,
    morale: { individualHpRatio: 0, packLossRatio: 1 },
    perception: 1100,
    physics: SHIP_PHYSICS.capital,
    sizeRatio: 10,
  },
  fighter: {
    ...base,
    physics: SHIP_PHYSICS.fighter,
    steering: { ...base.steering, orbit: 0.4 },
  },
  frigate: {
    ...base,
    engagement: 500,
    hardpoints: [
      engine("engine", 0, 0.3),
      weapon(bolt, "port", -0.3, 0),
      weapon(bolt, "starboard", 0.3, 0),
    ],
    hp: 10,
    physics: SHIP_PHYSICS.frigate,
    sizeRatio: 3,
  },
  interceptor: {
    ...base,
    engagement: 260,
    hp: 3,
    physics: SHIP_PHYSICS.interceptor,
    sizeRatio: 0.75,
  },
  oversizedCapital: {
    ...base,
    engagement: 1000,
    hardpoints: [
      command,
      engine("engine-left", -0.35, 0.35),
      engine("engine-right", 0.35, 0.35),
      weapon(bolt, "port", -0.4, -0.25),
      weapon(missile, "center", 0, -0.4),
      weapon(bolt, "starboard", 0.4, -0.25),
    ],
    hp: 24,
    morale: { individualHpRatio: 0, packLossRatio: 1 },
    perception: 1500,
    physics: SHIP_PHYSICS.oversizedCapital,
    sizeRatio: 30,
  },
  retaliator: {
    ...base,
    aggression: "retaliate",
    fire: { ...bolt, angles: [-0.2, 0, 0.2], id: "retaliator-spread", interval: 2.2 },
    hp: 8,
    physics: SHIP_PHYSICS.retaliator,
    sizeRatio: 2,
    steering: { ...base.steering, orbit: 0.2 },
  },
  swarm: {
    ...base,
    fire: { ...bolt, id: "swarm-bolt", interval: 1.8, projectileSpeedRatio: 1.5 },
    hp: 2,
    morale: { individualHpRatio: 0.5, packLossRatio: 0.4 },
    physics: SHIP_PHYSICS.swarm,
    sizeRatio: 0.65,
    steering: { orbit: 0.9, separation: 85, wobble: 0.65 },
  },
} satisfies Record<string, EnemyDefinition>;

export type EnemyArchetype = keyof typeof enemyCatalog;

/** One weighted encounter choice; groupSize is an inclusive member range. */
export interface EncounterEntry {
  archetype: EnemyArchetype;
  groupSize: readonly [number, number];
  weight: number;
}

/** Equal weights in this order preserve the unthemed sectors' seeded encounters. */
const sharedEncounters: readonly EncounterEntry[] = (
  ["fighter", "swarm", "interceptor", "retaliator"] as const
).map((archetype) => ({ archetype, groupSize: [1, 4], weight: 0.25 }));

/** Open-space encounter tables per sector; frigates and capitals keep their route roles. */
export const sectorEncounters: Readonly<Record<SectorId, readonly EncounterEntry[]>> = {
  1: [
    { archetype: "swarm", groupSize: [3, 5], weight: 0.35 },
    { archetype: "fighter", groupSize: [1, 2], weight: 0.35 },
    { archetype: "interceptor", groupSize: [1, 1], weight: 0.15 },
    { archetype: "retaliator", groupSize: [1, 1], weight: 0.15 },
  ],
  2: sharedEncounters,
  3: sharedEncounters,
};

/** Small encounters separated by quiet travel; the adapter owns seeded placement. */
export const enemyEncounterTuning = {
  debris: { count: [3, 7], speedRatio: [0.08, 0.25] },
  quietDistance: 1800,
  quietSeconds: 12,
  speedCapRatio: 1.1,
} as const;
