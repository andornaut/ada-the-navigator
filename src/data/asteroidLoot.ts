import type { AsteroidSize } from "./asteroidCatalog.ts";

export interface AsteroidLootContext {
  readonly oreChance: number;
  /** Relative weights for total yields of one through five units. */
  readonly totals: Readonly<
    Record<AsteroidSize, readonly [number, number, number, number, number]>
  >;
}

/** Each yielded unit independently becomes ore or Stardust. */
export const ASTEROID_LOOT: AsteroidLootContext = {
  oreChance: 0.5,
  totals: {
    huge: [5, 10, 20, 30, 35],
    large: [10, 20, 35, 25, 10],
    medium: [25, 40, 25, 8, 2],
    small: [60, 25, 10, 4, 1],
  },
};
