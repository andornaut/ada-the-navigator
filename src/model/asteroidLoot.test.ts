import { describe, expect, it } from "vitest";

import { ASTEROID_SIZES } from "../data/asteroidCatalog.ts";
import { ASTEROID_LOOT } from "../data/asteroidLoot.ts";
import { rollAsteroidLoot } from "./asteroidLoot.ts";
import { dropRandom } from "./drops.ts";

describe("asteroid destruction loot", () => {
  it("uses the approved size weights and 75/25 per-unit split", () => {
    expect(ASTEROID_LOOT).toEqual({
      oreChance: 0.75,
      totals: {
        huge: { minimum: 1, weights: [5, 12, 20, 20, 11, 7, 4, 3, 2, 16] },
        large: { minimum: 1, weights: [10, 20, 25, 20, 10, 5, 2, 8] },
        medium: { minimum: 1, weights: [20, 35, 25, 12, 4, 4] },
        small: { minimum: 0, weights: [15, 55, 22, 6, 2] },
      },
    });
  });

  it.each(ASTEROID_SIZES)("selects every %s total at its exact weighted interval", (size) => {
    const { minimum, weights } = ASTEROID_LOOT.totals[size];
    const sum = weights.reduce((a, b) => a + b, 0);
    expect(sum).toBe(100);
    expect(weights.at(-1)).toBe({ huge: 16, large: 8, medium: 4, small: 2 }[size]);
    let start = 0;
    weights.forEach((weight, index) => {
      for (const fraction of [
        start / sum,
        (start + weight / 2) / sum,
        (start + weight) / sum - 1e-8,
      ]) {
        let calls = 0;
        const result = rollAsteroidLoot(ASTEROID_LOOT, size, () => (calls++ === 0 ? fraction : 0));
        expect(result, `${size}:${fraction}`).toEqual({ ore: minimum + index, stardust: 0 });
        expect(calls).toBe(minimum + index + 1);
      }
      start += weight;
    });
  });

  it.each(ASTEROID_SIZES)(
    "assigns each %s unit independently and conserves the complete weighted distribution",
    (size) => {
      const { minimum, weights } = ASTEROID_LOOT.totals[size];
      let start = 0,
        expectedOre = 0,
        expectedStardust = 0,
        expectedTotal = 0,
        mass = 0;
      weights.forEach((weight, index) => {
        const total = minimum + index;
        const fraction = (start + weight / 2) / 100;
        let zeroOre = 0,
          allOre = 0;
        for (let mask = 0; mask < 2 ** total; mask++) {
          let calls = 0,
            ore = 0,
            probability = weight / 100;
          const result = rollAsteroidLoot(ASTEROID_LOOT, size, () => {
            if (calls++ === 0) {
              return fraction;
            }
            const isOre = (mask & (1 << (calls - 2))) !== 0;
            ore += Number(isOre);
            probability *= isOre ? 0.75 : 0.25;
            return isOre ? 0.75 - Number.EPSILON : 0.75;
          });
          expect(result).toEqual({ ore, stardust: total - ore });
          expect(calls).toBe(total + 1);
          expectedOre += result.ore * probability;
          expectedStardust += result.stardust * probability;
          mass += probability;
          zeroOre += Number(ore === 0);
          allOre += Number(ore === total);
        }
        expect(zeroOre).toBe(1);
        expect(allOre).toBe(1);
        expectedTotal += (total * weight) / 100;
        start += weight;
      });
      expect(mass).toBeCloseTo(1, 12);
      expect(expectedOre).toBeCloseTo(expectedTotal * 0.75, 12);
      expect(expectedStardust).toBeCloseTo(expectedTotal * 0.25, 12);
    },
  );

  it("allows an empty small drop without consuming unit draws and guarantees other sizes at least one", () => {
    let calls = 0;
    expect(
      rollAsteroidLoot(ASTEROID_LOOT, "small", () => {
        calls++;
        return 0;
      }),
    ).toEqual({ ore: 0, stardust: 0 });
    expect(calls).toBe(1);
    for (const size of ["medium", "large", "huge"] as const) {
      expect(rollAsteroidLoot(ASTEROID_LOOT, size, () => 0.999999)).toEqual({
        ore: 0,
        stardust: ASTEROID_LOOT.totals[size].weights.length,
      });
      expect(rollAsteroidLoot(ASTEROID_LOOT, size, () => 0)).toEqual({ ore: 1, stardust: 0 });
    }
  });

  it("repeats a destruction's payout from its seed and identity without changing tuning", () => {
    const before = structuredClone(ASTEROID_LOOT);
    const first = rollAsteroidLoot(ASTEROID_LOOT, "huge", dropRandom(77, "loot:asteroid-1"));
    expect(rollAsteroidLoot(ASTEROID_LOOT, "huge", dropRandom(77, "loot:asteroid-1"))).toEqual(
      first,
    );
    expect(ASTEROID_LOOT).toEqual(before);
    expect(first.ore + first.stardust).toBeGreaterThanOrEqual(1);
    expect(first.ore + first.stardust).toBeLessThanOrEqual(10);
  });
});
