import { ECONOMY } from "../../data/economy.ts";
import { GALAXY_NUMBERS } from "../../data/galaxies.ts";
import type { GalaxyNumber } from "../../data/types.ts";
import { newAchievements } from "../achievements.ts";
import { chapterRuntime } from "../chapters.ts";
import { newProgress } from "../progress.ts";
import { SAVE_VERSION } from "../saveSchema.ts";
import type { GalaxyProgress, GameState } from "../types.ts";
import { newEconomy } from "../upgrades.ts";

/** A first launch: galaxy one unlocked and nothing begun. */
export function newGameState(): GameState {
  return {
    achievements: newAchievements(),
    announceGalaxy: false,
    dialogue: null,
    docked: null,
    economy: newEconomy(ECONOMY),
    flight: null,
    jobs: { boards: {}, made: 0 },
    mode: "home",
    notice: "",
    progress: Object.fromEntries(GALAXY_NUMBERS.map((id) => [id, newProgress()])) as Record<
      GalaxyNumber,
      GalaxyProgress
    >,
    prologueSeen: false,
    seenConversations: [],
    selectedGalaxy: 1,
    started: false,
    tasks: {},
    unlocked: [1],
    version: SAVE_VERSION,
  };
}

// The built galaxies' story destinations; a placeholder galaxy has none.
const required: Partial<Record<GalaxyNumber, readonly string[]>> = {
  1: ["growers", "workshop", "salvagers", "workshop"],
  2: ["hub", "hub", "miner", "visitors", "hub"],
  3: ["whale", "whale", "whale", "family", "whale"],
};

/** A galaxy's story destinations in the order its route first visits them; the first opens it. */
export function galaxyRoute(galaxy: GalaxyNumber): readonly string[] {
  return chapterRuntime(galaxy)?.route ?? [...new Set(required[galaxy] ?? [])];
}
/** A stage of the early campaign can revisit a prior required destination. */
export function earlyRequiredDestination(galaxy: GalaxyNumber, stage: number): string | undefined {
  return required[galaxy]?.[stage];
}
