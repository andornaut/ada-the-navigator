/** A Cheats modal button: a cheat or Reset save (gameplay/cheats.md). */
export interface CheatAction {
  readonly id: string;
  readonly label: string;
  /** Whether the action can execute now, including its protection guards. */
  readonly available: () => boolean;
  /** An accessible refusal reason when an unavailable action is safe to attempt. */
  readonly refusalReason?: () => string | null;
  readonly run: () => void;
}

/** Recheck gameplay availability at activation, independently of display mode. */
export function runCheatAction(action: CheatAction): boolean {
  if (!action.available()) {
    return false;
  }
  action.run();
  return true;
}
