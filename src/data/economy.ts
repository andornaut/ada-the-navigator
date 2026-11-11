import type { EnemyArchetype } from "./enemy-catalog.ts";
import type { Weapon } from "./types.ts";

export type UpgradeWeapon = Exclude<Weapon, "basic">;
export type UpgradeTrack = "shield" | "shieldRecharge" | "engine" | "tractor";

/** A tuning value with its base and one value per bought level. */
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
  /** Inclusive Stardust range released by a destroyed asteroid. */
  asteroidStardust: readonly [number, number];
  /** Chance that a destroyed enemy drops a random upgrade weapon. */
  weaponDropChance: Readonly<Record<EnemyArchetype, number>>;
  /** Stardust given instead of a dropped weapon Ada already owns. */
  ownedWeaponStardust: number;
  weaponPrices: Readonly<Record<UpgradeWeapon, number>>;
  /** Prices per level; the level count is each list's length. */
  weaponUpgradePrices: readonly number[];
  trackPrices: Readonly<Record<UpgradeTrack, readonly number[]>>;
  /** Per-level effect fractions, applied additively per level. */
  effects: {
    weaponDamage: number;
    weaponInterval: number;
    shieldCapacity: number;
    shieldRechargeDelay: number;
    shieldRechargeRate: number;
    engineSpeed: number;
    engineSeconds: number;
  };
  tractorRadius: LeveledValue;
  tractorSpeed: LeveledValue;
  paints: Readonly<Record<string, PaintScheme>>;
  /** The free starting scheme, always owned. */
  defaultPaint: string;
  /** Stardust in a discovery cache. */
  discoveryStardust: number;
  /** Flat Stardust fee for recharging after a quantum jump home. */
  jumpFee: number;
  /** Seconds weapon changes stay locked after combat ends. */
  weaponLockSeconds: number;
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
    radius: number;
    /** World offset of the dock from the station's centre, from the station art's dock point. */
    dockOffset: { x: number; y: number };
    /** World unit direction out of the dock, from the station art; undocking and travel arrive along it. */
    dockOutward: { x: number; y: number };
    /** Scale on the mouth circle's radius for the docking overlap; 1 docks at the drawn mouth. */
    dockForgiveness: number;
    /** World radius of the dock's mouth circle, from the station art's mouth width. */
    dockMouthRadius: number;
    safeRadius: number;
  };
}

const small = { fighter: 0.02, interceptor: 0.02, retaliator: 0.02, swarm: 0.02 } as const;

// Provisional tuning from gameplay/economy.md; station geometry is Tech's provisional layout.
export const ECONOMY: EconomyCatalog = {
  asteroidStardust: [1, 3],
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
    oversizedCapital: {
      durationSeconds: 0.6,
      reduced: { durationSeconds: 0.6, releaseSeconds: 0.6, spread: 16 },
      releaseSeconds: 0.6,
      spread: 40,
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
  discoveryStardust: 25,
  effects: {
    engineSeconds: -0.1,
    engineSpeed: 0.05,
    shieldCapacity: 0.2,
    shieldRechargeDelay: -0.15,
    shieldRechargeRate: 0.2,
    weaponDamage: 0.1,
    weaponInterval: -0.1,
  },
  enemyStardust: {
    capital: 150,
    fighter: 5,
    frigate: 40,
    interceptor: 6,
    oversizedCapital: 400,
    retaliator: 15,
    swarm: 2,
  },
  jumpFee: 10,
  ownedWeaponStardust: 25,
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
    oversizedCapital: 24,
    retaliator: 8,
    swarm: 8,
  },
  stardustPickupRadius: 5,
  station: {
    cellSize: 12000,
    chance: 0.5,
    destinationClearance: 1200,
    // Gameplay's forgiving dock: the mouth circle's radius scaled up for docking.
    dockForgiveness: 3,
    // Half station-a's drawn 16.61 display px mouth, as a world-plane circle's radius.
    dockMouthRadius: 5.873,
    // station-a's dock entrance, 27.2 display px below the pivot, in world units.
    dockOffset: { x: 27.223, y: 27.223 },
    dockOutward: { x: Math.SQRT1_2, y: Math.SQRT1_2 },
    jitter: 4000,
    originClearance: 3000,
    radius: 40,
    safeRadius: 320,
  },
  trackPrices: {
    engine: [120, 240, 480],
    shield: [100, 200, 400],
    shieldRecharge: [100, 200, 400],
    tractor: [80, 160],
  },
  tractorRadius: { base: 100, levels: [150, 200] },
  tractorSpeed: { base: 150, levels: [220, 300] },
  weaponDropChance: { ...small, capital: 0.25, frigate: 0.1, oversizedCapital: 0.25 },
  weaponLockSeconds: 5,
  weaponPrices: { missiles: 150, scattershot: 350, tripleLaser: 250 },
  weaponUpgradePrices: [100, 200, 400],
};
