import type { AsteroidSize } from "./asteroidCatalog.ts";

export interface AsteroidLootContext {
  /** Expected ore quantity relative to the original ore roll. */
  readonly oreQuantityMultiplier: number;
  readonly oreChance: number;
  /** Relative original total-yield weights, before ore quantity reduction. */
  readonly totals: Readonly<
    Record<
      AsteroidSize,
      {
        readonly minimum: number;
        readonly weights: readonly number[];
      }
    >
  >;
  /**
   * Expected ore and Stardust relative to the quantity-reduced ore and the original Stardust,
   * the same in every galaxy (gameplay/economy.md "Earning Stardust").
   */
  readonly yieldScale: number;
}

/**
 * Least ore a destroyed crystal rock gives; it skips the ammo roll, and further ore and Stardust
 * roll as usual (gameplay/economy.md "Earning Stardust").
 */
export const CRYSTAL_MINIMUM_ORE = 1;

/** Raw units split independently before the class-wide ore quantity reduction. */
export const ASTEROID_LOOT: AsteroidLootContext = {
  oreChance: 0.75,
  oreQuantityMultiplier: 0.75,
  totals: {
    huge: { minimum: 1, weights: [5, 8, 12, 36, 14, 2, 2, 2, 3, 16] },
    large: { minimum: 1, weights: [10, 14, 19, 20, 16, 10, 3, 8] },
    medium: { minimum: 1, weights: [15, 20, 30, 24, 7, 4] },
    small: { minimum: 0, weights: [15, 10, 37, 36, 2] },
  },
  yieldScale: 0.8,
};
