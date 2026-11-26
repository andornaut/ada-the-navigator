import { writeFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { ASTEROID_SIZES } from "../data/asteroidCatalog.ts";
import { ASTEROID_LOOT } from "../data/asteroidLoot.ts";
import { oreQuantityScale, rollAsteroidLoot, stardustKeep } from "./asteroidLoot.ts";

const rawContext = { ...ASTEROID_LOOT, oreQuantityMultiplier: 1, yieldScale: 1 };

/** Follows a roll's last expected draw, so a roll that reads past its units is caught. */
const SENTINEL_DRAW = 0.3141592653589793;

/** Cartesian products of the given choices. */
function products<T>(choices: readonly (readonly T[])[]): T[][] {
  return choices.reduce<T[][]>(
    (combos, options) => combos.flatMap((combo) => options.map((option) => [...combo, option])),
    [[]],
  );
}

/** A residual interval: its midpoint and width. */
interface Segment {
  readonly at: number;
  readonly width: number;
}

/** The intervals of [0, 1) between sorted cut points, with zero-width intervals left out. */
function segments(cuts: readonly number[]): Segment[] {
  const points = [0, ...cuts.filter((cut) => cut > 0 && cut < 1).sort((a, b) => a - b), 1];
  return points.slice(1).flatMap((end, index) => {
    const start = points[index]!;
    return end > start ? [{ at: (start + end) / 2, width: end - start }] : [];
  });
}

/**
 * Partitions every classified unit outcome, the last unit's residual at the ore rounding and
 * Stardust keep cuts, and every other Stardust unit's residual at the keep cut, without sampling.
 */
function distributionProof() {
  const rows = [];
  for (const size of ASTEROID_SIZES) {
    const { minimum, weights } = ASTEROID_LOOT.totals[size];
    const cap = minimum + weights.length - 1;
    const scale = { huge: 59 / 99, large: 23 / 39, medium: 11 / 19, small: 3 / 5 }[size];
    expect(oreQuantityScale(ASTEROID_LOOT, size)).toBeCloseTo(scale, 12);
    const keep = {
      huge: 2992197 / 3811397,
      large: 274789 / 356709,
      medium: 42461 / 57821,
      small: 4 / 5,
    }[size];
    expect(stardustKeep(ASTEROID_LOOT, size)).toBeCloseTo(keep, 12);
    const p = ASTEROID_LOOT.oreChance;
    const expectedTotal = { huge: 5, large: 4, medium: 3, small: 2 }[size];
    let start = 0,
      mass = 0,
      oreMean = 0,
      stardustMean = 0;
    let beforeBundles = 0,
      afterBundles = 0,
      beforeAppearance = 0,
      afterAppearance = 0;
    let beforeSingles = 0,
      afterSingles = 0,
      beforeMax = 0,
      afterMax = 0;
    const support = new Set<number>();
    const violations: unknown[] = [];
    for (const [index, weight] of weights.entries()) {
      const total = minimum + index;
      const totalDraw = (start + weight / 2) / 100;
      start += weight;
      for (let mask = 0; mask < 2 ** total; mask++) {
        let ore = 0;
        for (let bit = 0; bit < total; bit++) {
          ore += Number((mask & (1 << bit)) !== 0);
        }
        const stardust = total - ore;
        const probability = (weight / 100) * p ** ore * (1 - p) ** stardust;
        beforeBundles += probability * Math.floor(ore / 5);
        beforeAppearance += probability * Number(ore >= 5);
        beforeSingles += probability * (ore % 5);
        beforeMax += probability * Number(total === cap);
        const protectedOne = minimum === 1 && ore === 1 && stardust === 0;
        const target = protectedOne ? 1 : ore * scale;
        const isOre = (bit: number) => (mask & (1 << bit)) !== 0;
        const lastIsOre = total > 0 && isOre(total - 1);
        const lastCuts = [target - Math.floor(target), ...(total > 0 && !lastIsOre ? [keep] : [])];
        // Every Stardust unit before the last splits at the keep cut; earlier ore units' residuals
        // do not matter.
        const earlier = Array.from({ length: Math.max(0, total - 1) }, (_, bit) =>
          isOre(bit) ? [{ at: 0.5, width: 1 }] : segments([keep]),
        );
        const keptMean = protectedOne
          ? 0
          : minimum === 1 && ore <= 1
            ? 1 + keep * (stardust - 1)
            : keep * stardust;
        let conditionalOre = 0;
        let conditionalStardust = 0;
        for (const units of products([
          ...earlier,
          total > 0 ? segments(lastCuts) : [{ at: 0.5, width: 1 }],
        ])) {
          let width = 1;
          const draws = [totalDraw];
          for (let bit = 0; bit < total; bit++) {
            const unit = units[bit]!;
            width *= unit.width;
            draws.push(isOre(bit) ? p * unit.at : p + (1 - p) * unit.at);
          }
          draws.push(SENTINEL_DRAW);
          let calls = 0;
          const actual = rollAsteroidLoot(ASTEROID_LOOT, size, () => draws[calls++]!);
          let rawCalls = 0;
          const original = rollAsteroidLoot(rawContext, size, () => draws[rawCalls++]!);
          const actualTotal = actual.ore + actual.stardust;
          // Plain comparisons keep the enumeration fast; each class asserts no violations, and the
          // first few are kept for the failure message.
          if (
            violations.length < 5 &&
            (calls !== total + 1 ||
              rawCalls !== calls ||
              original.ore !== ore ||
              original.stardust !== stardust ||
              !Number.isSafeInteger(actual.ore) ||
              actual.ore < 0 ||
              actual.ore > original.ore ||
              actual.stardust > original.stardust ||
              actualTotal < minimum ||
              actualTotal > cap)
          ) {
            violations.push({ actual, calls, mask, original, rawCalls, size, total, units });
          }
          conditionalOre += width * actual.ore;
          conditionalStardust += width * actual.stardust;
          const joint = probability * width;
          mass += joint;
          oreMean += joint * actual.ore;
          stardustMean += joint * actual.stardust;
          afterBundles += joint * Math.floor(actual.ore / 5);
          afterAppearance += joint * Number(actual.ore >= 5);
          afterSingles += joint * (actual.ore % 5);
          afterMax += joint * Number(actualTotal === cap);
          support.add(actualTotal);
        }
        expect(conditionalOre).toBeCloseTo(target, 12);
        expect(conditionalStardust).toBeCloseTo(keptMean, 12);
      }
    }
    expect(violations).toEqual([]);
    expect(mass).toBeCloseTo(1, 12);
    expect(oreMean).toBeCloseTo(expectedTotal * 0.75 * 0.75 * 0.8, 12);
    expect(stardustMean).toBeCloseTo(expectedTotal * 0.25 * 0.8, 12);
    expect(afterSingles).toBeCloseTo(oreMean - 5 * afterBundles, 12);
    expect(afterBundles).toBeLessThanOrEqual(beforeBundles);
    rows.push({
      afterAppearance,
      afterBundles,
      afterMax,
      afterSingles,
      beforeAppearance,
      beforeBundles,
      beforeMax,
      beforeSingles,
      cap,
      keep,
      minimum,
      oreMean,
      scale,
      size,
      stardustMean,
      support: [...support].sort((a, b) => a - b),
      totalMean: oreMean + stardustMean,
    });
  }
  return rows;
}

describe("reduced ore quantity distribution", () => {
  it("scales each class's ore mean to 0.6 and Stardust mean to 0.8, with unchanged draw counts", () => {
    const rows = distributionProof();
    const output = process.env.ORE_QUANTITY_PROOF_OUTPUT;
    if (output) {
      const proof = {
        method: "Exact weighted masks and residual intervals; no random or pacing simulation.",
        metric: "Ore quantity per resource outcome; five-unit pickups are packing only.",
        rows,
      };
      writeFileSync(output, `${JSON.stringify(proof, null, 2)}\n`);
    }
  });

  it("rejects invalid or infeasible targets rather than silently increasing ore or missing the target", () => {
    for (const multiplier of [-1, NaN, Infinity, 2]) {
      expect(() =>
        oreQuantityScale({ ...ASTEROID_LOOT, oreQuantityMultiplier: multiplier }, "huge"),
      ).toThrow(RangeError);
    }
    expect(() =>
      oreQuantityScale({ ...ASTEROID_LOOT, oreQuantityMultiplier: 0 }, "medium"),
    ).toThrow(/minimum/);
    for (const yieldScale of [-1, NaN, Infinity, 2]) {
      expect(() => oreQuantityScale({ ...ASTEROID_LOOT, yieldScale }, "huge")).toThrow(RangeError);
      expect(() => stardustKeep({ ...ASTEROID_LOOT, yieldScale }, "huge")).toThrow(RangeError);
    }
    expect(() => stardustKeep({ ...ASTEROID_LOOT, yieldScale: 0 }, "medium")).toThrow(/minimum/);
    expect(oreQuantityScale(rawContext, "huge")).toBe(1);
    expect(stardustKeep(rawContext, "huge")).toBe(1);
  });
});
