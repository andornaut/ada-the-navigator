import type { AsteroidSize } from "../data/asteroidCatalog.ts";
import type { AsteroidLootContext } from "../data/asteroidLoot.ts";

export interface AsteroidLoot {
  readonly ore: number;
  readonly stardust: number;
}

function validScale(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= 1;
}

/** Derives the adjustable ore share while preserving a non-small ore-only-one payout. */
export function oreQuantityScale(context: AsteroidLootContext, size: AsteroidSize): number {
  if (!validScale(context.oreQuantityMultiplier)) {
    throw new RangeError("Invalid ore quantity multiplier");
  }
  if (!validScale(context.yieldScale)) {
    throw new RangeError("Invalid yield scale");
  }
  const multiplier = context.oreQuantityMultiplier * context.yieldScale;
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

/**
 * The share of Stardust units a payout keeps, holding expected Stardust at `yieldScale` while a
 * non-small payout whose raw ore is at most one always keeps its first Stardust unit, so it
 * cannot come out empty.
 */
export function stardustKeep(context: AsteroidLootContext, size: AsteroidSize): number {
  if (!validScale(context.yieldScale)) {
    throw new RangeError("Invalid yield scale");
  }
  const { minimum, weights } = context.totals[size];
  const sum = weights.reduce((sum, weight) => sum + weight, 0);
  const oreChance = context.oreChance;
  let expected = 0;
  let protectedUnit = 0;
  weights.forEach((weight, index) => {
    const total = minimum + index;
    expected += (weight / sum) * total * (1 - oreChance);
    if (minimum === 1) {
      // No raw ore, or one raw ore beside at least one Stardust unit.
      const once = total >= 2 ? total * oreChance * (1 - oreChance) ** (total - 1) : 0;
      protectedUnit += (weight / sum) * ((1 - oreChance) ** total + once);
    }
  });
  const adjustable = expected - protectedUnit;
  const keep = adjustable === 0 ? 1 : (context.yieldScale * expected - protectedUnit) / adjustable;
  if (keep < 0) {
    throw new RangeError("Stardust target conflicts with the minimum resource payout");
  }
  return keep;
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
  // Each Stardust unit's conditional residual, uniform without advancing the drop stream.
  const stardustResiduals: number[] = [];
  for (let index = 0; index < total; index++) {
    const unit = next();
    if (unit < context.oreChance) {
      ore++;
      residual = unit / context.oreChance;
    } else {
      residual = (unit - context.oreChance) / (1 - context.oreChance);
      stardustResiduals.push(residual);
    }
  }
  if (minimum === 1 && ore === 1 && stardustResiduals.length === 0) {
    return { ore, stardust: 0 };
  }
  const keep = stardustKeep(context, size);
  const protectedUnit = minimum === 1 && ore <= 1;
  const stardust = stardustResiduals.filter(
    (unit, index) => (protectedUnit && index === 0) || unit < keep,
  ).length;
  const target = oreQuantityScale(context, size) * ore;
  const lower = Math.floor(target);
  // The last unit's conditional residual is uniform without advancing the drop stream.
  return { ore: lower + Number(residual < target - lower), stardust };
}
