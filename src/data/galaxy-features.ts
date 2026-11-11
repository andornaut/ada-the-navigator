import type { SectorId } from "./types.ts";

/**
 * Cartwheel's ore fields (gameplay/ships.md): seeded clusters of resource rocks, placed like
 * stations. All values are provisional tuning in world units.
 */
export const ORE_FIELDS = {
  /** Placement grid; fields sit in a central band, so neighbours stay `cellSize - jitter` apart. */
  cellSize: 4500,
  /** Chance that a cell holds an ore field. */
  chance: 0.7,
  /** Clearance from the hub, stations and quantum jump arrivals. */
  clearance: 1500,
  /** Inclusive resource rock count per field. */
  count: [6, 10] as const,
  /** Field diameter across its rock centres. */
  diameter: 900,
  /**
   * Chance that a field on the guard checkerboard hosts a platform. Only half the cells are on
   * it, so at most half of fields are guarded.
   */
  guardChance: 0.8,
  /** A guard stands this far beyond the field's edge. */
  guardGap: 160,
  jitter: 1500,
  /** Share of claim-jumper groups moved to an ore field. */
  jumperShare: 0.5,
  sectors: [2] as readonly SectorId[],
} as const;

/**
 * Whirlpool's space currents (gameplay/rules.md): seeded open curved paths whose flow drifts
 * ships and pickups. All values are provisional tuning in world units and seconds.
 */
export const CURRENTS = {
  /** Placement grid; one current per occupied cell, confined to its inner band. */
  cellSize: 4000,
  /** Chance that a cell holds a current. */
  chance: 0.85,
  /** Clearance from stations, story destinations, landmarks and quantum jump arrivals. */
  clearance: 800,
  /** Debris rocks per 1000 world units of river. */
  debrisPerThousand: 1.2,
  /** Share of currents that carry a debris river. */
  debrisShare: 1 / 3,
  /** Flow fades in and out over this length at each end. */
  fade: 600,
  /** Inclusive path length range. */
  length: [3000, 8000] as const,
  /** Gap between a current's path and its cell's edge. */
  margin: 500,
  /** Peak flow at the centre line, world units per second. */
  peakFlow: 70,
  /** Polyline points along each path. */
  samples: 48,
  sectors: [3] as readonly SectorId[],
  /** Inclusive path width range. */
  width: [300, 500] as const,
} as const;
