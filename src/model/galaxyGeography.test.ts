import { describe, expect, it, vi } from "vitest";

import { GALAXY_NUMBERS } from "../data/galaxies.ts";
import type { GalaxyNumber } from "../data/types.ts";
import { flightEncounterSeed } from "./flightTopology.ts";
import {
  adoptLegacyGeography,
  freshGalaxyGeography,
  initializeGalaxyGeography,
  validGalaxyGeography,
} from "./galaxyGeography.ts";
import { newProgress } from "./progress.ts";
import type { GalaxyProgress } from "./types.ts";

const progress = () =>
  Object.fromEntries(GALAXY_NUMBERS.map((galaxy) => [galaxy, newProgress()])) as Record<
    GalaxyNumber,
    GalaxyProgress
  >;

describe("persistent galaxy seed contract", () => {
  it("keeps the active legacy seed and fixed-site policy without inventing inactive history", () => {
    const galaxies = progress();
    galaxies[1].known = ["growers"];
    galaxies[1].stations = ["station:3,4"];
    galaxies[1].charted = ["landmark:1:0"];
    galaxies[1].explored = ["0,0"];
    galaxies[1].questComplete = galaxies[1].resolved = true;
    const before = structuredClone(galaxies[1]);
    adoptLegacyGeography(galaxies, { galaxy: 1, seed: Number.MAX_SAFE_INTEGER });
    expect(galaxies[1]).toEqual({
      ...before,
      geography: { seed: Number.MAX_SAFE_INTEGER, sitePolicy: "legacy-fixed", version: 1 },
    });
    expect(galaxies[3].geography).toEqual({ seed: null, sitePolicy: "legacy-fixed", version: 1 });
  });

  it("initializes an absent legacy home seed only once without changing its site policy", () => {
    const galaxies = progress();
    adoptLegacyGeography(galaxies, null);
    const next = vi.fn(() => 42);
    const first = initializeGalaxyGeography(next, galaxies[1]);
    expect(initializeGalaxyGeography(next, galaxies[1])).toBe(first);
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
