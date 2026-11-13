import { ORE_FIELD_LAYOUTS } from "./oreFieldLayouts.ts";
import type { GalaxyNumber } from "./types.ts";

/**
 * Cartwheel's ore fields (gameplay/ships.md): seeded clusters of resource rocks, placed like
 * stations. All values are provisional tuning in world units.
 */
export const ORE_FIELDS = {
  /**
   * Ordinary asteroids stay this far beyond the field's radius: chunk generation keeps them out
   * of `diameter / 2 + asteroidMargin` (600) around its centre, so a field holds only its rocks.
   */
  asteroidMargin: 150,
  /** Placement grid; fields sit in a central band, so neighbours stay `cellSize - jitter` apart. */
  cellSize: 4500,
  /** Chance that a cell holds an ore field. */
  chance: 0.7,
  /** Clearance from the hub, stations and quantum jump arrivals. */
  clearance: 1500,
  /** Inclusive resource rock count per field. */
  count: [6, 10] as const,
  /** Field diameter across its rock centres. */
  diameter: 2 * ORE_FIELD_LAYOUTS.radius,
  /**
   * Chance that a field on the guard checkerboard hosts a platform. Only half the cells are on
   * it, so at most half of fields are guarded.
   */
  galaxies: [2] as readonly GalaxyNumber[],
  guardChance: 0.8,
  /** A guard stands this far beyond the field's edge. */
  guardGap: 160,
  jitter: 1500,
  /** Share of claim-jumper groups moved to an ore field. */
  jumperShare: 0.5,
} as const;

/**
 * Whirlpool's hunting packs (gameplay/ships.md "Galaxy three roster"): a pack of hunters waits
 * near each whale destination, placed once per flight as Ada comes within `placeRange`.
 * Values are provisional tuning in world units.
 */
export const HUNTING_PACKS = {
  archetype: "fighter",
  /** Inclusive pack size. */
  count: [3, 4] as const,
  destinations: ["whale", "family"] as readonly string[],
  /** Pack centre from the destination, outside its safe area. */
  distance: 520,
  /** A pack this close to the destination's route guard moves to the far side. */
  galaxies: [3] as readonly GalaxyNumber[],
  guardGap: 400,
  placeRange: 1536,
  /** Member spacing around the pack centre. */
  spread: 70,
} as const;

/**
 * Whirlpool's space currents (gameplay/rules.md): seeded open curved paths whose flow drifts
 * ships and pickups. All values are provisional tuning in world units and seconds.
 */
export const CURRENTS = {
  /** Placement grid; one current per occupied cell, confined to its inner band. */
  cellSize: 3400,
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
  galaxies: [3] as readonly GalaxyNumber[],
  length: [3000, 8000] as const,
  /** Gap between a current's path and its cell's edge. */
  margin: 400,
  /** Peak flow at the centre line, world units per second. */
  peakFlow: 70,
  /** Polyline points along each path. */
  samples: 48,
  /** Inclusive path width range. */
  width: [300, 500] as const,
} as const;
