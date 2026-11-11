import type { ShipPhysics } from "./ship-physics.ts";

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
  /** Install steps for browsers that install only from their own menu. */
  installSteps: Readonly<Record<"firefoxAndroid" | "ios", { title: string; steps: string }>>;
  /** The start screen's update offer. */
  update: { accept: string; cancel: string; title: string };
  tuning: {
    chunkSize: number;
    /** Base maximum speed; every ship's physics speedRatio scales it. */
    maxSpeed: number;
    /** Fraction of Ada's maximum speed requested by the smallest movement input past the dead zone. */
    minSpeedFraction: number;
    /** Exponent applied to movement deflection before scaling toward Ada's maximum speed. */
    speedCurveExponent: number;
    /** Ada's ship physics. */
    physics: ShipPhysics;
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
