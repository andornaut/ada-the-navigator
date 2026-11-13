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
  const weights = context.totals[size];
  let draw = next() * weights.reduce((sum, weight) => sum + weight, 0);
  let total = 1;
  for (let index = 0; index < weights.length - 1; index++) {
    draw -= weights[index]!;
    if (draw < 0) {
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
