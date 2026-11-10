export type SectorId = 1 | 2 | 3;
export type Weapon = "basic" | "rapid" | "spread" | "pierce";

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
    shieldMax: number;
    shieldRechargeDelay: number;
    shieldRechargeRate: number;
    enemyDamage: number;
    enemyProjectileSpeed: number;
    fireInterval: Readonly<Record<Weapon, number>>;
    weaponAmmo: Readonly<Record<Exclude<Weapon, "basic">, number>>;
    cargoCapacity: number;
    miningMilestones: readonly [number, number, number];
    introFreshDistance: number;
    encounterFreshDistance: number;
    safeRadius: number;
    dangerReleaseSeconds: number;
    whaleDebris: { count: number; radius: number; hp: number; spacing: number };
  };
}
