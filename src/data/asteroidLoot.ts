import type { AsteroidSize } from "./asteroidCatalog.ts";

export interface AsteroidLootContext {
  readonly oreChance: number;
  /** Relative total-yield weights, starting at the size's minimum. */
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

/** Each yielded unit independently becomes ore or Stardust. */
export const ASTEROID_LOOT: AsteroidLootContext = {
  oreChance: 0.75,
  totals: {
    huge: { minimum: 1, weights: [5, 12, 20, 20, 11, 7, 4, 3, 2, 16] },
    large: { minimum: 1, weights: [10, 20, 25, 20, 10, 5, 2, 8] },
    medium: { minimum: 1, weights: [20, 35, 25, 12, 4, 4] },
    small: { minimum: 0, weights: [15, 55, 22, 6, 2] },
  },
};
