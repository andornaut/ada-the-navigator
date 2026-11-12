import type { RoutePosition } from "./galaxies.ts";
import type { SectorId } from "./types.ts";

// Station jobs and the landmarks surveys chart (gameplay/quests.md). Every number is Gameplay's
// provisional tuning.

/** A station job's type. */
export type JobType = "survey" | "delivery" | "rescue" | "hunt";
/** The order a board draws types in, and the rewards table's rows. */
export const JOB_TYPES: readonly JobType[] = ["survey", "delivery", "rescue", "hunt"];
/** A rewards row: a delivery pays by its length. */
export type JobRewardKind = "survey" | "hunt" | "deliveryShort" | "deliveryLong" | "rescue";

export const JOB_TUNING = {
  /** Offers on each board. */
  boardSize: 3,
  /**
   * A delivery's destination, in world units from the issuing station: the nearest known place
   * at least min away, long from longFrom.
   */
  delivery: { longFrom: 6000, min: 3000 },
  /** Job targets keep this far from retained frigates, capitals and platforms. */
  hostileClearance: 1000,
  /**
   * A lost item's search area: its centre's distance from the station and its radius; Penny
   * senses the item and it glints within their ranges.
   */
  hunt: { glint: 160, max: 7000, min: 3000, penny: 350, radius: 900 },
  /** A stranded craft's distance from the issuing station, in world units. */
  rescue: { max: 7000, min: 3000 },
  /** Tow handling: attach reach, line length, the safe-place radius and Ada's handling. */
  tow: {
    attach: 120,
    complete: 400,
    line: 80,
    responseScale: 2,
    topSpeedScale: 0.65,
    turnScale: 1.5,
  },
} as const;

/**
 * Stardust per job by route position (quests.md "Rewards"); a placeholder reads the built galaxy
 * before it.
 */
export const JOB_REWARDS: Readonly<
  Partial<Record<RoutePosition, Readonly<Record<JobRewardKind, number>>>>
> = {
  1: { deliveryLong: 25, deliveryShort: 15, hunt: 15, rescue: 25, survey: 10 },
  2: { deliveryLong: 50, deliveryShort: 30, hunt: 30, rescue: 50, survey: 20 },
  5: { deliveryLong: 35, deliveryShort: 20, hunt: 20, rescue: 35, survey: 15 },
};

/**
 * Each built galaxy's pool: what its jobs carry, tow and look for (quests.md "Job pool").
 * Placeholders have no stations, so no jobs.
 */
export const JOB_POOL: Readonly<
  Partial<
    Record<
      SectorId,
      {
        readonly craft: readonly string[];
        readonly delivery: readonly string[];
        readonly lost: readonly string[];
      }
    >
  >
> = {
  1: {
    craft: ["a seed pod", "a scrap barge"],
    delivery: ["seeds", "spare parts", "a message"],
    lost: ["toolbox", "watering can"],
  },
  2: {
    craft: ["an ore pod", "a stuck hauler"],
    delivery: ["ore samples", "drill bits", "a message"],
    lost: ["lucky charm", "helmet"],
  },
  3: {
    craft: ["a current skimmer", "a pod"],
    delivery: ["song shells", "star maps", "a message"],
    lost: ["music shell", "whale-call whistle"],
  },
};

/** Astra's lore lines after a job completes, one unseen line per job, for each built galaxy. */
export const JOB_LORE: Readonly<Partial<Record<SectorId, readonly string[]>>> = {
  1: [
    "Nebulae are clouds where new stars are born.",
    "The growers trade seeds the way some people trade stories.",
  ],
  2: [
    "Every rock here was once part of something bigger.",
    "Miners name their drills. I would like a name for my drive.",
  ],
  3: [
    "Whales sing to map the currents. We are both mapmakers.",
    "Currents carry seeds, rocks and songs from one side of Whirlpool to the other.",
  ],
};

/** A landmark's kind: drawn in the galaxy's own palette. */
export type LandmarkKind = "nebula" | "wreck" | "beacon";
export const LANDMARK_KINDS: readonly LandmarkKind[] = ["nebula", "wreck", "beacon"];

/** Galaxies one to four, Black Eye included: each names four landmarks of each kind. */
export type LandmarkGalaxy = 1 | 2 | 3 | 4;
export const LANDMARK_GALAXIES: readonly LandmarkGalaxy[] = [1, 2, 3, 4];

/**
 * The player-string key of a galaxy's nth landmark (1 to 4) of a kind, in quests.md's
 * "Landmarks" table order, such as landmark1Wreck3 for Sunflower's Sleepy Tug.
 */
export function landmarkNameKey(galaxy: LandmarkGalaxy, kind: LandmarkKind, nth: number): string {
  return `landmark${galaxy}${kind[0]!.toUpperCase()}${kind.slice(1)}${nth}`;
}

/** Landmark placement and charting (quests.md "Landmarks"), in world units. */
export const LANDMARK_TUNING = {
  /** Charting range: flying this close charts a landmark at once. */
  chart: 300,
  /** Landmarks per galaxy, a third of each kind. */
  count: 12,
  /** Clearance from stations and story destinations. */
  placeClearance: 1500,
  /** Within this distance of the galaxy's world origin. */
  radius: 25000,
  /** Apart from one another. */
  spacing: 3000,
} as const;
