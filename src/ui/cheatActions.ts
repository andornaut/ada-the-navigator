import { type AppWindowHost, runsInAppWindow } from "@andornaut/game-kit/runtime/web/pwa/appWindow";

/** A Cheats modal button: a cheat, Show tips again or Reset save (gameplay/cheats.md). */
export interface CheatAction {
  readonly id: string;
  readonly label: string;
  /** Whether it has anything to do now; a cheat with nothing left to grant is disabled. */
  readonly available: () => boolean;
  readonly run: () => void;
}

/** Cheats exist only in a browser tab, never in the installed app. */
export function cheatsAllowed(host: AppWindowHost): boolean {
  return !runsInAppWindow(host);
}

/**
 * Runs an action only in a browser tab and while it is available, checking the app window at
 * the action as well as at open; false when it did not run.
 */
export function runCheatAction(host: AppWindowHost, action: CheatAction): boolean {
  if (!cheatsAllowed(host) || !action.available()) {
    return false;
  }
  action.run();
  return true;
}
