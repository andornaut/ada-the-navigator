import { writeFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { ASTEROID_SIZES } from "../data/asteroidCatalog.ts";
import { ASTEROID_LOOT } from "../data/asteroidLoot.ts";
import { oreQuantityScale, rollAsteroidLoot } from "./asteroidLoot.ts";

const rawContext = { ...ASTEROID_LOOT, oreQuantityMultiplier: 1 };

/** Partitions every classified unit outcome and every residual interval, without sampling. */
function distributionProof() {
  const rows = [];
  for (const size of ASTEROID_SIZES) {
    const { minimum, weights } = ASTEROID_LOOT.totals[size];
    const cap = minimum + weights.length - 1;
    const scale = { huge: 74 / 99, large: 29 / 39, medium: 14 / 19, small: 3 / 4 }[size];
    expect(oreQuantityScale(ASTEROID_LOOT, size)).toBeCloseTo(scale, 12);
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
        const intervals = [0, target - Math.floor(target), 1];
        let conditionalOre = 0;
        for (let segment = 1; segment < intervals.length; segment++) {
          const width = intervals[segment]! - intervals[segment - 1]!;
          if (width <= 0) {
            continue;
          }
          const residual = (intervals[segment]! + intervals[segment - 1]!) / 2;
          const draws = [
            totalDraw,
            ...Array.from({ length: total }, (_, bit) => {
              const unitResidual = bit === total - 1 ? residual : 0.5;
              return (mask & (1 << bit)) !== 0 ? p * unitResidual : p + (1 - p) * unitResidual;
            }),
            0.3141592653589793,
          ];
          let calls = 0;
          const actual = rollAsteroidLoot(ASTEROID_LOOT, size, () => draws[calls++]!);
          expect(calls).toBe(total + 1);
          expect(draws[calls]).toBe(0.3141592653589793);
          let rawCalls = 0;
          const original = rollAsteroidLoot(rawContext, size, () => draws[rawCalls++]!);
          expect(original).toEqual({ ore, stardust });
          expect(rawCalls).toBe(calls);
          expect(actual.stardust).toBe(original.stardust);
          expect(Number.isSafeInteger(actual.ore)).toBe(true);
          expect(actual.ore).toBeGreaterThanOrEqual(0);
          const actualTotal = actual.ore + actual.stardust;
          expect(actualTotal).toBeGreaterThanOrEqual(minimum);
          expect(actualTotal).toBeLessThanOrEqual(cap);
          expect(actual.ore).toBeLessThanOrEqual(original.ore);
          conditionalOre += width * actual.ore;
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
      }
    }
    expect(mass).toBeCloseTo(1, 12);
    expect(oreMean).toBeCloseTo(expectedTotal * 0.75 * 0.75, 12);
    expect(stardustMean).toBeCloseTo(expectedTotal * 0.25, 12);
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
  it("reduces each class ore mean by 25% with identical Stardust and draw counts", () => {
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
    expect(oreQuantityScale(rawContext, "huge")).toBe(1);
  });
});
