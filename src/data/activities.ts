import type { SectorId } from "./types.ts";

// Repeatable activities (gameplay/quests.md "Repeatable activities"): once a galaxy's chapter is
// complete, its story places offer one through Talk. Rewards are provisional tuning.

export type ActivityId = "guideCalf" | "miningContract" | "supplyRun";

export interface ActivityDefinition {
  readonly id: ActivityId;
  /** Each offering story place's id, to its activity line's label key. */
  readonly places: Readonly<Record<string, string>>;
  readonly reward: number;
}

/** Each galaxy's activity; Black Eye has none yet. */
export const ACTIVITIES: Readonly<Partial<Record<SectorId, ActivityDefinition>>> = {
  1: {
    id: "supplyRun",
    places: {
      growers: "activityGrower",
      salvagers: "activitySalvager",
      workshop: "activityWorkshop",
    },
    reward: 15,
  },
  2: { id: "miningContract", places: { hub: "activityStation" }, reward: 35 },
  3: { id: "guideCalf", places: { family: "activityFamily" }, reward: 50 },
};

/** The mining contract's goal: resources deposited at the hub after accepting. */
export const MINING_CONTRACT_DEPOSITS = 30;

/**
 * Sunflower's supply runs by issuing outpost: the carried item and the outpost it goes to, as
 * the objective names them. The 3000 delivery minimum does not apply.
 */
export const SUPPLY_RUNS: Readonly<Record<string, { readonly item: string; readonly to: string }>> =
  {
    growers: { item: "fresh food", to: "salvagers" },
    salvagers: { item: "spare parts", to: "workshop" },
    workshop: { item: "repaired tools", to: "growers" },
  };

/** Guide a calf, in world units and as a fraction of Ada's base top speed. */
export const CALF = {
  /** Its start, from the family. */
  distance: [5000, 8000] as const,
  /** A waiting calf follows once Ada is this close; a following one waits beyond `release`. */
  follow: 400,
  /** The calf within this of the family completes the guide. */
  home: 400,
  release: 700,
  /** At most this fraction of Ada's base maxSpeed, with no upgrades. */
  speedFraction: 0.8,
  /** It stops this far short of Ada. */
  stop: 120,
  /** Seeded spots tried before the family makes no offer that flight. */
  tries: 24,
} as const;
