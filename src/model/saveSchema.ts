import type { GameContent } from "../data/types.ts";
import type { GameState } from "./types.ts";

/** The save format this build writes and reads. */
export const SAVE_VERSION: GameState["version"] = 14;

/** Restores independent model state or rejects an invalid saved document. */
export interface SaveRestore {
  readonly restoreGameSave: (content: GameContent, saved: unknown) => GameState | null;
  readonly restoreSave: (saved: unknown) => GameState | null;
}
