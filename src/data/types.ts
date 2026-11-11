export type SectorId = 1 | 2 | 3;
export type Weapon = "basic" | "missiles" | "tripleLaser" | "scattershot";

export interface ChapterContent {
  name: string;
  opening: string;
  openingChoices: readonly [string, string];
  resolution: string;
  resolutionChoices: readonly [string, string];
  closing: string;
  objectives: readonly string[];
  dialogue: Readonly<Record<string, { speaker: string; text: string; optional?: string }>>;
}

export interface PrototypeContent {
  chapters: Readonly<Record<SectorId, ChapterContent>>;
  labels: Readonly<Record<string, string>>;
  tuning: {
    chunkSize: number;
    maxSpeed: number;
    accelerationSeconds: number;
    brakingSeconds: number;
    /** Exponential time constant for turning the requested movement direction. */
    movementTurnSeconds: number;
    /** Exponential time constant for turning the aim-facing toward the aim input. */
    aimTurnSeconds: number;
    shieldMax: number;
    shieldRechargeDelay: number;
    shieldRechargeRate: number;
    enemyDamage: number;
    enemyProjectileSpeed: number;
    miningMilestones: readonly [number, number, number];
    introFreshDistance: number;
    encounterFreshDistance: number;
    safeRadius: number;
    dangerReleaseSeconds: number;
    whaleDebris: { count: number; radius: number; hp: number; spacing: number };
    flight: {
      objectsPerChunk: number;
      spawnWeights: { resource: number; rock: number; enemy: number; pickup: number };
      rockHp: number;
      enemyHp: number;
      playerShotDamage: number;
      piecesPerRock: number;
      pursuitSpeedFactor: number;
      damageInterval: number;
      enemyFireInterval: number;
      projectileSpeedFactor: number;
      projectileLifetime: number;
      enemyProjectileLifetime: number;
      shipRadius: number;
      enemyRadius: number;
      rockRadius: number;
      pickupRadius: number;
      pieceRadius: number;
      pickupReach: number;
      engagementChunks: number;
    };
  };
}
