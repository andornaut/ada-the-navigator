import type { AsteroidSize } from "./asteroidCatalog.ts";

export interface AsteroidLootContext {
  /** Expected five-unit pickup count relative to the original ore roll. */
  readonly oreBundleMultiplier: number;
  readonly oreChance: number;
  /** Relative original total-yield weights, before ore redistribution. */
  readonly totals: Readonly<
    Record<
      AsteroidSize,
      {
        readonly minimum: number;
        readonly weights: readonly number[];
      }
    >
  >;
}

/** Original units split independently; ore redistribution preserves conditional expected ore. */
export const ASTEROID_LOOT: AsteroidLootContext = {
  oreBundleMultiplier: 2,
  oreChance: 0.75,
  totals: {
    huge: { minimum: 1, weights: [5, 8, 12, 36, 14, 2, 2, 2, 3, 16] },
    large: { minimum: 1, weights: [10, 14, 19, 20, 16, 10, 3, 8] },
    medium: { minimum: 1, weights: [15, 20, 30, 24, 7, 4] },
    small: { minimum: 0, weights: [15, 10, 37, 36, 2] },
  },
};
