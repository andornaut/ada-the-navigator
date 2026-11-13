import { describe, expect, it } from "vitest";

import { ASTEROID_SIZES } from "../data/asteroidCatalog.ts";
import { ASTEROID_LOOT } from "../data/asteroidLoot.ts";
import { rollAsteroidLoot } from "./asteroidLoot.ts";
import { dropRandom } from "./drops.ts";

describe("asteroid destruction loot", () => {
  it("uses the approved canonical size weights and equal per-unit split", () => {
    expect(ASTEROID_LOOT).toEqual({
      oreChance: 0.5,
      totals: {
        huge: [5, 10, 20, 30, 35],
        large: [10, 20, 35, 25, 10],
        medium: [25, 40, 25, 8, 2],
        small: [60, 25, 10, 4, 1],
      },
    });
  });

  it.each(ASTEROID_SIZES)("selects every %s total at its exact weighted interval", (size) => {
    const weights = ASTEROID_LOOT.totals[size];
    const sum = weights.reduce((a, b) => a + b, 0);
    let start = 0;
    weights.forEach((weight, index) => {
      for (const fraction of [
        start / sum,
        (start + weight / 2) / sum,
        (start + weight) / sum - 1e-8,
      ]) {
        let calls = 0;
        const result = rollAsteroidLoot(ASTEROID_LOOT, size, () => (calls++ === 0 ? fraction : 0));
        expect(result, `${size}:${fraction}`).toEqual({ ore: index + 1, stardust: 0 });
        expect(calls).toBe(index + 2);
      }
      start += weight;
    });
  });

  it.each(ASTEROID_SIZES)(
    "assigns each %s unit independently, including either zero output",
    (size) => {
      const weights = ASTEROID_LOOT.totals[size];
      let start = 0;
      weights.forEach((weight, index) => {
        const total = index + 1;
        const fraction = (start + weight / 2) / 100;
        const outcomes = new Map<number, number>();
        for (let mask = 0; mask < 2 ** total; mask++) {
          let calls = 0;
          let expectedOre = 0;
          const result = rollAsteroidLoot(ASTEROID_LOOT, size, () => {
            if (calls++ === 0) {
              return fraction;
            }
            const ore = (mask & (1 << (calls - 2))) !== 0;
            expectedOre += Number(ore);
            return ore ? 0.5 - Number.EPSILON : 0.5;
          });
          expect(result).toEqual({ ore: expectedOre, stardust: total - expectedOre });
          expect(result.ore + result.stardust).toBe(total);
          expect(calls).toBe(total + 1);
          outcomes.set(result.ore, (outcomes.get(result.ore) ?? 0) + 1);
        }
        expect(outcomes.get(0)).toBe(1);
        expect(outcomes.get(total)).toBe(1);
        if (total === 2) {
          expect(outcomes.get(1)).toBe(2);
        }
        start += weight;
      });
    },
  );

  it("makes larger classes more likely to yield higher totals without a frequency simulation", () => {
    const cumulative = ASTEROID_SIZES.map((size) => {
      const weights = ASTEROID_LOOT.totals[size];
      expect(weights.every((weight) => Number.isSafeInteger(weight) && weight > 0)).toBe(true);
      expect(weights.reduce((a, b) => a + b, 0)).toBe(100);
      return weights.map((_, index) => weights.slice(0, index + 1).reduce((a, b) => a + b, 0));
    });
    for (let size = 1; size < cumulative.length; size++) {
      for (let total = 0; total < 4; total++) {
        expect(cumulative[size]![total]).toBeLessThan(cumulative[size - 1]![total]!);
      }
    }
    expect(ASTEROID_LOOT.totals.small[0]).toBeGreaterThan(50);
    expect(ASTEROID_LOOT.totals.huge[4]).toBeGreaterThan(ASTEROID_LOOT.totals.small[4]);
  });

  it("repeats a destruction's payout from its seed and identity without changing tuning", () => {
    const before = structuredClone(ASTEROID_LOOT);
    const first = rollAsteroidLoot(ASTEROID_LOOT, "huge", dropRandom(77, "loot:asteroid-1"));
    expect(rollAsteroidLoot(ASTEROID_LOOT, "huge", dropRandom(77, "loot:asteroid-1"))).toEqual(
      first,
    );
    expect(ASTEROID_LOOT).toEqual(before);
    expect(first.ore + first.stardust).toBeGreaterThanOrEqual(1);
    expect(first.ore + first.stardust).toBeLessThanOrEqual(5);
  });
});
