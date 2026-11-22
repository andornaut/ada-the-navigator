/** A Cheats modal button: a cheat or Reset save (gameplay/cheats.md). */
export interface CheatAction {
  readonly id: string;
  readonly label: string;
  /** Whether it has anything to do now; a cheat with nothing left to grant is disabled. */
  readonly available: () => boolean;
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
