import type { AsteroidSize } from "../data/asteroidCatalog.ts";
import type { AsteroidLootContext } from "../data/asteroidLoot.ts";

export interface AsteroidLoot {
  readonly ore: number;
  readonly stardust: number;
}

/** One destruction's complete ore and Stardust payout, with no extra burst. */
export function rollAsteroidLoot(
  context: AsteroidLootContext,
  size: AsteroidSize,
  next: () => number,
): AsteroidLoot {
  const { minimum, weights } = context.totals[size];
  const draw = next();
  const sum = weights.reduce((sum, weight) => sum + weight, 0);
  let cumulative = 0;
  let total = minimum;
  for (let index = 0; index < weights.length - 1; index++) {
    cumulative += weights[index]!;
    if (draw < cumulative / sum) {
      break;
    }
    total++;
  }
  let ore = 0;
  for (let index = 0; index < total; index++) {
    if (next() < context.oreChance) {
      ore++;
    }
  }
  return { ore, stardust: total - ore };
}
