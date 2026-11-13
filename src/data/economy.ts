import type { AsteroidSize } from "./asteroidCatalog.ts";
import type { EnemyArchetype } from "./enemyCatalog.ts";
import type { RoutePosition } from "./galaxies.ts";
import type { Weapon } from "./types.ts";

export type UpgradeWeapon = Exclude<Weapon, "laser">;
export type UpgradeTrack = "shield" | "engine" | "tractor";

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
  /** The scheme's top colour, Art's `top` in ship-paint.json, which rims its item notice. */
  top: string;
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
  /** Inclusive Stardust range released by a destroyed asteroid of each size. */
  asteroidStardust: Readonly<Record<AsteroidSize, readonly [number, number]>>;
  /**
   * Chance, the same in every galaxy, that a destroyed small craft or a salvaged heavy drops an
   * upgrade pickup; a destroyed heavy drops none.
   */
  upgradeDropChance: { readonly heavy: number; readonly small: number };
  /**
   * An upgrade drop's weights (gameplay/economy.md "Earning Stardust"): each category's, then
   * each weapon's within Weapons. A category or weapon with nothing left leaves the pool.
   */
  upgradeDropWeights: {
    readonly categories: Readonly<
      Record<"engine" | "paint" | "shield" | "tractor" | "weapons", number>
    >;
    readonly weapons: Readonly<Record<Weapon, number>>;
  };
  /**
   * Ammunition for every upgrade weapon (Laser is unlimited): each pack's shots, fewer seconds of
   * level 1 fire for each later weapon; one shot uses one. A new weapon includes `grantPacks`
   * packs and a found duplicate gives `duplicatePacks`. `packPrice` is Stardust per pack. A
   * destroyed small craft drops an ammo pack pickup at `dropChance`, and a destroyed asteroid or
   * ore rock at `rockDropChance`, once Ada owns a weapon other than Laser, in any galaxy; its pack
   * is for an owned weapon by `dropWeights`, as is an upgrade drop's pack once nothing else is
   * left.
   */
  ammo: {
    dropChance: number;
    rockDropChance: number;
    dropWeights: Readonly<Record<UpgradeWeapon, number>>;
    duplicatePacks: number;
    grantPacks: number;
    pack: Readonly<Record<UpgradeWeapon, number>>;
    packPrice: number;
  };
  /** Each upgrade weapon's purchase price: its level 2 upgrade price. */
  weaponPrices: Readonly<Record<UpgradeWeapon, number>>;
  /**
   * Each weapon's prices of levels 2 and up; level 1 is the base, so the level count is each
   * list's length plus 1.
   */
  weaponUpgradePrices: Readonly<Record<Weapon, readonly number[]>>;
  trackPrices: Readonly<Record<UpgradeTrack, readonly number[]>>;
  /**
   * Ada's maximum speed and movement and aim turn time constants at engine levels 2 and 3; level 1
   * is her ship physics' own.
   */
  engineLevels: Readonly<
    Record<"aimTurnSeconds" | "maxSpeed" | "turnSeconds", readonly [number, number]>
  >;
  /**
   * The Shield at levels 2 and 3: capacity and seconds from empty to full; level 1 is the content
   * tuning's own. The recharge delay is the same at every level.
   */
  shieldLevels: Readonly<Record<"capacity" | "fill", readonly [number, number]>>;
  /** Multipliers on the base value at levels 1, 2 and 3. */
  effects: Readonly<Record<"engineSeconds", readonly [number, number, number]>>;
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
  /**
   * A destroyed asteroid or ore rock bursts with `stardust` extra Stardust at `chance`, on top of
   * its usual drop, split one pickup per Stardust.
   */
  rockBurst: { readonly chance: number; readonly stardust: number };
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

/**
 * The weapon each route position unlocks (gameplay/economy.md "Weapon unlocks"), cumulative along
 * the route; Phantom adds nothing new.
 */
export const WEAPON_UNLOCKS: Readonly<Record<RoutePosition, UpgradeWeapon | null>> = {
  1: "multiLaser",
  2: "rapidMissile",
  3: "heavyMissile",
  4: "scattershot",
  5: "phaser",
  6: null,
};

/** The upgrade weapons the galaxy at route `position` sells and drops, in route order. */
export function unlockedWeapons(position: RoutePosition): UpgradeWeapon[] {
  return ([1, 2, 3, 4, 5, 6] as const)
    .filter((at) => at <= position)
    .flatMap((at) => WEAPON_UNLOCKS[at] ?? []);
}

/** Laser's level 2 and 3 upgrade prices, from which every weapon's derive. */
export const LASER_UPGRADE_PRICES = [300, 600] as const;
/** Each later weapon in weapon order costs this much more to upgrade, compounded. */
export const UPGRADE_PRICE_STEP = 1.25;

/**
 * Weapon upgrade prices (gameplay/economy.md "Prices"): Laser's, then `step` times more for each
 * later weapon in weapon order, compounded, each rounded up to the next 100.
 */
export function weaponUpgradePrices(
  laser: readonly number[],
  step: number,
): Record<Weapon, number[]> {
  const order: Weapon[] = ["laser", ...unlockedWeapons(6)];
  return Object.fromEntries(
    order.map((weapon, index) => [
      weapon,
      laser.map((price) => Math.ceil((price * step ** index) / 100) * 100),
    ]),
  ) as Record<Weapon, number[]>;
}

const UPGRADE_PRICES = weaponUpgradePrices(LASER_UPGRADE_PRICES, UPGRADE_PRICE_STEP);

// Provisional tuning from gameplay/economy.md; station geometry is Tech's provisional layout.
export const ECONOMY: EconomyCatalog = {
  ammo: {
    // Ammo pack drops: destroyed small craft 7.5%, destroyed asteroids and ore rocks 1%
    // (gameplay/economy.md "Earning Stardust").
    dropChance: 0.075,
    // Each weapon about three quarters as likely as the one before it in weapon order.
    dropWeights: { heavyMissile: 9, multiLaser: 16, phaser: 5, rapidMissile: 12, scattershot: 7 },
    duplicatePacks: 1,
    grantPacks: 3,
    // Level 1 fire per pack: Multi-Laser 90 s, Rapid Missile 80, Heavy Missile 70, Scattershot 60
    // and Phaser 50.
    pack: { heavyMissile: 35, multiLaser: 300, phaser: 50, rapidMissile: 265, scattershot: 60 },
    packPrice: 10,
    rockDropChance: 0.01,
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
  // Engine tuning: -10% acceleration and braking seconds per level.
  effects: {
    engineSeconds: [1, 0.9, 0.8],
  },
  // Engine levels 2 and 3 raise Ada's 175 to 200, then 225, and shorten her turns
  // (gameplay/economy.md).
  engineLevels: {
    aimTurnSeconds: [0.07, 0.06],
    maxSpeed: [200, 225],
    turnSeconds: [0.14, 0.12],
  },
  paintOrder: ["classic", "cobalt", "seafoam", "graphite", "iris"],
  paints: {
    classic: { label: "paintClassic", price: 0, top: "#ffffff" },
    cobalt: { label: "paintCobalt", price: 75, top: "#6f9ff0" },
    graphite: { label: "paintGraphite", price: 75, top: "#aab2c4" },
    iris: { label: "paintIris", price: 75, top: "#d9ccff" },
    seafoam: { label: "paintSeafoam", price: 75, top: "#d4f6ea" },
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
  // A destroyed asteroid or ore rock bursts with 10 extra Stardust 2% of the time
  // (gameplay/economy.md "Earning Stardust").
  rockBurst: { chance: 0.02, stardust: 10 },
  // Shield levels 2 and 3: capacity 15 then 20 HP, recharge delay 15 then 10 s, empty to
  // full in 45 then 30 s (gameplay/economy.md).
  shieldLevels: { capacity: [15, 20], fill: [45, 30] },
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
    engine: [180, 360],
    shield: [450, 900],
    tractor: [120, 240],
  },
  // The tractor beam's pull radius and speed by level, alike for every pickup.
  tractorRadius: { base: 60, levels: [90, 120] },
  tractorSpeed: { base: 120, levels: [160, 200] },
  upgradeDropChance: { heavy: 0.1, small: 0.0025 },
  upgradeDropWeights: {
    categories: { engine: 1, paint: 1 / 20, shield: 1, tractor: 1, weapons: 1 },
    // Each weapon half as likely as the one before it in weapon order.
    weapons: {
      heavyMissile: 8,
      laser: 64,
      multiLaser: 32,
      phaser: 2,
      rapidMissile: 16,
      scattershot: 4,
    },
  },
  // A weapon costs what its level 2 upgrade does.
  weaponPrices: {
    heavyMissile: UPGRADE_PRICES.heavyMissile[0]!,
    multiLaser: UPGRADE_PRICES.multiLaser[0]!,
    phaser: UPGRADE_PRICES.phaser[0]!,
    rapidMissile: UPGRADE_PRICES.rapidMissile[0]!,
    scattershot: UPGRADE_PRICES.scattershot[0]!,
  },
  weaponSwitchSeconds: 1,
  weaponUpgradePrices: UPGRADE_PRICES,
};
