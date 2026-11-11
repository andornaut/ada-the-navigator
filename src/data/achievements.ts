import { ECONOMY } from "./economy.ts";
import type { SectorId } from "./types.ts";

/**
 * What an achievement measures (gameplay/quests.md "Achievements"). Story achievements read the
 * game's own progress; the rest count events, some from systems still to be built: landmark
 * charting, station jobs and repeatable activities, optional allies, community projects and
 * Black Eye's blockade. Those register now and unlock once their system records events.
 */
export type AchievementGoal =
  | { readonly kind: "prologue" }
  | { readonly kind: "chapter"; readonly galaxy: SectorId }
  | { readonly kind: "blockade" }
  /** Landmarks charted in the galaxy with the most charted, of that galaxy's landmarks. */
  | { readonly kind: "chartOne" }
  /** Landmarks charted across all four galaxies, of all their landmarks. */
  | { readonly kind: "chartAll" }
  | { readonly kind: "jobs"; readonly need: number }
  /** Station jobs and repeatable activities together. */
  | { readonly kind: "helps"; readonly need: number }
  | { readonly kind: "allies" }
  | { readonly kind: "projects"; readonly need?: number }
  | { readonly kind: "pennyFinds"; readonly need: number }
  /** Ship paints owned, Classic included, of every paint. */
  | { readonly kind: "paints" };

export interface Achievement {
  readonly condition: string;
  /** Whether a locked entry shows its `{have}/{need}` count on the card. */
  readonly counted: boolean;
  readonly goal: AchievementGoal;
  readonly id: string;
  readonly name: string;
}

/** Gameplay's starter achievements, in card order. */
export const ACHIEVEMENTS: readonly Achievement[] = [
  {
    condition: "Finish the prologue.",
    counted: false,
    goal: { kind: "prologue" },
    id: "newNavigator",
    name: "New Navigator",
  },
  {
    condition: "Complete the Sunflower chapter.",
    counted: false,
    goal: { galaxy: 1, kind: "chapter" },
    id: "gardenBegins",
    name: "The Garden Begins",
  },
  {
    condition: "Complete the Cartwheel chapter.",
    counted: false,
    goal: { galaxy: 2, kind: "chapter" },
    id: "roomForEveryone",
    name: "Room for Everyone",
  },
  {
    condition: "Complete the Whirlpool chapter.",
    counted: false,
    goal: { galaxy: 3, kind: "chapter" },
    id: "timeToExplore",
    name: "Time to Explore",
  },
  {
    condition: "Break General Gadget's blockade in Black Eye.",
    counted: false,
    goal: { kind: "blockade" },
    id: "blockadeBreaker",
    name: "Blockade Breaker",
  },
  {
    condition: "Chart every landmark in one galaxy.",
    counted: true,
    goal: { kind: "chartOne" },
    id: "cartographer",
    name: "Cartographer",
  },
  {
    condition: "Chart every landmark in all four galaxies.",
    counted: true,
    goal: { kind: "chartAll" },
    id: "astrasAtlas",
    name: "Astra's Atlas",
  },
  {
    condition: "Complete a station job.",
    counted: false,
    goal: { kind: "jobs", need: 1 },
    id: "helpingHand",
    name: "Helping Hand",
  },
  {
    condition: "Complete 25 station jobs or repeatable activities.",
    counted: true,
    goal: { kind: "helps", need: 25 },
    id: "goodNeighbor",
    name: "Good Neighbor",
  },
  {
    condition: "Make every optional ally: quest and project allies.",
    counted: true,
    goal: { kind: "allies" },
    id: "friendsEverywhere",
    name: "Friends Everywhere",
  },
  {
    condition: "Fund a community project.",
    counted: false,
    goal: { kind: "projects", need: 1 },
    id: "goodCause",
    name: "Good Cause",
  },
  {
    condition: "Fund every community project.",
    counted: true,
    goal: { kind: "projects" },
    id: "communityBuilder",
    name: "Community Builder",
  },
  {
    condition: "Reach 10 things Penny sensed.",
    counted: true,
    goal: { kind: "pennyFinds", need: 10 },
    id: "goodNose",
    name: "Good Nose",
  },
  {
    condition: "Own every ship paint.",
    counted: true,
    goal: { kind: "paints" },
    id: "fullPalette",
    name: "Full Palette",
  },
];

/** A Penny find: a point she sensed that Ada then reaches within this many world units. */
export const PENNY_FIND_RANGE = 160;

/**
 * What the counted achievements count toward. Landmarks, optional allies and community projects
 * are not built yet, so their totals are zero and their achievements stay locked without a count;
 * each total becomes its catalog's size when that system lands.
 */
export const ACHIEVEMENT_TOTALS = {
  allies: 0,
  landmarks: {},
  paints: Object.keys(ECONOMY.paints).length,
  projects: 0,
} as const;
