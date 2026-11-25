import { describe, expect, it } from "vitest";

import { ASTEROID_SIZES } from "../data/asteroidCatalog.ts";
import { ASTEROID_LOOT } from "../data/asteroidLoot.ts";
import { rollAsteroidLoot } from "./asteroidLoot.ts";
import { dropRandom } from "./drops.ts";

const rawContext = { ...ASTEROID_LOOT, oreQuantityMultiplier: 1, yieldScale: 1 };

describe("asteroid destruction loot", () => {
  it("keeps the accepted raw class weights and separate split and quantity controls", () => {
    expect(ASTEROID_LOOT).toEqual({
      oreChance: 0.75,
      oreQuantityMultiplier: 0.75,
      totals: {
        huge: { minimum: 1, weights: [5, 8, 12, 36, 14, 2, 2, 2, 3, 16] },
        large: { minimum: 1, weights: [10, 14, 19, 20, 16, 10, 3, 8] },
        medium: { minimum: 1, weights: [15, 20, 30, 24, 7, 4] },
        small: { minimum: 0, weights: [15, 10, 37, 36, 2] },
      },
      yieldScale: 0.8,
    });
  });

  it("retains every raw weighted total boundary and original draw count", () => {
    for (const size of ASTEROID_SIZES) {
      const { minimum, weights } = ASTEROID_LOOT.totals[size];
      const sum = weights.reduce((a, b) => a + b, 0);
      let start = 0;
      weights.forEach((weight, index) => {
        for (const fraction of [start / sum, (start + weight) / sum - 1e-8]) {
          let calls = 0;
          expect(
            rollAsteroidLoot(rawContext, size, () => (calls++ === 0 ? fraction : 0.5)),
          ).toEqual({ ore: minimum + index, stardust: 0 });
          expect(calls).toBe(minimum + index + 1);
        }
        start += weight;
      });
    }
  });

  it("preserves empty small drops, non-small ore-only-one and seeded identity", () => {
    let calls = 0;
    expect(
      rollAsteroidLoot(ASTEROID_LOOT, "small", () => {
        calls++;
        return 0;
      }),
    ).toEqual({ ore: 0, stardust: 0 });
    expect(calls).toBe(1);
    for (const size of ["medium", "large", "huge"] as const) {
      expect(rollAsteroidLoot(ASTEROID_LOOT, size, () => 0)).toEqual({ ore: 1, stardust: 0 });
    }
    const before = structuredClone(ASTEROID_LOOT);
    const first = rollAsteroidLoot(ASTEROID_LOOT, "huge", dropRandom(77, "loot:asteroid-1"));
    expect(rollAsteroidLoot(ASTEROID_LOOT, "huge", dropRandom(77, "loot:asteroid-1"))).toEqual(
      first,
    );
    expect(ASTEROID_LOOT).toEqual(before);
  });
});
