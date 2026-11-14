import type { AsteroidSize } from "../data/asteroidCatalog.ts";
import type { AsteroidLootContext } from "../data/asteroidLoot.ts";

export interface AsteroidLoot {
  readonly ore: number;
  readonly stardust: number;
}

interface OreRounding {
  readonly lower: number;
  readonly upper: number;
  readonly upperChance: number;
}

function oreRounding(minimum: number, cap: number, loot: AsteroidLoot): OreRounding | null {
  const lower = Math.max(Math.floor(loot.ore / 5) * 5, minimum - loot.stardust);
  const upper = (Math.floor(loot.ore / 5) + 1) * 5;
  if (lower >= loot.ore || upper + loot.stardust > cap) {
    return null;
  }
  return { lower, upper, upperChance: (loot.ore - lower) / (upper - lower) };
}

/** Derives the required redistribution share from the canonical weighted compositions. */
export function oreBundleMix(context: AsteroidLootContext, size: AsteroidSize): number {
  const multiplier = context.oreBundleMultiplier;
  if (!Number.isFinite(multiplier) || multiplier < 1) {
    throw new RangeError("Invalid ore bundle multiplier");
  }
  const { minimum, weights } = context.totals[size];
  const cap = minimum + weights.length - 1;
  const sum = weights.reduce((sum, weight) => sum + weight, 0);
  let baseline = 0,
    gain = 0;
  for (const [index, weight] of weights.entries()) {
    const total = minimum + index;
    let combinations = 1;
    for (let ore = 0; ore <= total; ore++) {
      if (ore > 0) {
        combinations *= (total - ore + 1) / ore;
      }
      const stardust = total - ore;
      const probability =
        (weight / sum) *
        combinations *
        context.oreChance ** ore *
        (1 - context.oreChance) ** stardust;
      const bundles = Math.floor(ore / 5);
      baseline += probability * bundles;
      const rounding = oreRounding(minimum, cap, { ore, stardust });
      if (rounding) {
        const expected =
          Math.floor(rounding.lower / 5) * (1 - rounding.upperChance) +
          Math.floor(rounding.upper / 5) * rounding.upperChance;
        gain += probability * (expected - bundles);
      }
    }
  }
  const required = baseline * (multiplier - 1);
  if (required === 0) {
    return 0;
  }
  if (gain <= 0 || required > gain + 1e-12) {
    throw new RangeError("Ore bundle multiplier exceeds the bounded redistribution");
  }
  return Math.max(0, Math.min(1, required / gain));
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
  const rounding = oreRounding(minimum, minimum + weights.length - 1, loot);
  if (rounding) {
    const mix = oreBundleMix(context, size);
    // The last unit's conditional residual is uniform without advancing the drop stream.
    if (residual < mix) {
      return {
        ore: residual / mix < rounding.upperChance ? rounding.upper : rounding.lower,
        stardust: loot.stardust,
      };
    }
  }
  return loot;
}
