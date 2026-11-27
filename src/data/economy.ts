import type { AsteroidSize } from "./asteroidCatalog.ts";
import type { EnemyArchetype } from "./enemyCatalog.ts";
import type { RoutePosition } from "./galaxies.ts";
import type { ShipPhysics } from "./shipPhysics.ts";
import { TARGET_MARKER_RANGE } from "./targetMarkers.ts";
import type { Weapon } from "./types.ts";

const STATION_CELL_SIZE = 12000;
const STATION_JITTER = 4000;

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
    readonly categories: Readonly<Record<"engine" | "shield" | "tractor" | "weapons", number>>;
    readonly weapons: Readonly<Record<Weapon, number>>;
  };
  /**
   * Ammunition for every upgrade weapon (Laser is unlimited). Shop packs, new weapons, found
   * duplicates, and world pickups each award their own quantities. Eligible destroyed small craft
   * roll at `dropChance`, and asteroids other than ore field rocks at their size's
   * `rockDropChance`. Ada must own a weapon other than Laser. The pack's weapon is selected among
   * eligible owned weapons by `dropWeights` on collection, including an upgrade pickup that falls
   * back to ammo.
   */
  ammo: {
    /** Maximum stored shots per finite-ammunition weapon. */
    capacity: number;
    dropChance: number;
    rockDropChance: Readonly<Record<AsteroidSize, number>>;
    dropWeights: Readonly<Record<UpgradeWeapon, number>>;
    duplicate: Readonly<Record<UpgradeWeapon, number>>;
    grant: Readonly<Record<UpgradeWeapon, number>>;
    pack: Readonly<Record<UpgradeWeapon, number>>;
    packPrice: number;
    worldPack: Readonly<Record<UpgradeWeapon, number>>;
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
   * Ada's speed and independent response times at engine levels 2 and 3. Level 1 uses
   * her base ship physics.
   */
  engineLevels: Readonly<Record<keyof ShipPhysics, readonly [number, number]>>;
  /**
   * The Shield capacity at levels 2 and 3. Shared recharge timing comes from content tuning.
   */
  shieldLevels: { readonly capacity: readonly [number, number] };
  /** Maximum-capacity fraction funded per whole ore and the ore-free recharge floor. */
  shieldRecharge: Readonly<{ capacityPerOre: number; freeCapacity: number }>;
  tractorRadius: LeveledValue;
  tractorSpeed: LeveledValue;
  paints: Readonly<Record<string, PaintScheme>>;
  /** Paint schemes in shop order, as Art's ship-paint.json lists them. */
  paintOrder: readonly string[];
  /** Paid schemes by purchase order; Classic never advances it. */
  paintPrices: readonly number[];
  /** The free starting scheme, always owned. */
  defaultPaint: string;
  /** Stardust in a discovery cache. */
  discoveryStardust: number;
  /**
   * Each archetype's destruction, from Art's destruction.json: the wreck releases its drops
   * at `releaseSeconds`, spread up to `spread` world units, and is gone at `durationSeconds`.
   */
  destruction: Readonly<Record<EnemyArchetype, Destruction>>;
  /** Destroyed asteroid drops: release delay in seconds and spread in world units. */
  rockRelease: { releaseSeconds: number; spread: number };
  stardustPickupGap: number;
  stardustPickupRadius: number;
  station: {
    /** Station placement grid cell, in world units. */
    cellSize: number;
    /** Side of the square band inside each cell where a station may sit. */
    jitter: number;
    /** Minimum separation after doubling station density without moving legacy sites. */
    minimumSpacing: number;
    /** Chance that a grid cell holds a station. */
    chance: number;
    /** Minimum distance from the flight start. */
    originClearance: number;
    /** Minimum distance between a station and a story destination. */
    destinationClearance: number;
    /** World distance within which the direction indicator marks an undiscovered station (TARGET_MARKER_RANGE). */
    indicatorRange: number;
    /** The station's silhouette radius at its display size (art/destinations.md). */
    radius: number;
    /**
     * The station's exclusion zone: no rock, moving-rock path or enemy group is placed inside it
     * and enemy ships move outside it. It grants no protection (gameplay/rules.md "Protection").
     */
    exclusionRadius: number;
    /** Ada within this of a station's centre discovers it and cues its first meeting. */
    discoveryRadius: number;
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
/** The units in one world ammo pickup. */
export function worldAmmoPack(
  catalog: Pick<EconomyCatalog, "ammo">,
  weapon: UpgradeWeapon,
): number {
  return catalog.ammo.worldPack[weapon];
}

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
const SHOP_AMMO_PACK = {
  heavyMissile: 75,
  multiLaser: 90,
  phaser: 75,
  rapidMissile: 180,
  scattershot: 120,
};

// Provisional tuning from gameplay/economy.md; station geometry is Tech's provisional layout.
export const ECONOMY: EconomyCatalog = {
  ammo: {
    capacity: 9999,
    // Separate ammo roll for destroyed small craft.
    dropChance: 0.1,
    // Each weapon about three quarters as likely as the one before it in weapon order.
    dropWeights: { heavyMissile: 9, multiLaser: 16, phaser: 5, rapidMissile: 12, scattershot: 7 },
    duplicate: {
      heavyMissile: 40,
      multiLaser: 90,
      phaser: 40,
      rapidMissile: 260,
      scattershot: 60,
    },
    grant: { heavyMissile: 120, multiLaser: 270, phaser: 120, rapidMissile: 780, scattershot: 180 },
    pack: SHOP_AMMO_PACK,
    packPrice: 25,
    rockDropChance: { huge: 0.08, large: 0.04, medium: 0.02, small: 0.01 },
    worldPack: {
      heavyMissile: SHOP_AMMO_PACK.heavyMissile / 3,
      multiLaser: SHOP_AMMO_PACK.multiLaser / 3,
      phaser: SHOP_AMMO_PACK.phaser / 3,
      rapidMissile: SHOP_AMMO_PACK.rapidMissile / 3,
      scattershot: SHOP_AMMO_PACK.scattershot / 3,
    },
  },
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
      durationSeconds: 0.43,
      reduced: { durationSeconds: 0.35, releaseSeconds: 0.23, spread: 6.72 },
      releaseSeconds: 0.14,
      spread: 16.8,
    },
    frigate: {
      durationSeconds: 0.6,
      reduced: { durationSeconds: 0.6, releaseSeconds: 0.6, spread: 12 },
      releaseSeconds: 0.6,
      spread: 30,
    },
    interceptor: {
      durationSeconds: 0.5,
      reduced: { durationSeconds: 0.39, releaseSeconds: 0.26, spread: 9.6 },
      releaseSeconds: 0.16,
      spread: 24,
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
      durationSeconds: 0.39,
      reduced: { durationSeconds: 0.32, releaseSeconds: 0.21, spread: 5.28 },
      releaseSeconds: 0.13,
      spread: 13.2,
    },
  },
  discoveryStardust: 5,
  // Time to 90% is 0.80 / 0.65 s. Continuous coasting to 1% travels 120 world units
  // at either top speed (gameplay/ships.md).
  engineLevels: {
    accelerationSeconds: [0.8 / Math.log(10), 0.65 / Math.log(10)],
    aimTurnSeconds: [0.07, 0.06],
    brakingSeconds: [120 / (0.99 * 200), 120 / (0.99 * 225)],
    maxSpeed: [200, 225],
    turnSeconds: [0.14, 0.12],
  },
  paintOrder: ["classic", "cobalt", "seafoam", "graphite", "iris", "amber"],
  paintPrices: [1500, 2000, 2500, 3000, 3500],
  paints: {
    amber: { label: "paintAmber", top: "#f4b665" },
    classic: { label: "paintClassic", top: "#ffffff" },
    cobalt: { label: "paintCobalt", top: "#6f9ff0" },
    graphite: { label: "paintGraphite", top: "#ed3046" },
    iris: { label: "paintIris", top: "#8455bf" },
    seafoam: { label: "paintSeafoam", top: "#282d36" },
  },
  rockRelease: { releaseSeconds: 0.24, spread: 7.68 },
  // Shield levels 2 and 3 add capacity. All levels share the content's recharge timing.
  shieldLevels: { capacity: [15, 20] },
  shieldRecharge: { capacityPerOre: 0.02, freeCapacity: 0.1 },
  stardustPickupGap: 2,
  stardustPickupRadius: 5,
  station: {
    cellSize: STATION_CELL_SIZE,
    // Every cell holds a station; occupancy only gates a cell, so seeded positions never move.
    chance: 1,
    destinationClearance: 1200,
    discoveryRadius: 320,
    exclusionRadius: 320,
    indicatorRange: TARGET_MARKER_RANGE,
    jitter: STATION_JITTER,
    minimumSpacing: (STATION_CELL_SIZE - STATION_JITTER) / Math.SQRT2,
    originClearance: 3000,
    radius: 60,
  },
  trackPrices: {
    engine: [180, 360],
    shield: [450, 900],
    tractor: [120, 240],
  },
  // The tractor beam's pull radius and speed by level, alike for every pickup.
  tractorRadius: { base: 60, levels: [90, 120] },
  tractorSpeed: { base: 120, levels: [160, 200] },
  upgradeDropChance: { heavy: 0.2, small: 0.0025 },
  upgradeDropWeights: {
    categories: { engine: 1, shield: 1, tractor: 1, weapons: 1 },
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
  weaponUpgradePrices: UPGRADE_PRICES,
};
