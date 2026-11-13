import type { AsteroidSize } from "./asteroidCatalog.ts";
import type { RoutePosition } from "./galaxies.ts";

export type ChunkTemplateId = "quiet" | "cluster" | "passage" | "poi";
/** Chunk template weights by route position; a placeholder reads the built galaxy before it. */
export type ChunkCatalog = Readonly<
  Partial<Record<RoutePosition, readonly { id: ChunkTemplateId; weight: number }[]>>
>;

/** A galaxy's asteroid mix: slot and feature size weights, feature chance per template. */
export interface AsteroidField {
  readonly driftChance: number;
  readonly featureChance: Readonly<Record<ChunkTemplateId, number>>;
  readonly featureSizes: Readonly<Partial<Record<AsteroidSize, number>>>;
  /** Shot hit points by size class. */
  readonly hp: Readonly<Record<AsteroidSize, number>>;
  readonly slotSizes: Readonly<Partial<Record<AsteroidSize, number>>>;
}

// Provisional playtest field shared by every galaxy until galaxies are themed.
const SHARED_ASTEROID_FIELD: AsteroidField = {
  // Ordinary asteroids hold their centres; eligible art still spins at its seeded rate.
  driftChance: 0,
  featureChance: { cluster: 0.35, passage: 0.2, poi: 0, quiet: 0.45 },
  featureSizes: { huge: 0.35, large: 0.65 },
  hp: { huge: 16, large: 10, medium: 5, small: 3 },
  slotSizes: { medium: 0.4, small: 0.6 },
};
/** Asteroid fields by route position; a placeholder reads the built galaxy before it. */
export const ASTEROID_FIELDS: Readonly<Partial<Record<RoutePosition, AsteroidField>>> = {
  1: SHARED_ASTEROID_FIELD,
  2: SHARED_ASTEROID_FIELD,
  5: SHARED_ASTEROID_FIELD,
};

// Provisional neutral weights for all galaxies.
export const CHUNK_CATALOG: ChunkCatalog = {
  1: [
    { id: "quiet", weight: 1 },
    { id: "cluster", weight: 1 },
    { id: "passage", weight: 1 },
    { id: "poi", weight: 1 },
  ],
  2: [
    { id: "quiet", weight: 1 },
    { id: "cluster", weight: 1 },
    { id: "passage", weight: 1 },
    { id: "poi", weight: 1 },
  ],
  5: [
    { id: "quiet", weight: 1 },
    { id: "cluster", weight: 1 },
    { id: "passage", weight: 1 },
    { id: "poi", weight: 1 },
  ],
};
