import type { CommunityProject } from "../data/projects.ts";
import type { GalaxyNumber, GameContent } from "../data/types.ts";
import type {
  DialogueChoice,
  DialogueState,
  FlightEvent,
  FlightState,
  GalaxyProgress,
  UseAction,
  Vec,
} from "./types.ts";

/** The active chapter's model data. Chapter hooks do not own home, saves or route unlocks. */
export interface ChapterContext {
  readonly content: GameContent;
  readonly flight: FlightState;
  readonly progress: GalaxyProgress;
}

/** Shared outcomes are committed by GameModel, after a module handles the actual event. */
export interface ChapterResult {
  readonly complete?: boolean;
  readonly dialogue?: DialogueState;
  readonly holodisk?: { readonly giver?: string };
}

/** A funded community ally, retaining its galaxy and project identity. */
export interface ChapterAlly {
  readonly galaxy: GalaxyNumber;
  readonly project: CommunityProject;
}

/** Hooks use the existing flight engine and return shared outcomes through one model owner. */
export interface ChapterRuntime {
  readonly galaxy: GalaxyNumber;
  readonly route: readonly string[];
  /** Mounts the chapter's world and restores flight-local state at launch or Continue. */
  readonly init?: (context: ChapterContext) => void;
  /** Returns the chapter's objective destination, not a replacement player-facing goal. */
  readonly objectiveIndex?: (context: ChapterContext) => number;
  readonly objective?: (context: ChapterContext) => string | null;
  readonly beforeStep?: (context: ChapterContext, seconds: number) => void;
  readonly afterStep?: (
    context: ChapterContext,
    seconds: number,
    previous: Vec,
    events: readonly FlightEvent[],
  ) => ChapterResult | void;
  /** Undefined means the existing station, job and mechanical Use handlers may continue. */
  readonly activityChoices?: (
    context: ChapterContext,
    destination: string,
  ) => readonly DialogueChoice[];
  readonly action?: (context: ChapterContext, destination: string) => UseAction | undefined;
  readonly use?: (context: ChapterContext, destination: string) => ChapterResult | undefined;
  /** Called only for an offered, enabled choice; an empty result handles and closes its panel. */
  readonly choose?: (
    context: ChapterContext,
    dialogue: DialogueState,
    choice: string,
  ) => ChapterResult | undefined;
}
