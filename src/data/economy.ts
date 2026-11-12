import type { AsteroidSize } from "./asteroid-catalog.ts";
import type { EnemyArchetype } from "./enemy-catalog.ts";
import type { RoutePosition } from "./galaxies.ts";
import type { Weapon } from "./types.ts";

export type UpgradeWeapon = Exclude<Weapon, "basic">;
export type UpgradeTrack = "shield" | "shieldRecharge" | "engine" | "tractor";

/** A tuning value with its level 1 base and one value per bought level from level 2. */
export interface LeveledValue {
  base: number;
  levels: readonly number[];
}

/** A cosmetic colour scheme for Ada's ship; Art designs each one. */
export interface PaintScheme {
  /** Player string key for the scheme's name. */
  label: string;
  price: number;
}

export interface DestructionTiming {
  durationSeconds: number;
  releaseSeconds: number;
  spread: number;
}

export interface Destruction extends DestructionTiming {
  /** Under reduced motion: no burst, the drops appear already spread at the reduced release. */
  reduced: DestructionTiming;
}

export interface EconomyCatalog {
  /** Stardust released by each destroyed enemy archetype. */
  enemyStardust: Readonly<Record<EnemyArchetype, number>>;
  /** Inclusive Stardust range released by a destroyed asteroid of each size. */
  asteroidStardust: Readonly<Record<AsteroidSize, readonly [number, number]>>;
  /**
   * Chance by route position that a destroyed enemy drops a random upgrade weapon; a placeholder
   * reads the built galaxy before it.
   */
  weaponDropChance: Readonly<
    Partial<Record<RoutePosition, Readonly<Record<EnemyArchetype, number>>>>
  >;
  /**
   * Ammunition for every upgrade weapon (Basic is unlimited): each pack's shots, about a minute
   * of steady fire at level 1; one shot uses one. A new weapon includes `grantPacks` packs and a
   * found duplicate gives `duplicatePacks`. `packPrice` is Stardust per pack (provisional).
   */
  ammo: {
    duplicatePacks: number;
    grantPacks: number;
    pack: Readonly<Record<UpgradeWeapon, number>>;
    packPrice: number;
  };
  weaponPrices: Readonly<Record<UpgradeWeapon, number>>;
  /**
   * Prices of levels 2 and up; level 1 is the base, so the level count is each list's
   * length plus 1.
   */
  weaponUpgradePrices: readonly number[];
  trackPrices: Readonly<Record<UpgradeTrack, readonly number[]>>;
  /** Multipliers on the base value at levels 1, 2 and 3. */
  effects: Readonly<
    Record<
      | "engineSeconds"
      | "engineSpeed"
      | "shieldCapacity"
      | "shieldRechargeDelay"
      | "shieldRechargeRate",
      readonly [number, number, number]
    >
  >;
  tractorRadius: LeveledValue;
  tractorSpeed: LeveledValue;
  paints: Readonly<Record<string, PaintScheme>>;
  /** Paint schemes in shop order, as Art's ship-paint.json lists them. */
  paintOrder: readonly string[];
  /** The free starting scheme, always owned. */
  defaultPaint: string;
  /** Stardust in a discovery cache. */
  discoveryStardust: number;
  /** Seconds after a weapon switch before Ada can switch again (provisional). */
  weaponSwitchSeconds: number;
  /**
   * Each archetype's destruction, from Art's destruction.json: the wreck releases its drops
   * at `releaseSeconds`, spread up to `spread` world units, and is gone at `durationSeconds`.
   */
  destruction: Readonly<Record<EnemyArchetype, Destruction>>;
  /** Most pickups a destroyed enemy's drop splits into; asteroids release one per Stardust. */
  pickupCap: Readonly<Record<EnemyArchetype, number>>;
  stardustPickupRadius: number;
  station: {
    /** Station placement grid cell, in world units. */
    cellSize: number;
    /** Side of the square band inside each cell where a station may sit. */
    jitter: number;
    /** Chance that a grid cell holds a station. */
    chance: number;
    /** Minimum distance from the flight start. */
    originClearance: number;
    /** Minimum distance between a station and a story destination. */
    destinationClearance: number;
    /** World distance within which the direction indicator marks an undiscovered station. */
    indicatorRange: number;
    /** The station's silhouette radius at its display size (art/destinations.md). */
    radius: number;
    safeRadius: number;
  };
}

const small = { fighter: 0.005, interceptor: 0.005, retaliator: 0.005, swarm: 0.005 } as const;

// Provisional tuning from gameplay/economy.md; station geometry is Tech's provisional layout.
export const ECONOMY: EconomyCatalog = {
  ammo: {
    duplicatePacks: 1,
    grantPacks: 3,
    pack: { heavyMissile: 50, multiLaser: 200, phaser: 55, rapidMissile: 200, scattershot: 130 },
    // The pacing sim's armed scenario: typical use of the stronger weapons costs about a sixth
    // of Stardust income at 6.
    packPrice: 6,
  },
  asteroidStardust: { huge: [3, 3], large: [2, 2], medium: [1, 1], small: [0, 1] },
  defaultPaint: "classic",
  // Frigates and capitals have no shard art yet and keep a provisional 0.6 s break-apart,
  // with Art's 40% reduced spread.
  destruction: {
    capital: {
      durationSeconds: 0.6,
      reduced: { durationSeconds: 0.6, releaseSeconds: 0.6, spread: 16 },
      releaseSeconds: 0.6,
      spread: 40,
    },
    fighter: {
      durationSeconds: 0.45,
      reduced: { durationSeconds: 0.36, releaseSeconds: 0.24, spread: 7.68 },
      releaseSeconds: 0.15,
      spread: 19.2,
    },
    frigate: {
      durationSeconds: 0.6,
      reduced: { durationSeconds: 0.6, releaseSeconds: 0.6, spread: 12 },
      releaseSeconds: 0.6,
      spread: 30,
    },
    interceptor: {
      durationSeconds: 0.44,
      reduced: { durationSeconds: 0.35, releaseSeconds: 0.23, spread: 7.2 },
      releaseSeconds: 0.15,
      spread: 18,
    },
    // The platform breaks up like the frigate it is sized after.
    platform: {
      durationSeconds: 0.6,
      reduced: { durationSeconds: 0.6, releaseSeconds: 0.6, spread: 12 },
      releaseSeconds: 0.6,
      spread: 30,
    },
    retaliator: {
      durationSeconds: 0.6,
      reduced: { durationSeconds: 0.45, releaseSeconds: 0.3, spread: 13.44 },
      releaseSeconds: 0.19,
      spread: 33.6,
    },
    swarm: {
      durationSeconds: 0.43,
      reduced: { durationSeconds: 0.35, releaseSeconds: 0.23, spread: 6.72 },
      releaseSeconds: 0.14,
      spread: 16.8,
    },
  },
  discoveryStardust: 5,
  // Engine tuning: +5% top speed and -10% acceleration and braking seconds per level. Shield
  // capacity 100, 150, 225. Recharge about x1.5 per level: delay /1.2 and rate x1.25 each.
  effects: {
    engineSeconds: [1, 0.9, 0.8],
    engineSpeed: [1, 1.05, 1.1],
    shieldCapacity: [1, 1.5, 2.25],
    shieldRechargeDelay: [1, 1 / 1.2, 1 / 1.44],
    shieldRechargeRate: [1, 1.25, 1.5625],
  },
  // Half each archetype's hit points (hardpoints for multipart ships), rounded down, at least 1.
  enemyStardust: {
    capital: 12,
    fighter: 2,
    frigate: 5,
    interceptor: 1,
    platform: 4,
    retaliator: 4,
    swarm: 1,
  },
  paintOrder: ["classic", "cobalt", "seafoam", "graphite", "iris"],
  paints: {
    classic: { label: "paintClassic", price: 0 },
    cobalt: { label: "paintCobalt", price: 50 },
    graphite: { label: "paintGraphite", price: 50 },
    iris: { label: "paintIris", price: 50 },
    seafoam: { label: "paintSeafoam", price: 50 },
  },
  pickupCap: {
    capital: 24,
    fighter: 8,
    frigate: 16,
    interceptor: 8,
    platform: 16,
    retaliator: 8,
    swarm: 8,
  },
  stardustPickupRadius: 5,
  station: {
    cellSize: 12000,
    // Every cell holds a station; occupancy only gates a cell, so seeded positions never move.
    chance: 1,
    destinationClearance: 1200,
    indicatorRange: 2000,
    jitter: 4000,
    originClearance: 3000,
    radius: 60,
    safeRadius: 320,
  },
  trackPrices: {
    engine: [120, 240],
    shield: [150, 300],
    shieldRecharge: [150, 300],
    tractor: [80, 160],
  },
  // The tractor beam's pull radius and speed by level, alike for every pickup.
  tractorRadius: { base: 60, levels: [90, 120] },
  tractorSpeed: { base: 120, levels: [160, 200] },
  // Galaxy one drops weapons more rarely, so its first weapon is usually bought.
  weaponDropChance: {
    1: {
      capital: 0.05,
      fighter: 0.0025,
      frigate: 0.02,
      interceptor: 0.0025,
      platform: 0.02,
      retaliator: 0.0025,
      swarm: 0.0025,
    },
    2: { ...small, capital: 0.05, frigate: 0.05, platform: 0.05 },
    5: { ...small, capital: 0.05, frigate: 0.05, platform: 0.05 },
  },
  weaponPrices: {
    heavyMissile: 300,
    multiLaser: 250,
    phaser: 400,
    rapidMissile: 150,
    scattershot: 350,
  },
  weaponSwitchSeconds: 1,
  weaponUpgradePrices: [150, 300],
};
