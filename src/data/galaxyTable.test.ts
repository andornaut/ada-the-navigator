import { describe, expect, it } from "vitest";

import { BUILT, byPosition } from "./galaxies.ts";
import type { GalaxyNumber } from "./types.ts";

describe("sparse galaxy tables", () => {
  it("keeps explicit rows independent of chapter availability", () => {
    const own = { value: "own" };
    expect(byPosition({ 1: { value: "fallback" }, 4: own }, 5)).toBe(own);
  });

  it("keeps a shared table usable when a built chapter has no row of its own", () => {
    const built = BUILT as Set<GalaxyNumber>;
    const present = built.has(5);
    built.add(5);
    try {
      const inherited = { value: "shared" };
      expect(byPosition({ 1: { value: "first" }, 2: inherited }, 5)).toBe(inherited);
      expect(byPosition({ 1: inherited }, 5)).toBe(inherited);
    } finally {
      if (!present) {
        built.delete(5);
      }
    }
  });

  it("rejects a table with no applicable row instead of returning undefined", () => {
    expect(() => byPosition({}, 1)).toThrow(RangeError);
  });
});
