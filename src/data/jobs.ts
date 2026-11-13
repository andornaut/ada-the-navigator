import type { RoutePosition } from "./galaxies.ts";
import type { GalaxyNumber } from "./types.ts";

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
  Partial<Record<RoutePosition, Readonly<Partial<Record<JobRewardKind, number>>>>>
> = {
  1: { deliveryLong: 75, deliveryShort: 45, hunt: 45, rescue: 75, survey: 30 },
  2: { deliveryLong: 105, deliveryShort: 60, hunt: 60, rescue: 105, survey: 45 },
  3: { deliveryLong: 150, deliveryShort: 90, hunt: 90, rescue: 150, survey: 60 },
  4: { deliveryLong: 150, deliveryShort: 90, hunt: 90, rescue: 150, survey: 60 },
  5: { deliveryLong: 150, deliveryShort: 90, hunt: 90, rescue: 150, survey: 60 },
  // Phantom's boards offer only surveys and rescues.
  6: { rescue: 150, survey: 60 },
};

/**
 * Each galaxy's pool: what its jobs carry, tow and look for (quests.md "Job pool"). Phantom's
 * travelers only need towing.
 */
export const JOB_POOL: Readonly<
  Partial<
    Record<
      GalaxyNumber,
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
  4: {
    craft: ["a stuck glider", "a pod"],
    delivery: ["thread spools", "glass beads", "a message"],
    lost: ["weaving shuttle", "silver bell"],
  },
  5: {
    craft: ["a lost courier", "a drifting lamp buoy"],
    delivery: ["beacon parts", "mail", "a message"],
    lost: ["courier's badge", "lantern"],
  },
  6: {
    craft: ["a traveler's pod"],
    delivery: [],
    lost: [],
  },
};

/** Astra's lore lines after a job completes, one unseen line per job, for each built galaxy. */
export const JOB_LORE: Readonly<Partial<Record<GalaxyNumber, readonly string[]>>> = {
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
  4: [
    "We see Needle from its edge, like a plate held sideways.",
    "The Avi say a channel is learned, not won.",
  ],
  5: [
    "Andromeda is so bright that people on Earth can see it without a telescope.",
    "A beacon only helps if it tells the truth about where it is.",
  ],
  6: ["Not every traveler here chose to stay.", "Even a dark rim has stars."],
};

/** A landmark's kind: drawn in the galaxy's own palette. */
export type LandmarkKind = "nebula" | "wreck" | "beacon";
export const LANDMARK_KINDS: readonly LandmarkKind[] = ["nebula", "wreck", "beacon"];

/** Every galaxy, by galaxy: each names four landmarks of each kind. */
export type LandmarkGalaxy = 1 | 2 | 3 | 4 | 5 | 6;
export const LANDMARK_GALAXIES: readonly LandmarkGalaxy[] = [1, 2, 3, 4, 5, 6];

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
