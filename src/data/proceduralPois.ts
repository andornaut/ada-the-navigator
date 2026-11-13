import { ECONOMY } from "./economy.ts";
import { LANDMARK_KINDS, LANDMARK_TUNING, type LandmarkKind } from "./jobs.ts";

/** Additional nonstory places use the existing survey's initial per-area density, without its credit. */
export const PROCEDURAL_POIS = {
  cellSize: ECONOMY.station.cellSize,
  density: LANDMARK_TUNING.count / (Math.PI * LANDMARK_TUNING.radius ** 2),
  kinds: LANDMARK_KINDS,
  /** A local query budget, not a boundary of the galaxy or a survey denominator. */
  maxQueryRadius: LANDMARK_TUNING.radius,
  opportunities: [
    { kind: "resources", weight: 0.5 },
    { kind: "salvage", weight: 0.35 },
    { kind: "job", weight: 0.15 },
  ],
  placeClearance: LANDMARK_TUNING.placeClearance,
  spacing: LANDMARK_TUNING.spacing,
} as const;

/** Generic existing labels distinguish these places from the twelve named survey landmarks. */
export const PROCEDURAL_POI_NAMES: Readonly<Record<LandmarkKind, string>> = {
  beacon: "mapKindBeacon",
  nebula: "mapKindNebula",
  wreck: "mapKindWreck",
};
