import type { Screen } from "../model/game.ts";

/**
 * A cheat session (gameplay/cheats.md "Cheat session"): from the first cheat nothing is saved,
 * earned or banked. Returning to the start screen from play ends it, and Continue then plays the
 * save as it was before the first cheat; a reload ends it too, since nothing was saved.
 */
export interface CheatSession {
  readonly active: boolean;
  /** The pre-cheat save is loading back: saving stays suspended and actions wait. */
  readonly ending: boolean;
  /** Play as it was at the first cheat, in case the store cannot read it back. */
  readonly before: string | null;
}

export const NO_CHEAT_SESSION: CheatSession = { active: false, before: null, ending: false };

/**
 * The session a cheat runs in. The first cheat saves play up to that moment through `flush`,
 * which encodes the save before it returns, then starts the session; later cheats join it.
 */
export function beginCheatSession(
  flush: () => void,
  model: { cheatSession: boolean; save(): string },
  session: CheatSession,
): CheatSession {
  model.cheatSession = true;
  if (session.active) {
    return session;
  }
  flush();
  return { active: true, before: model.save(), ending: false };
}

/** Whether a step from `before` to `after` returns from play to the start screen, ending it. */
export function endsCheatSession(session: CheatSession, before: Screen, after: Screen): boolean {
  return session.active && !session.ending && before !== "start" && after === "start";
}
