import { GALAXY_NUMBERS } from "../data/galaxies.ts";
import type { GalaxyNumber } from "../data/types.ts";
import type { FlightState, GalaxyGeography, GalaxyProgress } from "./types.ts";

const uint32 = (value: unknown): value is number =>
  Number.isInteger(value) && (value as number) >= 0 && (value as number) <= 0xffffffff;

export function validGalaxyGeography(value: unknown): value is GalaxyGeography {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    Object.keys(record).length === 3 &&
    record.version === 1 &&
    (record.sitePolicy === "seeded"
      ? uint32(record.seed)
      : record.sitePolicy === "legacy-fixed" &&
        (record.seed === null ||
          (Number.isSafeInteger(record.seed) && (record.seed as number) >= 0)))
  );
}

/** No saved enemy state or site coordinates are part of the persistent geography record. */
export function freshGalaxyGeography(seed: number): GalaxyGeography {
  if (!uint32(seed)) {
    throw new RangeError("Invalid geography seed");
  }
  return { seed, sitePolicy: "seeded", version: 1 };
}

/** Initialize only absent procedural history; legacy fixed-site policy never changes. */
export function initializeGalaxyGeography(
  nextSeed: () => number,
  progress: Pick<GalaxyProgress, "geography">,
): GalaxyGeography & { seed: number } {
  const geography = progress.geography ?? { seed: null, sitePolicy: "legacy-fixed", version: 1 };
  if (geography.seed === null) {
    const seed = nextSeed();
    if (!uint32(seed)) {
      throw new RangeError("Invalid geography seed");
    }
    geography.seed = seed;
  }
  progress.geography = geography;
  return geography as GalaxyGeography & { seed: number };
}

/** Preserve the exact active legacy seed without inferring a lost historical seed. */
export function adoptLegacyGeography(
  progress: Record<GalaxyNumber, GalaxyProgress>,
  flight: Pick<FlightState, "galaxy" | "seed"> | null,
): void {
  for (const galaxy of GALAXY_NUMBERS) {
    progress[galaxy].geography = {
      seed: flight?.galaxy === galaxy ? flight.seed : null,
      sitePolicy: "legacy-fixed",
      version: 1,
    };
  }
}
