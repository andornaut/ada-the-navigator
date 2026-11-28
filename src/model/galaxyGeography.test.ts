import { describe, expect, it, vi } from "vitest";

import {
  freshGalaxyGeography,
  initializeGalaxyGeography,
  validGalaxyGeography,
} from "./galaxyGeography.ts";
import { newProgress } from "./progress.ts";
import { flightEncounterSeed } from "./world/index.ts";

describe("persistent galaxy seed contract", () => {
  it("initializes an absent legacy home seed only once without changing its site policy", () => {
    const galaxy = newProgress();
    galaxy.geography = { seed: null, sitePolicy: "legacy-fixed", version: 1 };
    const next = vi.fn(() => 42);
    const first = initializeGalaxyGeography(next, galaxy);
    expect(initializeGalaxyGeography(next, galaxy)).toBe(first);
    expect(first).toEqual({ seed: 42, sitePolicy: "legacy-fixed", version: 1 });
    expect(next).toHaveBeenCalledOnce();
  });

  it("retains a fresh playthrough seed without consuming a fresh-entry seed draw", () => {
    const galaxy = newProgress();
    galaxy.geography = freshGalaxyGeography(0xffffffff);
    const next = vi.fn(() => 21);
    expect(initializeGalaxyGeography(next, galaxy).seed).toBe(0xffffffff);
    expect(next).not.toHaveBeenCalled();
    expect(freshGalaxyGeography(21)).not.toEqual(galaxy.geography);
  });

  it("uses an independent encounter seed and preserves the legacy absent-field alias", () => {
    expect(flightEncounterSeed({ seed: Number.MAX_SAFE_INTEGER })).toBe(Number.MAX_SAFE_INTEGER);
    expect(flightEncounterSeed({ encounterSeed: 0, seed: 12 })).toBe(0);
    expect(flightEncounterSeed({ encounterSeed: 42, seed: 12 })).toBe(42);
  });

  it("validates the explicit generation policy without normalizing legacy seeds", () => {
    for (const record of [
      freshGalaxyGeography(0),
      freshGalaxyGeography(0xffffffff),
      { seed: null, sitePolicy: "legacy-fixed", version: 1 },
      { seed: Number.MAX_SAFE_INTEGER, sitePolicy: "legacy-fixed", version: 1 },
    ]) {
      expect(validGalaxyGeography(record)).toBe(true);
    }
    for (const record of [
      null,
      { seed: null, sitePolicy: "seeded", version: 1 },
      { seed: -1, sitePolicy: "legacy-fixed", version: 1 },
      { seed: 0x100000000, sitePolicy: "seeded", version: 1 },
      { seed: 1, sitePolicy: "seeded", version: 2 },
      { ...freshGalaxyGeography(1), extra: true },
    ]) {
      expect(validGalaxyGeography(record)).toBe(false);
    }
    expect(() => freshGalaxyGeography(-1)).toThrow(RangeError);
  });
});
