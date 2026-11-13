import type { RoutePosition } from "./galaxies.ts";
import type { GalaxyNumber } from "./types.ts";

// Repeatable activities (gameplay/quests.md "Repeatable activities"): once a galaxy's chapter is
// complete, its story places offer one through Talk. Rewards are provisional tuning.

export type ActivityId = "guideCalf" | "miningContract" | "supplyRun";

export interface ActivityDefinition {
  /** The board row's detail line: the goal's label key. */
  readonly goal: string;
  readonly id: ActivityId;
  /** The board row's title: the activity's name in Gameplay's table. */
  readonly name: string;
  /** Each offering story place's id, to its activity line's label key. */
  readonly places: Readonly<Record<string, string>>;
  /** Its reward; a supply run pays the delivery rewards for its length instead. */
  readonly reward?: number;
}

/** Fixed activity pay by route position; Sunflower uses delivery pay, Phantom has no activity. */
export const ACTIVITY_REWARDS: Readonly<Partial<Record<RoutePosition, number>>> = {
  2: 105,
  3: 150,
  4: 165,
  5: 180,
};

/** Each galaxy's activity; Phantom has none yet. */
export const ACTIVITIES: Readonly<Partial<Record<GalaxyNumber, ActivityDefinition>>> = {
  1: {
    goal: "supplyGoal",
    id: "supplyRun",
    name: "Supply run",
    places: {
      growers: "activityGrower",
      salvagers: "activitySalvager",
      workshop: "activityWorkshop",
    },
  },
  2: {
    goal: "contractGoal",
    id: "miningContract",
    name: "Mining contract",
    // The hub is a station: its board offers the contract, with no Talk line.
    places: { hub: "" },
    reward: ACTIVITY_REWARDS[5]!,
  },
  3: {
    goal: "calfGoal",
    id: "guideCalf",
    name: "Guide a calf",
    places: { family: "activityFamily" },
    reward: ACTIVITY_REWARDS[2]!,
  },
};

/** The mining contract's goal: resources deposited at the hub after accepting. */
export const MINING_CONTRACT_DEPOSITS = 30;

/**
 * Sunflower's supply run items by issuing outpost. Each goes to a known station by the delivery
 * job rules (data/jobs.ts JOB_TUNING.delivery).
 */
export const SUPPLY_ITEMS: Readonly<Record<string, string>> = {
  growers: "fresh food",
  salvagers: "spare parts",
  workshop: "repaired tools",
};

/** Guide a calf, in world units and as a fraction of Ada's base top speed. */
export const CALF = {
  /** Its start, from the family. */
  distance: [5000, 8000] as const,
  /**
   * A waiting calf follows once Ada is this close, inside the view's 180 vertical half-height so
   * it is on screen; a following one waits beyond `release`, about the view's edge.
   */
  follow: 160,
  /** The calf within this of the family completes the guide. */
  home: 400,
  release: 340,
  /** At most this fraction of Ada's maximum speed at her base engine. */
  speedFraction: 0.8,
  /** It stops this far short of Ada. */
  stop: 120,
  /** Seeded spots tried before the family makes no offer that flight. */
  tries: 24,
} as const;
