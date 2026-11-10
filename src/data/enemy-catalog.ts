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
  pursuit: { homeRadius: number; maxSeconds: number; unseenSeconds: number };
  sizeRatio: number;
  speedRatio: number;
  steering: { orbit: number; response: number; separation: number; wobble: number };
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
const fighter: EnemyDefinition = {
  aggression: "sight",
  engagement: 360,
  fire: bolt,
  hardpoints: [],
  hp: 4,
  morale: { individualHpRatio: 0.3, packLossRatio: 0.5 },
  perception: 650,
  pursuit: { homeRadius: 1400, maxSeconds: 18, unseenSeconds: 3 },
  sizeRatio: 1,
  speedRatio: 0.8,
  steering: { orbit: 0, response: 0.6, separation: 70, wobble: 0 },
};

/** Provisional tuning in world units and seconds, not user-selected values. */
export const enemyCatalog = {
  capital: {
    ...fighter,
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
    sizeRatio: 10,
    speedRatio: 0.2,
  },
  fighter,
  frigate: {
    ...fighter,
    engagement: 500,
    hardpoints: [
      engine("engine", 0, 0.3),
      weapon(bolt, "port", -0.3, 0),
      weapon(bolt, "starboard", 0.3, 0),
    ],
    hp: 10,
    sizeRatio: 3,
    speedRatio: 0.4,
  },
  interceptor: { ...fighter, speedRatio: 1.1 },
  oversizedCapital: {
    ...fighter,
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
    sizeRatio: 30,
    speedRatio: 0.12,
  },
  retaliator: { ...fighter, aggression: "retaliate" },
  swarm: {
    ...fighter,
    fire: { ...bolt, id: "swarm-bolt", interval: 1.8, projectileSpeedRatio: 1.5 },
    hp: 2,
    morale: { individualHpRatio: 0.5, packLossRatio: 0.4 },
    speedRatio: 0.9,
    steering: { orbit: 0.9, response: 0.35, separation: 85, wobble: 0.65 },
  },
} satisfies Record<string, EnemyDefinition>;

export type EnemyArchetype = keyof typeof enemyCatalog;

/** Small encounters separated by quiet travel; the adapter owns seeded placement. */
export const enemyEncounterTuning = {
  debris: { count: [3, 7], speedRatio: [0.08, 0.25] },
  groupSize: [1, 4],
  quietDistance: 1800,
  quietSeconds: 12,
  speedCapRatio: 1.1,
} as const;
