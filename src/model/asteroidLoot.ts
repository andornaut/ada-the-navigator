import type { AsteroidSize } from "../data/asteroidCatalog.ts";
import type { AsteroidLootContext } from "../data/asteroidLoot.ts";

export interface AsteroidLoot {
  readonly ore: number;
  readonly stardust: number;
}

/** Derives the adjustable ore share while preserving a non-small ore-only-one payout. */
export function oreQuantityScale(context: AsteroidLootContext, size: AsteroidSize): number {
  const multiplier = context.oreQuantityMultiplier;
  if (!Number.isFinite(multiplier) || multiplier < 0 || multiplier > 1) {
    throw new RangeError("Invalid ore quantity multiplier");
  }
  const { minimum, weights } = context.totals[size];
  const sum = weights.reduce((sum, weight) => sum + weight, 0);
  const expectedOre =
    (weights.reduce((sum, weight, index) => sum + weight * (minimum + index), 0) / sum) *
    context.oreChance;
  const protectedOne = minimum === 1 ? (weights[0]! / sum) * context.oreChance : 0;
  const target = multiplier * expectedOre;
  if (target < protectedOne) {
    throw new RangeError("Ore quantity target conflicts with the minimum resource payout");
  }
  const adjustable = expectedOre - protectedOne;
  const scale = adjustable === 0 ? 1 : (target - protectedOne) / adjustable;
  if (minimum > 0 && scale < 0.5) {
    throw new RangeError("Ore rounding would violate the minimum resource payout");
  }
  return scale;
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
  let ore = 0,
    residual = 0;
  for (let index = 0; index < total; index++) {
    const unit = next();
    if (unit < context.oreChance) {
      ore++;
      residual = unit / context.oreChance;
    } else {
      residual = (unit - context.oreChance) / (1 - context.oreChance);
    }
  }
  const loot = { ore, stardust: total - ore };
  if (minimum === 1 && loot.ore === 1 && loot.stardust === 0) {
    return loot;
  }
  const target = oreQuantityScale(context, size) * ore;
  const lower = Math.floor(target);
  // The last unit's conditional residual is uniform without advancing the drop stream.
  return { ore: lower + Number(residual < target - lower), stardust: loot.stardust };
}
